import type { CourseResource, CourseResourceKnowledgeBase, CourseResourceKnowledgeProcessingResponse } from '../types/CourseResourceTypes';
import { readCourseResourceKnowledgeBase } from '../types/CourseResourceTypes';
import { resourceIdentifier } from './resourceId';
import type { DocumentProcessing } from '../types/DocumentProcessing';

/** Runtime view accepts future enum values without weakening the shared DTO. */
export type ProcessingSnapshot = Omit<DocumentProcessing,
  'state' | 'stage' | 'availability' | 'completedUnits'> & {
  state: string;
  stage: string;
  availability: string;
  completedUnits: number | null;
};

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const text = (value: unknown): string | null => typeof value === 'string' ? value : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

export const readProcessing = (value: unknown): ProcessingSnapshot | null => {
  const raw = object(value);
  if (!raw || !text(raw.runId) || count(raw.sequence) === null) return null;
  const capabilities = object(raw.capabilities);
  const error = object(raw.error);
  return {
    ...raw,
    runId: raw.runId as string,
    sequence: raw.sequence as number,
    availability: text(raw.availability) ?? 'unknown',
    state: text(raw.state) ?? 'unknown',
    stage: text(raw.stage) ?? 'unknown',
    completedUnits: count(raw.completedUnits),
    totalUnits: count(raw.totalUnits),
    unit: raw.unit === 'pages' || raw.unit === 'batches' || raw.unit === 'figures' ? raw.unit : null,
    updatedAt: text(raw.updatedAt) ?? '',
    lastProgressAt: text(raw.lastProgressAt),
    heartbeatAt: text(raw.heartbeatAt),
    nextRetryAt: text(raw.nextRetryAt),
    capabilities: {
      ...capabilities,
      text: capabilities?.text === true,
      structure: capabilities?.structure === true,
      images: capabilities?.images === true,
      ocr: capabilities?.ocr === true,
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((v): v is string => typeof v === 'string') : [],
    error: error && text(error.message) ? {
      ...error, code: text(error.code) ?? '', message: error.message as string,
      retryable: error.retryable === true,
    } : null,
  };
};

const TERMINAL = ['completed', 'completed_with_warnings', 'failed', 'cancelled'];
export const isProcessingTerminal = (processing: ProcessingSnapshot | null): boolean =>
  !!processing && TERMINAL.includes(processing.state);

export const isTextReady = (kb: CourseResourceKnowledgeBase | null | undefined): boolean => {
  if (kb?.processing != null) return readProcessing(kb.processing)?.availability === 'text_ready';
  return kb?.status === 'ready';
};

export const shouldPollResource = (resource: CourseResource): boolean => {
  const kb = resource.knowledgeBase;
  // Unknown or malformed progress must never be mistaken for completion.
  if (kb?.processing != null) return !isProcessingTerminal(readProcessing(kb.processing));
  return kb?.status === 'processing' || kb?.status === 'not_synced';
};

export const needsCourseSync = (resource: CourseResource): boolean => {
  const kb = resource.knowledgeBase;
  if (kb?.processing == null) return kb?.status === 'not_synced' || kb?.status === 'failed';
  const p = readProcessing(kb.processing);
  // Tests Sync only queues retryable failures/warnings. A teacher cancellation
  // needs an explicit per-resource retry; do not wait for Sync to undo it.
  return !!p && ['failed', 'completed_with_warnings'].includes(p.state) && p.error?.retryable === true;
};

export const canRetryProcessing = (p: ProcessingSnapshot | null): boolean =>
  !!p && (p.state === 'cancelled' ||
    ((p.state === 'failed' || p.state === 'completed_with_warnings') && p.error?.retryable === true));
export const canCancelProcessing = (p: ProcessingSnapshot | null): boolean =>
  !!p && ['queued', 'running', 'retrying'].includes(p.state);

const STAGES: Record<string, string> = {
  queued: 'Waiting to start', extracting_text: 'Extracting full text',
  indexing_text: 'Indexing full text', ocr: 'Reading scanned pages (OCR)',
  extracting_structure: 'Extracting structure', extracting_images: 'Extracting images',
  indexing_enrichment: 'Indexing structure and images', completed: 'Finalizing processing',
};
export const processingStageLabel = (p: ProcessingSnapshot): string =>
  STAGES[p.stage] ?? 'Processing stage unavailable';

export const processingUnitsLabel = (p: ProcessingSnapshot): string | null => {
  if (!p.unit || p.completedUnits === null) return null;
  if (p.totalUnits !== null && p.totalUnits >= p.completedUnits) {
    return `${p.completedUnits} of ${p.totalUnits} ${p.unit} in this stage`;
  }
  return `${p.completedUnits} ${p.unit} processed in this stage · total unknown`;
};

/** A quiet worker is not proof of failure, even when the list connection works. */
export const hasStaleHeartbeat = (p: ProcessingSnapshot, now: number): boolean => {
  const at = Date.parse(p.heartbeatAt || p.updatedAt);
  return !isProcessingTerminal(p) && Number.isFinite(at) && now - at > 120_000;
};

export const resourceFromProcessingResponse = (
  resource: CourseResource, response: CourseResourceKnowledgeProcessingResponse, courseIdentifier: string,
): CourseResource | null => {
  if (!response || typeof response.courseId !== 'string' || typeof response.resourceId !== 'string' ||
    resourceIdentifier(response.courseId) !== resourceIdentifier(courseIdentifier) ||
    resourceIdentifier(response.resourceId) !== resourceIdentifier(resource.identifier || resource.id)) return null;
  const kb = readCourseResourceKnowledgeBase(response);
  return kb ? { ...resource, knowledgeBase: kb } : null;
};

/** Kept per course (also across pagination), never persisted to browser storage. */
export class ResourceProgressTracker {
  private entries = new Map<string, { resource: CourseResource; retired: Set<string> }>();
  private expected = new Map<string, string>();

  private version(resource: CourseResource): string {
    const p = readProcessing(resource.knowledgeBase?.processing);
    return p ? `${p.runId}:${p.sequence}` : `${resource.knowledgeBase?.status}:${resource.knowledgeBase?.updatedAt}`;
  }

  expectUpdate = (resource: CourseResource): void => {
    this.expected.set(resource.identifier || resource.id, this.version(resource));
  };

  hasExpectedUpdates(resources: CourseResource[]): boolean {
    return resources.some((resource) => this.expected.has(resource.identifier || resource.id));
  }

  merge(resources: CourseResource[]): CourseResource[] {
    return resources.map((incoming) => {
      const key = incoming.identifier || incoming.id;
      const entry = this.entries.get(key);
      const previous = entry?.resource;
      const old = readProcessing(previous?.knowledgeBase?.processing);
      const next = readProcessing(incoming.knowledgeBase?.processing);
      const retired = entry?.retired ?? new Set<string>();
      let resource = incoming;
      if (old && (!next || (old.runId === next.runId && next.sequence <= old.sequence) ||
        retired.has(next.runId) || (old.runId !== next.runId &&
          Date.parse(next.updatedAt) < Date.parse(old.updatedAt)))) {
        // Preserve the matching legacy projection as well as processing; a stale
        // response cannot turn usable text back into a failed/processing row.
        resource = { ...incoming, knowledgeBase: previous!.knowledgeBase };
      } else if (old && next && old.runId !== next.runId) {
        retired.add(old.runId);
      }
      this.entries.set(key, { resource, retired });
      if (this.expected.has(key) && this.expected.get(key) !== this.version(resource)) this.expected.delete(key);
      return resource;
    });
  }
}
