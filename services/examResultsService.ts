import { apiClient, type ApiRequestError } from './apiClient';
import { toIdentifier } from './cohortMetricsService';

export interface ExamResultRow {
  /** The row's line in the file. */
  line: number;
  email: string;
  learnerId: string;
  learnerName: string;
  examName: string;
  examDate: string;
  score: number;
  maxScore: number | null;
  passed: boolean;
  error: string | null;
}

export interface ExamResultsReport {
  dryRun: boolean;
  total: number;
  valid: number;
  saved: number;
  rows: ExamResultRow[];
}

export interface ExamResultsFile {
  csv: string;
  /** The file's name. */
  source: string;
}

const isReport = (body: unknown): body is ExamResultsReport =>
  typeof (body as Partial<ExamResultsReport> | null)?.total === 'number';

/** Go sends an empty list as `null`. */
const withRows = (report: ExamResultsReport): ExamResultsReport => ({
  ...report,
  rows: report.rows ?? [],
});

export const examResultsService = {
  /**
   * Checks a file (`dryRun`) or saves it. A save with row errors saves nothing
   * and answers 422 with the same report, so it resolves here like a preview:
   * the rows are what the caller needs. Every other refusal rejects.
   */
  importResults: async (
    cohortIdentifier: string,
    file: ExamResultsFile,
    { dryRun }: { dryRun: boolean },
  ): Promise<ExamResultsReport> => {
    const params = new URLSearchParams({ dryRun: String(dryRun) });
    try {
      const report = await apiClient.post<ExamResultsReport>(
        'TESTS',
        `/cohorts/${toIdentifier(cohortIdentifier)}/exam-results/import?${params.toString()}`,
        file,
      );
      return withRows(report);
    } catch (error) {
      const { status, data } = error as ApiRequestError;
      if (status === 422 && isReport(data)) return withRows(data);
      throw error;
    }
  },
};
