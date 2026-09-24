import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, cn } from '@/components/ui';
import { formatNumber, plural } from './shared';

/** One bordered frame around a table (plus an optional footer, e.g. pagination). */
export const TableCard: React.FC<{
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}> = ({ children, footer, className }) => (
  <div
    className={cn(
      'overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card',
      className,
    )}
  >
    <div className="overflow-x-auto custom-scrollbar">{children}</div>
    {footer}
  </div>
);

export const tableClass = 'min-w-full text-left text-[13px]';
export const theadClass = 'border-b border-stone-200 bg-stone-50/70 text-stone-500';
export const rowClass =
  'border-b border-stone-100 transition-colors last:border-b-0 hover:bg-stone-50';

export const Th: React.FC<{
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}> = ({ children, align = 'left', className }) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap px-4 py-2.5 font-medium',
      align === 'right' && 'text-right',
      className,
    )}
  >
    {children}
  </th>
);

export const SortableTh: React.FC<{
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
}> = ({ label, active, desc, onClick, align = 'left' }) => {
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      className={cn('whitespace-nowrap px-4 py-2.5 font-medium', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          '-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
          active && 'text-stone-900',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon
          size={12}
          aria-hidden="true"
          className={active ? 'text-stone-500' : 'text-stone-300'}
        />
      </button>
    </th>
  );
};

/** Right-aligned count cell; zeros recede so the non-zero figures stand out. */
export const NumCell: React.FC<{
  value: number | null | undefined;
  /** Colour a figure that signals a problem (e.g. failures, a shortfall). */
  tone?: 'default' | 'amber' | 'red';
  title?: string;
  className?: string;
}> = ({ value, tone = 'default', title, className }) => (
  <td
    title={title}
    className={cn(
      'whitespace-nowrap px-4 py-3 text-right tabular-nums',
      !value
        ? 'text-stone-400'
        : tone === 'red'
          ? 'font-medium text-red-700'
          : tone === 'amber'
            ? 'font-medium text-amber-700'
            : 'text-stone-700',
      className,
    )}
  >
    {formatNumber(value)}
  </td>
);

/** True when a click landed on a control inside a clickable row. */
export const isInteractiveTarget = (event: React.MouseEvent) =>
  Boolean((event.target as HTMLElement).closest('button, a, input, select, textarea, label'));

// ---------- Pagination ----------

export const usePagination = <T,>(items: T[], pageSize: number, resetKey: unknown) => {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [current, items, pageSize],
  );
  return { page: current, pageCount, pageItems, setPage, total: items.length, pageSize };
};

/** The `Pagination` props for a `usePagination` result. */
export const paginationProps = (pagination: ReturnType<typeof usePagination<unknown>>) => ({
  page: pagination.page,
  pageCount: pagination.pageCount,
  total: pagination.total,
  pageSize: pagination.pageSize,
  onPageChange: pagination.setPage,
});

export const Pagination: React.FC<{
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  noun: string;
  nounPlural?: string;
  /** Extra text after the range, e.g. "of 240 audited". */
  suffix?: React.ReactNode;
}> = ({ page, pageCount, total, pageSize, onPageChange, noun, nounPlural, suffix }) => {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-200 px-4 py-2.5 text-[13px] text-stone-500">
      <p className="tabular-nums">
        {pageCount > 1
          ? `${formatNumber(start)}–${formatNumber(end)} of ${plural(total, noun, nounPlural)}`
          : plural(total, noun, nounPlural)}
        {suffix}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <span className="mr-1 tabular-nums">
            Page {formatNumber(page)} of {formatNumber(pageCount)}
          </span>
          <IconButton
            icon={ChevronLeft}
            label="Previous page"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          />
          <IconButton
            icon={ChevronRight}
            label="Next page"
            size="sm"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
          />
        </div>
      )}
    </div>
  );
};
