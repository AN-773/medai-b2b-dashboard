# Curriculum API Contract

This document is the frontend-facing contract for curriculum grouping and curriculum links on organ systems, learning objectives, and courses.

It is derived from the live handlers in `application/controllers.go`, the write logic in `application/receivers.go`, the projections in `infrastructure/models.go`, and the route definitions in `api.yaml`.

## Scope

- Curricula are tenant-scoped. Reads only return curricula belonging to the caller's tenant; writes stamp the caller's tenant on create.
- Route params named `identifier` refer to the trailing curriculum identifier segment, for example `2a7f9c3k8m1q4r6t0v2x5y7zb9d`, not the full absolute URL.
- `id` fields in responses are absolute resource URIs. Use the trailing identifier segment for `identifier` path params.i
- Timestamps are RFC3339 / ISO-8601 strings. Nullable fields are returned as `null`.
- `POST` and `DELETE` are routed through dispatch controllers. On success they return the body documented below; on validation or permission failure the HTTP status code is authoritative and the response body may be `null`.
- `identifier` is server-managed on create and generated as a random lower-case KSUID. It is opaque and is not derived from `title`.

## Authorization

| Capability | Roles |
| --- | --- |
| List / view curricula | `Administrator`, `user` |
| Create / update / delete curriculum | `Administrator` |

`401` and `403` are enforced by the gateway/auth middleware before the handler runs.

## Route Summary

| Method | Path | Success | Notes |
| --- | --- | --- | --- |
| `GET` | `/curricula` | `200` | `?relations=true` embeds members; tenant-scoped list |
| `POST` | `/curricula` | `201` | Create or update; send `id` to update |
| `GET` | `/curricula/{identifier}` | `200` | Embeds `organSystems` and `learningObjectives` |
| `DELETE` | `/curricula/{identifier}` | `204` | Deletes the curriculum resource |

Curriculum links on existing resources:

| Method | Path | Change |
| --- | --- | --- |
| `POST` | `/organ-systems` | accepts `curriculumId` |
| `GET` | `/organ-systems?curriculumId=...` | filters by curriculum |
| `POST` | `/learning-objectives` | accepts optional `curriculumId` |
| `GET` | `/learning-objectives?curriculumId=...` | filters by curriculum |
| `POST` | `/courses` | accepts optional `curriculumId` |
| `POST` | `/blocks` | accepts optional `curriculumId`; inferred from selected organ systems when omitted |

## Types

```ts
type Curriculum = {
  id: string;
  identifier: string;
  title: string;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
  organSystems?: OrganSystem[];
  learningObjectives?: LearningObjective[];
  courses?: Course[];
};

type CurriculumListResponse = {
  items: Curriculum[];
  total: number;
  page: number;
};
```

## Endpoints

### `GET /curricula`

List curricula for the caller's tenant.

- Query params: `page`, `limit`, `relations`, `q`, and parsed filters.
- `200` -> `CurriculumListResponse`.

### `POST /curricula`

Create with no `id`, or update with an existing absolute `id`.

```json
{ "curriculum": { "title": "Cardiology" } }
```

```json
{ "curriculum": { "id": "https://host/base/curricula/2a7f9c3k8m1q4r6t0v2x5y7zb9d", "title": "Adult Cardiology" } }
```

- `201` -> the created or updated curriculum.
- On create, clients must read the returned `identifier` or `id` and use that value for subsequent `/curricula/{identifier}` requests.
- `400` -> missing or invalid body.
- `403` -> caller has no resolvable tenant.

### `GET /curricula/{identifier}`

View one curriculum with its live members embedded.

- `200` -> `Curriculum`.
- `404` -> not found or not visible to the tenant.

### `DELETE /curricula/{identifier}`

- `204` -> deleted.
- `409` -> curriculum still has linked resources and cannot be deleted.
- `404` -> not found.

## Curriculum Links

### Organ Systems

`OrganSystem` has a nullable `curriculumId` field.

- `POST /organ-systems` validates a provided `curriculumId`.
- `CURRICULUM_REQUIRE_ORGAN_SYSTEM=true` makes `curriculumId` required.
- Unknown curriculum -> `400`.
- Cross-tenant curriculum -> `403`.
- `GET /organ-systems?curriculumId={absoluteCurriculumId}` returns only linked organ systems.

### Learning Objectives

`LearningObjective` has a nullable `curriculumId` field that is always optional.

- `POST /learning-objectives` validates a provided `curriculumId`.
- `GET /learning-objectives?curriculumId={absoluteCurriculumId}` returns only directly linked learning objectives.

### Courses

`Course` has a nullable `curriculumId` field.

- `POST /courses` validates a provided `curriculumId`.
- Course list and view endpoints always read live course rows.

### Blocks

`Block` has a nullable `curriculumId` field.

- `POST /blocks` validates a provided `curriculumId`.
- If `curriculumId` is omitted, the first non-empty curriculum from selected `organSystems` is used.
- If `curriculumId` is provided, selected organ systems with a different non-empty curriculum are rejected.
- When `curriculumId` is present, block question/item selection uses curriculum before `examType`.

## Behavioral Notes

- All curriculum and linked-resource reads use live tables.
- IDs in query filters are absolute curriculum URIs, not identifier path segments.
