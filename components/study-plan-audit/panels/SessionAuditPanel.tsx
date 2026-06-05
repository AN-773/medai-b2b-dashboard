import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Layers,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetSessionAuditResponse,
  RecordSessionScoreRequest,
} from '@/types/StudyPlanAuditTypes';
import {
  ChunkSourcePill,
  Drawer,
  EmptyBlock,
  ErrorBlock,
  IdChip,
  JsonBlock,
  KV,
  KVGrid,
  LangfuseLink,
  LoadingBlock,
  Section,
  StagePill,
  StatusPill,
  StrategyPill,
  TenantTag,
  TimeAgo,
  computeDurationMs,
  formatDurationMs,
  formatNumber,
} from '../shared';

type Props = {
  sessionIdentifier: string | null;
  onClose: () => void;
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
};

const SessionAuditPanel: React.FC<Props> = ({
  sessionIdentifier,
  onClose,
  onOpenItem,
  onOpenLo,
}) => {
  const [data, setData] = useState<GetSessionAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!sessionIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp =
        await studyPlanAuditService.getSessionAudit(sessionIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load session audit.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionIdentifier) {
      setData(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdentifier]);

  return (
    <Drawer
      open={!!sessionIdentifier}
      onClose={onClose}
      title={
        loading
          ? 'Loading session…'
          : data
            ? `Session ${sessionIdentifier ?? data.session.id}`
            : 'Session'
      }
      subtitle={
        data
          ? `Study plan ${data.session.study_plan_id} · ${data.session.mode}`
          : sessionIdentifier ?? undefined
      }
      right={
        data?.session.langfuse_trace_url ? (
          <LangfuseLink href={data.session.langfuse_trace_url} label="Trace" />
        ) : undefined
      }
    >
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <div className="space-y-5">
          <Header data={data} />
          <Selection data={data} />
          <LOs
            data={data}
            onOpenItem={onOpenItem}
            onOpenLo={onOpenLo}
          />
          <ScoreForm
            sessionIdentifier={sessionIdentifier ?? ''}
            data={data}
          />
        </div>
      )}
    </Drawer>
  );
};

// ---------- Header ----------

const Header: React.FC<{ data: GetSessionAuditResponse }> = ({ data }) => {
  const duration = computeDurationMs(
    data.session.started_at,
    data.session.ended_at,
  );
  return (
    <Section title="Session totals">
      <KVGrid cols={4}>
        <KV label="Status">
          <div className="flex items-center gap-2">
            <StatusPill value={data.totals.status} />
            {data.totals.error_code && (
              <span className="font-mono text-[10.5px] text-rose-600">
                {data.totals.error_code}
              </span>
            )}
          </div>
        </KV>
        <KV label="Mode">
          <StagePill value={data.session.mode} />
        </KV>
        <KV label="Items requested" mono>
          {formatNumber(data.session.requested_item_count)}
        </KV>
        <KV label="Items generated / persisted" mono>
          {formatNumber(data.totals.items_generated)} /{' '}
          {formatNumber(data.totals.items_persisted)}
        </KV>
        <KV label="Tenant">
          <TenantTag tenantId={data.tenant_id} />
        </KV>
        <KV label="Block">
          {data.totals.block_id ? (
            <IdChip value={data.totals.block_id} label="block" />
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </KV>
        <KV label="Started">
          <TimeAgo iso={data.session.started_at} />
        </KV>
        <KV label="Duration" mono>
          {duration == null ? '—' : formatDurationMs(duration)}
        </KV>
      </KVGrid>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Langfuse
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.session.langfuse_trace_id && (
              <IdChip value={data.session.langfuse_trace_id} label="trace" />
            )}
            {data.session.langfuse_session_id && (
              <IdChip
                value={data.session.langfuse_session_id}
                label="lf-session"
              />
            )}
            {data.session.langfuse_trace_url && (
              <LangfuseLink href={data.session.langfuse_trace_url} />
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Source scope
          </div>
          <SourceScope scope={data.session.source_scope} />
        </div>
      </div>
    </Section>
  );
};

const SourceScope: React.FC<{
  scope: GetSessionAuditResponse['session']['source_scope'];
}> = ({ scope }) => {
  const enabled = scope.enabled;
  const uploads = scope.upload_ids?.length ?? 0;
  const exams = scope.internal_source_exams?.length ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1 ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            : 'bg-slate-100 text-slate-600 ring-slate-200'
        }`}
      >
        scope {enabled ? 'enabled' : 'disabled'}
      </span>
      <span className="font-mono text-[11px] text-slate-600">
        uploads: <strong>{uploads}</strong>
      </span>
      <span className="font-mono text-[11px] text-slate-600">
        internal exams: <strong>{exams}</strong>
      </span>
    </div>
  );
};

// ---------- Selection ----------

const Selection: React.FC<{ data: GetSessionAuditResponse }> = ({ data }) => {
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const rows = useMemo(() => {
    const arr = [...data.selection.los];
    arr.sort((a, b) => a.rank - b.rank);
    return showOnlySelected ? arr.filter((r) => r.selected) : arr;
  }, [data.selection.los, showOnlySelected]);

  return (
    <Section
      title="LO selection"
      subtitle={
        <span>
          Strategy <strong>{data.selection.strategy}</strong> · pool{' '}
          <strong>{data.selection.candidate_pool_size}</strong> · selected{' '}
          <strong>{data.selection.los_selected_count}</strong>
        </span>
      }
      right={
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={showOnlySelected}
            onChange={(e) => setShowOnlySelected(e.target.checked)}
            className="h-3 w-3"
          />
          selected only
        </label>
      }
      dense
    >
      {rows.length === 0 ? (
        <EmptyBlock title="No LO candidates" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 font-black">#</th>
                <th className="px-4 py-2 font-black">Learning objective</th>
                <th className="px-4 py-2 font-black">Strategy</th>
                <th className="px-4 py-2 text-right font-black">Accuracy</th>
                <th className="px-4 py-2 text-right font-black">Attempts</th>
                <th className="px-4 py-2 font-black">Last seen</th>
                <th className="px-4 py-2 font-black">Scope match</th>
                <th className="px-4 py-2 font-black">Selected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((lo) => (
                <tr
                  key={lo.id}
                  className={
                    lo.selected
                      ? 'bg-emerald-50/30'
                      : 'opacity-80'
                  }
                >
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                    {lo.rank}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-slate-800">
                        {lo.title || '(untitled)'}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        <span className="font-mono">{lo.identifier}</span>
                        <IdChip value={lo.id} label="lo" />
                      </div>
                      {lo.notes && (
                        <span className="text-[10.5px] italic text-slate-500">
                          {lo.notes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <StrategyPill value={lo.strategy} />
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                    {lo.accuracy == null
                      ? '—'
                      : `${(lo.accuracy * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                    {lo.attempts_count == null
                      ? '—'
                      : formatNumber(lo.attempts_count)}
                  </td>
                  <td className="px-4 py-2">
                    <TimeAgo iso={lo.last_seen_at} />
                  </td>
                  <td className="px-4 py-2 font-mono text-[10.5px] text-slate-600">
                    {lo.scope_match_reason || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {lo.selected ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 size={12} />
                        yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <XCircle size={12} />
                        no
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
};

// ---------- LOs ----------

const LOs: React.FC<{
  data: GetSessionAuditResponse;
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
}> = ({ data, onOpenItem, onOpenLo }) => {
  if (data.los.length === 0) {
    return (
      <Section title="Generated LO breakdown">
        <EmptyBlock
          title="No LOs produced generation rows"
          hint="The selection may have been empty, or all runs failed before persistence."
        />
      </Section>
    );
  }
  return (
    <Section
      title="Generated LO breakdown"
      subtitle="One block per LO with runs, chunks used, and items"
      dense
    >
      <div className="space-y-3 p-4">
        {data.los.map((lo) => (
          <LOBlock
            key={lo.id}
            lo={lo}
            onOpenItem={onOpenItem}
            onOpenLo={onOpenLo}
          />
        ))}
      </div>
    </Section>
  );
};

const LOBlock: React.FC<{
  lo: GetSessionAuditResponse['los'][number];
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
}> = ({ lo, onOpenItem, onOpenLo }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-bold text-slate-900">
            {lo.title || '(untitled LO)'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
            <span className="font-mono">{lo.identifier}</span>
            <IdChip value={lo.id} label="lo" />
            <TenantTag tenantId={lo.tenant_id} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <span>
            <strong>{lo.runs.length}</strong> runs
          </span>
          <span>
            <strong>{lo.items.length}</strong> items
          </span>
          <span>
            <strong>{lo.chunks_used.length}</strong> chunks
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLo(lo.identifier);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold hover:bg-slate-50"
          >
            <GitBranch size={11} />
            lineage
          </button>
        </div>
      </button>
      {open && (
        <div className="space-y-4 p-4">
          <RunsTimeline runs={lo.runs} />
          <ChunksList chunks={lo.chunks_used} />
          <ItemsList items={lo.items} onOpenItem={onOpenItem} />
        </div>
      )}
    </div>
  );
};

const RunsTimeline: React.FC<{
  runs: GetSessionAuditResponse['los'][number]['runs'];
}> = ({ runs }) => {
  if (runs.length === 0)
    return (
      <EmptyBlock
        title="No runs recorded for this LO"
        icon={<AlertTriangle size={28} className="opacity-30" />}
      />
    );
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <Sparkles size={12} /> Runs
      </div>
      <div className="space-y-2">
        {runs.map((r) => (
          <RunRow key={r.id} run={r} />
        ))}
      </div>
    </div>
  );
};

const RunRow: React.FC<{
  run: GetSessionAuditResponse['los'][number]['runs'][number];
}> = ({ run }) => {
  const [open, setOpen] = useState(false);
  const duration =
    computeDurationMs(run.started_at, run.ended_at) ?? run.latency_ms;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={run.status} />
          <StagePill value={run.stage} />
          <ChunkSourcePill value={run.chunk_source} />
          <span className="font-mono text-[10.5px] text-slate-500">
            {run.model}
          </span>
          <span className="font-mono text-[10.5px] text-slate-500">
            attempt #{run.attempt}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <span className="font-mono tabular-nums">
            req {formatNumber(run.items_requested)}
          </span>
          <span className="font-mono tabular-nums">
            ret {formatNumber(run.items_returned)}
          </span>
          <span className="font-mono tabular-nums">
            ok {formatNumber(run.items_persisted)}
          </span>
          <span className="font-mono tabular-nums">
            {formatDurationMs(duration)}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-200 bg-slate-50/60 p-3">
          <KVGrid cols={3}>
            <KV label="Prompt type" mono>
              {run.prompt_type || '—'}
            </KV>
            <KV label="Tokens (in / out)" mono>
              {formatNumber(run.input_token_count)} /{' '}
              {formatNumber(run.output_token_count)}
            </KV>
            <KV label="Error code" mono>
              {run.error_code ? (
                <span className="text-rose-600">{run.error_code}</span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
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
                {run.langfuse_span_url && (
                  <LangfuseLink href={run.langfuse_span_url} label="span" />
                )}
                {run.langfuse_trace_url && (
                  <LangfuseLink
                    href={run.langfuse_trace_url}
                    label="trace"
                  />
                )}
              </div>
            </KV>
          </KVGrid>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Chunk IDs ({run.chunk_ids.length})
              </div>
              {run.chunk_ids.length === 0 ? (
                <span className="text-[11px] text-slate-400">none</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {run.chunk_ids.map((cid, i) => (
                    <span
                      key={cid}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 ring-1 ring-slate-200"
                      title={cid}
                    >
                      <span className="text-slate-400">#{i}</span>
                      {cid.slice(0, 8)}…
                      {run.chunk_similarity_scores[i] != null && (
                        <span className="text-emerald-700">
                          {run.chunk_similarity_scores[i].toFixed(3)}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Rejection reasons ({run.rejection_reasons.length})
              </div>
              {run.rejection_reasons.length === 0 ? (
                <span className="text-[11px] text-slate-400">none</span>
              ) : (
                <ul className="space-y-1">
                  {run.rejection_reasons.map((rr) => (
                    <li
                      key={`${rr.index}-${rr.reason}`}
                      className="rounded-md bg-rose-50 px-2 py-1 font-mono text-[11px] text-rose-700 ring-1 ring-rose-200"
                    >
                      <strong>#{rr.index}</strong> {rr.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChunksList: React.FC<{
  chunks: GetSessionAuditResponse['los'][number]['chunks_used'];
}> = ({ chunks }) => {
  if (chunks.length === 0) return null;
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <Layers size={12} /> Chunks used ({chunks.length})
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {chunks.map((c) => (
          <div
            key={c.id}
            className="rounded-md border border-slate-200 bg-slate-50/50 p-2"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
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
            {c.snippet && (
              <div className="mt-1 line-clamp-3 text-[11px] text-slate-600">
                {c.snippet}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ItemsList: React.FC<{
  items: GetSessionAuditResponse['los'][number]['items'];
  onOpenItem: (identifier: string) => void;
}> = ({ items, onOpenItem }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        Items ({items.length})
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                <StagePill value={it.type} />
                <span className="font-mono">{it.identifier}</span>
                <IdChip value={it.id} label="item" />
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
    </div>
  );
};

// ---------- Score form ----------

const ScoreForm: React.FC<{
  sessionIdentifier: string;
  data: GetSessionAuditResponse;
}> = ({ sessionIdentifier, data }) => {
  const [value, setValue] = useState<'good' | 'bad'>('good');
  const [targetType, setTargetType] = useState<'session' | 'lo' | 'item'>(
    'session',
  );
  const [targetId, setTargetId] = useState<string>('');
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const loOptions = data.los.map((lo) => ({
    id: lo.id,
    label: `${lo.identifier} · ${lo.title}`,
  }));
  const itemOptions = data.los.flatMap((lo) =>
    lo.items.map((it) => ({
      id: it.id,
      label: `${it.identifier} · ${it.type}`,
    })),
  );

  useEffect(() => {
    setTargetId('');
  }, [targetType]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitOk(null);
    if (targetType !== 'session' && !targetId) {
      setSubmitError(`Pick a ${targetType} first.`);
      return;
    }
    const payload: RecordSessionScoreRequest = {
      value,
      comment: comment.trim() || undefined,
      name: name.trim() || undefined,
      lo_id: targetType === 'lo' ? targetId : undefined,
      item_id: targetType === 'item' ? targetId : undefined,
    };
    setSubmitting(true);
    try {
      const resp = await studyPlanAuditService.recordSessionScore(
        sessionIdentifier,
        payload,
      );
      setSubmitOk(`Recorded score ${resp.id}.`);
      setComment('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to record score.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section
      title="Doctor annotation"
      subtitle="Records a good/bad score to audit_scores + Langfuse"
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setValue('good')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition ${
              value === 'good'
                ? 'bg-emerald-600 text-white ring-emerald-600'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <ThumbsUp size={12} /> good
          </button>
          <button
            type="button"
            onClick={() => setValue('bad')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition ${
              value === 'bad'
                ? 'bg-rose-600 text-white ring-rose-600'
                : 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100'
            }`}
          >
            <ThumbsDown size={12} /> bad
          </button>
          <div className="ml-2 inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
            {(['session', 'lo', 'item'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTargetType(t)}
                className={`px-2 py-1.5 font-semibold ${
                  targetType === t
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {targetType !== 'session' && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
          >
            <option value="">
              Pick {targetType === 'lo' ? 'an LO' : 'an item'} from this
              session…
            </option>
            {(targetType === 'lo' ? loOptions : itemOptions).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Score name (defaults to doctor_quality)"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
          />
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
          />
        </div>

        {submitError && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
            {submitError}
          </div>
        )}
        {submitOk && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
            {submitOk}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Send size={12} />
            {submitting ? 'Saving…' : 'Record score'}
          </button>
        </div>
      </form>

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-[11px] text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">
          Raw source_scope JSON
        </summary>
        <div className="mt-2">
          <JsonBlock value={data.session.source_scope} />
        </div>
      </details>
    </Section>
  );
};

export default SessionAuditPanel;
