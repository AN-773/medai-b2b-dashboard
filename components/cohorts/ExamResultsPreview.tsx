import React from 'react';
import { Badge, InlineAlert } from '@/components/ui';
import type { ExamResultRow, ExamResultsReport } from '@/services/examResultsService';
import { plural } from './cohortModel';
import {
  PREVIEW_ROW_LIMIT,
  canSaveExamResults,
  examRowProblems,
  formatExamScore,
} from './examResultsModel';

const COLUMNS = ['Line', 'Learner', 'Exam', 'Date', 'Score', 'Result'];

const ResultBadge: React.FC<{ row: ExamResultRow }> = ({ row }) => {
  if (row.error) return <Badge tone="red">Needs fixing</Badge>;
  return row.passed ? <Badge tone="green">Passed</Badge> : <Badge>Not passed</Badge>;
};

/**
 * Rows from the file, as text only. A row with an error may not have a real
 * score to show. `anywhere` keeps one long email from pushing Result out of view.
 */
export const ExamResultsTable: React.FC<{ rows: ExamResultRow[] }> = ({ rows }) => {
  const shown = rows.slice(0, PREVIEW_ROW_LIMIT);
  return (
    <section>
      <div className="max-h-[24rem] overflow-auto rounded-xl border border-stone-200 bg-white shadow-card custom-scrollbar">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Rows in this file</caption>
          <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_theme(colors.stone.200)]">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-stone-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {shown.map((row) => (
              <tr key={row.line} className={row.error ? 'bg-red-50/50' : undefined}>
                <td className="px-4 py-2 align-top tabular-nums text-stone-500">{row.line}</td>
                <td className="min-w-[11rem] max-w-[18rem] px-4 py-2 text-left align-top [overflow-wrap:anywhere]">
                  {row.learnerName && (
                    <p className="text-stone-900" dir="auto">
                      {row.learnerName}
                    </p>
                  )}
                  <p className="text-stone-500" dir="auto">
                    {row.email}
                  </p>
                </td>
                <td
                  className="min-w-[9rem] max-w-[14rem] px-4 py-2 text-left align-top text-stone-700 [overflow-wrap:anywhere]"
                  dir="auto"
                >
                  {row.examName}
                </td>
                <td className="whitespace-nowrap px-4 py-2 align-top tabular-nums text-stone-700">
                  {row.examDate}
                </td>
                <td className="whitespace-nowrap px-4 py-2 align-top tabular-nums text-stone-700">
                  {row.error ? '—' : formatExamScore(row)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 align-top">
                  <ResultBadge row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="mt-2 text-[13px] text-stone-500">
          Showing the first {shown.length.toLocaleString()} of {plural(rows.length, 'row')}.
        </p>
      )}
    </section>
  );
};

/** What to fix, by line. */
const ExamRowProblems: React.FC<{ problems: ExamResultRow[] }> = ({ problems }) => {
  const shown = problems.slice(0, PREVIEW_ROW_LIMIT);
  return (
    <section aria-label="Rows to fix">
      <ul className="max-h-60 divide-y divide-red-100 overflow-y-auto rounded-xl border border-red-200 bg-white custom-scrollbar">
        {shown.map((row) => (
          <li key={row.line} className="px-4 py-2 text-[13px]">
            <p className="break-words text-stone-500" dir="auto">
              <span className="font-medium text-stone-900">Line {row.line}</span>
              {row.email && ` · ${row.email}`}
            </p>
            <p className="break-words text-red-700" dir="auto">
              {row.error}
            </p>
          </li>
        ))}
      </ul>
      {problems.length > shown.length && (
        <p className="mt-2 text-[13px] text-stone-500">
          Showing the first {shown.length.toLocaleString()} of {plural(problems.length, 'row')} to fix.
        </p>
      )}
    </section>
  );
};

interface ExamResultsPreviewProps {
  report: ExamResultsReport;
  /** The file's name. */
  source: string;
}

/** What a dry run found. The save stays out of reach until this has nothing to fix. */
const ExamResultsPreview: React.FC<ExamResultsPreviewProps> = ({ report, source }) => {
  const problems = examRowProblems(report);
  return (
    <>
      <div>
        <p className="text-sm font-medium text-stone-900">
          {report.valid.toLocaleString()} of {plural(report.total, 'row')} valid
        </p>
        <p className="mt-0.5 break-words text-[13px] text-stone-500" dir="auto">
          {source}
        </p>
      </div>

      {report.total === 0 && (
        <InlineAlert tone="warning" title="No results in this file">
          It has no rows under the column names. Add your results, then choose the file again.
        </InlineAlert>
      )}

      {report.total > 0 && !canSaveExamResults(report) && (
        <InlineAlert title={`${plural(problems.length, 'row')} to fix`}>
          Nothing can be saved until every row is valid. Fix these in your file, then choose it again.
        </InlineAlert>
      )}

      {problems.length > 0 && <ExamRowProblems problems={problems} />}
      {report.rows.length > 0 && <ExamResultsTable rows={report.rows} />}
    </>
  );
};

export default ExamResultsPreview;
