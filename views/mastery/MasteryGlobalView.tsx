import * as React from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, SearchX, UsersRound } from 'lucide-react';
import {
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  SearchInput,
  Spinner,
} from '@/components/ui';
import { TableCard, Th } from '@/components/mastery/MasteryParts';
import { useMasteryContext } from './MasteryLayout';
import {
  formatDateRange,
  getIdSuffix,
  masteryCohortPath,
  plural,
} from './masteryShared';

/** Mastery home: every cohort, one click from its readiness breakdown. */
const MasteryGlobalView: React.FC = () => {
  const { cohorts, isCatalogLoading, catalogError } = useMasteryContext();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filteredCohorts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cohorts;
    return cohorts.filter((cohort) =>
      [cohort.title, cohort.term, cohort.description].some((value) =>
        value?.toLowerCase().includes(needle),
      ),
    );
  }, [cohorts, query]);

  const learnerTotal = useMemo(
    () => new Set(cohorts.flatMap((cohort) => cohort.studentIds)).size,
    [cohorts],
  );

  const renderBody = () => {
    if (isCatalogLoading && cohorts.length === 0) {
      return <Spinner label="Loading cohorts…" className="py-16" />;
    }
    if (cohorts.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={UsersRound}
            title="No cohorts yet"
            description="Mastery is tracked per cohort. Create a cohort and assign courses to it, then come back here to see how ready its learners are."
            action={
              <Button variant="secondary" onClick={() => navigate('/cohorts')}>
                Go to cohorts
              </Button>
            }
          />
        </div>
      );
    }
    if (filteredCohorts.length === 0) {
      return (
        <div className="rounded-xl border border-stone-200">
          <EmptyState
            compact
            icon={SearchX}
            title={`No cohorts match “${query.trim()}”`}
            description="Try a different name or term."
            action={
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <TableCard>
        <caption className="sr-only">Cohorts — choose one to see its mastery</caption>
        <thead className="border-b border-stone-200 bg-stone-50/60">
          <tr>
            <Th className="min-w-[16rem]">Cohort</Th>
            <Th className="hidden md:table-cell">Term</Th>
            <Th className="hidden lg:table-cell">Dates</Th>
            <Th align="right">Learners</Th>
            <Th align="right">Courses</Th>
            <Th className="w-10" srOnly>
              Open
            </Th>
          </tr>
        </thead>
        <tbody>
          {filteredCohorts.map((cohort) => {
            const path = masteryCohortPath(getIdSuffix(cohort.id));
            const dates = formatDateRange(cohort.startDate, cohort.endDate);
            return (
              <tr
                key={cohort.id}
                onClick={() => navigate(path)}
                className="group cursor-pointer border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-50"
              >
                <td className="px-4 py-3">
                  <Link
                    to={path}
                    onClick={(event) => event.stopPropagation()}
                    className="rounded text-sm font-medium text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    {cohort.title}
                  </Link>
                  {cohort.description && (
                    <p className="mt-0.5 line-clamp-1 text-stone-500">{cohort.description}</p>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-stone-700 md:table-cell">
                  {cohort.term || <span className="text-stone-400">—</span>}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-stone-700 lg:table-cell">
                  {dates ?? <span className="text-stone-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                  {cohort.studentIds.length.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                  {cohort.courseIds.length.toLocaleString()}
                </td>
                <td className="w-10 px-4 py-3">
                  <ChevronRight
                    size={16}
                    className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-600"
                    aria-hidden="true"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mastery"
        description="How ready your learners are, cohort by cohort. Open a cohort to compare its courses and learners, then drill into any learner’s objectives."
      />

      {catalogError && (
        <InlineAlert title="Couldn’t load cohorts">{catalogError}</InlineAlert>
      )}

      {cohorts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search cohorts"
            className="w-full sm:w-72"
          />
          <p className="text-[13px] text-stone-500 sm:ml-auto">
            {plural(cohorts.length, 'cohort')} · {plural(learnerTotal, 'learner')}
          </p>
        </div>
      )}

      {renderBody()}
    </div>
  );
};

export default MasteryGlobalView;
