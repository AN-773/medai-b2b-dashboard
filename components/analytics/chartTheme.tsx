import React from 'react';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

/**
 * Recharts needs raw colour values, so these mirror the Tailwind tokens in
 * `tailwind.config.js` (brand) and Tailwind's default palette (stone, sky…).
 * Series order per the design system: brand → sky → violet → amber; red only
 * for genuinely bad values.
 */
export const CHART_COLORS = {
  brand: '#1BC697', // brand-500
  brandSoft: '#9CE6CC', // brand-200
  brandTint: '#EAFAF4', // brand-50
  sky: '#0EA5E9', // sky-500
  violet: '#8B5CF6', // violet-500
  amber: '#F59E0B', // amber-500
  red: '#EF4444', // red-500
  grid: '#E7E5E4', // stone-200
  axis: '#D6D3D1', // stone-300
  tick: '#78716C', // stone-500
  muted: '#A8A29E', // stone-400
  hover: '#F5F5F4', // stone-100 (bar hover cursor)
} as const;

/** Tick style shared by every axis: 12px stone-500. */
export const axisTick = { fontSize: 12, fill: CHART_COLORS.tick };

/** Axis title style (e.g. "Difficulty (P)"). */
export const axisLabel = { fontSize: 12, fill: CHART_COLORS.tick };

export type ChartTooltipProps = TooltipProps<ValueType, NameType>;

/** Returns the hovered datum of a Recharts tooltip, or null when inactive. */
export function tooltipDatum<T>(props: ChartTooltipProps): T | null {
  if (!props.active || !props.payload?.length) return null;
  return (props.payload[0].payload as T) ?? null;
}

interface ChartTooltipCardProps {
  title?: React.ReactNode;
  rows: Array<{ label: string; value: React.ReactNode; color?: string }>;
  footer?: React.ReactNode;
}

/** The floating card used as every chart's tooltip. */
export const ChartTooltipCard: React.FC<ChartTooltipCardProps> = ({ title, rows, footer }) => (
  <div className="min-w-[10rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-pop">
    {title && <p className="mb-1 font-medium text-stone-900">{title}</p>}
    <dl className="space-y-0.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-stone-500">
            {row.color && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            )}
            {row.label}
          </dt>
          <dd className="font-medium tabular-nums text-stone-900">{row.value}</dd>
        </div>
      ))}
    </dl>
    {footer && <p className="mt-1.5 border-t border-stone-100 pt-1.5 text-stone-500">{footer}</p>}
  </div>
);

/** Small inline legend: coloured dot + label. */
export const ChartLegend: React.FC<{
  items: Array<{ label: string; color: string; shape?: 'dot' | 'square' }>;
  className?: string;
}> = ({ items, className }) => (
  <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 ${className ?? ''}`}>
    {items.map((item) => (
      <li key={item.label} className="inline-flex items-center gap-1.5">
        <span
          className={item.shape === 'square' ? 'h-2.5 w-2.5 rounded-sm' : 'h-2 w-2 rounded-full'}
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
        {item.label}
      </li>
    ))}
  </ul>
);

/**
 * Wrapper that gives a chart an accessible name. The visible title and
 * takeaway live in the surrounding card; this repeats them for screen readers.
 */
export const ChartFrame: React.FC<{
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, className, children }) => (
  <div role="img" aria-label={label} className={className}>
    {children}
  </div>
);

export const formatPercent = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '0%';
