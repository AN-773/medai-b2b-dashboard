---
name: api-contracts
description: Backend API contracts live in contracts/*.md — consult the relevant contract before writing or modifying service modules, request/response types, or anything that calls the backend
user-invocable: false
---

# Backend API Contracts

This repo keeps frontend-facing API contracts in `contracts/`. They are the **source of truth for payload shapes** — do not invent or guess endpoint paths, request bodies, or response fields from existing code alone, and do not "fix" a type mismatch by changing a type to match code without checking the contract first.

## Contract → code mapping

| Contract | Covers | Main consumers |
|----------|--------|----------------|
| `contracts/agent-v2-contract.md` | Tutor agent (AGENT_V2): the one route the dashboard calls (`GET /v1/documents/formats`), the 150 MiB ingestion ceiling, CORS origins, and the decision that the dashboard never calls knowledge-base, upload, thread or reader routes (the Tests service is the sole writer). Optional service — gated on `agentV2Service.isConfigured()` | `services/agentV2Service.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx` |
| `contracts/course-ai-contract.md` | AI content factory: AI-drafted MCQ/SAQ/flashcard/lecture items per learning objective (TESTS service) | `services/courseAIService.ts`, `services/courseStudioService.ts` |
| `contracts/course-resources-contract.md` | Learner-visible course files: direct-to-storage upload (mint/commit), multipart fallback, listing, delete, and the tutor knowledge base — `CourseResource.knowledgeBase` status (T1), the course-level sync route (T2) and the async guarantees (T3) (TESTS service) | `services/courseResourceService.ts`, `types/CourseResourceTypes.ts`, `utils/blockBlobUpload.ts`, `components/academy/course-workbench/CourseResourcesPanel.tsx` |
| `contracts/curriculum-api-contract.md` | Curriculum grouping and curriculum links on organ systems, learning objectives, courses | `services/curriculumService.ts` |
| `contracts/prompts-contract.md` | Prompt management endpoints | prompt-related service code |
| `contracts/study-plan-audit-contract.md` | Study plan audit endpoints | `services/studyPlanAuditService.ts` |

## Rules

- Before adding or changing a function in `services/*`, read the matching contract section and mirror its exact endpoint path, method, and payload shape.
- Backend-aligned TypeScript types (`types/TestsServiceTypes.tsx`, service-local interfaces) must match the contract, not the other way around.
- Backend entity `id` fields are absolute URLs; the last path segment is the identifier/slug.
- If the contract and the backend's actual behavior disagree, or the contract lacks the endpoint you need, say so explicitly instead of guessing — the contract may need updating first.
