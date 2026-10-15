import React from 'react';
import { ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { Button, Menu, cn } from '@/components/ui';
import { BULK_STATUSES, STATUS_META, plural, type BulkStatus } from './itemMeta';

interface ResultsBarProps {
  total: number;
  selectedCount: number;
  hasActiveFilters: boolean;
  isRefreshing: boolean;
  onClearSelection: () => void;
  onChangeStatus: (status: BulkStatus) => void;
  onDelete: () => void;
}

/**
 * Header strip of the results card. Shows the result count; once rows are
 * selected it turns into the bulk-action bar and sticks to the top while
 * scrolling.
 */
const ResultsBar: React.FC<ResultsBarProps> = ({
  total,
  selectedCount,
  hasActiveFilters,
  isRefreshing,
  onClearSelection,
  onChangeStatus,
  onDelete,
}) => {
  const selecting = selectedCount > 0;

  return (
    <div
      role={selecting ? 'toolbar' : undefined}
      aria-label={selecting ? 'Bulk actions' : undefined}
      className={cn(
        'flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 rounded-t-xl border-b px-4 py-2',
        selecting
          ? 'sticky top-0 z-20 border-stone-200 bg-stone-50 shadow-card'
          : 'border-stone-100 bg-white',
      )}
    >
      {selecting ? (
        <>
          <p className="text-sm text-stone-900">
            <span className="font-medium tabular-nums">{selectedCount.toLocaleString()}</span>{' '}
            selected
          </p>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear selection
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Menu
              label="Change status"
              items={BULK_STATUSES.map((status) => ({
                label: STATUS_META[status].label,
                onSelect: () => onChangeStatus(status),
              }))}
              trigger={(props) => (
                <Button size="sm" iconRight={ChevronDown} {...props}>
                  Change status
                </Button>
              )}
            />
            <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
              Delete
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-stone-500" aria-live="polite">
            <span className="font-medium tabular-nums text-stone-900">
              {plural(total, 'item')}
            </span>
            {hasActiveFilters ? ' match your filters' : ' in the bank'}
          </p>
          {isRefreshing && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-stone-500">
              <Loader2 size={13} className="animate-spin text-brand-600" aria-hidden="true" />
              Updating…
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsBar;
