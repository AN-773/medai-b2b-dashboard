import React, { useId } from 'react';
import { cn } from '@/components/ui';

interface DashboardPanelProps {
  title: string;
  /** One-line takeaway under the title — what the reader should notice. */
  description?: React.ReactNode;
  /** Badges or counts next to the title. */
  meta?: React.ReactNode;
  /** Small controls on the right (e.g. a SegmentedControl). */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Edge-to-edge body for divided lists; otherwise the body is padded. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** A titled card on the dashboard: chart or list, one takeaway line, optional footer. */
export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  title,
  description,
  meta,
  actions,
  footer,
  flush = false,
  className,
  children,
}) => {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-stone-200 bg-white shadow-card',
        flush && 'overflow-hidden',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5">
        <div className="min-w-[min(100%,14rem)] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={titleId} className="text-[15px] font-semibold text-stone-900">
              {title}
            </h2>
            {meta}
          </div>
          {description && (
            <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('flex-1', flush ? 'mt-4 border-t border-stone-100' : 'px-5 pb-5 pt-4')}>
        {children}
      </div>
      {footer && <div className="border-t border-stone-100 px-5 py-3.5">{footer}</div>}
    </section>
  );
};
