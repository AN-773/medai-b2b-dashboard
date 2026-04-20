export interface TeacherStudent {
  id: string;
  name: string;
  email: string;
  learnerCode: string;
  program?: string;
  notes?: string;
  source: 'manual' | 'spreadsheet' | 'backend';
  createdAt: string;
}

export interface TeacherLearningObjective {
  id: string;
  title: string;
  organSystem?: string;
  cognitiveSkill?: string;
  source: 'manual' | 'ai';
  createdAt: string;
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
  code: string;
  summary: string;
  learningObjectives: TeacherLearningObjective[];
  sourceFiles: CourseSourceFile[];
  contentDrafts: CourseContentDraft[];
  createdAt: string;
  updatedAt: string;
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
  courses: TeacherCourse[];
  cohorts: TeacherCohort[];
}
