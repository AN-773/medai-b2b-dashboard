import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/ui';
import type { FacultyTable } from '@/services/facultyChatWire';
import { formatUtcMoment, humanizeColumn, rowCountLine, sampleSizesOf } from '@/utils/facultyResults';

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[13px] font-medium text-stone-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-stone-700">{children}</dd>
  </div>
);

const asOfText = (table: FacultyTable): string[] => {
  const stamped = table.asOf.flatMap((entry) => {
    const moment = formatUtcMoment(entry.computedAt);
    return moment ? [`${humanizeColumn(entry.kind)}: ${moment}`] : [];
  });
  return stamped.length > 0 ? stamped : ['Live data'];
};

const QueryProvenance: React.FC<{ table: FacultyTable }> = ({ table }) => {
  const samples = sampleSizesOf(table);
  return (
    <dl className="space-y-3">
      <Fact label="The question as understood">
        <span dir="auto">{table.purpose || 'Not recorded for this query.'}</span>
      </Fact>
      <Fact label="Rows">{rowCountLine(table)}</Fact>
      <Fact label="Data as of">
        {asOfText(table).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </Fact>
      <Fact label="Sample sizes">
        {samples.length > 0
          ? samples.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))
          : 'Not part of this result.'}
      </Fact>
      <Fact label="The query">
        <pre className="mt-1 overflow-x-auto rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs leading-5 text-stone-800 custom-scrollbar">
          <code>{table.sql || 'Not recorded for this query.'}</code>
        </pre>
      </Fact>
    </dl>
  );
};

/** How an answer was reached, one block per query. Collapsed: most readers want the answer. */
export const AskProvenance: React.FC<{ tables: readonly FacultyTable[] }> = ({ tables }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (tables.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 text-[13px] font-medium text-stone-600 transition hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <ChevronRight size={14} aria-hidden="true" className={cn('transition-transform', open && 'rotate-90')} />
        How this was computed
      </button>
      {open && (
        <div id={panelId} className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-stone-50/60">
          {tables.map((table) => (
            <div key={table.queryId} className="p-4">
              <QueryProvenance table={table} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
