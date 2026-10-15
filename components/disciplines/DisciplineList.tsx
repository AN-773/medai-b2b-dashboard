import React from 'react';
import { ArrowRightFromLine, Pencil, Trash2 } from 'lucide-react';
import type { Discipline } from '@/types/TestsServiceTypes';
import { Menu, StatusDot, cn } from '@/components/ui';
import {
  DELETE_BLOCKED_HINT,
  formatRelative,
  getShortIdentifier,
  hasLinkedObjectives,
} from './shared';

interface DisciplineListProps {
  disciplines: Discipline[];
  /** The discipline whose details are open, highlighted in the list. */
  selectedId: string | null;
  isBusy: (discipline: Discipline) => boolean;
  onOpen: (discipline: Discipline) => void;
  onRename: (discipline: Discipline) => void;
  onMoveFrom: (discipline: Discipline) => void;
  onDelete: (discipline: Discipline) => void;
}

export const ObjectiveCount: React.FC<{ count?: number }> = ({ count }) => {
  if (typeof count !== 'number') {
    return (
      <span className="text-[13px] text-stone-400" title="Learning objective count unavailable">
        —
      </span>
    );
  }
  if (count === 0) return <StatusDot tone="neutral">Unused</StatusDot>;
  return (
    <span className="text-sm tabular-nums text-stone-800">{count.toLocaleString()}</span>
  );
};

/** The discipline taxonomy as one bordered card of divided rows. */
const DisciplineList: React.FC<DisciplineListProps> = ({
  disciplines,
  selectedId,
  isBusy,
  onOpen,
  onRename,
  onMoveFrom,
  onDelete,
}) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <div className="flex items-center gap-4 border-b border-stone-100 bg-stone-50/60 py-2 pl-4 pr-11 text-xs font-medium text-stone-500">
      <span className="flex-1">Discipline</span>
      <span className="w-32 text-right">Learning objectives</span>
    </div>
    <ul className="divide-y divide-stone-100">
      {disciplines.map((discipline) => {
        const busy = isBusy(discipline);
        const linked = hasLinkedObjectives(discipline);
        const updated = formatRelative(discipline.updatedAt);
        const isSelected = selectedId === discipline.id;

        return (
          <li
            key={discipline.id}
            className={cn(
              'flex items-center gap-1 pr-3 transition-colors hover:bg-stone-50',
              isSelected && 'bg-stone-50',
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(discipline)}
              className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{discipline.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-stone-500">
                  <span className="font-mono text-xs">{getShortIdentifier(discipline.id)}</span>
                  {updated && <> · Updated {updated}</>}
                </p>
              </div>
              <div className="flex w-32 flex-shrink-0 justify-end">
                <ObjectiveCount count={discipline.learningObjectivesTotal} />
              </div>
            </button>
            <Menu
              size="sm"
              label={`Actions for ${discipline.title}`}
              items={[
                {
                  label: 'Rename',
                  icon: Pencil,
                  disabled: busy,
                  onSelect: () => onRename(discipline),
                },
                {
                  label: 'Move objectives…',
                  icon: ArrowRightFromLine,
                  disabled: busy,
                  onSelect: () => onMoveFrom(discipline),
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger',
                  disabled: busy || linked,
                  hint: linked ? DELETE_BLOCKED_HINT : undefined,
                  onSelect: () => onDelete(discipline),
                },
              ]}
            />
          </li>
        );
      })}
    </ul>
  </div>
);

export default DisciplineList;
