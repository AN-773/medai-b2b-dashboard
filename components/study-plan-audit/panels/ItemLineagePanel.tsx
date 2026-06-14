import React, { useEffect, useState } from 'react';
import { ArrowDown, FileText, GitBranch, Layers } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type { GetItemLineageResponse } from '@/types/StudyPlanAuditTypes';
import {
  Drawer,
  EmptyBlock,
  ErrorBlock,
  IdChip,
  KV,
  KVGrid,
  LangfuseLink,
  LoadingBlock,
  Section,
  StagePill,
  StatusPill,
  TenantTag,
  TimeAgo,
  computeDurationMs,
  formatDurationMs,
  formatNumber,
} from '../shared';

type Props = {
  itemIdentifier: string | null;
  onClose: () => void;
  onOpenLo: (identifier: string) => void;
};

const ItemLineagePanel: React.FC<Props> = ({
  itemIdentifier,
  onClose,
  onOpenLo,
}) => {
  const [data, setData] = useState<GetItemLineageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!itemIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await studyPlanAuditService.getItemLineage(itemIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load item lineage.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (itemIdentifier) {
      setData(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdentifier]);

  return (
    <Drawer
      open={!!itemIdentifier}
      onClose={onClose}
      title={
        loading
          ? 'Loading lineage…'
          : data
            ? `Item ${data.item.identifier}`
            : 'Item lineage'
      }
      subtitle={
        data
          ? `Type ${data.item.type} · plan ${data.study_plan_id}`
          : itemIdentifier ?? undefined
      }
    >
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <div className="space-y-5">
          {/* Item -> LO -> Run -> Chunks */}
          <Section title="Item">
            <KVGrid cols={3}>
              <KV label="Identifier" mono>
                {data.item.identifier}
              </KV>
              <KV label="Type">
                <StagePill value={data.item.type} />
              </KV>
              <KV label="Tenant">
                <TenantTag tenantId={data.tenant_id} />
              </KV>
            </KVGrid>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <IdChip value={data.item.id} label="item" />
              <IdChip value={data.study_plan_id} label="plan" />
            </div>
            {data.item.stem_or_question_or_front && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                {data.item.stem_or_question_or_front}
              </div>
            )}
          </Section>

          <Arrow label="generated for" />

          <Section
            title="Learning objective"
            right={
              <button
                type="button"
                onClick={() => onOpenLo(data.learning_objective.identifier)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <GitBranch size={11} />
                Open LO lineage
              </button>
            }
          >
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-slate-900">
                {data.learning_objective.title || '(untitled)'}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                <span className="font-mono">
                  {data.learning_objective.identifier}
                </span>
                <IdChip value={data.learning_objective.id} label="lo" />
                <TenantTag tenantId={data.learning_objective.tenant_id} />
              </div>
            </div>
          </Section>

          <Arrow label="produced by run" />

          <Section title="Producing run">
            <RunDetails run={data.generation_run} />
          </Section>

          <Arrow label="grounded on chunks" />

          <Section
            title={`Source chunks (${data.chunks.length})`}
            subtitle="Chunks resolved from the run's chunk_ids"
          >
            {data.chunks.length === 0 ? (
              <EmptyBlock
                title="No chunks attached"
                hint={`Often true when chunk_source = "internal_reused" or "internal_generated".`}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {data.chunks.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-slate-200 bg-white p-2"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                      <Layers size={11} />
                      <span className="font-mono">#{c.chunk_index}</span>
                      <span className="font-mono">{c.source_file}</span>
                      <IdChip value={c.id} label="chunk" />
                      <span className="font-mono">
                        tok {formatNumber(c.token_count)}
                      </span>
                    </div>
                    {c.heading && (
                      <div className="mt-1 text-[11px] font-semibold text-slate-700">
                        {c.heading}
                      </div>
                    )}
                    {c.content_snippet && (
                      <div className="mt-1 line-clamp-4 text-[11px] text-slate-600">
                        {c.content_snippet}
                      </div>
                    )}
                    {c.upload && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 text-[10.5px] text-slate-500">
                        <FileText size={11} />
                        <span className="font-mono">{c.upload.file_name}</span>
                        <IdChip value={c.upload.id} label="upload" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
};

const Arrow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
    <ArrowDown size={12} />
    {label}
    <ArrowDown size={12} />
  </div>
);

const RunDetails: React.FC<{
  run: GetItemLineageResponse['generation_run'];
}> = ({ run }) => {
  const duration =
    computeDurationMs(run.started_at, run.ended_at) ?? run.latency_ms;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={run.status} />
        <StagePill value={run.stage} />
        <span className="font-mono text-[10.5px] text-slate-500">
          {run.model}
        </span>
        <span className="font-mono text-[10.5px] text-slate-500">
          attempt #{run.attempt}
        </span>
        {run.error_code && (
          <span className="font-mono text-[10.5px] text-rose-600">
            {run.error_code}
          </span>
        )}
      </div>
      <div className="mt-3">
        <KVGrid cols={3}>
          <KV label="Prompt type" mono>
            {run.prompt_type || '—'}
          </KV>
          <KV label="Tokens (in / out)" mono>
            {formatNumber(run.input_token_count)} /{' '}
            {formatNumber(run.output_token_count)}
          </KV>
          <KV label="Duration" mono>
            {formatDurationMs(duration)}
          </KV>
          <KV label="Started">
            <TimeAgo iso={run.started_at} />
          </KV>
          <KV label="Ended">
            <TimeAgo iso={run.ended_at} />
          </KV>
          <KV label="Langfuse">
            <div className="flex flex-wrap items-center gap-1.5">
              {run.langfuse_trace_id && (
                <IdChip value={run.langfuse_trace_id} label="trace" />
              )}
              {run.langfuse_span_id && (
                <IdChip value={run.langfuse_span_id} label="span" />
              )}
              {run.langfuse_trace_url && (
                <LangfuseLink href={run.langfuse_trace_url} label="trace" />
              )}
              {run.langfuse_span_url && (
                <LangfuseLink href={run.langfuse_span_url} label="span" />
              )}
            </div>
          </KV>
        </KVGrid>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <IdChip value={run.id} label="run" />
      </div>
    </>
  );
};

export default ItemLineagePanel;
