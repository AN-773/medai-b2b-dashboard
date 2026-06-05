import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  FileSearch,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Microscope,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetStudyPlanAuditResponse,
  StudyPlanAuditStageSummary,
} from '@/types/StudyPlanAuditTypes';
import {
  EmptyBlock,
  ErrorBlock,
  IdChip,
  LoadingBlock,
  Section,
  Stat,
  StagePill,
  StatusPill,
  TenantTag,
  TimeAgo,
  formatNumber,
} from './shared';
import ItemLineagePanel from './panels/ItemLineagePanel';
import LOLineagePanel from './panels/LOLineagePanel';
import SessionAuditPanel from './panels/SessionAuditPanel';
import UploadAuditPanel from './panels/UploadAuditPanel';

type TabId = 'overview' | 'uploads' | 'los' | 'items' | 'sessions';

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'uploads', label: 'Uploads', icon: FileText },
  { id: 'los', label: 'Learning objectives', icon: ListChecks },
  { id: 'items', label: 'Items', icon: BookOpen },
  { id: 'sessions', label: 'Sessions', icon: PlayCircle },
];

const StudyPlanDetail: React.FC = () => {
  const { studyPlanIdentifier } = useParams<{
    studyPlanIdentifier: string;
  }>();
  const navigate = useNavigate();
  const [data, setData] = useState<GetStudyPlanAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  const [openSessionIdentifier, setOpenSessionIdentifier] = useState<string | null>(null);
  const [openUploadIdentifier, setOpenUploadIdentifier] = useState<string | null>(null);
  const [openItemIdentifier, setOpenItemIdentifier] = useState<string | null>(
    null,
  );
  const [openLoIdentifier, setOpenLoIdentifier] = useState<string | null>(null);

  const load = async () => {
    if (!studyPlanIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp =
        await studyPlanAuditService.getStudyPlanAudit(studyPlanIdentifier);
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

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={load} />;
  if (!data)
    return (
      <EmptyBlock
        title="No data"
        hint="Study plan audit response was empty."
      />
    );

  return (
    <div className="space-y-5">
      <Header data={data} onBack={() => navigate('/study-plan-audit')} onRefresh={load} />

      <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} />
              {t.label}
              <span
                className={`ml-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {countFor(t.id, data)}
              </span>
            </button>
          );
        })}
      </nav>

      <div>
        {tab === 'overview' && <OverviewTab data={data} onPickTab={setTab} />}
        {tab === 'uploads' && (
          <UploadsTab
            data={data}
            onOpenUpload={(identifier) => setOpenUploadIdentifier(identifier)}
          />
        )}
        {tab === 'los' && (
          <LOsTab
            data={data}
            onOpenLo={(identifier) => setOpenLoIdentifier(identifier)}
          />
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
            onOpenSession={(identifier) =>
              setOpenSessionIdentifier(identifier)
            }
          />
        )}
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

const countFor = (tab: TabId, data: GetStudyPlanAuditResponse) => {
  switch (tab) {
    case 'overview':
      return data.stages.length;
    case 'uploads':
      return data.uploads.length;
    case 'los':
      return data.learning_objectives.length;
    case 'items':
      return data.items.length;
    case 'sessions':
      return data.sessions.length;
  }
};

// ---------- Header ----------

const Header: React.FC<{
  data: GetStudyPlanAuditResponse;
  onBack: () => void;
  onRefresh: () => void;
}> = ({ data, onBack, onRefresh }) => (
  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft size={14} />
        All study plans
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RefreshCw size={14} />
        Refresh
      </button>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="font-mono">{data.study_plan.identifier}</span>
          <span>·</span>
          <span className="font-mono">{data.study_plan.exam_name}</span>
          <TenantTag tenantId={data.study_plan.tenant_id} />
          <StatusPill value={data.study_plan.status} />
        </div>
        <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">
          {data.study_plan.title || '(untitled)'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <IdChip value={data.study_plan_id} label="plan" />
          <span>
            Created <TimeAgo iso={data.study_plan.created_at} />
          </span>
          <span>·</span>
          <span>
            Updated <TimeAgo iso={data.study_plan.updated_at} />
          </span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
        <Stat label="Uploads" value={formatNumber(data.totals.uploads)} />
        <Stat
          label="LOs"
          value={formatNumber(data.totals.learning_objectives)}
        />
        <Stat label="Items" value={formatNumber(data.totals.items)} />
        <Stat label="Sessions" value={formatNumber(data.totals.sessions)} />
      </div>
    </div>
  </div>
);

// ---------- Overview ----------

const OverviewTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  onPickTab: (t: TabId) => void;
}> = ({ data, onPickTab }) => {
  const totals = useMemo(() => {
    let runs = 0;
    let ok = 0;
    let bad = 0;
    data.stages.forEach((s) => {
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
  }, [data]);

  const sorted = useMemo(
    () => [...data.stages].sort((a, b) => b.total_runs - a.total_runs),
    [data.stages],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Generation runs" value={formatNumber(totals.runs)} />
        <Stat
          label="Succeeded"
          value={formatNumber(totals.ok)}
          tone="success"
          hint={`${totals.successRate}% of runs`}
        />
        <Stat
          label="Failed"
          value={formatNumber(totals.bad)}
          tone={totals.bad > 0 ? 'danger' : 'default'}
          hint={`${totals.failureRate}% of runs`}
        />
        <Stat
          label="Audit footprint"
          value={`${data.stages.length} stages`}
          hint="grouped by tenant × stage"
        />
      </div>

      <Section
        title="Per-stage outcomes"
        subtitle="Aggregated success/failure for every audited stage and tenant"
        dense
      >
        {sorted.length === 0 ? (
          <EmptyBlock
            title="No stage activity"
            hint="No generation_runs rows exist for this plan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-2 font-black">Stage</th>
                  <th className="px-4 py-2 font-black">Tenant</th>
                  <th className="px-4 py-2 text-right font-black">Runs</th>
                  <th className="px-4 py-2 text-right font-black">Succeeded</th>
                  <th className="px-4 py-2 text-right font-black">Failed</th>
                  <th className="px-4 py-2 font-black">Success rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((s, i) => (
                  <StageRow key={`${s.tenant_id ?? 'na'}-${s.stage}-${i}`} row={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickPick
          label="Inspect uploads"
          hint={`${data.uploads.length} audited`}
          onClick={() => onPickTab('uploads')}
          icon={FileText}
        />
        <QuickPick
          label="Inspect LOs"
          hint={`${data.learning_objectives.length} with lineage`}
          onClick={() => onPickTab('los')}
          icon={ListChecks}
        />
        <QuickPick
          label="Inspect items"
          hint={`${data.items.length} with audit runs`}
          onClick={() => onPickTab('items')}
          icon={BookOpen}
        />
        <QuickPick
          label="Inspect sessions"
          hint={`${data.sessions.length} with session_generation_audits`}
          onClick={() => onPickTab('sessions')}
          icon={PlayCircle}
        />
      </div>
    </div>
  );
};

const StageRow: React.FC<{ row: StudyPlanAuditStageSummary }> = ({ row }) => (
  <tr>
    <td className="px-4 py-3">
      <StagePill value={row.stage} />
    </td>
    <td className="px-4 py-3">
      <TenantTag tenantId={row.tenant_id} />
    </td>
    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
      {formatNumber(row.total_runs)}
    </td>
    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
      {formatNumber(row.succeeded_runs)}
    </td>
    <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-700">
      {formatNumber(row.failed_runs)}
    </td>
    <td className="px-4 py-3">
      <RateBar succeeded={row.success_rate} failed={row.failure_rate} />
    </td>
  </tr>
);

const RateBar: React.FC<{ succeeded: number; failed: number }> = ({
  succeeded,
  failed,
}) => {
  const ok = Math.max(0, Math.min(100, succeeded));
  const bad = Math.max(0, Math.min(100 - ok, failed));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${ok}%`, display: 'inline-block' }}
        />
        <div
          className="h-full bg-rose-500"
          style={{ width: `${bad}%`, display: 'inline-block' }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-slate-600">
        {ok.toFixed(1)}%
      </span>
    </div>
  );
};

const QuickPick: React.FC<{
  label: string;
  hint: string;
  onClick: () => void;
  icon: React.ElementType;
}> = ({ label, hint, onClick, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
  >
    <div className="rounded-lg bg-slate-900 p-2 text-white">
      <Icon size={16} />
    </div>
    <div>
      <div className="text-sm font-bold text-slate-900">{label}</div>
      <div className="text-[11px] text-slate-500">{hint}</div>
    </div>
  </button>
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
        .map((v) => v.toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [data.uploads, q]);

  return (
    <Section
      title="Uploads with audit footprint"
      subtitle="Driven by upload-linked generation_runs"
      right={
        <TableSearch value={q} onChange={setQ} placeholder="Search uploads…" />
      }
      dense
    >
      {filtered.length === 0 ? (
        <EmptyBlock
          title="No matching uploads"
          icon={<FileSearch size={28} className="opacity-40" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 font-black">File</th>
                <th className="px-4 py-2 font-black">Tenant</th>
                <th className="px-4 py-2 text-right font-black">Chunks</th>
                <th className="px-4 py-2 text-right font-black">LOs</th>
                <th className="px-4 py-2 text-right font-black">Audit runs</th>
                <th className="px-4 py-2 font-black">Last audit</th>
                <th className="px-4 py-2 font-black">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="truncate font-semibold text-slate-800">
                        {u.file_name}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        <span className="font-mono">{u.identifier}</span>
                        <IdChip value={u.id} label="upload" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TenantTag tenantId={u.tenant_id} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(u.chunk_count)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(u.learning_objectives_count)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(u.audit_runs)}
                  </td>
                  <td className="px-4 py-3">
                    <TimeAgo iso={u.last_audit_at} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={u.status} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenUpload(u.identifier)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Microscope size={12} />
                      Inspect
                    </button>
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
        .map((v) => v.toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [data.learning_objectives, q]);

  return (
    <Section
      title="Learning objectives"
      subtitle="LO activity across lineage and session selections"
      right={<TableSearch value={q} onChange={setQ} placeholder="Search LOs…" />}
      dense
    >
      {filtered.length === 0 ? (
        <EmptyBlock title="No matching learning objectives" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 font-black">Objective</th>
                <th className="px-4 py-2 font-black">Tenant</th>
                <th className="px-4 py-2 text-right font-black">Uploads</th>
                <th className="px-4 py-2 text-right font-black">Chunks</th>
                <th className="px-4 py-2 text-right font-black">Items</th>
                <th className="px-4 py-2 text-right font-black">Sessions</th>
                <th className="px-4 py-2 font-black">Last audit</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((lo) => (
                <tr key={lo.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-slate-800">
                        {lo.title || '(untitled LO)'}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        <span className="font-mono">{lo.identifier}</span>
                        <IdChip value={lo.id} label="lo" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TenantTag tenantId={lo.tenant_id} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(lo.source_upload_count)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(lo.source_chunk_count)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(lo.item_count)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(lo.session_count)}
                  </td>
                  <td className="px-4 py-3">
                    <TimeAgo iso={lo.last_audit_at} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenLo(lo.identifier)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <GitBranch size={12} />
                      Lineage
                    </button>
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

  return (
    <Section
      title="Items with audit runs"
      subtitle="LO → item lineage within the study plan"
      right={<TableSearch value={q} onChange={setQ} placeholder="Search items…" />}
      dense
    >
      {filtered.length === 0 ? (
        <EmptyBlock title="No matching items" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 font-black">Item</th>
                <th className="px-4 py-2 font-black">Type</th>
                <th className="px-4 py-2 font-black">Learning objective</th>
                <th className="px-4 py-2 text-right font-black">Runs</th>
                <th className="px-4 py-2 font-black">Last audit</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="line-clamp-2 max-w-md text-sm text-slate-800">
                        {it.stem_or_question_or_front || '(no stem)'}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        <span className="font-mono">{it.identifier}</span>
                        <IdChip value={it.id} label="item" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StagePill value={it.type || '—'} />
                  </td>
                  <td className="px-4 py-3">
                    {it.learning_objective_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenLo(it.learning_objective_identifier)
                        }
                        className="group flex max-w-xs flex-col items-start text-left"
                      >
                        <span className="truncate text-sm text-slate-700 group-hover:text-emerald-700">
                          {it.learning_objective_title || '(untitled LO)'}
                        </span>
                        <span className="font-mono text-[10.5px] text-slate-500">
                          {it.learning_objective_identifier}
                        </span>
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(it.audit_runs)}
                  </td>
                  <td className="px-4 py-3">
                    <TimeAgo iso={it.last_audit_at} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenItem(it.identifier)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <GitBranch size={12} />
                      Lineage
                    </button>
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

// ---------- Sessions tab ----------

const SessionsTab: React.FC<{
  data: GetStudyPlanAuditResponse;
  onOpenSession: (identifier: string) => void;
}> = ({ data, onOpenSession }) => {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = data.sessions;
    if (statusFilter !== 'all') {
      base = base.filter((sess) => sess.status === statusFilter);
    }
    if (s) {
      base = base.filter((sess) =>
        [sess.identifier, sess.id, sess.mode, sess.status, sess.error_code ?? '']
          .map((v) => v.toLowerCase())
          .some((v) => v.includes(s)),
      );
    }
    return base;
  }, [data.sessions, q, statusFilter]);

  return (
    <Section
      title="Sessions with generation audits"
      subtitle="Driven by session_generation_audits"
      right={
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-300 focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="succeeded">succeeded</option>
            <option value="failed">failed</option>
            <option value="no_items_generated">no_items_generated</option>
            <option value="started">started</option>
          </select>
          <TableSearch
            value={q}
            onChange={setQ}
            placeholder="Search sessions…"
          />
        </div>
      }
      dense
    >
      {filtered.length === 0 ? (
        <EmptyBlock title="No matching sessions" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 font-black">Session</th>
                <th className="px-4 py-2 font-black">Mode</th>
                <th className="px-4 py-2 text-right font-black">Requested</th>
                <th className="px-4 py-2 text-right font-black">Generated</th>
                <th className="px-4 py-2 text-right font-black">Persisted</th>
                <th className="px-4 py-2 font-black">Status</th>
                <th className="px-4 py-2 font-black">Started</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((sess) => (
                <tr key={sess.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[11px] text-slate-700">
                        {sess.identifier}
                      </span>
                      <IdChip value={sess.id} label="session" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StagePill value={sess.mode} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(sess.requested_item_count)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(sess.items_generated)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatNumber(sess.items_persisted)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusPill value={sess.status} />
                      {sess.error_code && (
                        <span className="font-mono text-[10px] text-rose-600">
                          {sess.error_code}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TimeAgo iso={sess.started_at} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenSession(sess.identifier)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Microscope size={12} />
                      Inspect
                    </button>
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

// ---------- Inline atoms ----------

const TableSearch: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
  />
);

export default StudyPlanDetail;
