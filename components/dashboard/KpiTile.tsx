import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui';

interface KpiTileProps {
  label: string;
  icon: LucideIcon;
  /** The headline figure. */
  value: React.ReactNode;
  /** One line that explains the figure. */
  context: React.ReactNode;
  /** Small status shown after the figure, usually a Badge. */
  status?: React.ReactNode;
  /** Adds an amber dot after the label when the figure needs a look. */
  attention?: boolean;
  /** Optional visual under the context line (progress bar, split bar). */
  children?: React.ReactNode;
}

/**
 * One headline number on the dashboard. Render inside a `<dl>` — the tile is a
 * `dt`/`dd` group so screen readers announce "label, value, context".
 */
export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  icon: Icon,
  value,
  context,
  status,
  attention = false,
  children,
}) => (
  <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card">
    <dt className="flex items-center gap-2 text-sm font-medium text-stone-700">
      {label}
      {attention && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      )}
      <Icon size={16} className="ml-auto text-stone-300" aria-hidden="true" />
    </dt>
    <dd className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[28px] font-semibold leading-none tracking-tight text-stone-900 tabular-nums">
        {value}
      </span>
      {status}
    </dd>
    <dd className="mt-2 text-[13px] leading-5 text-stone-500">{context}</dd>
    {children && <dd className="mt-auto pt-4">{children}</dd>}
  </div>
);

interface SegmentBarProps {
  segments: { key: string; value: number; className: string }[];
  className?: string;
}

/**
 * A thin stacked bar (e.g. behind / on track / ahead). Decorative — the tile's
 * context line carries the same numbers as text.
 */
export const SegmentBar: React.FC<SegmentBarProps> = ({ segments, className }) => {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  return (
    <div
      aria-hidden="true"
      className={cn('flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-stone-200/80', className)}
    >
      {total > 0 &&
        segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className={cn('h-full', segment.className)}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
    </div>
  );
};
