import { apiClient } from './apiClient';
import { resourceIdentifier } from '@/utils/resourceId';
import { courseAIServiceMock } from './courseAIService.mock';
import type { PaginatedApiResponse } from '@/types/TestsServiceTypes';
import type {
  AcceptItemSuggestionResponse,
  CourseAIService,
  CourseGenerationJob,
  CourseGenerationKind,
  GenerateItemSuggestionsRequest,
  ItemSuggestion,
  ItemSuggestionBatchResult,
  ItemSuggestionDraft,
  ListItemSuggestionsParams,
} from '@/types/CourseAITypes';

/**
 * AI content factory: AI-drafted content items (MCQ / SAQ / flashcard / lecture)
 * generated per learning objective, reviewed and accepted by the teacher.
 *
 * Everything lives on the TESTS service (alongside `/courses`). Path
 * `{identifier}` params accept either the short identifier or a full absolute
 * URL id — we normalise to the trailing slug via `resourceIdentifier`. IDs used
 * in query filters and request-body id fields are the absolute URL `id`.
 *
 * See `contracts/course-ai-contract.md`.
 */

const liveCourseAIService: CourseAIService = {
  // --- Generation jobs -----------------------------------------------------

  /** Latest generation job of a given kind, or `null` when none exists. */
  getLatestGenerationJob: async (
    courseIdentifier: string,
    kind: CourseGenerationKind,
  ): Promise<CourseGenerationJob | null> => {
    const search = new URLSearchParams();
    search.append('kind', kind);
    search.append('limit', '1');
    const response = await apiClient.get<
      PaginatedApiResponse<CourseGenerationJob>
    >(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/generation-jobs?${search.toString()}`,
    );
    return response.items?.[0] || null;
  },

  // --- Item factory --------------------------------------------------------

  /** Enqueue an item generation job for one or more learning objectives. */
  generateItemSuggestions: async (
    courseIdentifier: string,
    request: GenerateItemSuggestionsRequest,
  ): Promise<CourseGenerationJob> =>
    apiClient.post<CourseGenerationJob>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/item-suggestions/generate`,
      { itemGeneration: request },
    ),

  /** Enqueue an item generation job scoped to a single learning objective. */
  generateItemSuggestionsForObjective: async (
    learningObjectiveIdentifier: string,
    request: GenerateItemSuggestionsRequest,
  ): Promise<CourseGenerationJob> =>
    apiClient.post<CourseGenerationJob>(
      'TESTS',
      `/learning-objectives/${resourceIdentifier(learningObjectiveIdentifier)}/item-suggestions/generate`,
      { itemGeneration: request },
    ),

  /** List item suggestions with their draft payloads and evidence chunks. */
  listItemSuggestions: async (
    courseIdentifier: string,
    params: ListItemSuggestionsParams = {},
  ): Promise<PaginatedApiResponse<ItemSuggestion>> => {
    const search = new URLSearchParams();
    if (params.learningObjectiveId)
      search.append('learningObjectiveId', params.learningObjectiveId);
    if (params.jobId) search.append('jobId', params.jobId);
    if (params.status) search.append('status', params.status);
    if (params.type) search.append('type', params.type);
    search.append('limit', String(params.limit ?? 100));
    search.append('page', String(params.page ?? 1));

    return apiClient.get<PaginatedApiResponse<ItemSuggestion>>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/item-suggestions?${search.toString()}`,
    );
  },

  /** Edit the draft payload of a pending suggestion. */
  patchItemSuggestion: async (
    suggestionIdentifier: string,
    draft: Partial<ItemSuggestionDraft>,
  ): Promise<ItemSuggestion> =>
    apiClient.patch<ItemSuggestion>(
      'TESTS',
      `/item-suggestions/${resourceIdentifier(suggestionIdentifier)}`,
      { itemSuggestion: { draft } },
    ),

  /** Promote one pending suggestion to a real course item. */
  acceptItemSuggestion: async (
    suggestionIdentifier: string,
  ): Promise<AcceptItemSuggestionResponse> =>
    apiClient.post<AcceptItemSuggestionResponse>(
      'TESTS',
      `/item-suggestions/${resourceIdentifier(suggestionIdentifier)}/accept`,
      {},
    ),

  /** Reject one pending suggestion (terminal). */
  rejectItemSuggestion: async (
    suggestionIdentifier: string,
  ): Promise<ItemSuggestion> =>
    apiClient.post<ItemSuggestion>(
      'TESTS',
      `/item-suggestions/${resourceIdentifier(suggestionIdentifier)}/reject`,
      {},
    ),

  /** Accept all pending item suggestions for a learning objective. */
  acceptAllForObjective: async (
    learningObjectiveIdentifier: string,
  ): Promise<ItemSuggestionBatchResult> =>
    apiClient.post<ItemSuggestionBatchResult>(
      'TESTS',
      `/learning-objectives/${resourceIdentifier(learningObjectiveIdentifier)}/item-suggestions/accept-all`,
      {},
    ),

  /** Reject all pending item suggestions for a learning objective. */
  rejectAllForObjective: async (
    learningObjectiveIdentifier: string,
  ): Promise<ItemSuggestionBatchResult> =>
    apiClient.post<ItemSuggestionBatchResult>(
      'TESTS',
      `/learning-objectives/${resourceIdentifier(learningObjectiveIdentifier)}/item-suggestions/reject-all`,
      {},
    ),

  /** Accept all pending item suggestions produced by a generation job. */
  acceptAllForJob: async (
    jobIdentifier: string,
  ): Promise<ItemSuggestionBatchResult> =>
    apiClient.post<ItemSuggestionBatchResult>(
      'TESTS',
      `/item-generation-jobs/${resourceIdentifier(jobIdentifier)}/item-suggestions/accept-all`,
      {},
    ),

  /** Reject all pending item suggestions produced by a generation job. */
  rejectAllForJob: async (
    jobIdentifier: string,
  ): Promise<ItemSuggestionBatchResult> =>
    apiClient.post<ItemSuggestionBatchResult>(
      'TESTS',
      `/item-generation-jobs/${resourceIdentifier(jobIdentifier)}/item-suggestions/reject-all`,
      {},
    ),
};

/**
 * DEMO: serve in-memory fake data so the AI content factory UI is fully
 * clickable without the backend. The mock and the live client both implement
 * the `CourseAIService` interface, so flipping this flag is the only change
 * needed once the endpoints in `contracts/course-ai-contract.md` are live.
 *
 * Override at build/run time with `VITE_COURSE_AI_MOCK=false` to hit the real
 * backend, or delete the mock import and the ternary to remove the demo path.
 */
const USE_MOCK_COURSE_AI =
  ((import.meta as any).env?.VITE_COURSE_AI_MOCK ?? 'false') !== 'false';

export const courseAIService: CourseAIService = USE_MOCK_COURSE_AI
  ? courseAIServiceMock
  : liveCourseAIService;
