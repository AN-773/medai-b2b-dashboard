/**
 * The dean's chat with agent-v2: the faculty surface's turn and thread routes.
 *
 * `contracts/agent-v2-contract.md` ("Faculty Ask") is the contract. In short:
 *
 * - `POST /v1/turns` with `surface: "faculty"` starts a turn and answers `202`
 *   with its ids; nothing runs in the request.
 * - `GET /v1/turns/:operationId/stream` is the turn as SSE, read with `fetch`
 *   (an `EventSource` cannot send the bearer). Every event's `seq` is its SSE
 *   `id:`, and a reconnect sends the last one back as `Last-Event-ID`, so the
 *   server replays from the next event: nothing lost, nothing repeated.
 * - `POST /v1/turns/:operationId/cancel` ends a turn; the ending still arrives
 *   on the stream.
 * - `GET /v1/threads?surface=faculty` and `GET /v1/threads/:threadId/messages`
 *   list and reload conversations.
 *
 * The JSON routes go through `apiClient` (base URL `VITE_AGENT_V2_API_URL`, the
 * `msai_educator_token` bearer, and no logout on a 401 because AGENT_V2 is not
 * session-owning). The stream cannot, because axios in a browser does not
 * stream, so it uses `fetch` with the same base URL and bearer helpers.
 *
 * Every failure is a {@link FacultyChatError} (`facultyChatErrors.ts`).
 */

import { apiClient, getServiceBaseUrl, readAuthToken } from './apiClient';
import { isAgentV2Configured } from './agentV2Service';
import { foldContextIntoMessage, type FacultyPageContext } from './facultyChatContext';
import {
  FacultyChatError,
  facultyChatErrorFromResponse,
  isAbortError,
  toFacultyChatError,
  type FacultyChatErrorInfo,
} from './facultyChatErrors';
import { readSseFrames, SseStallError, type SseFrame } from './facultyChatSse';
import {
  FACULTY_SURFACE,
  MAX_IDENTIFIER_CHARS,
  MAX_THREAD_LIST_LIMIT,
  MAX_TURN_MESSAGE_CHARS,
  isPlainObject,
  isTerminalStreamEventType,
  type CancelledTurn,
  type CreatedTurn,
  type CreateFacultyTurnBody,
  type FacultyStreamEvent,
  type ListThreadsResponse,
  type ThreadMessagesResponse,
} from './facultyChatWire';

export const TURNS_PATH = '/v1/turns';
export const THREADS_PATH = '/v1/threads';
const LAST_EVENT_ID_HEADER = 'Last-Event-ID';

/**
 * Reconnect delays, by consecutive failed attempt; the length is the attempt
 * budget. A frame received resets the count, so a long turn that drops now and
 * then is never capped; only a stream that keeps dying at once gives up.
 * About 15 s in all: enough for a deploy's task swap or a Wi-Fi hand-over.
 */
export const DEFAULT_RECONNECT_BACKOFF_MS: readonly number[] = [500, 1_000, 2_000, 4_000, 8_000];

/**
 * How long a connection may be silent before it is treated as dropped.
 * agent-v2 writes a heartbeat after 15 s of quiet (`STREAM_HEARTBEAT_INTERVAL_MS`),
 * so three missed heartbeats is a half-open socket, not a slow answer.
 */
export const DEFAULT_STALL_TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateFacultyTurnInput {
  /** Continue this conversation; omit to start a new one. */
  readonly threadId?: string | null;
  /** The dean's question, as typed. */
  readonly text: string;
  /** "Ask about this cohort": folded into the message (see `facultyChatContext.ts`). */
  readonly context?: FacultyPageContext | null;
  /**
   * A UUID for this turn. Generated when omitted. Sending the same one again
   * after a lost response is safe: the server answers the existing turn with
   * `created: false`.
   */
  readonly operationId?: string;
}

export interface StreamTurnOptions {
  /** Resume after this event (`seq`, as a string). Omit to replay the turn from its start. */
  readonly lastEventId?: string | null;
  /** Abort to stop reading. The turn keeps running on the server; use {@link FacultyChatClient.cancelTurn} to end it. */
  readonly signal?: AbortSignal;
}

/** What {@link FacultyChatClient.streamTurn} yields. */
export type FacultyStreamItem =
  /** A connection opened (`attempt` 0 is the first). The server has accepted the cursor. */
  | { readonly kind: 'open'; readonly attempt: number; readonly lastEventId: string | null }
  /** A decoded event with a valid envelope, known or not. */
  | { readonly kind: 'event'; readonly event: FacultyStreamEvent; readonly id: string | null }
  /** A frame that could not be decoded. Reported, skipped, and the cursor still moves past it. */
  | {
      readonly kind: 'malformed';
      readonly id: string | null;
      readonly eventName: string;
      readonly reason: MalformedFrameReason;
    }
  /** The connection dropped; waiting `delayMs`, then reopening from `lastEventId`. */
  | {
      readonly kind: 'reconnecting';
      readonly attempt: number;
      readonly delayMs: number;
      readonly lastEventId: string | null;
      readonly cause: FacultyChatErrorInfo;
    };

export type MalformedFrameReason = 'invalid_json' | 'not_an_object' | 'missing_type' | 'missing_seq' | 'wrong_operation';

export interface ListFacultyThreadsOptions {
  /** `nextCursor` from the previous page. */
  readonly cursor?: string | null;
  /** 1 to 200. The server's default is 50. */
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export interface FacultyChatClient {
  /** Whether this site has an agent at all (`VITE_AGENT_V2_API_URL`). */
  isConfigured(): boolean;
  createFacultyTurn(input: CreateFacultyTurnInput, options?: RequestOptions): Promise<CreatedTurn>;
  streamTurn(operationId: string, options?: StreamTurnOptions): AsyncGenerator<FacultyStreamItem, void, void>;
  cancelTurn(operationId: string, options?: RequestOptions): Promise<CancelledTurn>;
  listFacultyThreads(options?: ListFacultyThreadsOptions): Promise<ListThreadsResponse>;
  getThreadMessages(threadId: string, options?: RequestOptions): Promise<ThreadMessagesResponse>;
}

export interface FacultyChatClientOptions {
  /** Defaults to `VITE_AGENT_V2_API_URL` via `apiClient`. */
  readonly baseUrl?: () => string;
  /** Defaults to the `msai_educator_token` bearer. */
  readonly getToken?: () => string | null;
  /** The stream's transport. Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Injected so tests own time. Must resolve early when `signal` aborts. */
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly reconnectBackoffMs?: readonly number[];
  /** `0` turns the watchdog off. */
  readonly stallTimeoutMs?: number;
  /** Defaults to `crypto.randomUUID()`, or none (the server mints one) where that is unavailable. */
  readonly newOperationId?: () => string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const defaultNewOperationId = (): string | null => {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : null;
};

/** A non-negative integer, as agent-v2 writes `seq`. */
const isSeq = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** An SSE `id:` that is a usable cursor. Anything else would cost a full replay, so it is not kept. */
const isCursor = (id: string | null): id is string => id !== null && /^\d+$/.test(id.trim());

const invalid = (code: string, message: string) =>
  new FacultyChatError('invalid_request', message, { code });

const requireId = (value: string | null | undefined, name: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_CHARS) {
    throw invalid(`invalid_${name}`, `A ${name} must be a non-empty string of at most ${String(MAX_IDENTIFIER_CHARS)} characters.`);
  }
  return trimmed;
};

const readJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

/**
 * One SSE frame, as an event — or why it is not one.
 *
 * agent-v2 repeats `type` in the JSON body and in `event:`, and `seq` in the
 * body and in `id:`; either copy is accepted. An event for another operation
 * is refused: this connection is about one turn.
 */
export const parseStreamFrame = (
  frame: SseFrame,
  operationId: string,
): { ok: true; event: FacultyStreamEvent } | { ok: false; reason: MalformedFrameReason } => {
  let body: unknown;
  try {
    body = JSON.parse(frame.data);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  if (!isPlainObject(body)) return { ok: false, reason: 'not_an_object' };

  const type =
    typeof body.type === 'string' && body.type.trim()
      ? body.type.trim()
      : frame.event !== 'message'
        ? frame.event.trim()
        : '';
  if (!type) return { ok: false, reason: 'missing_type' };

  const seq = isSeq(body.seq) ? body.seq : isCursor(frame.id) ? Number(frame.id) : null;
  if (seq === null) return { ok: false, reason: 'missing_seq' };

  const eventOperation = typeof body.operationId === 'string' && body.operationId ? body.operationId : operationId;
  if (eventOperation !== operationId) return { ok: false, reason: 'wrong_operation' };

  return {
    ok: true,
    event: {
      ...body,
      type,
      seq,
      operationId: eventOperation,
      at: typeof body.at === 'string' ? body.at : '',
    } as FacultyStreamEvent,
  };
};

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

export const createFacultyChatClient = (options: FacultyChatClientOptions = {}): FacultyChatClient => {
  const baseUrl = options.baseUrl ?? (() => getServiceBaseUrl('AGENT_V2'));
  const getToken = options.getToken ?? readAuthToken;
  const fetchImpl: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;
  const backoff = options.reconnectBackoffMs ?? DEFAULT_RECONNECT_BACKOFF_MS;
  const stallTimeoutMs = options.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;
  const newOperationId = options.newOperationId ?? defaultNewOperationId;

  const isConfigured = (): boolean =>
    options.baseUrl ? Boolean(baseUrl().trim()) : isAgentV2Configured();

  const assertConfigured = () => {
    if (!isConfigured()) {
      throw new FacultyChatError('not_configured', 'This site has no agent service configured (VITE_AGENT_V2_API_URL).');
    }
  };

  /** A JSON call through `apiClient`, with every failure typed. */
  const callJson = async <T>(call: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    assertConfigured();
    try {
      return await call();
    } catch (error) {
      throw toFacultyChatError(error, signal);
    }
  };

  const createFacultyTurn = async (
    input: CreateFacultyTurnInput,
    { signal }: RequestOptions = {},
  ): Promise<CreatedTurn> => {
    assertConfigured();

    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) throw invalid('nothing_asked', 'Type a question first.');

    const message = foldContextIntoMessage(text, input.context);
    if (message.length > MAX_TURN_MESSAGE_CHARS) {
      throw invalid('message_too_long', `A question may be at most ${String(MAX_TURN_MESSAGE_CHARS)} characters.`);
    }

    const threadId = input.threadId == null ? undefined : requireId(input.threadId, 'thread_id');
    const operationId = input.operationId ?? newOperationId() ?? undefined;

    const body: CreateFacultyTurnBody = {
      message,
      surface: FACULTY_SURFACE,
      ...(threadId === undefined ? {} : { threadId }),
      ...(operationId ? { operationId } : {}),
    };

    const created = await callJson(
      () => apiClient.post<CreatedTurn>('AGENT_V2', TURNS_PATH, body, { signal }),
      signal,
    );
    if (!isPlainObject(created) || typeof created.operationId !== 'string' || typeof created.threadId !== 'string') {
      throw new FacultyChatError('unknown', 'The agent service accepted the question but did not say which turn it started.');
    }
    return created;
  };

  const cancelTurn = async (operationId: string, { signal }: RequestOptions = {}): Promise<CancelledTurn> => {
    const id = requireId(operationId, 'operation_id');
    return await callJson(
      () => apiClient.post<CancelledTurn>('AGENT_V2', `${TURNS_PATH}/${encodeURIComponent(id)}/cancel`, undefined, { signal }),
      signal,
    );
  };

  const listFacultyThreads = async ({
    cursor,
    limit,
    signal,
  }: ListFacultyThreadsOptions = {}): Promise<ListThreadsResponse> => {
    const query = new URLSearchParams({ surface: FACULTY_SURFACE });
    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_THREAD_LIST_LIMIT) {
        throw invalid('invalid_limit', `limit must be a whole number from 1 to ${String(MAX_THREAD_LIST_LIMIT)}.`);
      }
      query.set('limit', String(limit));
    }
    if (cursor) query.set('cursor', cursor);
    return await callJson(
      () => apiClient.get<ListThreadsResponse>('AGENT_V2', `${THREADS_PATH}?${query.toString()}`, { signal }),
      signal,
    );
  };

  const getThreadMessages = async (threadId: string, { signal }: RequestOptions = {}): Promise<ThreadMessagesResponse> => {
    const id = requireId(threadId, 'thread_id');
    return await callJson(
      () => apiClient.get<ThreadMessagesResponse>('AGENT_V2', `${THREADS_PATH}/${encodeURIComponent(id)}/messages`, { signal }),
      signal,
    );
  };

  /** Open one connection to the stream, or throw a typed error. */
  const openStream = async (
    operationId: string,
    cursor: string | null,
    signal: AbortSignal | undefined,
  ): Promise<ReadableStream<Uint8Array>> => {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cursor !== null) headers[LAST_EVENT_ID_HEADER] = cursor;

    const url = `${baseUrl().replace(/\/+$/, '')}${TURNS_PATH}/${encodeURIComponent(operationId)}/stream`;
    let response: Response;
    try {
      response = await fetchImpl(url, { method: 'GET', headers, signal, cache: 'no-store' });
    } catch (error) {
      throw toFacultyChatError(error, signal);
    }
    if (!response.ok) throw facultyChatErrorFromResponse(response.status, await readJsonSafely(response));
    if (!response.body) throw new FacultyChatError('stream_lost', 'The stream response carried no body.');
    return response.body;
  };

  /**
   * Read one turn to its end, reconnecting across drops.
   *
   * Ends (returns) after `turn.completed` or `turn.failed`, or when `signal`
   * aborts. A body that ends before either is a dropped connection, not an
   * ending, and is reopened from the last `id:` seen. So is a connection
   * silent past the watchdog, a body read error, a network failure or a 5xx
   * on reopen. A 401/403/404 is not retried and is thrown. After the backoff
   * budget runs out it throws `stream_lost`; the turn may well still be
   * running, and calling this again with the last cursor picks it up.
   */
  async function* streamTurn(
    operationId: string,
    { lastEventId = null, signal }: StreamTurnOptions = {},
  ): AsyncGenerator<FacultyStreamItem, void, void> {
    assertConfigured();
    const id = requireId(operationId, 'operation_id');

    let cursor: string | null = isCursor(lastEventId) ? lastEventId.trim() : null;
    let failures = 0;
    let connections = 0;

    for (;;) {
      if (signal?.aborted) return;

      // Why this connection ended without the turn ending. Set on every path
      // that reaches the reconnect below.
      let cause: FacultyChatError | null = null;
      let body: ReadableStream<Uint8Array> | null = null;
      try {
        body = await openStream(id, cursor, signal);
      } catch (error) {
        if (isAbortError(error, signal)) return;
        const mapped = toFacultyChatError(error, signal);
        if (!mapped.retryable) throw mapped;
        cause = mapped;
      }

      if (body !== null) {
        yield { kind: 'open', attempt: connections, lastEventId: cursor };
        connections += 1;

        let terminal = false;
        try {
          for await (const frame of readSseFrames(body, { signal, stallTimeoutMs })) {
            failures = 0;
            if (isCursor(frame.id)) cursor = frame.id.trim();

            const parsed = parseStreamFrame(frame, id);
            if (parsed.ok === false) {
              yield { kind: 'malformed', id: frame.id, eventName: frame.event, reason: parsed.reason };
              continue;
            }
            if (!isCursor(frame.id)) cursor = String(parsed.event.seq);

            yield { kind: 'event', event: parsed.event, id: frame.id };
            if (isTerminalStreamEventType(parsed.event.type)) {
              terminal = true;
              break;
            }
          }
        } catch (error) {
          if (isAbortError(error, signal)) return;
          // Once the response was accepted, any read failure is a dropped
          // connection, whatever the browser calls it.
          cause =
            error instanceof SseStallError
              ? new FacultyChatError('stream_lost', 'The stream went silent.', { cause: error })
              : new FacultyChatError('stream_lost', 'The stream connection dropped.', { cause: error });
        }

        if (terminal || signal?.aborted) return;
        cause ??= new FacultyChatError('stream_lost', 'The stream ended before the turn did.');
      }

      const reason = cause ?? new FacultyChatError('stream_lost', 'The stream ended before the turn did.');
      if (failures >= backoff.length) {
        throw new FacultyChatError('stream_lost', 'Lost the connection to the answer and could not reopen it.', {
          status: reason.status,
          code: reason.code,
          retryable: true,
          cause: reason,
        });
      }

      const delayMs = backoff[failures];
      failures += 1;
      yield { kind: 'reconnecting', attempt: failures, delayMs, lastEventId: cursor, cause: reason.toInfo() };
      await sleep(delayMs, signal);
    }
  }

  return { isConfigured, createFacultyTurn, streamTurn, cancelTurn, listFacultyThreads, getThreadMessages };
};

/** The client this app uses, on `VITE_AGENT_V2_API_URL` and the educator's bearer. */
export const facultyChatClient: FacultyChatClient = createFacultyChatClient();

export const createFacultyTurn: FacultyChatClient['createFacultyTurn'] = (input, options) =>
  facultyChatClient.createFacultyTurn(input, options);
export const streamTurn: FacultyChatClient['streamTurn'] = (operationId, options) =>
  facultyChatClient.streamTurn(operationId, options);
export const cancelTurn: FacultyChatClient['cancelTurn'] = (operationId, options) =>
  facultyChatClient.cancelTurn(operationId, options);
export const listFacultyThreads: FacultyChatClient['listFacultyThreads'] = (options) =>
  facultyChatClient.listFacultyThreads(options);
export const getThreadMessages: FacultyChatClient['getThreadMessages'] = (threadId, options) =>
  facultyChatClient.getThreadMessages(threadId, options);
