import * as React from 'react';
import type {
  CohortMetricsStatus,
} from '@/types/CohortMetricsTypes';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';

export const formatPercent = (value: number) =>
  Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';

export const formatPacing = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(2)}x` : '—';

export const formatScore = (value: number) => Math.round((value || 0) * 100);

export const getIdSuffix = (value: string) => value.split('/').pop() || value;

export const getCohortIdentifier = (cohort: TeacherCohort) =>
  cohort.backendIdentifier || getIdSuffix(cohort.id);

export const getCourseIdentifier = (course: TeacherCourse) =>
  course.backendIdentifier || getIdSuffix(course.id);

export const findCohortByRouteId = (
  cohorts: TeacherCohort[],
  routeCohortId: string | undefined,
): TeacherCohort | null => {
  if (!routeCohortId) return null;
  return (
    cohorts.find((c) => getIdSuffix(c.id) === routeCohortId) ||
    cohorts.find((c) => c.id === routeCohortId) ||
    cohorts.find((c) => c.backendIdentifier === routeCohortId) ||
    null
  );
};

type StatusMeta = {
  label: string;
  bg: string;
  color: string;
  dot: string;
  pillBg: string;
};

export const statusMeta: Record<CohortMetricsStatus, StatusMeta> = {
  behind: {
    label: 'Behind',
    bg: 'bg-rose-100',
    color: 'text-rose-700',
    dot: 'bg-rose-500',
    pillBg: 'bg-rose-50',
  },
  on_track: {
    label: 'On Track',
    bg: 'bg-emerald-100',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    pillBg: 'bg-emerald-50',
  },
  ahead: {
    label: 'Ahead',
    bg: 'bg-sky-100',
    color: 'text-sky-700',
    dot: 'bg-sky-500',
    pillBg: 'bg-sky-50',
  },
};

const fallbackStatusMeta: StatusMeta = {
  label: 'Unknown',
  bg: 'bg-slate-100',
  color: 'text-slate-700',
  dot: 'bg-slate-400',
  pillBg: 'bg-slate-50',
};

export const normalizeCohortMetricsStatus = (
  status: string | null | undefined,
): CohortMetricsStatus | null => {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case 'behind':
      return 'behind';
    case 'on_track':
    case 'on-track':
    case 'on track':
      return 'on_track';
    case 'ahead':
      return 'ahead';
    default:
      return null;
  }
};

export const StatusBadge: React.FC<{ status?: string | null }> = ({
  status,
}) => {
  const normalizedStatus = normalizeCohortMetricsStatus(status);
  const meta = normalizedStatus
    ? statusMeta[normalizedStatus]
    : fallbackStatusMeta;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${meta.bg} ${meta.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

export const MasteryLoadingView: React.FC = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
    <div
      className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-[#1BD183]"
      aria-label="Loading"
      role="progressbar"
    />
  </div>
);

export const MASTERY_BUCKET_COLORS: Record<string, string> = {
  untouched: '#cbd5e1',
  '0-25': '#f43f5e',
  '25-50': '#fb923c',
  '50-75': '#fbbf24',
  '75-100': '#10b981',
};
