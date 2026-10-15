import React from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200/70',
  green: 'bg-brand-50 text-brand-800 ring-brand-200/70',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  red: 'bg-red-50 text-red-700 ring-red-200/70',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200/70',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70',
};

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-stone-400',
  green: 'bg-brand-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Leading status dot — use for states, not for categories. */
  dot?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
  children: React.ReactNode;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  dot = false,
  icon: Icon,
  className,
  children,
  title,
}) => (
  <span
    title={title}
    className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      TONES[tone],
      className,
    )}
  >
    {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
    {Icon && <Icon size={12} className="flex-shrink-0" />}
    {children}
  </span>
);

/** Plain status text with a coloured dot — lighter than a Badge for dense rows. */
export const StatusDot: React.FC<{ tone: BadgeTone; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
    <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', DOTS[tone])} />
    {children}
  </span>
);
