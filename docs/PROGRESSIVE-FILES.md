# Progressive course files — dashboard implementation

Worktree: `wt-files-dashboard`, branch `feat/progressive-file-processing`.
Shared source: `../PROGRESSIVE_FILES_IMPLEMENTATION.md` (read before implementation,
and rechecked after the backend handoff). Repository guidance: `AGENTS.md` and `CLAUDE.md`.

## Implemented behavior

- Text readiness is independent of enrichment. `availability: 'text_ready'` shows
  **Text ready to chat**, including when enrichment fails or is cancelled. The
  stage, capabilities, warnings, and errors remain visible. Full extracted text
  does not imply that visual-only pages have been read; the UI discloses this.
- No pipeline percentages or locally invented completion. Counts are explicitly
  scoped to the named stage. Only valid backend totals produce a native, labelled
  progress element. Unknown totals display counts without a percentage; missing
  counters/units do not produce invented progress. Stages can reset their counters.
- Terminal means `completed`, `completed_with_warnings`, `failed`, or `cancelled`.
  A ready file with any other processing state continues polling. Future or malformed
  progress is not classified as terminal and does not enable speculative actions.
- Legacy `knowledgeBase` is still optional, and its status enum is unchanged.
  Missing processing uses the existing legacy status chip. Unknown legacy status
  still produces no legacy chip. Readers retain unknown additive fields.
- Connection failures retain the last snapshot and show **Connection stale**, not
  a processing failure. A worker heartbeat/update older than two minutes produces
  a separate “no recent worker update” explanation, never a failure or timeout.
- Polls are serial, every 15 seconds after the preceding read settles, with **no
  elapsed-time cutoff**. Individual HTTP reads/actions have a 30-second transport
  timeout; that does not stop processing or exhaust polling retries.
- Hidden/offline pages pause and abort their current read. Visibility, focus,
  `pageshow`, and online recovery trigger an immediate fresh read, including when
  the previously displayed rows were terminal. Page/course change and unmount clear
  timers/listeners and abort requests. Request generations fence late responses
  even if a transport ignores cancellation.
- Same-run sequence numbers must increase before replacing a snapshot. Duplicates,
  lower sequences, and missing progress cannot erase previously observed progress.
  New runs can restart at zero. Retired run IDs and older timestamps from other
  runs cannot replace the current run. The cache is per-course, in memory, and
  survives pagination only for the mounted course.
- Retry/cancel use the existing course/resource identity. The server's 202 snapshot
  is checked for matching course/resource, merged through the same sequence guard,
  then reconciled with a fresh list. An acknowledgment without an observable version
  change keeps polling rather than inventing a local queued/completed state.
- Retry is offered for cancelled work and retryable failed/warning work. Cancel is
  offered for queued/running/retrying work. The UI explains that cancelling enrichment
  preserves usable text. Buttons have per-request pending/error state and are cleaned
  up on resource/run/course changes. 403, 404/501, and 409 have actionable messages.
- Course Sync remains available when the tutor column is present, even if the current
  page contains only ready files. It applies to the whole course and never labels
  unfinished enrichment as complete. Progress/polling summaries describe the current
  page, not an invented course-wide total.
  Sync tracks pending updates only for legacy unsynced/failed files and progressive
  failed/warning snapshots with `error.retryable: true`. Cancelled work is resumed
  only by an explicit per-resource retry, matching the final Tests implementation.
- Uncertain action failures (lost response/transport or temporary server failure)
  trigger automatic reconciliation, even from a last-known terminal snapshot.
  Definite rejections refresh once without inventing new work or a completed action.
- Container-responsive cards/table account for the workbench sidebar, not just the
  viewport. Buttons have visible keyboard focus, row-specific accessible action names,
  stage/status announcements, labelled native progress, and readable inline errors.

## Exact backend contract

### Optional resource projection

```ts
type CourseResourceKnowledgeBaseStatus =
  | 'not_synced' | 'ineligible' | 'processing' | 'ready' | 'failed';

type CourseResourceKnowledgeBase = {
  status: CourseResourceKnowledgeBaseStatus;
  reason: 'format' | 'size' | null;
  errorCode: string | null;
  updatedAt: string | null;
  processing?: DocumentProcessing;
};

type DocumentProcessing = {
  runId: string;
  sequence: number;
  availability: 'unavailable' | 'text_ready';
  state: 'queued' | 'running' | 'retrying' | 'completed' |
         'completed_with_warnings' | 'failed' | 'cancelled';
  stage: 'queued' | 'extracting_text' | 'indexing_text' | 'ocr' |
         'extracting_structure' | 'extracting_images' | 'indexing_enrichment' | 'completed';
  completedUnits: number;
  totalUnits: number | null;
  unit: 'pages' | 'batches' | 'figures' | null;
  updatedAt: string;
  lastProgressAt: string | null;
  heartbeatAt: string | null;
  nextRetryAt: string | null;
  capabilities: { text: boolean; structure: boolean; images: boolean; ocr: boolean };
  warnings: string[];
  error: { code: string; message: string; retryable: boolean } | null;
};

// CourseResource keeps its other existing fields.
type ResourceProjection = { knowledgeBase?: CourseResourceKnowledgeBase };
```

All readiness comes from backend truth. Full raw/native text is extracted and indexed
before readiness; empty native-text scans need OCR first. Existing ready documents
can omit processing entirely. Enrichment failure does not require legacy `status` to
change from `ready`.

### Tests routes, prefixes, responses, and authentication

Paths below are **relative to the configured Tests API base URL**. The actual Tests
deployment uses `/local`; the existing `VITE_TEST_API_URL` includes that prefix. For
example, `http://127.0.0.1:5178/local` plus `/courses/...` produces
`http://127.0.0.1:5178/local/courses/...`. Do not append `/local` twice. No live
configuration was changed. The existing development fallback in `apiClient.ts`
remains unchanged; point the base URL at a correctly prefixed Tests deployment.

| Method and relative path | Response |
| --- | --- |
| `GET /courses/{courseIdentifier}/resources?limit=25&page={page}` | 200 `{ resources: CourseResource[], total: number, page: number }`; includes current processing after text readiness |
| `POST /courses/{courseIdentifier}/resources/{resourceIdentifier}/knowledge-base/retry` | 202 `CourseResourceKnowledgeProcessingResponse` below |
| `POST /courses/{courseIdentifier}/resources/{resourceIdentifier}/knowledge-base/cancel` | 202 same response |
| `POST /courses/{courseIdentifier}/resources/knowledge-base/sync` | 202 `{ courseId: string, queuedResources: number, queuedLinks: number }` |

```ts
interface CourseResourceKnowledgeProcessingResponse {
  courseId: string;
  resourceId: string;
  knowledgeBase: CourseResourceKnowledgeBase;
}
```

Retry/cancel and Sync have **no request body**. Identifiers use the existing final
path-segment convention, with new action path segments URI-encoded. The response
shape was verified against Tests' `application/course_knowledge_processing.go` and
`api.yaml`, including its latest persisted knowledge-base snapshot.

Requests go through `apiClient` with `service: 'TESTS'`. The existing educator token
is injected as `Authorization: Bearer …`; credentials are not placed in URLs. Tests
enforces course teacher/tenant-scoped administrator permissions and owns the agent
service credential. The dashboard does not call agent retry/cancel directly.

Retry/cancel error contract: 401 authentication; 403 teacher/admin authorization;
404 course/resource/document absent; 409 no controllable document or conflicting
action/update; 501 integration unavailable; 502 upstream transport/invalid response;
503 upstream rate limiting/temporary unavailability. Existing Tests 401 session
handling is retained. Errors never fabricate failed processing or erase ready text.

The shared agent `/v1/documents/:documentId/progress`, `/events` SSE, and
`/processing/{retry,cancel}` endpoints remain backend-facing for this UI. This
dashboard implements list polling, not SSE; Tests stays the course authority.

## Files

| File | Responsibility |
| --- | --- |
| `types/DocumentProcessing.ts` | Exact shared DTO and action union |
| `types/CourseResourceTypes.ts` | Optional processing, typed Tests 202 response, additive-field preservation |
| `services/courseResourceService.ts` | Typed retry/cancel, abortable list/Sync, request timeouts |
| `utils/documentProcessing.ts` | Defensive runtime view, predicates, counters, heartbeat, identity and run/sequence reconciliation |
| `utils/progressivePolling.ts` | Serial, cancellable, resumable polling controller with injectable clock |
| `hooks/useProgressiveCourseResources.ts` | React list state, visibility/network listeners, action snapshot reconciliation |
| `components/academy/course-workbench/ResourceProcessingStatus.tsx` | Progressive row UI and teacher actions |
| `components/academy/course-workbench/CourseResourcesPanel.tsx` | Integration, course scoping, Sync, connection state, responsive rows |
| `index.css` | Scoped container queries, keyboard focus, native progress styling |
| `contracts/course-resources-contract.md` | Additive contract cross-reference |
| `tests/progressive-files.test.ts` | Deterministic Node tests |
| `tests/progressive-files.browser.mjs` | Playwright harness function with intercepted local APIs |
| `scripts/test-progressive-files.mjs` | TS compile to temporary output, Node test, cleanup |
| `tsconfig.progressive-tests.json` | Strict test compilation |
| `tsconfig.progressive-check.json` | Changed panel/dependency graph typecheck |
| `package.json` | `typecheck` and `test:progressive-files` commands; no dependency additions |
| `pnpm-workspace.yaml` | Project-local approval for esbuild's normal install script |
| `AGENTS.md`, `CLAUDE.md` | Accurate pnpm/typecheck/build/test command documentation |

The project root was inspected before `docs/` was created with the documentation
patch. No existing documentation directory/content was overwritten.

## Verification and actual outcomes

All commands ran in `wt-files-dashboard`.

| Command/check | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | **Passed** with pnpm 11.25.0 after project-local esbuild approval; its normal `node install.js` postinstall completed. Lockfile unchanged. |
| `pnpm exec tsc --noEmit` | **Passed**, full repository, zero diagnostics. |
| `pnpm run test:progressive-files` | **17 passed, 0 failed**, including final contract corrections. |
| `npm run test:progressive-files` | **17 passed, 0 failed** after strict TypeScript compilation; no new test dependencies. |
| `node node_modules/typescript/bin/tsc -p tsconfig.progressive-check.json` | **Passed**, covering the panel and its imported implementation graph plus tests. |
| `npm run typecheck` | **Passed** after the narrow repairs below; the previously reported 10 errors are resolved. |
| `pnpm run build` | **Passed**: Vite 6.4.1, 2,871 transformed modules. Existing warnings: old Browserslist data and a main JS chunk above 500 kB. Build does not itself typecheck. |
| `npm run build` | **Passed** in the initial implementation verification; the final build was rerun through pnpm. |
| Playwright `tests/progressive-files.browser.mjs` | **Passed** mocked UI/route/auth checks, 8 list reads, 4 POSTs, zero page exceptions. Includes uncertain POST recovery from a terminal snapshot. |
| `git diff --check` | **Passed**, no whitespace errors. |

The deterministic suite covers terminal/readiness combinations; legacy optionality;
unknown/malformed payloads; unknown-field preservation; duplicate/out-of-order
sequences; retired/new runs; same-run backend retries; stage counter resets and unknown totals; Sync predicates;
retry eligibility; stale heartbeat; acknowledgment polling; action identity guards;
browser timer receiver regression; transient connection retries; abort-ignoring
transports; pause/resume/disposal. Its **simulated 90-minute** ready/nonterminal
workflow executes 361 reads through minute 90, then stops on the next backend terminal
snapshot. This is a virtual-clock test, **not a real-time soak**.

Browser verification covered text ready while images continue, labelled stage units,
retry plus lagging-list run fencing, cancellation retaining ready text, stale connection
and visibility recovery, Sync, 390px/1440px layouts, and a 760px desktop container beside
a simulated sidebar. It checked the exact `/local` POST URLs, empty bodies, and a
synthetic bearer token. All API requests were mocked; no live service was called.
Action response IDs now use the final Tests absolute `/local/courses/...` and
`/local/course-resources/...` formats. A simulated lost retry response is followed
by an unchanged terminal GET, then a newer same-run snapshot after a simulated
15-second polling interval; the UI recovers without a manual refresh.
The test caught and fixed a browser-only timer receiver bug and a regression test was
added. A later test-compilation cast error was also fixed before the final passing run.

To reproduce the browser harness, start:

```sh
VITE_TEST_API_URL=http://127.0.0.1:5178/local VITE_AGENT_V2_API_URL=http://127.0.0.1:5178/agent pnpm run dev --host 127.0.0.1 --port 5178
```

Then pass the absolute path of `tests/progressive-files.browser.mjs` to the OpenCode
Playwright `browser_run_code_unsafe` filename argument (it is a Playwright `page`
function, not a Node CLI test). This uses existing browser tooling rather than
installing another test runner. Actual startup used those same environment overrides
and command, with background logging to the harness temporary directory.
The local preview server and browser were stopped after verification.

### Mechanical typing follow-up — all 10 original errors resolved

The first implementation run found 10 errors in 8 then-unmodified files. The user
authorized narrow repairs; none required `any`, `@ts-ignore`, disabled checking,
invented backend DTO fields, or relaxed shared domain requirements.

| Original blocker | Narrow repair and evidence |
| --- | --- |
| `CourseSessionsPanel.tsx`: required `moduleId` absent | The legacy panel now requires an explicit typed `moduleId` prop and forwards it. No module ID is guessed and `saveCourseSession` stays strict. Tests' `application/course_sessions.go:347` rejects missing module IDs. This legacy component has no callers in the current app; the rendered `CourseModulesPanel` already sends module context. |
| `HoverTooltip.tsx`: React 19 `useRef` argument | Explicit `useRef<number \| undefined>(undefined)`; identical initial runtime value and timer behavior. |
| `AILabView.tsx`: question excerpt typed as persisted item | Local `SynthesisSeed` uses `Pick` for the fields actually consumed, with optional taxonomy IDs. Seed data and output values are unchanged; the published `newItem` still must satisfy the full `BackendItem` contract. |
| `TopicGrid.tsx` → `CreateTopicModal.tsx`: option list required unused metadata | Modal accepts `Pick<OrganSystem, 'id' \| 'title'>[]`, exactly what its options consume. No fake identifiers/timestamps are inserted. |
| `tutorService.ts`: missing `CurriculumObjective` / `LectureMetrics` | Repository search found neither DTO definitions nor callers of these two legacy methods. Their HTTP routes remain intact, but response types are explicitly `unknown`. This strengthens the unmodeled boundary: future callers must validate/map the response before reading fields. Other typed Tutor methods retain their contracts. |
| Curriculum health/workbench → linked-items panel: two different `LearningObjective` models | Both views and `LinkedItemsPanel` now use the Tests DTO already emitted by `ObjectiveList`. The panel reads `title` instead of nonexistent `text`; obsolete `subTopic`/`bloomLevel` query properties (undefined on the actual Tests rows) are omitted. IDs, available cognitive-skill/exam values, navigation paths and actions stay the same. Existing unnecessary `any` usages at these boundaries were removed. |
| `QuestionBankHealth.tsx`: two nonexistent `.name` fields | Filter labels use the declared Tests `title`, retaining the existing ID fallback. No API schema is widened to pretend `name` exists. |

These changes align types and field names; the only visible correction is using the
actual objective title where the mismatched model previously rendered no title.
They add no new feature/workflow behavior. The two unmodeled, unused Tutor responses
are not claimed to have a validated external schema; they are not build blockers.

### pnpm startup resolution

Initial pnpm commands failed on `ERR_PNPM_IGNORED_BUILDS` for esbuild. The final
project-local `pnpm-workspace.yaml` explicitly sets `allowBuilds.esbuild: true`.
`pnpm install --frozen-lockfile` then ran esbuild's normal postinstall successfully.
The frozen lockfile and dependency versions are unchanged. No global pnpm config,
hook, script bypass, or broad dependency-build exemption was used. Both documented
`pnpm run dev` and `pnpm run build` were executed successfully in follow-up.

### Final Tests/mobile compatibility review

Rechecked the completed sibling implementations read-only:

- Tests: `application/course_knowledge_processing.go`,
  `application/course_knowledge_hooks.go`, `application/course_knowledge_processing_test.go`,
  and `docs/PROGRESSIVE-FILES.md`. The 202 envelope, absolute resource IDs, optional
  `processing`, `/local` routing, teacher/admin scope, same-run monotonic retry,
  sanitized errors and continued ready/nonterminal reconciliation match this client.
  Course Sync never resumes cancelled work; only explicit per-resource retry does.
- Mobile: `types/DocumentProcessing.ts`, `utils/aiTutor/documentProcessing.js`,
  `components/molecules/DocumentProcessingStatus.vue`, `i18n/locales/en.json`,
  `composables/progressiveDocuments.test.js`, and `docs/PROGRESSIVE-FILES.md`.
  Both clients use availability rather than counters for readiness, preserve ready
  text after enrichment failure/cancel, disclose incomplete visual/OCR content,
  show server diagnostics as plain text, distinguish stale connections from work
  failure, retain unknown fields, and continue nonterminal polling without a cutoff.
  Both recover uncertain action responses and guard stale request/run updates.
- Intentional surface differences: this teacher dashboard exposes course-authorized
  retry/cancel, including explicit retry of a cancelled run as Tests supports.
  Mobile course resources are read-only and its personal-source UI currently hides
  cancelled-run retry. Poll intervals are 15s here vs 5s on mobile; neither is an
  overall processing timeout. Mobile owns its seven-locale text and native lifecycle
  handling; no mobile file was changed or native/device verification claimed here.

## Caveats / integration boundary

- Ready/nonterminal progression depends on Tests continuing to reconcile agent
  processing after legacy readiness, as required by the shared contract.
- Action routes/authorization were checked against the backend implementation and
  mocked HTTP requests. A live Tests/agent integration, real document processing,
  server authorization enforcement, and real-time long-running soak were not run here.
- Polling covers the displayed resource page; course Sync applies to all resources.
  No cross-page enrichment totals are claimed. Unknown progress remains conservatively
  refreshable until a recognized terminal snapshot arrives.
- The dashboard contains status/actions, not a learner chat composer; it never gates
  learner chat on enrichment completion or rewrites backend readiness.
- No commits, pushes, deployments, live configuration changes, or secret changes.
