/**
 * Why a faculty chat request failed, in words a page can switch on.
 *
 * Every failure the client raises is a {@link FacultyChatError} with a `kind`.
 * The page picks its copy by `kind` ({@link facultyChatErrorCopy}) and never
 * parses `message`; `code` is agent-v2's own machine code when it sent one
 * (`{ error: { code, message } }`), kept for logs and for finer copy later.
 *
 * | HTTP | kind | What it means for a dean |
 * |---|---|---|
 * | 401 | `unauthorized` | The agent did not accept the session. Not a logout: AGENT_V2 is not session-owning (see `apiClient.ts`). |
 * | 403 | `forbidden` | `faculty_forbidden`: not a tenant admin/owner, the tenant is not on `FACULTY_TENANTS`, or faculty is off. |
 * | 409 | `surface_mismatch` | The thread belongs to another surface (a learner chat), so a faculty turn cannot join it. |
 * | 429 | `daily_cap` | The tenant's daily faculty turn cap (`FACULTY_DAILY_TURN_CAP`, D12). |
 * | 402 | `daily_cap` | A learner prompt limit (`prompt_limit_reached`). Faculty turns should never meet one (D12); if one does, it is still "no more questions today" to the dean. |
 * | 404 | `not_found` | The turn or thread is not this dean's, or does not exist (agent-v2 answers both alike). |
 * | 400, 413, 415, 422 | `invalid_request` | The request was malformed or too long. |
 * | 5xx | `unavailable` | The agent is down or redeploying. Retryable. |
 * | none | `network` | No response: offline, DNS, CORS refusal. Retryable. |
 */

import type { ApiRequestError } from './apiClient';
import { problemOf } from './facultyChatWire';

export type FacultyChatErrorKind =
  /** `VITE_AGENT_V2_API_URL` is not set for this site. */
  | 'not_configured'
  | 'unauthorized'
  | 'forbidden'
  | 'surface_mismatch'
  | 'daily_cap'
  | 'not_found'
  | 'invalid_request'
  | 'unavailable'
  | 'network'
  /** The stream dropped and could not be reopened. The turn may still be running. */
  | 'stream_lost'
  /** The turn itself failed (`turn.failed`); `code` is the stream error's. */
  | 'turn_failed'
  /** The caller aborted. Never shown. */
  | 'aborted'
  | 'unknown';

/** A plain, serialisable copy of an error, for reducer state. */
export interface FacultyChatErrorInfo {
  readonly kind: FacultyChatErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  /** Safe to show, but pages should prefer {@link facultyChatErrorCopy}. */
  readonly message: string;
  /** Whether trying the same thing again could plausibly work. */
  readonly retryable: boolean;
}

export class FacultyChatError extends Error {
  readonly kind: FacultyChatErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly retryable: boolean;
  /** Extra fields from agent-v2's problem body, if any. */
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    kind: FacultyChatErrorKind,
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'FacultyChatError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.retryable = options.retryable ?? RETRYABLE_KINDS.has(kind);
    this.details = options.details ?? {};
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }

  toInfo(): FacultyChatErrorInfo {
    return {
      kind: this.kind,
      status: this.status,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

const RETRYABLE_KINDS: ReadonlySet<FacultyChatErrorKind> = new Set(['unavailable', 'network', 'stream_lost']);

/** The kind an HTTP status maps to. Exported for tests and for pages that hold a bare status. */
export const kindForStatus = (status: number): FacultyChatErrorKind => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'surface_mismatch';
  if (status === 429 || status === 402) return 'daily_cap';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'invalid_request';
  if (status >= 500 && status <= 599) return 'unavailable';
  return 'unknown';
};

/** An HTTP refusal, from its status and (parsed) body. */
export const facultyChatErrorFromResponse = (status: number, body: unknown): FacultyChatError => {
  const problem = problemOf(body);
  const { code: _code, message: _message, ...details } = problem ?? { code: '', message: '' };
  return new FacultyChatError(
    kindForStatus(status),
    problem?.message.trim() || `The agent service answered ${String(status)}.`,
    { status, code: problem?.code || null, details },
  );
};

/** Whether this is the caller's own abort, which is never an error to show. */
export const isAbortError = (error: unknown, signal?: AbortSignal | null): boolean => {
  if (signal?.aborted) return true;
  if (error instanceof FacultyChatError) return error.kind === 'aborted';
  const name = (error as { name?: unknown } | null)?.name;
  const code = (error as { code?: unknown } | null)?.code;
  return name === 'AbortError' || name === 'CanceledError' || code === 'ERR_CANCELED';
};

/**
 * Any thrown value, as a {@link FacultyChatError}.
 *
 * Understands the three things that reach it: our own errors (returned as is),
 * `apiClient`'s `ApiRequestError` (status + body), and `fetch`'s `TypeError`
 * for a request that got no response.
 */
export const toFacultyChatError = (error: unknown, signal?: AbortSignal | null): FacultyChatError => {
  if (error instanceof FacultyChatError) return error;
  if (isAbortError(error, signal)) return new FacultyChatError('aborted', 'The request was cancelled.', { cause: error });

  const status = (error as ApiRequestError | null)?.status;
  if (typeof status === 'number' && status > 0) {
    return facultyChatErrorFromResponse(status, (error as ApiRequestError).data);
  }

  // `fetch` rejects with a TypeError for a request that got no answer at all,
  // and `apiClient` turns axios' no-response case into this sentence.
  const message = error instanceof Error ? error.message : '';
  if (error instanceof TypeError || /no response received|network/i.test(message)) {
    return new FacultyChatError('network', 'Could not reach the agent service.', { cause: error });
  }

  return new FacultyChatError('unknown', message || 'The request failed.', { cause: error });
};

/**
 * Default copy per kind, for wave 2's Ask page. Short, plain, and about what
 * the dean can do next. A page may override any of it.
 */
export const FACULTY_CHAT_ERROR_COPY: Readonly<Record<FacultyChatErrorKind, string>> = {
  not_configured: 'Ask is not available on this site.',
  unauthorized: 'Your session could not be verified. Sign out and sign in again, then retry.',
  forbidden: 'Ask is only available to institution admins and owners, and only for enabled institutions.',
  surface_mismatch: 'That conversation cannot be continued here. Start a new question.',
  daily_cap: 'Your institution has reached today’s limit for questions. Please try again tomorrow.',
  not_found: 'That conversation could not be found.',
  invalid_request: 'That question could not be sent. Shorten it and try again.',
  unavailable: 'The assistant is temporarily unavailable. Please try again in a minute.',
  network: 'Could not connect. Check your connection and try again.',
  stream_lost: 'The connection dropped while the answer was being written. Reconnect to see the rest.',
  turn_failed: 'The assistant could not finish this answer. Please try again.',
  aborted: '',
  unknown: 'Something went wrong. Please try again.',
};

export const facultyChatErrorCopy = (error: Pick<FacultyChatErrorInfo, 'kind'> | null | undefined): string =>
  error ? FACULTY_CHAT_ERROR_COPY[error.kind] : '';
