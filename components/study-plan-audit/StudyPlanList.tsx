import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, RefreshCw, SearchX, ShieldCheck } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type { StudyPlanListEntry } from '@/types/StudyPlanAuditTypes';
import {
  Badge,
  Button,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  cn,
} from '@/components/ui';
import {
  EmptyBlock,
  ErrorBlock,
  IdChip,
  Stat,
  StatStrip,
  StatusLabel,
  TenantTag,
  TimeAgo,
  formatNumber,
  humanize,
} from './shared';
import {
  NumCell,
  Pagination,
  SortableTh,
  TableCard,
  Th,
  isInteractiveTarget,
  rowClass,
  tableClass,
  theadClass,
  usePagination,
} from './AuditTable';

type SortKey = 'last_audit_at' | 'total_runs' | 'sessions' | 'title';

const ALL = '__all__';
const NO_TENANT = '__none__';
const PAGE_SIZE = 25;

const planPath = (identifier: string) => `/study-plan-audit/${encodeURIComponent(identifier)}`;

const StudyPlanList: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlanListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
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

  const tenantOptions = useMemo(() => {
    const ids = new Set<string>();
    let hasNone = false;
    plans.forEach((p) => {
      if (p.tenant_id) ids.add(p.tenant_id);
      else hasNone = true;
    });
    return { ids: Array.from(ids).sort((a, b) => a.localeCompare(b)), hasNone };
  }, [plans]);

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(plans.map((p) => p.status).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [plans],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = plans;
    if (tenantFilter !== ALL) {
      base = base.filter((p) =>
        tenantFilter === NO_TENANT ? !p.tenant_id : p.tenant_id === tenantFilter,
      );
    }
    if (statusFilter !== ALL) {
      base = base.filter((p) => p.status === statusFilter);
    }
    if (q) {
      base = base.filter((p) =>
        [p.title, p.identifier, p.exam_name, p.id, p.tenant_id ?? '']
          .map((v) => (v ?? '').toLowerCase())
          .some((v) => v.includes(q)),
      );
    }
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
          const aT = a.last_audit_at ? new Date(a.last_audit_at).getTime() : 0;
          const bT = b.last_audit_at ? new Date(b.last_audit_at).getTime() : 0;
          return dir * (aT - bT);
        }
      }
    });
    return sorted;
  }, [plans, query, tenantFilter, statusFilter, sortKey, sortDesc]);

  const pagination = usePagination(
    filtered,
    PAGE_SIZE,
    `${query}|${tenantFilter}|${statusFilter}|${sortKey}|${sortDesc}`,
  );

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((v) => !v);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const isFiltered = Boolean(query.trim()) || tenantFilter !== ALL || statusFilter !== ALL;
  const clearFilters = () => {
    setQuery('');
    setTenantFilter(ALL);
    setStatusFilter(ALL);
  };
  const firstLoad = loading && plans.length === 0;
  const figure = (value: number) => (firstLoad ? '—' : formatNumber(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study plan audit"
        meta={
          <Badge icon={ShieldCheck} title="Superadmin only · data from every tenant">
            All tenants
          </Badge>
        }
        description="Every study plan with an AI generation footprint. Open a plan to trace its uploads, learning objectives, generated items and session runs."
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load}>
            Refresh
          </Button>
        }
      />

      <StatStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Study plans" value={figure(totals.plans)} />
        <Stat label="Tenants" value={figure(totals.tenants)} />
        <Stat label="Generation runs" value={figure(totals.runs)} />
        <Stat label="Sessions audited" value={figure(totals.sessions)} />
        <Stat label="Items audited" value={figure(totals.items)} />
      </StatStrip>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search title, identifier, exam, tenant or ID"
            aria-label="Search study plans"
            className="w-full sm:w-80"
          />
          <div className="w-[calc(50%-0.25rem)] sm:w-48">
            <Select
              aria-label="Filter by tenant"
              value={tenantFilter}
              onChange={(event) => setTenantFilter(event.target.value)}
            >
              <option value={ALL}>All tenants</option>
              {tenantOptions.hasNone && <option value={NO_TENANT}>No tenant</option>}
              {tenantOptions.ids.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[calc(50%-0.25rem)] sm:w-44">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value={ALL}>All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {error && <ErrorBlock error={error} onRetry={load} />}

        <TableCard
          footer={
            filtered.length > 0 ? (
              <Pagination
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                pageSize={pagination.pageSize}
                onPageChange={pagination.setPage}
                noun="plan"
                suffix={
                  isFiltered ? (
                    <span className="text-stone-400"> · filtered from {formatNumber(plans.length)}</span>
                  ) : undefined
                }
              />
            ) : undefined
          }
        >
          {firstLoad ? (
            <Spinner label="Loading study plans…" className="py-24" />
          ) : filtered.length === 0 ? (
            <EmptyBlock
              icon={isFiltered ? <SearchX size={17} /> : undefined}
              title={isFiltered ? 'No plans match these filters' : 'No audited study plans'}
              hint={
                plans.length === 0
                  ? 'No plan has produced AI generation runs or session audits yet.'
                  : 'Try a different search, tenant or status.'
              }
            />
          ) : (
            <table className={cn(tableClass, 'min-w-[960px]')}>
              <thead className={theadClass}>
                <tr>
                  <SortableTh
                    label="Study plan"
                    active={sortKey === 'title'}
                    desc={sortDesc}
                    onClick={() => setSort('title')}
                  />
                  <Th>Tenant</Th>
                  <Th>Status</Th>
                  <SortableTh
                    label="Runs"
                    active={sortKey === 'total_runs'}
                    desc={sortDesc}
                    onClick={() => setSort('total_runs')}
                    align="right"
                  />
                  <Th align="right">Uploads</Th>
                  <Th align="right">Objectives</Th>
                  <Th align="right">Items</Th>
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
                  <Th className="w-10">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody
                aria-busy={loading}
                className={cn('transition-opacity', loading && 'opacity-60')}
              >
                {pagination.pageItems.map((p) => (
                  <tr
                    key={p.id}
                    onClick={(event) => {
                      if (isInteractiveTarget(event)) return;
                      navigate(planPath(p.identifier));
                    }}
                    className={cn('group cursor-pointer', rowClass)}
                  >
                    <td className="max-w-[26rem] px-4 py-3">
                      <Link
                        to={planPath(p.identifier)}
                        className="block truncate rounded text-sm font-medium text-stone-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        title={p.title || undefined}
                      >
                        {p.title || 'Untitled study plan'}
                      </Link>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-500">
                        <code className="font-mono text-stone-600">{p.identifier}</code>
                        {p.exam_name && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{p.exam_name}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <IdChip value={p.id} label="ID" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TenantTag tenantId={p.tenant_id} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusLabel value={p.status} />
                    </td>
                    <NumCell value={p.total_runs} />
                    <NumCell value={p.uploads_with_audits} />
                    <NumCell value={p.learning_objectives_with_audits} />
                    <NumCell value={p.items_with_audits} />
                    <NumCell value={p.sessions_with_audits} />
                    <td className="px-4 py-3 text-stone-600">
                      <TimeAgo iso={p.last_audit_at} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <ChevronRight
                        size={16}
                        aria-hidden="true"
                        className="text-stone-300 transition-colors group-hover:text-stone-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      </div>
    </div>
  );
};

export default StudyPlanList;
