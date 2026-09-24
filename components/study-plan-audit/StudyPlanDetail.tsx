import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
  GitBranch,
  ListChecks,
  Microscope,
  PlayCircle,
  RefreshCw,
  SearchX,
  type LucideIcon,
} from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetStudyPlanAuditResponse,
  StudyPlanAuditStageSummary,
} from '@/types/StudyPlanAuditTypes';
import {
  Button,
  InlineAlert,
  PageHeader,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Spinner,
  cn,
} from '@/components/ui';
import {
  CopyButton,
  EmptyBlock,
  ErrorBlock,
  IdChip,
  KV,
  Stat,
  StatStrip,
  StagePill,
  StatusLabel,
  StatusPill,
  TenantTag,
  TimeAgo,
  formatNumber,
  plural,
  statusTone,
} from './shared';
import {
  NumCell,
  Pagination,
  TableCard,
  paginationProps,
  Th,
  isInteractiveTarget,
  rowClass,
  tableClass,
  theadClass,
  usePagination,
} from './AuditTable';
import { AuditTabs, auditPanelId, auditTabId, type AuditTabDef } from './AuditTabs';
import ItemLineagePanel from './panels/ItemLineagePanel';
import LOLineagePanel from './panels/LOLineagePanel';
import SessionAuditPanel from './panels/SessionAuditPanel';
import UploadAuditPanel from './panels/UploadAuditPanel';

type TabId = 'overview' | 'uploads' | 'los' | 'items' | 'sessions';
type SessionStatusFilter = 'all' | 'succeeded' | 'failed' | 'no_items_generated' | 'started';

const TAB_PREFIX = 'study-plan-audit';
const PAGE_SIZE = 50;

interface RunTotals {
  runs: number;
  ok: number;
  bad: number;
  successRate: number;
  failureRate: number;
}

const summarizeStages = (stages: StudyPlanAuditStageSummary[]): RunTotals => {
  let runs = 0;
  let ok = 0;
  let bad = 0;
  stages.forEach((s) => {
    runs += s.total_runs;
    ok += s.succeeded_runs;
    bad += s.failed_runs;
  });
  return {
    runs,
    ok,
    bad,
    successRate: runs > 0 ? Math.round((ok / runs) * 1000) / 10 : 0,
    failureRate: runs > 0 ? Math.round((bad / runs) * 1000) / 10 : 0,
  };
};

const StudyPlanDetail: React.FC = () => {
  const { studyPlanIdentifier } = useParams<{
    studyPlanIdentifier: string;
  }>();
  const [data, setData] = useState<GetStudyPlanAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [sessionStatus, setSessionStatus] = useState<SessionStatusFilter>('all');

  const [openSessionIdentifier, setOpenSessionIdentifier] = useState<string | null>(null);
  const [openUploadIdentifier, setOpenUploadIdentifier] = useState<string | null>(null);
  const [openItemIdentifier, setOpenItemIdentifier] = useState<string | null>(null);
  const [openLoIdentifier, setOpenLoIdentifier] = useState<string | null>(null);

  const load = async () => {
    if (!studyPlanIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await studyPlanAuditService.getStudyPlanAudit(studyPlanIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load study plan audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyPlanIdentifier]);

  const runTotals = useMemo(() => summarizeStages(data?.stages ?? []), [data]);

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data?.sessions.forEach((s) => {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  const failedUploads = useMemo(
    () => data?.uploads.filter((u) => statusTone(u.status) === 'red').length ?? 0,
    [data],
  );

  const showSessions = (filter: SessionStatusFilter) => {
    setSessionStatus(filter);
    setTab('sessions');
  };

  const refreshButton = (
    <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load}>
      Refresh
    </Button>
  );

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={<AuditBreadcrumb identifier={studyPlanIdentifier ?? ''} />}
          title={loading ? 'Loading study plan…' : 'Study plan unavailable'}
          actions={refreshButton}
        />
        {loading ? (
          <Spinner label="Loading study plan audit…" className="py-24" />
        ) : error ? (
          <ErrorBlock error={error} onRetry={load} />
        ) : (
          <EmptyBlock title="No data" hint="Study plan audit response was empty." />
        )}
      </div>
    );
  }

  const failedSessions = sessionCounts.failed ?? 0;
  const emptySessions = sessionCounts.no_items_generated ?? 0;

  const tabs: AuditTabDef<TabId>[] = [
    {
      id: 'overview',
      label: 'Overview',
      attention: runTotals.bad > 0 ? 'red' : null,
      attentionLabel: 'Some generation runs failed',
    },
    {
      id: 'uploads',
      label: 'Uploads',
      count: data.uploads.length,
      attention: failedUploads > 0 ? 'red' : null,
      attentionLabel: 'Some uploads failed',
    },
    { id: 'los', label: 'Learning objectives', count: data.learning_objectives.length },
    { id: 'items', label: 'Items', count: data.items.length },
    {
      id: 'sessions',
      label: 'Sessions',
      count: data.sessions.length,
      attention: failedSessions > 0 ? 'red' : emptySessions > 0 ? 'amber' : null,
      attentionLabel:
        failedSessions > 0 ? 'Some sessions failed' : 'Some sessions generated no items',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<AuditBreadcrumb identifier={data.study_plan.identifier} />}
        title={data.study_plan.title || 'Untitled study plan'}
        meta={<StatusPill value={data.study_plan.status} size="md" />}
        actions={refreshButton}
      />

      {error && <ErrorBlock error={error} onRetry={load} />}

      <PlanFacts data={data} runs={runTotals} />

      <div>
        <AuditTabs
          tabs={tabs}
          active={tab}
          onSelect={setTab}
          label="Audit sections"
          idPrefix={TAB_PREFIX}
        />
        <div
          role="tabpanel"
          id={auditPanelId(TAB_PREFIX)}
          aria-labelledby={auditTabId(TAB_PREFIX, tab)}
          className="pt-6"
        >
          {tab === 'overview' && (
            <OverviewTab
              data={data}
              runs={runTotals}
              failedSessions={failedSessions}
              emptySessions={emptySessions}
              onPickTab={setTab}
              onShowSessions={showSessions}
            />
          )}
          {tab === 'uploads' && (
            <UploadsTab
              data={data}
              onOpenUpload={(identifier) => setOpenUploadIdentifier(identifier)}
            />
          )}
          {tab === 'los' && (
            <LOsTab data={data} onOpenLo={(identifier) => setOpenLoIdentifier(identifier)} />
          )}
          {tab === 'items' && (
            <ItemsTab
              data={data}
              onOpenItem={(identifier) => setOpenItemIdentifier(identifier)}
              onOpenLo={(identifier) => setOpenLoIdentifier(identifier)}
            />
          )}
          {tab === 'sessions' && (
            <SessionsTab
              data={data}
              counts={sessionCounts}
              statusFilter={sessionStatus}
              onStatusFilterChange={setSessionStatus}
              onOpenSession={(identifier) => setOpenSessionIdentifier(identifier)}
            />
          )}
        </div>
      </div>

      <SessionAuditPanel
        sessionIdentifier={openSessionIdentifier}
        onClose={() => setOpenSessionIdentifier(null)}
        onOpenItem={(identifier) => setOpenItemIdentifier(identifier)}
        onOpenLo={(identifier) => setOpenLoIdentifier(identifier)}
      />
      <UploadAuditPanel
        uploadIdentifier={openUploadIdentifier}
        onClose={() => setOpenUploadIdentifier(null)}
        onOpenLo={(identifier) => setOpenLoIdentifier(identifier)}
      />
      <ItemLineagePanel
        itemIdentifier={openItemIdentifier}
        onClose={() => setOpenItemIdentifier(null)}
        onOpenLo={(identifier) => setOpenLoIdentifier(identifier)}
      />
      <LOLineagePanel
        loIdentifier={openLoIdentifier}
        onClose={() => setOpenLoIdentifier(null)}
        onOpenItem={(identifier) => setOpenItemIdentifier(identifier)}
      />
    </div>
  );
};

// ---------- Header ----------

const AuditBreadcrumb: React.FC<{ identifier: string }> = ({ identifier }) => (
  <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
    <Link
      to="/study-plan-audit"
      className="flex-shrink-0 rounded text-stone-500 transition hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      Study plan audit
    </Link>
    <ChevronRight size={14} className="flex-shrink-0 text-stone-300" aria-hidden="true" />
    <code className="min-w-0 truncate font-mono text-stone-700" aria-current="page" title={identifier}>
      {identifier}
    </code>
    {identifier && <CopyButton text={identifier} label="Copy study plan identifier" />}
  </nav>
);

const Figure: React.FC<{ label: string; value: number; detail?: React.ReactNode }> = ({
  label,
  value,
  detail,
}) => (
  <div className="min-w-0">
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-lg font-semibold tabular-nums text-stone-900">
        {formatNumber(value)}
      </span>
      {detail && <span className="text-xs text-stone-500">{detail}</span>}
    </dd>
  </div>
);

/** Key facts about the plan: who/what/when on top, plan-wide totals below. */
const PlanFacts: React.FC<{ data: GetStudyPlanAuditResponse; runs: RunTotals }> = ({
  data,
  runs,
}) => {
  const plan = data.study_plan;
  return (
    <section
      aria-label="Study plan summary"
      className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
        <KV label="Exam">{plan.exam_name || <span className="text-stone-400">—</span>}</KV>
        <KV label="Tenant">
          {plan.tenant_id ? (
            <code className="break-all font-mono text-[13px] text-stone-800">{plan.tenant_id}</code>
          ) : (
            <span className="text-stone-400">No tenant</span>
          )}
        </KV>
        <KV label="Plan ID">
          <IdChip value={data.study_plan_id} truncate={13} />
        </KV>
        <KV label="Created">
          <TimeAgo iso={plan.created_at} />
        </KV>
        <KV label="Updated">
          <TimeAgo iso={plan.updated_at} />
        </KV>
      </dl>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-stone-100 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
        <Figure label="Uploads" value={data.totals.uploads} />
        <Figure label="Learning objectives" value={data.totals.learning_objectives} />
        <Figure label="Items" value={data.totals.items} />
        <Figure label="Sessions" value={data.totals.sessions} />
        <Figure
          label="Generation runs"
          value={runs.runs}
          detail={
            runs.bad > 0 ? (
              <span className="font-medium text-red-700">{formatNumber(runs.bad)} failed</span>
            ) : runs.runs > 0 ? (
              `${runs.successRate}% succeeded`
            ) : undefined
          }
        />
      </dl>
    </section>
  );
};

// ---------- Overview ----------

const OverviewTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  runs: RunTotals;
  failedSessions: number;
  emptySessions: number;
  onPickTab: (t: TabId) => void;
  onShowSessions: (filter: SessionStatusFilter) => void;
}> = ({ data, runs, failedSessions, emptySessions, onPickTab, onShowSessions }) => {
  const sorted = useMemo(
    () => [...data.stages].sort((a, b) => b.total_runs - a.total_runs),
    [data.stages],
  );
  const worstStage = useMemo(
    () =>
      [...data.stages]
        .filter((s) => s.failed_runs > 0)
        .sort((a, b) => b.failed_runs - a.failed_runs)[0],
    [data.stages],
  );
  const hasProblems = failedSessions > 0 || emptySessions > 0 || runs.bad > 0;

  return (
    <div className="space-y-8">
      {hasProblems && (
        <div className="space-y-2">
          {failedSessions > 0 && (
            <InlineAlert
              tone="error"
              title={`${plural(failedSessions, 'session')} failed`}
              action={
                <Button size="sm" variant="secondary" onClick={() => onShowSessions('failed')}>
                  Show failed sessions
                </Button>
              }
            >
              Open a session to see its error and the generation runs behind it.
            </InlineAlert>
          )}
          {emptySessions > 0 && (
            <InlineAlert
              tone="warning"
              title={`${plural(emptySessions, 'session')} generated no items`}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onShowSessions('no_items_generated')}
                >
                  Show sessions
                </Button>
              }
            >
              Usually an empty objective selection, or every run failed before items were
              persisted.
            </InlineAlert>
          )}
          {runs.bad > 0 && (
            <InlineAlert
              tone="warning"
              title={`${formatNumber(runs.bad)} of ${plural(runs.runs, 'generation run')} failed`}
            >
              {worstStage ? (
                <>
                  Most failures are in the <code className="font-mono">{worstStage.stage}</code>{' '}
                  stage ({formatNumber(worstStage.failed_runs)}). See the breakdown below.
                </>
              ) : (
                'See the breakdown by stage below.'
              )}
            </InlineAlert>
          )}
        </div>
      )}

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <Stat label="Generation runs" value={formatNumber(runs.runs)} />
        <Stat
          label="Succeeded"
          value={formatNumber(runs.ok)}
          tone={runs.ok > 0 ? 'success' : 'default'}
          hint={`${runs.successRate}% of runs`}
        />
        <Stat
          label="Failed"
          value={formatNumber(runs.bad)}
          tone={runs.bad > 0 ? 'danger' : 'default'}
          hint={`${runs.failureRate}% of runs`}
        />
        <Stat
          label="Audit footprint"
          value={plural(data.stages.length, 'stage')}
          hint="Grouped by tenant and stage"
        />
      </StatStrip>

      <section className="space-y-3">
        <SectionHeader
          title="Outcomes by stage"
          description="Success and failure for every audited stage and tenant, busiest first."
        />
        <TableCard>
          {sorted.length === 0 ? (
            <EmptyBlock
              title="No stage activity"
              hint="No generation_runs rows exist for this plan."
            />
          ) : (
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <Th>Stage</Th>
                  <Th>Tenant</Th>
                  <Th align="right">Runs</Th>
                  <Th align="right">Succeeded</Th>
                  <Th align="right">Failed</Th>
                  <Th>Success rate</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <StageRow key={`${s.tenant_id ?? 'na'}-${s.stage}-${i}`} row={s} />
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Trace the lineage"
          description="Uploads are chunked to ground learning objectives, objectives generate items, and sessions select objectives to generate more."
        />
        <div className="grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          <LineageStepCard
            icon={FileText}
            title="Uploads"
            figure={data.uploads.length}
            detail={`audited · ${formatNumber(data.totals.uploads)} in this plan`}
            actionLabel="Inspect uploads"
            onClick={() => onPickTab('uploads')}
          />
          <LineageStepCard
            icon={ListChecks}
            title="Learning objectives"
            figure={data.learning_objectives.length}
            detail={`with lineage · ${formatNumber(data.totals.learning_objectives)} in this plan`}
            actionLabel="Inspect objectives"
            onClick={() => onPickTab('los')}
          />
          <LineageStepCard
            icon={BookOpen}
            title="Items"
            figure={data.items.length}
            detail={`with audit runs · ${formatNumber(data.totals.items)} in this plan`}
            actionLabel="Inspect items"
            onClick={() => onPickTab('items')}
          />
          <LineageStepCard
            icon={PlayCircle}
            title="Sessions"
            figure={data.sessions.length}
            detail={`with generation audits · ${formatNumber(data.totals.sessions)} in this plan`}
            actionLabel="Inspect sessions"
            onClick={() => onPickTab('sessions')}
          />
        </div>
      </section>
    </div>
  );
};

const StageRow: React.FC<{ row: StudyPlanAuditStageSummary }> = ({ row }) => (
  <tr className={rowClass}>
    <td className="px-4 py-3">
      <StagePill value={row.stage} />
    </td>
    <td className="px-4 py-3">
      <TenantTag tenantId={row.tenant_id} />
    </td>
    <NumCell value={row.total_runs} />
    <NumCell value={row.succeeded_runs} />
    <NumCell value={row.failed_runs} tone="red" />
    <td className="px-4 py-3">
      <RateBar succeeded={row.success_rate} failed={row.failure_rate} />
    </td>
  </tr>
);

const RateBar: React.FC<{ succeeded: number; failed: number }> = ({ succeeded, failed }) => {
  const ok = Math.max(0, Math.min(100, succeeded));
  const bad = Math.max(0, Math.min(100 - ok, failed));
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-1.5 w-28 overflow-hidden rounded-full bg-stone-200/80"
        role="img"
        aria-label={`${ok.toFixed(1)}% succeeded, ${bad.toFixed(1)}% failed`}
      >
        <div className="h-full bg-brand-500" style={{ width: `${ok}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${bad}%` }} />
      </div>
      <span className="tabular-nums text-stone-600">{ok.toFixed(1)}%</span>
    </div>
  );
};

const LineageStepCard: React.FC<{
  icon: LucideIcon;
  title: string;
  figure: number;
  detail: string;
  actionLabel: string;
  onClick: () => void;
}> = ({ icon: Icon, title, figure, detail, actionLabel, onClick }) => (
  <div className="flex flex-col bg-white p-5">
    <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
      <Icon size={16} className="text-stone-400" aria-hidden="true" />
      {title}
    </div>
    <div className="mt-4 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-stone-900">
      {formatNumber(figure)}
    </div>
    <div className="mt-2 text-[13px] text-stone-500">{detail}</div>
    <button
      type="button"
      onClick={onClick}
      className="group mt-5 inline-flex w-fit items-center gap-1.5 rounded text-sm font-medium text-stone-700 transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {actionLabel}
      <ArrowRight size={15} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  </div>
);

// ---------- Shared tab chrome ----------

const TabToolbar: React.FC<{ children: React.ReactNode; description: React.ReactNode }> = ({
  children,
  description,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
    <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    <p className="text-[13px] text-stone-500">{description}</p>
  </div>
);

const NoMatches: React.FC<{ query: string; noun: string; emptyTitle: string }> = ({
  query,
  noun,
  emptyTitle,
}) =>
  query.trim() ? (
    <EmptyBlock
      icon={<SearchX size={17} />}
      title={`No ${noun} match “${query.trim()}”`}
      hint="Search matches titles, identifiers and IDs."
    />
  ) : (
    <EmptyBlock title={emptyTitle} />
  );

const inspectCell = (label: string, icon: LucideIcon, onClick: () => void, ariaLabel: string) => (
  <td className="whitespace-nowrap px-3 py-3 text-right">
    <Button size="sm" variant="ghost" icon={icon} onClick={onClick} aria-label={ariaLabel}>
      {label}
    </Button>
  </td>
);

// ---------- Uploads tab ----------

const UploadsTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  onOpenUpload: (identifier: string) => void;
}> = ({ data, onOpenUpload }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.uploads;
    return data.uploads.filter((u) =>
      [u.file_name, u.identifier, u.id, u.status, u.tenant_id ?? '']
        .map((v) => (v ?? '').toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [data.uploads, q]);
  const pagination = usePagination(filtered, PAGE_SIZE, q);

  return (
    <div className="space-y-3">
      <TabToolbar description="Driven by upload-linked generation runs.">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search uploads"
          className="w-full sm:w-72"
        />
      </TabToolbar>
      <TableCard
        footer={
          <Pagination {...paginationProps(pagination)} noun="upload" />
        }
      >
        {filtered.length === 0 ? (
          <NoMatches query={q} noun="uploads" emptyTitle="No uploads with an audit footprint" />
        ) : (
          <table className={cn(tableClass, 'min-w-[860px]')}>
            <thead className={theadClass}>
              <tr>
                <Th>File</Th>
                <Th>Status</Th>
                <Th align="right">Chunks</Th>
                <Th align="right">Objectives</Th>
                <Th align="right">Audit runs</Th>
                <Th>Last audit</Th>
                <Th className="w-10">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((u) => (
                <tr
                  key={u.id}
                  onClick={(event) => {
                    if (isInteractiveTarget(event)) return;
                    onOpenUpload(u.identifier);
                  }}
                  className={cn('cursor-pointer', rowClass)}
                >
                  <td className="max-w-[26rem] px-4 py-3">
                    <p
                      className="truncate text-sm font-medium text-stone-900"
                      title={u.file_name}
                    >
                      {u.file_name || 'Unnamed file'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
                      <code className="font-mono text-stone-600">{u.identifier}</code>
                      <IdChip value={u.id} label="ID" />
                      <TenantTag tenantId={u.tenant_id} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusLabel value={u.status} />
                  </td>
                  <NumCell value={u.chunk_count} />
                  <NumCell value={u.learning_objectives_count} />
                  <NumCell value={u.audit_runs} />
                  <td className="px-4 py-3 text-stone-600">
                    <TimeAgo iso={u.last_audit_at} />
                  </td>
                  {inspectCell(
                    'Inspect',
                    Microscope,
                    () => onOpenUpload(u.identifier),
                    `Inspect upload ${u.file_name || u.identifier}`,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
};

// ---------- LOs tab ----------

const LOsTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  onOpenLo: (identifier: string) => void;
}> = ({ data, onOpenLo }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.learning_objectives;
    return data.learning_objectives.filter((lo) =>
      [lo.title, lo.identifier, lo.id, lo.tenant_id ?? '']
        .map((v) => (v ?? '').toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [data.learning_objectives, q]);
  const pagination = usePagination(filtered, PAGE_SIZE, q);

  return (
    <div className="space-y-3">
      <TabToolbar description="Objective activity across lineage and session selections.">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search objectives"
          className="w-full sm:w-72"
        />
      </TabToolbar>
      <TableCard
        footer={
          <Pagination {...paginationProps(pagination)} noun="objective" />
        }
      >
        {filtered.length === 0 ? (
          <NoMatches
            query={q}
            noun="objectives"
            emptyTitle="No learning objectives with audit activity"
          />
        ) : (
          <table className={cn(tableClass, 'min-w-[900px]')}>
            <thead className={theadClass}>
              <tr>
                <Th>Objective</Th>
                <Th align="right">Uploads</Th>
                <Th align="right">Chunks</Th>
                <Th align="right">Items</Th>
                <Th align="right">Sessions</Th>
                <Th>Last audit</Th>
                <Th className="w-10">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((lo) => (
                <tr
                  key={lo.id}
                  onClick={(event) => {
                    if (isInteractiveTarget(event)) return;
                    onOpenLo(lo.identifier);
                  }}
                  className={cn('cursor-pointer', rowClass)}
                >
                  <td className="max-w-[32rem] px-4 py-3">
                    <p className="line-clamp-2 text-sm font-medium text-stone-900">
                      {lo.title || 'Untitled objective'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
                      <code className="font-mono text-stone-600">{lo.identifier}</code>
                      <IdChip value={lo.id} label="ID" />
                      <TenantTag tenantId={lo.tenant_id} />
                    </div>
                  </td>
                  <NumCell value={lo.source_upload_count} />
                  <NumCell value={lo.source_chunk_count} />
                  <NumCell value={lo.item_count} />
                  <NumCell value={lo.session_count} />
                  <td className="px-4 py-3 text-stone-600">
                    <TimeAgo iso={lo.last_audit_at} />
                  </td>
                  {inspectCell(
                    'Lineage',
                    GitBranch,
                    () => onOpenLo(lo.identifier),
                    `Open lineage for objective ${lo.identifier}`,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
};

// ---------- Items tab ----------

const ItemsTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  onOpenItem: (identifier: string) => void;
  onOpenLo: (identifier: string) => void;
}> = ({ data, onOpenItem, onOpenLo }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.items;
    return data.items.filter((it) =>
      [
        it.identifier,
        it.id,
        it.type,
        it.stem_or_question_or_front,
        it.learning_objective_title,
        it.learning_objective_identifier,
      ]
        .map((v) => (v ?? '').toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [data.items, q]);
  const pagination = usePagination(filtered, PAGE_SIZE, q);

  return (
    <div className="space-y-3">
      <TabToolbar description="Objective → item lineage within this study plan.">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search items or objectives"
          className="w-full sm:w-72"
        />
      </TabToolbar>
      <TableCard
        footer={<Pagination {...paginationProps(pagination)} noun="item" />}
      >
        {filtered.length === 0 ? (
          <NoMatches query={q} noun="items" emptyTitle="No items with audit runs" />
        ) : (
          <table className={cn(tableClass, 'min-w-[960px]')}>
            <thead className={theadClass}>
              <tr>
                <Th>Item</Th>
                <Th>Type</Th>
                <Th>Learning objective</Th>
                <Th align="right">Runs</Th>
                <Th>Last audit</Th>
                <Th className="w-10">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((it) => (
                <tr
                  key={it.id}
                  onClick={(event) => {
                    if (isInteractiveTarget(event)) return;
                    onOpenItem(it.identifier);
                  }}
                  className={cn('cursor-pointer align-top', rowClass)}
                >
                  <td className="max-w-[30rem] px-4 py-3">
                    <p className="line-clamp-2 text-[13px] leading-5 text-stone-800">
                      {it.stem_or_question_or_front || (
                        <span className="text-stone-400">No stem</span>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
                      <code className="font-mono text-stone-600">{it.identifier}</code>
                      <IdChip value={it.id} label="ID" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StagePill value={it.type || '—'} />
                  </td>
                  <td className="px-4 py-3">
                    {it.learning_objective_id ? (
                      <button
                        type="button"
                        onClick={() => onOpenLo(it.learning_objective_identifier)}
                        className="group/lo block max-w-[18rem] rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        title="Open objective lineage"
                      >
                        <span className="line-clamp-2 text-[13px] text-stone-700 group-hover/lo:text-stone-950 group-hover/lo:underline">
                          {it.learning_objective_title || 'Untitled objective'}
                        </span>
                        <code className="font-mono text-xs text-stone-500">
                          {it.learning_objective_identifier}
                        </code>
                      </button>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <NumCell value={it.audit_runs} />
                  <td className="px-4 py-3 text-stone-600">
                    <TimeAgo iso={it.last_audit_at} />
                  </td>
                  {inspectCell(
                    'Lineage',
                    GitBranch,
                    () => onOpenItem(it.identifier),
                    `Open lineage for item ${it.identifier}`,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
};

// ---------- Sessions tab ----------

const SESSION_FILTERS: Array<{ value: SessionStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'no_items_generated', label: 'No items' },
  { value: 'started', label: 'Started' },
];

const SessionsTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  counts: Record<string, number>;
  statusFilter: SessionStatusFilter;
  onStatusFilterChange: (filter: SessionStatusFilter) => void;
  onOpenSession: (identifier: string) => void;
}> = ({ data, counts, statusFilter, onStatusFilterChange, onOpenSession }) => {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = data.sessions;
    if (statusFilter !== 'all') {
      base = base.filter((sess) => sess.status === statusFilter);
    }
    if (s) {
      base = base.filter((sess) =>
        [
          sess.identifier,
          sess.id,
          sess.mode,
          sess.status,
          sess.error_code ?? '',
          sess.error_message ?? '',
        ]
          .map((v) => (v ?? '').toLowerCase())
          .some((v) => v.includes(s)),
      );
    }
    return base;
  }, [data.sessions, q, statusFilter]);
  const pagination = usePagination(filtered, PAGE_SIZE, `${q}|${statusFilter}`);

  return (
    <div className="space-y-3">
      <TabToolbar description="Driven by session generation audits.">
        <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <SegmentedControl
            label="Filter sessions by status"
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={SESSION_FILTERS.map((filter) => ({
              ...filter,
              count: filter.value === 'all' ? data.sessions.length : (counts[filter.value] ?? 0),
            }))}
          />
        </div>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search sessions or errors"
          className="w-full sm:w-64"
        />
      </TabToolbar>
      <TableCard
        footer={
          <Pagination {...paginationProps(pagination)} noun="session" />
        }
      >
        {filtered.length === 0 ? (
          q.trim() ? (
            <NoMatches query={q} noun="sessions" emptyTitle="" />
          ) : (
            <EmptyBlock
              title={
                statusFilter === 'all'
                  ? 'No sessions with generation audits'
                  : 'No sessions with this status'
              }
            />
          )
        ) : (
          <table className={cn(tableClass, 'min-w-[980px]')}>
            <thead className={theadClass}>
              <tr>
                <Th>Session</Th>
                <Th>Mode</Th>
                <Th align="right">Requested</Th>
                <Th align="right">Generated</Th>
                <Th align="right">Persisted</Th>
                <Th>Status</Th>
                <Th>Started</Th>
                <Th className="w-10">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((sess) => {
                const shortfall =
                  sess.requested_item_count > 0 &&
                  sess.items_persisted < sess.requested_item_count;
                return (
                  <tr
                    key={sess.id}
                    onClick={(event) => {
                      if (isInteractiveTarget(event)) return;
                      onOpenSession(sess.identifier);
                    }}
                    className={cn('cursor-pointer align-top', rowClass)}
                  >
                    <td className="px-4 py-3">
                      <code className="font-mono text-[13px] font-medium text-stone-900">
                        {sess.identifier}
                      </code>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
                        <IdChip value={sess.id} label="ID" />
                        <TenantTag tenantId={sess.tenant_id} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StagePill value={sess.mode} />
                    </td>
                    <NumCell value={sess.requested_item_count} />
                    <NumCell value={sess.items_generated} />
                    <NumCell
                      value={sess.items_persisted}
                      tone={shortfall ? 'amber' : 'default'}
                      title={
                        shortfall
                          ? `${formatNumber(sess.items_persisted)} of ${formatNumber(sess.requested_item_count)} requested items persisted`
                          : undefined
                      }
                    />
                    <td className="max-w-[20rem] px-4 py-3">
                      <StatusLabel value={sess.status} />
                      {sess.error_code && (
                        <code className="mt-1 block font-mono text-xs text-red-700">
                          {sess.error_code}
                        </code>
                      )}
                      {sess.error_message && (
                        <p
                          className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-red-700"
                          title={sess.error_message}
                        >
                          {sess.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <TimeAgo iso={sess.started_at} />
                    </td>
                    {inspectCell(
                      'Inspect',
                      Microscope,
                      () => onOpenSession(sess.identifier),
                      `Inspect session ${sess.identifier}`,
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
};

export default StudyPlanDetail;
