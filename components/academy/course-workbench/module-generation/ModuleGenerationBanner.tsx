import React from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
      ? 'Cancelling…'
      : job.status === 'queued'
        ? 'Waiting to start'
        : job.stage
          ? STAGE_LABELS[job.stage]
          : 'Working'
    : 'Edit it, then accept to create the modules.';

  return (
    <div className="pt-4">
      <div
        role="status"
        className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
          running ? 'border-emerald-200 bg-emerald-50/70' : 'border-[#16324F]/15 bg-[#16324F]/[0.04]'
        }`}
      >
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
            running ? 'bg-white text-emerald-600' : 'bg-[#16324F] text-white'
          }`}
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">
            {running ? 'AI is building modules…' : 'AI draft ready for review.'}
          </p>
          <p className="text-xs font-semibold text-slate-500">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition ${
            running
              ? 'border border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300'
              : 'bg-[#16324F] text-white hover:bg-[#1B3E62]'
          }`}
        >
          {running ? 'View' : 'Review'}
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};

export default ModuleGenerationBanner;
