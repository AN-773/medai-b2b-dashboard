/**
 * Fakes for the faculty chat tests: agent-v2 stream frames, `fetch` responses,
 * and a scripted {@link FacultyChatClient}. No network.
 */
import type {
  CreateFacultyTurnInput,
  FacultyChatClient,
  FacultyStreamItem,
  StreamTurnOptions,
} from '../facultyChatClient';
import type {
  FacultyFeedbackBody,
  FacultyStreamEvent,
  ListThreadsResponse,
  ThreadMessagesResponse,
} from '../facultyChatWire';

export const OP = '11111111-1111-4111-8111-111111111111';
export const THREAD = 'thread-1';

const encoder = new TextEncoder();

/** An agent-v2 event with its envelope. */
export const ev = (seq: number, type: string, fields: Record<string, unknown> = {}, operationId = OP): FacultyStreamEvent =>
  ({ type, seq, operationId, at: `2026-10-30T00:00:${String(seq).padStart(2, '0')}.000Z`, ...fields }) as FacultyStreamEvent;

/** One SSE frame exactly as agent-v2's `encodeStreamEvent` writes it. */
export const frame = (event: FacultyStreamEvent): string =>
  `id: ${String(event.seq)}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/** A readable body: one chunk per pull, then close, hang open, or error. */
export const sseBody = (chunks: string[], end: 'close' | 'hang' | 'error' = 'close'): ReadableStream<Uint8Array> => {
  const queue = chunks.map((chunk) => encoder.encode(chunk));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next) return controller.enqueue(next);
      if (end === 'close') return controller.close();
      if (end === 'error') return controller.error(new TypeError('network error'));
      return new Promise<void>(() => undefined);
    },
  });
};

export const sseResponse = (chunks: string[], end: 'close' | 'hang' | 'error' = 'close'): Response =>
  new Response(sseBody([': stream open\n\n', ...chunks], end), {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });

export const problemResponse = (status: number, code: string, message = 'refused'): Response =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** The usual answer: a turn that starts, says "Hello", and completes. */
export const helloTurn = (from = 0): FacultyStreamEvent[] => [
  ev(from, 'turn.started', { threadId: THREAD }),
  ev(from + 1, 'message.started', { messageId: 'm1' }),
  ev(from + 2, 'text.delta', { messageId: 'm1', text: 'Hel' }),
  ev(from + 3, 'text.delta', { messageId: 'm1', text: 'lo' }),
  ev(from + 4, 'message.completed', { messageId: 'm1', reason: 'complete' }),
  ev(from + 5, 'turn.completed', { reason: 'completed' }),
];

/** A push-driven async queue, so a test decides when each stream item arrives. */
export class ItemQueue<T> {
  private items: T[] = [];
  private waiting: ((result: IteratorResult<T>) => void) | null = null;
  private closed = false;
  private failure: unknown = null;

  push(...items: T[]): void {
    for (const item of items) {
      if (this.waiting) {
        const resolve = this.waiting;
        this.waiting = null;
        resolve({ value: item, done: false });
      } else this.items.push(item);
    }
  }

  close(): void {
    this.closed = true;
    this.waiting?.({ value: undefined, done: true });
    this.waiting = null;
  }

  fail(error: unknown): void {
    this.failure = error;
    this.close();
  }

  async *iterate(signal?: AbortSignal): AsyncGenerator<T, void, void> {
    for (;;) {
      if (signal?.aborted) return;
      if (this.items.length) {
        yield this.items.shift() as T;
        continue;
      }
      if (this.closed) {
        if (this.failure) throw this.failure;
        return;
      }
      const next = await new Promise<IteratorResult<T>>((resolve) => {
        this.waiting = resolve;
        signal?.addEventListener('abort', () => resolve({ value: undefined, done: true }), { once: true });
      });
      if (next.done) {
        if (this.failure && !signal?.aborted) throw this.failure;
        return;
      }
      yield next.value;
    }
  }
}

/** A client whose every stream is a queue the test drives, and whose JSON calls are spies. */
export const scriptedClient = () => {
  const streams: { operationId: string; options: StreamTurnOptions; queue: ItemQueue<FacultyStreamItem> }[] = [];
  const calls = {
    create: [] as CreateFacultyTurnInput[],
    cancel: [] as string[],
    messages: [] as string[],
    threads: [] as (string | null)[],
    feedback: [] as FacultyFeedbackBody[],
  };
  const replies = {
    create: async (input: CreateFacultyTurnInput) => ({
      operationId: input.operationId ?? OP,
      threadId: input.threadId ?? THREAD,
      created: true,
      stream: '',
      cancel: '',
      approvals: '',
    }),
    cancel: async (operationId: string) => ({
      operationId,
      cancelled: true,
      status: 'completed' as const,
      completionReason: 'cancelled' as const,
    }),
    messages: async (threadId: string): Promise<ThreadMessagesResponse> => ({ threadId, messages: [] }),
    threads: async (_cursor: string | null): Promise<ListThreadsResponse> => ({
      threads: [],
      nextCursor: null,
      watchCursor: '',
    }),
    feedback: async (_body: FacultyFeedbackBody): Promise<void> => undefined,
  };

  const client: FacultyChatClient = {
    isConfigured: () => true,
    createFacultyTurn: async (input) => {
      calls.create.push(input);
      return await replies.create(input);
    },
    streamTurn: (operationId, options = {}) => {
      const queue = new ItemQueue<FacultyStreamItem>();
      streams.push({ operationId, options, queue });
      return queue.iterate(options.signal);
    },
    cancelTurn: async (operationId) => {
      calls.cancel.push(operationId);
      return await replies.cancel(operationId);
    },
    listFacultyThreads: async ({ cursor = null } = {}) => {
      calls.threads.push(cursor);
      return await replies.threads(cursor);
    },
    getThreadMessages: async (threadId) => {
      calls.messages.push(threadId);
      return await replies.messages(threadId);
    },
    submitFacultyFeedback: async (body) => {
      calls.feedback.push(body);
      await replies.feedback(body);
    },
  };

  return { client, streams, calls, replies };
};

/** Let pending promises and queued microtasks run. */
export const settle = async (rounds = 5): Promise<void> => {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
