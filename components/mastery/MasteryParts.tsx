import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/ui';
import { SCORE_TONE_BAR, scoreTone } from './palette';

/* ------------------------------------------------------------------------ */
/* Breadcrumb                                                                */
/* ------------------------------------------------------------------------ */

export interface MasteryCrumb {
  label: string;
  to: string;
}

/**
 * The drill-down path above a Mastery page title (PageHeader `eyebrow`):
 * `Mastery › Cohort A` above "Jane Doe". Every crumb is a real link.
 */
export const MasteryBreadcrumb: React.FC<{ trail: MasteryCrumb[] }> = ({ trail }) => (
  <nav aria-label="Breadcrumb">
    <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
      {trail.map((crumb, index) => (
        <li key={`${crumb.to}-${index}`} className="flex min-w-0 items-center gap-1">
          {index > 0 && (
            <ChevronRight size={14} className="flex-shrink-0 text-stone-300" aria-hidden="true" />
          )}
          <Link
            to={crumb.to}
            className="-mx-1 max-w-[16rem] truncate rounded px-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {crumb.label}
          </Link>
        </li>
      ))}
    </ol>
  </nav>
);

/* ------------------------------------------------------------------------ */
/* Cards                                                                     */
/* ------------------------------------------------------------------------ */

interface MetricCardProps {
  title: string;
  /** One line that says what the numbers mean. */
  takeaway?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Let the body run edge to edge (lists with their own row padding). */
  flush?: boolean;
  children: React.ReactNode;
}

/** A titled analytics card: title, one-line takeaway, then the figure or chart. */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  takeaway,
  action,
  className,
  flush = false,
  children,
}) => (
  <section
    className={cn(
      'flex min-w-0 flex-col rounded-xl border border-stone-200 bg-white shadow-card',
      flush ? 'pt-5' : 'p-5',
      className,
    )}
  >
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', flush && 'px-5')}>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
        {takeaway && <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{takeaway}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4 flex-1">{children}</div>
  </section>
);

/** A row of headline figures in one bordered card, split by hairlines. */
export const KpiStrip: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 shadow-card sm:grid-cols-2',
      className,
    )}
  >
    {children}
  </div>
);

interface KpiCellProps {
  label: string;
  figure: React.ReactNode;
  detail?: React.ReactNode;
  /** Extra visual under the figure, e.g. a bar. */
  children?: React.ReactNode;
  className?: string;
}

export const KpiCell: React.FC<KpiCellProps> = ({ label, figure, detail, children, className }) => (
  <div className={cn('min-w-0 bg-white p-5', className)}>
    <p className="text-[13px] font-medium text-stone-500">{label}</p>
    <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-stone-900 tabular-nums">
      {figure}
    </p>
    {children}
    {detail && <p className="mt-2 text-[13px] leading-5 text-stone-500">{detail}</p>}
  </div>
);

/* ------------------------------------------------------------------------ */
/* Bars                                                                      */
/* ------------------------------------------------------------------------ */

/** Clamped 0–100 integer, or null when the value is missing. */
const toPercent = (fraction: number) =>
  Number.isFinite(fraction) ? Math.trunc(fraction * 100) : null;

interface ScoreBarProps {
  /** A 0–1 fraction (readiness, mastery…). */
  value: number;
  className?: string;
  /** Hide the trailing percentage (when the figure is shown elsewhere). */
  hideValue?: boolean;
}

/**
 * Inline score meter coloured by band (red < 60, amber < 80, green). The bar is
 * decorative; the printed percentage is the accessible value.
 */
export const ScoreBar: React.FC<ScoreBarProps> = ({ value, className, hideValue = false }) => {
  const percent = toPercent(value);
  if (percent === null) {
    return <span className="text-stone-400">—</span>;
  }
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-stone-200/80" aria-hidden="true">
        <div
          className={cn('h-full rounded-full', SCORE_TONE_BAR[scoreTone(percent)])}
          style={{ width: `${width}%` }}
        />
      </div>
      {!hideValue && (
        <span className="w-10 flex-shrink-0 text-right tabular-nums text-stone-900">{percent}%</span>
      )}
    </div>
  );
};

export interface DistributionSegment {
  key: string;
  label: string;
  value: number;
  /** Tailwind background class for the segment and its legend dot. */
  colorClass: string;
}

interface DistributionBarProps {
  segments: DistributionSegment[];
  /** Accessible name for the legend list. */
  label: string;
}

/**
 * A 100% stacked bar with a legend underneath. The legend (label, count,
 * share) is the text alternative, so the bar itself is hidden from AT.
 */
export const DistributionBar: React.FC<DistributionBarProps> = ({ segments, label }) => {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  return (
    <div>
      <div
        className={cn(
          'flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full',
          total > 0 ? 'bg-white' : 'bg-stone-100',
        )}
        aria-hidden="true"
      >
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <div
                key={segment.key}
                className={cn('h-full', segment.colorClass)}
                style={{ flexGrow: segment.value, flexBasis: 0 }}
                title={`${segment.label}: ${segment.value.toLocaleString()}`}
              />
            ))}
      </div>
      <ul aria-label={label} className="mt-4 space-y-2">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-[13px]">
            <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', segment.colorClass)} aria-hidden="true" />
            <span className="min-w-0 truncate text-stone-700">{segment.label}</span>
            <span className="ml-auto font-medium tabular-nums text-stone-900">
              {segment.value.toLocaleString()}
            </span>
            <span className="w-10 text-right tabular-nums text-stone-500">
              {total > 0 ? `${Math.round((segment.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Stats & tables                                                            */
/* ------------------------------------------------------------------------ */

export const StatList: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <dl className={cn('divide-y divide-stone-100', className)}>{children}</dl>;

interface StatRowProps {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

export const StatRow: React.FC<StatRowProps> = ({ label, icon: Icon, value, hint }) => (
  <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
    <dt className="flex min-w-0 items-center gap-2 text-[13px] text-stone-500">
      {Icon && <Icon size={14} className="flex-shrink-0 text-stone-400" />}
      <span className="truncate">{label}</span>
    </dt>
    <dd className="text-right">
      <span className="text-sm font-medium tabular-nums text-stone-900">{value}</span>
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </dd>
  </div>
);

/** Column header for the Mastery tables: sentence case, stone-500. */
export const Th: React.FC<{
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  srOnly?: boolean;
}> = ({ children, align = 'left', className, srOnly = false }) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap px-4 py-2.5 text-xs font-medium text-stone-500',
      align === 'right' ? 'text-right' : 'text-left',
      className,
    )}
  >
    {srOnly ? <span className="sr-only">{children}</span> : children}
  </th>
);

/** A bordered, horizontally scrollable table shell. */
export const TableCard: React.FC<{ children: React.ReactNode; footer?: React.ReactNode; busy?: boolean }> = ({
  children,
  footer,
  busy = false,
}) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <div className={cn('overflow-x-auto transition-opacity', busy && 'opacity-60')} aria-busy={busy || undefined}>
      <table className="w-full text-[13px]">{children}</table>
    </div>
    {footer}
  </div>
);

