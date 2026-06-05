import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, GitBranch, Layers } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetLearningObjectiveLineageResponse,
} from '@/types/StudyPlanAuditTypes';
import {
  Drawer,
  EmptyBlock,
  ErrorBlock,
  IdChip,
  KV,
  KVGrid,
  LoadingBlock,
  Section,
  StagePill,
  TenantTag,
  formatNumber,
} from '../shared';

type Props = {
  loIdentifier: string | null;
  onClose: () => void;
  onOpenItem: (identifier: string) => void;
};

const LOLineagePanel: React.FC<Props> = ({
  loIdentifier,
  onClose,
  onOpenItem,
}) => {
  const [data, setData] =
    useState<GetLearningObjectiveLineageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!loIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp =
        await studyPlanAuditService.getLearningObjectiveLineage(loIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load LO lineage.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loIdentifier) {
      setData(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loIdentifier]);

  return (
    <Drawer
      open={!!loIdentifier}
      onClose={onClose}
      title={
        loading
          ? 'Loading LO lineage…'
          : data
            ? data.learning_objective.title || data.learning_objective.identifier
            : 'LO lineage'
      }
      subtitle={
        data
          ? `${data.learning_objective.identifier} · ${data.learning_objective.exam}`
          : loIdentifier ?? undefined
      }
    >
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <div className="space-y-5">
          <Section title="Learning objective">
            <KVGrid cols={3}>
              <KV label="Identifier" mono>
                {data.learning_objective.identifier}
              </KV>
              <KV label="Exam" mono>
                {data.learning_objective.exam || '—'}
              </KV>
              <KV label="Source" mono>
                {data.learning_objective.source || '—'}
              </KV>
              <KV label="Tenant">
                <TenantTag tenantId={data.tenant_id} />
              </KV>
              <KV label="LO">
                <IdChip value={data.learning_objective.id} label="lo" />
              </KV>
              <KV label="Study plan">
                {data.study_plan_id ? (
                  <IdChip value={data.study_plan_id} label="plan" />
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </KV>
            </KVGrid>
            {data.learning_objective.title && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                {data.learning_objective.title}
              </div>
            )}
          </Section>

          <Arrow up label="upstream chunks" />

          <Section
            title={`Source chunks (${data.chunks.length})`}
            subtitle="All upstream source chunks across uploads, deduplicated by chunk ID"
          >
            {data.chunks.length === 0 ? (
              <EmptyBlock title="No source chunks recorded" />
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
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 text-[10.5px] text-slate-500">
                      <IdChip value={c.run_id} label="run" />
                      {c.upload && (
                        <>
                          <FileText size={11} />
                          <span className="font-mono">
                            {c.upload.file_name}
                          </span>
                          <IdChip value={c.upload.id} label="upload" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Arrow label="downstream items" />

          <Section
            title={`Derived items (${data.items.length})`}
            subtitle="All downstream items, deduplicated by item ID"
          >
            {data.items.length === 0 ? (
              <EmptyBlock title="No derived items" />
            ) : (
              <div className="space-y-1.5">
                {data.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        <StagePill value={it.type} />
                        <span className="font-mono">{it.identifier}</span>
                        <IdChip value={it.id} label="item" />
                        <IdChip value={it.run_id} label="run" />
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12px] text-slate-700">
                        {it.stem_or_question_or_front || '(no stem)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenItem(it.identifier)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <GitBranch size={11} />
                      lineage
                    </button>
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

const Arrow: React.FC<{ label: string; up?: boolean }> = ({ label, up }) => (
  <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
    {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    {label}
    {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
  </div>
);

export default LOLineagePanel;
