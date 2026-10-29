/**
 * Server-Sent Events, read off a `fetch` body.
 *
 * `EventSource` cannot send an `Authorization` header, and agent-v2's stream
 * route is behind the dean's bearer, so the stream is a plain `fetch` whose
 * body is parsed here. Two layers, so each can be tested on its own:
 *
 * - {@link SseParser} is pure: text in, frames out, any chunking. It follows
 *   the WHATWG event-stream rules that matter on this wire — CR, LF and CRLF
 *   line ends (including a CRLF split across two chunks), `data:` lines joined
 *   with `\n`, `:` comment lines ignored, one leading space stripped, and an
 *   incomplete block at end of input discarded rather than dispatched. That
 *   last rule is what makes a dropped connection safe: a half-received frame is
 *   never parsed as truncated JSON, and the reconnect replays it whole.
 * - {@link readSseFrames} reads bytes, decodes UTF-8 across chunk boundaries,
 *   and gives up on a connection that has been silent for longer than the
 *   backend's heartbeat allows (a half-open socket otherwise blocks forever).
 *
 * Nothing here knows an event name. Meaning is `facultyChatClient.ts`' job.
 */

/** One dispatched event block. `data` is the raw text, unparsed. */
export interface SseFrame {
  /** The block's own `id:` field, or `null` when it had none. agent-v2 sends `seq` here. */
  readonly id: string | null;
  /** The `event:` field, or `'message'` when absent. */
  readonly event: string;
  readonly data: string;
}

/**
 * An incremental event-stream parser.
 *
 * `push` text as it arrives and take the frames it completes; `end` once the
 * input is over (it returns nothing: an unterminated block is discarded).
 */
export class SseParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName = '';
  private id: string | null = null;
  private sawData = false;
  /** Comment lines seen so far (`: stream open`). Liveness only. */
  comments = 0;

  push(text: string): SseFrame[] {
    this.buffer += text;
    const frames: SseFrame[] = [];

    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer);
      if (match === null) break;
      // A CR at the very end may be the first half of a CRLF whose LF is in
      // the next chunk. Wait for it, or the LF would read as a blank line and
      // dispatch a block early.
      if (match[0] === '\r' && match.index === this.buffer.length - 1) break;

      const line = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);

      const frame = this.processLine(line);
      if (frame !== null) frames.push(frame);
    }

    return frames;
  }

  /**
   * The input is over. A CR held back by {@link push} still ends its line, so
   * a block that was in fact terminated is dispatched; whatever block was not
   * terminated by a blank line is dropped.
   */
  end(): SseFrame[] {
    const frames: SseFrame[] = [];
    if (this.buffer.endsWith('\r')) {
      const frame = this.processLine(this.buffer.slice(0, -1));
      if (frame !== null) frames.push(frame);
    }
    this.buffer = '';
    this.resetBlock();
    return frames;
  }

  private processLine(line: string): SseFrame | null {
    if (line === '') return this.dispatch();

    if (line.startsWith(':')) {
      this.comments += 1;
      return null;
    }

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        this.dataLines.push(value);
        this.sawData = true;
        break;
      case 'event':
        this.eventName = value;
        break;
      case 'id':
        // The spec ignores an id containing NULL.
        if (!value.includes('\u0000')) this.id = value;
        break;
      default:
        // `retry:` and unknown fields: nothing on this wire depends on them.
        break;
    }

    return null;
  }

  private dispatch(): SseFrame | null {
    const frame: SseFrame | null = this.sawData
      ? { id: this.id, event: this.eventName || 'message', data: this.dataLines.join('\n') }
      : null;
    this.resetBlock();
    return frame;
  }

  private resetBlock(): void {
    this.dataLines = [];
    this.eventName = '';
    this.id = null;
    this.sawData = false;
  }
}

/** Thrown by {@link readSseFrames} when a connection says nothing for too long. */
export class SseStallError extends Error {
  constructor(readonly silentForMs: number) {
    super(`The stream said nothing for ${String(silentForMs)} ms.`);
    this.name = 'SseStallError';
  }
}

export interface ReadSseFramesOptions {
  /** Ends the read quietly (the generator returns). */
  readonly signal?: AbortSignal;
  /**
   * Give up on a connection silent for this long, by throwing
   * {@link SseStallError}. Any bytes count, comments included. `0` disables.
   */
  readonly stallTimeoutMs?: number;
}

const abortedPromise = (signal: AbortSignal | undefined): { promise: Promise<'aborted'>; dispose: () => void } => {
  if (!signal) return { promise: new Promise<'aborted'>(() => undefined), dispose: () => undefined };
  if (signal.aborted) return { promise: Promise.resolve('aborted'), dispose: () => undefined };
  let onAbort: () => void = () => undefined;
  const promise = new Promise<'aborted'>((resolve) => {
    onAbort = () => resolve('aborted');
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return { promise, dispose: () => signal.removeEventListener('abort', onAbort) };
};

/**
 * Read a response body as SSE frames.
 *
 * Returns (no throw) when the body ends or `signal` aborts. Throws
 * {@link SseStallError} on a silent connection, and rethrows whatever the body
 * itself throws (a dropped connection). The underlying reader is cancelled on
 * every way out, so the socket is released.
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
  options: ReadSseFramesOptions = {},
): AsyncGenerator<SseFrame, void, void> {
  const { signal, stallTimeoutMs = 0 } = options;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  const aborted = abortedPromise(signal);

  try {
    for (;;) {
      if (signal?.aborted) return;

      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled =
        stallTimeoutMs > 0
          ? new Promise<'stalled'>((resolve) => {
              timer = setTimeout(() => resolve('stalled'), stallTimeoutMs);
            })
          : new Promise<'stalled'>(() => undefined);

      const pending = reader.read();
      let outcome: ReadableStreamReadResult<Uint8Array> | 'stalled' | 'aborted';
      try {
        outcome = await Promise.race([pending, stalled, aborted.promise]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }

      if (outcome === 'aborted') {
        pending.catch(() => undefined);
        return;
      }
      if (outcome === 'stalled') {
        pending.catch(() => undefined);
        throw new SseStallError(stallTimeoutMs);
      }
      if (outcome.done) {
        // Flush the decoder; whatever block is left unterminated is dropped.
        const last = [...parser.push(decoder.decode()), ...parser.end()];
        for (const frame of last) {
          yield frame;
          if (signal?.aborted) return;
        }
        return;
      }

      for (const frame of parser.push(decoder.decode(outcome.value, { stream: true }))) {
        yield frame;
        if (signal?.aborted) return;
      }
    }
  } finally {
    aborted.dispose();
    reader.cancel().catch(() => undefined);
    try {
      reader.releaseLock();
    } catch {
      // Already released, or a read is still settling on a torn-down socket.
    }
  }
}
