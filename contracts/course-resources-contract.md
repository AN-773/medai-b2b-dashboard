# Course Resources API Contract

Service: **TESTS** (`VITE_TEST_API_URL`)
Consumer: `services/courseResourceService.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx`

Course resources are the learner-visible files attached to a course — readings, slides
and handouts. They surface to learners through every study plan whose `sourceCourseId`
is that course.

The service itself takes any file up to 2 GiB, and older resources include lecture
videos. What the **dashboard** now offers is narrower — see *Limits* below.

When the Tests service has a tutor agent configured, each eligible resource is also
ingested **once per course** into a shared knowledge base that the tutor can search in
every cohort-generated study plan for that course — see *Tutor knowledge base* below.
The Tests service does that work itself; the dashboard uploads once, to Tests, and never
talks to the agent about a resource.

`{identifier}` is the course slug: the last path segment of the backend's absolute `id`
URL. Use `resourceIdentifier()` to derive it.

---

## Uploading

There are two paths. **Prefer direct upload.**

### Direct upload (default)

Three steps: mint a URL, push the bytes to storage, commit the resource. The file never
passes through the Tests service, which matters because the service parses multipart
bodies with Echo's `MultipartForm()` — that buffers anything past 32 MB to the
container's temp disk and does not begin writing to storage until the last byte arrives.

#### 1. `POST /courses/{identifier}/resources/upload-url`

```jsonc
// request
{
  "fileName": "Cardiology lecture.mp4",  // required; its extension is preserved in the stored path
  "fileType": "video/mp4",               // MIME type the client will upload
  "fileSize": 734003200                  // bytes, checked against the server limit before signing
}
```

```jsonc
// 201
{
  "uploadUrl": "https://<account>.blob.core.windows.net/<container>/course-resources/<ksuid>.mp4?sv=…",
  "uploadPath": "course-resources/<ksuid>.mp4",
  "expiresAt": "2026-08-17T12:00:00Z"
}
```

| Status | Meaning |
|--------|---------|
| `400` | `fileName` missing, or `fileSize` over the server limit |
| `404` | Course not found |
| `501` | The configured file store cannot sign upload URLs (local dev). **Fall back to the multipart endpoint below.** This is the only status that should trigger the fallback. |

The URL is valid for **6 hours** — long enough to cover a gigabyte-scale transfer on a
poor uplink, unlike the 15-minute download links.

#### 2. Upload the bytes

`utils/blockBlobUpload.ts` handles this. Files ≤ 64 MiB go up as one `PUT` with
`x-ms-blob-type: BlockBlob`; larger files are staged as blocks (`comp=block`) and
assembled with `comp=blocklist`, because Azure caps a single `PUT` at 256 MiB.

This requires a **CORS rule on the storage account** allowing `PUT` from the dashboard
origin with the `x-ms-blob-type`, `x-ms-blob-content-type`, and `content-type` headers.
Without it the browser request fails before it reaches Azure.

#### 3. `POST /courses/{identifier}/resources/commit`

```jsonc
// request
{
  "uploadPath": "course-resources/<ksuid>.mp4",  // exactly what step 1 returned
  "fileName": "Cardiology lecture.mp4",          // shown to learners
  "fileType": "video/mp4"                        // fallback only; used if storage reports no type
}
```

Responds `201` with the same `{ resources: CourseResource[] }` shape as the multipart
endpoint, containing the one resource — carrying `knowledgeBase` (`processing` or
`ineligible`) when Tests has an agent configured (Contract T1). The `201` never waits on
the agent.

| Status | Meaning |
|--------|---------|
| `400` | `uploadPath` is not one this service minted, the blob is empty, or it is over the size limit (the blob is deleted in that case) |
| `404` | Course not found, **or the blob is absent from storage** — an abandoned upload never becomes a resource |

`fileSize` and `fileType` on the stored resource come from storage, not from this
request body.

### Multipart upload (fallback)

`POST /courses/{identifier}/resources` with `multipart/form-data` and one or more `file`
parts. Responds `201` with `{ resources: CourseResource[] }`. Accepts any file type — no
MIME allowlist. Use only when `upload-url` returns `501`.

---

## Reading and deleting

### `GET /courses/{identifier}/resources?limit={n}&page={n}`

```jsonc
// 200
{
  "resources": [ /* CourseResource */ ],
  "total": 42,
  "page": 1
}
```

### `DELETE /courses/{identifier}/resources/{resourceIdentifier}`

`204` on success, `404` if the course or the resource is unknown.

### `GET /study-plans/{identifier}/resources` and `…/{resourceIdentifier}/download`

The learner-facing pair. `download` returns `{ url, expiresAt }` with a 15-minute signed
URL. **There is no teacher-facing equivalent** — the dashboard cannot currently preview
or play back a resource it uploaded.

---

## Tutor knowledge base

Provider: the Tests service. Consumer: this dashboard. Credential: the Tests session
token, as for every route above. Which of this exists is decided by the **Tests
service's** configuration (`AGENT_V2_API_URL`), not by `VITE_AGENT_V2_API_URL` here.

Each eligible resource is ingested **once per course** — not once per learner — into a
knowledge base owned by the principal `/courses/<courseIdentifier>`, and read by the
tutor in **cohort-generated study plans** for that course. `/courses/<courseIdentifier>`
(for the course) and `/users/<ksuid>` (for a learner) are Tests-service conventions for
the ids it sends the agent; the dashboard never sends or parses either.

### Contract T1 — `CourseResource.knowledgeBase`

An additive field on every `CourseResource` returned by:

- `GET /courses/{identifier}/resources` (200 `{ resources, total, page }`)
- `POST /courses/{identifier}/resources/commit` (201 `{ resources: [...] }`)
- the multipart `POST /courses/{identifier}/resources` (201 `{ resources: [...] }`)

```ts
knowledgeBase?: {
  status: 'not_synced' | 'ineligible' | 'processing' | 'ready' | 'failed';
  reason: 'format' | 'size' | null;   // set only for 'ineligible'
  errorCode: string | null;           // set only for 'failed': agent-v2's errorCode, or 'agent_unreachable'
  updatedAt: string | null;           // ISO 8601; null for 'not_synced'
}
```

**Absent means the feature is off; `not_synced` means not yet sent.**

| On the wire | Meaning |
|-------------|---------|
| key absent | Tests has no agent configured. The dashboard renders exactly as it did before this field existed. |
| `not_synced` | Configured, but this resource has no ingestion record yet (uploaded before the feature, not yet backfilled). The course-level sync (T2) fixes it. |
| `ineligible` | Will never be sent. `reason: 'format'` — not one of the agent's `corpus` formats; `reason: 'size'` — over 150 MiB. |
| `processing` | Being sent or indexed. |
| `ready` | Filed and indexed in the course collection (see T3). |
| `failed` | Ingestion failed; `errorCode` says why. T2 retries it. |

Internal → wire mapping (Tests keeps a richer state machine and projects it):

| Internal state | Wire `status` |
|----------------|---------------|
| no row | `not_synced` |
| `ineligible` | `ineligible` |
| `queued`, `uploading`, `pending` | `processing` |
| `ready` | `ready` |
| `failed` | `failed` |
| `removing`, `removed` | never returned — deleted resources are not listed |

A client must treat a `status` it does not recognise as "show nothing about the tutor",
never as an error (`readCourseResourceKnowledgeBase` in `types/CourseResourceTypes.ts`).

The learner-facing `GET /study-plans/{identifier}/resources` carries **no** such field.

**Eligibility rule** (applied by Tests): the file's media type or suffix is in agent-v2's
published `corpus` formats (`GET /v1/documents/formats`) **and** its size is ≤ 150 MiB
(157,286,400 bytes). The picker applies the same rule from the same source before
upload, but **the server check is authoritative** — in particular when the picker could
not load the formats and let a file through.

### Contract T2 — `POST /courses/{identifier}/resources/knowledge-base/sync`

Teacher-triggered, course-level repair. No request body. Scoped like the other resource
writes (tenant + teacher of the course).

```jsonc
// 202
{
  "courseId": "…",
  "queuedResources": 3,   // resources queued for ingestion
  "queuedLinks": 12       // study-plan links / reader grants queued
}
```

| Status | Meaning | Dashboard |
|--------|---------|-----------|
| `202` | Queued. Idempotent — calling it twice queues nothing new. | `'accepted'`; reload the list |
| `404` `{ "error": "course not found" }` | Course unknown (or a Tests release without the route) | `'unsupported'`; hide the action |
| `501` `{ "error": "knowledge base sync is not configured" }` | Tests has no agent configured | `'unsupported'`; hide the action |

Effect: enqueue ingestion for every non-deleted resource with no record or a `failed`
one, and link + reader reconcile for every non-deleted cohort-generated study plan of
this course that is not yet linked. Consumer: `syncTeacherCourseResourcesToTutor` in
`services/courseResourceService.ts`.

### Contract T3 — behavioural guarantees

- **Commit `201` and `DELETE` `204` never wait on the agent.** An agent outage never fails
  an upload or a delete; ingestion runs afterwards, so an upload answers with
  `processing` (or `ineligible`), not `ready`.
- **`DELETE` unfiles asynchronously.** The learner's tutor stops finding the file from
  their next question.
- **`ready` means filed and indexed in the course collection**, and reachable **only**
  through cohort-generated study plans for the course — not through a manually created
  plan that names the course as `sourceCourseId`.
- **Once per course.** A resource is ingested once however many learners read it.
- **No promise about removal from a cohort.** Dashboard copy must not say that removing
  a learner or a course from a cohort takes the tutor's access away until the product
  owner has ruled on the matching behaviour for downloads.

---

## `CourseResource`

```ts
{
  id: string;            // absolute URL; last segment is the identifier
  identifier: string;
  courseId: string | null;
  fileId: string | null;
  fileName: string;
  fileType: string;      // MIME type as reported by storage
  fileSize: number;      // bytes
  createdAt: string;     // ISO 8601
  updatedAt: string;
  knowledgeBase?: CourseResourceKnowledgeBase; // Contract T1; absent when Tests has no agent
}
```

---

## Limits — the store's, and the narrower ones the dashboard applies

`COURSE_RESOURCE_MAX_UPLOAD_BYTES` caps a single resource, defaulting to 2 GiB. It is
enforced twice: against the declared `fileSize` before a URL is signed, and against the
blob's actual size at commit. The multipart fallback applies no MIME allowlist.

**The dashboard is deliberately stricter than both**, and the reason is not in this
service. A course resource is only useful if a learner's tutor can read it, which means
it has to be ingestible by the agent — and that pipeline takes a fixed set of document
formats and nothing over 150 MiB. See `contracts/agent-v2-contract.md`.

So `CourseResourcesPanel.tsx` refuses, before any transfer starts:

- anything over **150 MB**, not 2 GB;
- anything outside the agent's published `corpus` format list — which excludes
  **video and audio entirely**. The format half is skipped when the agent is not
  configured or cannot be reached, because a guessed allowlist would hide files the
  parser reads; the size half always applies.

The picker's check is a convenience. When Tests has an agent configured it applies the
same eligibility rule itself and is **authoritative** (Contract T1): a file that slipped
past the picker is stored as a course resource and reported `ineligible`.

`DELETE /courses/{identifier}/resources/{resourceIdentifier}` still answers `204`
without waiting on the agent; unfiling from the course knowledge base happens
afterwards (Contract T3).

This service still accepts what it always did. Resources uploaded before the narrowing
— lecture recordings included — are untouched: still listed, still downloadable, still
attached to their study plans. Only new uploads are bounded.
