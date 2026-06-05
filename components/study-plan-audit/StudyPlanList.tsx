import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type { StudyPlanListEntry } from '@/types/StudyPlanAuditTypes';
import {
  EmptyBlock,
  ErrorBlock,
  IdChip,
  LoadingBlock,
  Stat,
  TenantTag,
  TimeAgo,
  formatNumber,
} from './shared';

type SortKey = 'last_audit_at' | 'total_runs' | 'sessions' | 'title';

const StudyPlanList: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlanListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_audit_at');
  const [sortDesc, setSortDesc] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await studyPlanAuditService.listStudyPlans();
      setPlans(resp.study_plans ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load study plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const tenants = new Set<string | null>();
    let runs = 0;
    let sessions = 0;
    let items = 0;
    plans.forEach((p) => {
      tenants.add(p.tenant_id);
      runs += p.total_runs;
      sessions += p.sessions_with_audits;
      items += p.items_with_audits;
    });
    return {
      plans: plans.length,
      tenants: tenants.size,
      runs,
      sessions,
      items,
    };
  }, [plans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? plans.filter((p) =>
          [p.title, p.identifier, p.exam_name, p.id, p.tenant_id ?? '']
            .map((v) => v.toLowerCase())
            .some((v) => v.includes(q)),
        )
      : plans;
    const sorted = [...base].sort((a, b) => {
      const dir = sortDesc ? -1 : 1;
      switch (sortKey) {
        case 'title':
          return dir * a.title.localeCompare(b.title);
        case 'total_runs':
          return dir * (a.total_runs - b.total_runs);
        case 'sessions':
          return dir * (a.sessions_with_audits - b.sessions_with_audits);
        case 'last_audit_at':
        default: {
          const aT = a.last_audit_at
            ? new Date(a.last_audit_at).getTime()
            : 0;
          const bT = b.last_audit_at
            ? new Date(b.last_audit_at).getTime()
            : 0;
          return dir * (aT - bT);
        }
      }
    });
    return sorted;
  }, [plans, query, sortKey, sortDesc]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((v) => !v);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck size={12} />
            Superadmin · cross-tenant
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Audited study plans
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Forensic registry of every study plan with an AI generation
            footprint. Pick a plan to inspect uploads, learning objectives,
            generated items, and session runs.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Study plans" value={formatNumber(totals.plans)} />
        <Stat label="Tenants" value={formatNumber(totals.tenants)} />
        <Stat label="Generation runs" value={formatNumber(totals.runs)} />
        <Stat label="Sessions audited" value={formatNumber(totals.sessions)} />
        <Stat label="Items audited" value={formatNumber(totals.items)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, identifier, exam, tenant, or ID…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="font-mono">
              {filtered.length} / {plans.length}
            </span>
            <span>plans shown</span>
          </div>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock error={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            title="No audited study plans"
            hint={
              plans.length === 0
                ? 'No plan has produced AI generation runs or session audits yet.'
                : 'Your filter did not match any plan.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white">
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <SortableTh
                    label="Study plan"
                    active={sortKey === 'title'}
                    desc={sortDesc}
                    onClick={() => setSort('title')}
                  />
                  <th className="px-4 py-2 font-black">Tenant</th>
                  <SortableTh
                    label="Runs"
                    active={sortKey === 'total_runs'}
                    desc={sortDesc}
                    onClick={() => setSort('total_runs')}
                    align="right"
                  />
                  <th className="px-4 py-2 text-right font-black">Uploads</th>
                  <th className="px-4 py-2 text-right font-black">LOs</th>
                  <th className="px-4 py-2 text-right font-black">Items</th>
                  <SortableTh
                    label="Sessions"
                    active={sortKey === 'sessions'}
                    desc={sortDesc}
                    onClick={() => setSort('sessions')}
                    align="right"
                  />
                  <SortableTh
                    label="Last audit"
                    active={sortKey === 'last_audit_at'}
                    desc={sortDesc}
                    onClick={() => setSort('last_audit_at')}
                  />
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() =>
                      navigate(
                        `/study-plan-audit/${encodeURIComponent(p.id)}`,
                      )
                    }
                    className="group cursor-pointer transition hover:bg-emerald-50/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 group-hover:text-emerald-700">
                          {p.title || '(untitled)'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10.5px] text-slate-500">
                            {p.identifier}
                          </span>
                          <span className="text-[10px] text-slate-300">·</span>
                          <span className="font-mono text-[10.5px] text-slate-500">
                            {p.exam_name}
                          </span>
                          <IdChip value={p.id} label="id" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TenantTag tenantId={p.tenant_id} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(p.total_runs)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(p.uploads_with_audits)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(p.learning_objectives_with_audits)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(p.items_with_audits)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(p.sessions_with_audits)}
                    </td>
                    <td className="px-4 py-3">
                      <TimeAgo iso={p.last_audit_at} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <ChevronRight
                        size={16}
                        className="text-slate-300 transition group-hover:text-emerald-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const SortableTh: React.FC<{
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
}> = ({ label, active, desc, onClick, align = 'left' }) => (
  <th
    className={`cursor-pointer px-4 py-2 font-black hover:text-slate-700 ${
      align === 'right' ? 'text-right' : ''
    }`}
    onClick={onClick}
  >
    <span
      className={`inline-flex items-center gap-1 ${active ? 'text-emerald-700' : ''}`}
    >
      {label}
      <ArrowUpDown
        size={10}
        className={`transition ${active ? 'opacity-100' : 'opacity-30'} ${
          active && !desc ? 'rotate-180' : ''
        }`}
      />
    </span>
  </th>
);

export default StudyPlanList;
