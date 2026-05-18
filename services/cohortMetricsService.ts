import { apiClient } from './apiClient';
import type {
  CohortLearnerMetricsPage,
  CohortMetricsReport,
  CourseMetricsReport,
  LearnerMetricsReport,
} from '@/types/CohortMetricsTypes';

export interface CohortLearnersQuery {
  page?: number;
  limit?: number;
}

const stripLeadingSlash = (value: string) =>
  value.startsWith('/') ? value.slice(1) : value;

const toIdentifier = (value: string) =>
  encodeURIComponent(stripLeadingSlash(value).split('/').pop()!);

const toUserPath = (userId: string) => encodeURIComponent(userId);

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 200);

export const cohortMetricsService = {
  getCohortMetrics: (cohortIdentifier: string) =>
    apiClient.get<CohortMetricsReport>(
      'TESTS',
      `/cohorts/${toIdentifier(cohortIdentifier)}/metrics`,
    ),

  getCohortLearners: (
    cohortIdentifier: string,
    { page = 1, limit = 50 }: CohortLearnersQuery = {},
  ) => {
    const params = new URLSearchParams({
      page: String(Math.max(1, Math.floor(page))),
      limit: String(clampLimit(Math.floor(limit))),
    });
    return apiClient.get<CohortLearnerMetricsPage>(
      'TESTS',
      `/cohorts/${toIdentifier(cohortIdentifier)}/metrics/learners?${params.toString()}`,
    );
  },

  getCourseMetrics: (cohortIdentifier: string, courseIdentifier: string) =>
    apiClient.get<CourseMetricsReport>(
      'TESTS',
      `/cohorts/${toIdentifier(cohortIdentifier)}/courses/${toIdentifier(courseIdentifier)}/metrics`,
    ),

  getLearnerMetrics: (
    cohortIdentifier: string,
    userId: string,
    courseIdentifier: string,
  ) =>
    apiClient.get<LearnerMetricsReport>(
      'TESTS',
      `/cohorts/${toIdentifier(cohortIdentifier)}/learners/${toIdentifier(userId)}/courses/${toIdentifier(courseIdentifier)}/metrics`,
    ),
};
