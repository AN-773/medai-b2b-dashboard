/**
 * Types for the Course Learning Objective Suggestions workflow.
 *
 * Teachers upload course source files which the backend chunks and mines for
 * AI-generated learning objective candidates. Candidates are persisted as
 * `LearningObjectiveSuggestion` rows (never normal learning objectives) and only
 * become real course learning objectives once a teacher accepts them.
 *
 * See the backend "Course Learning Objective Suggestions Workflow" spec.
 */

export type CourseUploadStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/** Known processing stages, mirrored from the study-plan upload pipeline. */
export type CourseUploadStage = 'extracting_chunks' | 'extracting_los';

export interface CourseUploadProgress {
  stage?: CourseUploadStage | string;
  totalChunks?: number;
  processedChunks?: number;
}

export interface CourseUpload {
  /** Full resource ID (absolute URL). */
  id: string;
  /** Short upload identifier, used for batch action routes. */
  identifier: string;
  courseId: string;
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  status: CourseUploadStatus;
  progress?: CourseUploadProgress;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  pendingLearningObjectiveSuggestionsTotal?: number;
}

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export type SuggestionBloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

/** Allowed Bloom levels for the suggestion editor (backend-validated). */
export const SUGGESTION_BLOOM_LEVELS: SuggestionBloomLevel[] = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

export interface SuggestionEvidenceChunk {
  /** `document_chunks.id` */
  id: string;
  sourceFile?: string;
  heading?: string;
  chunkIndex?: number;
  content: string;
}

export interface LearningObjectiveSuggestion {
  /** Full resource ID (absolute URL). */
  id: string;
  /** Short suggestion identifier, used for action routes. */
  identifier: string;
  courseId: string;
  courseUploadId: string;
  title: string;
  bloomLevel: string;
  status: SuggestionStatus;
  acceptedLearningObjectiveId?: string;
  tenantId?: string;
  chunks: SuggestionEvidenceChunk[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AcceptSuggestionResponse {
  learningObjectiveId: string;
  suggestion: LearningObjectiveSuggestion;
}

export interface BatchReviewFailure {
  id: string;
  error: string;
}

export interface BatchReviewResult {
  accepted: number;
  rejected: number;
  failed: number;
  acceptedLearningObjectiveIds?: string[];
  failures?: BatchReviewFailure[];
}
