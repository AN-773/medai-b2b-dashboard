import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetUploadAuditResponse,
  UploadAuditChunk,
} from '@/types/StudyPlanAuditTypes';
import { Button, IconButton, InlineAlert } from '@/components/ui';
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
  StatusPill,
  TenantTag,
  TimeAgo,
  formatDurationMs,
  formatNumber,
  plural,
  statusTone,
} from '../shared';
import { ChunkList, toChunkView } from '../lineage';
import { RunError, RunHeadline, isFailedRun, runDurationMs } from '../runs';

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
    } else {
      // Closed: drop the old record so reopening never flashes (or focuses) stale content.
      setData(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadIdentifier]);

  return (
    <Drawer
      open={!!uploadIdentifier}
      onClose={onClose}
      title={loading ? 'Loading upload…' : data ? data.file_name : 'Upload'}
      subtitle={
        data
          ? `Upload ${uploadIdentifier ?? data.upload_id}`
          : (uploadIdentifier ?? undefined)
      }
    >
      {loading && <LoadingBlock label="Loading upload audit…" />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <div className="space-y-6">
          <UploadAlerts data={data} />
          <Section title="Summary">
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
              <KV label="Objectives extracted" mono>
                {formatNumber(data.learning_objectives.length)}
              </KV>
              <KV label="Upload">
                <IdChip value={data.upload_id} label="ID" />
              </KV>
              <KV label="Study plan">
                {data.study_plan_id ? (
                  <IdChip value={data.study_plan_id} label="ID" />
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </KV>
              <KV label="File name">
                <span className="break-all font-mono text-[13px]">{data.file_name}</span>
              </KV>
              <KV label="Extraction runs" mono>
                {formatNumber(data.extraction_runs.length)}
              </KV>
            </KVGrid>
          </Section>

          <ExtractionRuns runs={data.extraction_runs} />
          <ExtractedLOs los={data.learning_objectives} onOpenLo={onOpenLo} />
          <UnlinkedChunks chunks={data.unlinked_chunks} total={data.chunk_count} />
        </div>
      )}
    </Drawer>
  );
};

// ---------- Detected problems ----------

const UploadAlerts: React.FC<{ data: GetUploadAuditResponse }> = ({ data }) => {
  const failedRuns = data.extraction_runs.filter(isFailedRun).length;
  const uploadFailed = statusTone(data.status) === 'red';
  const noObjectives = data.learning_objectives.length === 0 && data.chunk_count > 0;
  if (!uploadFailed && failedRuns === 0 && !noObjectives) return null;
  return (
    <div className="space-y-2">
      {uploadFailed && (
        <InlineAlert tone="error" title="Upload processing failed">
          The upload is marked <code className="font-mono">{data.status}</code>. Check the
          extraction runs below for the error.
        </InlineAlert>
      )}
      {failedRuns > 0 && (
        <InlineAlert
          tone="warning"
          title={`${formatNumber(failedRuns)} of ${plural(data.extraction_runs.length, 'extraction run')} failed`}
        >
          Their error codes and messages are shown under Extraction runs.
        </InlineAlert>
      )}
      {noObjectives && (
        <InlineAlert tone="warning" title="No objectives were extracted">
          This upload has {plural(data.chunk_count, 'chunk')}, but none are linked to a learning
          objective.
        </InlineAlert>
      )}
    </div>
  );
};

// ---------- Extraction runs ----------

const ExtractionRuns: React.FC<{
  runs: GetUploadAuditResponse['extraction_runs'];
}> = ({ runs }) => (
  <Section
    title="Extraction runs"
    subtitle="Upload-scoped runs from the objective extraction stages"
    dense
  >
    {runs.length === 0 ? (
      <EmptyBlock title="No extraction runs recorded" />
    ) : (
      <ul className="divide-y divide-stone-100">
        {runs.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <RunHeadline run={r} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-stone-500">
                <span title="Input → output tokens">
                  {formatNumber(r.input_token_count)} → {formatNumber(r.output_token_count)} tokens
                </span>
                <span>{formatDurationMs(runDurationMs(r))}</span>
                {r.langfuse_trace_url && (
                  <LangfuseLink href={r.langfuse_trace_url} label="Open trace" />
                )}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
              <IdChip value={r.id} label="Run" />
              {r.langfuse_trace_id && <IdChip value={r.langfuse_trace_id} label="Trace" />}
              <span>
                Started <TimeAgo iso={r.started_at} />
              </span>
            </div>
            <RunError run={r} className="mt-2.5" />
          </li>
        ))}
      </ul>
    )}
  </Section>
);

// ---------- Extracted objectives (objective → chunks) ----------

const ExtractedLOs: React.FC<{
  los: GetUploadAuditResponse['learning_objectives'];
  onOpenLo: (identifier: string) => void;
}> = ({ los, onOpenLo }) => (
  <Section
    title={`Extracted objectives (${formatNumber(los.length)})`}
    subtitle="Chunks linked to each objective, deduplicated"
    dense
  >
    {los.length === 0 ? (
      <EmptyBlock title="No objectives extracted from this upload" />
    ) : (
      <ul className="divide-y divide-stone-100">
        {los.map((lo) => (
          <LOAccordion key={lo.id} lo={lo} onOpenLo={onOpenLo} />
        ))}
      </ul>
    )}
  </Section>
);

const LOAccordion: React.FC<{
  lo: GetUploadAuditResponse['learning_objectives'][number];
  onOpenLo: (identifier: string) => void;
}> = ({ lo, onOpenLo }) => {
  const [open, setOpen] = useState(false);
  const hasChunks = lo.chunks.length > 0;
  const regionId = `upload-lo-${lo.id}`;
  return (
    <li>
      <div className="flex items-start gap-2 px-3 py-3 sm:px-4">
        <IconButton
          icon={open ? ChevronDown : ChevronRight}
          label={open ? 'Hide linked chunks' : 'Show linked chunks'}
          size="sm"
          aria-expanded={open}
          aria-controls={regionId}
          disabled={!hasChunks}
          onClick={() => setOpen((v) => !v)}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-stone-900">
            {lo.title || 'Untitled objective'}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
            <code className="font-mono text-stone-600">{lo.identifier}</code>
            <IdChip value={lo.id} label="ID" />
            <TenantTag tenantId={lo.tenant_id} />
            <span className="tabular-nums">{plural(lo.chunks.length, 'chunk')}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={GitBranch}
          onClick={() => onOpenLo(lo.identifier)}
          aria-label={`Open lineage for objective ${lo.identifier}`}
        >
          Lineage
        </Button>
      </div>
      {open && hasChunks && (
        <div
          id={regionId}
          className="border-t border-stone-100 bg-stone-50/60 py-3 pl-6 pr-4 sm:pl-12"
        >
          <ChunkList chunks={lo.chunks.map(toChunkView)} />
        </div>
      )}
    </li>
  );
};

// ---------- Unlinked chunks ----------

const UnlinkedChunks: React.FC<{ chunks: UploadAuditChunk[]; total: number }> = ({
  chunks,
  total,
}) => (
  <Section
    title={`Unlinked chunks (${formatNumber(chunks.length)})`}
    subtitle={
      chunks.length > 0 && total > 0
        ? `${formatNumber(chunks.length)} of ${plural(total, 'chunk')} aren't linked to any extracted objective`
        : 'Upload chunks not linked to any extracted objective'
    }
    dense
  >
    {chunks.length === 0 ? (
      <EmptyBlock
        title="No unlinked chunks"
        hint={total > 0 ? 'Every chunk grounds at least one objective.' : undefined}
      />
    ) : (
      <div className="p-4">
        <ChunkList chunks={chunks.map(toChunkView)} />
      </div>
    )}
  </Section>
);

export default UploadAuditPanel;
