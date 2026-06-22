import { apiClient } from './apiClient';
import { resourceIdentifier } from '@/utils/resourceId';
import type { PaginatedApiResponse } from '@/types/TestsServiceTypes';
import type {
  AcceptSuggestionResponse,
  BatchReviewResult,
  CourseUpload,
  CourseUploadStatus,
  LearningObjectiveSuggestion,
  SuggestionStatus,
} from '@/types/CourseStudioTypes';

/**
 * Course Learning Objective Suggestions workflow.
 *
 * Uploads, suggestion review, and accept/reject actions all live on the TESTS
 * service (alongside `/courses`). Path `{identifier}` params accept either the
 * short identifier or a full absolute URL id — we normalise to the trailing
 * slug via `resourceIdentifier`.
 */

const TEST_BASE_URL =
  (import.meta as any).env?.VITE_TEST_API_URL || 'http://localhost:3000/tests';

interface ListSuggestionsParams {
  status?: SuggestionStatus;
  /** Full course upload ID or short course upload identifier. */
  uploadId?: string;
  page?: number;
  limit?: number;
}

interface ListUploadsParams {
  status?: CourseUploadStatus;
  page?: number;
  limit?: number;
}

interface ListUploadsResponse {
  uploads?: CourseUpload[];
  items?: CourseUpload[];
  total?: number;
  page?: number;
}

interface ListUploadsPage {
  items: CourseUpload[];
  total?: number;
  page: number;
}

const buildUploadsEndpoint = (
  courseIdentifier: string,
  params: ListUploadsParams = {},
) => {
  const search = new URLSearchParams();
  if (params.status) search.append('status', params.status);
  if (params.limit !== undefined) search.append('limit', String(params.limit));
  if (params.page !== undefined) search.append('page', String(params.page));

  const query = search.toString();
  return `/courses/${resourceIdentifier(courseIdentifier)}/uploads${
    query ? `?${query}` : ''
  }`;
};

const normalizeUploadsPage = (
  response: ListUploadsResponse | CourseUpload[],
  fallbackPage: number,
): ListUploadsPage => {
  if (Array.isArray(response)) {
    return {
      items: response,
      page: fallbackPage,
    };
  }

  return {
    items: response.uploads || response.items || [],
    total: typeof response.total === 'number' ? response.total : undefined,
    page: typeof response.page === 'number' ? response.page : fallbackPage,
  };
};

const dedupeUploads = (uploads: CourseUpload[]) => {
  const seen = new Set<string>();

  return uploads.filter((upload) => {
    if (seen.has(upload.id)) return false;
    seen.add(upload.id);
    return true;
  });
};

const listUploadsPage = async (
  courseIdentifier: string,
  params: ListUploadsParams = {},
): Promise<ListUploadsPage> => {
  const page = params.page ?? 1;
  const response = await apiClient.get<ListUploadsResponse | CourseUpload[]>(
    'TESTS',
    buildUploadsEndpoint(courseIdentifier, params),
  );

  return normalizeUploadsPage(response, page);
};

const listAllUploads = async (
  courseIdentifier: string,
  params: ListUploadsParams = {},
): Promise<CourseUpload[]> => {
  const page = params.page ?? 1;
  const limit = params.limit ?? 100;
  const firstPage = await listUploadsPage(courseIdentifier, {
    ...params,
    limit,
    page,
  });

  let items = firstPage.items;

  if (limit <= 0) return dedupeUploads(items);

  if (typeof firstPage.total === 'number') {
    const totalPages = Math.ceil(firstPage.total / limit);

    if (totalPages > firstPage.page) {
      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - firstPage.page }, (_, index) =>
          listUploadsPage(courseIdentifier, {
            ...params,
            limit,
            page: firstPage.page + index + 1,
          }),
        ),
      );

      items = items.concat(
        remainingPages.flatMap((pageResult) => pageResult.items),
      );
    }

    return dedupeUploads(items);
  }

  let lastPageItems = firstPage.items;
  let nextPage = firstPage.page + 1;

  while (lastPageItems.length === limit) {
    const pageResult = await listUploadsPage(courseIdentifier, {
      ...params,
      limit,
      page: nextPage,
    });
    lastPageItems = pageResult.items;

    if (lastPageItems.length === 0) break;

    items = items.concat(lastPageItems);
    nextPage += 1;
  }

  return dedupeUploads(items);
};

export const courseStudioService = {
  /**
   * Upload one or more course source files. Starts background extraction and
   * returns the created `CourseUpload` rows (status `pending`).
   *
   * Uses `fetch` directly so the browser sets the multipart boundary header,
   * mirroring `testsService.uploadFile`.
   */
  uploadCourseFiles: async (
    courseIdentifier: string,
    files: File[],
  ): Promise<CourseUpload[]> => {
    const token = localStorage.getItem('msai_educator_token');
    const formData = new FormData();
    files.forEach((file) => formData.append('file', file));

    const response = await fetch(
      `${TEST_BASE_URL}/courses/${resourceIdentifier(courseIdentifier)}/uploads`,
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      },
    );

    if (!response.ok) {
      let message = `Upload failed with status ${response.status}`;
      try {
        const data = await response.json();
        message = data?.message?.trim() || data?.error?.trim() || message;
      } catch {
        /* keep default message */
      }
      throw new Error(message);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  },

  /**
   * List the course's uploads with their processing status (`pending` /
   * `processing` / `completed` / `failed`). Used to show what is ready vs. still
   * being processed, independent of whether suggestions have landed yet.
   */
  listUploadsPage,

  /** Load every upload page so older uploads stay reachable in the sidebar. */
  listUploads: listAllUploads,

  /** List course suggestions with full evidence chunks. */
  listSuggestions: async (
    courseIdentifier: string,
    params: ListSuggestionsParams = {},
  ): Promise<PaginatedApiResponse<LearningObjectiveSuggestion>> => {
    const search = new URLSearchParams();
    if (params.status) search.append('status', params.status);
    if (params.uploadId) search.append('uploadId', params.uploadId);
    search.append('limit', String(params.limit ?? 100));
    search.append('page', String(params.page ?? 1));

    return apiClient.get<PaginatedApiResponse<LearningObjectiveSuggestion>>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/learning-objective-suggestions?${search.toString()}`,
    );
  },

  /** Edit title and/or Bloom level for a pending suggestion. */
  patchSuggestion: async (
    suggestionIdentifier: string,
    payload: { title?: string; bloomLevel?: string },
  ): Promise<LearningObjectiveSuggestion> =>
    apiClient.patch<LearningObjectiveSuggestion>(
      'TESTS',
      `/learning-objective-suggestions/${resourceIdentifier(suggestionIdentifier)}`,
      payload,
    ),

  /** Promote one pending suggestion to a real course learning objective. */
  acceptSuggestion: async (
    suggestionIdentifier: string,
  ): Promise<AcceptSuggestionResponse> =>
    apiClient.post<AcceptSuggestionResponse>(
      'TESTS',
      `/learning-objective-suggestions/${resourceIdentifier(suggestionIdentifier)}/accept`,
      {},
    ),

  /** Reject one pending suggestion (terminal). */
  rejectSuggestion: async (
    suggestionIdentifier: string,
  ): Promise<LearningObjectiveSuggestion> =>
    apiClient.post<LearningObjectiveSuggestion>(
      'TESTS',
      `/learning-objective-suggestions/${resourceIdentifier(suggestionIdentifier)}/reject`,
      {},
    ),

  /** Accept all pending suggestions for an upload. */
  acceptAllForUpload: async (
    uploadIdentifier: string,
  ): Promise<BatchReviewResult> =>
    apiClient.post<BatchReviewResult>(
      'TESTS',
      `/course-uploads/${resourceIdentifier(uploadIdentifier)}/learning-objective-suggestions/accept-all`,
      {},
    ),

  /** Reject all pending suggestions for an upload. */
  rejectAllForUpload: async (
    uploadIdentifier: string,
  ): Promise<BatchReviewResult> =>
    apiClient.post<BatchReviewResult>(
      'TESTS',
      `/course-uploads/${resourceIdentifier(uploadIdentifier)}/learning-objective-suggestions/reject-all`,
      {},
    ),
};
