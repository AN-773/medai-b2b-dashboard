# Course Resources API Contract

Service: **TESTS** (`VITE_TEST_API_URL`)
Consumer: `services/courseResourceService.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx`

Course resources are the learner-visible files attached to a course — readings, slides,
handouts, and lecture videos. They surface to learners through every study plan whose
`sourceCourseId` is that course.

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
endpoint, containing the one resource.

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
}
```

---

## Server-side limits

`COURSE_RESOURCE_MAX_UPLOAD_BYTES` caps a single resource, defaulting to 2 GiB. It is
enforced twice: against the declared `fileSize` before a URL is signed, and against the
blob's actual size at commit. The dashboard mirrors the 2 GB figure for videos in
`CourseResourcesPanel.tsx` so oversized files are rejected before the upload starts.
