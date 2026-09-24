/**
 * Colour values for SVG / Recharts marks in the Mastery area. Recharts needs
 * raw colours, so these mirror the Tailwind tokens (see tailwind.config.js and
 * docs/design-system.md) — keep them in sync with the class names beside them.
 */
export const CHART_COLORS = {
  brand: '#1BC697', // brand-500 — primary series, "good"
  sky: '#0EA5E9', // sky-500
  violet: '#8B5CF6', // violet-500
  amber: '#F59E0B', // amber-500 — needs attention
  red: '#EF4444', // red-500 — genuinely bad values only
  grid: '#F5F5F4', // stone-100
  axis: '#78716C', // stone-500
  axisMuted: '#A8A29E', // stone-400
  track: '#F5F5F4', // stone-100
} as const;

/** Score bands shared by every readiness / mastery figure in the area. */
export type ScoreTone = 'red' | 'amber' | 'green';

/** `percent` is 0–100. Below 60 is at risk, below 80 needs attention. */
export const scoreTone = (percent: number): ScoreTone =>
  percent < 60 ? 'red' : percent < 80 ? 'amber' : 'green';

export const SCORE_TONE_HEX: Record<ScoreTone, string> = {
  red: CHART_COLORS.red,
  amber: CHART_COLORS.amber,
  green: CHART_COLORS.brand,
};

export const SCORE_TONE_BAR: Record<ScoreTone, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-brand-500',
};
