Here's the updated Plan 2 with those two changes integrated throughout:

---

# Plan — Full audit & observability for the AI content generation pipeline

## Context

`infrastructure/content_generation_service.go` runs a multi-stage AI pipeline (upload → chunking + embeddings → LO extraction → session LO selection → per-LO chunk retrieval → item generation → persistence). Today the only signal is unstructured `logger.Infof/Errorf` lines. Doctors (non-technical) cannot validate the AI's output, and engineers cannot reconstruct why a specific item was generated for a specific session — which LOs were picked, why, from which chunks, using which prompt version.

We will add a two-layer system:

- Self-hosted Langfuse for AI-side traces (prompt, model, tokens, raw input/output, latency, retries, doctor annotations). User will provision Langfuse and supply `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST`.
- In-house lineage tables + REST endpoints for the medical-domain audit view — chunk → LO → item provenance, session selection decisions with reasons, scoped by Langfuse `langfuse_trace_id` foreign references. **Endpoints are superadmin-only and cross-tenant; no `tenant_id` filter is applied at the API layer.**

User decisions (locked):

- Thin in-house Langfuse HTTP client (no third-party SDK).
- Refactor LO selection functions to return reasons inline.
- REST endpoints only — frontend (UI) lives in another repo.
- Land upload + LO extraction + session generation audit in one pass.

---

## Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ ContentGenerationService stages                                        │
│  upload-chunking → lo-extraction → lo-selection → chunk-retrieval →    │
│  item-generation → persistence                                         │
└────────┬───────────────────────────────────────────────┬───────────────┘
         │ AuditService.Begin/Step/End(ctx, stage, ...)  │
         ▼                                               ▼
┌──────────────────────────┐                ┌─────────────────────────────┐
│ Lineage tables (Postgres)│                │ LangfuseClient (in-house)   │
│  generation_run          │                │   trace / span / generation │
│  generation_lineage      │   trace_id     │   POST /api/public/ingestion│
│  session_generation_audit│ ─────────────► │   batched async flush       │
│  session_lo_selection    │                │   Basic auth pk:sk          │
│  session_lo_generation   │                └─────────────────────────────┘
└──────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│ REST API (superadmin role-gated, cross-tenant)                       │
│  GET  /superadmin/audit/study-plans/:id/audit                        │
│  GET  /superadmin/audit/uploads/:id/audit                            │
│  GET  /superadmin/audit/sessions/:id/audit                           │
│  GET  /superadmin/audit/items/:id/lineage                            │
│  GET  /superadmin/audit/learning-objectives/:id/lineage              │
│  POST /superadmin/audit/sessions/:id/score                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. New persistence schema

Add five GORM models (one migration file each, following the `NNN_description.sql` pattern under `migrations/`). All tables retain `tenant_id` as a **data attribute for filtering and display** — it is never used to gate superadmin API access, but allows superadmins to filter by tenant and for future scoped queries.

### `generation_run` — one row per AI call

| column | type | notes |
|---|---|---|
| id | string (ksuid) | PK |
| tenant_id | *string | nullable, stored for display/filtering only |
| stage | string | `upload_chunking` \| `lo_extraction_map` \| `lo_extraction_reduce` \| `session_lo_selection` \| `chunk_retrieval` \| `item_generation` \| `flashcard_generation` \| `fallback_items` |
| study_plan_id | string | indexed |
| upload_id | *string | nullable, indexed |
| session_id | *string | nullable, indexed |
| learning_objective_id | *string | nullable, indexed |
| worker_id | string | from existing workerID plumbing |
| prompt_type | string | reuses `domain.PromptType*` constants |
| prompt_id | *string | FK to existing prompts table when DB-backed |
| prompt_hash | string | sha256 of resolved template text |
| model | string | e.g. `gpt-4o`, `text-embedding-3-large` |
| input_token_count | int | from OpenAI response |
| output_token_count | int | from OpenAI response |
| latency_ms | int | |
| attempt | int | retry counter |
| status | string | `started` \| `succeeded` \| `failed` |
| error_code | *string | reuses `compactGenerationErrorCode` output |
| langfuse_trace_id | string | populated even when Langfuse is disabled (UUID v4) |
| langfuse_span_id | string | |
| started_at / ended_at | time.Time | |

### `generation_lineage` — provenance edges

| column | type | notes |
|---|---|---|
| id | string | |
| tenant_id | *string | stored for display/filtering only |
| parent_type | string | `chunk` \| `learning_objective` \| `item` |
| parent_id | string | |
| child_type | string | |
| child_id | string | |
| run_id | string | FK to `generation_run` |
| metadata | JSONB | `{"similarity_score": 0.83, "method": "linked"}` etc. |

Composite index on `(parent_type, parent_id)` and `(child_type, child_id)`.

### `session_generation_audit` — one row per session

| column | type | notes |
|---|---|---|
| session_id | string | PK |
| tenant_id | *string | stored for display/filtering only |
| study_plan_id | string | |
| mode | string | from `domain.SessionMode` |
| requested_item_count | int | |
| source_scope | JSONB | serialized `StudyPlanSourceScope` |
| lo_selection_strategy | string | |
| lo_candidate_pool_size | int | |
| los_selected_count | int | |
| items_generated_count | int | |
| items_persisted_count | int | |
| block_id | *string | |
| langfuse_trace_id | string | root trace |
| langfuse_session_id | string | groups multiple regenerations |
| final_status | string | `succeeded` \| `failed` \| `no_items_generated` |
| error_code | *string | |
| started_at / ended_at | time.Time | |

### `session_lo_selection` — per-LO selection reason

| column | type | notes |
|---|---|---|
| id | string | |
| session_id | string | indexed |
| learning_objective_id | string | |
| rank | int | |
| strategy | string | `weak` \| `random_fill` \| `internal_reused` |
| accuracy | *float | nullable |
| attempts_count | *int | |
| last_seen_at | *time.Time | |
| scope_match_reason | string | e.g. `upload_match:abc123` |
| notes | string | |

### `session_lo_generation` — per-LO generation summary

| column | type | notes |
|---|---|---|
| id | string | |
| session_id | string | |
| learning_objective_id | string | |
| run_id | string | FK to `generation_run` |
| chunk_ids | text[] | |
| chunk_source | string | `linked` \| `similarity_fallback` \| `random_fallback` |
| chunk_similarity_scores | float[] | |
| items_requested | int | |
| items_returned | int | |
| items_persisted | int | |
| rejection_reasons | JSONB | `[{"index":2,"reason":"missing_correct_option"}]` |

### Schema files

- `migrations/020_add_generation_audit_tables.sql` — DDL for all 5 tables, indexes, FKs
- Register models in `SetupModels` `db.AutoMigrate(...)` block in `application/providers.go`

---

## 2. Langfuse client (in-house, thin)

New file: `infrastructure/langfuse_client.go`. Mirrors the `infrastructure/openai.go` pattern.

```go
type LangfuseClient struct {
    httpClient *http.Client
    host       string
    publicKey  string
    secretKey  string
    enabled    bool
    queue      chan langfuseEvent
    flushEvery time.Duration
    redactor   *PHIRedactor  // applied before every flush
}
```

Public API:

```go
StartTrace(ctx, TraceInput{Name, SessionID, UserID, TenantID, Tags, Metadata}) (traceID string, err error)
StartSpan(ctx, SpanInput{TraceID, ParentID, Name, Input, Metadata}) (spanID string, err error)
EndSpan(ctx, SpanID, EndSpanInput{Output, StatusMessage, Level, EndTime}) error
RecordGeneration(ctx, GenerationInput{TraceID, ParentID, Name, Model, ModelParams, Prompt, Completion, Usage{...}, StartTime, EndTime}) (id string, err error)
RecordScore(ctx, ScoreInput{TraceID, Name, Value, Comment}) error
Flush(ctx) error
```

**Internals:**

Single `POST /api/public/ingestion` with batched envelope `{batch: [{id, type, timestamp, body}, ...]}`, Basic auth `Authorization: Basic base64(publicKey:secretKey)`.

Event types: `trace-create`, `span-create`, `span-update`, `generation-create`, `generation-update`, `score-create`.

Async background flusher: events enqueued, flushed every 2s or at 50-event batch threshold. Registered via `fx.Lifecycle.OnStop` alongside `UploadWorker`.

**Backpressure:** bounded queue; on overflow, drop oldest + increment a counter (logged once per minute). Lineage tables are the source of truth; Langfuse is the rich-detail viewer.

---

## 3. PHI redactor

New file: `infrastructure/phi_redactor.go`.

The `PHIRedactor` is constructed once at startup and injected into `LangfuseClient`. It is applied as a pre-flush step to every event payload before it leaves the process — the local Postgres rows always store the full unredacted content.

```go
type PHIRedactor struct {
    // Key-name based rules: field names matching these keys have their values masked
    // regardless of payload size. Configurable via AUDIT_REDACT_KEYS env var (comma-separated).
    // Defaults cover common PHI field names:
    //   patient_name, patient_id, dob, date_of_birth, ssn, mrn, npi,
    //   email, phone, address, first_name, last_name
    sensitiveKeys []string

    // Regex rules: values matching these patterns are replaced inline with [REDACTED].
    // Configurable via AUDIT_REDACT_PATTERNS env var (semicolon-separated regex strings).
    // Defaults cover:
    //   US SSN: \b\d{3}-\d{2}-\d{4}\b
    //   MRN-like: \bMRN[:\s]?\d{6,10}\b
    //   Email addresses: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}
    //   US phone numbers: \b(\+1[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}\b
    patterns []*regexp.Regexp

    // Size cap: prompt/completion bodies larger than this are truncated and
    // replaced with a summary + DB pointer. Applied after key/pattern redaction.
    // Configurable via LANGFUSE_MAX_PAYLOAD_BYTES (default 100000).
    maxPayloadBytes int
}

// RedactEvent applies all rules to a langfuseEvent before it is queued for export.
// Returns a new event; never mutates the original (the original is what gets written to Postgres).
func (r *PHIRedactor) RedactEvent(e langfuseEvent) langfuseEvent
```

**Redaction precedence** (applied in order):

1. **Key-name masking** — walk the event payload JSON. Any field whose key matches `sensitiveKeys` (case-insensitive) has its value replaced with `"[REDACTED]"` regardless of content or size.
2. **Pattern replacement** — apply each compiled regex to all string values in the payload. Matches replaced with `"[REDACTED]"`.
3. **Size cap** — after steps 1–2, if `prompt` or `completion` body exceeds `maxPayloadBytes`, truncate and append `"…[truncated; full content in audit DB run_id=<id>]"`.

**Configuration env vars** (added alongside Langfuse vars in `SetupServices`):

| var | default | purpose |
|---|---|---|
| `AUDIT_REDACT_KEYS` | see above defaults | comma-separated field name list |
| `AUDIT_REDACT_PATTERNS` | see above defaults | semicolon-separated regex strings |
| `LANGFUSE_MAX_PAYLOAD_BYTES` | `100000` | size cap after key/pattern redaction |

**What lives where:**

- Postgres `generation_run` and all lineage tables: **full unredacted** content always. These rows are only accessible via the superadmin API and direct DB access.
- Langfuse export: redacted payload produced by `PHIRedactor.RedactEvent`. Langfuse is treated as a potentially less-controlled surface (third-party hosted option, broader viewer access) and therefore receives the cleaned version.

---

## 4. AuditService — the single pipeline seam

New file: `infrastructure/audit_service.go`.

```go
type AuditService struct {
    DB       *gorm.DB
    Langfuse *LangfuseClient  // redaction applied inside LangfuseClient before flush
}

// Stage lifecycle
BeginSession(ctx, BeginSessionInput) (*SessionAudit, error)
EndSession(ctx, sessionID, EndSessionInput) error
BeginRun(ctx, BeginRunInput) (*GenerationRun, error)
EndRun(ctx, runID, EndRunInput) error

// Selection capture
RecordLOSelection(ctx, sessionID, []LOSelectionReason) error
RecordLOGeneration(ctx, LOGenerationInput) error

// Lineage edges
RecordLineage(ctx, parentType, parentID, childType, childID, runID, metadata) error
RecordLineageBatch(ctx, []LineageEdge) error

// Doctor annotation (superadmin-initiated)
RecordScore(ctx, traceID, name, value, comment) error
```

Wired into `ContentGenerationService` as a new field; constructed in `SetupServices` alongside existing client setup.

---

## 5. Refactor — LO selection returns reasons

Touched files:

**`infrastructure/study_plan_item_service.go`**

- `StudyPlanLOInfo` (line 17) — add optional `SelectionReason *LOSelectionReason`.
- `ListWeakStudyPlanLOsWithSourceScope` (~line 289) — expose `Accuracy`, `AttemptsCount`, `LastSeenAt` already computed in SQL but currently discarded.

```go
type LOSelectionReason struct {
    Strategy         string     // "weak" | "random_fill" | "internal_reused" | "fallback"
    Accuracy         *float64
    AttemptsCount    *int
    LastSeenAt       *time.Time
    ScopeMatchReason string     // "upload:abc", "exam:USMLE", "unscoped"
    Notes            string
}
```

**`infrastructure/content_generation_service.go`**

- `selectStudyPlanSessionLOsWithSourceScope` (line 2301) — populate `SelectionReason` for each LO during the two-phase pick. One production caller; minimal blast radius.
- `findWeakLOsWithSourceScope` (line 2763) and `weakLO` struct (line 2604) — extend with `AttemptsCount`, `LastSeenAt`.

~40 lines of net change across 2 files. Ships as a separate PR to keep the diff reviewable.

---

## 6. Pipeline instrumentation — exact injection points

Pattern per call site:

```go
run, _ := c.AuditService.BeginRun(ctx, BeginRunInput{Stage: "...", StudyPlanID, ..., PromptType, PromptHash, Model})
out, err := ... existing AI call ...
c.AuditService.EndRun(ctx, run.ID, EndRunInput{Status: ..., InputTokens, OutputTokens, ErrorCode})
c.AuditService.RecordLineageBatch(ctx, edges)
```

**Upload → chunking** (`content_generation_service.go:559`): one `BeginRun(stage=upload_chunking)` per upload; per embedding batch records sub-run with model, token counts, latency; lineage `upload → chunk` edges written at persistence (line 1599).

**LO extraction** (`content_generation_service.go:1786`): separate `BeginRun` for map and reduce phases; `RecordGeneration` to Langfuse with prompt + JSON response (subject to `PHIRedactor`); `chunk → learning_objective` lineage edges after `LinkLOToChunks`.

**Session generation** (`content_generation_service.go:705`): `BeginSession` right after claim → `RecordLOSelection` after `selectStudyPlanSessionLOsWithSourceScope` returns with reasons → per-LO `BeginRun(stage=item_generation)` inside `generateSessionItemsForWeakLO` → `RecordLOGeneration` with chunk IDs, similarity scores, rejection reasons → `learning_objective → item` lineage at `persistGeneratedSessionItems` → `EndSession` at `finalizeSessionGeneration` / `failSessionGeneration`.

**Fallback path** (random-chunks, ~line 2472): resolve or create one synthetic fallback learning objective per study plan, `BeginRun(stage=fallback_items)` against that LO, record a `session_lo_generations` row with `chunk_source=random_fallback`, then persist normal `learning_objective → item` lineage for the fallback items. This keeps random fallback content visible in both session audit details and `item.lineage` instead of leaving those batches LO-less.

All Langfuse spans for a session use the root trace ID from `BeginSession`, producing a single browsable tree in Langfuse.

---

## 7. REST audit endpoints

### Auth & tenancy

All endpoints are registered under `/superadmin/audit/study-plans/` and gated by a new `rest.ROLE == "superadmin"` check (or the equivalent existing superadmin gate — use whatever role constant the codebase already has for cross-tenant admin access). **No `tenant_id` filter is applied** — superadmins see all tenants' data. The `tenant_id` column on each table is returned in responses as a display field so the operator knows which tenant a record belongs to.

Cross-tenant isolation test (required): a request authenticated as a regular `Administrator` role must receive `403` on every audit endpoint, regardless of which resource ID is provided.

### Endpoint definitions

**`STUDY_PLAN_AUDIT_VIEW` → `GET /superadmin/audit/study-plans/:id/audit`**

Returns counts + summary for the study plan across all associated tenants: uploads, LOs, items, sessions; per-stage success/failure rates. Response includes `tenant_id` on each row for operator visibility.

**`UPLOAD_AUDIT_VIEW` → `GET /superadmin/audit/study-plans/uploads/:id/audit`**

Chunk count, extraction runs (with Langfuse links), extracted LOs with chunk provenance.

**`SESSION_AUDIT_VIEW` → `GET /superadmin/audit/study-plans/sessions/:id/audit`**

Full doctor-facing tree. Joins `session_generation_audit` + `session_lo_selection` + `session_lo_generation` + `generation_run` + LO/Item names.

```json
{
  "tenant_id": "tenant_abc",
  "session": { "id", "mode", "source_scope", "langfuse_trace_url" },
  "selection": { "strategy", "candidate_pool_size", "los": [{...reason...}] },
  "los": [{
    "id", "title",
    "chunks_used": [{ "id", "source_file", "snippet" }],
    "runs": [{ "stage", "prompt_type", "model", "langfuse_span_url", "items_requested", "items_returned" }],
    "items": [{ "id", "type", "stem_or_question_or_front" }]
  }],
  "totals": { "items_generated", "items_persisted", "block_id", "status" }
}
```

**`ITEM_LINEAGE_VIEW` → `GET /superadmin/audit/study-plans/items/:id/lineage`**

Reverse traversal: item → LO → chunks → upload + the `generation_run` that produced it. Includes `tenant_id`.

**`LO_LINEAGE_VIEW` → `GET /superadmin/audit/study-plans/learning-objectives/:id/lineage`**

LO → all source chunks across uploads + all items derived from it. Includes `tenant_id`.

**`SESSION_AUDIT_SCORE` → `POST /superadmin/audit/study-plans/sessions/:id/score`**

Superadmin annotation pass-through. Body: `{lo_id?, item_id?, value: "good"|"bad", comment}`. Writes to Langfuse via `RecordScore` and to a new `audit_score` table.

`langfuse_trace_url` / `langfuse_span_url` are constructed server-side as `LANGFUSE_HOST/trace/{id}`.

---

## 8. Configuration & env vars

| var | default | purpose |
|---|---|---|
| `LANGFUSE_HOST` | `""` | self-hosted Langfuse base URL; empty = disabled |
| `LANGFUSE_PUBLIC_KEY` | `""` | from Langfuse project settings |
| `LANGFUSE_SECRET_KEY` | `""` | from Langfuse project settings |
| `LANGFUSE_FLUSH_INTERVAL_MS` | `2000` | background flush cadence |
| `LANGFUSE_BATCH_SIZE` | `50` | max events per POST |
| `LANGFUSE_MAX_PAYLOAD_BYTES` | `100000` | size cap applied after key/pattern redaction |
| `LANGFUSE_QUEUE_SIZE` | `1000` | bounded backpressure queue |
| `AUDIT_ENABLED` | `true` | master switch; `false` = AuditService is a no-op (DB rows skipped too) |
| `AUDIT_LINEAGE_EDGE_BATCH` | `200` | row insert batch size for `generation_lineage` |
| `AUDIT_REDACT_KEYS` | see §3 defaults | comma-separated PHI field names to mask |
| `AUDIT_REDACT_PATTERNS` | see §3 defaults | semicolon-separated regex strings for inline replacement |

When `AUDIT_ENABLED=true` and Langfuse keys are missing → DB lineage still recorded, Langfuse calls become no-ops.

---

## 9. Migration & rollout order

1. Land schema + `AuditService` skeleton + `LangfuseClient` + `PHIRedactor` behind `AUDIT_ENABLED=false` — zero pipeline changes. CI green.
2. Wire `AuditService` into pipeline and add REST endpoints (read-only, no risk), keeping `AUDIT_ENABLED=false` default. Code review without behavioral change in prod.
3. Refactor LO selection to return reasons — separate PR. Verify all existing call sites still compile and existing tests pass.
4. Enable `AUDIT_ENABLED=true` in staging without Langfuse keys — verifies the DB-only path under load.
5. Provision self-hosted Langfuse + set keys — spans start flowing. Verify PHI redaction on a synthetic session with seeded PII before opening Langfuse access to any viewer.
6. Doctor onboarding — frontend team consumes `/superadmin/audit/sessions/:id/audit` and the Langfuse UI.

No backfill of historical sessions is in scope.

---

## 10. Testing

**`PHIRedactor` unit tests:**
- Key-name masking: payload with `patient_name`, `email`, `ssn` fields → all values replaced with `"[REDACTED]"`.
- Pattern replacement: SSN pattern `123-45-6789` in a free-text prompt body → replaced inline.
- Size cap: prompt body at 1.5× `maxPayloadBytes` → truncated with DB pointer suffix.
- Combined: field named `patient_id` with value matching MRN pattern → key-name rule fires first, value already masked before pattern pass.
- Custom env override: `AUDIT_REDACT_KEYS=custom_field` → only `custom_field` is masked; built-in defaults are replaced (not merged), so document this clearly.
- Postgres rows: assert that the pre-redaction original is what gets written to `generation_run`; the redacted copy is what gets queued for Langfuse.

**`LangfuseClient` unit tests:** stub HTTP server, verify batch format, Basic auth header, batching threshold, queue overflow drop behavior, no-op when keys missing.

**`AuditService` unit tests:** SQLite in-memory, assert lineage rows written, mock Langfuse client.

**Integration test for session audit:** drives `executeProcessSessionGeneration` with stubbed OpenAI returning canned items, asserts `session_generation_audit`, `session_lo_selection`, `session_lo_generation`, `generation_lineage` chain, `generation_run` token counts.

**HTTP endpoint tests:**
- `superadmin` role → `200` with correct response shape on all 6 endpoints.
- `Administrator` role → `403` on every audit endpoint regardless of resource ID. This is the cross-tenant isolation test.
- Unauthenticated → `401`.
- Valid `superadmin` request for a resource belonging to a different tenant than the caller's own account → `200` (superadmins see all tenants).

**Backpressure test:** synthetic load pushing > `LANGFUSE_QUEUE_SIZE` events/sec — confirm drops are counted in logs, pipeline does not block, DB lineage remains complete.

---

## 11. Critical files modified/added

**Added:**
- `infrastructure/langfuse_client.go`
- `infrastructure/phi_redactor.go`
- `infrastructure/audit_service.go`
- `infrastructure/audit_models.go`
- `migrations/020_add_generation_audit_tables.sql`

**Modified:**
- `infrastructure/content_generation_service.go` — add `AuditService` field, instrument the 6 injection points
- `infrastructure/study_plan_item_service.go` — extend `StudyPlanLOInfo` / `StudyPlanWeakLOInfo` with selection-reason fields
- `application/providers.go` — `SetupServices` constructs `PHIRedactor` → `LangfuseClient` → `AuditService`; `SetupModels` adds 5 new models; `SetupBackgroundWorkers` registers `LangfuseFlusher`; `SetupControllers` registers the 6 new superadmin controllers
- `application/controllers.go` — 6 new handlers under `/superadmin/audit/`

**Reused unchanged:**
- `compactGenerationErrorCode` for `error_code`
- `domain.PromptType*` constants for `prompt_type`
- `domain.SessionGenerationStep*` constants
- SQLite in-memory test harness
- Worker lifecycle pattern from `UploadWorker` / `SessionGenerationWorker`

---

## 12. Verification

1. **Build:** `go build ./...` and `go test ./infrastructure/... ./application/...`.
2. **Schema:** `\dt` shows 5 new tables; `\d generation_run` shows expected columns + indexes.
3. **Disabled-state safety:** `AUDIT_ENABLED=false`, run upload + session end-to-end → zero rows in new tables, no Langfuse calls.
4. **DB-only mode:** `AUDIT_ENABLED=true`, Langfuse keys empty → all lineage rows populated correctly.
5. **PHI redaction verification:** seed a session with a prompt containing a synthetic SSN (`000-00-0000`) and a field named `patient_id`. Confirm: (a) Postgres `generation_run` stores the unredacted content; (b) Langfuse export contains `[REDACTED]` in both positions.
6. **Full mode:** Langfuse keys set → single trace per session with nested spans; prompt bodies visible or scrubbed-with-pointer for large ones.
7. **Auth enforcement:** `GET /superadmin/audit/sessions/:id/audit` as `Administrator` → `403`; as `superadmin` for a resource owned by a different tenant → `200` with `tenant_id` visible in response.
8. **Backpressure:** load test confirms drops logged, pipeline unblocked, DB lineage complete.
