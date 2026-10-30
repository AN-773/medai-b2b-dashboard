import type { ApiRequestError } from '@/services/apiClient';
import type { ExamResultRow, ExamResultsReport } from '@/services/examResultsService';

export const MAX_EXAM_FILE_BYTES = 5 * 1024 * 1024;
export const EXAM_FILE_LIMITS = 'up to 5 MB and 20,000 rows';

/** A file can hold 20,000 rows; the page shows enough of them to check it. */
export const PREVIEW_ROW_LIMIT = 100;

export const EXAM_RESULT_COLUMNS: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'email', description: 'The email of a learner in this cohort' },
  { name: 'exam_name', description: 'The name of the exam' },
  { name: 'exam_date', description: 'The date, as YYYY-MM-DD' },
  { name: 'score', description: 'The score, as a number' },
  { name: 'passed', description: 'true or false. pass/fail, yes/no and 1/0 also work' },
  { name: 'max_score', description: 'Optional. The highest possible score' },
];

const EXAM_RESULTS_TEMPLATE = [
  'email,exam_name,exam_date,score,passed,max_score',
  'learner@example.com,Renal block final,2026-06-15,78,true,100',
  'another.learner@example.com,Renal block final,2026-06-15,41,false,100',
  '',
].join('\n');

export const downloadExamResultsTemplate = (): void => {
  const url = URL.createObjectURL(new Blob([EXAM_RESULTS_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'exam-results-template.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const FILE_TOO_LARGE = `This file is too large. A file can be ${EXAM_FILE_LIMITS}. Split it into smaller files and import them one at a time.`;
const FILE_EMPTY = 'This file is empty. Choose a file with your exam results in it.';
const FILE_NOT_CSV = "This isn't a CSV file. Save your spreadsheet as CSV, then choose it again.";
const FILE_UNREADABLE =
  "We couldn't read this file. Save your spreadsheet as CSV UTF-8, then choose it again.";
const FILE_BAD =
  "We couldn't read this file. Check that it's a CSV file with the columns listed here and at least one row of results, then choose it again.";

/** What's wrong with a file before reading it, or null. */
export const examFileProblem = (file: File): string | null => {
  if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) return FILE_NOT_CSV;
  if (file.size > MAX_EXAM_FILE_BYTES) return FILE_TOO_LARGE;
  if (file.size === 0) return FILE_EMPTY;
  return null;
};

/**
 * What's wrong with a file's text, or null. A NUL means a binary file with a
 * .csv name; U+FFFD means text that isn't UTF-8, which would otherwise save
 * garbled exam names.
 */
export const examTextProblem = (text: string): string | null => {
  if (!text.trim()) return FILE_EMPTY;
  if (text.includes('\0') || text.includes('�')) return FILE_UNREADABLE;
  return null;
};

const REFUSALS: Readonly<Record<number, string>> = {
  400: FILE_BAD,
  403: "Your account can't import results for this cohort. Only admins and owners of its university can.",
  404: "We couldn't find this cohort. It may have been deleted. Go back to your cohorts and try again.",
  413: FILE_TOO_LARGE,
  422: FILE_BAD,
};

const CHECK_FAILED = "We couldn't check this file just now. Try again in a moment.";

/** Past this point the save may have happened, so this never says it didn't. */
const SAVE_UNCONFIRMED =
  "We couldn't confirm that these results were saved. Try again: saving the same file twice doesn't create duplicates.";

/**
 * A plain sentence for each refusal. The server's own text is not shown: it is
 * written for developers, and this list is what a dean should read.
 */
export const examImportRefusal = (error: unknown, { saving }: { saving: boolean }): string => {
  const { status } = (error ?? {}) as ApiRequestError;
  return (status && REFUSALS[status]) || (saving ? SAVE_UNCONFIRMED : CHECK_FAILED);
};

/** All-or-nothing: a save is offered only when there are rows and none has an error. */
export const canSaveExamResults = (report: ExamResultsReport): boolean =>
  report.total > 0 && report.valid === report.total && report.rows.every((row) => !row.error);

export const examRowProblems = (report: ExamResultsReport): ExamResultRow[] =>
  report.rows.filter((row) => row.error);

export const formatExamScore = ({ score, maxScore }: Pick<ExamResultRow, 'score' | 'maxScore'>): string =>
  maxScore === null || maxScore === undefined ? String(score) : `${String(score)} / ${String(maxScore)}`;
