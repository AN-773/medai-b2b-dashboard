import React from 'react';
import { ChevronLeft, ChevronRight, Search, Sparkles } from 'lucide-react';
import {
  Button,
  cn,
  EmptyState,
  IconButton,
  SearchInput,
  StatusDot,
} from '@/components/ui';
import type { TeacherLearningObjective } from '@/types/AcademyStudioTypes';
import { Checkbox } from './Checkbox';
import { plural } from './contentConfig';

interface ObjectiveRailProps {
  query: string;
  onQueryChange: (value: string) => void;
  /** The current page of (filtered) objectives. */
  objectives: TeacherLearningObjective[];
  filteredCount: number;
  rangeStart: number;
  rangeEnd: number;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  selectedObjectiveId: string | null;
  onSelectObjective: (objectiveId: string) => void;
  batchSelectedIds: string[];
  onToggleBatch: (objectiveId: string) => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectPage: () => void;
  onClearSelection: () => void;
  pendingCountFor: (objectiveId: string) => number;
}

/** Master column: search, batch selection and the paged objective list. */
const ObjectiveRail: React.FC<ObjectiveRailProps> = ({
  query,
  onQueryChange,
  objectives,
  filteredCount,
  rangeStart,
  rangeEnd,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  selectedObjectiveId,
  onSelectObjective,
  batchSelectedIds,
  onToggleBatch,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectPage,
  onClearSelection,
  pendingCountFor,
}) => (
  <aside className="flex min-w-0 flex-col border-b border-stone-200 bg-stone-50/50 xl:w-[340px] xl:flex-shrink-0 xl:border-b-0 xl:border-r">
    <div className="space-y-2.5 border-b border-stone-200 p-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search objectives"
      />
      <div className="flex min-h-[28px] items-center justify-between gap-3 px-1">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-stone-600">
          <Checkbox
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            disabled={objectives.length === 0}
            onChange={onToggleSelectPage}
          />
          Select page
        </label>
        <div className="flex items-center gap-1">
          <span className="text-[13px] tabular-nums text-stone-500">
            {batchSelectedIds.length.toLocaleString()} selected
          </span>
          {batchSelectedIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>

    {filteredCount === 0 ? (
      <EmptyState
        compact
        icon={Search}
        title="No matching objectives"
        description={`Nothing matches “${query.trim()}”.`}
        action={
          <Button size="sm" onClick={() => onQueryChange('')}>
            Clear search
          </Button>
        }
      />
    ) : (
      <ul
        aria-label="Objectives"
        className="max-h-[420px] min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto custom-scrollbar xl:max-h-[640px]"
      >
        {objectives.map((objective) => {
          const isActive = selectedObjectiveId === objective.id;
          const isChecked = batchSelectedIds.includes(objective.id);
          const itemCount = objective.itemTotals?.total ?? 0;
          const pendingCount = pendingCountFor(objective.id);
          return (
            <li
              key={objective.id}
              className={cn(
                'relative flex items-start gap-3 px-3 transition-colors',
                isActive
                  ? 'bg-white shadow-card ring-1 ring-inset ring-stone-200'
                  : 'hover:bg-stone-100/70',
              )}
            >
              {isActive && (
                <span
                  className="absolute inset-y-0 left-0 w-0.5 bg-brand-500"
                  aria-hidden="true"
                />
              )}
              <Checkbox
                checked={isChecked}
                onChange={() => onToggleBatch(objective.id)}
                aria-label={`Select “${objective.title}” for batch generation`}
                className="mt-3.5"
              />
              <button
                type="button"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelectObjective(objective.id)}
                className="min-w-0 flex-1 rounded-md py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <span
                  className={cn(
                    'line-clamp-2 text-sm leading-5',
                    isActive ? 'font-medium text-stone-900' : 'text-stone-800',
                  )}
                >
                  {objective.title}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {itemCount > 0 ? (
                    <StatusDot tone="green">{plural(itemCount, 'item')}</StatusDot>
                  ) : (
                    <StatusDot tone="amber">No content</StatusDot>
                  )}
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <Sparkles size={12} aria-hidden="true" />
                      {plural(pendingCount, 'AI draft')}
                    </span>
                  )}
                  {objective.cognitiveSkill && (
                    <span className="text-xs text-stone-500">{objective.cognitiveSkill}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}

    {filteredCount > 0 && (
      <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-3 py-2">
        <p className="text-xs tabular-nums text-stone-500">
          {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{' '}
          {plural(filteredCount, 'objective')}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1" aria-label={`Page ${page} of ${totalPages}`} role="group">
            <IconButton
              icon={ChevronLeft}
              label="Previous page"
              size="sm"
              disabled={page <= 1}
              onClick={onPrevPage}
            />
            <IconButton
              icon={ChevronRight}
              label="Next page"
              size="sm"
              disabled={page >= totalPages}
              onClick={onNextPage}
            />
          </div>
        )}
      </div>
    )}
  </aside>
);

export default ObjectiveRail;
