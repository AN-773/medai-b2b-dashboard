import { apiClient } from './apiClient';
import { resourceIdentifier } from '@/utils/resourceId';
import { uploadFileToBlobUrl } from '@/utils/blockBlobUpload';
import type { CourseResourceProcessingAction } from '@/types/DocumentProcessing';
import type {
  CourseResource,
  CourseResourceDownloadResponse,
  CourseResourceKnowledgeBaseSyncResponse,
  CourseResourceKnowledgeProcessingResponse,
  CourseResourceListResponse,
  CourseResourceUploadURLResponse,
  ListCourseResourcesParams,
  UploadCourseResourceOptions,
} from '@/types/CourseResourceTypes';

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: number }).status)
    : undefined;

const buildListQuery = (params: ListCourseResourcesParams = {}) => {
  const search = new URLSearchParams();
  search.append('limit', String(params.limit ?? 25));
  search.append('page', String(params.page ?? 1));
  return search.toString();
};

interface UploadCourseResourcesResponse {
  resources?: CourseResource[];
}

export const courseResourceService = {
  listTeacherCourseResources: async (
    courseIdentifier: string,
    params: ListCourseResourcesParams = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<CourseResourceListResponse> =>
    apiClient.get<CourseResourceListResponse>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/resources?${buildListQuery(params)}`,
      { signal: options.signal, timeout: 30_000 },
    ),

  /**
   * Uploads one file straight to blob storage.
   *
   * The bytes bypass the Tests service entirely: it signs a URL, the browser
   * pushes to storage, and a commit call records the resource. Streaming a
   * multi-gigabyte lecture video through the API instead would buffer the whole
   * file to the container's temp disk before any of it reached storage.
   *
   * Falls back to the multipart endpoint only when the backend answers 501,
   * which is how it reports a file store that cannot sign upload URLs (local
   * dev). Any other failure surfaces, so a misconfigured storage account is not
   * quietly papered over by the slow path.
   */
  uploadTeacherCourseResource: async (
    courseIdentifier: string,
    file: File,
    options: UploadCourseResourceOptions = {},
  ): Promise<CourseResource[]> => {
    const identifier = resourceIdentifier(courseIdentifier);
    const fileType = file.type || 'application/octet-stream';

    let mint: CourseResourceUploadURLResponse;
    try {
      mint = await apiClient.post<CourseResourceUploadURLResponse>(
        'TESTS',
        `/courses/${identifier}/resources/upload-url`,
        { fileName: file.name, fileType, fileSize: file.size },
        { signal: options.signal },
      );
    } catch (error) {
      if (statusOf(error) === 501) {
        return courseResourceService.uploadTeacherCourseResourceViaApi(
          courseIdentifier,
          file,
          options,
        );
      }
      throw error;
    }

    await uploadFileToBlobUrl(mint.uploadUrl, file, {
      signal: options.signal,
      onProgress: options.onProgress
        ? (uploadedBytes) => {
            if (!file.size) return;
            options.onProgress?.(
              Math.min(100, Math.round((uploadedBytes / file.size) * 100)),
            );
          }
        : undefined,
    });

    const response = await apiClient.post<UploadCourseResourcesResponse>(
      'TESTS',
      `/courses/${identifier}/resources/commit`,
      { uploadPath: mint.uploadPath, fileName: file.name, fileType },
      { signal: options.signal },
    );

    options.onProgress?.(100);
    return response.resources ?? [];
  },

  /**
   * Streams a file through the Tests service. Only used when direct upload is
   * unavailable — it holds the whole file in the request body, so it is a poor
   * fit for video.
   */
  uploadTeacherCourseResourceViaApi: async (
    courseIdentifier: string,
    file: File,
    options: UploadCourseResourceOptions = {},
  ): Promise<CourseResource[]> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<UploadCourseResourcesResponse>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/resources`,
      formData,
      {
        signal: options.signal,
        onUploadProgress: (event) => {
          const onProgress = options.onProgress;
          if (!onProgress) return;
          const total = event.total ?? file.size;
          if (!total) return;
          onProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
        },
      },
    );

    return response.resources ?? [];
  },

  /**
   * Asks the Tests service to (re)send this course's resources to the tutor
   * (Contract T2): anything `not_synced` or `failed`, plus study plans not yet
   * linked. Idempotent, and it only queues — statuses move on later reads.
   *
   * `'unsupported'` for 404 and 501: the Tests service has no agent configured,
   * or predates the route. Either way the caller should stop offering the
   * action rather than show an error. Any other failure throws.
   */
  syncTeacherCourseResourcesToTutor: async (
    courseIdentifier: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<'accepted' | 'unsupported'> => {
    try {
      await apiClient.post<CourseResourceKnowledgeBaseSyncResponse>(
        'TESTS',
        `/courses/${resourceIdentifier(courseIdentifier)}/resources/knowledge-base/sync`,
        undefined,
        { signal: options.signal, timeout: 30_000 },
      );
      return 'accepted';
    } catch (error) {
      const status = statusOf(error);
      if (status === 404 || status === 501) return 'unsupported';
      throw error;
    }
  },

  /** Tests owns authorization and the agent credential. Acknowledgment is not completion.
   * The Tests base URL includes its deployment prefix (normally /local).
   * Do not prepend /local again or send the browser directly to the agent.
   */
  requestTeacherCourseResourceProcessing: async (
    courseIdentifier: string,
    courseResourceIdentifier: string,
    action: CourseResourceProcessingAction,
    options: { signal?: AbortSignal } = {},
  ): Promise<CourseResourceKnowledgeProcessingResponse> => {
    return apiClient.post<CourseResourceKnowledgeProcessingResponse>(
      'TESTS',
      `/courses/${encodeURIComponent(resourceIdentifier(courseIdentifier))}/resources/${encodeURIComponent(resourceIdentifier(courseResourceIdentifier))}/knowledge-base/${action}`,
      undefined,
      { signal: options.signal, timeout: 30_000 },
    );
  },

  deleteTeacherCourseResource: async (
    courseIdentifier: string,
    courseResourceIdentifier: string,
  ): Promise<void> => {
    await apiClient.delete<void>(
      'TESTS',
      `/courses/${resourceIdentifier(
        courseIdentifier,
      )}/resources/${resourceIdentifier(courseResourceIdentifier)}`,
    );
  },

  listStudyPlanResources: async (
    studyPlanIdentifier: string,
    params: ListCourseResourcesParams = {},
  ): Promise<CourseResourceListResponse> =>
    apiClient.get<CourseResourceListResponse>(
      'TESTS',
      `/study-plans/${resourceIdentifier(studyPlanIdentifier)}/resources?${buildListQuery(
        params,
      )}`,
    ),

  getStudyPlanResourceDownload: async (
    studyPlanIdentifier: string,
    resourceId: string,
  ): Promise<CourseResourceDownloadResponse> =>
    apiClient.get<CourseResourceDownloadResponse>(
      'TESTS',
      `/study-plans/${resourceIdentifier(
        studyPlanIdentifier,
      )}/resources/${resourceIdentifier(resourceId)}/download`,
    ),
};
