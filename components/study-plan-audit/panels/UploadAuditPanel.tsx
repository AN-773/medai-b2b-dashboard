import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, Layers } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetUploadAuditResponse,
  UploadAuditChunk,
} from '@/types/StudyPlanAuditTypes';
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
  uploadIdentifier: string | null;
  onClose: () => void;
  onOpenLo: (identifier: string) => void;
};

const UploadAuditPanel: React.FC<Props> = ({
  uploadIdentifier,
  onClose,
  onOpenLo,
}) => {
  const [data, setData] = useState<GetUploadAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!uploadIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await studyPlanAuditService.getUploadAudit(uploadIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load upload audit.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uploadIdentifier) {
      setData(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadIdentifier]);

  return (
    <Drawer
      open={!!uploadIdentifier}
      onClose={onClose}
      title={
        loading
          ? 'Loading upload…'
          : data
            ? data.file_name
            : 'Upload'
      }
      subtitle={
        data
          ? `Upload ${uploadIdentifier ?? data.upload_id}`
          : uploadIdentifier ?? undefined
      }
    >
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <div className="space-y-5">
          <Section title="Upload">
            <KVGrid cols={4}>
              <KV label="Status">
                <StatusPill value={data.status} />
              </KV>
              <KV label="Tenant">
                <TenantTag tenantId={data.tenant_id} />
              </KV>
              <KV label="Chunks" mono>
                {formatNumber(data.chunk_count)}
              </KV>
              <KV label="LOs extracted" mono>
                {formatNumber(data.learning_objectives.length)}
              </KV>
              <KV label="Upload">
                <IdChip value={data.upload_id} label="upload" />
              </KV>
              <KV label="Study plan">
                {data.study_plan_id ? (
                  <IdChip value={data.study_plan_id} label="plan" />
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </KV>
              <KV label="File name">
                <span className="font-mono text-[11px]">{data.file_name}</span>
              </KV>
              <KV label="Extraction runs" mono>
                {formatNumber(data.extraction_runs.length)}
              </KV>
            </KVGrid>
          </Section>

          <ExtractionRuns runs={data.extraction_runs} />
          <ExtractedLOs los={data.learning_objectives} onOpenLo={onOpenLo} />
          <UnlinkedChunks chunks={data.unlinked_chunks} />
        </div>
      )}
    </Drawer>
  );
};

const ExtractionRuns: React.FC<{
  runs: GetUploadAuditResponse['extraction_runs'];
}> = ({ runs }) => (
  <Section
    title="Extraction runs"
    subtitle="Upload-scoped runs from LO extraction stages"
    dense
  >
    {runs.length === 0 ? (
      <EmptyBlock title="No extraction runs recorded" />
    ) : (
      <div className="space-y-2 p-4">
        {runs.map((r) => {
          const duration =
            computeDurationMs(r.started_at, r.ended_at) ?? r.latency_ms;
          return (
            <div
              key={r.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={r.status} />
                  <StagePill value={r.stage} />
                  <span className="font-mono text-[10.5px] text-slate-500">
                    {r.model}
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-500">
                    attempt #{r.attempt}
                  </span>
                  {r.error_code && (
                    <span className="font-mono text-[10.5px] text-rose-600">
                      {r.error_code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="font-mono tabular-nums">
                    tok {formatNumber(r.input_token_count)} →{' '}
                    {formatNumber(r.output_token_count)}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatDurationMs(duration)}
                  </span>
                  {r.langfuse_trace_url && (
                    <LangfuseLink href={r.langfuse_trace_url} />
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
                <IdChip value={r.id} label="run" />
                {r.langfuse_trace_id && (
                  <IdChip value={r.langfuse_trace_id} label="trace" />
                )}
                <span>started <TimeAgo iso={r.started_at} /></span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </Section>
);

const ExtractedLOs: React.FC<{
  los: GetUploadAuditResponse['learning_objectives'];
  onOpenLo: (identifier: string) => void;
}> = ({ los, onOpenLo }) => (
  <Section
    title={`Extracted learning objectives (${los.length})`}
    subtitle="Chunks linked to each LO, deduplicated"
    dense
  >
    {los.length === 0 ? (
      <EmptyBlock title="No LOs extracted from this upload" />
    ) : (
      <div className="space-y-2 p-4">
        {los.map((lo) => (
          <LOAccordion key={lo.id} lo={lo} onOpenLo={onOpenLo} />
        ))}
      </div>
    )}
  </Section>
);

const LOAccordion: React.FC<{
  lo: GetUploadAuditResponse['learning_objectives'][number];
  onOpenLo: (identifier: string) => void;
}> = ({ lo, onOpenLo }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="flex min-w-0 items-start gap-2">
          {open ? (
            <ChevronDown size={14} className="mt-0.5 text-slate-400" />
          ) : (
            <ChevronRight size={14} className="mt-0.5 text-slate-400" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">
              {lo.title || '(untitled)'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
              <span className="font-mono">{lo.identifier}</span>
              <IdChip value={lo.id} label="lo" />
              <TenantTag tenantId={lo.tenant_id} />
              <span className="font-mono">
                {lo.chunks.length} chunks
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLo(lo.identifier);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <GitBranch size={11} />
          lineage
        </button>
      </button>
      {open && lo.chunks.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/60 p-3">
          <ChunkGrid chunks={lo.chunks} />
        </div>
      )}
    </div>
  );
};

const UnlinkedChunks: React.FC<{ chunks: UploadAuditChunk[] }> = ({
  chunks,
}) => (
  <Section
    title={`Unlinked chunks (${chunks.length})`}
    subtitle="Upload chunks not linked to any extracted LO"
    dense
  >
    {chunks.length === 0 ? (
      <EmptyBlock title="No unlinked chunks" />
    ) : (
      <div className="p-4">
        <ChunkGrid chunks={chunks} />
      </div>
    )}
  </Section>
);

const ChunkGrid: React.FC<{ chunks: UploadAuditChunk[] }> = ({ chunks }) => (
  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
    {chunks.map((c) => (
      <div
        key={c.id}
        className="rounded-md border border-slate-200 bg-white p-2"
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
          <Layers size={11} className="text-slate-400" />
          <span className="font-mono">#{c.chunk_index}</span>
          <span className="font-mono">{c.source_file}</span>
          <IdChip value={c.id} label="chunk" />
          <span className="font-mono">tok {formatNumber(c.token_count)}</span>
        </div>
        {c.heading && (
          <div className="mt-1 text-[11px] font-semibold text-slate-700">
            {c.heading}
          </div>
        )}
        {c.content_snippet && (
          <div className="mt-1 line-clamp-3 text-[11px] text-slate-600">
            {c.content_snippet}
          </div>
        )}
      </div>
    ))}
  </div>
);

export default UploadAuditPanel;
