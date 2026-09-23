/**
 * Types for AI module generation ("Create with AI" on the Modules tab).
 *
 * A modules job is a `CourseGenerationJob` with `kind: 'modules'`. It runs in
 * the background, drafts modules and sessions for the course, and leaves a
 * draft plan the teacher reviews, edits (`PUT plan`) and accepts in one
 * transaction.
 *
 * See `contracts/course-ai-contract.md` ("Module generation").
 */

import type { CourseGenerationJob, ItemSuggestion } from './CourseAITypes';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Progress while a modules job is `processing`. */
export type ModuleGenerationStage = 'analyzing' | 'drafting_items' | 'planning';

/** Outcome of a `completed` modules job. `null` until the job completes. */
export type ModuleGenerationReviewState =
  | 'awaiting_review'
  | 'accepted'
  | 'discarded';

/** Item types the agent may create. */
export type ModuleGenerationItemType = 'mcq' | 'saq' | 'flashcard' | 'lecture';

// ---------------------------------------------------------------------------
// Options (wizard)
// ---------------------------------------------------------------------------

/** Wizard options. Stored on the job and echoed back on the job detail. */
export interface ModuleGenerationOptions {
  /** Free-text guidance for the planner (max 4000 chars). */
  instructions?: string;
  /** Desired module count (>= 1). Omit or `null` to let the planner decide. */
  targetModuleCount?: number | null;
  /** Sessions per module bounds (each >= 1). */
  sessionsPerModule?: { min?: number; max?: number } | null;
  /** Absolute course upload ids. Omit to use every completed upload. */
  fileIds?: string[];
  /** Whether the agent may draft new items. Defaults to `true`. */
  allowItemCreation?: boolean;
  /** Item types the agent may create. Omit for all types. */
  itemTypes?: ModuleGenerationItemType[];
  /** Optional provenance label stored on the job. */
  triggerSource?: string;
}

/** Body of `POST /courses/{identifier}/module-plans/generate`. */
export interface GenerateModulePlanRequest {
  moduleGeneration: ModuleGenerationOptions;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

/**
 * Exactly one of `itemId` (an existing item) or `itemSuggestionId` (an item
 * suggestion drafted by this job; it becomes an item on accept). Ids are
 * absolute resource ids.
 */
export type ModulePlanItemRef =
  | { itemId: string; itemSuggestionId?: undefined }
  | { itemSuggestionId: string; itemId?: undefined };

export interface ModulePlanSession {
  /** 1..120 characters. */
  title: string;
  order: number;
  rationale?: string;
  /** At least one. An item may appear in only one session of the plan. */
  items: ModulePlanItemRef[];
  /** Absolute learning objective ids. */
  learningObjectiveIds?: string[];
  /** Absolute course upload ids. */
  sourceFileIds?: string[];
}

export interface ModulePlanModule {
  /** 1..120 characters. */
  title: string;
  order: number;
  rationale?: string;
  /** At least one. */
  sessions: ModulePlanSession[];
}

export interface ModulePlan {
  /** At least one. */
  modules: ModulePlanModule[];
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Job detail and progress feed
// ---------------------------------------------------------------------------

/** `GET /module-generation-jobs/{identifier}`. */
export interface ModuleGenerationJob extends CourseGenerationJob {
  options?: ModuleGenerationOptions;
  /** The draft. `null` until completed, and after `failed` / `cancelled`. */
  plan?: ModulePlan | null;
  /** Draft version for optimistic concurrency. `null` when `plan` is `null`. */
  version?: number | null;
  planUpdatedAt?: string | null;
  /** Highest event seq recorded for the job (0 when none). */
  lastEventSeq?: number;
  /**
   * The job's AI-created items, present once there is a plan. Use them to
   * preview plan refs with `itemSuggestionId` (badge "New"): modules-job
   * suggestions are not returned by the course item-suggestion list.
   */
  itemSuggestions?: ItemSuggestion[];
}

export type ModuleGenerationEventKind =
  | 'tool_call'
  | 'subagent_start'
  | 'subagent_done'
  | 'compaction'
  | 'warning'
  | 'error';

export interface ModuleGenerationEvent {
  /** Dense and increasing per job. */
  seq: number;
  /** `orchestrator`, or a numbered sub-agent such as `file_analyst#2`. */
  agent: string;
  kind: ModuleGenerationEventKind;
  /** Short human-readable label, e.g. "Reading Cardio L3.pdf (section 2/7)". */
  label: string;
  /** Truncated debugging detail. Shape varies by kind; not for UI logic. */
  detail?: Record<string, unknown> | null;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: string;
}

/** `GET /module-generation-jobs/{identifier}/events`. */
export interface ModuleGenerationEventListResponse {
  /** In seq order. */
  items: ModuleGenerationEvent[];
  /** Pass as the next `afterSeq`. */
  lastSeq: number;
}

export interface ListModuleGenerationEventsParams {
  /** Return events with `seq > afterSeq`. Defaults to 0. */
  afterSeq?: number;
  /** Defaults to 100, max 500. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Review: PUT plan, accept, discard
// ---------------------------------------------------------------------------

/** Response of `PUT /module-generation-jobs/{identifier}/plan`. */
export interface ModulePlanDraft {
  jobId: string;
  plan: ModulePlan;
  version: number;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface UpdateModulePlanRequest {
  plan: ModulePlan;
  /** The version the edit was based on. */
  version: number;
}

export interface AcceptModulePlanRequest {
  version: number;
}

export interface ModulePlanAcceptedSession {
  id: string;
  identifier: string;
  title: string;
  displayOrder: number;
  itemIds: string[];
}

export interface ModulePlanAcceptedModule {
  id: string;
  identifier: string;
  title: string;
  displayOrder: number;
  sessions: ModulePlanAcceptedSession[];
}

/** Response of `POST /module-generation-jobs/{identifier}/accept`. */
export interface AcceptModulePlanResponse {
  /** `reviewState: 'accepted'`. */
  job: CourseGenerationJob;
  modules: ModulePlanAcceptedModule[];
  /** Items created from this job's suggestions. */
  createdItemIds: string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ModulePlanIssueCode =
  // The plan itself is malformed.
  | 'empty_plan'
  | 'empty_module'
  | 'empty_session'
  | 'missing_title'
  | 'title_too_long'
  | 'invalid_item_ref'
  | 'duplicate_item'
  | 'empty_id'
  // An id no longer resolves (also listed in staleIds).
  | 'unknown_item'
  | 'unknown_item_suggestion'
  | 'foreign_item_suggestion'
  | 'unknown_learning_objective'
  | 'unknown_source_file';

export interface ModulePlanIssue {
  code: ModulePlanIssueCode;
  /** Location in the plan, e.g. `modules[0].sessions[2].items[1]`. */
  path: string;
  id?: string;
  message: string;
}

/** `400` from `PUT plan` / `accept`. */
export interface ModulePlanValidationErrorResponse {
  error: string;
  issues: ModulePlanIssue[];
  staleIds?: string[];
}

export type ModulePlanConflictReason =
  | 'stale_version'
  | 'stale_ids'
  | 'not_awaiting_review';

/** `409` from `PUT plan` / `accept`. */
export interface ModulePlanConflictResponse {
  error: string;
  reason: ModulePlanConflictReason;
  /** The current draft version. */
  version?: number | null;
  /** Ids that no longer resolve (reason `stale_ids`). */
  staleIds?: string[];
  issues?: ModulePlanIssue[];
}

/** `409` from `POST /courses/{identifier}/module-plans/generate`. */
export interface ModuleGenerationConflictResponse {
  error: string;
  /** The course's open modules job. */
  job: CourseGenerationJob;
}

// ---------------------------------------------------------------------------
// Client surface
// ---------------------------------------------------------------------------

/**
 * The client surface for module generation. The live client
 * (`services/moduleGenerationService.ts`) and its mock implement this, so the
 * mock can be swapped for the backend by flipping one flag.
 */
export interface ModuleGenerationService {
  /**
   * The course's open modules job (running, or completed and awaiting review),
   * or `null`. `GET /courses/{identifier}/generation-jobs?kind=modules&open=true&limit=1`.
   */
  getOpenJob(courseIdentifier: string): Promise<CourseGenerationJob | null>;
  startGeneration(
    courseIdentifier: string,
    options: ModuleGenerationOptions,
  ): Promise<CourseGenerationJob>;
  getJob(jobIdentifier: string): Promise<ModuleGenerationJob>;
  listEvents(
    jobIdentifier: string,
    params?: ListModuleGenerationEventsParams,
  ): Promise<ModuleGenerationEventListResponse>;
  cancel(jobIdentifier: string): Promise<CourseGenerationJob>;
  updatePlan(
    jobIdentifier: string,
    request: UpdateModulePlanRequest,
  ): Promise<ModulePlanDraft>;
  accept(
    jobIdentifier: string,
    request: AcceptModulePlanRequest,
  ): Promise<AcceptModulePlanResponse>;
  discard(jobIdentifier: string): Promise<CourseGenerationJob>;
}
