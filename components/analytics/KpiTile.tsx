import React from 'react';
import { ArrowRight, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui';

interface KpiTileProps {
  label: string;
  /** The large figure. Pass a formatted string ("82%", "1,204"). */
  value: React.ReactNode;
  /** One line of context under the figure. */
  context?: React.ReactNode;
  icon?: LucideIcon;
  /** Dims the figure and shows an inline spinner while data refreshes. */
  loading?: boolean;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** Analytics stat tile: label, big tabular figure, one line of context. */
export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  context,
  icon: Icon,
  loading = false,
  action,
  className,
}) => (
  <div
    aria-busy={loading || undefined}
    className={cn('flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card', className)}
  >
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {loading ? (
        <Loader2 size={15} className="ml-auto animate-spin text-brand-600" aria-label="Loading" />
      ) : Icon ? (
        <Icon size={16} className="ml-auto text-stone-300" aria-hidden="true" />
      ) : null}
    </div>
    <div
      className={cn(
        'mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] text-stone-900 tabular-nums transition-opacity',
        loading && 'opacity-40',
      )}
    >
      {value}
    </div>
    {context && <div className="mt-2 text-[13px] leading-5 text-stone-500">{context}</div>}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="group mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-sm font-medium text-stone-700 transition hover:text-stone-950"
      >
        {action.label}
        <ArrowRight size={15} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    )}
  </div>
);

export default KpiTile;
