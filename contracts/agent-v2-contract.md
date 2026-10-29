# Agent v2 API Contract

Service: **AGENT_V2** (`VITE_AGENT_V2_API_URL`)
Consumers:
- course resources: `services/agentV2Service.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx`
- Sina skills (superadmin): `services/tutorSkillsService.ts` (`/v1/admin/skills`)
- **faculty Ask** (Dean Inquire, DSH-1): `services/facultyChatClient.ts` and its modules
  (`facultyChatWire.ts`, `facultyChatSse.ts`, `facultyChatErrors.ts`, `facultyChatContext.ts`,
  `facultyChatReducer.ts`, `facultyChatController.ts`), `hooks/useFacultyChat.ts`

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
DSH-1). A **tenant admin or owner** (IAM `tenant_role` `admin` | `owner`, whose
tenant is on the agent's `FACULTY_TENANTS`) asks questions about their own
institution; the agent answers from tenant-scoped database views. The tenant is
taken from the bearer and enforced in the database; nothing the dashboard sends
can widen it.

**Wire shapes** are mirrored from agent-v2's `@medai/contracts` 0.108.0
(`origin/test` af0de254) in `services/facultyChatWire.ts`, which holds only the
fields this dashboard reads. **Pending agent-v2 work (FAG-1, wave 1):** the
`faculty` value of `surface`, the `?surface=faculty` filter, the 403/409/429
refusals and `threads.surface`. Before FAG-1 is deployed, `POST /v1/turns`
answers `400 invalid_surface` and `GET /v1/threads` ignores `surface` and lists
the caller's learner threads too.

### `POST /v1/turns` — ask

```jsonc
// request
{
  "message": "Which Year 2 students need attention?\n\n<dashboard_context>{\"cohortId\":\"c_123\"}</dashboard_context>",
  "surface": "faculty",
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

- `message` is at most 32,000 characters and must not be blank.
- **Never sent:** `userId`, `origin`, `voiceSessionId` (refused on presence under a
  user token), attachments, `research`, `clinicalContext`.
- **Page context has no field** on this route (`clinicalContext` is the clinic's
  patient identifier only). "Ask about this cohort" therefore folds it into
  `message` as a trailer after the question:
  `\n\n<dashboard_context>{"cohortId":…,"cohortName":…,"page":…}</dashboard_context>`.
  Keys are optional strings of at most 200 characters; `<` is escaped as `<`
  inside the JSON. It sits after the question so the thread title still starts with
  the dean's words, and `facultyChatContext.ts` splits it back off a transcript.
  It is a hint, never an authorisation. The faculty prompt (FAG-6) should say what
  the block is.
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
| `faculty.table`, `faculty.chart` | **TODO(wave 2, FAG-5):** full query rows and a validated chart spec, UI-only. Shapes not on the wire yet; folded as no-ops |

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

### Errors

The body is always `{ "error": { "code": "…", "message": "…" } }`. The dashboard
switches on the **status** (codes from FAG-1 may still change) and keeps `code`
for logs. `FacultyChatError.kind` (`facultyChatErrors.ts`):

| Status | `kind` | When |
|---|---|---|
| 401 `unauthorized` | `unauthorized` | the agent rejects the token. **Not a logout** (AGENT_V2 is not session-owning) |
| 403 `faculty_forbidden` | `forbidden` | not a tenant admin/owner, tenant not on `FACULTY_TENANTS`, or faculty disabled |
| 409 (FAG-1) | `surface_mismatch` | the `threadId` belongs to another surface (a learner chat) |
| 429 (FAG-1) | `daily_cap` | the tenant's `FACULTY_DAILY_TURN_CAP` (default 200/day, D12) |
| 402 `prompt_limit_reached` | `daily_cap` | a learner prompt limit; faculty turns should never meet one (D12) |
| 404 | `not_found` | turn or thread not the caller's |
| 400 / 413 / 415 / 422 | `invalid_request` | malformed, too long, `invalid_surface` before FAG-1 |
| 5xx | `unavailable` | retryable |
| no response | `network` | offline, DNS, or a CORS refusal. Retryable |
| — | `stream_lost` | the stream could not be reopened |
| — | `turn_failed` | `turn.failed` on the stream; `code` is the stream error's |

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
