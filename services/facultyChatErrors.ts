/**
 * Why a faculty chat request failed, in words a page can switch on.
 *
 * Every failure the client raises is a {@link FacultyChatError} with a `kind`.
 * The page picks its copy by `kind` ({@link facultyChatErrorCopy}) and never
 * parses `message`; `code` is agent-v2's own machine code when it sent one
 * (`{ error: { code, message } }`).
 *
 * ## The code decides, the status only falls back
 *
 * A status alone cannot say who refused. A 429 may be the tenant's daily cap or
 * a WAF/CloudFront rate limit in front of the agent; a 403 may be the faculty
 * gate or an edge block page. So a **known agent-v2 code** picks the specific
 * kind ({@link FACULTY_ERROR_CODE_KINDS}), and the **status** only picks a
 * generic one ({@link kindForStatus}): an unknown 429 is `rate_limited`, never
 * `daily_cap`, and an unknown 409 is never `surface_mismatch`.
 *
 * | agent-v2 code | HTTP | kind |
 * |---|---|---|
 * | `faculty_forbidden` | 403 | `forbidden`: not a tenant admin/owner, tenant not on `FACULTY_TENANTS`, or faculty is off |
 * | `thread_surface_mismatch` | 409 | `surface_mismatch`: the thread is a learner chat |
 * | `faculty_thread_tenant_mismatch`, `thread_tenant_mismatch` | 409 (expected) | `tenant_mismatch`: the thread belongs to another tenant |
 * | `faculty_daily_limit_reached` | 429 | `daily_cap`: the tenant's `FACULTY_DAILY_TURN_CAP` (D12) |
 * | `prompt_limit_reached` | 402 | `daily_cap`: a learner limit; faculty turns should never meet one (D12) |
 * | `faculty_attachments_unavailable`, `faculty_voice_unavailable` | 400 | `invalid_request` |
 * | `invalid_faculty_context`, `invalid_faculty_feedback` | 400 | `invalid_request` |
 * | `invalid_surface` | 400 | `not_configured`: this agent has no faculty surface yet (before FAG-1) |
 *
 * | Status, no known code | kind |
 * |---|---|
 * | 401 | `unauthorized` (not a logout: AGENT_V2 is not session-owning, see `apiClient.ts`) |
 * | 403 | `forbidden` with an agent-v2 body; `unavailable` without one (an edge block page) |
 * | 404 | `not_found` (not this dean's, or does not exist: agent-v2 answers both alike) |
 * | 400, 413, 415, 422 | `invalid_request` |
 * | 429 | `rate_limited` (retryable) |
 * | 5xx | `unavailable` (retryable) |
 * | 402, 409, anything else | `unknown` |
 * | no response | `network` (offline, DNS, CORS refusal; retryable) |
 */

import type { ApiRequestError } from './apiClient';
import { problemOf } from './facultyChatWire';

export type FacultyChatErrorKind =
  /** `VITE_AGENT_V2_API_URL` is not set for this site. */
  | 'not_configured'
  | 'unauthorized'
  | 'forbidden'
  /** The thread is not a faculty thread (a learner chat). */
  | 'surface_mismatch'
  /** The thread belongs to another tenant than the dean's token. */
  | 'tenant_mismatch'
  /** The tenant's daily faculty question cap. */
  | 'daily_cap'
  /** A 429 nobody named: an edge or gateway rate limit. Retryable after a wait. */
  | 'rate_limited'
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

const RETRYABLE_KINDS: ReadonlySet<FacultyChatErrorKind> = new Set([
  'unavailable',
  'network',
  'stream_lost',
  'rate_limited',
]);

/**
 * agent-v2 refusal codes with a specific meaning for the dean, by code.
 * Checked before the status. Codes FAG-1's fix round may add are listed under
 * both likely spellings; a code not here falls back to {@link kindForStatus}.
 */
export const FACULTY_ERROR_CODE_KINDS: Readonly<Record<string, FacultyChatErrorKind>> = {
  // FAG-1, the faculty gate and budget
  faculty_forbidden: 'forbidden',
  thread_surface_mismatch: 'surface_mismatch',
  faculty_thread_tenant_mismatch: 'tenant_mismatch',
  thread_tenant_mismatch: 'tenant_mismatch',
  faculty_daily_limit_reached: 'daily_cap',
  faculty_attachments_unavailable: 'invalid_request',
  faculty_voice_unavailable: 'invalid_request',
  // FAG-5, a body the API would not read.
  invalid_faculty_context: 'invalid_request',
  invalid_faculty_feedback: 'invalid_request',
  // An agent that does not know the faculty surface yet (`parseSurface`).
  invalid_surface: 'not_configured',
  // Learner prompt limits (`apps/api/src/prompt-limits.ts`); faculty turns should never meet them (D12).
  prompt_limit_reached: 'daily_cap',
  prompt_limit_unauthorized: 'unauthorized',
  prompt_limits_unavailable: 'unavailable',
  // The generic ones.
  unauthorized: 'unauthorized',
  turn_not_found: 'not_found',
  thread_not_found: 'not_found',
  message_too_long: 'invalid_request',
};

/**
 * The generic kind for a status whose code is unknown or absent. Never a
 * faculty-specific kind: only a code can say "daily cap" or "surface mismatch".
 *
 * `fromAgent`: whether the body was agent-v2's `{ error: { code } }` envelope.
 * A 403 without one is an edge block page, not the faculty gate.
 */
export const kindForStatus = (status: number, fromAgent = true): FacultyChatErrorKind => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return fromAgent ? 'forbidden' : 'unavailable';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'invalid_request';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status <= 599) return 'unavailable';
  return 'unknown';
};

/** The kind for a refusal: its agent-v2 code if known, else its status. */
export const kindForRefusal = (status: number, code: string | null, fromAgent = code !== null): FacultyChatErrorKind =>
  (code !== null && Object.hasOwn(FACULTY_ERROR_CODE_KINDS, code) ? FACULTY_ERROR_CODE_KINDS[code] : undefined) ??
  kindForStatus(status, fromAgent);

/** An HTTP refusal, from its status and (parsed) body. */
export const facultyChatErrorFromResponse = (status: number, body: unknown): FacultyChatError => {
  const problem = problemOf(body);
  const { code: _code, message: _message, ...details } = problem ?? { code: '', message: '' };
  const code = problem?.code.trim() || null;
  return new FacultyChatError(
    kindForRefusal(status, code, problem !== null),
    problem?.message.trim() || `The agent service answered ${String(status)}.`,
    { status, code, details },
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
  tenant_mismatch: 'That conversation belongs to a different institution. Start a new question.',
  daily_cap: 'Your institution has reached today’s limit for questions. Please try again tomorrow.',
  rate_limited: 'Too many requests at the moment. Please wait a little and try again.',
  not_found: 'That conversation could not be found.',
  // Neutral: this kind covers a question that is too long and requests the
  // faculty surface refuses (attachments, voice), not only length.
  invalid_request: 'That question can’t be sent as it is. Try rephrasing it, or making it shorter.',
  unavailable: 'The assistant is temporarily unavailable. Please try again in a minute.',
  network: 'Could not connect. Check your connection and try again.',
  stream_lost: 'The connection dropped while the answer was being written. Reconnect to see the rest.',
  turn_failed: 'The assistant could not finish this answer. Please try again.',
  aborted: '',
  unknown: 'Something went wrong. Please try again.',
};

export const facultyChatErrorCopy = (error: Pick<FacultyChatErrorInfo, 'kind'> | null | undefined): string =>
  error ? FACULTY_CHAT_ERROR_COPY[error.kind] : '';
