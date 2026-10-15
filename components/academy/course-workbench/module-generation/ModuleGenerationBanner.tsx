import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button, cn } from '@/components/ui';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import { isJobAwaitingReview, isJobRunning } from './planUtils';
import { STAGE_LABELS } from './stageLabels';

export interface ModuleGenerationBannerProps {
  /** The course's open modules job, or `null`. */
  job: CourseGenerationJob | null;
  onOpen: () => void;
}

/** Modules tab banner for a running job or a draft awaiting review. */
const ModuleGenerationBanner: React.FC<ModuleGenerationBannerProps> = ({ job, onOpen }) => {
  const running = isJobRunning(job);
  const awaitingReview = isJobAwaitingReview(job);
  if (!job || (!running && !awaitingReview)) return null;

  const detail = running
    ? job.cancelRequestedAt
      ? 'Stopping…'
      : job.status === 'queued'
        ? 'Waiting to start'
        : job.stage
          ? STAGE_LABELS[job.stage]
          : 'Working'
    : 'Edit the plan, then accept it to create the modules.';

  return (
    <div className="pt-4">
      <div
        role="status"
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-xl px-4 py-3',
          running ? 'border border-stone-200 bg-stone-50' : 'border-ai-gradient shadow-card',
        )}
      >
        {running ? (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-inset ring-stone-200">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </span>
        ) : (
          <span className="bg-ai-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white">
            <Sparkles size={16} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">
            {running ? 'AI is drafting modules…' : 'AI draft ready for review'}
          </p>
          <p className="text-[13px] text-stone-500">{detail}</p>
        </div>
        {running ? (
          <Button variant="secondary" size="sm" onClick={onOpen}>
            View
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onOpen}>
            Review
          </Button>
        )}
      </div>
    </div>
  );
};

export default ModuleGenerationBanner;
