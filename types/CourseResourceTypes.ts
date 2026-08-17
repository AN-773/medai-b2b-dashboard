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

export interface CourseResourceUploadURLRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface CourseResourceUploadURLResponse {
  /** Time-limited URL the browser uploads the bytes to. */
  uploadUrl: string;
  /** Storage path of the upload; hand it back when committing. */
  uploadPath: string;
  expiresAt: string;
}

export interface CommitCourseResourceUploadRequest {
  uploadPath: string;
  fileName: string;
  fileType: string;
}

export interface UploadCourseResourceOptions {
  /** Called with 0-100 as the file streams to storage. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}
