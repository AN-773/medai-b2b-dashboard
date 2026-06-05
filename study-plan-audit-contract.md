# Study Plan Audit API Contract

This document is the frontend-facing contract for the study plan audit endpoints implemented from [studyplan_audit_plan.md](../studyplan_audit_plan.md).

It is derived from the live handlers in `application/controllers.go` and the HTTP tests in `application/study_plan_audit_test.go` and `application/session_audit_score_test.go`. Use this document as the source of truth for payload shapes until `api.yaml` is expanded with the same response schemas.

## Scope

- All endpoints are superadmin-only.
- All endpoints are cross-tenant.
- No tenant filter is applied at the API layer.
- No endpoint in this contract takes query params today.
- All drill-down route params in this document are resource `identifier` values, not internal `id` values.
- All timestamps are ISO-8601 UTC strings.
- Nullable fields are returned as `null`.
- `langfuse_trace_url` and `langfuse_span_url` can be an empty string when `LANGFUSE_HOST` is not configured, even if the corresponding IDs are present.

## Common error shape

```ts
type AuditErrorResponse = {
  error: string;
};
```

Common auth errors:

- `401`: `{ "error": "authentication required" }`
- `403`: `{ "error": "superadmin role required" }`

## Route summary

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/superadmin/audit/study-plans` | `200` |
| `GET` | `/superadmin/audit/study-plans/{identifier}/audit` | `200` |
| `GET` | `/superadmin/audit/study-plans/uploads/{identifier}/audit` | `200` |
| `GET` | `/superadmin/audit/study-plans/sessions/{identifier}/audit` | `200` |
| `POST` | `/superadmin/audit/study-plans/sessions/{identifier}/score` | `201` |
| `GET` | `/superadmin/audit/study-plans/items/{identifier}/lineage` | `200` |
| `GET` | `/superadmin/audit/study-plans/learning-objectives/{identifier}/lineage` | `200` |

## Shared types

```ts
type SessionMode = "mcq" | "saq" | "lecture" | "flashcard" | "mixed" | string;

type AuditRunStatus = "started" | "succeeded" | "failed" | string;

type SessionFinalStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "no_items_generated"
  | string;

type SessionSelectionStrategy =
  | "weak_then_random_fill"
  | "weak_then_random_chunk_fallback"
  | string;

type SessionSelectionLOStrategy =
  | "weak"
  | "random_fill"
  | "internal_reused"
  | "fallback"
  | string;

type ChunkSource =
  | "linked"
  | "similarity_fallback"
  | "random_fallback"
  | "internal_reused"
  | string;

type UploadAuditRun = {
  id: string;
  tenant_id: string | null;
  stage: string;
  status: AuditRunStatus;
  error_code: string | null;
  model: string;
  prompt_type: string;
  input_token_count: number;
  output_token_count: number;
  latency_ms: number;
  attempt: number;
  langfuse_trace_id: string;
  langfuse_trace_url: string;
  started_at: string;
  ended_at: string | null;
};

type UploadAuditChunk = {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  content_snippet: string;
};

type UploadRef = {
  id: string;
  study_plan_id: string | null;
  tenant_id: string | null;
  file_name: string;
  status: string;
};

type SessionAuditSourceScope = {
  enabled: boolean;
  upload_ids: string[];
  internal_source_exams: string[];
};

type SessionAuditSelectionLO = {
  id: string;
  identifier: string;
  title: string;
  tenant_id: string | null;
  rank: number;
  strategy: SessionSelectionLOStrategy;
  accuracy: number | null;
  attempts_count: number | null;
  last_seen_at: string | null;
  scope_match_reason: string;
  notes: string;
  selected: boolean;
};

type SessionAuditChunk = {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  snippet: string;
};

type SessionAuditRejectionReason = {
  index: number;
  reason: string;
};

type SessionAuditRun = {
  id: string;
  tenant_id: string | null;
  stage: string;
  status: AuditRunStatus;
  error_code: string | null;
  prompt_type: string;
  model: string;
  input_token_count: number;
  output_token_count: number;
  latency_ms: number;
  attempt: number;
  langfuse_trace_id: string;
  langfuse_trace_url: string;
  langfuse_span_id: string;
  langfuse_span_url: string;
  chunk_source: ChunkSource;
  chunk_ids: string[];
  chunk_similarity_scores: number[];
  items_requested: number;
  items_returned: number;
  items_persisted: number;
  rejection_reasons: SessionAuditRejectionReason[];
  started_at: string;
  ended_at: string | null;
};

type SessionAuditItem = {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
};

type ItemLineageItem = {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
};

type ItemLineageLearningObjective = {
  id: string;
  identifier: string;
  title: string;
  tenant_id: string | null;
};

type ItemLineageRun = {
  id: string;
  tenant_id: string | null;
  stage: string;
  status: AuditRunStatus;
  error_code: string | null;
  prompt_type: string;
  model: string;
  input_token_count: number;
  output_token_count: number;
  latency_ms: number;
  attempt: number;
  langfuse_trace_id: string;
  langfuse_trace_url: string;
  langfuse_span_id: string;
  langfuse_span_url: string;
  started_at: string;
  ended_at: string | null;
};

type ItemLineageChunk = {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  content_snippet: string;
  upload?: UploadRef;
};

type LOLineageChunk = {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  content_snippet: string;
  run_id: string;
  upload?: UploadRef;
};

type LOLineageItem = {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
  run_id: string;
};
```

## 1. List audited study plans

### Request

`GET /superadmin/audit/study-plans`

### Success response

```ts
type ListStudyPlanAuditsResponse = {
  study_plans: Array<{
    id: string;
    identifier: string;
    title: string;
    exam_name: string;
    status: string;
    tenant_id: string | null;
    total_runs: number;
    uploads_with_audits: number;
    learning_objectives_with_audits: number;
    items_with_audits: number;
    sessions_with_audits: number;
    last_audit_at: string | null;
  }>;
};
```

### Notes

- Only study plans with an audit footprint are returned.
- Audit footprint currently means the study plan appears in `generation_runs` and/or `session_generation_audits`.
- `study_plans` is sorted by `last_audit_at DESC`, then title, then ID.

## 2. Get study plan audit

### Request

`GET /superadmin/audit/study-plans/{identifier}/audit`

Path params:

- `identifier: string` - study plan identifier

### Success response

```ts
type GetStudyPlanAuditResponse = {
  study_plan_id: string;
  study_plan: {
    id: string;
    identifier: string;
    title: string;
    exam_name: string;
    status: string;
    tenant_id: string | null;
    created_at: string;
    updated_at: string;
  };
  totals: {
    uploads: number;
    learning_objectives: number;
    items: number;
    sessions: number;
  };
  stages: Array<{
    tenant_id: string | null;
    stage: string;
    total_runs: number;
    succeeded_runs: number;
    failed_runs: number;
    success_rate: number;
    failure_rate: number;
  }>;
  uploads: Array<{
    id: string;
    identifier: string;
    tenant_id: string | null;
    file_name: string;
    status: string;
    chunk_count: number;
    learning_objectives_count: number;
    audit_runs: number;
    last_audit_at: string | null;
  }>;
  learning_objectives: Array<{
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    source_upload_count: number;
    source_chunk_count: number;
    item_count: number;
    session_count: number;
    last_audit_at: string | null;
  }>;
  items: Array<{
    id: string;
    identifier: string;
    tenant_id: string | null;
    type: string;
    stem_or_question_or_front: string;
    learning_objective_id: string | null;
    learning_objective_identifier: string;
    learning_objective_title: string;
    audit_runs: number;
    last_audit_at: string | null;
  }>;
  sessions: Array<{
    id: string;
    identifier: string;
    tenant_id: string | null;
    mode: SessionMode;
    requested_item_count: number;
    items_generated: number;
    items_persisted: number;
    status: SessionFinalStatus;
    error_code: string | null;
    started_at: string;
    ended_at: string | null;
  }>;
};
```

### Notes

- `stages` is grouped by `(tenant_id, stage)`.
- `success_rate` and `failure_rate` are percentages from `0` to `100`.
- The path param is a study plan identifier, while `study_plan_id` and `study_plan.id` in the payload remain the internal resource ID.
- `totals` keeps the legacy semantics: it counts all study plan uploads, LOs, items, and sessions, not just the audited subset.
- `uploads`, `learning_objectives`, `items`, and `sessions` are the audited subsets used by the dashboard drill-down.
- `uploads` is driven by upload-linked `generation_runs`.
- `learning_objectives` merges lineage-backed LO activity with session selection/generation audit rows.
- `items` is driven by LO -> item lineage within the study plan.
- `sessions` is driven by `session_generation_audits`.

### Non-auth errors

- `400`: `{ "error": "study plan identifier is required" }`
- `404`: `{ "error": "study plan not found" }`

## 3. Get upload audit

### Request

`GET /superadmin/audit/study-plans/uploads/{identifier}/audit`

Path params:

- `identifier: string` - study plan upload identifier

### Success response

```ts
type GetUploadAuditResponse = {
  upload_id: string;
  study_plan_id: string | null;
  tenant_id: string | null;
  file_name: string;
  status: string;
  chunk_count: number;
  extraction_runs: UploadAuditRun[];
  unlinked_chunks: UploadAuditChunk[];
  learning_objectives: Array<{
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    chunks: UploadAuditChunk[];
  }>;
};
```

### Notes

- `chunk_count` is the total number of chunks on the upload, even if some are not linked to any LO.
- `unlinked_chunks` returns upload chunks that are not linked to any LO included in `learning_objectives`.
- `learning_objectives[].chunks` is deduplicated by chunk ID.
- `extraction_runs` currently returns upload-scoped runs from LO extraction stages.
- The path param is an upload identifier, while `upload_id` in the payload remains the internal upload ID.

### Non-auth errors

- `400`: `{ "error": "upload identifier is required" }`
- `404`: `{ "error": "upload not found" }`

## 4. Get session audit

### Request

`GET /superadmin/audit/study-plans/sessions/{identifier}/audit`

Path params:

- `identifier: string` - study plan session identifier

### Success response

```ts
type GetSessionAuditResponse = {
  tenant_id: string | null;
  session: {
    id: string;
    study_plan_id: string;
    mode: SessionMode;
    requested_item_count: number;
    source_scope: SessionAuditSourceScope;
    langfuse_trace_id: string;
    langfuse_trace_url: string;
    langfuse_session_id: string;
    started_at: string;
    ended_at: string | null;
  };
  selection: {
    strategy: SessionSelectionStrategy;
    candidate_pool_size: number;
    los_selected_count: number;
    los: SessionAuditSelectionLO[];
  };
  los: Array<{
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    chunks_used: SessionAuditChunk[];
    runs: SessionAuditRun[];
    items: SessionAuditItem[];
  }>;
  totals: {
    items_generated: number;
    items_persisted: number;
    block_id: string | null;
    status: SessionFinalStatus;
    error_code: string | null;
  };
};
```

### Notes

- `selection.los` is the full candidate list from LO selection.
- `selection.los[].selected` indicates whether that LO actually produced a generation row.
- `los` only contains LOs that have generation rows in `session_lo_generations`.
- `los` is sorted by selection rank when rank exists.
- `chunks_used` is the union of the run `chunk_ids` that resolved to stored chunks.
- The chunk snippet key here is `snippet`, not `content_snippet`.
- `source_scope.upload_ids` and `source_scope.internal_source_exams` are always arrays and can be empty.
- The path param is a session identifier, while `session.id` in the payload remains the internal session ID.

### Non-auth errors

- `400`: `{ "error": "session identifier is required" }`
- `404`: `{ "error": "session not found" }`
- `404`: `{ "error": "session audit not found" }`

## 5. Record session score

### Request

`POST /superadmin/audit/study-plans/sessions/{identifier}/score`

Path params:

- `identifier: string` - study plan session identifier

Request body:

```ts
type RecordSessionScoreRequest = {
  lo_id?: string;
  item_id?: string;
  value: "good" | "bad";
  comment?: string;
  name?: string;
};
```

### Success response

```ts
type RecordSessionScoreResponse = {
  id: string;
  session_id: string;
  lo_id?: string;
  item_id?: string;
  value: "good" | "bad";
  comment?: string;
  langfuse_trace_id: string;
  created_at: string;
};
```

### Notes

- `value` is required.
- `name` defaults to `"doctor_quality"` when omitted or blank.
- `good` is mirrored to Langfuse as numeric `1`.
- `bad` is mirrored to Langfuse as numeric `0`.
- The response mirrors the persisted `audit_scores` row.
- The path param is a session identifier, while `session_id` in the response remains the internal session ID.
- The backend currently treats `lo_id` and `item_id` as optional opaque IDs. Frontend should only send IDs that actually belong to the session.

### Non-auth errors

- `400`: `{ "error": "session identifier is required" }`
- `400`: `{ "error": "invalid request body: ..." }`
- `400`: `{ "error": "value must be 'good' or 'bad'" }`
- `404`: `{ "error": "session audit not found" }`

## 6. Get item lineage

### Request

`GET /superadmin/audit/study-plans/items/{identifier}/lineage`

Path params:

- `identifier: string` - item identifier

### Success response

```ts
type GetItemLineageResponse = {
  tenant_id: string | null;
  study_plan_id: string;
  item: ItemLineageItem;
  learning_objective: ItemLineageLearningObjective;
  generation_run: ItemLineageRun;
  chunks: ItemLineageChunk[];
};
```

### Notes

- The backend selects one producing run for the item, preferring generated lineage over reused lineage when both exist.
- `chunks` can be empty. This is valid, especially when the chosen run used `chunk_source = "internal_reused"`.
- `chunks[].upload` is omitted when the chunk has no upload row.
- The path param is an item identifier, while `item.id` in the payload remains the internal item ID.

### Non-auth errors

- `400`: `{ "error": "item identifier is required" }`
- `404`: `{ "error": "item not found" }`
- `404`: `{ "error": "item lineage not found" }`

## 7. Get learning objective lineage

### Request

`GET /superadmin/audit/study-plans/learning-objectives/{identifier}/lineage`

Path params:

- `identifier: string` - learning objective identifier

### Success response

```ts
type GetLearningObjectiveLineageResponse = {
  tenant_id: string | null;
  study_plan_id: string | null;
  learning_objective: {
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    study_plan_id: string | null;
    exam: string;
    source: string;
  };
  chunks: LOLineageChunk[];
  items: LOLineageItem[];
};
```

### Notes

- `chunks` includes all upstream source chunks across uploads.
- `chunks` is deduplicated by chunk ID.
- `chunks[].run_id` is the run that recorded the chunk -> LO edge kept in the response.
- `items` includes all downstream derived items.
- `items` is deduplicated by item ID.
- `items[].run_id` is the run attached to the first-recorded LO -> item edge kept in the response.
- The path param is a learning objective identifier, while `learning_objective.id` in the payload remains the internal LO ID.

### Non-auth errors

- `400`: `{ "error": "learning objective identifier is required" }`
- `404`: `{ "error": "learning objective not found" }`

## Frontend integration notes

- Treat all `*_url` fields as display-ready links. Do not rebuild them on the client.
- Do not assume every LO in `selection.los` appears in `los`.
- Do not assume every lineage response has chunks.
- Do not normalize `snippet` and `content_snippet` unless the frontend does that intentionally in its own adapter layer.
- `tenant_id` is present for display/debugging, not for frontend authorization decisions.
