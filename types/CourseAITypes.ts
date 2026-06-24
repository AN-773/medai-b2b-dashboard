/**
 * Types for the AI content factory.
 *
 * The factory mirrors the learning objective suggestion workflow for content
 * items: the backend drafts items (MCQ / SAQ / flashcard / lecture) per learning
 * objective, and they only become real course items once a teacher accepts them.
 *
 * See `contracts/course-ai-contract.md`.
 */

import type { PaginatedApiResponse } from './TestsServiceTypes';
import type {
  BatchReviewFailure,
  SuggestionEvidenceChunk,
  SuggestionStatus,
} from './CourseStudioTypes';

export type CourseGenerationKind = 'items';

export type CourseGenerationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Long-running generation job, mirroring `CohortStudyPlanJob`. Clients poll the
 * course's generation-jobs list until `status` is `completed` or `failed`.
 */
export interface CourseGenerationJob {
  /** Full resource ID (absolute URL). */
  id: string;
  /** Short identifier, used for batch action routes. */
  identifier: string;
  courseId: string;
  kind: CourseGenerationKind;
  status: CourseGenerationJobStatus;
  triggerSource?: string;
  queuedCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Item factory
// ---------------------------------------------------------------------------

export type ItemSuggestionType = 'mcq' | 'saq' | 'flashcard' | 'lecture';

/**
 * Per-type draft payload. Field names match the item-creation request
 * (`ItemUpsertRequest` / `Choice` in `types/TestsServiceTypes.tsx`) so accept
 * maps straight onto the existing item-creation path.
 */
export interface ItemSuggestionDraft {
  mcq?: {
    stem: string;
    choices: { content: string; isCorrect: boolean; explanation?: string }[];
  };
  saq?: { question: string; answer: string };
  flashcard?: { front: string; back: string };
  lecture?: { title: string; content: string; summary: string };
}

/** Mirrors `LearningObjectiveSuggestion`, keyed by learning objective. */
export interface ItemSuggestion {
  /** Full resource ID (absolute URL). */
  id: string;
  /** Short suggestion identifier, used for action routes. */
  identifier: string;
  courseId: string;
  learningObjectiveId: string;
  /** Absolute URL of the producing job. */
  jobId?: string;
  type: ItemSuggestionType;
  status: SuggestionStatus;
  draft: ItemSuggestionDraft;
  /** Absolute URL once accepted. */
  acceptedItemId?: string;
  tags?: string[];
  chunks?: SuggestionEvidenceChunk[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AcceptItemSuggestionResponse {
  /** Absolute URL of the created item. */
  itemId: string;
  suggestion: ItemSuggestion;
}

/**
 * Batch accept/reject outcome. Mirrors `ItemSuggestionBatchResponse` (api.yaml);
 * unlike the learning-objective `BatchReviewResult`, accepted suggestions create
 * items, so the ids returned are item ids.
 */
export interface ItemSuggestionBatchResult {
  accepted: number;
  rejected: number;
  failed: number;
  /** Absolute ids of items created by the accepted suggestions. */
  acceptedItemIds?: string[];
  failures?: BatchReviewFailure[];
}

export interface GenerateItemSuggestionsRequest {
  /**
   * Absolute learning objective ids. Optional on the course-scoped route — omit
   * to generate for every learning objective in the course. On the per-objective
   * route the objective comes from the path, so this may be omitted there too.
   */
  learningObjectiveIds?: string[];
  /** Absolute course id. Required on the per-objective generate route. */
  courseId?: string;
  plan?: { type: ItemSuggestionType; count: number }[];
  /** Optional provenance label stored on the resulting job. */
  triggerSource?: string;
}

export interface ListItemSuggestionsParams {
  /** Absolute learning objective id. */
  learningObjectiveId?: string;
  /** Absolute generation job id. */
  jobId?: string;
  status?: SuggestionStatus;
  type?: ItemSuggestionType;
  page?: number;
  limit?: number;
}

/**
 * The full client surface for the AI content factory. Both the live API client
 * (`services/courseAIService.ts`) and the demo mock
 * (`services/courseAIService.mock.ts`) implement this interface, so the mock can
 * be swapped for the real backend by flipping a single flag — every call site
 * (hooks, UI) is unaffected.
 */
export interface CourseAIService {
  getLatestGenerationJob(
    courseIdentifier: string,
    kind: CourseGenerationKind,
  ): Promise<CourseGenerationJob | null>;
  generateItemSuggestions(
    courseIdentifier: string,
    request: GenerateItemSuggestionsRequest,
  ): Promise<CourseGenerationJob>;
  /**
   * Enqueue a generation job scoped to a single learning objective. The request
   * must carry the absolute `courseId`; the job is still polled via the course's
   * generation-jobs list.
   */
  generateItemSuggestionsForObjective(
    learningObjectiveIdentifier: string,
    request: GenerateItemSuggestionsRequest,
  ): Promise<CourseGenerationJob>;
  listItemSuggestions(
    courseIdentifier: string,
    params?: ListItemSuggestionsParams,
  ): Promise<PaginatedApiResponse<ItemSuggestion>>;
  patchItemSuggestion(
    suggestionIdentifier: string,
    draft: Partial<ItemSuggestionDraft>,
  ): Promise<ItemSuggestion>;
  acceptItemSuggestion(
    suggestionIdentifier: string,
  ): Promise<AcceptItemSuggestionResponse>;
  rejectItemSuggestion(suggestionIdentifier: string): Promise<ItemSuggestion>;
  acceptAllForObjective(
    learningObjectiveIdentifier: string,
  ): Promise<ItemSuggestionBatchResult>;
  rejectAllForObjective(
    learningObjectiveIdentifier: string,
  ): Promise<ItemSuggestionBatchResult>;
  acceptAllForJob(jobIdentifier: string): Promise<ItemSuggestionBatchResult>;
  rejectAllForJob(jobIdentifier: string): Promise<ItemSuggestionBatchResult>;
}
