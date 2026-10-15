import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileSearch,
  ListTree,
  Loader2,
  PenLine,
  RotateCcw,
  Shrink,
  XCircle,
} from 'lucide-react';
import type {
  ModuleGenerationEvent,
  ModuleGenerationJob,
  ModuleGenerationStage,
} from '@/types/ModuleGenerationTypes';
import { SectionLabel } from '../shared';
import { isJobRunning } from './planUtils';
import { agentLabel, STAGE_DESCRIPTIONS, STAGE_LABELS, STAGE_ORDER } from './stageLabels';

interface ProgressStepProps {
  job: ModuleGenerationJob;
  events: ModuleGenerationEvent[];
  isCancelling: boolean;
  error: string | null;
  onCancel: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

const STAGE_ICONS: Record<ModuleGenerationStage, React.ComponentType<{ size?: number }>> = {
  analyzing: FileSearch,
  drafting_items: PenLine,
  planning: ListTree,
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
};

const formatTokens = (count: number) =>
  count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count >= 1000 ? `${Math.round(count / 1000)}k` : String(count);

const EventIcon: React.FC<{ kind: ModuleGenerationEvent['kind'] }> = ({ kind }) => {
  if (kind === 'error') return <XCircle size={13} className="text-rose-500" />;
  if (kind === 'warning') return <AlertTriangle size={13} className="text-amber-500" />;
  if (kind === 'compaction') return <Shrink size={13} className="text-slate-400" />;
  if (kind === 'subagent_done') return <CheckCircle2 size={13} className="text-emerald-500" />;
  return <span className="block h-1.5 w-1.5 rounded-full bg-slate-300" />;
};

const StageStepper: React.FC<{ job: ModuleGenerationJob }> = ({ job }) => {
  const activeIndex = job.status === 'processing' && job.stage ? STAGE_ORDER.indexOf(job.stage) : -1;
  const allDone = job.status === 'completed';
  return (
    <div className="flex items-start justify-center gap-2">
      {STAGE_ORDER.map((stage, index) => {
        const Icon = STAGE_ICONS[stage];
        const done = allDone || (activeIndex > index);
        const active = activeIndex === index;
        return (
          <React.Fragment key={stage}>
            <div className="flex w-36 flex-col items-center gap-2 text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
                  done
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                    : active
                      ? 'bg-primary-gradient text-white shadow-xl shadow-emerald-100'
                      : 'border border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {done ? <CheckCircle2 size={22} /> : active ? <Loader2 size={22} className="animate-spin" /> : <Icon size={22} />}
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-[#1BD183]' : 'text-slate-400'}`}
              >
                {STAGE_LABELS[stage]}
              </span>
              {active && (
                <span className="text-[11px] font-medium leading-4 text-slate-500">{STAGE_DESCRIPTIONS[stage]}</span>
              )}
            </div>
            {index < STAGE_ORDER.length - 1 && (
              <div
                className={`mt-6 h-px min-w-[20px] max-w-[64px] flex-1 transition-colors duration-500 ${
                  done ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ProgressStep: React.FC<ProgressStepProps> = ({
  job,
  events,
  isCancelling,
  error,
  onCancel,
  onStartOver,
  onClose,
}) => {
  const feedRef = useRef<HTMLOListElement>(null);
  const running = isJobRunning(job);
  const cancelRequested = Boolean(job.cancelRequestedAt) && running;

  const lastSeq = events.length > 0 ? events[events.length - 1].seq : 0;
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [lastSeq]);

  const headline = running
    ? cancelRequested
      ? 'Cancelling at the next checkpoint…'
      : job.status === 'queued'
        ? 'Waiting for a worker to pick this up…'
        : 'Building your modules'
    : job.status === 'failed'
      ? 'Generation failed'
      : job.status === 'cancelled'
        ? 'Generation cancelled'
        : 'Finishing up…';

  return (
    <>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-black tracking-tight text-slate-900">{headline}</h3>
            {running && (
              <p className="mt-1 text-sm font-semibold text-slate-500">
                You can close this. We’ll keep working. Come back from the Modules tab when it’s ready.
              </p>
            )}
          </div>

          <StageStepper job={job} />

          {job.status === 'failed' && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <XCircle size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-black">The AI could not finish this plan.</p>
                <p className="mt-0.5 font-medium">{job.errorMessage || 'Unknown error.'}</p>
                <p className="mt-1 text-xs font-medium text-rose-600/80">
                  Any items it drafted were discarded. You can start over with different options.
                </p>
              </div>
            </div>
          )}
          {job.status === 'cancelled' && (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              <Ban size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-black text-slate-800">Generation was cancelled.</p>
                <p className="mt-0.5 font-medium">
                  {job.errorMessage || 'Nothing was created, and any items it drafted were discarded.'}
                </p>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <SectionLabel>Activity</SectionLabel>
              {(job.llmCalls ?? 0) > 0 && (
                <span className="text-[11px] font-bold text-slate-400">
                  {job.llmCalls} model calls · {formatTokens((job.tokensIn ?? 0) + (job.tokensOut ?? 0))} tokens
                </span>
              )}
            </div>
            <ol
              ref={feedRef}
              aria-live="polite"
              className="custom-scrollbar max-h-72 space-y-1 overflow-y-auto px-5 py-3"
            >
              {events.length === 0 ? (
                <li className="flex items-center gap-2 py-4 text-sm font-medium text-slate-400">
                  {running && <Loader2 size={14} className="animate-spin" />}
                  {running ? 'Waiting for the first step…' : 'No activity was recorded.'}
                </li>
              ) : (
                events.map((event) => (
                  <li key={event.seq} className="flex items-start gap-2.5 py-1 text-sm">
                    <span className="mt-1.5 flex h-3 w-3 flex-shrink-0 items-center justify-center">
                      <EventIcon kind={event.kind} />
                    </span>
                    <span className="w-16 flex-shrink-0 pt-px font-mono text-[11px] text-slate-400">
                      {formatTime(event.createdAt)}
                    </span>
                    <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                      {agentLabel(event.agent)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 break-words font-medium ${
                        event.kind === 'error'
                          ? 'text-rose-700'
                          : event.kind === 'warning'
                            ? 'text-amber-700'
                            : 'text-slate-700'
                      }`}
                    >
                      {event.label}
                    </span>
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
        {running ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling || cancelRequested}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              {isCancelling || cancelRequested ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              {cancelRequested ? 'Cancelling…' : 'Cancel generation'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#16324F] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#1B3E62]"
            >
              Close and keep working
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
            >
              Close
            </button>
            {(job.status === 'failed' || job.status === 'cancelled') && (
              <button
                type="button"
                onClick={onStartOver}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:opacity-90"
              >
                <RotateCcw size={15} /> Start over
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ProgressStep;
