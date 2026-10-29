import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ev, frame, helloTurn, OP, problemResponse, sseResponse, THREAD } from './facultyChatFakes';

const apiClient = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../apiClient', () => ({
  apiClient,
  getServiceBaseUrl: () => 'https://agent.example',
  readAuthToken: () => 'token-from-storage',
}));

import { createFacultyChatClient, parseStreamFrame, type FacultyStreamItem } from '../facultyChatClient';
import { FacultyChatError } from '../facultyChatErrors';

type FetchCall = { url: string; init: RequestInit };

/** A fetch that answers each call with the next scripted response. */
const scriptedFetch = (responses: (Response | Error | (() => Response | Error))[]) => {
  const calls: FetchCall[] = [];
  const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (next === undefined) throw new Error('unexpected extra fetch');
    const value = typeof next === 'function' ? next() : next;
    if (value instanceof Error) throw value;
    return value;
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
};

const header = (call: FetchCall, name: string): string | undefined =>
  (call.init.headers as Record<string, string> | undefined)?.[name];

const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};

const clientWith = (fetch: typeof globalThis.fetch, extra: Parameters<typeof createFacultyChatClient>[0] = {}) =>
  createFacultyChatClient({
    baseUrl: () => 'https://agent.example/',
    getToken: () => 'dean-token',
    fetch,
    sleep,
    stallTimeoutMs: 0,
    newOperationId: () => OP,
    ...extra,
  });

const drain = async (stream: AsyncGenerator<FacultyStreamItem>) => {
  const items: FacultyStreamItem[] = [];
  for await (const item of stream) items.push(item);
  return items;
};

const eventTypes = (items: FacultyStreamItem[]) =>
  items.flatMap((item) => (item.kind === 'event' ? [item.event.type] : []));

beforeEach(() => {
  sleeps.length = 0;
  apiClient.get.mockReset();
  apiClient.post.mockReset();
});

describe('streamTurn', () => {
  it('reads a turn to its ending over one connection, with the bearer and no cursor', async () => {
    const { fetch, calls } = scriptedFetch([sseResponse(helloTurn().map(frame))]);

    const items = await drain(clientWith(fetch).streamTurn(OP));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://agent.example/v1/turns/${OP}/stream`);
    expect(header(calls[0], 'Authorization')).toBe('Bearer dean-token');
    expect(header(calls[0], 'Accept')).toBe('text/event-stream');
    expect(header(calls[0], 'Last-Event-ID')).toBeUndefined();
    expect(items[0]).toEqual({ kind: 'open', attempt: 0, lastEventId: null });
    expect(eventTypes(items)).toEqual(helloTurn().map((event) => event.type));
    expect(items.some((item) => item.kind === 'reconnecting')).toBe(false);
  });

  it('stops at the terminal event even if the body says more', async () => {
    const { fetch } = scriptedFetch([sseResponse([...helloTurn().map(frame), frame(ev(6, 'stream.heartbeat'))])]);
    const items = await drain(clientWith(fetch).streamTurn(OP));
    expect(eventTypes(items).at(-1)).toBe('turn.completed');
  });

  it('starts from a given Last-Event-ID', async () => {
    const { fetch, calls } = scriptedFetch([sseResponse(helloTurn().slice(3).map(frame))]);
    await drain(clientWith(fetch).streamTurn(OP, { lastEventId: '2' }));
    expect(header(calls[0], 'Last-Event-ID')).toBe('2');
  });

  it('reconnects with Last-Event-ID after a body that ends without an ending, and loses nothing', async () => {
    const turn = helloTurn();
    const { fetch, calls } = scriptedFetch([
      sseResponse(turn.slice(0, 3).map(frame)), // seq 0..2, then the connection closes
      sseResponse(turn.slice(3).map(frame)), // the server replays from seq 3
    ]);

    const items = await drain(clientWith(fetch).streamTurn(OP));

    expect(calls).toHaveLength(2);
    expect(header(calls[1], 'Last-Event-ID')).toBe('2');
    expect(eventTypes(items)).toEqual(turn.map((event) => event.type));
    const reconnect = items.find((item) => item.kind === 'reconnecting');
    expect(reconnect).toMatchObject({ kind: 'reconnecting', attempt: 1, delayMs: 500, lastEventId: '2' });
    expect(reconnect && reconnect.kind === 'reconnecting' && reconnect.cause.kind).toBe('stream_lost');
    expect(items.filter((item) => item.kind === 'open').map((item) => item.kind === 'open' && item.lastEventId)).toEqual([
      null,
      '2',
    ]);
  });

  it('reconnects after a body read error and after network failures on reopen, backing off', async () => {
    const turn = helloTurn();
    const { fetch, calls } = scriptedFetch([
      sseResponse(turn.slice(0, 2).map(frame), 'error'),
      new TypeError('Failed to fetch'),
      problemResponse(503, 'unavailable'),
      sseResponse(turn.slice(2).map(frame)),
    ]);

    const items = await drain(clientWith(fetch).streamTurn(OP));

    expect(calls).toHaveLength(4);
    expect(calls.slice(1).map((call) => header(call, 'Last-Event-ID'))).toEqual(['1', '1', '1']);
    expect(sleeps).toEqual([500, 1_000, 2_000]);
    expect(
      items.flatMap((item) => (item.kind === 'reconnecting' ? [item.cause.kind] : [])),
    ).toEqual(['stream_lost', 'network', 'unavailable']);
    expect(eventTypes(items)).toEqual(turn.map((event) => event.type));
  });

  it('resets the attempt count once a reconnect delivers a frame', async () => {
    const turn = helloTurn();
    const { fetch } = scriptedFetch([
      sseResponse(turn.slice(0, 1).map(frame)),
      sseResponse(turn.slice(1, 2).map(frame)),
      sseResponse(turn.slice(2).map(frame)),
    ]);
    const items = await drain(clientWith(fetch, { reconnectBackoffMs: [10] }).streamTurn(OP));
    // A budget of one attempt is enough because each reconnect made progress.
    expect(items.filter((item) => item.kind === 'reconnecting')).toHaveLength(2);
    expect(eventTypes(items).at(-1)).toBe('turn.completed');
  });

  it('gives up with stream_lost after the backoff budget, keeping the cursor', async () => {
    const { fetch, calls } = scriptedFetch([
      sseResponse(helloTurn().slice(0, 2).map(frame)),
      new TypeError('Failed to fetch'),
      new TypeError('Failed to fetch'),
    ]);

    const seen: FacultyStreamItem[] = [];
    const error = await (async () => {
      try {
        for await (const item of clientWith(fetch, { reconnectBackoffMs: [1, 2] }).streamTurn(OP)) seen.push(item);
      } catch (caught) {
        return caught;
      }
      return null;
    })();

    expect(error).toBeInstanceOf(FacultyChatError);
    expect(error).toMatchObject({ kind: 'stream_lost', retryable: true });
    expect(calls).toHaveLength(3);
    expect(seen.filter((item) => item.kind === 'reconnecting').map((item) => item.kind === 'reconnecting' && item.lastEventId)).toEqual(['1', '1']);
  });

  it('does not retry a refusal: a 404 on open is thrown as not_found', async () => {
    const { fetch, calls } = scriptedFetch([problemResponse(404, 'turn_not_found', 'No such turn.')]);
    await expect(drain(clientWith(fetch).streamTurn(OP))).rejects.toMatchObject({
      kind: 'not_found',
      status: 404,
      code: 'turn_not_found',
      message: 'No such turn.',
    });
    expect(calls).toHaveLength(1);
  });

  it('does not retry a 401 on reconnect either', async () => {
    const { fetch, calls } = scriptedFetch([
      sseResponse(helloTurn().slice(0, 2).map(frame)),
      problemResponse(401, 'unauthorized'),
    ]);
    await expect(drain(clientWith(fetch).streamTurn(OP))).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(calls).toHaveLength(2);
  });

  it('reports a malformed frame, carries on, and moves the cursor past it', async () => {
    const turn = helloTurn();
    const { fetch, calls } = scriptedFetch([
      sseResponse([frame(turn[0]), 'id: 1\nevent: message.started\ndata: {not json\n\n']),
      sseResponse(turn.slice(2).map(frame)),
    ]);

    const items = await drain(clientWith(fetch).streamTurn(OP));

    expect(items.find((item) => item.kind === 'malformed')).toEqual({
      kind: 'malformed',
      id: '1',
      eventName: 'message.started',
      reason: 'invalid_json',
    });
    expect(header(calls[1], 'Last-Event-ID')).toBe('1');
    expect(eventTypes(items).at(-1)).toBe('turn.completed');
  });

  it('passes unknown event types through as events for the reducer to ignore', async () => {
    const { fetch } = scriptedFetch([
      sseResponse([frame(ev(0, 'turn.started', { threadId: THREAD })), frame(ev(1, 'brand.new', { x: 1 })), frame(ev(2, 'turn.completed', { reason: 'completed' }))]),
    ]);
    const items = await drain(clientWith(fetch).streamTurn(OP));
    expect(eventTypes(items)).toEqual(['turn.started', 'brand.new', 'turn.completed']);
  });

  it('treats a silent connection as dropped (watchdog) and reopens it', async () => {
    const turn = helloTurn();
    const { fetch, calls } = scriptedFetch([sseResponse(turn.slice(0, 2).map(frame), 'hang'), sseResponse(turn.slice(2).map(frame))]);
    const items = await drain(clientWith(fetch, { stallTimeoutMs: 20 }).streamTurn(OP));
    expect(calls).toHaveLength(2);
    expect(header(calls[1], 'Last-Event-ID')).toBe('1');
    expect(eventTypes(items).at(-1)).toBe('turn.completed');
  });

  it('ends quietly on abort, without reconnecting or throwing', async () => {
    const abort = new AbortController();
    const { fetch, calls } = scriptedFetch([sseResponse(helloTurn().slice(0, 2).map(frame), 'hang')]);
    const items: FacultyStreamItem[] = [];
    for await (const item of clientWith(fetch).streamTurn(OP, { signal: abort.signal })) {
      items.push(item);
      if (item.kind === 'event' && item.event.seq === 1) abort.abort();
    }
    expect(calls).toHaveLength(1);
    expect(items.some((item) => item.kind === 'reconnecting')).toBe(false);
  });

  it('refuses to stream when no agent is configured', async () => {
    const { fetch } = scriptedFetch([]);
    await expect(drain(clientWith(fetch, { baseUrl: () => '' }).streamTurn(OP))).rejects.toMatchObject({
      kind: 'not_configured',
    });
  });
});

describe('parseStreamFrame', () => {
  it('takes type and seq from the frame fields when the body lacks them', () => {
    const parsed = parseStreamFrame({ id: '4', event: 'stream.heartbeat', data: '{"operationId":"' + OP + '"}' }, OP);
    expect(parsed).toEqual({ ok: true, event: { type: 'stream.heartbeat', seq: 4, operationId: OP, at: '' } });
  });

  it.each([
    [{ id: '1', event: 'x', data: '[1,2]' }, 'not_an_object'],
    [{ id: '1', event: 'message', data: '{}' }, 'missing_type'],
    [{ id: null, event: 'text.delta', data: '{"type":"text.delta"}' }, 'missing_seq'],
    [{ id: '1', event: 'text.delta', data: '{"type":"text.delta","seq":1,"operationId":"other"}' }, 'wrong_operation'],
  ])('refuses %j as %s', (input, reason) => {
    expect(parseStreamFrame(input, OP)).toEqual({ ok: false, reason });
  });
});

describe('JSON routes', () => {
  const client = () => clientWith(scriptedFetch([]).fetch);

  it('createFacultyTurn posts a faculty turn with the page context folded into the message', async () => {
    apiClient.post.mockResolvedValue({ operationId: OP, threadId: THREAD, created: true, stream: '', cancel: '', approvals: '' });

    const created = await client().createFacultyTurn({
      threadId: THREAD,
      text: '  Who needs attention?  ',
      context: { cohortId: 'c_1', cohortName: 'Year 2' },
    });

    expect(created.threadId).toBe(THREAD);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [service, path, body] = apiClient.post.mock.calls[0];
    expect([service, path]).toEqual(['AGENT_V2', '/v1/turns']);
    expect(body).toEqual({
      message: 'Who needs attention?\n\n<dashboard_context>{"cohortId":"c_1","cohortName":"Year 2"}</dashboard_context>',
      surface: 'faculty',
      threadId: THREAD,
      operationId: OP,
    });
  });

  it('createFacultyTurn omits threadId for a new conversation and refuses a blank question', async () => {
    apiClient.post.mockResolvedValue({ operationId: OP, threadId: 'new', created: true, stream: '', cancel: '', approvals: '' });
    await client().createFacultyTurn({ text: 'Hi' });
    expect(apiClient.post.mock.calls[0][2]).toEqual({ message: 'Hi', surface: 'faculty', operationId: OP });

    await expect(client().createFacultyTurn({ text: '   ' })).rejects.toMatchObject({
      kind: 'invalid_request',
      code: 'nothing_asked',
    });
    await expect(client().createFacultyTurn({ text: 'x'.repeat(32_001) })).rejects.toMatchObject({
      code: 'message_too_long',
    });
  });

  it.each([
    [401, 'unauthorized', 'unauthorized'],
    [403, 'faculty_forbidden', 'forbidden'],
    [409, 'thread_surface_mismatch', 'surface_mismatch'],
    [429, 'faculty_daily_cap_reached', 'daily_cap'],
  ])('createFacultyTurn maps a %i (%s) to %s', async (status, code, kind) => {
    apiClient.post.mockRejectedValue(
      Object.assign(new Error('refused'), { status, data: { error: { code, message: 'refused' } } }),
    );
    await expect(client().createFacultyTurn({ text: 'Hi' })).rejects.toMatchObject({ kind, status, code });
  });

  it('createFacultyTurn maps a request with no response to network', async () => {
    apiClient.post.mockRejectedValue(new Error('API Error: No response received'));
    await expect(client().createFacultyTurn({ text: 'Hi' })).rejects.toMatchObject({ kind: 'network', retryable: true });
  });

  it('listFacultyThreads asks for the faculty surface, with paging', async () => {
    apiClient.get.mockResolvedValue({ threads: [], nextCursor: null, watchCursor: 'w' });
    await client().listFacultyThreads({ limit: 20, cursor: 'abc' });
    expect(apiClient.get.mock.calls[0].slice(0, 2)).toEqual(['AGENT_V2', '/v1/threads?surface=faculty&limit=20&cursor=abc']);
    await expect(client().listFacultyThreads({ limit: 500 })).rejects.toMatchObject({ code: 'invalid_limit' });
  });

  it('getThreadMessages and cancelTurn address the right routes', async () => {
    apiClient.get.mockResolvedValue({ threadId: 'a/b', messages: [] });
    apiClient.post.mockResolvedValue({ operationId: OP, cancelled: true, status: 'completed', completionReason: 'cancelled' });

    await client().getThreadMessages('a/b');
    await client().cancelTurn(OP);

    expect(apiClient.get.mock.calls[0][1]).toBe('/v1/threads/a%2Fb/messages');
    expect(apiClient.post.mock.calls[0].slice(0, 3)).toEqual(['AGENT_V2', `/v1/turns/${OP}/cancel`, undefined]);
  });
});
