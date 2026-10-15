import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button, cn } from '@/components/ui';

/** Page-level success message that clears itself after a few seconds. */
export const useToast = (duration = 3500) => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message]);

  const showToast = useCallback((text: string) => setMessage(text), []);
  return { toast: message, showToast };
};

export const Toast: React.FC<{ message: string | null }> = ({ message }) =>
  message
    ? createPortal(
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[140] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
        >
          <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" />
          <span className="min-w-0 truncate">{message}</span>
        </div>,
        document.body,
      )
    : null;

interface SuccessNoticeProps {
  children: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Green confirmation that stays on the page until dismissed (e.g. "code is live"). */
export const SuccessNotice: React.FC<SuccessNoticeProps> = ({
  children,
  action,
  onDismiss,
  className,
}) => (
  <div
    role="status"
    className={cn(
      'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-900',
      className,
    )}
  >
    <CheckCircle2 size={16} className="flex-shrink-0 text-brand-700" />
    <div className="min-w-0 flex-1">{children}</div>
    {(action || onDismiss) && (
      <div className="flex flex-shrink-0 items-center gap-1">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand-800 transition hover:bg-brand-100"
          >
            <X size={15} />
          </button>
        )}
      </div>
    )}
  </div>
);

interface ListFooterProps {
  page: number;
  totalPages: number;
  total: number;
  /** Singular noun for the count, e.g. "tenant". */
  noun: string;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Extra context after the count, e.g. that a filter only covers this page. */
  note?: React.ReactNode;
}

/** Count + pager row at the bottom of a list card. */
export const ListFooter: React.FC<ListFooterProps> = ({
  page,
  totalPages,
  total,
  noun,
  disabled,
  onPrevious,
  onNext,
  note,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3">
    <p className="text-[13px] tabular-nums text-stone-500">
      {totalPages > 1 && `Page ${page} of ${totalPages} · `}
      {total.toLocaleString()} {noun}
      {total === 1 ? '' : 's'}
      {note && <span className="text-stone-400"> · {note}</span>}
    </p>
    {totalPages > 1 && (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          icon={ChevronLeft}
          onClick={onPrevious}
          disabled={page <= 1 || disabled}
        >
          Previous
        </Button>
        <Button
          size="sm"
          iconRight={ChevronRight}
          onClick={onNext}
          disabled={page >= totalPages || disabled}
        >
          Next
        </Button>
      </div>
    )}
  </div>
);

/** Copies text to the clipboard; resolves false when the browser refuses. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

export const shortDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
