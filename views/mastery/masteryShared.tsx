import * as React from 'react';
import type {
  CohortMetricsMasteryBuckets,
  CohortMetricsStatus,
} from '@/types/CohortMetricsTypes';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import { Badge, Spinner, StatusDot, type BadgeTone } from '@/components/ui';

export const formatPercent = (value: number) =>
  Number.isFinite(value) ? `${Math.trunc(value * 100)}%` : '—';

export const formatPacing = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(2)}x` : '—';

export const formatScore = (value: number) => Math.trunc((value || 0) * 100);

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

/** `/mastery/cohorts/:cohortId` for a cohort route id (the id suffix). */
export const masteryCohortPath = (cohortRouteId: string) =>
  `/mastery/cohorts/${encodeURIComponent(cohortRouteId)}`;

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  // Date-only strings are calendar days, not UTC midnights.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const formatDate = (value: string | null | undefined) => {
  const date = parseDate(value);
  return date ? longDate.format(date) : null;
};

/** "Jan 6 – May 30, 2026", "From Jan 6, 2026", or null. */
export const formatDateRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => {
  const from = parseDate(start);
  const to = parseDate(end);
  if (from && to) {
    const sameYear = from.getFullYear() === to.getFullYear();
    return `${(sameYear ? shortDate : longDate).format(from)} – ${longDate.format(to)}`;
  }
  if (from) return `From ${longDate.format(from)}`;
  if (to) return `Until ${longDate.format(to)}`;
  return null;
};

type StatusMeta = {
  label: string;
  tone: BadgeTone;
  bg: string;
  color: string;
  dot: string;
  pillBg: string;
};

/** Pace status. Behind needs attention (amber), on track is green, ahead is blue. */
export const statusMeta: Record<CohortMetricsStatus, StatusMeta> = {
  behind: {
    label: 'Behind',
    tone: 'amber',
    bg: 'bg-amber-50',
    color: 'text-amber-800',
    dot: 'bg-amber-500',
    pillBg: 'bg-amber-50',
  },
  on_track: {
    label: 'On track',
    tone: 'green',
    bg: 'bg-brand-50',
    color: 'text-brand-800',
    dot: 'bg-brand-500',
    pillBg: 'bg-brand-50',
  },
  ahead: {
    label: 'Ahead',
    tone: 'blue',
    bg: 'bg-sky-50',
    color: 'text-sky-800',
    dot: 'bg-sky-500',
    pillBg: 'bg-sky-50',
  },
};

const fallbackStatusMeta: StatusMeta = {
  label: 'Unknown',
  tone: 'neutral',
  bg: 'bg-stone-100',
  color: 'text-stone-700',
  dot: 'bg-stone-400',
  pillBg: 'bg-stone-50',
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

const metaFor = (status: string | null | undefined) => {
  const normalizedStatus = normalizeCohortMetricsStatus(status);
  return normalizedStatus ? statusMeta[normalizedStatus] : fallbackStatusMeta;
};

/** Pace status as a badge (headers, cards). */
export const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const meta = metaFor(status);
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
};

/** Pace status as a dot + label (dense table rows). */
export const StatusLabel: React.FC<{ status?: string | null }> = ({ status }) => {
  const meta = metaFor(status);
  return <StatusDot tone={meta.tone}>{meta.label}</StatusDot>;
};

export const MasteryLoadingView: React.FC<{ label?: string }> = ({
  label = 'Loading mastery…',
}) => <Spinner label={label} className="min-h-[40vh] py-16" />;

/** Hex values for the mastery bands (for SVG/Recharts consumers). */
export const MASTERY_BUCKET_COLORS: Record<string, string> = {
  untouched: '#D6D3D1', // stone-300
  '0-25': '#EF4444', // red-500
  '25-50': '#F59E0B', // amber-500
  '50-75': '#62D6B0', // brand-300
  '75-100': '#13A67E', // brand-600
};

/** Mastery bands in display order, with their Tailwind colour classes. */
export const MASTERY_BUCKETS: Array<{
  key: keyof CohortMetricsMasteryBuckets;
  label: string;
  colorClass: string;
}> = [
  { key: '75-100', label: '75–100%', colorClass: 'bg-brand-600' },
  { key: '50-75', label: '50–75%', colorClass: 'bg-brand-300' },
  { key: '25-50', label: '25–50%', colorClass: 'bg-amber-500' },
  { key: '0-25', label: '0–25%', colorClass: 'bg-red-500' },
  { key: 'untouched', label: 'Not started', colorClass: 'bg-stone-300' },
];

/** Initials for a learner avatar ("Jane Doe" → "JD"). */
export const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
