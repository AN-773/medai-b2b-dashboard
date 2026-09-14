# Agent v2 API Contract

Service: **AGENT_V2** (`VITE_AGENT_V2_API_URL`)
Consumer: `services/agentV2Service.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx`

The tutor agent. It holds **knowledge bases** — collections of ingested documents
that a learner's tutor can search — and the ingestion pipeline behind them is
what decides which course resources are usable by the product at all.

**This service is optional.** A deployment with no `VITE_AGENT_V2_API_URL` has no
agent; `agentV2Service.isConfigured()` is the only gate, and every surface that
depends on the agent reads it rather than the variable.

---

## Auth

Same IAM as the dashboard (`IAM_ISSUER_URL` on the agent = `VITE_IAM_API_URL`
here), so the `msai_educator_token` this app already holds is a valid credential
— sent automatically by `apiClient`.

`AGENT_V2` is deliberately **not** in `SESSION_OWNING_SERVICES`: the agent
verifies against its own configured issuer and audience, so a deployment pointed
at a different IAM answers `401` to a session that is valid here, and logging the
teacher out over that would present a deployment error as an expired session.

## CORS

Reaching this service from a browser requires the dashboard's origin in the
agent's `API_CORS_ORIGINS`. Direct-to-blob uploads additionally require a CORS
rule on the agent's **storage account** for `PUT` with `x-ms-blob-type` — the
same rule the Tests storage account carries for course resources.

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

## Not yet consumed

The knowledge-base surface itself — `POST /v1/knowledge-bases`,
`POST /v1/uploads` (mint, which names the collection at mint time and not at
commit), `PUT <sas>`, `POST /v1/uploads/{documentId}/commit`,
`POST /v1/knowledge-bases/{id}/documents` — is documented in the agent repo and
is **not** called from this dashboard yet. See
`PLAN_course-resources-to-knowledge-base.md` at the workspace root; it is blocked
on two agent-side increments (identity narrowing, and shared course-scoped
collections).

`mobile/medai-app/services/chat/agentV2/client.js` is a complete working client
for that surface and is the reference to port from, not to redesign.
