import type { DocumentProcessing } from './DocumentProcessing';

/**
 * Where a course resource stands with the learner's tutor, as the Tests service
 * projects it (contracts/course-resources-contract.md, Contract T1).
 *
 * The Tests service keeps a richer internal state machine; this is the
 * projection it promises not to widen without a contract change.
 */
export type CourseResourceKnowledgeBaseStatus =
  | 'not_synced'
  | 'ineligible'
  | 'processing'
  | 'ready'
  | 'failed';

/** Why a resource is `ineligible`: outside the agent's formats, or over 150 MiB. */
export type CourseResourceKnowledgeBaseReason = 'format' | 'size';

export interface CourseResourceKnowledgeBase {
  status: CourseResourceKnowledgeBaseStatus;
  /** Set only for `ineligible`. */
  reason: CourseResourceKnowledgeBaseReason | null;
  /** Set only for `failed`: agent-v2's error code, or `agent_unreachable`. */
  errorCode: string | null;
  /** ISO 8601; `null` for `not_synced`. */
  updatedAt: string | null;
  /** Absent on legacy documents. Text can be ready while enrichment continues. */
  processing?: DocumentProcessing;
  [key: string]: unknown;
}

export interface CourseResource {
  id: string;
  identifier: string;
  courseId: string | null;
  fileId: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  /**
   * Absent when the Tests service has no tutor agent configured — the feature is
   * off, and nothing about the tutor should render. Present with `not_synced`
   * when it is on but this resource has not been sent yet.
   */
  knowledgeBase?: CourseResourceKnowledgeBase;
}

const KNOWLEDGE_BASE_STATUSES: readonly CourseResourceKnowledgeBaseStatus[] = [
  'not_synced',
  'ineligible',
  'processing',
  'ready',
  'failed',
];

/**
 * The tutor state of a resource, read defensively off the wire.
 *
 * Returns `null` when the resource carries no `knowledgeBase` **or** carries one
 * whose status this build does not recognise — a newer Tests release adding a
 * state must render as no chip, never crash the panel or mislabel the file.
 * `reason` and `errorCode` are kept only when they are strings.
 */
export const readCourseResourceKnowledgeBase = (
  resource: Pick<CourseResource, 'knowledgeBase'>,
): CourseResourceKnowledgeBase | null => {
  const raw: unknown = resource.knowledgeBase;
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const status = record['status'];
  if (
    typeof status !== 'string' ||
    !(KNOWLEDGE_BASE_STATUSES as readonly string[]).includes(status)
  ) {
    return null;
  }
  const reason = record['reason'];
  const errorCode = record['errorCode'];
  const updatedAt = record['updatedAt'];
  return {
    ...record,
    status: status as CourseResourceKnowledgeBaseStatus,
    reason: reason === 'format' || reason === 'size' ? reason : null,
    errorCode: typeof errorCode === 'string' && errorCode !== '' ? errorCode : null,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
  };
};

/** `POST /courses/{identifier}/resources/knowledge-base/sync` → 202 (Contract T2). */
export interface CourseResourceKnowledgeBaseSyncResponse {
  courseId: string;
  queuedResources: number;
  queuedLinks: number;
}

/** Tests teacher retry/cancel routes: HTTP 202, latest persisted snapshot. */
export interface CourseResourceKnowledgeProcessingResponse {
  courseId: string;
  resourceId: string;
  knowledgeBase: CourseResourceKnowledgeBase;
}

export interface CourseResourceListResponse {
  resources: CourseResource[];
  total: number;
  page: number;
}

export interface CourseResourceDownloadResponse {
  url: string;
  expiresAt: string;
}

export interface ListCourseResourcesParams {
  page?: number;
  limit?: number;
}

export interface CourseResourceUploadURLRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface CourseResourceUploadURLResponse {
  /** Time-limited URL the browser uploads the bytes to. */
  uploadUrl: string;
  /** Storage path of the upload; hand it back when committing. */
  uploadPath: string;
  expiresAt: string;
}

export interface CommitCourseResourceUploadRequest {
  uploadPath: string;
  fileName: string;
  fileType: string;
}

export interface UploadCourseResourceOptions {
  /** Called with 0-100 as the file streams to storage. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}
