# Course AI Content Factory API Contract

This document is the frontend-facing contract for the AI **content factory**: AI-drafted content items (MCQ / SAQ / flashcard / lecture) generated per learning objective, reviewed and accepted by the teacher, and AI-drafted **modules and sessions** ("Create with AI" on the Modules tab, see [Module generation](#module-generation)). It lives on the TESTS service alongside `/courses`.

It is the forward contract for handlers that will live in `application/controllers.go`, the write logic in `application/receivers.go`, the projections in `infrastructure/models.go`, and the route definitions in `api.yaml`. Until those are expanded, this document is the source of truth (mirroring `study-plan-audit-contract.md`). It extends, and reuses the conventions of, the Course Learning Objective Suggestions workflow consumed by `services/courseStudioService.ts`.

## Scope

- All resources are tenant-scoped. Reads only return resources belonging to the caller's tenant; writes stamp the caller's tenant on create.
- Route params named `identifier` refer to the trailing identifier segment, for example `2a7f9c3k8m1q4r6t0v2x5y7zb9d`, not the full absolute URL.
- `id` fields in responses are absolute resource URIs. Use the trailing identifier segment for `identifier` path params.
- IDs used in query filters (`learningObjectiveId`, `jobId`) and in request-body id fields are absolute resource URIs, not identifier path segments.
- Timestamps are RFC3339 / ISO-8601 strings. Nullable fields are returned as `null`.
- `POST` and `PATCH` are routed through dispatch controllers. On success they return the body documented below; on validation or permission failure the HTTP status code is authoritative and the response body may be `null`.
- `identifier` is server-managed on create and generated as a random lower-case KSUID. It is opaque and is not derived from any title.
- Request bodies wrap the resource, for example `{ "itemGeneration": { ... } }`, `{ "itemSuggestion": { ... } }`.
- **Async generation.** Item generation is long-running. The trigger endpoint enqueues work and returns a `CourseGenerationJob` with `202`. Clients poll `GET /courses/{identifier}/generation-jobs?kind=items&limit=1` every ~5 seconds until `status` is `completed` or `failed` (cap at ~60 attempts), then read the resulting suggestions. Item suggestions only become readable once the job's `status` is `completed`.

## Authorization

| Capability | Roles |
| --- | --- |
| View item suggestions / generation jobs | `Administrator` |
| Generate items, accept / reject / patch | `Administrator` |

`401` and `403` are enforced by the gateway/auth middleware before the handler runs.

## Route Summary

Item factory (mirrors the learning-objective suggestion routes):

| Method | Path | Success | Notes |
| --- | --- | --- | --- |
| `POST` | `/courses/{identifier}/item-suggestions/generate` | `202` | Body lists `learningObjectiveIds` (omit for all course LOs) + per-type plan; enqueues an items job; returns `CourseGenerationJob` |
| `POST` | `/learning-objectives/{identifier}/item-suggestions/generate` | `202` | Generate items for one objective; body carries the absolute `courseId` + plan; returns `CourseGenerationJob` |
| `GET` | `/courses/{identifier}/generation-jobs` | `200` | `?kind=items\|modules&open=&limit=&page=`; latest-first |
| `GET` | `/courses/{identifier}/item-suggestions` | `200` | `?learningObjectiveId=&jobId=&status=&type=&page=&limit=` |
| `PATCH` | `/item-suggestions/{identifier}` | `200` | Edit the draft payload of a pending suggestion |
| `POST` | `/item-suggestions/{identifier}/accept` | `200` | Promote one pending suggestion to a real item → `AcceptItemSuggestionResponse` |
| `POST` | `/item-suggestions/{identifier}/reject` | `200` | Reject one pending suggestion (terminal) |
| `POST` | `/learning-objectives/{identifier}/item-suggestions/accept-all` | `200` | Accept all pending item suggestions for an objective → `ItemSuggestionBatchResult` |
| `POST` | `/learning-objectives/{identifier}/item-suggestions/reject-all` | `200` | Reject all pending item suggestions for an objective → `ItemSuggestionBatchResult` |
| `POST` | `/item-generation-jobs/{identifier}/item-suggestions/accept-all` | `200` | Accept all pending item suggestions produced by a job → `ItemSuggestionBatchResult` |
| `POST` | `/item-generation-jobs/{identifier}/item-suggestions/reject-all` | `200` | Reject all pending item suggestions produced by a job → `ItemSuggestionBatchResult` |

Two generate scopes are provided: the course route fans out across many objectives in one request (and generates for every course LO when `learningObjectiveIds` is omitted), while the per-objective route targets a single learning objective and carries the owning `courseId` in its body. Likewise two accept-all / reject-all scopes exist — per-objective and per-job. The UI reviews one objective at a time, so clients primarily use the per-objective routes.

## Types

`SuggestionStatus`, `SuggestionEvidenceChunk`, and `BatchReviewFailure` are reused from the Course Learning Objective Suggestions workflow (`types/CourseStudioTypes.ts`) and are not redefined here. Batch accept/reject returns `ItemSuggestionBatchResult` (defined below) rather than the learning-objective `BatchReviewResult`, because accepted item suggestions produce items — the ids returned are item ids (`acceptedItemIds`).

```ts
type CourseGenerationKind = 'items' | 'modules';

// Machine lifecycle only: queued -> processing -> completed | failed | cancelled.
// 'cancelled' is used by modules jobs.
type CourseGenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Mirrors CohortStudyPlanJob (types/AcademyStudioTypes.ts) with a generation kind.
type CourseGenerationJob = {
  id: string;                 // absolute URL
  identifier: string;         // trailing slug, used for batch action routes
  courseId: string;           // absolute URL
  kind: CourseGenerationKind;
  status: CourseGenerationJobStatus;
  // Modules jobs only (null/absent for items jobs); see Module generation.
  stage?: ModuleGenerationStage | null;
  reviewState?: ModuleGenerationReviewState | null;
  cancelRequestedAt?: string | null;
  // Usage across every LLM call of the job. tokensOut includes reasoning tokens.
  tokensIn?: number;
  tokensOut?: number;
  llmCalls?: number;
  triggerSource?: string;
  queuedCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ItemSuggestionType = 'mcq' | 'saq' | 'flashcard' | 'lecture';

// Per-type draft payload. Field names match the item-creation request
// (ItemUpsertRequest / Choice in types/TestsServiceTypes.tsx) so accept maps
// straight onto the existing item-creation path.
type ItemSuggestionDraft = {
  mcq?: {
    stem: string;
    choices: { content: string; isCorrect: boolean; explanation?: string }[];
  };
  saq?: { question: string; answer: string };
  flashcard?: { front: string; back: string };
  lecture?: { title: string; content: string; summary: string };
};

// Mirrors LearningObjectiveSuggestion (types/CourseStudioTypes.ts).
type ItemSuggestion = {
  id: string;                 // absolute URL
  identifier: string;         // trailing slug, used for action routes
  courseId: string;           // absolute URL
  learningObjectiveId: string;// absolute URL
  jobId?: string;             // absolute URL of the producing job
  type: ItemSuggestionType;
  status: SuggestionStatus;   // 'pending' | 'accepted' | 'rejected'
  draft: ItemSuggestionDraft;
  acceptedItemId?: string;    // absolute URL once accepted
  tags?: string[];
  chunks?: SuggestionEvidenceChunk[];
  createdAt?: string;
  updatedAt?: string;
};

type AcceptItemSuggestionResponse = {
  itemId: string;             // absolute URL of the created item
  suggestion: ItemSuggestion;
};

// Batch accept/reject outcome. Mirrors BatchReviewResult but the accepted ids
// are item ids, since accepting a suggestion creates an item.
type ItemSuggestionBatchResult = {
  accepted: number;
  rejected: number;
  failed: number;
  acceptedItemIds?: string[];          // absolute item URLs
  failures?: BatchReviewFailure[];     // { id, error }
};

type GenerateItemSuggestionsRequest = {
  // Absolute LO ids. Optional on the course route — omit to generate for every
  // learning objective in the course. On the per-objective route the objective
  // comes from the path.
  learningObjectiveIds?: string[];
  courseId?: string;               // absolute URL; required on the per-objective route
  plan?: { type: ItemSuggestionType; count: number }[];
  triggerSource?: string;          // optional provenance label stored on the job
};
```

## Endpoints

### `POST /courses/{identifier}/item-suggestions/generate`

Enqueue an item generation job for one or more learning objectives. `plan` sets the desired count per item type; when omitted the backend chooses a default mix. Omit `learningObjectiveIds` to generate for every learning objective in the course.

```json
{
  "itemGeneration": {
    "learningObjectiveIds": ["https://host/base/learning-objectives/xyz..."],
    "plan": [
      { "type": "mcq", "count": 3 },
      { "type": "flashcard", "count": 5 }
    ]
  }
}
```

- `202` -> `CourseGenerationJob` (kind `items`). Poll the job list, then read suggestions.
- `400` -> invalid `plan` (or unknown `learningObjectiveIds`).
- `403` -> caller has no resolvable tenant.
- `404` -> course or a learning objective not found.
- `409` -> an items job is already running for this course.

### `POST /learning-objectives/{identifier}/item-suggestions/generate`

Enqueue an item generation job scoped to a single learning objective (the path `{identifier}`). The body carries the owning course as an absolute `courseId`; the resulting job is still polled via the course's `generation-jobs` list.

```json
{
  "itemGeneration": {
    "courseId": "https://host/base/courses/abc...",
    "plan": [{ "type": "mcq", "count": 3 }]
  }
}
```

- `202` -> `CourseGenerationJob` (kind `items`).
- `400` -> missing `courseId` or invalid `plan`.
- `404` -> course or learning objective not found.
- `409` -> an items job is already running for this course.

### `GET /courses/{identifier}/generation-jobs`

List generation jobs for the course, latest first. Used to poll progress.

- Query params: `kind` (`items` | `modules`), `open` (boolean), `limit`, `page`.
- `open=true` returns only open jobs: `status` `queued` or `processing`, or `status` `completed` with `reviewState` `awaiting_review`. The Modules tab calls `?kind=modules&open=true&limit=1` once on mount to find a running job or a draft awaiting review.
- `200` -> `PaginatedApiResponse<CourseGenerationJob>`. Clients read `items[0]` when polling with `limit=1`.

### `GET /courses/{identifier}/item-suggestions`

List item suggestions with their draft payloads and evidence chunks.

- Query params: `learningObjectiveId` (absolute URI), `jobId` (absolute URI), `status`, `type`, `page`, `limit`.
- `200` -> `PaginatedApiResponse<ItemSuggestion>`.

### `PATCH /item-suggestions/{identifier}`

Edit the draft payload of a pending suggestion before accepting it.

```json
{ "itemSuggestion": { "draft": { "mcq": { "stem": "Revised stem text" } } } }
```

- `200` -> `ItemSuggestion`.
- `409` -> suggestion is not pending.

### `POST /item-suggestions/{identifier}/accept`

Promote one pending suggestion to a real course item. Server-side this uses the same creation path as `ItemUpsertRequest`.

- `200` -> `AcceptItemSuggestionResponse`.
- `409` -> the row is stale (already accepted/rejected); the client should refresh.

### `POST /item-suggestions/{identifier}/reject`

Reject one pending suggestion (terminal).

- `200` -> `ItemSuggestion`.
- `409` -> the row is stale; the client should refresh.

### `POST /learning-objectives/{identifier}/item-suggestions/accept-all` · `.../reject-all`

Accept or reject all pending item suggestions for a learning objective.

- `200` -> `ItemSuggestionBatchResult`.

### `POST /item-generation-jobs/{identifier}/item-suggestions/accept-all` · `.../reject-all`

Accept or reject all pending item suggestions produced by a generation job.

- `200` -> `ItemSuggestionBatchResult`.

## Behavioral Notes

- IDs in query filters (`learningObjectiveId`, `jobId`) are absolute resource URIs, not identifier path segments. Path `{identifier}` params are trailing slugs.
- Item suggestions never become items until accepted. Accept uses the same server path as `upsertItem`.
- Polling: poll `generation-jobs?kind=items&limit=1` every ~5 seconds; stop on `completed`/`failed` or after ~60 attempts; on `completed`, refetch the affected objective's suggestions.
- `409` on accept/reject means a stale row; clients refresh to resync (mirrors the learning-objective suggestion behavior).
- Async enqueue endpoints return `202`. The frontend client is status-code agnostic, so a backend that prefers `201` requires only a documentation change here.

## Module generation

"Create with AI" on the Modules tab. A **modules job** (a `CourseGenerationJob` with `kind: 'modules'`) runs in the background: an LLM orchestrator reads the course's files, learning objectives and items, and drafts modules and sessions. When a learning objective a session needs has no suitable items, it can draft new items as **item suggestions owned by the job**. The wizard only starts and watches the job; the user can leave at any time. A completed job holds a **draft plan** the user reviews, edits and accepts. Accepting creates everything in one transaction, appended after the course's existing modules.

The TypeScript types live in `types/ModuleGenerationTypes.ts` (the widened `CourseGenerationJob` in `types/CourseAITypes.ts`, the upload brief fields in `types/CourseStudioTypes.ts`). The routes are defined in the TESTS service `api.yaml`.

### Lifecycle

Three separate fields; `status` is never overloaded:

| Field | Values | Meaning |
| --- | --- | --- |
| `status` | `queued` → `processing` → `completed` \| `failed` \| `cancelled` | Machine lifecycle only. |
| `stage` | `analyzing` \| `drafting_items` \| `planning` \| `null` | Progress while `processing`. |
| `reviewState` | `awaiting_review` → `accepted` \| `discarded`, or `null` | Outcome after `completed`. `null` until the job completes. |

- **One open draft per course.** A course has at most one *open* modules job: `queued`, `processing`, or `completed` with `reviewState: 'awaiting_review'`. Starting another returns `409` with the open job.
- Draft item suggestions stay out of the ordinary item review: suggestions created by a modules job are not listed by `GET /courses/{identifier}/item-suggestions` and cannot be accepted or rejected there. They become items only through **accept**.
- When a job ends `failed` or `cancelled`, or its draft is discarded, all of its pending item suggestions are rejected.
- Job `id` is an absolute URL; job routes take the trailing `identifier`.

### Routes

| Method | Path | Success | Notes |
| --- | --- | --- | --- |
| `POST` | `/courses/{identifier}/module-plans/generate` | `202` | Body `{ moduleGeneration: ModuleGenerationOptions }` → `CourseGenerationJob` (kind `modules`). `409` → `ModuleGenerationConflictResponse` with the open job |
| `GET` | `/courses/{identifier}/generation-jobs?kind=modules&open=true&limit=1` | `200` | Find a running job or a draft awaiting review (see the jobs list above) |
| `GET` | `/module-generation-jobs/{identifier}` | `200` | → `ModuleGenerationJob`: the job, its options and, once completed, `plan` + `version` |
| `GET` | `/module-generation-jobs/{identifier}/events` | `200` | `?afterSeq=&limit=` → `ModuleGenerationEventListResponse` (progress feed) |
| `POST` | `/module-generation-jobs/{identifier}/cancel` | `202` | Cooperative cancel → `CourseGenerationJob`. `409` when the job already finished |
| `PUT` | `/module-generation-jobs/{identifier}/plan` | `200` | Body `UpdateModulePlanRequest` → `ModulePlanDraft`. `400` / `409` |
| `POST` | `/module-generation-jobs/{identifier}/accept` | `200` | Body `AcceptModulePlanRequest` → `AcceptModulePlanResponse`. `400` / `409` with `staleIds` |
| `POST` | `/module-generation-jobs/{identifier}/discard` | `200` | → `CourseGenerationJob` with `reviewState: 'discarded'`. `409` when not awaiting review |

All module generation routes require `Administrator`. Every job route returns `404` (`{ error }`) when the job does not exist in the caller's tenant or is not a modules job.

### Types

```ts
type ModuleGenerationStage = 'analyzing' | 'drafting_items' | 'planning';
type ModuleGenerationReviewState = 'awaiting_review' | 'accepted' | 'discarded';
type ModuleGenerationItemType = 'mcq' | 'saq' | 'flashcard' | 'lecture';

// Wizard options. Stored on the job and echoed back on the job detail.
type ModuleGenerationOptions = {
  instructions?: string;                          // free text, max 4000 chars
  targetModuleCount?: number | null;              // >= 1; omit/null = planner decides
  sessionsPerModule?: { min?: number; max?: number } | null; // each >= 1
  fileIds?: string[];                             // absolute course upload ids; omit = every completed upload
  allowItemCreation?: boolean;                    // default true
  itemTypes?: ModuleGenerationItemType[];         // omit = all types
  triggerSource?: string;                         // provenance label stored on the job
};

type GenerateModulePlanRequest = { moduleGeneration: ModuleGenerationOptions };

// Exactly one of itemId (an existing item) or itemSuggestionId (an item
// suggestion drafted by this job; it becomes an item on accept).
type ModulePlanItemRef = { itemId: string } | { itemSuggestionId: string };

type ModulePlanSession = {
  title: string;                   // 1..120 chars
  order: number;
  rationale?: string;
  items: ModulePlanItemRef[];      // at least 1
  learningObjectiveIds?: string[]; // absolute ids
  sourceFileIds?: string[];        // absolute course upload ids
};

type ModulePlanModule = {
  title: string;                   // 1..120 chars
  order: number;
  rationale?: string;
  sessions: ModulePlanSession[];   // at least 1
};

type ModulePlan = {
  modules: ModulePlanModule[];     // at least 1
  warnings?: string[];
};

// GET /module-generation-jobs/{identifier}
type ModuleGenerationJob = CourseGenerationJob & {
  options?: ModuleGenerationOptions;
  plan?: ModulePlan | null;        // null until completed, and after failed/cancelled
  version?: number | null;         // draft version; null when plan is null
  planUpdatedAt?: string | null;
  lastEventSeq?: number;           // highest event seq recorded (0 when none)
  itemSuggestions?: ItemSuggestion[]; // the job's AI-created items, present once there is a plan
};

type ModuleGenerationEventKind =
  | 'tool_call' | 'subagent_start' | 'subagent_done' | 'compaction' | 'warning' | 'error';

type ModuleGenerationEvent = {
  seq: number;                     // dense, increasing per job
  agent: string;                   // 'orchestrator' or e.g. 'file_analyst#2'
  kind: ModuleGenerationEventKind;
  label: string;                   // e.g. "Reading Cardio L3.pdf (section 2/7)"
  detail?: Record<string, unknown> | null; // truncated debugging detail; do not drive UI logic from it
  tokensIn?: number;
  tokensOut?: number;
  createdAt: string;
};

type ModuleGenerationEventListResponse = {
  items: ModuleGenerationEvent[];  // seq order
  lastSeq: number;                 // pass as the next afterSeq
};

type ModulePlanDraft = {
  jobId: string;
  plan: ModulePlan;
  version: number;
  updatedBy?: string | null;
  updatedAt: string;
};

type UpdateModulePlanRequest = { plan: ModulePlan; version: number };
type AcceptModulePlanRequest = { version: number };

type AcceptModulePlanResponse = {
  job: CourseGenerationJob;        // reviewState 'accepted'
  modules: {
    id: string; identifier: string; title: string; displayOrder: number;
    sessions: { id: string; identifier: string; title: string; displayOrder: number; itemIds: string[] }[];
  }[];
  createdItemIds: string[];        // items created from this job's suggestions
};

type ModulePlanIssueCode =
  // the plan itself is malformed
  | 'empty_plan' | 'empty_module' | 'empty_session' | 'missing_title' | 'title_too_long'
  | 'invalid_item_ref' | 'duplicate_item' | 'empty_id'
  // an id no longer resolves (also listed in staleIds)
  | 'unknown_item' | 'unknown_item_suggestion' | 'foreign_item_suggestion'
  | 'unknown_learning_objective' | 'unknown_source_file';

type ModulePlanIssue = {
  code: ModulePlanIssueCode;
  path: string;                    // e.g. 'modules[0].sessions[2].items[1]'
  id?: string;
  message: string;
};

// 400 from PUT plan / accept
type ModulePlanValidationErrorResponse = {
  error: string;
  issues: ModulePlanIssue[];
  staleIds?: string[];
};

// 409 from PUT plan / accept
type ModulePlanConflictResponse = {
  error: string;
  reason: 'stale_version' | 'stale_ids' | 'not_awaiting_review';
  version?: number | null;         // current draft version
  staleIds?: string[];             // reason 'stale_ids'
  issues?: ModulePlanIssue[];      // reason 'stale_ids'
};

// 409 from POST generate
type ModuleGenerationConflictResponse = {
  error: string;
  job: CourseGenerationJob;        // the course's open modules job
};
```

`CourseUpload` responses (`GET /courses/{identifier}/uploads`, `POST /courses/{identifier}/uploads`) gain the per-file brief. Briefs are generated for **new uploads only** (no backfill); a failed brief never fails the upload. Upload `progress.stage` can also be `generating_brief`, after `extracting_los`.

```ts
type CourseUploadBriefStatus = 'pending' | 'completed' | 'failed' | 'skipped';
type CourseUploadBriefContentType =
  | 'lecture' | 'guideline' | 'textbook_chapter' | 'slides' | 'notes' | 'other';

// Added to CourseUpload:
//   brief: string | null;                              // 120-250 words
//   briefTopics: string[] | null;                      // up to 15
//   briefContentType: CourseUploadBriefContentType | null;
//   briefStatus: CourseUploadBriefStatus | null;       // null = upload predates the brief step
```

### `POST /courses/{identifier}/module-plans/generate`

Start a modules job for the course.

```json
{
  "moduleGeneration": {
    "instructions": "Group by organ system; keep pharmacology in its own module.",
    "targetModuleCount": 4,
    "sessionsPerModule": { "min": 2, "max": 5 },
    "fileIds": ["https://host/base/course-uploads/abc..."],
    "allowItemCreation": true,
    "itemTypes": ["mcq", "flashcard"]
  }
}
```

- `202` -> `CourseGenerationJob` (`kind: 'modules'`, `status: 'queued'`).
- `400` -> invalid options, or the course has no completed uploads or no accepted learning objectives (`{ error }`).
- `404` -> course not found.
- `409` -> `ModuleGenerationConflictResponse`: the course already has an open modules job (queued, processing, or completed and awaiting review). Resume that job instead.

### `GET /module-generation-jobs/{identifier}`

- `200` -> `ModuleGenerationJob`. While `processing`, `stage` shows progress and `plan` is `null`. Once `completed`, `plan` and `version` hold the draft and `reviewState` is `awaiting_review` (later `accepted` / `discarded`). On `failed`, `errorMessage` says why.

### `GET /module-generation-jobs/{identifier}/events`

Progress feed for the Progress step.

- Query params: `afterSeq` (default `0`; events with `seq > afterSeq`), `limit` (default `100`, max `500`).
- `200` -> `ModuleGenerationEventListResponse`. Poll every ~3 s while the Progress step is visible, passing the returned `lastSeq` as the next `afterSeq`. Stop when the job leaves `queued` / `processing`.

### `POST /module-generation-jobs/{identifier}/cancel`

Cooperative cancel. No body.

- `202` -> `CourseGenerationJob`. A queued job is `cancelled` at once. A processing job keeps `status: 'processing'` with `cancelRequestedAt` set and becomes `cancelled` at its next checkpoint (between agent turns and sub-agent calls); keep polling.
- `409` -> the job already finished (`completed`, `failed` or `cancelled`).

### `PUT /module-generation-jobs/{identifier}/plan`

Save user edits to the draft. **Full replace**, validated against the current database state with the same rules as the agent's own plan. Allowed only while `reviewState` is `awaiting_review`.

```json
{ "plan": { "modules": [ ... ], "warnings": [] }, "version": 3 }
```

- `200` -> `ModulePlanDraft` with `version` incremented. Send that version with the next edit or accept.
- `400` -> `ModulePlanValidationErrorResponse`: the plan is malformed (no modules, a module without sessions, a session without items, an item used twice, a blank or over-long title, an item entry with neither or both ids).
- `409` -> `ModulePlanConflictResponse`:
  - `reason: 'stale_version'`: the draft was saved elsewhere since it was read; `version` is the current one. Refetch the job and re-apply.
  - `reason: 'stale_ids'`: `staleIds` lists items, suggestions, learning objectives or files that no longer exist or are no longer usable; highlight the affected sessions.
  - `reason: 'not_awaiting_review'`: the draft was already accepted or discarded.

Validation rules (shared by the agent, PUT plan and accept): at least one module; every module has at least one session; every session has at least one item; titles are 1-120 characters; each item entry sets exactly one of `itemId` / `itemSuggestionId`; no item or suggestion appears twice in the plan; every id exists in the course and tenant; every suggestion is still pending and belongs to this job.

### `POST /module-generation-jobs/{identifier}/accept`

```json
{ "version": 3 }
```

One transaction: re-validate the draft against current state, accept the referenced item suggestions (they become items), create the modules (display order after the existing ones) and their sessions with their items, reject the job's unreferenced suggestions, and set `reviewState: 'accepted'`. **Nothing is written on any error.**

- `200` -> `AcceptModulePlanResponse` with the created ids. Refresh the modules list.
- `400` -> `ModulePlanValidationErrorResponse` (the stored draft is malformed).
- `409` -> `ModulePlanConflictResponse`: `stale_version`, `not_awaiting_review`, or `stale_ids` with `staleIds` listing what was deleted or rejected since the draft was made. Show the affected sessions so the user can remove them, save with `PUT plan`, and retry.

### `POST /module-generation-jobs/{identifier}/discard`

No body. Rejects all of the job's pending item suggestions and sets `reviewState: 'discarded'`.

- `200` -> `CourseGenerationJob`.
- `409` -> the job is not awaiting review.

### Behavioral notes

- **Banner.** On mount the Modules tab calls `GET /courses/{identifier}/generation-jobs?kind=modules&open=true&limit=1`. A `queued`/`processing` job shows "AI is building modules…" (poll every 15 s); a `completed` job with `reviewState: 'awaiting_review'` shows "AI draft ready for review".
- **Optimistic concurrency.** `version` starts at 1 when the job completes and increments on every successful `PUT plan`. Both `PUT plan` and `accept` must send the version they were based on.
- **Ids.** All ids inside `ModulePlan` (`itemId`, `itemSuggestionId`, `learningObjectiveIds`, `sourceFileIds`) and `fileIds` in the options are absolute resource ids. AI-created items appear in the plan as `itemSuggestionId` refs. Preview them from `ModuleGenerationJob.itemSuggestions` (badge "New"); modules-job suggestions are **not** returned by `GET /courses/{identifier}/item-suggestions`.
- **No notifications.** The user sees the result the next time they open the Modules tab.
