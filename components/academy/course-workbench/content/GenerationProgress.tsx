import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn, ProgressBar } from '@/components/ui';
import type { JobProgress } from '@/hooks/useItemFactory';

export const generationLabel = (progress: JobProgress | null) =>
  progress
    ? `Drafting ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} objectives…`
    : 'Starting generation…';

/** Determinate bar once the job reports counts, a pulsing one before that. */
export const GenerationBar: React.FC<{ progress: JobProgress | null; className?: string }> = ({
  progress,
  className,
}) =>
  progress ? (
    <ProgressBar
      value={progress.done}
      max={progress.total}
      label="Generation progress"
      className={className}
    />
  ) : (
    <div
      role="progressbar"
      aria-label="Generation progress"
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-stone-200/80', className)}
    >
      <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
    </div>
  );

interface GenerationStripProps {
  progress: JobProgress | null;
  /** Trailing control, e.g. a button that opens the generation drawer. */
  action?: React.ReactNode;
  className?: string;
}

/** Slim status strip that keeps a running batch visible anywhere on the page. */
const GenerationStrip: React.FC<GenerationStripProps> = ({ progress, action, className }) => (
  <div
    role="status"
    className={cn(
      'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-stone-200 bg-stone-50/70 px-4 py-2.5',
      className,
    )}
  >
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-stone-800">
      <Loader2 size={15} className="animate-spin text-brand-600" aria-hidden="true" />
      {generationLabel(progress)}
    </span>
    <div className="flex min-w-[140px] flex-1 items-center gap-3">
      <GenerationBar progress={progress} className="flex-1" />
      {progress && (
        <span className="text-xs tabular-nums text-stone-500">{progress.percent}%</span>
      )}
    </div>
    {action}
  </div>
);

export default GenerationStrip;
