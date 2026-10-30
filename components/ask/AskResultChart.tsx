import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  ChartTooltipCard,
  axisTick,
  tooltipDatum,
  type ChartTooltipProps,
} from '@/components/analytics/chartTheme';
import { KpiCell } from '@/components/mastery/MasteryParts';
import type { FacultyChart } from '@/services/facultyChatWire';
import { cellOf, formatNumber, formatUtcMoment, humanizeColumn, toNumber } from '@/utils/facultyResults';

const CHART_HEIGHT = 240;
const X_LABEL_CHARS = 16;

/** The design system's series order. A fifth series is never a new colour. */
const SERIES_COLORS = [CHART_COLORS.brand, CHART_COLORS.sky, CHART_COLORS.violet, CHART_COLORS.amber];

/**
 * A row as Recharts reads it. Keys are ours, not the column names: Recharts
 * treats a string `dataKey` as a path, and these names are the model's.
 */
interface ChartDatum {
  label: string;
  values: (number | null)[];
}

interface ChartSeries {
  name: string;
  color: string;
  value: (datum: ChartDatum) => number | null;
}

const labelOf = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const toData = (chart: FacultyChart, keys: readonly string[]): ChartDatum[] =>
  chart.rows.map((row) => ({
    label: labelOf(cellOf(row, chart.x)),
    values: keys.map((key) => toNumber(cellOf(row, key))),
  }));

const shortLabel = (label: string) =>
  label.length > X_LABEL_CHARS ? `${label.slice(0, X_LABEL_CHARS - 1)}…` : label;

/** `2026-10-29T00:00:00Z` → `29 Oct`, so a time axis stays short. Anything else is left alone. */
const axisLabel = (label: string) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(label)) return shortLabel(label);
  const moment = formatUtcMoment(label);
  return moment ? moment.split(',')[0] : shortLabel(label);
};

const ChartTooltip: React.FC<ChartTooltipProps & { series: ChartSeries[] }> = ({ series, ...props }) => {
  const datum = tooltipDatum<ChartDatum>(props);
  if (!datum) return null;
  return (
    <ChartTooltipCard
      title={datum.label}
      rows={series.map((entry) => {
        const value = entry.value(datum);
        return { label: entry.name, value: value === null ? '—' : formatNumber(value), color: entry.color };
      })}
    />
  );
};

/** An array, not a fragment: Recharts 2 cannot see through a React 19 fragment and would drop these. */
const axes = [
  <CartesianGrid key="grid" vertical={false} stroke={CHART_COLORS.grid} />,
  <XAxis
    key="x"
    dataKey="label"
    axisLine={{ stroke: CHART_COLORS.grid }}
    tickLine={false}
    tick={axisTick}
    tickMargin={8}
    minTickGap={16}
    tickFormatter={axisLabel}
  />,
  <YAxis key="y" axisLine={false} tickLine={false} tick={axisTick} width={48} tickFormatter={formatNumber} />,
];

/**
 * A function, not a component: `ResponsiveContainer` hands its size to its
 * direct child, so that child has to be the chart itself.
 */
const cartesianChart = (type: 'bar' | 'line' | 'area', data: ChartDatum[], series: ChartSeries[]) => {
  const margin = { top: 8, right: 4, bottom: 0, left: -8 };
  const tooltip = (
    <Tooltip
      content={<ChartTooltip series={series} />}
      cursor={type === 'bar' ? { fill: CHART_COLORS.hover } : { stroke: CHART_COLORS.axis }}
    />
  );

  if (type === 'bar') {
    return (
      <BarChart data={data} margin={margin}>
        {axes}
        {tooltip}
        {series.map((entry) => (
          <Bar
            key={entry.name}
            dataKey={entry.value}
            name={entry.name}
            fill={entry.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    );
  }
  if (type === 'line') {
    return (
      <LineChart data={data} margin={margin}>
        {axes}
        {tooltip}
        {series.map((entry) => (
          <Line
            key={entry.name}
            dataKey={entry.value}
            name={entry.name}
            stroke={entry.color}
            strokeWidth={2}
            dot={data.length <= 12 ? { r: 3 } : false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    );
  }
  return (
    <AreaChart data={data} margin={margin}>
      {axes}
      {tooltip}
      {series.map((entry) => (
        <Area
          key={entry.name}
          dataKey={entry.value}
          name={entry.name}
          stroke={entry.color}
          strokeWidth={2}
          fill={entry.color}
          fillOpacity={0.12}
          isAnimationActive={false}
        />
      ))}
    </AreaChart>
  );
};

/** At most four slices keep their own colour; the smallest fold into "Other". */
const toSlices = (data: ChartDatum[]): { label: string; value: number; color: string }[] => {
  const sized = data
    .map((datum) => ({ label: datum.label, value: datum.values[0] ?? 0 }))
    .filter((slice) => slice.value > 0)
    .sort((left, right) => right.value - left.value);
  const kept = sized.length > SERIES_COLORS.length ? sized.slice(0, SERIES_COLORS.length - 1) : sized;
  const rest = sized.slice(kept.length).reduce((sum, slice) => sum + slice.value, 0);
  return [
    ...kept.map((slice, index) => ({ ...slice, color: SERIES_COLORS[index] })),
    ...(rest > 0 ? [{ label: 'Other', value: rest, color: CHART_COLORS.muted }] : []),
  ];
};

const PiePlot: React.FC<{ data: ChartDatum[]; name: string }> = ({ data, name }) => {
  const slices = useMemo(() => toSlices(data), [data]);
  return (
    <>
      <div style={{ height: CHART_HEIGHT, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={(props: ChartTooltipProps) => {
                const slice = tooltipDatum<{ label: string; value: number; color: string }>(props);
                return slice ? (
                  <ChartTooltipCard
                    title={slice.label}
                    rows={[{ label: name, value: formatNumber(slice.value), color: slice.color }]}
                  />
                ) : null;
              }}
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.label} fill={slice.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend className="mt-2" items={slices.map((slice) => ({ label: slice.label, color: slice.color }))} />
    </>
  );
};

/** A single number needs no plot: one tile per measure. */
const KpiPlot: React.FC<{ chart: FacultyChart }> = ({ chart }) => {
  const row = chart.rows[0];
  return (
    <div
      className="grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200"
      style={{ gridTemplateColumns: `repeat(${String(Math.min(chart.y.length, 3))}, minmax(0, 1fr))` }}
    >
      {chart.y.map((key) => {
        const value = row ? toNumber(cellOf(row, key)) : null;
        return <KpiCell key={key} label={humanizeColumn(key)} figure={value === null ? '—' : formatNumber(value)} />;
      })}
    </div>
  );
};

/**
 * One `faculty.chart`. The spec is data validated on the server (type, keys,
 * corrections) and nothing the model wrote runs here. The rows are still text
 * from a database, so every label renders as an SVG or HTML text node.
 */
export const AskResultChart: React.FC<{ chart: FacultyChart }> = React.memo(({ chart }) => {
  const keys = useMemo(() => chart.y.slice(0, SERIES_COLORS.length), [chart.y]);
  const data = useMemo(() => toData(chart, keys), [chart, keys]);
  const series: ChartSeries[] = useMemo(
    () =>
      keys.map((key, index) => ({
        name: humanizeColumn(key),
        color: SERIES_COLORS[index],
        value: (datum: ChartDatum) => datum.values[index],
      })),
    [keys],
  );

  if (chart.rows.length === 0) return null;

  const summary = chart.takeaway || `Chart of ${series.map((entry) => entry.name).join(', ')}`;

  return (
    <figure className="min-w-0">
      {chart.takeaway && (
        <figcaption dir="auto" className="mb-3 text-sm font-medium text-stone-900">
          {chart.takeaway}
        </figcaption>
      )}
      {chart.type === 'kpi' ? (
        <KpiPlot chart={chart} />
      ) : (
        <ChartFrame label={summary}>
          {chart.type === 'pie' ? (
            <PiePlot data={data} name={series[0].name} />
          ) : (
            <div style={{ height: CHART_HEIGHT, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {cartesianChart(chart.type, data, series)}
              </ResponsiveContainer>
            </div>
          )}
          {chart.type !== 'pie' && series.length > 1 && (
            <ChartLegend className="mt-2" items={series.map(({ name, color }) => ({ label: name, color }))} />
          )}
        </ChartFrame>
      )}
      {chart.y.length > keys.length && (
        <p className="mt-2 text-xs text-stone-500">
          Showing the first {keys.length} measures. The table has them all.
        </p>
      )}
    </figure>
  );
});
AskResultChart.displayName = 'AskResultChart';
