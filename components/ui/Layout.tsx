import React from 'react';
import { cn } from './cn';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  // Infer T from `value` alone (usually a typed state). Inferring from the
  // option literals widens it, and a `setState` onChange contributes its
  // updater-function overload — either way T collapses to `string`.
  options: SegmentedOption<NoInfer<T>>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Mutually exclusive view filter ("All / Needs review / Drafts"). */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn('inline-flex rounded-lg bg-stone-100 p-0.5', className)}
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            active
              ? 'bg-white text-stone-900 shadow-card ring-1 ring-stone-200/70'
              : 'text-stone-500 hover:text-stone-800',
          )}
        >
          {option.label}
          {typeof option.count === 'number' && (
            <span className={cn('tabular-nums', active ? 'text-stone-500' : 'text-stone-400')}>
              {option.count.toLocaleString()}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Count or badges next to the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Heading for a section inside a page (e.g. a course tab under the course title). */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  meta,
  actions,
  className,
}) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
    <div className="min-w-[min(100%,18rem)] flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[17px] font-semibold leading-7 text-stone-900">{title}</h2>
        {meta}
      </div>
      {description && (
        <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-stone-500">{description}</p>
      )}
    </div>
    {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small line above the title — usually a back link / breadcrumb. */
  eyebrow?: React.ReactNode;
  /** Badges or status next to the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  meta,
  actions,
  className,
}) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-3', className)}>
    {/* Wraps the actions below the title rather than squeezing the title. */}
    <div className="min-w-[min(100%,18rem)] flex-1">
      {eyebrow && <div className="mb-1.5 text-[13px] text-stone-500">{eyebrow}</div>}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 className="line-clamp-2 break-words text-[22px] font-semibold leading-8 tracking-[-0.01em] text-stone-900">
          {title}
        </h1>
        {meta}
      </div>
      {description && (
        <div className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">{description}</div>
      )}
    </div>
    {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
