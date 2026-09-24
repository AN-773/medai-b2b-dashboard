import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface CohortRiskChartProps {
  data: { range: string; count: number }[];
  height?: number | string;
}

// Recharts needs literal colours; these are the design tokens' hex values.
const STONE_100 = '#F5F5F4';
const STONE_200 = '#E7E5E4';
const STONE_500 = '#78716C';
const STONE_900 = '#1C1917';

/** Readiness bands carry state: green is good, amber needs a look, red is critical. */
const BAND_COLORS: Record<string, string> = {
  High: '#1BC697', // brand-500
  Medium: '#0EA5E9', // sky-500
  Low: '#F59E0B', // amber-500
  Critical: '#EF4444', // red-500
};
const DEFAULT_COLOR = '#1BC697';

/** Learners per readiness band. The container carries a text summary for screen readers. */
export const CohortRiskChart: React.FC<CohortRiskChartProps> = ({ data, height = 250 }) => {
  const summary = data.map((entry) => `${entry.range}: ${entry.count}`).join(', ');

  return (
    <div
      role="img"
      aria-label={`Learners per readiness band. ${summary}`}
      style={{ height, width: '100%' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={STONE_200} />
          <XAxis
            dataKey="range"
            axisLine={{ stroke: STONE_200 }}
            tickLine={false}
            tick={{ fontSize: 12, fill: STONE_500 }}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: STONE_500 }}
            width={44}
          />
          <Tooltip
            cursor={{ fill: STONE_100 }}
            formatter={(value) => [value, 'Learners']}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${STONE_200}`,
              boxShadow: '0 12px 32px -8px rgba(28, 25, 23, 0.18)',
              fontSize: 12,
              color: STONE_900,
              padding: '6px 10px',
            }}
            labelStyle={{ color: STONE_900, fontWeight: 600, marginBottom: 2 }}
            itemStyle={{ color: STONE_500, padding: 0 }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.range} fill={BAND_COLORS[entry.range] ?? DEFAULT_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
