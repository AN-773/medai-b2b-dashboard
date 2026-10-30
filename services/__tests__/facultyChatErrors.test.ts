import { describe, expect, it } from 'vitest';

import { normalizeContext, splitFoldedContext, threadTitleOf } from '../facultyChatContext';
import {
  FACULTY_CHAT_ERROR_COPY,
  FACULTY_ERROR_CODE_KINDS,
  FacultyChatError,
  facultyChatErrorCopy,
  facultyChatErrorFromResponse,
  isAbortError,
  kindForRefusal,
  kindForStatus,
  toFacultyChatError,
} from '../facultyChatErrors';

const refusal = (code: string, message = 'refused') => ({ error: { code, message } });

describe('error mapping: the agent-v2 code decides', () => {
  it.each([
    [403, 'faculty_forbidden', 'forbidden'],
    [409, 'thread_surface_mismatch', 'surface_mismatch'],
    [409, 'faculty_thread_tenant_mismatch', 'tenant_mismatch'],
    [409, 'thread_tenant_mismatch', 'tenant_mismatch'],
    [429, 'faculty_daily_limit_reached', 'daily_cap'],
    [400, 'faculty_attachments_unavailable', 'invalid_request'],
    [400, 'faculty_voice_unavailable', 'invalid_request'],
    [400, 'invalid_surface', 'not_configured'],
    [402, 'prompt_limit_reached', 'daily_cap'],
    [401, 'prompt_limit_unauthorized', 'unauthorized'],
    [503, 'prompt_limits_unavailable', 'unavailable'],
    [401, 'unauthorized', 'unauthorized'],
    [404, 'turn_not_found', 'not_found'],
    [404, 'thread_not_found', 'not_found'],
  ] as const)('%i %s is %s', (status, code, kind) => {
    expect(facultyChatErrorFromResponse(status, refusal(code)).toInfo()).toMatchObject({ kind, status, code });
  });

  it('a known code wins over a status that would say something else', () => {
    // A tenant mismatch reusing 409 must not read as a surface mismatch, and the
    // reverse; the status is only consulted when the code is unknown.
    expect(facultyChatErrorFromResponse(409, refusal('faculty_thread_tenant_mismatch')).kind).toBe('tenant_mismatch');
    expect(facultyChatErrorFromResponse(400, refusal('faculty_daily_limit_reached')).kind).toBe('daily_cap');
  });

  it('invalid_request copy is neutral, so it fits a refused attachment or voice request as well as a long question', () => {
    for (const code of ['faculty_attachments_unavailable', 'faculty_voice_unavailable', 'message_too_long']) {
      const copy = facultyChatErrorCopy(facultyChatErrorFromResponse(400, refusal(code)));
      expect(copy).toBe(FACULTY_CHAT_ERROR_COPY.invalid_request);
      expect(copy).toMatch(/rephras/i);
      expect(copy).not.toMatch(/^.*Shorten it/);
    }
  });

  it('every mapped code is one the copy table can word', () => {
    for (const kind of Object.values(FACULTY_ERROR_CODE_KINDS)) {
      expect(FACULTY_CHAT_ERROR_COPY[kind].length).toBeGreaterThan(10);
    }
  });
});

describe('error mapping: the status only falls back to a generic kind', () => {
  it('a 429 with no faculty code is rate_limited (retryable), never daily_cap', () => {
    for (const body of [refusal('too_many_requests'), '<html>Too Many Requests</html>', null]) {
      const info = facultyChatErrorFromResponse(429, body).toInfo();
      expect(info).toMatchObject({ kind: 'rate_limited', retryable: true });
    }
  });

  it('a 409 with no known code is not a surface mismatch', () => {
    expect(facultyChatErrorFromResponse(409, refusal('something_else')).kind).toBe('unknown');
    expect(facultyChatErrorFromResponse(409, null).kind).toBe('unknown');
  });

  it("a 403 is forbidden only when agent-v2 said so; an edge block page is unavailable", () => {
    expect(facultyChatErrorFromResponse(403, refusal('some_other_gate')).kind).toBe('forbidden');
    expect(facultyChatErrorFromResponse(403, '<html>Request blocked</html>').toInfo()).toMatchObject({
      kind: 'unavailable',
      code: null,
      retryable: true,
    });
  });

  it('a 402 with no known code is unknown, not a cap', () => {
    expect(facultyChatErrorFromResponse(402, null).kind).toBe('unknown');
  });

  it.each([
    [401, true, 'unauthorized'],
    [403, true, 'forbidden'],
    [403, false, 'unavailable'],
    [404, true, 'not_found'],
    [400, true, 'invalid_request'],
    [413, true, 'invalid_request'],
    [429, true, 'rate_limited'],
    [429, false, 'rate_limited'],
    [409, true, 'unknown'],
    [402, true, 'unknown'],
    [500, true, 'unavailable'],
    [503, false, 'unavailable'],
    [418, true, 'unknown'],
  ] as const)('status %i (agent body: %s) is %s', (status, fromAgent, kind) => {
    expect(kindForStatus(status, fromAgent)).toBe(kind);
  });

  it('kindForRefusal: code first, then status', () => {
    expect(kindForRefusal(429, 'faculty_daily_limit_reached')).toBe('daily_cap');
    expect(kindForRefusal(429, null)).toBe('rate_limited');
    expect(kindForRefusal(403, null)).toBe('unavailable');
    expect(kindForRefusal(403, 'unlisted_code')).toBe('forbidden');
    expect(kindForRefusal(409, 'toString')).toBe('unknown'); // not an inherited key
  });
});

describe('error mapping: other inputs', () => {

  it("reads agent-v2's { error: { code, message, ... } } envelope, keeping extra fields as details", () => {
    const error = facultyChatErrorFromResponse(403, {
      error: { code: 'faculty_forbidden', message: 'Faculty access needs a tenant admin or owner.', tenant: 't1' },
    });
    expect(error).toBeInstanceOf(FacultyChatError);
    expect(error.toInfo()).toEqual({
      kind: 'forbidden',
      status: 403,
      code: 'faculty_forbidden',
      message: 'Faculty access needs a tenant admin or owner.',
      retryable: false,
    });
    expect(error.details).toEqual({ tenant: 't1' });
  });

  it('falls back to a status sentence when the body is not the envelope', () => {
    expect(facultyChatErrorFromResponse(502, '<html>bad gateway</html>').toInfo()).toMatchObject({
      kind: 'unavailable',
      code: null,
      message: 'The agent service answered 502.',
      retryable: true,
    });
  });

  it("maps apiClient's ApiRequestError by status and body", () => {
    const apiError = Object.assign(new Error('API Error: 409 Conflict'), {
      status: 409,
      data: { error: { code: 'thread_surface_mismatch', message: 'This thread is not a faculty thread.' } },
    });
    expect(toFacultyChatError(apiError).toInfo()).toMatchObject({
      kind: 'surface_mismatch',
      status: 409,
      code: 'thread_surface_mismatch',
    });
  });

  it('maps no-response failures to network, and aborts to aborted', () => {
    expect(toFacultyChatError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(toFacultyChatError(new Error('API Error: No response received')).kind).toBe('network');
    expect(toFacultyChatError(new DOMException('The operation was aborted.', 'AbortError')).kind).toBe('aborted');
    expect(toFacultyChatError(Object.assign(new Error('canceled'), { name: 'CanceledError' })).kind).toBe('aborted');
    expect(toFacultyChatError(new Error('weird')).toInfo()).toMatchObject({ kind: 'unknown', message: 'weird' });

    const abort = new AbortController();
    abort.abort();
    expect(isAbortError(new Error('anything'), abort.signal)).toBe(true);
  });

  it('passes its own errors through unchanged', () => {
    const own = new FacultyChatError('daily_cap', 'cap', { status: 429 });
    expect(toFacultyChatError(own)).toBe(own);
  });

  it('has copy for every kind, and none for an abort', () => {
    for (const [kind, copy] of Object.entries(FACULTY_CHAT_ERROR_COPY)) {
      if (kind === 'aborted') expect(copy).toBe('');
      else expect(copy.length).toBeGreaterThan(10);
    }
    expect(facultyChatErrorCopy({ kind: 'daily_cap' })).toMatch(/limit/);
    expect(facultyChatErrorCopy(null)).toBe('');
  });
});

describe('page context', () => {
  it('splits an older trailer back off a stored question, exactly', () => {
    const stored = 'Who is at risk?\n\n<dashboard_context>{"cohortId":"c_1","page":"cohort"}</dashboard_context>';
    expect(splitFoldedContext(stored)).toEqual({ text: 'Who is at risk?', context: { cohortId: 'c_1', page: 'cohort' } });
  });

  it('drops keys it does not know, so a display name in an older trailer is never read', () => {
    const older = 'Q\n\n<dashboard_context>{"cohortId":"c_1","cohortName":"Year 2"}</dashboard_context>';
    expect(splitFoldedContext(older)).toEqual({ text: 'Q', context: { cohortId: 'c_1' } });
    expect(normalizeContext({ cohortId: 'c_1', cohortName: 'Year 2' } as { cohortId: string })).toEqual({ cohortId: 'c_1' });
  });

  it('has no context when nothing in it is usable', () => {
    expect(normalizeContext(null)).toBeNull();
    expect(normalizeContext({ cohortId: '  ', page: 7 as unknown as string })).toBeNull();
    expect(normalizeContext({})).toBeNull();
  });

  it('reads an older trailer whose value held the closing tag, escaped', () => {
    const stored = 'Q\n\n<dashboard_context>{"page":"x\\u003c/dashboard_context>y"}</dashboard_context>';
    expect(splitFoldedContext(stored).context).toEqual({ page: 'x</dashboard_context>y' });
  });

  it('cleans a thread title of a trailer, whole or cut short', () => {
    expect(threadTitleOf('Who needs attention?')).toBe('Who needs attention?');
    expect(threadTitleOf('Who needs attention?\n\n<dashboard_context>{"coh')).toBe('Who needs attention?');
    expect(threadTitleOf(null)).toBe('');
  });

  it('does not cut a message that merely mentions the tag', () => {
    const typed = 'What does <dashboard_context>{nope}</dashboard_context> mean?';
    expect(splitFoldedContext(typed)).toEqual({ text: typed, context: null });
    const broken = 'Q\n\n<dashboard_context>{not json</dashboard_context>';
    expect(splitFoldedContext(broken)).toEqual({ text: broken, context: null });
  });

  it('drops a value over 200 characters, because a cut id is a wrong id', () => {
    expect(normalizeContext({ cohortId: 'n'.repeat(201) })).toBeNull();
    expect(normalizeContext({ cohortId: 'n'.repeat(201), page: 'cohort' })).toEqual({ page: 'cohort' });
    expect(normalizeContext({ cohortId: 'n'.repeat(200) })?.cohortId).toHaveLength(200);
  });
});
