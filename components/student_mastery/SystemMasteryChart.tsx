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
  LabelList,
  type TooltipProps,
} from 'recharts';
import { CHART_COLORS, SCORE_TONE_HEX, scoreTone } from '@/components/mastery/palette';

interface SystemMasteryChartProps {
  data: { system: string; mastery: number }[];
  height?: number | string;
}

const LABEL_WIDTH = 160;
const MAX_LABEL_CHARS = 24;

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}

/** Category label: truncated to fit, with the full name as an SVG tooltip. */
const CategoryTick = ({ x = 0, y = 0, payload }: TickProps) => {
  const full = String(payload?.value ?? '');
  const short = full.length > MAX_LABEL_CHARS ? `${full.slice(0, MAX_LABEL_CHARS - 1)}…` : full;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text x={-10} y={0} dy={4} textAnchor="end" fill={CHART_COLORS.axis} fontSize={12}>
        {short}
      </text>
    </g>
  );
};

const ChartTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { system: string; mastery: number } | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[260px] rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] shadow-pop">
      <p className="font-medium text-stone-900">{row.system}</p>
      <p className="mt-0.5 tabular-nums text-stone-600">{row.mastery}% mastery</p>
    </div>
  );
};

/**
 * Horizontal mastery bars (0–100) per system / course / objective. Bars are
 * coloured by band (red below 60, amber below 80, brand green from 80); stone
 * axes and gridlines. A visually hidden table carries the same data for
 * screen readers.
 */
export const SystemMasteryChart: React.FC<SystemMasteryChartProps> = ({ data, height }) => {
  // ~40px per bar keeps labels readable; never collapse below 220px.
  const calculatedHeight = data.length > 0 ? Math.max(220, data.length * 40 + 32) : 220;
  const finalHeight = height || calculatedHeight;

  return (
    <div className="w-full">
      <div style={{ height: finalHeight, width: '100%', minHeight: '220px' }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 44, left: 0, bottom: 4 }}
            barCategoryGap="28%"
          >
            <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
            <XAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fontSize: 12, fill: CHART_COLORS.axisMuted }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="system"
              type="category"
              width={LABEL_WIDTH}
              tick={CategoryTick}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip cursor={{ fill: 'rgba(28, 25, 23, 0.03)' }} content={<ChartTooltip />} />
            <Bar dataKey="mastery" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={SCORE_TONE_HEX[scoreTone(entry.mastery)]} />
              ))}
              <LabelList
                dataKey="mastery"
                position="right"
                formatter={(value: number) => `${value}%`}
                style={{ fontSize: 12, fill: CHART_COLORS.axis }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Mastery by item</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Mastery</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={`${entry.system}-${index}`}>
              <td>{entry.system}</td>
              <td>{entry.mastery}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
