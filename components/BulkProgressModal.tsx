import React, { useMemo } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { Button, Dialog, ProgressBar, cn } from '@/components/ui';

export type BulkItemState = 'queued' | 'working' | 'done' | 'failed';

/** One row of the per-item results list. */
export interface BulkItemResult {
  id: string;
  /** What people recognise the item by, e.g. its QID. */
  label: string;
  /** Secondary text, e.g. the stem. */
  detail?: string;
  state: BulkItemState;
  /** Why it failed. */
  message?: string;
}

interface BulkProgressModalProps {
  isOpen: boolean;
  title: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  isProcessing: boolean;
  onClose: () => void;
  /** Optional per-item results, listed under the progress bar. */
  results?: BulkItemResult[];
}

const STATE_ICON: Record<BulkItemState, React.ReactNode> = {
  queued: <Circle size={15} className="text-stone-300" aria-hidden="true" />,
  working: <Loader2 size={15} className="animate-spin text-brand-600" aria-hidden="true" />,
  done: <CheckCircle2 size={15} className="text-brand-600" aria-hidden="true" />,
  failed: <XCircle size={15} className="text-red-500" aria-hidden="true" />,
};

const STATE_LABEL: Record<BulkItemState, string> = {
  queued: 'Waiting',
  working: 'Working…',
  done: 'Done',
  failed: 'Failed',
};

const BulkProgressModal: React.FC<BulkProgressModalProps> = ({
  isOpen,
  title,
  totalItems,
  completedItems,
  failedItems,
  isProcessing,
  onClose,
  results,
}) => {
  const processed = completedItems + failedItems;
  const percent = totalItems > 0 ? Math.min(100, Math.round((processed / totalItems) * 100)) : 0;

  // Once the run is over, surface failures first so they're not buried.
  const orderedResults = useMemo(() => {
    if (!results) return [];
    if (isProcessing) return results;
    return [...results].sort(
      (left, right) => Number(right.state === 'failed') - Number(left.state === 'failed'),
    );
  }, [isProcessing, results]);

  const summary = isProcessing
    ? `Working through ${totalItems.toLocaleString()} ${totalItems === 1 ? 'item' : 'items'}. Keep this window open.`
    : failedItems > 0
      ? `${completedItems.toLocaleString()} succeeded, ${failedItems.toLocaleString()} failed.`
      : `${completedItems.toLocaleString()} of ${totalItems.toLocaleString()} done.`;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      dismissible={!isProcessing}
      width="max-w-lg"
      title={title}
      description={summary}
      footer={
        <Button variant="primary" onClick={onClose} disabled={isProcessing}>
          {isProcessing ? 'Working…' : 'Done'}
        </Button>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[13px] text-stone-500">
          <span className="tabular-nums" aria-live="polite">
            {processed.toLocaleString()} of {totalItems.toLocaleString()}
          </span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <ProgressBar
          value={processed}
          max={totalItems}
          tone={failedItems > 0 ? 'amber' : 'brand'}
          label="Bulk action progress"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[13px]">
          <span className="inline-flex items-center gap-1.5 text-stone-700">
            <CheckCircle2 size={14} className="text-brand-600" aria-hidden="true" />
            <span className="tabular-nums">{completedItems.toLocaleString()}</span> done
          </span>
          {failedItems > 0 && (
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <XCircle size={14} className="text-red-500" aria-hidden="true" />
              <span className="tabular-nums">{failedItems.toLocaleString()}</span> failed
            </span>
          )}
        </div>
      </div>

      {orderedResults.length > 0 && (
        <ul
          aria-label="Results per item"
          className="mt-4 max-h-64 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200 custom-scrollbar"
        >
          {orderedResults.map((result) => (
            <li key={result.id} className="flex items-start gap-3 px-3 py-2">
              <span className="mt-0.5 flex-shrink-0">{STATE_ICON[result.state]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium tabular-nums text-stone-900">
                  {result.label}
                </p>
                {result.detail && (
                  <p className="truncate text-xs text-stone-500">{result.detail}</p>
                )}
                {result.state === 'failed' && result.message && (
                  <p className="mt-0.5 text-xs text-red-600">{result.message}</p>
                )}
              </div>
              <span
                className={cn(
                  'mt-0.5 flex-shrink-0 text-xs',
                  result.state === 'failed'
                    ? 'font-medium text-red-600'
                    : result.state === 'done'
                      ? 'text-brand-700'
                      : 'text-stone-400',
                )}
              >
                {STATE_LABEL[result.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
};

export default BulkProgressModal;
