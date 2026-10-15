import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  FileSearch,
  ListTree,
  Loader2,
  PenLine,
  RotateCcw,
  Shrink,
  XCircle,
} from 'lucide-react';
import { Badge, Button, ConfirmDialog, InlineAlert, cn } from '@/components/ui';
import type {
  ModuleGenerationEvent,
  ModuleGenerationJob,
  ModuleGenerationStage,
} from '@/types/ModuleGenerationTypes';
import { isJobRunning } from './planUtils';
import { agentLabel, STAGE_DESCRIPTIONS, STAGE_LABELS, STAGE_ORDER } from './stageLabels';
import { WizardFooter } from './WizardFooter';

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
  if (kind === 'error') return <XCircle size={13} className="text-red-500" />;
  if (kind === 'warning') return <AlertTriangle size={13} className="text-amber-500" />;
  if (kind === 'compaction') return <Shrink size={13} className="text-stone-400" />;
  if (kind === 'subagent_done') return <CheckCircle2 size={13} className="text-brand-600" />;
  return <span className="block h-1.5 w-1.5 rounded-full bg-stone-300" />;
};

/** The three pipeline stages as a checklist. */
const StageList: React.FC<{ job: ModuleGenerationJob }> = ({ job }) => {
  const activeIndex = job.status === 'processing' && job.stage ? STAGE_ORDER.indexOf(job.stage) : -1;
  const allDone = job.status === 'completed';
  return (
    <ol className="divide-y divide-stone-100 rounded-xl border border-stone-200">
      {STAGE_ORDER.map((stage, index) => {
        const Icon = STAGE_ICONS[stage];
        const done = allDone || activeIndex > index;
        const active = activeIndex === index;
        return (
          <li
            key={stage}
            aria-current={active ? 'step' : undefined}
            className="flex items-start gap-3 px-4 py-3"
          >
            <span
              className={cn(
                'mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                done
                  ? 'bg-brand-600 text-white'
                  : active
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                    : 'bg-stone-100 text-stone-400',
              )}
            >
              {done ? (
                <Check size={13} strokeWidth={3} aria-hidden="true" />
              ) : active ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Icon size={13} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm',
                  active ? 'font-medium text-stone-900' : done ? 'text-stone-700' : 'text-stone-500',
                )}
              >
                {STAGE_LABELS[stage]}
              </p>
              <p className={cn('text-[13px] leading-5', active ? 'text-stone-500' : 'text-stone-400')}>
                {STAGE_DESCRIPTIONS[stage]}
              </p>
            </div>
            <span className="mt-0.5 flex-shrink-0 text-xs text-stone-500">
              {done ? 'Done' : active ? 'In progress' : ''}
            </span>
          </li>
        );
      })}
    </ol>
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
  const [confirmStop, setConfirmStop] = useState(false);
  const running = isJobRunning(job);
  const cancelRequested = Boolean(job.cancelRequestedAt) && running;

  const lastSeq = events.length > 0 ? events[events.length - 1].seq : 0;
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [lastSeq]);

  // Nothing left to confirm once the job has stopped on its own.
  useEffect(() => {
    if (!running) setConfirmStop(false);
  }, [running]);

  const headline = running
    ? cancelRequested
      ? 'Stopping at the next checkpoint…'
      : job.status === 'queued'
        ? 'Waiting for a worker to pick this up…'
        : 'Drafting your modules'
    : job.status === 'failed'
      ? 'Drafting failed'
      : job.status === 'cancelled'
        ? 'Drafting stopped'
        : 'Finishing up…';

  const modelCalls = job.llmCalls ?? 0;

  return (
    <>
      <div className="space-y-6 px-6 py-6">
        <div>
          <h3 className="text-[15px] font-semibold text-stone-900">{headline}</h3>
          {running && (
            <p className="mt-0.5 text-[13px] leading-5 text-stone-500">
              You can close this; drafting continues in the background. Come back from the Modules
              tab when it’s ready.
            </p>
          )}
        </div>

        {job.status === 'failed' && (
          <InlineAlert tone="error" title="The AI couldn’t finish this plan">
            <p>{job.errorMessage || 'Unknown error.'}</p>
            <p className="mt-1 opacity-80">
              Any items it drafted were discarded. You can start over with different options.
            </p>
          </InlineAlert>
        )}
        {job.status === 'cancelled' && (
          <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-700">
            <Ban size={16} className="mt-0.5 flex-shrink-0 text-stone-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-stone-900">Drafting was stopped</p>
              <p className="mt-0.5">
                {job.errorMessage || 'Nothing was created, and any items it drafted were discarded.'}
              </p>
            </div>
          </div>
        )}
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <StageList job={job} />

        <section className="rounded-xl border border-stone-200">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-2.5">
            <h3 className="text-sm font-medium text-stone-900">Activity</h3>
            {modelCalls > 0 && (
              <span className="text-xs tabular-nums text-stone-500">
                {modelCalls} model call{modelCalls === 1 ? '' : 's'} ·{' '}
                {formatTokens((job.tokensIn ?? 0) + (job.tokensOut ?? 0))} tokens
              </span>
            )}
          </div>
          <ol
            ref={feedRef}
            aria-live="polite"
            className="custom-scrollbar max-h-80 overflow-y-auto px-4 py-2"
          >
            {events.length === 0 ? (
              <li className="flex items-center gap-2 py-3 text-[13px] text-stone-500">
                {running && <Loader2 size={14} className="animate-spin text-brand-600" aria-hidden="true" />}
                {running ? 'Waiting for the first step…' : 'No activity was recorded.'}
              </li>
            ) : (
              events.map((event) => (
                <li key={event.seq} className="flex items-start gap-2.5 py-1 text-[13px] leading-5">
                  <span className="mt-1 flex h-3 w-3 flex-shrink-0 items-center justify-center">
                    <EventIcon kind={event.kind} />
                  </span>
                  <span className="w-16 flex-shrink-0 font-mono text-xs leading-5 tabular-nums text-stone-400">
                    {formatTime(event.createdAt)}
                  </span>
                  <Badge className="flex-shrink-0">{agentLabel(event.agent)}</Badge>
                  <span
                    className={cn(
                      'min-w-0 flex-1 break-words',
                      event.kind === 'error'
                        ? 'text-red-700'
                        : event.kind === 'warning'
                          ? 'text-amber-700'
                          : 'text-stone-700',
                    )}
                  >
                    {event.label}
                  </span>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>

      {running ? (
        <WizardFooter
          start={
            <Button
              variant="danger"
              icon={Ban}
              onClick={() => setConfirmStop(true)}
              loading={isCancelling || cancelRequested}
            >
              {cancelRequested ? 'Stopping…' : 'Stop drafting'}
            </Button>
          }
          hint="Drafting continues if you close this."
        >
          <Button variant="primary" onClick={onClose}>
            Close and keep working
          </Button>
        </WizardFooter>
      ) : (
        <WizardFooter>
          {job.status === 'failed' || job.status === 'cancelled' ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" icon={RotateCcw} onClick={onStartOver}>
                Start over
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </WizardFooter>
      )}

      <ConfirmDialog
        open={confirmStop}
        title="Stop drafting?"
        description="The AI stops at its next checkpoint. Nothing is added to the course, and any items it drafted are discarded."
        confirmLabel="Stop drafting"
        onConfirm={() => {
          setConfirmStop(false);
          onCancel();
        }}
        onCancel={() => setConfirmStop(false)}
      />
    </>
  );
};

export default ProgressStep;
