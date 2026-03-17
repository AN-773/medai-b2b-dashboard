# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install        # Install dependencies
pnpm run dev        # Start dev server (Vite, port 3000)
pnpm run build      # Production build (TypeScript check + Vite bundle)
pnpm run preview    # Preview production build
```

No test runner or linter is configured.

## Architecture

**MSAi Educator Dashboard** — a React 19 + TypeScript medical education platform built with Vite. It communicates with three backend microservices (IAM, Tutor, Tests) via REST APIs.

### API Layer

`services/apiClient.ts` — Axios-based client with three service types (`IAM`, `TUTOR`, `TESTS`). Base URLs are set via environment variables:
- `VITE_IAM_API_URL` — Identity/auth service
- `VITE_TUTOR_API_URL` — Content/learning service
- `VITE_TEST_API_URL` — Tests/questions service

Auth token stored in `localStorage` as `msai_educator_token`, auto-injected on requests. 401 responses trigger redirect to `/login`.

Service modules in `services/`: `iamService`, `tutorService`, `testsService`, `questionService`, `geminiService` (Google Gemini integration).

### State Management

Context API only (no Redux/Zustand):
- `AuthContext` — authentication state, login/logout
- `GlobalContext` — shared data like cognitive skills (depends on AuthContext)

Provider nesting order in `index.tsx`: BrowserRouter → AuthProvider → GlobalProvider.

Complex domain state lives in custom hooks: `useCurriculum` (curriculum operations), `useQuestionEditorData` (question editing).

### Routing

React Router v7 in `App.tsx`. `DashboardLayout` wraps all authenticated routes with a sidebar. `ProtectedRoute` guards auth. Routes map to view components in `views/`. The `View` enum in `types.ts` defines all dashboard views.

### Styling

Tailwind CSS 3 with utility-first approach. Global styles in `index.css` (custom scrollbars, gradient utilities, primary button class). Icons from `lucide-react`. Font: Inter.

### Type System

`types.ts` — core domain types (enums for View, OrganSystem, Discipline, BloomTaxonomy, QuestionType; interfaces for questions, taxonomy, psychometrics).

`types/TestsServiceTypes.tsx` — backend-aligned types for the Tests service API responses, including `PaginatedApiResponse<T>`.

### Key Conventions

- Path alias: `@/*` maps to project root (configured in `vite.config.ts` and `tsconfig.json`)
- All components are functional TypeScript components using hooks
- Large editor components (`QuestionEditor`, `LectureCreationWizard`) manage complex local state with `useState`/`useEffect`
- Query parameters pass context between views (e.g., `?questionId=QID-123`)
