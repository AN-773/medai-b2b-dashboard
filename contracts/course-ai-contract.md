# Course AI Content Factory API Contract

This document is the frontend-facing contract for the AI **content factory**: AI-drafted content items (MCQ / SAQ / flashcard / lecture) generated per learning objective, reviewed and accepted by the teacher. It lives on the TESTS service alongside `/courses`.

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
| `GET` | `/courses/{identifier}/generation-jobs` | `200` | `?kind=items&limit=`; latest-first |
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
type CourseGenerationKind = 'items';

type CourseGenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

// Mirrors CohortStudyPlanJob (types/AcademyStudioTypes.ts) with a generation kind.
type CourseGenerationJob = {
  id: string;                 // absolute URL
  identifier: string;         // trailing slug, used for batch action routes
  courseId: string;           // absolute URL
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

- Query params: `kind` (`items`), `limit`, `page`.
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
