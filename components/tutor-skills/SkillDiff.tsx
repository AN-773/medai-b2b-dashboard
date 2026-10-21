import React, { useMemo } from 'react';
import { Badge, InlineAlert, cn } from '@/components/ui';
import { diffCounts, lineDiff } from '@/utils/lineDiff';

export interface DiffSide {
  label: string;
  description: string;
  modes: string[];
  body: string;
}

/**
 * Two versions of a tutor skill in one column: what changed in "When to use
 * it" and the modes, then the method line by line.
 */
const SkillDiff: React.FC<{ before: DiffSide; after: DiffSide }> = ({ before, after }) => {
  const lines = useMemo(() => lineDiff(before.body, after.body), [before.body, after.body]);
  const counts = diffCounts(lines);
  const modesBefore = [...before.modes].sort().join(', ');
  const modesAfter = [...after.modes].sort().join(', ');
  const descriptionChanged = before.description !== after.description;
  const modesChanged = modesBefore !== modesAfter;
  const identical = !descriptionChanged && !modesChanged && counts.added === 0 && counts.removed === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge tone="neutral">{before.label}</Badge>
        <span className="text-stone-400">→</span>
        <Badge tone="blue">{after.label}</Badge>
        <span className="font-medium text-brand-700">+{counts.added}</span>
        <span className="font-medium text-red-600">−{counts.removed}</span>
        <span className="text-stone-500">lines in the method</span>
      </div>

      {identical && <InlineAlert tone="info">These two versions are the same.</InlineAlert>}

      {(descriptionChanged || modesChanged) && (
        <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-[13px]">
          {descriptionChanged && (
            <div className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_1fr]">
              <dt className="font-medium text-stone-600">When to use it</dt>
              <dd className="space-y-1">
                <p className="rounded bg-red-50 px-1.5 py-0.5 text-red-800 line-through decoration-red-300">{before.description}</p>
                <p className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-900">{after.description}</p>
              </dd>
            </div>
          )}
          {modesChanged && (
            <div className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_1fr]">
              <dt className="font-medium text-stone-600">Modes</dt>
              <dd>
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-800 line-through">{modesBefore || 'none'}</span>
                {' → '}
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-900">{modesAfter || 'none'}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="max-h-[600px] overflow-auto rounded-lg border border-stone-200 font-mono text-xs leading-6 custom-scrollbar">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'grid grid-cols-[2.5rem_2.5rem_1rem_1fr]',
              line.kind === 'added' && 'bg-brand-50',
              line.kind === 'removed' && 'bg-red-50',
            )}
          >
            <span className="select-none pr-2 text-right text-stone-400">{line.before ?? ''}</span>
            <span className="select-none pr-2 text-right text-stone-400">{line.after ?? ''}</span>
            <span className="select-none text-stone-500">
              {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
            </span>
            <span className="whitespace-pre-wrap break-words pr-3 text-stone-800">{line.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillDiff;
