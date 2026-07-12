export type CohortMetricsStatus = 'behind' | 'on_track' | 'ahead';

export interface CohortMetricsScalars {
  mastery: number;
  coverage: number;
  pacing: number;
  readiness: number;
}

export interface CohortMetricsUniverse {
  los: number;
  items: number;
  loIds?: string[];
}

export interface CohortMetricsWindow {
  startsAt: string | null;
  endsAt: string | null;
  now: string;
  elapsedFraction: number;
  daysElapsed: number;
  daysRemaining: number;
  expectedLOsCovered: number;
  expectedLOsByNow?: number;
  expectedSessionsByNow?: number;
}

export interface CohortMetricsProgress {
  losTouched: number;
  itemsAnswered: number;
  itemsCorrect: number;
  itemsIncorrect: number;
  sessionsTotal?: number;
  sessionsCompleted?: number;
  sessionsDue?: number;
  sessionsRemaining?: number;
  lastAnsweredAt?: string;
}

export interface LearnerLOBreakdown {
  loId: string;
  loTitle: string;
  itemsTotal: number;
  itemsAnswered: number;
  itemsCorrect: number;
  mastery: number;
  touched: boolean;
  lastAnsweredAt?: string;
}

export interface CohortMetricsMasteryBuckets {
  untouched: number;
  '0-25': number;
  '25-50': number;
  '50-75': number;
  '75-100': number;
}

export interface CohortMetricsLearnerSummary {
  userId: string;
  name: string;
  metrics: CohortMetricsScalars;
  status: CohortMetricsStatus;
  lastActiveAt?: string;
}

export interface CourseLOBreakdown {
  loId: string;
  loTitle: string;
  itemsTotal: number;
  averageMastery: number;
  learnersTouched: number;
  coverageFraction: number;
}

export interface CohortCourseSummary {
  courseId: string;
  courseTitle: string;
  metrics: CohortMetricsScalars;
  universe: CohortMetricsUniverse;
}

export type CohortStatusDistribution = Record<CohortMetricsStatus, number>;

export interface CohortReadinessBuckets {
  high: number;
  medium: number;
  low: number;
  critical: number;
}

export interface CohortLearnerMetricsPage {
  items: CohortMetricsLearnerSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface LearnerMetricsReport {
  metrics: CohortMetricsScalars;
  status: CohortMetricsStatus;
  universe: CohortMetricsUniverse;
  window: CohortMetricsWindow;
  progress: CohortMetricsProgress;
  loBreakdown: LearnerLOBreakdown[];
  masteryDistribution: CohortMetricsMasteryBuckets;
}

export interface CourseMetricsReport {
  metrics: CohortMetricsScalars;
  universe: CohortMetricsUniverse;
  window: CohortMetricsWindow;
  learnerCount: number;
  learners: CohortMetricsLearnerSummary[];
  loBreakdown: CourseLOBreakdown[];
  statusDistribution: CohortStatusDistribution;
}

export interface CohortMetricsReport {
  metrics: CohortMetricsScalars;
  universe: CohortMetricsUniverse;
  window: CohortMetricsWindow;
  learnerCount: number;
  atRiskCount: number;
  courses: CohortCourseSummary[];
  statusDistribution: CohortStatusDistribution;
  readinessDistribution: CohortReadinessBuckets;
}
