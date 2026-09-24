import React from 'react';
import { cn } from '@/components/ui';

interface DashboardCardProps {
  title: string;
  /** One line under the title — for charts, the takeaway. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Controls on the right of the title row. */
  actions?: React.ReactNode;
  /** Extra classes for the body (e.g. remove padding around a table). */
  bodyClassName?: string;
  /** Heading level for the title; defaults to h3. */
  headingLevel?: 2 | 3;
}

/** A titled, bordered card for charts, tables and summaries on analytics pages. */
const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  subtitle,
  children,
  footer,
  className,
  actions,
  bodyClassName,
  headingLevel = 3,
}) => {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-stone-200 bg-white shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0">
          <Heading className="text-[15px] font-semibold text-stone-900">{title}</Heading>
          {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('flex-grow px-5 pb-5 pt-4', bodyClassName)}>{children}</div>
      {footer && (
        <div className="mt-auto rounded-b-xl border-t border-stone-100 bg-stone-50/60 px-5 py-3 text-[13px] text-stone-600">
          {footer}
        </div>
      )}
    </section>
  );
};

export default DashboardCard;
