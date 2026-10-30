import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from 'lucide-react';
import { Badge, Button, cn } from '@/components/ui';
import type { FacultyColumn, FacultyRow, FacultyTable } from '@/services/facultyChatWire';
import {
  cellOf,
  displayColumnsOf,
  downloadTableCsv,
  flaggedLearnerOf,
  formatCell,
  humanizeColumn,
  isNumericColumn,
  rowCountLine,
  sortRows,
  type SortDirection,
} from '@/utils/facultyResults';
import { LearnerFlagFeedback, type SubmitFeedback } from './AskFeedback';

/** Boolean columns that are a state, not a fact: shown as a badge when true. */
const STATE_COLUMNS: Readonly<Record<string, string>> = {
  needs_attention: 'Needs attention',
  insufficient_data: 'Insufficient data',
};

interface AskResultTableProps {
  table: FacultyTable;
  operationId: string | null;
  onFeedback: SubmitFeedback;
}

interface SortState {
  column: string;
  direction: SortDirection;
}

const SortIcon: React.FC<{ direction: SortDirection | null }> = ({ direction }) => {
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown;
  return <Icon size={13} aria-hidden="true" className={direction ? 'text-stone-700' : 'text-stone-300'} />;
};

const Cell: React.FC<{ value: FacultyRow[string]; column: FacultyColumn }> = ({ value, column }) => {
  const state = STATE_COLUMNS[column.name];
  if (state && value === true) return <Badge tone="amber">{state}</Badge>;
  return <>{formatCell(value, column)}</>;
};

/**
 * A query's full rows: sortable, downloadable, and rendered as text only.
 * A student a row flags as needing attention can be rated from the row.
 */
export const AskResultTable: React.FC<AskResultTableProps> = React.memo(({ table, operationId, onFeedback }) => {
  const [sort, setSort] = useState<SortState | null>(null);

  const rows = useMemo(() => {
    const column = table.columns.find((entry) => entry.name === sort?.column);
    return column && sort ? sortRows(table.rows, column, sort.direction) : table.rows;
  }, [table, sort]);

  // A row keeps its key through a sort, so a verdict stays on its student.
  const rowKeys = useMemo(() => new Map(table.rows.map((row, index) => [row, index])), [table]);
  const columns = useMemo(() => displayColumnsOf(table.columns), [table]);
  const canRate =
    operationId !== null && table.rows.some((row) => flaggedLearnerOf(table, row) !== null);

  const toggleSort = (name: string) =>
    setSort((current) =>
      current?.column === name && current.direction === 'asc'
        ? { column: name, direction: 'desc' }
        : { column: name, direction: 'asc' },
    );

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h3 dir="auto" className="text-sm font-medium text-stone-900">
            {table.purpose || 'Result'}
          </h3>
          <p className="mt-0.5 text-[13px] text-stone-500">{rowCountLine(table)}</p>
        </div>
        {table.rows.length > 0 && (
          <Button size="sm" variant="secondary" icon={Download} onClick={() => downloadTableCsv(table)}>
            Download CSV
          </Button>
        )}
      </header>

      {table.rows.length === 0 ? (
        <p className="border-t border-stone-100 px-4 py-6 text-center text-[13px] text-stone-500">
          No rows matched this question.
        </p>
      ) : (
        <div className="max-h-[22rem] overflow-auto border-t border-stone-100 custom-scrollbar">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_theme(colors.stone.200)]">
              <tr>
                {columns.map((column) => {
                  const direction = sort?.column === column.name ? sort.direction : null;
                  const numeric = isNumericColumn(column);
                  return (
                    <th
                      key={column.name}
                      scope="col"
                      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
                      className={cn(
                        'whitespace-nowrap px-4 py-2 text-xs font-medium text-stone-500',
                        numeric ? 'text-right' : 'text-left',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.name)}
                        className={cn(
                          '-mx-1 inline-flex items-center gap-1 rounded px-1 transition hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                          numeric && 'flex-row-reverse',
                        )}
                      >
                        {humanizeColumn(column.name)}
                        <SortIcon direction={direction} />
                      </button>
                    </th>
                  );
                })}
                {canRate && (
                  <th
                    scope="col"
                    className="sticky right-0 whitespace-nowrap bg-white px-4 py-2 text-right text-xs font-medium text-stone-500"
                  >
                    Your feedback
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => {
                const learnerId = canRate ? flaggedLearnerOf(table, row) : null;
                return (
                  <tr key={rowKeys.get(row)} className="hover:bg-stone-50">
                    {columns.map((column) => (
                      <td
                        key={column.name}
                        dir="auto"
                        className={cn(
                          'max-w-[24rem] break-words px-4 py-2 align-middle text-stone-700',
                          isNumericColumn(column) ? 'text-right tabular-nums' : 'min-w-[9rem] text-left',
                        )}
                      >
                        <Cell value={cellOf(row, column.name)} column={column} />
                      </td>
                    ))}
                    {canRate && (
                      <td className="sticky right-0 whitespace-nowrap bg-white px-4 py-1 text-right align-middle">
                        {operationId && learnerId && (
                          <LearnerFlagFeedback
                            operationId={operationId}
                            queryId={table.queryId}
                            learnerId={learnerId}
                            onSubmit={onFeedback}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
});
AskResultTable.displayName = 'AskResultTable';
