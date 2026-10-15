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

The dashboard calls exactly one route here from a browser —
`GET /v1/documents/formats` — and that call needs the dashboard's origin in the
agent's `API_CORS_ORIGINS`:

| Origin | Environments |
|--------|--------------|
| `https://blue-sky-077e8120f.2.azurestaticapps.net` | test, prod |
| `https://icy-moss-06fa7900f.7.azurestaticapps.net` | test, prod |
| `http://localhost:5173` (`pnpm run dev`) | test only |
| `https://dashboard.medicalstudent.ai` | only once the product owner confirms it is the production host |

The two Static Web App hosts are the ones named in `.github/workflows/`. **No CORS
rule on the agent's storage account is needed**: the dashboard never uploads bytes
to the agent (see *Not called from this dashboard* below).

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

## Not called from this dashboard — by decision

The dashboard **never** calls the agent's knowledge-base, upload, thread or reader
routes: not `POST /v1/knowledge-bases`, not `POST /v1/uploads` or its commit, not
a `PUT` to an agent SAS URL, not `/v1/threads/:threadId/knowledge-bases`, not
`/v1/knowledge-bases/:id/readers`. `GET /v1/documents/formats` is the only agent
route it uses. Do not port `mobile/medai-app/services/chat/agentV2/client.js`.

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
