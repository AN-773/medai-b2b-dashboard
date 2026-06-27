import { apiClient } from './apiClient';
import { resourceIdentifier } from '@/utils/resourceId';
import type {
  CourseResource,
  CourseResourceDownloadResponse,
  CourseResourceListResponse,
  ListCourseResourcesParams,
} from '@/types/CourseResourceTypes';

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
  ): Promise<CourseResourceListResponse> =>
    apiClient.get<CourseResourceListResponse>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/resources?${buildListQuery(params)}`,
    ),

  uploadTeacherCourseResources: async (
    courseIdentifier: string,
    files: File[],
  ): Promise<CourseResource[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('file', file));

    const response = await apiClient.post<UploadCourseResourcesResponse>(
      'TESTS',
      `/courses/${resourceIdentifier(courseIdentifier)}/resources`,
      formData,
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
