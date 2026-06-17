# Curriculum API Contract

This document is the frontend-facing contract for the curriculum endpoints and the curriculum-linking changes to organ systems and learning objectives.

It is derived from the live handlers in `application/controllers.go`, the write logic in `application/receivers.go`, the governance logic in `infrastructure/curriculum_governance_service.go`, the projections in `infrastructure/models.go`, and the route definitions in `api.yaml`.

Use this document as the source of truth for curriculum payload shapes and endpoint behavior.

## Scope

- Curricula are **tenant-scoped**. Reads only return curricula belonging to the caller's tenant; writes stamp the caller's tenant on create.
- A curriculum has a **draft → published version lifecycle**. `currentVersion` is `0` until the first publish.
- Route params named `identifier` refer to the curriculum **slug** segment (e.g. `cardiology`), not the full absolute URL. The slug is derived from `title` on create.
- `id` fields in responses are **absolute URIs** (e.g. `https://host/base/curricula/cardiology`). Use the trailing slug for `identifier` path params.
- Timestamps are RFC3339 / ISO-8601 strings. Nullable fields are returned as `null`.
- `POST`/`DELETE`/publish are routed through dispatch controllers: on success they return the body documented below; on validation/permission failure the **HTTP status code is authoritative and the response body is typically `null`** (no error message). The two version **read** endpoints return `{ "error": string }` on failure.
- `identifier`, `status`, and `currentVersion` are **server-managed** on write — the client does not set them (any values sent are overwritten).

## Authorization

| Capability | Roles |
| --- | --- |
| List / view curricula, list / view versions | `Administrator`, `user` |
| Create / update / delete curriculum | `Administrator` |
| Publish curriculum | `Administrator` |

`401` (unauthenticated) and `403` (role not allowed) are enforced by the gateway/auth middleware before the handler runs.

## Route summary

| Method | Path | Success | Notes |
| --- | --- | --- | --- |
| `GET` | `/curricula` | `200` | `?relations=true` to embed members; tenant-scoped list |
| `POST` | `/curricula` | `201` | create or update (send `id` to update) |
| `GET` | `/curricula/{identifier}` | `200` | embeds `organSystems` + `learningObjectives` |
| `DELETE` | `/curricula/{identifier}` | `204` | |
| `POST` | `/curricula/{identifier}/publish` | `200` | freezes a snapshot; Administrator only |
| `GET` | `/curricula/{identifier}/versions` | `200` | published versions only |
| `GET` | `/curricula/{identifier}/versions/{version}` | `200` | frozen published snapshot |

Plus curriculum links on existing resources:

| Method | Path | Change |
| --- | --- | --- |
| `POST` | `/organ-systems` | accepts `curriculumId` (see flag behavior below) |
| `GET` | `/organ-systems?curriculumId=…` | filter by curriculum |
| `POST` | `/learning-objectives` | accepts optional `curriculumId` |
| `GET` | `/learning-objectives?curriculumId=…` | filter by curriculum |

## Types

```ts
type CurriculumStatus = "draft" | "published";

// Read shape returned by GET /curricula and GET /curricula/{identifier}
type Curriculum = {
  id: string;            // absolute URI
  identifier: string;    // slug
  title: string;
  tenantId: string | null;
  status: CurriculumStatus;
  currentVersion: number; // 0 until first publish
  createdAt: string;     // ISO-8601
  updatedAt: string;
  // Embedded only on the single-item view, or on list when ?relations=true:
  organSystems?: OrganSystem[];
  learningObjectives?: LearningObjective[];
};

type CurriculumVersion = {
  id: string;
  curriculumId: string;        // absolute curriculum URI
  version: number;             // 1-based
  status: CurriculumStatus;    // versions endpoints only return "published"
  summary: string;
  // Present on publish and version-detail reads. Omitted from version list rows.
  snapshot?: CurriculumVersionSnapshot;
  createdAt: string;
  createdBy: string;
  publishedAt: string | null;
  publishedBy: string;
};

// Frozen jsonb snapshot captured at publish time. It is a denormalized
// OS -> topics -> syndromes/subtopics -> learning objectives tree.
type CurriculumVersionSnapshot = {
  curriculumId: string;
  capturedAt: string;
  organSystems: CurriculumVersionOrganSystemSnapshot[];
};

type CurriculumVersionOrganSystemSnapshot = {
  id: string;
  title: string;
  identifier: string;
  tenantId?: string;
  curriculumId?: string;
  createdAt: string;
  updatedAt: string;
  topics: CurriculumVersionTopicSnapshot[];
};

type CurriculumVersionTopicSnapshot = {
  id: string;
  title: string;
  identifier: string;
  organSystemId?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  syndromes: CurriculumVersionSyndromeSnapshot[];
};

type CurriculumVersionSyndromeSnapshot = {
  id: string;
  title: string;
  identifier: string;
  topicId?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  learningObjectives: CurriculumVersionLearningObjectiveSnapshot[];
};

type CurriculumVersionLearningObjectiveSnapshot = {
  id: string;
  title: string;
  identifier: string;
  exam: string;
  source: string;
  subjectId?: string;
  studyPlanId?: string;
  curriculumId?: string;
  tenantId?: string;
  syndromeId?: string;
  cognitiveSkillId?: string;
  createdAt: string;
  updatedAt: string;
};

// List envelope (matches other list endpoints)
type CurriculumListResponse = {
  items: Curriculum[];
  total: number;
  page: number;
};
```

## Endpoints

### `GET /curricula`

List curricula for the caller's tenant.

- Query params: `page` (default `1`), `limit` (default unlimited), `relations` (`true` to embed `organSystems` + `learningObjectives`), `q` (title contains, case-insensitive).
- `200` → `CurriculumListResponse`.

```json
{
  "items": [
    {
      "id": "https://host/base/curricula/cardiology",
      "identifier": "cardiology",
      "title": "Cardiology",
      "tenantId": "/tenants/acme",
      "status": "published",
      "currentVersion": 2,
      "createdAt": "2026-06-17T10:00:00Z",
      "updatedAt": "2026-06-17T12:30:00Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

### `POST /curricula`

Create (no `id`) or update (with `id`) a curriculum.

Request:

```json
{ "curriculum": { "title": "Cardiology" } }
```

To update, include the absolute `id`:

```json
{ "curriculum": { "id": "https://host/base/curricula/cardiology", "title": "Adult Cardiology" } }
```

- `201` → the created/updated curriculum (event-sourced shape: includes `id`, `title`, `identifier`, `tenantId`, `status`, `currentVersion`, `createdAt`, `updatedAt`, plus internal `ids`/`_versions` envelope fields that can be ignored).
- `400` — missing/invalid body (`curriculum` is required).
- `403` — caller has no resolvable tenant.

> `identifier` is generated from `title` (slugified) on create and is immutable. `status` starts at `draft`; `currentVersion` starts at `0`.

### `GET /curricula/{identifier}`

View one curriculum with its current working-state members embedded (`organSystems`, `learningObjectives`).

- `200` → `Curriculum` (with embedded relations).
- `404` — not found / not visible to tenant.

### `DELETE /curricula/{identifier}`

- `204` — deleted (empty body).
- `404` — not found.

### `POST /curricula/{identifier}/publish`

Freezes the curriculum's current members into a new published version snapshot, increments `currentVersion`, and opens the next draft. **Administrator only.**

Request (body optional):

```json
{ "summary": "Q3 curriculum release" }
```

- `200`:

```json
{
  "curriculum": { "id": "…", "identifier": "cardiology", "status": "published", "currentVersion": 1, "...": "…" },
  "version": {
    "id": "2H9…ksuid",
    "curriculumId": "https://host/base/curricula/cardiology",
    "version": 1,
    "status": "published",
    "summary": "Q3 curriculum release",
    "createdAt": "2026-06-17T10:00:00Z",
    "createdBy": "",
    "publishedAt": "2026-06-17T12:30:00Z",
    "publishedBy": "/users/u1"
  }
}
```

- `400` — missing id.
- `403` — curriculum belongs to another tenant.
- `404` — curriculum not found.

### `GET /curricula/{identifier}/versions`

Lists the **published** versions of the curriculum (newest first). The in-progress draft is not included.

- `200`:

```json
{ "items": [ /* CurriculumVersion */ ], "total": 1 }
```

- `404` — curriculum not found / not visible to tenant.

### `GET /curricula/{identifier}/versions/{version}`

Returns the frozen published jsonb snapshot for a version number — the organ systems, topics, syndromes/subtopics, and learning objectives exactly as they were at publish time.

- `200`:

```json
{
  "version": { /* CurriculumVersion */ },
  "snapshot": { /* CurriculumVersionSnapshot */ }
}
```

- `400` — `version` is not an integer.
- `404` — curriculum or published version not found.

## Curriculum links on organ systems & learning objectives

### Organ systems

`OrganSystem` gains a nullable `curriculumId` field.

- `POST /organ-systems` — `curriculumId` is **optional by default**. When the server env flag `CURRICULUM_REQUIRE_ORGAN_SYSTEM=true` is enabled, it becomes **required**:
  - missing/empty when required → `400`
  - references a curriculum in another tenant → `403`
  - references a non-existent curriculum → `400`
- `GET /organ-systems?curriculumId={absoluteCurriculumId}` — returns only organ systems linked to that curriculum.

> Frontend guidance: treat `curriculumId` as optional today. The product can flip the requirement on per environment; when it does, organ-system create/edit forms must send a valid same-tenant `curriculumId` or the request will be rejected with `400`.

### Learning objectives

`LearningObjective` gains a nullable `curriculumId` field that is **always optional**.

- `POST /learning-objectives` — `curriculumId` may be included; omitted stays `null`. Same validation as organ systems for cross-tenant (`403`) and unknown curriculum (`400`).
- `GET /learning-objectives?curriculumId={absoluteCurriculumId}` — returns only LOs directly linked to that curriculum.

## Behavioral notes for the frontend

- **Current vs. historical reads.** `GET /curricula` and `GET /curricula/{identifier}` always reflect the latest working state (including unpublished edits). The `…/versions` endpoints return immutable published snapshots — use these for "view a past published curriculum."
- **Publishing is additive.** Each publish creates a new version `currentVersion + 1` and reopens a fresh draft; previously published versions remain readable.
- **IDs in query filters** are the absolute curriculum URI (the `id` from a curriculum read), not the slug.
- **Validation messages.** Write endpoints communicate failures via HTTP status only (body may be `null`); render status-based messaging client-side. The version read endpoints return `{ "error": string }`.
