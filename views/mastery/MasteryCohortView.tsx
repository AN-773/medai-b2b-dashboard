import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronLeft, ChevronRight, SearchX, UsersRound } from 'lucide-react';
import { AskAboutCohortButton } from '@/components/ask/AskAboutCohortButton';
import { ReadinessGauge } from '@/components/student_mastery/ReadinessGauge';
import { cohortMetricsService } from '@/services/cohortMetricsService';
import type {
  CohortLearnerMetricsPage,
  CohortMetricsLearnerSummary,
  CohortMetricsReport,
  CohortMetricsStatus,
} from '@/types/CohortMetricsTypes';
import {
  Badge,
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  ProgressBar,
  SectionHeader,
  Spinner,
} from '@/components/ui';
import {
  DistributionBar,
  KpiCell,
  KpiStrip,
  MasteryBreadcrumb,
  MetricCard,
  ScoreBar,
  StatList,
  StatRow,
  TableCard,
  Th,
} from '@/components/mastery/MasteryParts';
import MasterySidebar from './MasterySidebar';
import { useMasteryContext } from './MasteryLayout';
import {
  StatusLabel,
  findCohortByRouteId,
  formatDateRange,
  formatPacing,
  formatPercent,
  formatScore,
  getCohortIdentifier,
  getIdSuffix,
  initialsOf,
  plural,
  statusMeta,
} from './masteryShared';

const LEARNERS_PAGE_SIZE = 50;

const STATUS_ORDER: CohortMetricsStatus[] = ['behind', 'on_track', 'ahead'];
const STATUS_BAR: Record<CohortMetricsStatus, string> = {
  behind: 'bg-amber-500',
  on_track: 'bg-brand-500',
  ahead: 'bg-sky-500',
};

const MASTERY_CRUMB = { label: 'Mastery', to: '/mastery' };

const lastActiveLabel = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : `Active ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
};

/** Headline figures, pace status and timeline for one cohort. */
const CohortSummary: React.FC<{ report: CohortMetricsReport }> = ({ report }) => {
  const { metrics, window: timeline, statusDistribution, courses, learnerCount } = report;

  const weakestCourse =
    courses.length > 1
      ? [...courses].sort((left, right) => left.metrics.readiness - right.metrics.readiness)[0]
      : null;

  const statusTotal = STATUS_ORDER.reduce(
    (sum, status) => sum + (statusDistribution?.[status] || 0),
    0,
  );
  const behindCount = statusDistribution?.behind || 0;
  const statusTakeaway =
    statusTotal === 0
      ? 'No learner activity yet'
      : behindCount > 0
        ? `${behindCount.toLocaleString()} of ${plural(statusTotal, 'learner')} ${behindCount === 1 ? 'is' : 'are'} behind pace`
        : 'No learners are behind pace';

  const hasDeadline = Boolean(timeline?.startsAt && timeline?.endsAt);
  const elapsedPercent = timeline
    ? Math.round(Math.max(0, Math.min(1, timeline.elapsedFraction || 0)) * 100)
    : 0;
  const daysLeft = timeline ? Math.max(0, timeline.daysRemaining) : 0;

  return (
    <div className="space-y-4">
      <KpiStrip className="lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex min-w-0 items-center gap-5 bg-white p-5">
          <ReadinessGauge value={formatScore(metrics?.readiness ?? 0)} size="medium" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-stone-500">Readiness</p>
            <p className="mt-1 text-sm text-stone-700">
              Average across {plural(learnerCount, 'learner')}
            </p>
            {weakestCourse && (
              <p className="mt-1 text-[13px] leading-5 text-stone-500">
                Lowest in <span className="text-stone-700">{weakestCourse.courseTitle}</span> (
                {formatPercent(weakestCourse.metrics.readiness)})
              </p>
            )}
          </div>
        </div>
        <KpiCell
          label="Mastery"
          figure={formatPercent(metrics?.mastery ?? 0)}
          detail="How well learners know what they’ve practised"
        >
          <ScoreBar value={metrics?.mastery ?? 0} hideValue className="mt-3" />
        </KpiCell>
        <KpiCell
          label="Coverage"
          figure={formatPercent(metrics?.coverage ?? 0)}
          detail={`Share of ${plural(report.universe?.los ?? 0, 'objective')} started`}
        >
          <ScoreBar value={metrics?.coverage ?? 0} hideValue className="mt-3" />
        </KpiCell>
        <KpiCell
          label="Pacing"
          figure={formatPacing(metrics?.pacing ?? 0)}
          detail="Progress against the cohort timeline"
        />
      </KpiStrip>

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricCard title="Learner status" takeaway={statusTakeaway}>
          <DistributionBar
            label="Learners by pace status"
            segments={STATUS_ORDER.map((status) => ({
              key: status,
              label: statusMeta[status].label,
              value: statusDistribution?.[status] || 0,
              colorClass: STATUS_BAR[status],
            }))}
          />
        </MetricCard>

        <MetricCard
          title="Timeline"
          takeaway={
            hasDeadline
              ? formatDateRange(timeline.startsAt, timeline.endsAt) ?? 'Cohort timeline'
              : 'No deadline set for this cohort'
          }
        >
          {hasDeadline ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-none tracking-tight text-stone-900 tabular-nums">
                  {daysLeft.toLocaleString()}
                </span>
                <span className="text-sm text-stone-500">{daysLeft === 1 ? 'day left' : 'days left'}</span>
              </div>
              <ProgressBar
                value={elapsedPercent}
                max={100}
                className="mt-4"
                label="Share of the cohort timeline elapsed"
              />
              <StatList className="mt-4">
                <StatRow label="Time elapsed" value={`${elapsedPercent}%`} />
                <StatRow
                  label="Objectives expected by now"
                  value={(timeline.expectedLOsCovered ?? 0).toFixed(1)}
                />
              </StatList>
            </>
          ) : (
            <p className="text-[13px] leading-5 text-stone-500">
              Give the cohort a start and end date to compare learners against a timeline.{' '}
              <Link
                to="/cohorts"
                className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-stone-900"
              >
                Open cohorts
              </Link>
            </p>
          )}
        </MetricCard>
      </div>
    </div>
  );
};

const MasteryCohortView: React.FC = () => {
  const { cohortId: cohortRouteId } = useParams();
  const navigate = useNavigate();
  const { cohorts, isCatalogLoading, catalogError } = useMasteryContext();

  const selectedCohort = useMemo(
    () => findCohortByRouteId(cohorts, cohortRouteId),
    [cohorts, cohortRouteId],
  );

  const [cohortReport, setCohortReport] = useState<CohortMetricsReport | null>(
    null,
  );
  const [isCohortLoading, setIsCohortLoading] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);

  const [learnersPage, setLearnersPage] =
    useState<CohortLearnerMetricsPage | null>(null);
  const [learnersPageIndex, setLearnersPageIndex] = useState(1);
  const [isLearnersLoading, setIsLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCohort) {
      setCohortReport(null);
      return;
    }
    let active = true;
    setCohortReport(null);
    setIsCohortLoading(true);
    setCohortError(null);
    cohortMetricsService
      .getCohortMetrics(getCohortIdentifier(selectedCohort))
      .then((report) => {
        if (!active) return;
        setCohortReport(report);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load cohort metrics:', error);
        setCohortReport(null);
        setCohortError(
          error instanceof Error
            ? error.message
            : 'Unable to load cohort metrics.',
        );
      })
      .finally(() => {
        if (!active) return;
        setIsCohortLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCohort]);

  useEffect(() => {
    setLearnersPageIndex(1);
    setLearnersPage(null);
  }, [selectedCohort]);

  useEffect(() => {
    if (!selectedCohort) {
      setLearnersPage(null);
      return;
    }
    let active = true;
    setIsLearnersLoading(true);
    setLearnersError(null);
    cohortMetricsService
      .getCohortLearners(getCohortIdentifier(selectedCohort), {
        page: learnersPageIndex,
        limit: LEARNERS_PAGE_SIZE,
      })
      .then((page) => {
        if (!active) return;
        setLearnersPage(page);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load cohort learners:', error);
        setLearnersPage(null);
        setLearnersError(
          error instanceof Error
            ? error.message
            : 'Unable to load cohort learners.',
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLearnersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCohort, learnersPageIndex]);

  /** The learner page URL, opened on the cohort's first course by default. */
  const learnerPath = (learner: CohortMetricsLearnerSummary) => {
    if (!selectedCohort) return '/mastery';
    const learnerSuffix = getIdSuffix(learner.userId);
    const defaultCourseId = cohortReport?.courses?.[0]?.courseId;
    const courseQuery = defaultCourseId
      ? `?courseId=${encodeURIComponent(getIdSuffix(defaultCourseId))}`
      : '';
    return `/mastery/cohorts/${encodeURIComponent(
      getIdSuffix(selectedCohort.id),
    )}/learners/${encodeURIComponent(learnerSuffix)}${courseQuery}`;
  };

  const handleLearnerSelect = (learner: CohortMetricsLearnerSummary) => {
    if (!selectedCohort) return;
    // The learner report has no name, so hand it over for the page title.
    navigate(learnerPath(learner), { state: { learnerName: learner.name } });
  };

  const cohortSwitcher = (
    <MasterySidebar
      cohorts={cohorts}
      isCatalogLoading={isCatalogLoading}
      selectedCohortRouteId={cohortRouteId || null}
    />
  );
  const breadcrumb = <MasteryBreadcrumb trail={[MASTERY_CRUMB]} />;
  const catalogAlert = catalogError && (
    <InlineAlert title="Couldn’t load cohorts">{catalogError}</InlineAlert>
  );

  if (!selectedCohort) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={breadcrumb} title="Cohort not found" actions={cohortSwitcher} />
        {catalogAlert}
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={SearchX}
            title="This link doesn’t match a cohort you can see"
            description="The cohort may have been removed, or the link is out of date. Pick a cohort from the menu above."
            action={
              <Button variant="secondary" onClick={() => navigate('/mastery')}>
                All cohorts
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const learnerTotal = cohortReport?.learnerCount ?? learnersPage?.total ?? null;
  const pageCount = learnersPage
    ? Math.max(1, Math.ceil(learnersPage.total / learnersPage.limit))
    : 1;

  const renderLearners = () => {
    if (!learnersPage) {
      return (
        <div className="rounded-xl border border-stone-200">
          {isLearnersLoading ? (
            <Spinner label="Loading learners…" className="py-16" />
          ) : (
            <EmptyState compact icon={UsersRound} title="No learner data available" />
          )}
        </div>
      );
    }
    if (learnersPage.items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            compact
            icon={UsersRound}
            title="No learners yet"
            description="Learners appear here once they’re enrolled in this cohort."
          />
        </div>
      );
    }

    return (
      <TableCard
        busy={isLearnersLoading}
        footer={
          learnersPage.total > LEARNERS_PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-[13px] text-stone-500">
              <span className="tabular-nums">
                Page {learnersPage.page} of {pageCount} · {plural(learnersPage.total, 'learner')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ChevronLeft}
                  onClick={() => setLearnersPageIndex((index) => Math.max(1, index - 1))}
                  disabled={learnersPage.page <= 1 || isLearnersLoading}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  iconRight={ChevronRight}
                  onClick={() => setLearnersPageIndex((index) => index + 1)}
                  disabled={
                    learnersPage.page * learnersPage.limit >= learnersPage.total ||
                    isLearnersLoading
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )
        }
      >
        <caption className="sr-only">Learners in {selectedCohort.title}</caption>
        <thead className="border-b border-stone-200 bg-stone-50/60">
          <tr>
            <Th className="min-w-[15rem]">Learner</Th>
            <Th className="min-w-[10rem]">Readiness</Th>
            <Th align="right">Mastery</Th>
            <Th align="right">Coverage</Th>
            <Th align="right">Pacing</Th>
            <Th>Status</Th>
            <Th className="w-10" srOnly>
              Open
            </Th>
          </tr>
        </thead>
        <tbody>
          {learnersPage.items.map((learner) => {
            const lastActive = lastActiveLabel(learner.lastActiveAt);
            return (
              <tr
                key={learner.userId}
                onClick={() => handleLearnerSelect(learner)}
                className="group cursor-pointer border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-50"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-600"
                    >
                      {initialsOf(learner.name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={learnerPath(learner)}
                        state={{ learnerName: learner.name }}
                        onClick={(event) => event.stopPropagation()}
                        className="block truncate rounded text-sm font-medium text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        {learner.name}
                      </Link>
                      <p className="truncate text-xs text-stone-500">
                        {getIdSuffix(learner.userId)}
                        {lastActive && ` · ${lastActive}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <ScoreBar value={learner.metrics.readiness} className="max-w-[11rem]" />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                  {formatPercent(learner.metrics.mastery)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                  {formatPercent(learner.metrics.coverage)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                  {formatPacing(learner.metrics.pacing)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <StatusLabel status={learner.status} />
                </td>
                <td className="w-10 px-4 py-2.5">
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
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeader
          eyebrow={breadcrumb}
          title={selectedCohort.title}
          meta={
            <>
              {selectedCohort.term && <Badge>{selectedCohort.term}</Badge>}
              {cohortReport && cohortReport.atRiskCount > 0 && (
                <Badge tone="amber" dot>
                  {cohortReport.atRiskCount.toLocaleString()} at risk
                </Badge>
              )}
            </>
          }
          description={selectedCohort.description || undefined}
          actions={
            <>
              <AskAboutCohortButton
                cohortId={selectedCohort.id}
                cohortTitle={selectedCohort.title}
                page="mastery"
              />
              {cohortSwitcher}
            </>
          }
        />

        {catalogAlert}
        {cohortError && (
          <InlineAlert title="Couldn’t load cohort metrics">{cohortError}</InlineAlert>
        )}

        {isCohortLoading && !cohortReport ? (
          <Spinner
            label="Loading cohort metrics…"
            className="rounded-xl border border-stone-200 py-16"
          />
        ) : (
          cohortReport && <CohortSummary report={cohortReport} />
        )}
      </div>

      {cohortReport && cohortReport.courses.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Courses"
            meta={<Badge>{cohortReport.courses.length.toLocaleString()}</Badge>}
            description="Cohort averages for each course."
          />
          <TableCard>
            <caption className="sr-only">Courses in {selectedCohort.title}</caption>
            <thead className="border-b border-stone-200 bg-stone-50/60">
              <tr>
                <Th className="min-w-[15rem]">Course</Th>
                <Th className="min-w-[10rem]">Readiness</Th>
                <Th align="right">Mastery</Th>
                <Th align="right">Coverage</Th>
                <Th align="right">Pacing</Th>
                <Th align="right">Objectives</Th>
              </tr>
            </thead>
            <tbody>
              {cohortReport.courses.map((course) => (
                <tr key={course.courseId} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-stone-900">
                    {course.courseTitle}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar value={course.metrics.readiness} className="max-w-[11rem]" />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {formatPercent(course.metrics.mastery)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {formatPercent(course.metrics.coverage)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {formatPacing(course.metrics.pacing)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {course.universe.los.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          title="Learners"
          meta={
            learnerTotal !== null ? <Badge>{learnerTotal.toLocaleString()}</Badge> : undefined
          }
          description="Open a learner to see their readiness and objectives course by course."
        />
        {learnersError && (
          <InlineAlert title="Couldn’t load learners">{learnersError}</InlineAlert>
        )}
        {renderLearners()}
      </section>
    </div>
  );
};

export default MasteryCohortView;
