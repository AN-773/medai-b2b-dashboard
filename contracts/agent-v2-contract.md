# Agent v2 API Contract

Service: **AGENT_V2** (`VITE_AGENT_V2_API_URL`)
Consumers:
- course resources: `services/agentV2Service.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx`
- Sina skills (superadmin): `services/tutorSkillsService.ts` (`/v1/admin/skills`)
- **faculty Ask** (Dean Inquire, DSH-1/2/3): `services/facultyChatClient.ts` and its modules
  (`facultyChatWire.ts`, `facultyChatSse.ts`, `facultyChatErrors.ts`, `facultyChatContext.ts`,
  `facultyChatReducer.ts`, `facultyChatController.ts`), `hooks/useFacultyChat.ts`,
  `hooks/useFacultyThreads.ts`, `views/AskView.tsx`, `components/ask/*`

The tutor agent. It holds **knowledge bases** — collections of ingested documents
that a learner's tutor can search — and the ingestion pipeline behind them is
what decides which course resources are usable by the product at all. Since
Dean Inquire it is also where a tenant admin or owner **asks about their own
institution's data** (`surface: "faculty"`, see [Faculty Ask](#faculty-ask-surface-faculty)).

**This service is optional.** A deployment with no `VITE_AGENT_V2_API_URL` has no
agent; `agentV2Service.isConfigured()` is the only gate, and every surface that
depends on the agent reads it rather than the variable.

---

## Auth

Same IAM as the dashboard (`IAM_ISSUER_URL` on the agent = `VITE_IAM_API_URL`
here), so the `msai_educator_token` this app already holds is a valid credential
— sent automatically by `apiClient`. The faculty stream, which is read with
`fetch` rather than axios, sends the same bearer (`readAuthToken()` in
`apiClient.ts`). Under a user token the agent takes the user and tenant from the
token; a body or query that names a `userId` is refused, so the dashboard never
sends one.

`AGENT_V2` is deliberately **not** in `SESSION_OWNING_SERVICES`: the agent
verifies against its own configured issuer and audience, so a deployment pointed
at a different IAM answers `401` to a session that is valid here, and logging the
teacher out over that would present a deployment error as an expired session.

## CORS

Every route this dashboard calls here is a cross-origin browser request, so the
site's origin must be in the agent's `API_CORS_ORIGINS` (an exact-match list, no
wildcard). As of infra `main` 202dfd5:

| Origin | Agent environment | Where it is set |
|--------|-------------------|-----------------|
| `https://university.medicalstudent.ai` (`--mode university`) | prod | `aws/compute/api-env.prod.tfvars:52` |
| `https://dashboard.medicalstudent.ai` (`--mode dashboard`) | TEST (also listed on prod) | `aws/compute/api-env.test.auto.tfvars:32`, `api-env.prod.tfvars:52` |
| `http://localhost:5173` (`pnpm run dev`) | TEST only | `api-env.test.auto.tfvars:32` |

Each site talks to its own agent (`.env.university` → prod, `.env.dashboard` →
TEST), and each is on that agent's list. The older Azure Static Web App hosts are
no longer on either list.

**Preflight.** The faculty routes send `Authorization`, `Content-Type` (JSON
POSTs) and `Last-Event-ID` (stream resume). agent-v2's CORS middleware
(`apps/api/src/cors.ts`, Hono `cors()` with no `allowHeaders`) reflects whatever
`Access-Control-Request-Headers` the preflight names, and allows `GET`, `POST`,
`PUT`, `DELETE`, so no server change is needed for these headers. The dashboard
reads no response headers (so `Retry-After` on a 429 is not readable; it is not
in `Access-Control-Expose-Headers`).

**No CORS rule on the agent's storage account is needed**: the dashboard never
uploads bytes to the agent (see *Not called from this dashboard* below).

**While the origin is missing** the browser refuses the response,
`getCorpusUploadFormats` returns `null`, and the panel degrades rather than
breaks:

- the picker skips the format check and sets no `accept` attribute;
- the 150 MB ceiling still applies, because it is a constant here;
- the Tests service's own eligibility check is the gate — a file the agent cannot
  read is still stored as a course resource, and its `knowledgeBase.status` comes
  back `ineligible` with `reason: 'format'` (see
  `contracts/course-resources-contract.md`, Contract T1).

---

## `GET /v1/documents/formats`

What an upload may be. Takes nothing — no `userId`, no query — and answers the
same bytes for every caller. It is a statement about the protocol, cacheable for
the life of a release.

```jsonc
// 200
{
  "session": { "scope": "session", "formats": [ /* chat attachments */ ] },
  "corpus":  { "scope": "corpus",  "formats": [ /* knowledge-base ingestion */ ] }
}
```

Each entry:

```jsonc
{
  "format": "pdf",                       // the agent's own name for it
  "mediaTypes": ["application/pdf"],     // canonical first, lower-case, no parameters
  "suffixes": [".pdf"]                   // leading dot, lower-case
}
```

**Read `corpus`, never `session`.** Course resources are knowledge-base material.
The two lists hold the same formats today and are governed separately — a format
added to one does not join the other until somebody decides — so a client that
read one for the other would offer files the other path refuses.

**Do not hardcode this list.** The route exists because two Nuxt clients each
kept their own copy, one offering `.doc` and `.xls` that the parser has never
read, so a person could pick a file the picker approved of and be told `415`
after spending the upload. `services/agentV2Service.ts` fetches it and returns
`null` when it cannot — *unknown*, which is not the same as an empty list, and
callers must stay permissive rather than narrow on a guess.

Today's `corpus` formats: `pdf`, `docx`, `pptx`, `xlsx`, `html`, `image`, `csv`,
`ppt`. **No video, no audio, no plain text, no archives.**

A picker built from this list may still offer a file a *particular instance*
refuses: `image` needs a vision model and `ppt` needs LibreOffice, and no route
publishes whether an instance has either. The upload's own `415` is the answer.

## Upload ceiling

**150 MiB** (`AGENT_MAX_UPLOAD_BYTES`), mirroring the agent's
`API_MAX_UPLOAD_BYTES` default and the Document Service ceiling behind it.

**No route publishes this number**, so it is a constant in
`services/agentV2Service.ts`. A deployment that raises its own ceiling makes ours
wrong in the safe direction — the dashboard refuses a file the agent would have
taken, and the upload's `413` remains the real answer.

---

## Faculty Ask (`surface: "faculty"`)

Dean Inquire v1 (`PLAN_dean-inquire-v1.md` at the workspace root, §3.1, §3.6,
DSH-1 to DSH-3). A **tenant admin or owner** (IAM `tenant_role` `admin` | `owner`, whose
tenant is on the agent's `FACULTY_TENANTS`) asks questions about their own
institution; the agent answers from tenant-scoped database views. The tenant is
taken from the bearer and enforced in the database; nothing the dashboard sends
can widen it.

**Wire shapes** are mirrored from agent-v2's `@medai/contracts` 0.112.0 in
`services/facultyChatWire.ts`, which holds only the fields this dashboard reads. **Pending agent-v2 work (FAG-1, wave 1):** the
`faculty` value of `surface`, the `?surface=faculty` filter, the faculty
refusals (see [Errors](#errors)) and `threads.surface`. Before FAG-1 is deployed, `POST /v1/turns`
answers `400 invalid_surface` and `GET /v1/threads` ignores `surface` and lists
the caller's learner threads too.

**Pending agent-v2 work (FAG-5, wave 2):** `facultyContext` on `POST /v1/turns`,
the `faculty.table` and `faculty.chart` events, `facultyResults` on transcript
rows and `POST /v1/faculty/feedback`. These mirror
`packages/contracts/src/faculty/results.ts` on `dean/w2-query`: mirror any change
there into `facultyChatWire.ts`. The dashboard and FAG-5 ship together: the agent
refuses a field it does not know, so a dashboard ahead of FAG-5 would have its
`facultyContext` refused.

### `POST /v1/turns` — ask

```jsonc
// request
{
  "message": "Which Year 2 students need attention?",
  "surface": "faculty",
  "facultyContext": { "cohortId": "c_123", "page": "cohort" },  // only when asked from a page
  "threadId": "…",        // omitted for a new conversation; ≤ 200 chars
  "operationId": "uuid"   // chosen by the client so a retried POST is the same turn
}
// 202
{
  "operationId": "uuid",
  "threadId": "…",        // the new conversation's id when none was sent
  "created": true,        // false: this operationId was already accepted (a retry)
  "stream": "/v1/turns/<operationId>/stream",
  "cancel": "/v1/turns/<operationId>/cancel",
  "approvals": "/v1/turns/<operationId>/approvals"
}
```

- `message` is at most 32,000 characters and must not be blank. It holds the
  dean's words and nothing else.
- **Never sent:** `userId`, `origin`, `voiceSessionId` (refused on presence under a
  user token), attachments, `research`, `clinicalContext`.
- **`facultyContext`** says where the question was asked from ("Ask about this
  cohort"). Both keys are optional strings of at most 200 characters; the field is
  omitted when neither is set. `cohortId` is the cohort's `id` as the Tests service
  returns it, `page` is `cohort` or `mastery`.
  **Identifiers only:** no display name is sent, because free text there is prompt
  text the dean did not type; the agent resolves the cohort from its id. It is a
  hint, never an authorisation: the dean could type the same thing. The Ask page
  reads it from its URL, which anyone can write, so `pageContextFrom` drops a
  `cohortId` that does not look like an id and a `page` it does not know. The agent
  should still treat both as data.
- **The `<dashboard_context>` trailer is retired.** DSH-1 folded this context into
  `message`; since FAG-5 nothing writes it. `splitFoldedContext` and `threadTitleOf`
  stay, to read a thread written that way.
- `202` means queued, not answered: the answer is on the stream.

### `GET /v1/turns/:operationId/stream` — the answer, as SSE

Read with `fetch` (an `EventSource` cannot send the bearer). Headers:
`Authorization`, `Accept: text/event-stream`, and `Last-Event-ID: <seq>` on a resume.

- Frames: `id: <seq>`, `event: <type>`, `data: <the whole event as JSON>`, blank line.
  `seq` is dense from 0 within a turn and is the resume cursor. The stream opens
  with a `: stream open` comment.
- **Resume:** with `Last-Event-ID: n` the server replays from `n + 1`; without it,
  from the start. A cursor it cannot read costs a replay from the start, not an error.
- **Ending:** a turn ends exactly once, with `turn.completed { reason }` (`completed`,
  `cancelled`, `budget_exceeded`, `step_limit_exceeded`) or `turn.failed { error:
  { code, message, retryable } }`, and the server closes the body after it. A body
  that closes **without** one of those is a dropped connection, never an ending.
- **Heartbeat:** `stream.heartbeat` after 15 s of quiet. It is a numbered event and
  moves the cursor.
- **Unknown event types** are ignorable, never fatal; their `seq` still counts.
- `404 turn_not_found` (before the stream opens) for a turn that is not the
  caller's or does not exist.

Events the faculty reducer folds (`facultyChatReducer.ts`):

| Event | Effect |
|---|---|
| `turn.started` | sets the thread id when the state has none |
| `message.started` | opens a message; **repeated for a known id it means discard that message and begin again** (a retried super-step) |
| `text.delta` | appends text to its `messageId` |
| `message.completed` | closes it with `reason`: `complete`, `tool_calls`, `interrupted` (a prefix — show it as cut off), `empty` |
| `tool.started` / `tool.settled` | a visible step: tool name → label, then `ok` → succeeded/failed. Arguments and results are not on the wire |
| `turn.paused` / `turn.resumed` / `approval.requested` | parked; faculty tools should never need an approval and the dashboard cannot give one |
| `suggestions.offered` | follow-up questions (FAG-1 turns them off for faculty) |
| `turn.completed` / `turn.failed` | the ending; anything still open is closed `interrupted` |
| `step.*`, `reasoning.delta`, `usage.updated`, `stream.heartbeat`, `tool.progress` | cursor only |
| `faculty.table` | adds one query's full result to the turn; a query step still running takes its `purpose` as its label |
| `faculty.chart` | adds one chart to the turn |

**`faculty.table`**, one per query, UI-only (the model sees a preview):

```jsonc
{
  "type": "faculty.table", "seq": 7, "operationId": "uuid", "at": "…",
  "queryId": "q_1",
  "purpose": "Checking readiness snapshot",  // the question as the agent understood it
  "explanation": "Readiness multiplies mastery, coverage and pacing. …",  // by the model, ~600 characters at most
  "sql": "SELECT …",
  "columns": [{ "name": "name", "dataType": "text" }],
  "rows": [{ "name": "Sara", "readiness": 0.31 }],  // full rows, at most 500
  "rowCount": 42,   // how many rows are in `rows`, not how many the query matched
  "truncated": false,  // true: the query matched more rows than `rows` holds
  "durationMs": 118,
  "asOf": [{ "kind": "readiness", "computedAt": "2026-10-29T02:00:00Z" }]  // [] when every source is live
}
```

`explanation` is required and is the model's own account of the query: the metrics
it used and what the query does, in plain words. The "How this was computed" panel
shows it above the SQL. It is the only place for this, because the model no longer
writes a closing section into the answer.

**`faculty.chart`**, one per `showChart`. No code, only a spec and its rows:

```jsonc
{
  "type": "faculty.chart", "seq": 9, "operationId": "uuid", "at": "…",
  "chartId": "c_1",
  "queryId": "q_1",
  "chartType": "bar",   // bar | line | area | pie | kpi
  "x": "topic",
  "y": ["pct_correct"],
  "takeaway": "Renal is the weakest topic",
  "rows": [{ "topic": "Renal", "pct_correct": 41 }]
}
```

On the stream `type` is the event's own name, so the chart's type rides as
`chartType`. Everywhere else it is `type`: a stored chart in `facultyResults` says
`type`, and `parseFacultyChart` reads either.

The bodies are read defensively (`parseFacultyTable`, `parseFacultyChart`): a body
that does not fit is ignored like an unknown event. A table or chart re-sent under
the same id replaces the first. **Every value in `rows`, `columns`, `purpose`,
`explanation`, `takeaway` and `sql` is untrusted text**: database content or model output. It is
rendered as text, never as HTML, and a CSV export neutralises spreadsheet formulas
(`neutralizeCsvCell`).

Client behaviour (`facultyChatClient.ts` `streamTurn`):

- Reconnects on a body that ends without an ending, a body read error, a 45 s
  silence (three missed heartbeats), a network failure or a 5xx on reopen, each
  time from the last `id:` seen, after 0.5 s, 1 s, 2 s, 4 s, 8 s. A frame received
  resets the count; after five failures in a row it throws `stream_lost` (the turn
  may still be running; calling again with the last cursor picks it up).
- Does not retry `401`, `403` or `404`.
- An undecodable frame is reported (`malformed`) and skipped, and the cursor moves
  past it.
- Aborting stops reading only. **The turn keeps running** on the agent.

### `POST /v1/turns/:operationId/cancel` — stop

No body. `200`:

```jsonc
{ "operationId": "uuid", "cancelled": true, "status": "completed", "completionReason": "cancelled" }
```

A turn that had already ended is still a `200` (`cancelled: false`). The ending
also arrives on the stream as `turn.completed { reason: "cancelled" }`, with the
partial message closed `interrupted`.

### `GET /v1/threads?surface=faculty` — the dean's conversations

Query: `surface=faculty`, `limit` (1–200, default 50), `cursor` (the previous
page's `nextCursor`, opaque). Never `userId`.

```jsonc
// 200
{
  "threads": [{
    "threadId": "…", "title": "The opening question, truncated", "turnCount": 3,
    "createdAt": "…", "lastTurnAt": "…", "lastReplyAt": "…",
    "activeOperationId": "uuid",          // a turn still running: re-attach to its stream
    "activeTurnStatus": "running",        // queued | running | waiting_for_human | waiting_for_job | null
    "unread": false, "pinned": false, "mode": null
  }],
  "nextCursor": null,                     // null: the page was not full
  "watchCursor": "…"                      // for /v1/threads/watch, which this dashboard does not open
}
```

Faculty threads are private to the dean who wrote them (D9). From FAG-1 a
thread's surface is fixed by its first turn (`threads.surface`), this filter
returns only `faculty` threads, and the learner app's list excludes them.

### `GET /v1/threads/:threadId/messages` — one conversation

`200 { threadId, messages: TranscriptMessageView[] }`, in order. Rows are `user`,
`assistant` (with `finishReason` and `toolCalls`, the provider's
`[{ id, name, … }]`), `tool` (a call's result, by `toolCallId`) and `system`
(not shown). `404 thread_not_found` for a thread that is not the caller's. The
reducer rebuilds one turn per `operationId`; for a turn still running it keeps
only the question and replays the answer from the stream.

From FAG-5 the last assistant row of a faculty turn carries what the turn's stream
events did, so a reopened answer has its table and chart:

```jsonc
{ "facultyResults": { "tables": [ /* faculty.table bodies */ ], "charts": [ /* faculty.chart bodies, with `type` */ ] } }
```

### `POST /v1/faculty/feedback` — rate an answer or a flag

```jsonc
// request
{
  "operationId": "uuid",            // the turn being rated
  "queryId": "q_1",                 // optional: which result
  "learnerId": "…",                 // optional: which student
  "rating": "up",                   // up | down: the answer as a whole
  "flag": "incorrectly_flagged"     // useful | not_useful | incorrectly_flagged | fixed: one student
}
```

`200 { "recorded": true }`. Every field but `operationId` is optional, a body needs
a `rating` or a `flag`, an unknown key is refused, and `operationId` and `queryId`
are UUIDs (`400 invalid_faculty_feedback`). The dashboard sends `{ operationId, rating }` for the thumbs
under an answer, and `{ operationId, queryId, learnerId, flag }` on a student a
result marks as needing attention (`needs_attention` true, or `readiness` under the
dashboard's 0.4 when the query did not select it), which needs the query to have
selected `learner_id`. It does not offer `fixed` yet. A thread's history does not
say what was rated, so a reopened answer shows its buttons unset.

### Errors

agent-v2's body is `{ "error": { "code": "…", "message": "…" } }`.
`FacultyChatError.kind` (`facultyChatErrors.ts`) is decided by the **code first**
and by the status only as a generic fallback. A status alone cannot say who
refused: a 429 may be the tenant's cap or a WAF/CloudFront rate limit, and a 403
may be the faculty gate or an edge block page. So no faculty-specific kind is
ever inferred from a status.

By code (`FACULTY_ERROR_CODE_KINDS`):

| Code | Status | `kind` | When |
|---|---|---|---|
| `faculty_forbidden` | 403 | `forbidden` | not a tenant admin/owner, tenant not on `FACULTY_TENANTS`, or faculty disabled |
| `thread_surface_mismatch` | 409 | `surface_mismatch` | the `threadId` belongs to another surface (a learner chat) |
| `faculty_thread_tenant_mismatch` (or `thread_tenant_mismatch`; FAG-1 fix round, name not final) | 409 | `tenant_mismatch` | the thread belongs to another tenant than the token's |
| `faculty_daily_limit_reached` | 429 | `daily_cap` | the tenant's `FACULTY_DAILY_TURN_CAP` (default 200/day, D12) |
| `faculty_attachments_unavailable` (FAG-1 fix round) | 400 | `invalid_request` | the dashboard sends no attachments, so only a client bug reaches it |
| `faculty_voice_unavailable` | 400 | `invalid_request` | voice; not used here |
| `invalid_faculty_context` | 400 | `invalid_request` | a `facultyContext` the agent would not read: not a faculty turn, an unknown key, or a value that is not printable ASCII of at most 200 characters |
| `invalid_faculty_feedback` | 400 | `invalid_request` | a feedback body the agent would not read |
| `invalid_surface` | 400 | `not_configured` | this agent has no faculty surface yet (before FAG-1 is deployed) |
| `prompt_limit_reached` | 402 | `daily_cap` | a learner prompt limit; faculty turns should never meet one (D12) |
| `prompt_limit_unauthorized` / `unauthorized` | 401 | `unauthorized` | the agent rejects the token. **Not a logout** (AGENT_V2 is not session-owning) |
| `prompt_limits_unavailable` | 503 | `unavailable` | retryable |
| `turn_not_found` / `thread_not_found` | 404 | `not_found` | not the caller's, or does not exist |

By status, when the code is unknown or absent (`kindForStatus`):

| Status | `kind` |
|---|---|
| 401 | `unauthorized` |
| 403 | `forbidden` with an agent-v2 body; `unavailable` (retryable) without one |
| 404 | `not_found` |
| 400 / 413 / 415 / 422 | `invalid_request` |
| 429 | `rate_limited` (retryable after a wait; the stream retries it with backoff) |
| 5xx | `unavailable` (retryable) |
| 402, 409, anything else | `unknown` |
| no response | `network`: offline, DNS, or a CORS refusal (retryable) |
| — | `stream_lost`: the stream could not be reopened |
| — | `turn_failed`: `turn.failed` on the stream; `code` is the stream error's |

A new agent-v2 code with a meaning of its own for the dean is added to
`FACULTY_ERROR_CODE_KINDS`; until then it falls back by status.

### Not used by the faculty surface

`POST /v1/turns/:operationId/approvals`, `GET /v1/threads/watch`, read receipts,
pins, thread delete, `GET /v1/turns/:operationId/results/:toolCallId`, voice, and
every attachment and knowledge-base route.

---

## Not called from this dashboard — by decision

The dashboard **never** calls the agent's knowledge-base, upload or reader
routes: not `POST /v1/knowledge-bases`, not `POST /v1/uploads` or its commit, not
a `PUT` to an agent SAS URL, not `/v1/threads/:threadId/knowledge-bases`, not
`/v1/knowledge-bases/:id/readers`.

**Turn and thread routes: reversed for the faculty surface only (2026-10-30, Dean
Inquire DSH-1).** This section used to say the dashboard never calls thread
routes and to forbid porting the learner app's agent client. It now calls
`POST /v1/turns`, the turn stream and cancel, `GET /v1/threads` and
`GET /v1/threads/:threadId/messages` — **only with `surface: "faculty"`** (see
[Faculty Ask](#faculty-ask-surface-faculty)). It never starts or lists a learner
turn (`general`, `study`, `clinical`), and nothing above about course resources
changes. `services/facultyChatClient.ts` is a typed port of the learner app's
stream and resume logic (`mobile/medai-app/services/chat/agentV2/client.js`,
`sse.js`, `streamProtocol/v2Contract.js`), not a copy of that client.

Getting a course resource in front of a learner's tutor is the **Tests service's**
job, and it is the sole writer to the agent (`DECISION_shared-course-knowledge-base.md`
at the workspace root, which supersedes the browser dual-write in
`PLAN_course-resources-to-knowledge-base.md` §3):

- A teacher uploads once, to Tests. Tests ingests each eligible file **once per
  course** into a collection owned by the principal `/courses/<courseIdentifier>`,
  under the agent's **service token** — a credential that never reaches a browser.
- A teacher's own IAM token **cannot** write a course-owned collection: under the
  agent's acting-user rule (AUTH-9) a user token acts only as its own user
  (`/users/<ksuid>`), so naming `/courses/<id>` is refused.
- Learners are entitled by reader grants and thread links that Tests writes for
  cohort-generated study plans.

What the dashboard sees of all this comes from Tests, on `CourseResource.knowledgeBase`
and `POST /courses/{identifier}/resources/knowledge-base/sync` — see
`contracts/course-resources-contract.md`, Contracts T1–T3.
