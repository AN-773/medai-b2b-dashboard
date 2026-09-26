import { apiClient } from './apiClient';
import { resourceIdentifier } from '@/utils/resourceId';
import { uploadToSignedTarget } from '@/utils/storageUpload';
import type { S3MultipartApi } from '@/utils/s3MultipartUpload';
import type {
  CourseResource,
  CourseResourceDownloadResponse,
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

/**
 * S3 multipart endpoints for one course (STORAGE-S3-CONTRACT.md §5), used for
 * files over 64 MiB when the upload-url response says `provider: "s3"`.
 */
export const courseResourceMultipartApi = (courseIdentifier: string): S3MultipartApi => {
  const base = `/courses/${resourceIdentifier(courseIdentifier)}/resources/uploads/multipart`;
  return {
    create: (request, signal) =>
      apiClient.post('TESTS', base, request, { signal }),
    getPartUrls: async (uploadId, key, partNumbers, signal) => {
      const response = await apiClient.post<{ parts?: { partNumber: number; url: string }[] }>(
        'TESTS',
        `${base}/${encodeURIComponent(uploadId)}/parts`,
        { key, partNumbers },
        { signal },
      );
      return response.parts ?? [];
    },
    complete: (uploadId, key, parts, signal) =>
      apiClient.post('TESTS', `${base}/${encodeURIComponent(uploadId)}/complete`, { key, parts }, { signal }),
    abort: async (uploadId, key) => {
      await apiClient.delete<void>(
        'TESTS',
        `${base}/${encodeURIComponent(uploadId)}?key=${encodeURIComponent(key)}`,
      );
    },
  };
};

export const courseResourceService = {
  listTeacherCourseResources: async (
    courseIdentifier: string,
    params: ListCourseResourcesParams = {},
  ): Promise<CourseResourceListResponse> =>
    apiClient.get<CourseResourceListResponse>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/resources?${buildListQuery(params)}`,
    ),

  /**
   * Uploads one file straight to blob storage.
   *
   * The bytes bypass the Tests service entirely: it signs a URL, the browser
   * pushes to storage, and a commit call records the resource. Streaming a
   * multi-gigabyte lecture video through the API instead would buffer the whole
   * file to the container's temp disk before any of it reached storage.
   *
   * The mint response's `provider` picks the storage protocol (Azure SAS or
   * S3 presigned; see utils/storageUpload.ts). Old servers omit it: Azure.
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

    // The mint response says which store the URL is for; see utils/storageUpload.ts.
    const { key: uploadPath } = await uploadToSignedTarget(mint, file, {
      multipartApi: courseResourceMultipartApi(courseIdentifier),
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
      { uploadPath, fileName: file.name, fileType },
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
