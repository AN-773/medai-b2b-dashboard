import { apiClient } from './apiClient';
import { courseStudioService } from './courseStudioService';
import { testsService } from './testsService';
import { ModuleGenerationRequestError } from './moduleGenerationErrors';
import {
  moduleGenerationMockControls,
  moduleGenerationMockData,
  moduleGenerationServiceMock,
} from './moduleGenerationService.mock';
import { resourceIdentifier } from '@/utils/resourceId';
import type { PaginatedApiResponse } from '@/types/TestsServiceTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type {
  AcceptModulePlanResponse,
  GenerateModulePlanRequest,
  ModuleGenerationEventListResponse,
  ModuleGenerationJob,
  ModuleGenerationService,
  ModulePlanDraft,
} from '@/types/ModuleGenerationTypes';

/**
 * AI module generation ("Create with AI" on the Modules tab), on the TESTS
 * service. See `contracts/course-ai-contract.md` ("Module generation").
 *
 * Path `{identifier}` params accept a bare identifier or an absolute id; they
 * are normalised with `resourceIdentifier`. Ids inside bodies stay absolute.
 */

/** Statuses whose body the UI needs (`staleIds`, the open job, `issues`). */
const STATUSES_WITH_BODY = new Set([400, 409]);

/**
 * Send a request and keep the body of a `400` / `409`. `apiClient` still
 * handles auth, `401` and every other error.
 */
const send = async <T,>(
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  body?: unknown,
): Promise<T> => {
  let status = 0;
  const options = {
    validateStatus: (code: number) => {
      status = code;
      return (code >= 200 && code < 300) || STATUSES_WITH_BODY.has(code);
    },
  };
  const data =
    method === 'GET'
      ? await apiClient.get<unknown>('TESTS', endpoint, options)
      : method === 'POST'
        ? await apiClient.post<unknown>('TESTS', endpoint, body ?? {}, options)
        : await apiClient.put<unknown>('TESTS', endpoint, body, options);
  if (STATUSES_WITH_BODY.has(status)) throw new ModuleGenerationRequestError(status, data);
  return data as T;
};

const jobPath = (jobIdentifier: string, suffix = '') =>
  `/module-generation-jobs/${resourceIdentifier(jobIdentifier)}${suffix}`;

const liveModuleGenerationService: ModuleGenerationService = {
  getOpenJob: async (courseIdentifier) => {
    const search = new URLSearchParams({ kind: 'modules', open: 'true', limit: '1' });
    const response = await apiClient.get<PaginatedApiResponse<CourseGenerationJob>>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/generation-jobs?${search.toString()}`,
    );
    return response.items?.[0] || null;
  },

  startGeneration: async (courseIdentifier, options) => {
    const request: GenerateModulePlanRequest = { moduleGeneration: options };
    return send<CourseGenerationJob>(
      'POST',
      `/courses/${resourceIdentifier(courseIdentifier)}/module-plans/generate`,
      request,
    );
  },

  getJob: async (jobIdentifier) => send<ModuleGenerationJob>('GET', jobPath(jobIdentifier)),

  listEvents: async (jobIdentifier, params = {}) => {
    const search = new URLSearchParams();
    search.append('afterSeq', String(params.afterSeq ?? 0));
    if (params.limit !== undefined) search.append('limit', String(params.limit));
    return send<ModuleGenerationEventListResponse>(
      'GET',
      jobPath(jobIdentifier, `/events?${search.toString()}`),
    );
  },

  cancel: async (jobIdentifier) =>
    send<CourseGenerationJob>('POST', jobPath(jobIdentifier, '/cancel')),

  updatePlan: async (jobIdentifier, request) =>
    send<ModulePlanDraft>('PUT', jobPath(jobIdentifier, '/plan'), request),

  accept: async (jobIdentifier, request) =>
    send<AcceptModulePlanResponse>('POST', jobPath(jobIdentifier, '/accept'), request),

  discard: async (jobIdentifier) =>
    send<CourseGenerationJob>('POST', jobPath(jobIdentifier, '/discard')),
};

// ---------------------------------------------------------------------------
// Course data the wizard reads through existing services
// ---------------------------------------------------------------------------

const ITEM_FETCH_CONCURRENCY = 4;

/**
 * Reads the wizard needs beyond the module generation routes: the course's
 * completed uploads (file picker, source file names) and the existing items a
 * plan references (review tree titles and previews). The mock serves its own
 * fake files and items so the draft it produces resolves.
 */
export interface ModuleGenerationCourseData {
  listCompletedUploads(courseIdentifier: string): Promise<CourseUpload[]>;
  /** Missing or unreadable items map to `null`. */
  getItems(itemIds: string[]): Promise<Record<string, BackendApiItem | null>>;
}

const liveCourseData: ModuleGenerationCourseData = {
  listCompletedUploads: async (courseIdentifier) => {
    const uploads = await courseStudioService.listUploads(courseIdentifier, {
      status: 'completed',
    });
    return uploads.filter((upload) => upload.status === 'completed');
  },

  getItems: async (itemIds) => {
    const result: Record<string, BackendApiItem | null> = {};
    for (let index = 0; index < itemIds.length; index += ITEM_FETCH_CONCURRENCY) {
      const chunk = itemIds.slice(index, index + ITEM_FETCH_CONCURRENCY);
      const loaded = await Promise.all(
        chunk.map((id) =>
          testsService.getItem(resourceIdentifier(id)).catch(() => null),
        ),
      );
      chunk.forEach((id, position) => {
        result[id] = loaded[position];
      });
    }
    return result;
  },
};

/**
 * DEMO: serve in-memory fake jobs so the whole "Create with AI" flow is
 * clickable before the backend ships. The mock and the live client implement
 * the same `ModuleGenerationService` interface, so this flag is the only switch.
 *
 * `VITE_MODULE_GENERATION_MOCK=true` enables it; when unset it follows
 * `VITE_COURSE_AI_MOCK`. Both default to the live backend.
 */
const env = (import.meta as any).env ?? {};
export const MODULE_GENERATION_MOCK_ENABLED =
  (env.VITE_MODULE_GENERATION_MOCK ?? env.VITE_COURSE_AI_MOCK ?? 'false') !== 'false';

export const moduleGenerationService: ModuleGenerationService = MODULE_GENERATION_MOCK_ENABLED
  ? moduleGenerationServiceMock
  : liveModuleGenerationService;

export const moduleGenerationCourseData: ModuleGenerationCourseData =
  MODULE_GENERATION_MOCK_ENABLED ? moduleGenerationMockData : liveCourseData;

/** Scenario picker for the mock; `null` against the real backend. */
export const moduleGenerationMock = MODULE_GENERATION_MOCK_ENABLED
  ? moduleGenerationMockControls
  : null;
