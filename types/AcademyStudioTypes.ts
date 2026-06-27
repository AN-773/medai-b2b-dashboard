export interface TeacherStudent {
  id: string;
  accountId?: string;
  name: string;
  email: string;
  learnerCode: string;
  program?: string;
  notes?: string;
  source: 'manual' | 'spreadsheet' | 'backend';
  createdAt: string;
}

export interface ItemTypeTotals {
  total: number;
  byType: {
    mcq: number;
    saq: number;
    flashcard: number;
    lecture: number;
  };
}

export interface TeacherLearningObjective {
  id: string;
  title: string;
  organSystem?: string;
  cognitiveSkill?: string;
  source: 'manual' | 'ai';
  createdAt: string;
  /** Counts of linked content items, supplied by the backend per objective. */
  itemTotals?: ItemTypeTotals;
}

export interface CourseSourceFile {
  id: string;
  name: string;
  uploadedAt: string;
  uploadedFileId?: string;
}

export interface CourseContentDraft {
  id: string;
  title: string;
  objectives: string[];
}

export interface TeacherCourse {
  id: string;
  backendIdentifier?: string;
  title: string;
  teacherId?: string;
  tenantId?: string | null;
  curriculumId?: string | null;
  locked: boolean;
  summary: string;
  learningObjectivesTotal?: number;
  learningObjectivesWithoutItemsTotal?: number;
  pendingLearningObjectiveSuggestionsTotal?: number;
  learningObjectivesLoaded?: boolean;
  learningObjectives: TeacherLearningObjective[];
  contentDrafts: CourseContentDraft[];
  createdAt: string;
  updatedAt: string;
}

// Legacy prototype-only extension used by the old local Cohort Studio flow.
export interface TeacherCourseWithSources extends TeacherCourse {
  sourceFiles: CourseSourceFile[];
  modules?: CourseContentDraft[];
}

export interface CohortCourseSelection {
  courseId: string;
  learningObjectiveIds: string[];
}

export interface TeacherCohort {
  id: string;
  backendIdentifier?: string;
  title: string;
  term: string;
  description: string;
  startDate: string;
  endDate: string;
  studentIds: string[];
  courseIds: string[];
  courseSelections: CohortCourseSelection[];
  createdAt: string;
  updatedAt: string;
}

export type CohortStudyPlanJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CohortStudyPlanJob {
  id: string;
  identifier: string;
  cohortId: string;
  organizationId: string;
  triggerSource: string;
  status: CohortStudyPlanJobStatus;
  queuedCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportedStudentRow {
  name: string;
  email: string;
  learnerCode?: string;
  program?: string;
  notes?: string;
}

export interface AcademyStudioState {
  students: TeacherStudent[];
  courses: TeacherCourseWithSources[];
  cohorts: TeacherCohort[];
}
