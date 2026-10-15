import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Layers,
  Send,
  Sparkles,
} from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetSessionAuditResponse,
  RecordSessionScoreRequest,
} from '@/types/StudyPlanAuditTypes';
import {
  Badge,
  Button,
  Field,
  IconButton,
  InlineAlert,
  Input,
  SegmentedControl,
  Select,
  StatusDot,
  cn,
} from '@/components/ui';
import {
  ChunkSourcePill,
  CopyButton,
  Drawer,
  EmptyBlock,
  ErrorBlock,
  FALLBACK_CHUNK_SOURCES,
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
  SubHeading,
  TenantTag,
  TimeAgo,
  computeDurationMs,
  formatDurationMs,
  formatNumber,
  plural,
} from '../shared';
import { Th, rowClass, tableClass, theadClass } from '../AuditTable';
import { ChunkList, ItemList, toChunkView } from '../lineage';
import { RunError, RunFacts, RunHeadline, isFailedRun, runDurationMs } from '../runs';

type Props = {
  sessionIdentifier: string | null;
  onClose: () => void;
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
};

type SessionLO = GetSessionAuditResponse['los'][number];
type SessionRun = SessionLO['runs'][number];

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
      const resp = await studyPlanAuditService.getSessionAudit(sessionIdentifier);
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
    } else {
      // Closed: drop the old record so reopening never flashes (or focuses) stale content.
      setData(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdentifier]);

  return (
    <Drawer
      open={!!sessionIdentifier}
      onClose={onClose}
      widthClass="max-w-4xl"
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
          : (sessionIdentifier ?? undefined)
      }
    >
      {loading && <LoadingBlock label="Loading session audit…" />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <div className="space-y-6">
          <SessionAlerts data={data} />
          <Summary data={data} />
          <Selection data={data} />
          <LOs data={data} onOpenItem={onOpenItem} onOpenLo={onOpenLo} />
          <ScoreForm sessionIdentifier={sessionIdentifier ?? ''} data={data} />
        </div>
      )}
    </Drawer>
  );
};

// ---------- Detected problems ----------

const SessionAlerts: React.FC<{ data: GetSessionAuditResponse }> = ({ data }) => {
  const { totals, session } = data;
  const runs = data.los.flatMap((lo) => lo.runs);
  const failedRuns = runs.filter(isFailedRun).length;
  const fallbackRuns = runs.filter((run) => FALLBACK_CHUNK_SOURCES.has(run.chunk_source)).length;
  const rejected = runs.reduce((sum, run) => sum + run.rejection_reasons.length, 0);
  const requested = session.requested_item_count;
  const shortfall =
    totals.status !== 'failed' &&
    totals.status !== 'no_items_generated' &&
    requested > 0 &&
    totals.items_persisted < requested;

  const warnings: React.ReactNode[] = [];
  if (totals.status === 'no_items_generated') {
    warnings.push('No items were generated for this session.');
  }
  if (shortfall) {
    warnings.push(
      `Only ${formatNumber(totals.items_persisted)} of ${formatNumber(requested)} requested items were persisted.`,
    );
  }
  if (failedRuns > 0) {
    warnings.push(`${formatNumber(failedRuns)} of ${plural(runs.length, 'generation run')} failed.`);
  }
  if (fallbackRuns > 0) {
    warnings.push(
      `${plural(fallbackRuns, 'run')} fell back to similarity or random chunks instead of the objective's linked chunks.`,
    );
  }
  if (rejected > 0) {
    warnings.push(`${plural(rejected, 'generated item')} rejected during validation.`);
  }

  const failed = Boolean(
    totals.status === 'failed' || totals.error_code || totals.error_message,
  );
  if (!failed && warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {failed && (
        <InlineAlert
          tone="error"
          title={
            totals.error_code
              ? `Session generation failed · ${totals.error_code}`
              : 'Session generation failed'
          }
        >
          <span className="whitespace-pre-wrap break-words">
            {totals.error_message || 'No error message was recorded for this session.'}
          </span>
        </InlineAlert>
      )}
      {warnings.length > 0 && (
        <InlineAlert tone="warning" title="Worth checking">
          <ul className="list-disc space-y-0.5 pl-4">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </InlineAlert>
      )}
    </div>
  );
};

// ---------- Summary ----------

const Summary: React.FC<{ data: GetSessionAuditResponse }> = ({ data }) => {
  const duration = computeDurationMs(data.session.started_at, data.session.ended_at);
  return (
    <Section title="Summary">
      <KVGrid cols={4}>
        <KV label="Status">
          <StatusPill value={data.totals.status} />
        </KV>
        <KV label="Mode">
          <StagePill value={data.session.mode} />
        </KV>
        <KV label="Items requested" mono>
          {formatNumber(data.session.requested_item_count)}
        </KV>
        <KV label="Generated / persisted" mono>
          {formatNumber(data.totals.items_generated)} / {formatNumber(data.totals.items_persisted)}
        </KV>
        <KV label="Tenant">
          <TenantTag tenantId={data.tenant_id} />
        </KV>
        <KV label="Block">
          {data.totals.block_id ? (
            <IdChip value={data.totals.block_id} label="ID" />
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </KV>
        <KV label="Started">
          <TimeAgo iso={data.session.started_at} />
        </KV>
        <KV label="Duration" mono>
          {duration == null ? '—' : formatDurationMs(duration)}
        </KV>
      </KVGrid>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-stone-100 pt-4 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-stone-500">Langfuse</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {data.session.langfuse_trace_id && (
              <IdChip value={data.session.langfuse_trace_id} label="Trace" />
            )}
            {data.session.langfuse_session_id && (
              <IdChip value={data.session.langfuse_session_id} label="Langfuse session" />
            )}
            {data.session.langfuse_trace_url && (
              <LangfuseLink href={data.session.langfuse_trace_url} label="Open trace" />
            )}
            {!data.session.langfuse_trace_id &&
              !data.session.langfuse_session_id &&
              !data.session.langfuse_trace_url && <span className="text-sm text-stone-400">—</span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-stone-500">Source scope</dt>
          <dd className="mt-1">
            <SourceScope scope={data.session.source_scope} />
          </dd>
        </div>
      </dl>
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-600">
      <Badge tone={enabled ? 'green' : 'neutral'} dot>
        {enabled ? 'Scope enabled' : 'Scope disabled'}
      </Badge>
      <span className="tabular-nums">{plural(uploads, 'upload')}</span>
      <span className="tabular-nums">{plural(exams, 'internal exam')}</span>
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
  const selectedCount = data.selection.los.filter((lo) => lo.selected).length;

  return (
    <Section
      title="Objective selection"
      subtitle={
        <>
          Strategy <code className="font-mono text-stone-700">{data.selection.strategy}</code>
          {' · '}pool of {formatNumber(data.selection.candidate_pool_size)}
          {' · '}
          {formatNumber(data.selection.los_selected_count)} selected
        </>
      }
      right={
        <SegmentedControl
          size="sm"
          label="Which candidates to show"
          value={showOnlySelected ? 'selected' : 'all'}
          onChange={(value) => setShowOnlySelected(value === 'selected')}
          options={[
            { value: 'all', label: 'All candidates', count: data.selection.los.length },
            { value: 'selected', label: 'Selected', count: selectedCount },
          ]}
        />
      }
      dense
    >
      {rows.length === 0 ? (
        <EmptyBlock title="No objective candidates" />
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className={cn(tableClass, 'min-w-[820px]')}>
            <thead className={theadClass}>
              <tr>
                <Th align="right">Rank</Th>
                <Th>Learning objective</Th>
                <Th>Strategy</Th>
                <Th align="right">Accuracy</Th>
                <Th align="right">Attempts</Th>
                <Th>Last seen</Th>
                <Th>Scope match</Th>
                <Th>Selected</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lo) => (
                <tr key={lo.id} className={cn('align-top', rowClass, lo.selected && 'bg-brand-50/40')}>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-500">{lo.rank}</td>
                  <td className="max-w-[20rem] px-4 py-3">
                    <p
                      className={cn(
                        'line-clamp-2 text-[13px]',
                        lo.selected ? 'font-medium text-stone-900' : 'text-stone-600',
                      )}
                    >
                      {lo.title || 'Untitled objective'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
                      <code className="font-mono text-stone-600">{lo.identifier}</code>
                      <IdChip value={lo.id} label="ID" />
                    </div>
                    {lo.notes && <p className="mt-1 text-xs text-stone-500">{lo.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <StrategyPill value={lo.strategy} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-stone-700">
                    {lo.accuracy == null ? '—' : `${(lo.accuracy * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {lo.attempts_count == null ? '—' : formatNumber(lo.attempts_count)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    <TimeAgo iso={lo.last_seen_at} />
                  </td>
                  <td className="px-4 py-3">
                    {lo.scope_match_reason ? (
                      <code className="font-mono text-xs text-stone-600">{lo.scope_match_reason}</code>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusDot tone={lo.selected ? 'green' : 'neutral'}>
                      {lo.selected ? 'Selected' : 'Not selected'}
                    </StatusDot>
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

// ---------- Generation by objective ----------

const LOs: React.FC<{
  data: GetSessionAuditResponse;
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
}> = ({ data, onOpenItem, onOpenLo }) => {
  // Small sessions start expanded; larger ones only open objectives with failed runs.
  const initiallyOpen = (lo: SessionLO) => data.los.length <= 3 || lo.runs.some(isFailedRun);
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(data.los.filter(initiallyOpen).map((lo) => lo.id)),
  );
  const allOpen = data.los.length > 0 && openIds.size === data.los.length;

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (data.los.length === 0) {
    return (
      <Section title="Generation by objective">
        <EmptyBlock
          title="No objectives produced generation rows"
          hint="The selection may have been empty, or all runs failed before persistence."
        />
      </Section>
    );
  }

  return (
    <Section
      title="Generation by objective"
      subtitle="Runs, the chunks they used and the items they produced, per objective"
      right={
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setOpenIds(allOpen ? new Set() : new Set(data.los.map((lo) => lo.id)))
          }
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      }
      dense
    >
      <ul className="divide-y divide-stone-100">
        {data.los.map((lo) => (
          <LOBlock
            key={lo.id}
            lo={lo}
            open={openIds.has(lo.id)}
            onToggle={() => toggle(lo.id)}
            onOpenItem={onOpenItem}
            onOpenLo={onOpenLo}
          />
        ))}
      </ul>
    </Section>
  );
};

const LOBlock: React.FC<{
  lo: SessionLO;
  open: boolean;
  onToggle: () => void;
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
}> = ({ lo, open, onToggle, onOpenItem, onOpenLo }) => {
  const failedRuns = lo.runs.filter(isFailedRun).length;
  const regionId = `session-lo-${lo.id}`;
  return (
    <li>
      <div className="flex items-start gap-2 px-3 py-3 sm:px-4">
        <IconButton
          icon={open ? ChevronDown : ChevronRight}
          label={open ? 'Collapse objective' : 'Expand objective'}
          size="sm"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={onToggle}
        />
        <div className="min-w-0 flex-1">
          {/* Mouse shortcut for the chevron; keyboard users toggle via the chevron. */}
          <button
            type="button"
            tabIndex={-1}
            onClick={onToggle}
            className="block rounded text-left"
          >
            <span className="line-clamp-2 text-sm font-medium text-stone-900">
              {lo.title || 'Untitled objective'}
            </span>
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
            <code className="font-mono text-stone-600">{lo.identifier}</code>
            <IdChip value={lo.id} label="ID" />
            <TenantTag tenantId={lo.tenant_id} />
            <span className="tabular-nums">
              {plural(lo.runs.length, 'run')} · {plural(lo.items.length, 'item')} ·{' '}
              {plural(lo.chunks_used.length, 'chunk')}
            </span>
            {failedRuns > 0 && <StatusDot tone="red">{formatNumber(failedRuns)} failed</StatusDot>}
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
      {open && (
        <div
          id={regionId}
          className="space-y-5 border-t border-stone-100 bg-stone-50/60 py-4 pl-6 pr-4 sm:pl-12"
        >
          <div>
            <SubHeading icon={Sparkles}>Runs ({formatNumber(lo.runs.length)})</SubHeading>
            {lo.runs.length === 0 ? (
              <p className="text-[13px] text-stone-500">No runs recorded for this objective.</p>
            ) : (
              <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
                {lo.runs.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </ul>
            )}
          </div>
          {lo.chunks_used.length > 0 && (
            <div>
              <SubHeading icon={Layers}>
                Chunks used ({formatNumber(lo.chunks_used.length)})
              </SubHeading>
              <ChunkList chunks={lo.chunks_used.map(toChunkView)} />
            </div>
          )}
          {lo.items.length > 0 && (
            <div>
              <SubHeading icon={BookOpen}>Items ({formatNumber(lo.items.length)})</SubHeading>
              <ItemList items={lo.items} onOpenItem={onOpenItem} />
            </div>
          )}
        </div>
      )}
    </li>
  );
};

const RunRow: React.FC<{ run: SessionRun }> = ({ run }) => {
  const [open, setOpen] = useState(isFailedRun(run));
  const shortfall = run.items_requested > 0 && run.items_persisted < run.items_requested;
  const detailsId = `session-run-${run.id}`;
  return (
    <li>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <IconButton
          icon={open ? ChevronDown : ChevronRight}
          label={open ? 'Hide run details' : 'Show run details'}
          size="sm"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        />
        <div className="min-w-0 flex-1">
          <RunHeadline run={run} extra={<ChunkSourcePill value={run.chunk_source} />} />
          <p className="mt-1 text-xs tabular-nums text-stone-500">
            {formatNumber(run.items_requested)} requested · {formatNumber(run.items_returned)}{' '}
            returned ·{' '}
            <span className={cn(shortfall && 'font-medium text-amber-700')}>
              {formatNumber(run.items_persisted)} persisted
            </span>{' '}
            · {formatDurationMs(runDurationMs(run))}
            {run.error_code && (
              <>
                {' · '}
                <code className="font-mono text-red-700">{run.error_code}</code>
              </>
            )}
          </p>
        </div>
      </div>
      {open && (
        <div id={detailsId} className="space-y-4 border-t border-stone-100 px-4 py-4 sm:pl-12">
          <RunError run={run} />
          <RunFacts run={run} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <SubHeading
                right={
                  run.chunk_ids.length > 0 ? (
                    <CopyButton text={run.chunk_ids.join('\n')} label="Copy all chunk IDs" />
                  ) : undefined
                }
              >
                Chunk IDs ({formatNumber(run.chunk_ids.length)})
              </SubHeading>
              {run.chunk_ids.length === 0 ? (
                <p className="text-[13px] text-stone-400">None</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {run.chunk_ids.map((cid, i) => (
                    <li
                      key={cid}
                      title={cid}
                      className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700 ring-1 ring-inset ring-stone-200/70"
                    >
                      <span className="text-stone-400">#{i}</span>
                      {cid.slice(0, 8)}…
                      {run.chunk_similarity_scores[i] != null && (
                        <span className="text-brand-800" title="Similarity score">
                          {run.chunk_similarity_scores[i].toFixed(3)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="min-w-0">
              <SubHeading>Rejection reasons ({formatNumber(run.rejection_reasons.length)})</SubHeading>
              {run.rejection_reasons.length === 0 ? (
                <p className="text-[13px] text-stone-400">None</p>
              ) : (
                <ul className="divide-y divide-red-100 overflow-hidden rounded-lg border border-red-200 bg-red-50/60">
                  {run.rejection_reasons.map((rr) => (
                    <li key={`${rr.index}-${rr.reason}`} className="px-3 py-2 text-[13px] text-red-800">
                      <p>
                        <span className="tabular-nums text-red-600">#{rr.index}</span>{' '}
                        <code className="font-mono">{rr.reason}</code>
                      </p>
                      {rr.message && (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5">
                          {rr.message}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
};

// ---------- Score form ----------

type TargetType = 'session' | 'lo' | 'item';

const TARGET_OPTIONS: Array<{ value: TargetType; label: string }> = [
  { value: 'session', label: 'Session' },
  { value: 'lo', label: 'Objective' },
  { value: 'item', label: 'Item' },
];

const ScoreForm: React.FC<{
  sessionIdentifier: string;
  data: GetSessionAuditResponse;
}> = ({ sessionIdentifier, data }) => {
  const [value, setValue] = useState<'good' | 'bad'>('good');
  const [targetType, setTargetType] = useState<TargetType>('session');
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

  const targetNoun = targetType === 'lo' ? 'objective' : 'item';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitOk(null);
    if (targetType !== 'session' && !targetId) {
      setSubmitError(`Pick an ${targetNoun} first.`);
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
      const resp = await studyPlanAuditService.recordSessionScore(sessionIdentifier, payload);
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
      subtitle="Records a good or bad score to audit_scores and Langfuse"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-stone-700">Rating</p>
            <SegmentedControl
              label="Rating"
              value={value}
              onChange={setValue}
              options={[
                { value: 'good', label: 'Good' },
                { value: 'bad', label: 'Bad' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-stone-700">Applies to</p>
            <SegmentedControl
              label="Applies to"
              value={targetType}
              onChange={setTargetType}
              options={TARGET_OPTIONS}
            />
          </div>
        </div>

        {targetType !== 'session' && (
          <Field label={targetType === 'lo' ? 'Objective' : 'Item'}>
            {(id) => (
              <Select id={id} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Pick an {targetNoun} from this session…</option>
                {(targetType === 'lo' ? loOptions : itemOptions).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Score name" hint="Optional" description="Defaults to doctor_quality.">
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="doctor_quality"
              />
            )}
          </Field>
          <Field label="Comment" hint="Optional">
            {(id) => (
              <Input
                id={id}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What's right or wrong with it?"
              />
            )}
          </Field>
        </div>

        {submitError && (
          <InlineAlert tone="error" onDismiss={() => setSubmitError(null)}>
            {submitError}
          </InlineAlert>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {submitOk && (
            <p role="status" className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-brand-700">
              <CheckCircle2 size={15} aria-hidden="true" />
              {submitOk}
            </p>
          )}
          <Button type="submit" variant="primary" icon={Send} loading={submitting}>
            Record score
          </Button>
        </div>
      </form>

      <details className="group mt-5 border-t border-stone-100 pt-4">
        <summary className="inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none items-center gap-1.5 rounded text-[13px] font-medium text-stone-600 hover:text-stone-900">
          <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden="true" />
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
