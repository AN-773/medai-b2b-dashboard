import React from 'react';
import { CHART_COLORS, SCORE_TONE_HEX, scoreTone } from '@/components/mastery/palette';

interface ReadinessGaugeProps {
  /** Readiness as a 0–100 percentage. */
  value: number;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  /** Short caption under the figure; also used as the accessible name. */
  label?: string;
}

const SIZES = {
  small: { dimension: 80, stroke: 7, figure: 'text-lg' },
  medium: { dimension: 120, stroke: 10, figure: 'text-[26px]' },
  large: { dimension: 160, stroke: 12, figure: 'text-[32px]' },
} as const;

/**
 * Ring gauge for readiness on a light surface. The arc is coloured by band
 * (red below 60, amber below 80, brand green from 80) and the whole gauge is
 * exposed to assistive tech as a single image with its value.
 */
export const ReadinessGauge = ({
  value,
  size = 'small',
  showText = true,
  label,
}: ReadinessGaugeProps) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(100, safeValue));
  const { dimension, stroke, figure } = SIZES[size];
  const center = dimension / 2;
  const radius = center - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = SCORE_TONE_HEX[scoreTone(safeValue)];

  return (
    <div
      role="img"
      aria-label={`${label || 'Readiness'}: ${safeValue}%`}
      className="relative inline-flex flex-shrink-0 items-center justify-center"
      style={{ width: dimension, height: dimension }}
    >
      <svg
        width={dimension}
        height={dimension}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={CHART_COLORS.track}
          strokeWidth={stroke}
        />
        {clamped > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        )}
      </svg>

      {showText && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden="true"
        >
          <span
            className={`${figure} font-semibold leading-none tracking-tight text-stone-900 tabular-nums`}
          >
            {safeValue}
            <span className="text-[0.6em] font-medium text-stone-500">%</span>
          </span>
          {label && <span className="mt-1 text-xs text-stone-500">{label}</span>}
        </div>
      )}
    </div>
  );
};
