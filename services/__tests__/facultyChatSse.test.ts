import { describe, expect, it } from 'vitest';

import { readSseFrames, SseParser, SseStallError, type SseFrame } from '../facultyChatSse';

const encoder = new TextEncoder();

/** A body that delivers these byte chunks one per read, then closes, hangs open, or errors. */
const bodyOf = (chunks: (string | Uint8Array)[], end: 'close' | 'hang' | 'error' = 'close') => {
  const queue = chunks.map((chunk) => (typeof chunk === 'string' ? encoder.encode(chunk) : chunk));
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

const collect = async (body: ReadableStream<Uint8Array>, options = {}) => {
  const frames: SseFrame[] = [];
  for await (const frame of readSseFrames(body, options)) frames.push(frame);
  return frames;
};

const parseAll = (chunks: string[]) => {
  const parser = new SseParser();
  const frames = chunks.flatMap((chunk) => parser.push(chunk));
  return [...frames, ...parser.end()];
};

const AGENT_STREAM =
  ': stream open\n\n' +
  'id: 0\nevent: turn.started\ndata: {"type":"turn.started","seq":0,"operationId":"op","at":"t","threadId":"th"}\n\n' +
  'id: 1\nevent: text.delta\ndata: {"type":"text.delta","seq":1,"operationId":"op","at":"t","messageId":"m","text":"Hé 🙂"}\n\n' +
  'id: 2\nevent: stream.heartbeat\ndata: {"type":"stream.heartbeat","seq":2,"operationId":"op","at":"t"}\n\n';

describe('SseParser', () => {
  it('reads id, event and data, and defaults the event name to message', () => {
    expect(parseAll(['id: 7\nevent: text.delta\ndata: {"a":1}\n\n', 'data: plain\n\n'])).toEqual([
      { id: '7', event: 'text.delta', data: '{"a":1}' },
      { id: null, event: 'message', data: 'plain' },
    ]);
  });

  it('joins multi-line data with newlines and strips exactly one leading space', () => {
    expect(parseAll(['data: first\ndata:second\ndata:  indented\n\n'])).toEqual([
      { id: null, event: 'message', data: 'first\nsecond\n indented' },
    ]);
  });

  it('ignores comment lines (the stream-open comment) and counts them', () => {
    const parser = new SseParser();
    expect(parser.push(': stream open\n\n: keepalive\n\n')).toEqual([]);
    expect(parser.comments).toBe(2);
  });

  it('dispatches nothing for a block with no data (an id-only block)', () => {
    expect(parseAll(['id: 3\n\n', 'event: x\n\n'])).toEqual([]);
  });

  it('accepts CRLF and bare CR line endings', () => {
    expect(parseAll(['id: 1\r\ndata: a\r\n\r\n', 'id: 2\rdata: b\r\r'])).toEqual([
      { id: '1', event: 'message', data: 'a' },
      { id: '2', event: 'message', data: 'b' },
    ]);
  });

  it('does not dispatch early when a CRLF is split across chunks', () => {
    const parser = new SseParser();
    expect(parser.push('data: a\r')).toEqual([]);
    // The LF completes the CRLF; it is not a blank line.
    expect(parser.push('\ndata: b\r')).toEqual([]);
    expect(parser.push('\n\r\n')).toEqual([{ id: null, event: 'message', data: 'a\nb' }]);
  });

  it('gives the same frames however the text is chunked, down to one character at a time', () => {
    const whole = parseAll([AGENT_STREAM]);
    expect(whole).toHaveLength(3);
    expect(parseAll(AGENT_STREAM.split(''))).toEqual(whole);
    expect(parseAll([AGENT_STREAM.slice(0, 50), AGENT_STREAM.slice(50, 51), AGENT_STREAM.slice(51)])).toEqual(whole);
  });

  it('discards an unterminated block at end of input instead of dispatching half a frame', () => {
    expect(parseAll(['id: 1\ndata: {"complete":true}\n\n', 'id: 2\ndata: {"trunc'])).toEqual([
      { id: '1', event: 'message', data: '{"complete":true}' },
    ]);
  });

  it('still dispatches a block whose final CR arrived as the last character', () => {
    expect(parseAll(['data: a\r', '\r'])).toEqual([{ id: null, event: 'message', data: 'a' }]);
  });
});

describe('readSseFrames', () => {
  it('decodes UTF-8 split across byte chunks', async () => {
    const bytes = encoder.encode(AGENT_STREAM);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 3) chunks.push(bytes.slice(i, i + 3));

    const frames = await collect(bodyOf(chunks));
    expect(frames.map((frame) => frame.id)).toEqual(['0', '1', '2']);
    expect(JSON.parse(frames[1].data).text).toBe('Hé 🙂');
  });

  it('rethrows a body error (a dropped connection) after the frames before it', async () => {
    const frames: SseFrame[] = [];
    await expect(async () => {
      for await (const frame of readSseFrames(bodyOf(['data: one\n\n', 'data: tw'], 'error'))) frames.push(frame);
    }).rejects.toThrow('network error');
    expect(frames.map((frame) => frame.data)).toEqual(['one']);
  });

  it('throws SseStallError when the connection goes silent past the watchdog', async () => {
    await expect(collect(bodyOf(['data: one\n\n'], 'hang'), { stallTimeoutMs: 20 })).rejects.toBeInstanceOf(
      SseStallError,
    );
  });

  it('returns quietly when the signal aborts while waiting for bytes', async () => {
    const abort = new AbortController();
    const frames: SseFrame[] = [];
    const reading = (async () => {
      for await (const frame of readSseFrames(bodyOf(['data: one\n\n'], 'hang'), { signal: abort.signal })) {
        frames.push(frame);
        setTimeout(() => abort.abort(), 5);
      }
    })();
    await expect(reading).resolves.toBeUndefined();
    expect(frames).toHaveLength(1);
  });
});
