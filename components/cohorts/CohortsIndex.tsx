import React, { useMemo, useState } from 'react';
import { ArrowRight, Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import type { TeacherCohort } from '@/types/AcademyStudioTypes';
import {
  Button,
  EmptyState,
  InlineAlert,
  Menu,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Spinner,
  StatusDot,
} from '@/components/ui';
import {
  PUBLISH_STATE_META,
  formatDateRange,
  plural,
  relativeTime,
  type CohortPublishState,
} from './cohortModel';

type CohortFilter = 'all' | 'setup' | 'ready' | 'published';

const FILTER_STATES: Record<Exclude<CohortFilter, 'all'>, CohortPublishState[]> = {
  setup: ['not-ready'],
  ready: ['ready', 'failed'],
  published: ['publishing', 'published'],
};

interface CohortsIndexProps {
  cohorts: TeacherCohort[];
  publishStateById: ReadonlyMap<string, CohortPublishState>;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totals: {
    learnerAssignments: number;
    courseAssignments: number;
    curatedDeliveries: number;
    sharedCourses: number;
  };
  onOpenCohort: (cohortId: string) => void;
  onEditCohort: (cohortId: string) => void;
  onDeleteCohort: (cohortId: string) => void;
  onNewCohort: () => void;
}

const CohortRow: React.FC<{
  cohort: TeacherCohort;
  state: CohortPublishState;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ cohort, state, onOpen, onEdit, onDelete }) => {
  const dates = formatDateRange(cohort.startDate, cohort.endDate);
  const updated = relativeTime(cohort.updatedAt);
  const curated = cohort.courseSelections.length;
  const meta = [cohort.term || 'No term', dates].filter(Boolean).join(' · ');
  const status = PUBLISH_STATE_META[state];

  return (
    <li className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50">
      <button
        type="button"
        onClick={onOpen}
        className="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-6 gap-y-1.5 text-left outline-none after:absolute after:inset-0 focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-500 md:grid-cols-[minmax(0,1fr)_6rem_6rem_9.5rem]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-stone-900">{cohort.title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-stone-500">
            {meta}
            {cohort.description && <span className="text-stone-400"> · {cohort.description}</span>}
          </span>
        </span>
        <span className="flex items-center gap-4 text-[13px] text-stone-600 md:contents">
          <span className="tabular-nums md:text-right">
            <span className="md:hidden">{plural(cohort.studentIds.length, 'learner')}</span>
            <span className="hidden md:inline">{cohort.studentIds.length.toLocaleString()}</span>
          </span>
          <span className="tabular-nums md:text-right">
            <span className="md:hidden">{plural(cohort.courseIds.length, 'course')}</span>
            <span className="hidden md:inline">{cohort.courseIds.length.toLocaleString()}</span>
            {curated > 0 && (
              <span
                className="ml-1 text-xs text-stone-400 md:ml-0 md:block"
                title="Courses where this cohort gets a curated set of objectives"
              >
                {curated} curated
              </span>
            )}
          </span>
          <span className="min-w-0">
            <StatusDot tone={status.tone}>{status.label}</StatusDot>
            {updated && (
              <span className="mt-0.5 hidden text-xs text-stone-400 md:block">Updated {updated}</span>
            )}
          </span>
        </span>
      </button>
      <div className="relative z-10 flex items-center gap-1">
        <Menu
          size="sm"
          label={`Actions for ${cohort.title}`}
          items={[
            { label: 'Open cohort', icon: ArrowRight, onSelect: onOpen },
            { label: 'Edit details', icon: Pencil, onSelect: onEdit },
            { label: 'Delete cohort', icon: Trash2, tone: 'danger', onSelect: onDelete },
          ]}
        />
      </div>
    </li>
  );
};

/** The Cohorts list: find a cohort, see where it stands, open it. */
const CohortsIndex: React.FC<CohortsIndexProps> = ({
  cohorts,
  publishStateById,
  isLoading,
  loadError,
  onRetry,
  searchQuery,
  onSearchChange,
  totals,
  onOpenCohort,
  onEditCohort,
  onDeleteCohort,
  onNewCohort,
}) => {
  const [filter, setFilter] = useState<CohortFilter>('all');

  const stateOf = (cohort: TeacherCohort) => publishStateById.get(cohort.id) ?? 'not-ready';

  const counts = useMemo(() => {
    const next = { all: cohorts.length, setup: 0, ready: 0, published: 0 };
    cohorts.forEach((cohort) => {
      const state = publishStateById.get(cohort.id) ?? 'not-ready';
      (Object.keys(FILTER_STATES) as Array<keyof typeof FILTER_STATES>).forEach((key) => {
        if (FILTER_STATES[key].includes(state)) next[key] += 1;
      });
    });
    return next;
  }, [cohorts, publishStateById]);

  const visibleCohorts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return cohorts.filter((cohort) => {
      if (filter !== 'all' && !FILTER_STATES[filter].includes(stateOf(cohort))) return false;
      if (!query) return true;
      return [cohort.title, cohort.term, cohort.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
    // stateOf reads publishStateById.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohorts, filter, publishStateById, searchQuery]);

  const renderBody = () => {
    if (isLoading && cohorts.length === 0) {
      return <Spinner label="Loading cohorts…" className="py-24" />;
    }
    if (cohorts.length === 0) {
      if (loadError) return null;
      return (
        <EmptyState
          icon={UsersRound}
          title="No cohorts yet"
          description="A cohort groups learners and the courses they take. Create one, add learners, attach courses, then publish study plans."
          action={
            <Button variant="primary" icon={Plus} onClick={onNewCohort}>
              New cohort
            </Button>
          }
        />
      );
    }
    if (visibleCohorts.length === 0) {
      return (
        <EmptyState
          compact
          icon={UsersRound}
          title="No cohorts match"
          description="Try a different search or filter."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange('');
                setFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      );
    }
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
          <div
            aria-hidden="true"
            className="hidden items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-2 text-xs font-medium text-stone-500 md:flex"
          >
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_6rem_6rem_9.5rem] gap-x-6">
              <span>Cohort</span>
              <span className="text-right">Learners</span>
              <span className="text-right">Courses</span>
              <span>Status</span>
            </div>
            <span className="w-7" />
          </div>
          <ul className="divide-y divide-stone-100">
            {visibleCohorts.map((cohort) => (
              <CohortRow
                key={cohort.id}
                cohort={cohort}
                state={stateOf(cohort)}
                onOpen={() => onOpenCohort(cohort.id)}
                onEdit={() => onEditCohort(cohort.id)}
                onDelete={() => onDeleteCohort(cohort.id)}
              />
            ))}
          </ul>
        </div>
        <p className="mt-3 text-[13px] text-stone-500">
          {plural(cohorts.length, 'cohort')} · {plural(totals.learnerAssignments, 'learner seat')} ·{' '}
          {plural(totals.courseAssignments, 'course assignment')} ·{' '}
          {plural(totals.curatedDeliveries, 'curated delivery', 'curated deliveries')} ·{' '}
          {plural(totals.sharedCourses, 'shared course')}
        </p>
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Cohorts"
        description="Group learners, attach the courses they should take, then publish study plans for everyone in the cohort."
        actions={
          <Button variant="primary" icon={Plus} onClick={onNewCohort}>
            New cohort
          </Button>
        }
      />

      {loadError && (
        <InlineAlert
          className="mt-6"
          title="Couldn't load cohorts"
          action={
            <Button size="sm" variant="secondary" onClick={onRetry} loading={isLoading}>
              Retry
            </Button>
          }
        >
          {loadError}
        </InlineAlert>
      )}

      {cohorts.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search cohorts by title or term"
            className="w-full sm:w-80"
          />
          <SegmentedControl<CohortFilter>
            label="Filter cohorts by status"
            value={filter}
            onChange={setFilter}
            className="max-w-full overflow-x-auto sm:ml-auto"
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'setup', label: 'Needs setup', count: counts.setup },
              { value: 'ready', label: 'Ready to publish', count: counts.ready },
              { value: 'published', label: 'Published', count: counts.published },
            ]}
          />
        </div>
      )}

      <div className="mt-5">{renderBody()}</div>
    </div>
  );
};

export default CohortsIndex;
