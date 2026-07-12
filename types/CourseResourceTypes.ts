export interface CourseResource {
  id: string;
  identifier: string;
  courseId: string | null;
  fileId: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseResourceListResponse {
  resources: CourseResource[];
  total: number;
  page: number;
}

export interface CourseResourceDownloadResponse {
  url: string;
  expiresAt: string;
}

export interface ListCourseResourcesParams {
  page?: number;
  limit?: number;
}
