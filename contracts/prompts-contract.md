# Prompt API Contract

This document is the frontend-facing contract for the prompt management endpoints.

It is derived from the live handlers in `application/controllers.go`, the prompt write logic in `application/receivers.go`, the prompt catalog source in `infrastructure/prompt_catalog.go`, and the HTTP tests in `application/prompt_tenancy_test.go`.

Use this document as the source of truth for prompt payload shapes and endpoint behavior until `api.yaml` is expanded with the same response schemas.

## Scope

- All endpoints in this contract are superadmin-only.
- Prompt resources are intended to be global, cross-tenant resources.
- `POST /prompts` clears any incoming `tenantId` before persisting.
- `GET /prompts` and `GET /prompts/{identifier}` return persisted DB rows.
- `POST /prompts` returns the domain/event-sourced prompt shape, which is not identical to the DB read shape.
- Route params named `identifier` refer to the prompt identifier segment, not the full absolute prompt URL.
- The context removal handler reads `fileIdentifier` from the route path, even though `api.yaml` currently names that parameter `fileId`.
- Timestamps are RFC3339/ISO-8601 strings when present.
- Nullable fields are returned as `null`.

## Common error shape

```ts
type PromptErrorResponse = {
  error: string;
};
```

Common auth errors:

- `401`: `{ "error": "authentication required" }`
- `403`: `{ "error": "superadmin role required" }`

## Route summary

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/prompts` | `200` |
| `POST` | `/prompts` | `201` |
| `GET` | `/prompts/{identifier}` | `200` |
| `DELETE` | `/prompts/{identifier}` | `204` |
| `POST` | `/prompts/{identifier}/contexts` | `200` |
| `DELETE` | `/prompts/{identifier}/contexts/{fileIdentifier}` | `200` |
| `GET` | `/superadmin/prompts/catalog` | `200` |

## Shared types

```ts
type BuiltInPromptType =
  | "Question"
  | "Learning Objective"
  | "study_plan"
  | "study_plan_lo_map"
  | "study_plan_lo_reduce"
  | "study_plan_item_generation"
  | "study_plan_session_weak_lo_items"
  | "study_plan_session_internal_lo_items"
  | "study_plan_session_fallback_items"
  | "study_plan_session_weak_lo_flashcards"
  | "study_plan_session_internal_lo_flashcards"
  | "study_plan_session_fallback_flashcards"
  | "saq_grading";

type PromptType = BuiltInPromptType | string;

type PromptFile = {
  id: string;
  questionId: string | null;
  identifier: string;
  name: string;
  path: string;
  type: string;
  size: number;
  url: string;
  tenantId: string | null;
  created: string;
  updated: string;
  deletedAt: string | null;
};

// Returned by GET /prompts, GET /prompts/{identifier}, and inside
// configuredPrompts from the prompt catalog endpoint.
type StoredPrompt = {
  id: string;
  text: string;
  userTemplate: string;
  type: string;
  exam: string;
  enforcedSchema: unknown;
  vectorStoreId: string;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  files: PromptFile[] | null;
};

// Body sent to POST /prompts.
type PromptUpsertBody = {
  prompt: {
    id?: string;
    text?: string;
    userTemplate?: string;
    type: string;
    exam?: string;
    enforcedSchema?: string;
    tenantId?: string | null;
  };
};

// Returned by POST /prompts.
type UpsertedPrompt = {
  id: string;
  ids: Record<string, string> | null;
  _versions: Record<string, string> | null;
  text: string;
  userTemplate?: string;
  type: string;
  exam: string;
  enforcedSchema: string;
  tenantId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PromptListResponse = {
  items: StoredPrompt[];
  total: number;
  page: number;
};

type PromptCatalogVariable = {
  token: string;
  description: string;
};

type PromptCatalogItem = {
  type: string;
  label: string;
  description: string;
  requiresExam: boolean;
  defaultText?: string;
  defaultUserTemplate?: string;
  defaultEnforcedSchema?: string;
  variables: PromptCatalogVariable[];
  configuredPrompts: StoredPrompt[];
};

type PromptCatalogResponse = {
  items: PromptCatalogItem[];
  total: number;
};
```

## Built-in prompt types

The current built-in types exposed by `GET /superadmin/prompts/catalog` are:

| Type | Requires exam | Built-in defaults |
| --- | --- | --- |
| `Question` | Yes | `defaultEnforcedSchema` only |
| `Learning Objective` | Yes | `defaultEnforcedSchema` only |
| `study_plan` | No | `defaultText` |
| `study_plan_lo_map` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_lo_reduce` | No | none today |
| `study_plan_item_generation` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_session_weak_lo_items` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_session_internal_lo_items` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_session_fallback_items` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_session_weak_lo_flashcards` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_session_internal_lo_flashcards` | No | `defaultText`, `defaultUserTemplate` |
| `study_plan_session_fallback_flashcards` | No | `defaultText`, `defaultUserTemplate` |
| `saq_grading` | No | `defaultText`, `defaultUserTemplate` |

The catalog also returns display metadata (`label`, `description`) and runtime template variables (`variables`) for each built-in type so the frontend does not keep a separate prompt-type table. If the database contains prompt rows for custom types, the catalog endpoint appends those custom types after the built-in list, sorted lexicographically by type. Custom types currently expose no built-in defaults or variables unless code is added for them.

## 1. List prompts

### Request

`GET /prompts`

### Query params

- `exam?: string`
- `type?: string`
- `limit?: number`
- `page?: number`

Notes:

- `exam` and `type` are exact DB filters.
- `type` is not normalized in this handler.
- `page` defaults to `1`.
- When `limit` is omitted or `0`, the handler returns all matching prompts.
- The response does not guarantee sort order.

### Success response

```ts
type ListPrompts200 = PromptListResponse;
```

### Example

```json
{
  "items": [
    {
      "id": "https://example.com/local/prompts/abc123",
      "text": "configured study plan prompt",
      "userTemplate": "",
      "type": "study_plan",
      "exam": "",
      "enforcedSchema": null,
      "vectorStoreId": "",
      "tenantId": null,
      "createdAt": "2026-06-10T10:00:00Z",
      "updatedAt": "2026-06-10T10:00:00Z",
      "deletedAt": null,
      "files": []
    }
  ],
  "total": 1,
  "page": 1
}
```

## 2. Upsert a prompt

### Request

`POST /prompts`

```ts
type UpsertPromptRequest = PromptUpsertBody;
```

### Server-side normalization and validation

The receiver currently applies these rules before persisting:

- `tenantId` is always cleared.
- `type` is normalized with `domain.NormalizePromptType`.
- If `enforcedSchema` is blank and the normalized type is `Question` or `Learning Objective`, the receiver fills the built-in default schema.
- `exam` is normalized for `STEP 1`, `STEP 2`, and `STEP 3`.
- A prompt is valid when:
  - at least one of `text` or `userTemplate` is non-empty
  - `type` is non-empty
  - `exam` is non-empty for prompt types that require an exam
- Duplicate prompts are rejected when another persisted row already has the same exact `(exam, type)` pair.

### Success response

`201 Created`

```ts
type UpsertPrompt201 = UpsertedPrompt;
```

### Error cases

- `400`: `{ "error": "missing prompt in payload" }`
- `400`: `{ "error": "invalid prompt data" }`
- `400`: `{ "error": "A prompt for exam STEP 1 and type Question already exists." }`
- `500`: `{ "error": "error getting prompt" }`
- `500`: `{ "error": "error persisting prompt" }`

## 3. Get one prompt

### Request

`GET /prompts/{identifier}`

### Success response

`200 OK`

```ts
type GetPrompt200 = StoredPrompt;
```

### Error cases

- `404`: `{ "error": "prompt not found" }`

## 4. Delete one prompt

### Request

`DELETE /prompts/{identifier}`

### Success response

`204 No Content`

No response body.

### Error cases

- `404`: `{ "error": "prompt not found" }`

## 5. Assign a context file to a prompt

### Request

`POST /prompts/{identifier}/contexts`

```ts
type AssignPromptContextRequest = {
  fileId: string;
};
```

Important:

- The handler expects `fileId` to be the full persisted file `id`, not the file identifier segment.
- The prompt route uses the prompt identifier segment.

### Success response

`200 OK`

```ts
type AssignPromptContext200 = StoredPrompt;
```

Implementation note:

- The handler returns the prompt row loaded before the association mutation.
- It does not preload `files` before returning.
- In practice, `files` may therefore be `null` or stale in this response even though the association was successfully written.

### Error cases

- `400`: `{ "error": "invalid payload" }`
- `404`: `{ "error": "prompt not found" }`
- `404`: `{ "error": "file not found" }`

## 6. Remove a context file from a prompt

### Request

`DELETE /prompts/{identifier}/contexts/{fileIdentifier}`

Important:

- The handler reads `fileIdentifier` from the path, not a full file `id`.
- It expands that identifier into a full file URL internally before lookup.

### Success response

`200 OK`

```ts
type RemovePromptContext200 = StoredPrompt;
```

Implementation note:

- As with the assign endpoint, the returned prompt object is not reloaded with `files` preloaded after mutation.

### Error cases

- `404`: `{ "error": "prompt not found" }`
- `404`: `{ "error": "file not found" }`

## 7. List the prompt catalog

### Request

`GET /superadmin/prompts/catalog`

### Success response

`200 OK`

```ts
type ListPromptCatalog200 = PromptCatalogResponse;
```

Catalog behavior:

- The endpoint always returns all built-in prompt types, even when no DB row exists yet for that type.
- `configuredPrompts` is always present and is an array.
- `label`, `description`, and `variables` are returned by the backend catalog and should be used by frontend prompt-management UI.
- Built-in entries are returned first in the order defined by `infrastructure.ListPromptCatalog()`.
- Any additional custom prompt types found in the DB are appended afterward in ascending lexical order.
- Within each `configuredPrompts` array, prompts are sorted by `exam`, then by `id`.

### Example

```json
{
  "items": [
    {
      "type": "Question",
      "label": "Question Generation",
      "description": "Legacy item-generation prompt used for standard question creation.",
      "requiresExam": true,
      "defaultEnforcedSchema": {
        "stem": "The question stem (clinical vignette or non-clinical scenario)"
      },
      "variables": [],
      "configuredPrompts": [
        {
          "id": "https://example.com/local/prompts/question-step-1",
          "text": "configured question prompt",
          "userTemplate": "",
          "type": "Question",
          "exam": "STEP 1",
          "enforcedSchema": {
            "stem": "The question stem (clinical vignette or non-clinical scenario)"
          },
          "vectorStoreId": "",
          "tenantId": null,
          "createdAt": "2026-06-10T10:00:00Z",
          "updatedAt": "2026-06-10T10:00:00Z",
          "deletedAt": null,
          "files": []
        }
      ]
    },
    {
      "type": "study_plan",
      "label": "Study Plan Base Prompt",
      "description": "Shared system prompt inherited by study-plan extraction and generation flows.",
      "requiresExam": false,
      "defaultText": "You are a medical education AI assistant.",
      "variables": [],
      "configuredPrompts": []
    }
  ],
  "total": 13
}
```

## Known shape differences to account for

- `GET /prompts*` endpoints return the infrastructure/DB prompt model.
- `POST /prompts` returns the domain/event-sourced prompt model.
- Because of that mismatch, `enforcedSchema` is effectively:
  - `unknown` on read endpoints
  - `string` on the upsert response
- The context mutation endpoints currently return a prompt object without reloading prompt-file associations.
