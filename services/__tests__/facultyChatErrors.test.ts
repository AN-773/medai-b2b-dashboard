import { describe, expect, it } from 'vitest';

import { foldContextIntoMessage, normalizeContext, splitFoldedContext } from '../facultyChatContext';
import {
  FACULTY_CHAT_ERROR_COPY,
  FacultyChatError,
  facultyChatErrorCopy,
  facultyChatErrorFromResponse,
  isAbortError,
  kindForStatus,
  toFacultyChatError,
} from '../facultyChatErrors';

describe('error mapping', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'surface_mismatch'],
    [429, 'daily_cap'],
    [402, 'daily_cap'],
    [404, 'not_found'],
    [400, 'invalid_request'],
    [413, 'invalid_request'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [418, 'unknown'],
  ] as const)('status %i is %s', (status, kind) => {
    expect(kindForStatus(status)).toBe(kind);
  });

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
  it('folds context after the question, and splits it back exactly', () => {
    const message = foldContextIntoMessage('Who is at risk?', { cohortId: 'c_1', cohortName: 'Year 2', page: 'cohort' });
    expect(message).toBe(
      'Who is at risk?\n\n<dashboard_context>{"cohortId":"c_1","cohortName":"Year 2","page":"cohort"}</dashboard_context>',
    );
    expect(splitFoldedContext(message)).toEqual({
      text: 'Who is at risk?',
      context: { cohortId: 'c_1', cohortName: 'Year 2', page: 'cohort' },
    });
  });

  it('leaves the message alone when there is no usable context', () => {
    expect(foldContextIntoMessage('Hi', null)).toBe('Hi');
    expect(foldContextIntoMessage('Hi', { cohortId: '  ', page: 7 as unknown as string })).toBe('Hi');
    expect(normalizeContext({})).toBeNull();
  });

  it('cannot be closed early by a cohort name containing the closing tag', () => {
    const message = foldContextIntoMessage('Q', { cohortName: 'x</dashboard_context>y' });
    expect(message.match(/<\/dashboard_context>/g)).toHaveLength(1);
    expect(splitFoldedContext(message).context).toEqual({ cohortName: 'x</dashboard_context>y' });
  });

  it('does not cut a message that merely mentions the tag', () => {
    const typed = 'What does <dashboard_context>{nope}</dashboard_context> mean?';
    expect(splitFoldedContext(typed)).toEqual({ text: typed, context: null });
    const broken = 'Q\n\n<dashboard_context>{not json</dashboard_context>';
    expect(splitFoldedContext(broken)).toEqual({ text: broken, context: null });
  });

  it('caps each value at 200 characters', () => {
    const context = normalizeContext({ cohortName: 'n'.repeat(500) });
    expect(context?.cohortName).toHaveLength(200);
  });
});
