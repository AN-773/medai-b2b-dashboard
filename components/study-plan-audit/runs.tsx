import React from 'react';
import type { AuditRunBase } from '@/types/StudyPlanAuditTypes';
import { InlineAlert } from '@/components/ui';
import {
  IdChip,
  KV,
  KVGrid,
  LangfuseLink,
  StagePill,
  StatusPill,
  TimeAgo,
  computeDurationMs,
  formatDurationMs,
  formatNumber,
} from './shared';

type RunLike = AuditRunBase & {
  langfuse_span_id?: string;
  langfuse_span_url?: string;
};

export const runDurationMs = (run: AuditRunBase) =>
  computeDurationMs(run.started_at, run.ended_at) ?? run.latency_ms;

export const isFailedRun = (run: Pick<AuditRunBase, 'status'>) => run.status === 'failed';

/** Status · stage · (extra) · model · attempt — the one-line identity of a run. */
export const RunHeadline: React.FC<{ run: AuditRunBase; extra?: React.ReactNode }> = ({
  run,
  extra,
}) => (
  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
    <StatusPill value={run.status} />
    <StagePill value={run.stage} />
    {extra}
    {run.model && <code className="font-mono text-xs text-stone-600">{run.model}</code>}
    <span className="text-xs tabular-nums text-stone-500">Attempt {run.attempt}</span>
  </div>
);

/** Error code + message as an alert; renders nothing for clean runs. */
export const RunError: React.FC<{ run: AuditRunBase; className?: string }> = ({
  run,
  className,
}) => {
  if (!run.error_code && !run.error_message && !isFailedRun(run)) return null;
  return (
    <InlineAlert tone="error" title={run.error_code || 'Run failed'} className={className}>
      <span className="whitespace-pre-wrap break-words">
        {run.error_message || 'No error message was recorded for this run.'}
      </span>
    </InlineAlert>
  );
};

export const LangfuseRefs: React.FC<{ run: RunLike }> = ({ run }) => {
  const hasAny =
    run.langfuse_trace_id || run.langfuse_span_id || run.langfuse_trace_url || run.langfuse_span_url;
  if (!hasAny) return <span className="text-stone-400">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {run.langfuse_trace_id && <IdChip value={run.langfuse_trace_id} label="Trace" />}
      {run.langfuse_span_id && <IdChip value={run.langfuse_span_id} label="Span" />}
      {run.langfuse_trace_url && <LangfuseLink href={run.langfuse_trace_url} label="Open trace" />}
      {run.langfuse_span_url && <LangfuseLink href={run.langfuse_span_url} label="Open span" />}
    </div>
  );
};

/** Everything else we know about a run, as a fact grid. */
export const RunFacts: React.FC<{ run: RunLike }> = ({ run }) => (
  <KVGrid cols={3}>
    <KV label="Prompt type" mono>
      {run.prompt_type || '—'}
    </KV>
    <KV label="Tokens in / out" mono>
      {formatNumber(run.input_token_count)} / {formatNumber(run.output_token_count)}
    </KV>
    <KV label="Duration" mono>
      {formatDurationMs(runDurationMs(run))}
    </KV>
    <KV label="Started">
      <TimeAgo iso={run.started_at} />
    </KV>
    <KV label="Ended">
      <TimeAgo iso={run.ended_at} />
    </KV>
    <KV label="Run">
      <IdChip value={run.id} label="ID" truncate={12} />
    </KV>
    <div className="col-span-full min-w-0">
      <dt className="text-xs text-stone-500">Langfuse</dt>
      <dd className="mt-1 text-sm">
        <LangfuseRefs run={run} />
      </dd>
    </div>
  </KVGrid>
);
