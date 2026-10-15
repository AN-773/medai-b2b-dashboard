import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type {
  ModuleGenerationConflictResponse,
  ModulePlanConflictResponse,
  ModulePlanValidationErrorResponse,
} from '@/types/ModuleGenerationTypes';

/**
 * A `400` or `409` from a module generation route, with the response body kept.
 *
 * `apiClient` turns error responses into a plain `Error` and drops the body,
 * but these routes put what the UI needs in it: the open job on a generate
 * `409`, `staleIds` / `reason` on a plan or accept `409`, and `issues` on a
 * `400`. See `contracts/course-ai-contract.md` ("Module generation").
 */
export class ModuleGenerationRequestError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const record = (body ?? {}) as { error?: unknown; message?: unknown };
    const text =
      (typeof record.message === 'string' && record.message.trim()) ||
      (typeof record.error === 'string' && record.error.trim()) ||
      `Request failed with status ${status}`;
    super(text);
    this.name = 'ModuleGenerationRequestError';
    this.status = status;
    this.body = body;
  }
}

const asRequestError = (error: unknown) =>
  error instanceof ModuleGenerationRequestError ? error : null;

/** The open job from a `409` on `POST .../module-plans/generate`, if any. */
export const openJobFromConflict = (error: unknown): CourseGenerationJob | null => {
  const requestError = asRequestError(error);
  if (requestError?.status !== 409) return null;
  const body = requestError.body as Partial<ModuleGenerationConflictResponse> | null;
  return body?.job && typeof body.job === 'object' ? body.job : null;
};

/** The body of a `409` from `PUT plan` / `accept`, if any. */
export const planConflictFrom = (error: unknown): ModulePlanConflictResponse | null => {
  const requestError = asRequestError(error);
  if (requestError?.status !== 409) return null;
  const body = requestError.body as Partial<ModulePlanConflictResponse> | null;
  return body && typeof body.reason === 'string'
    ? (body as ModulePlanConflictResponse)
    : { error: requestError.message, reason: 'not_awaiting_review' };
};

/** The body of a `400` from `PUT plan` / `accept`, if any. */
export const planValidationErrorFrom = (
  error: unknown,
): ModulePlanValidationErrorResponse | null => {
  const requestError = asRequestError(error);
  if (requestError?.status !== 400) return null;
  const body = requestError.body as Partial<ModulePlanValidationErrorResponse> | null;
  return {
    error: body?.error || requestError.message,
    issues: Array.isArray(body?.issues) ? body.issues : [],
    staleIds: Array.isArray(body?.staleIds) ? body.staleIds : undefined,
  };
};

export const moduleGenerationErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
