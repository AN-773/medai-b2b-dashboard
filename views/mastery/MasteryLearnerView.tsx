import * as React from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  Layers,
  SearchX,
  Target,
} from 'lucide-react';
import { ReadinessGauge } from '@/components/student_mastery/ReadinessGauge';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { cohortMetricsService } from '@/services/cohortMetricsService';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import type {
  CohortMetricsReport,
  CohortMetricsStatus,
  LearnerLOBreakdown,
  LearnerMetricsReport,
} from '@/types/CohortMetricsTypes';
import {
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  SegmentedControl,
  Select,
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
  type MasteryCrumb,
} from '@/components/mastery/MasteryParts';
import {
  MASTERY_BUCKETS,
  MasteryLoadingView,
  StatusBadge,
  findCohortByRouteId,
  formatDate,
  formatPercent,
  formatScore,
  getCohortIdentifier,
  getCourseIdentifier,
  getIdSuffix,
  masteryCohortPath,
  normalizeCohortMetricsStatus,
  plural,
} from './masteryShared';

type ObjectiveSort = 'course' | 'weakest';

const STATUS_TAKEAWAY: Record<CohortMetricsStatus, string> = {
  behind: 'Behind the expected pace for this course',
  on_track: 'Keeping pace with the course timeline',
  ahead: 'Ahead of the course timeline',
};

/** Per-objective mastery as a readable list: full titles, inline meters. */
const ObjectiveList: React.FC<{ rows: LearnerLOBreakdown[]; sort: ObjectiveSort }> = ({
  rows,
  sort,
}) => {
  const ordered = useMemo(() => {
    if (sort === 'course') return rows;
    // Weakest first among started objectives; not-started ones go last.
    return [...rows].sort((left, right) => {
      if (left.touched !== right.touched) return left.touched ? -1 : 1;
      return left.mastery - right.mastery;
    });
  }, [rows, sort]);

  return (
    <ul className="divide-y divide-stone-100 border-t border-stone-100">
      {ordered.map((objective) => {
        const lastAnswered = formatDate(objective.lastAnsweredAt);
        return (
          <li key={objective.loId} className="flex items-center gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-5 text-stone-900">
                {objective.loTitle}
              </p>
              <p className="mt-0.5 text-[13px] tabular-nums text-stone-500">
                {objective.touched
                  ? [
                      `${objective.itemsAnswered.toLocaleString()} of ${plural(objective.itemsTotal, 'item')} answered`,
                      `${objective.itemsCorrect.toLocaleString()} correct`,
                      lastAnswered && `last ${lastAnswered}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : plural(objective.itemsTotal, 'item')}
              </p>
            </div>
            <div className="w-32 flex-shrink-0 sm:w-44">
              {objective.touched ? (
                <ScoreBar value={objective.mastery} />
              ) : (
                <p className="text-right text-[13px] text-stone-400">Not started</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const MasteryLearnerView: React.FC = () => {
  const { cohortId: cohortRouteId, studentId: studentRouteId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const courseSelectId = useId();

  const courseRouteId = searchParams.get('courseId');

  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);

  const [cohortReport, setCohortReport] = useState<CohortMetricsReport | null>(
    null,
  );
  const [isCohortLoading, setIsCohortLoading] = useState(false);
  const [cohortFailed, setCohortFailed] = useState(false);

  const [learnerReport, setLearnerReport] =
    useState<LearnerMetricsReport | null>(null);
  const [isLearnerLoading, setIsLearnerLoading] = useState(false);
  const [learnerError, setLearnerError] = useState<string | null>(null);

  const [objectiveSort, setObjectiveSort] = useState<ObjectiveSort>('course');

  useEffect(() => {
    let active = true;
    setIsCatalogLoading(true);
    academyStudioBackend
      .loadCatalogSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setCohorts(snapshot.cohorts);
        setCourses(snapshot.courses);
        setCatalogFailed(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load cohorts/courses:', error);
        setCatalogFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setIsCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCohort = useMemo(
    () => findCohortByRouteId(cohorts, cohortRouteId),
    [cohorts, cohortRouteId],
  );

  const courseByIdentifier = useMemo(() => {
    const map = new Map<string, TeacherCourse>();
    courses.forEach((course) => {
      map.set(course.id, course);
      const slug = getCourseIdentifier(course);
      if (slug) map.set(slug, course);
    });
    return map;
  }, [courses]);

  useEffect(() => {
    if (!selectedCohort) {
      setCohortReport(null);
      return;
    }
    let active = true;
    setCohortReport(null);
    setIsCohortLoading(true);
    setCohortFailed(false);
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
        setCohortFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setIsCohortLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCohort]);

  const matchedCourse = useMemo(() => {
    if (!courseRouteId || !cohortReport?.courses?.length) return null;
    return (
      cohortReport.courses.find(
        (entry) => getIdSuffix(entry.courseId) === courseRouteId,
      ) ||
      cohortReport.courses.find((entry) => entry.courseId === courseRouteId) ||
      null
    );
  }, [cohortReport, courseRouteId]);

  useEffect(() => {
    if (courseRouteId) return;
    if (!cohortReport?.courses?.length) return;
    const firstCourseId = cohortReport.courses[0].courseId;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('courseId', getIdSuffix(firstCourseId));
    // Keep the router state (the learner's display name) across the rewrite.
    setSearchParams(nextParams, { replace: true, state: location.state });
  }, [cohortReport, courseRouteId, searchParams, setSearchParams, location.state]);

  useEffect(() => {
    if (!selectedCohort || !studentRouteId || !matchedCourse) {
      setLearnerReport(null);
      return;
    }

    const fullCourseId = matchedCourse.courseId;
    const course =
      courseByIdentifier.get(fullCourseId) ||
      courseByIdentifier.get(getIdSuffix(fullCourseId));
    const courseIdentifier = course
      ? getCourseIdentifier(course)
      : getIdSuffix(fullCourseId);

    let active = true;
    setLearnerReport(null);
    setIsLearnerLoading(true);
    setLearnerError(null);
    cohortMetricsService
      .getLearnerMetrics(
        getCohortIdentifier(selectedCohort),
        studentRouteId,
        courseIdentifier,
      )
      .then((report) => {
        if (!active) return;
        setLearnerReport(report);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load learner metrics:', error);
        setLearnerReport(null);
        setLearnerError(
          error instanceof Error
            ? error.message
            : 'Unable to load learner metrics.',
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLearnerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCohort, studentRouteId, matchedCourse, courseByIdentifier]);

  const handleCourseSelect = (courseId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('courseId', getIdSuffix(courseId));
    setSearchParams(nextParams, { state: location.state });
  };

  // Where "back to the cohort" goes, even when the cohort can't be resolved.
  const cohortHref = selectedCohort
    ? masteryCohortPath(getIdSuffix(selectedCohort.id))
    : cohortRouteId
      ? masteryCohortPath(cohortRouteId)
      : '/mastery';

  const isBootstrapping =
    isCatalogLoading && cohorts.length === 0 && courses.length === 0;

  if (isBootstrapping) {
    return <MasteryLoadingView />;
  }

  const trail: MasteryCrumb[] = [{ label: 'Mastery', to: '/mastery' }];
  if (selectedCohort || cohortRouteId) {
    trail.push({ label: selectedCohort?.title || 'Cohort', to: cohortHref });
  }

  if (!selectedCohort || !studentRouteId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={<MasteryBreadcrumb trail={trail} />}
          title="Learner not found"
        />
        {catalogFailed && (
          <InlineAlert title="Couldn’t load cohorts">
            The cohort list failed to load, so this learner can’t be shown. Try again in a moment.
          </InlineAlert>
        )}
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={SearchX}
            title="This link doesn’t match a learner you can see"
            description="The cohort may have been removed, or the link is out of date."
            action={
              <Button variant="secondary" onClick={() => navigate('/mastery')}>
                Back to cohorts
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const passedName = (location.state as { learnerName?: unknown } | null)?.learnerName;
  const learnerName =
    typeof passedName === 'string' && passedName.trim() ? passedName : studentRouteId;
  const cohortCourses = cohortReport?.courses ?? [];

  const renderBody = () => {
    if (!cohortReport) {
      if (cohortFailed && !isCohortLoading) {
        return (
          <InlineAlert title="Couldn’t load this cohort’s courses">
            Learner metrics are reported per course, so there’s nothing to show until the cohort
            loads. Try again in a moment.
          </InlineAlert>
        );
      }
      return <MasteryLoadingView label="Loading learner…" />;
    }
    if (cohortCourses.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={BookOpen}
            title="This cohort has no courses yet"
            description="Learner metrics are reported per course. Assign a course to the cohort to start tracking."
            action={
              <Button variant="secondary" onClick={() => navigate('/cohorts')}>
                Go to cohorts
              </Button>
            }
          />
        </div>
      );
    }
    if (!matchedCourse) {
      if (!courseRouteId) {
        // The first course is being selected for us.
        return <MasteryLoadingView label="Loading learner…" />;
      }
      return (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={BookOpen}
            title="That course isn’t part of this cohort"
            description="Choose one of the cohort’s courses from the menu above."
          />
        </div>
      );
    }
    if (learnerError) {
      return <InlineAlert title="Couldn’t load learner metrics">{learnerError}</InlineAlert>;
    }
    if (!learnerReport) {
      return <MasteryLoadingView label="Loading learner…" />;
    }

    const { metrics, progress, universe, window: timeline, loBreakdown } = learnerReport;
    const status = normalizeCohortMetricsStatus(learnerReport.status);
    const hasDeadline = Boolean(timeline?.startsAt && timeline?.endsAt);

    const objectiveTotal = loBreakdown.length;
    const startedCount = loBreakdown.filter((objective) => objective.touched).length;
    const lowCount = loBreakdown.filter(
      (objective) => objective.touched && formatScore(objective.mastery) < 60,
    ).length;
    const objectivesTakeaway =
      objectiveTotal === 0
        ? 'No learning objectives in this course yet'
        : [
            `${startedCount.toLocaleString()} of ${plural(objectiveTotal, 'objective')} started`,
            lowCount > 0 && `${lowCount.toLocaleString()} below 60% mastery`,
          ]
            .filter(Boolean)
            .join(' · ');

    const buckets = learnerReport.masteryDistribution;
    const bucketTotal = buckets
      ? MASTERY_BUCKETS.reduce((sum, bucket) => sum + (buckets[bucket.key] || 0), 0)
      : 0;
    const distributionTakeaway =
      bucketTotal === 0
        ? 'No data yet for this learner'
        : `${(buckets?.['75-100'] || 0).toLocaleString()} of ${plural(bucketTotal, 'objective')} at 75% mastery or higher`;

    const accuracy =
      progress.itemsAnswered > 0
        ? Math.round((progress.itemsCorrect / progress.itemsAnswered) * 100)
        : null;

    return (
      <div className="space-y-4">
        <KpiStrip className="lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex min-w-0 items-center gap-5 bg-white p-5">
            <ReadinessGauge value={formatScore(metrics.readiness ?? 0)} size="medium" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-stone-500">Readiness</p>
              <p className="mt-1 text-sm text-stone-700">
                {status ? STATUS_TAKEAWAY[status] : 'Pace status unavailable'}
              </p>
            </div>
          </div>
          <KpiCell
            label="Mastery"
            figure={formatPercent(metrics.mastery ?? 0)}
            detail={
              progress.losTouched > 0
                ? `Average across ${plural(progress.losTouched, 'started objective')}`
                : 'No objectives started yet'
            }
          >
            <ScoreBar value={metrics.mastery ?? 0} hideValue className="mt-3" />
          </KpiCell>
          <KpiCell
            label="Coverage"
            figure={formatPercent(metrics.coverage ?? 0)}
            detail={`${progress.losTouched.toLocaleString()} of ${plural(universe.los, 'objective')} started`}
          >
            <ScoreBar value={metrics.coverage ?? 0} hideValue className="mt-3" />
          </KpiCell>
          <KpiCell
            label="Pacing"
            figure={formatPercent(metrics.pacing ?? 0)}
            detail={
              hasDeadline
                ? `${plural(Math.max(0, timeline.daysRemaining), 'day')} left · ${timeline.expectedLOsCovered.toFixed(1)} objectives expected by now`
                : 'No deadline set for this cohort'
            }
          />
        </KpiStrip>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <MetricCard
            flush
            title="Learning objectives"
            takeaway={objectivesTakeaway}
            action={
              objectiveTotal > 1 && (
                <SegmentedControl<ObjectiveSort>
                  label="Sort objectives"
                  size="sm"
                  value={objectiveSort}
                  onChange={setObjectiveSort}
                  options={[
                    { value: 'course', label: 'Course order' },
                    { value: 'weakest', label: 'Weakest first' },
                  ]}
                />
              )
            }
          >
            {objectiveTotal === 0 ? (
              <EmptyState
                compact
                icon={Target}
                title="No learning objectives to display"
                className="border-t border-stone-100"
              />
            ) : (
              <ObjectiveList rows={loBreakdown} sort={objectiveSort} />
            )}
          </MetricCard>

          <div className="space-y-4">
            <MetricCard title="Mastery distribution" takeaway={distributionTakeaway}>
              <DistributionBar
                label="Objectives by mastery band"
                segments={MASTERY_BUCKETS.map((bucket) => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: buckets?.[bucket.key] || 0,
                  colorClass: bucket.colorClass,
                }))}
              />
            </MetricCard>

            <MetricCard title="Activity">
              <StatList>
                <StatRow
                  icon={Calendar}
                  label="Last answered"
                  value={formatDate(progress.lastAnsweredAt) ?? '—'}
                />
                <StatRow
                  icon={BarChart2}
                  label="Items answered"
                  value={progress.itemsAnswered.toLocaleString()}
                />
                <StatRow
                  icon={CheckCircle2}
                  label="Correct answers"
                  value={`${progress.itemsCorrect.toLocaleString()} / ${progress.itemsAnswered.toLocaleString()}`}
                  hint={accuracy !== null ? `${accuracy}% accuracy` : undefined}
                />
                <StatRow
                  icon={Layers}
                  label="Objectives in course"
                  value={universe.los.toLocaleString()}
                />
              </StatList>
            </MetricCard>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<MasteryBreadcrumb trail={trail} />}
        title={learnerName}
        meta={learnerReport ? <StatusBadge status={learnerReport.status} /> : undefined}
        description={
          <>
            {learnerName !== studentRouteId && <>ID {studentRouteId} · </>}
            {matchedCourse ? (
              <>
                Progress in <span className="text-stone-700">{matchedCourse.courseTitle}</span>
              </>
            ) : (
              'Readiness and objective mastery, course by course'
            )}
          </>
        }
        actions={
          cohortCourses.length > 0 && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label htmlFor={courseSelectId} className="flex-shrink-0 text-[13px] text-stone-500">
                Course
              </label>
              <Select
                id={courseSelectId}
                value={matchedCourse?.courseId ?? ''}
                onChange={(event) => handleCourseSelect(event.target.value)}
                className="min-w-0 flex-1 sm:w-64 sm:flex-none"
              >
                {!matchedCourse && (
                  <option value="" disabled>
                    Select a course
                  </option>
                )}
                {cohortCourses.map((course) => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.courseTitle}
                  </option>
                ))}
              </Select>
            </div>
          )
        }
      />

      {renderBody()}
    </div>
  );
};

export default MasteryLearnerView;
