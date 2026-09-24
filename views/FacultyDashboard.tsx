import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  Gauge,
  Library,
  ListChecks,
  Sparkles,
  Target,
  TrendingDown,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { CohortRiskChart } from '@/components/student_mastery/CohortRiskChart';
import { SystemMasteryChart } from '@/components/student_mastery/SystemMasteryChart';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { cohortMetricsService } from '@/services/cohortMetricsService';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import type { CohortMetricsReport } from '@/types/CohortMetricsTypes';
import type { FacultyAlert, Intervention } from '@/types';
import {
  Badge,
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  Select,
  Spinner,
  type BadgeTone,
} from '@/components/ui';
import { getCoursePendingSuggestionCount } from '@/components/academy/course-workbench/shared';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { KpiTile, SegmentBar } from '@/components/dashboard/KpiTile';
import {
  NeedsAttentionList,
  sortByPriority,
  type AttentionItem,
} from '@/components/dashboard/NeedsAttentionList';
import { getTAPRStatus } from '@/utils/masteryMathStatus';
import {
  formatPacing,
  formatScore,
  getCohortIdentifier,
  getIdSuffix,
} from './mastery/masteryShared';

type ReadinessFilter = 'all' | 'at-risk';

type ReadinessDistributionEntry = {
  range: string;
  count: number;
};

type CourseMasteryEntry = {
  system: string;
  mastery: number;
};

/** Courses listed one per row in "Needs attention" before collapsing into a summary row. */
const MAX_REVIEW_ROWS = 3;

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

const emptyDistribution: ReadinessDistributionEntry[] = [
  { range: 'High', count: 0 },
  { range: 'Medium', count: 0 },
  { range: 'Low', count: 0 },
  { range: 'Critical', count: 0 },
];

const buildReadinessDistribution = (
  report: CohortMetricsReport,
): ReadinessDistributionEntry[] => [
  { range: 'High', count: report.readinessDistribution.high },
  { range: 'Medium', count: report.readinessDistribution.medium },
  { range: 'Low', count: report.readinessDistribution.low },
  { range: 'Critical', count: report.readinessDistribution.critical },
];

const buildAlerts = (
  report: CohortMetricsReport,
  courseMastery: CourseMasteryEntry[],
): FacultyAlert[] => {
  const behindCount = report.statusDistribution.behind || 0;
  const weakestCourse = courseMastery[0] || null;
  const alerts: FacultyAlert[] = [];

  if (behindCount > 0) {
    alerts.push({
      id: 'alert-at-risk',
      title: `${plural(behindCount, 'learner')} behind pace`,
      description: `${Math.round((behindCount / Math.max(report.learnerCount, 1)) * 100)}% of the cohort is behind pacing expectations.`,
      priority: behindCount / Math.max(report.learnerCount, 1) >= 0.25 ? 'HIGH' : 'MEDIUM',
      timeAgo: 'Live',
      suggestedAction: 'Review learners',
    });
  }

  if (weakestCourse) {
    alerts.push({
      id: 'alert-weakest-course',
      title: `${weakestCourse.system} has the lowest mastery`,
      description: `Average mastery is ${weakestCourse.mastery}%. A targeted review session could close the gap.`,
      priority: weakestCourse.mastery < 60 ? 'HIGH' : 'MEDIUM',
      timeAgo: 'Live',
      suggestedAction: 'Plan a review',
    });
  }

  if (report.window.daysRemaining > 0) {
    alerts.push({
      id: 'alert-window',
      title: `${plural(report.window.daysRemaining, 'day')} left in the term`,
      description: `${plural(Math.round(report.window.expectedLOsCovered), 'learning objective')} should be covered by now to stay on pace.`,
      priority: report.window.daysRemaining <= 14 ? 'HIGH' : 'LOW',
      timeAgo: 'Live',
      suggestedAction: 'Check pacing',
    });
  }

  if (alerts.length > 0) return alerts;

  return [
    {
      id: 'alert-clear',
      title: 'No priority alerts',
      description: 'This cohort currently has no critical readiness or pacing flags.',
      priority: 'LOW',
      timeAgo: 'Live',
    },
  ];
};

// TODO: restore per-learner student tagging once the paginated cohort roster
// is integrated here. The cohort metrics endpoint no longer returns the full
// learner list inline; intervention suggestions below derive only from the
// aggregate statusDistribution counts.
const buildInterventions = (
  report: CohortMetricsReport,
  courseMastery: CourseMasteryEntry[],
): Intervention[] => {
  const behindCount = report.statusDistribution.behind || 0;
  const aheadCount = report.statusDistribution.ahead || 0;
  const weakestCourse = courseMastery[0] || null;
  const interventions: Intervention[] = [];

  if (weakestCourse) {
    interventions.push({
      id: 'intervention-course-review',
      priority: weakestCourse.mastery < 60 ? 'HIGH' : 'MEDIUM',
      title: `${weakestCourse.system} review session`,
      description: 'Targeted review session to close the largest measured course gap across the cohort.',
      estimatedTime: '2 hours',
      expectedImpact: Math.max(4, Math.round((80 - weakestCourse.mastery) / 3)),
      confidence: weakestCourse.mastery < 60 ? 91 : 84,
      studentCount: Math.max(behindCount, 1),
      studentIds: [],
    });
  }

  if (behindCount > 0) {
    interventions.push({
      id: 'intervention-behind-learners',
      priority: behindCount >= Math.max(report.learnerCount * 0.25, 1) ? 'HIGH' : 'MEDIUM',
      title: 'Pacing reset session',
      description: 'Focused advising block for learners who are behind expected cohort progress.',
      estimatedTime: '90 minutes',
      expectedImpact: 6,
      confidence: 88,
      studentCount: behindCount,
      studentIds: [],
    });
  }

  if (aheadCount > 0) {
    interventions.push({
      id: 'intervention-peer-support',
      priority: 'LOW',
      title: 'Peer mentoring group',
      description: 'Use ahead learners to support on-track peers in guided review sessions.',
      estimatedTime: '1 hour',
      expectedImpact: 3,
      confidence: 79,
      studentCount: aheadCount,
      studentIds: [],
    });
  }

  return interventions.slice(0, 3);
};

const ALERT_ICONS: Record<string, AttentionItem['icon']> = {
  'alert-at-risk': AlertTriangle,
  'alert-weakest-course': TrendingDown,
  'alert-window': CalendarClock,
};

const PACING_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  Behind: { tone: 'amber', label: 'Behind' },
  'On Pace': { tone: 'green', label: 'On pace' },
  Ahead: { tone: 'blue', label: 'Ahead' },
};

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);

  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [cohortReport, setCohortReport] = useState<CohortMetricsReport | null>(null);
  const [isCohortLoading, setIsCohortLoading] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsCatalogLoading(true);
    setCatalogError(null);

    academyStudioBackend
      .loadCatalogSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setCohorts(snapshot.cohorts);
        setCourses(snapshot.courses);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load faculty dashboard catalog:', error);
        setCatalogError(
          error instanceof Error ? error.message : 'Unable to load cohorts.',
        );
      })
      .finally(() => {
        if (!active) return;
        setIsCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cohorts.length) {
      setSelectedCohortId(null);
      return;
    }

    if (
      !selectedCohortId ||
      !cohorts.some((cohort) => cohort.id === selectedCohortId)
    ) {
      setSelectedCohortId(cohorts[0].id);
    }
  }, [cohorts, selectedCohortId]);

  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === selectedCohortId) || null,
    [cohorts, selectedCohortId],
  );

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

  const courseMastery = useMemo(
    () =>
      (cohortReport?.courses || [])
        .map((course) => ({
          system: course.courseTitle,
          mastery: formatScore(course.metrics.mastery),
        }))
        .sort((left, right) => left.mastery - right.mastery),
    [cohortReport],
  );

  const readinessDistribution = useMemo(() => {
    if (!cohortReport) return emptyDistribution;

    const distribution = buildReadinessDistribution(cohortReport);
    if (!showAtRiskOnly) return distribution;
    return distribution.filter(
      (entry) => entry.range === 'Low' || entry.range === 'Critical',
    );
  }, [cohortReport, showAtRiskOnly]);

  const alerts = useMemo(
    () => (cohortReport ? buildAlerts(cohortReport, courseMastery) : []),
    [cohortReport, courseMastery],
  );

  const interventions = useMemo(
    () =>
      cohortReport ? buildInterventions(cohortReport, courseMastery) : [],
    [cohortReport, courseMastery],
  );

  const analytics = useMemo(() => {
    if (!cohortReport) {
      return {
        avgReadiness: 0,
        atRiskCount: 0,
        avgPacing: 0,
        avgCoverage: 0,
      };
    }

    return {
      avgReadiness: formatScore(cohortReport.metrics.readiness),
      atRiskCount: cohortReport.atRiskCount || 0,
      avgPacing: cohortReport.metrics.pacing,
      avgCoverage: formatScore(cohortReport.metrics.coverage),
    };
  }, [cohortReport]);

  // Courses with AI-suggested objectives waiting for review, most first.
  const coursesToReview = useMemo(
    () =>
      courses
        .filter((course) => getCoursePendingSuggestionCount(course) > 0)
        .sort(
          (left, right) =>
            getCoursePendingSuggestionCount(right) - getCoursePendingSuggestionCount(left),
        ),
    [courses],
  );

  const weakestCourse = courseMastery[0] || null;
  const strongestCourse = courseMastery.length > 1 ? courseMastery[courseMastery.length - 1] : null;
  const actionableAlerts = alerts.filter((alert) => alert.id !== 'alert-clear');
  const courseReviewImpact = interventions.find(
    (intervention) => intervention.id === 'intervention-course-review',
  )?.expectedImpact;

  const handleExportReport = () => {
    if (!selectedCohort || !cohortReport || typeof window === 'undefined') return;

    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            cohort: {
              id: selectedCohort.id,
              title: selectedCohort.title,
              term: selectedCohort.term,
            },
            cohortMetrics: cohortReport,
            courseMastery,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );

    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${getIdSuffix(selectedCohort.id)}-faculty-report.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleLaunchAnalytics = () => {
    if (!selectedCohort) return;
    navigate(
      `/mastery/cohorts/${encodeURIComponent(getIdSuffix(selectedCohort.id))}`,
    );
  };

  const handleOpenInterventions = () => {
    handleLaunchAnalytics();
  };

  const handleSendResources = () => {
    navigate('/curricula');
  };

  const handleReviewCourse = (course: TeacherCourse) => {
    navigate(`/courses?courseId=${encodeURIComponent(course.id)}&tab=objectives`);
  };

  // --- Needs attention -------------------------------------------------------
  const attentionItems: AttentionItem[] = (() => {
    if (!cohortReport) return [];
    const items: AttentionItem[] = [];

    if (cohortReport.learnerCount === 0) {
      items.push({
        id: 'no-learners',
        priority: 'MEDIUM',
        icon: UserPlus,
        title: 'No learners in this cohort yet',
        detail: 'Add learners so readiness, pacing and coverage can be measured.',
        actionLabel: 'Add learners',
        onSelect: () => navigate('/cohorts'),
      });
    }

    actionableAlerts.forEach((alert) => {
      items.push({
        id: alert.id,
        priority: alert.priority,
        icon: ALERT_ICONS[alert.id] ?? AlertTriangle,
        title: alert.title,
        detail: alert.description,
        actionLabel: alert.suggestedAction ?? 'Open in Mastery',
        onSelect: handleOpenInterventions,
      });
    });

    const peerSupport = interventions.find(
      (intervention) => intervention.id === 'intervention-peer-support',
    );
    if (peerSupport) {
      items.push({
        id: peerSupport.id,
        priority: peerSupport.priority,
        icon: UsersRound,
        title: `${plural(peerSupport.studentCount, 'learner')} ahead of pace`,
        detail: `${peerSupport.title}: ${peerSupport.description.charAt(0).toLowerCase()}${peerSupport.description.slice(1)}`,
        actionLabel: 'See learners',
        onSelect: handleOpenInterventions,
      });
    }

    coursesToReview.slice(0, MAX_REVIEW_ROWS).forEach((course) => {
      const pending = getCoursePendingSuggestionCount(course);
      items.push({
        id: `review-${course.id}`,
        priority: 'MEDIUM',
        icon: Sparkles,
        title: `Review ${plural(pending, 'suggested objective')} in ${course.title}`,
        detail: 'AI proposed these from your sources. Nothing is added to the course until you accept it.',
        actionLabel: 'Review',
        onSelect: () => handleReviewCourse(course),
      });
    });

    const remainingReviews = coursesToReview.length - MAX_REVIEW_ROWS;
    if (remainingReviews > 0) {
      items.push({
        id: 'review-more',
        priority: 'MEDIUM',
        icon: BookOpen,
        title: `${plural(remainingReviews, 'more course')} with suggestions to review`,
        detail: 'Filter Courses by "Needs review" to work through them.',
        actionLabel: 'Open courses',
        onSelect: () => navigate('/courses'),
      });
    }

    return sortByPriority(items);
  })();

  const highPriorityCount = attentionItems.filter((item) => item.priority === 'HIGH').length;

  // --- Page states ------------------------------------------------------------
  const header = (
    <PageHeader
      title="Dashboard"
      description="How your cohort is progressing, and what needs your attention."
      actions={
        cohorts.length > 0 ? (
          <>
            <label className="flex items-center gap-2">
              <span className="text-[13px] text-stone-500">Cohort</span>
              <span className="block w-52 sm:w-60">
                <Select
                  value={selectedCohortId ?? ''}
                  onChange={(event) => setSelectedCohortId(event.target.value)}
                >
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.title}
                    </option>
                  ))}
                </Select>
              </span>
            </label>
            <Button
              icon={Download}
              onClick={handleExportReport}
              disabled={!cohortReport}
              title="Download this cohort's metrics as JSON"
            >
              Export
            </Button>
            <Button
              variant="primary"
              icon={BarChart3}
              onClick={handleLaunchAnalytics}
              disabled={!selectedCohort}
            >
              Open in Mastery
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (isCatalogLoading && cohorts.length === 0) {
    return (
      <>
        {header}
        <Spinner label="Loading dashboard…" className="py-24" />
      </>
    );
  }

  if (!selectedCohort) {
    // Cohorts arrived but the selection effect hasn't run yet.
    if (cohorts.length > 0) {
      return (
        <>
          {header}
          <Spinner label="Loading dashboard…" className="py-24" />
        </>
      );
    }
    return (
      <>
        {header}
        {catalogError ? (
          <InlineAlert className="mt-6" title="Couldn't load cohorts">
            {catalogError}
          </InlineAlert>
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No cohorts yet"
            description="Create a cohort and add learners to see their readiness, pacing and coverage here."
            action={
              <Button variant="primary" onClick={() => navigate('/cohorts')}>
                Go to cohorts
              </Button>
            }
          />
        )}
      </>
    );
  }

  const learnerCount = cohortReport?.learnerCount ?? selectedCohort.studentIds.length;
  const courseCount = cohortReport?.courses.length ?? selectedCohort.courseIds.length;
  const reportWindow = cohortReport?.window;
  const cohortFacts = [
    selectedCohort.term,
    plural(learnerCount, 'learner'),
    plural(courseCount, 'course'),
    reportWindow
      ? reportWindow.startsAt && reportWindow.endsAt
        ? `${Math.round(Math.min(Math.max(reportWindow.elapsedFraction, 0), 1) * 100)}% of the term elapsed`
        : 'No term dates set'
      : null,
  ].filter(Boolean);

  const renderBody = () => {
    if (!cohortReport) {
      // A failed load is explained by the alert above; otherwise it's still loading.
      if (cohortError && !isCohortLoading) return null;
      return <Spinner label="Loading cohort metrics…" className="py-24" />;
    }

    const status = cohortReport.statusDistribution;
    const behind = status.behind || 0;
    const onTrack = status.on_track || 0;
    const ahead = status.ahead || 0;
    const pacingStatus =
      learnerCount > 0 && Number.isFinite(analytics.avgPacing)
        ? PACING_BADGE[getTAPRStatus(analytics.avgPacing).label]
        : undefined;
    const atRiskShare =
      learnerCount > 0 ? Math.round((analytics.atRiskCount / learnerCount) * 100) : 0;
    const objectivesInScope = cohortReport.universe.los;

    const bands = cohortReport.readinessDistribution;
    const bandTotal = bands.high + bands.medium + bands.low + bands.critical;
    const lowBands = bands.low + bands.critical;
    const readinessTakeaway =
      bandTotal === 0
        ? 'No readiness data for this cohort yet.'
        : lowBands === 0
          ? `All ${plural(bandTotal, 'learner')} are in the medium or high band.`
          : `${lowBands.toLocaleString()} of ${plural(bandTotal, 'learner')} ${lowBands === 1 ? 'is' : 'are'} in the low or critical band.`;

    const courseTakeaway = weakestCourse
      ? strongestCourse
        ? `${weakestCourse.system} is lowest at ${weakestCourse.mastery}%; ${strongestCourse.system} is highest at ${strongestCourse.mastery}%.`
        : `${weakestCourse.system} is at ${weakestCourse.mastery}% average mastery.`
      : 'Average mastery per course appears once learners answer items.';

    return (
      <div className="mt-6 space-y-6">
        <dl aria-label="Cohort summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Readiness"
            icon={Target}
            value={`${analytics.avgReadiness}%`}
            context="Cohort average, projected for USMLE Step 1"
          >
            <ProgressBar value={analytics.avgReadiness} max={100} label="Average readiness" />
          </KpiTile>
          <KpiTile
            label="At risk"
            icon={AlertTriangle}
            attention={analytics.atRiskCount > 0}
            value={analytics.atRiskCount.toLocaleString()}
            context={
              learnerCount > 0
                ? `${atRiskShare}% of ${plural(learnerCount, 'learner')}`
                : 'No learners yet'
            }
          >
            <ProgressBar
              value={analytics.atRiskCount}
              max={learnerCount}
              tone="amber"
              label="Share of learners at risk"
            />
          </KpiTile>
          <KpiTile
            label="Pacing"
            icon={Gauge}
            value={formatPacing(analytics.avgPacing)}
            status={
              pacingStatus && <Badge tone={pacingStatus.tone}>{pacingStatus.label}</Badge>
            }
            context={`${behind.toLocaleString()} behind · ${onTrack.toLocaleString()} on track · ${ahead.toLocaleString()} ahead`}
          >
            <SegmentBar
              segments={[
                { key: 'behind', value: behind, className: 'bg-amber-500' },
                { key: 'on-track', value: onTrack, className: 'bg-brand-500' },
                { key: 'ahead', value: ahead, className: 'bg-sky-500' },
              ]}
            />
          </KpiTile>
          <KpiTile
            label="Coverage"
            icon={ListChecks}
            value={`${analytics.avgCoverage}%`}
            context={
              objectivesInScope > 0
                ? `Of ${plural(objectivesInScope, 'learning objective')} in scope`
                : 'Curriculum completed'
            }
          >
            <ProgressBar value={analytics.avgCoverage} max={100} label="Average coverage" />
          </KpiTile>
        </dl>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <DashboardPanel
            title="Needs attention"
            description="Flags from this cohort's readiness and pacing, plus course work waiting on you."
            meta={
              highPriorityCount > 0 ? (
                <Badge tone="red" dot>
                  {highPriorityCount} high priority
                </Badge>
              ) : attentionItems.length > 0 ? (
                <span className="text-[13px] tabular-nums text-stone-500">
                  {attentionItems.length}
                </span>
              ) : null
            }
            flush
            footer={
              <button
                type="button"
                onClick={handleSendResources}
                className="group inline-flex items-center gap-1.5 rounded text-sm font-medium text-stone-700 transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <Library size={15} className="text-stone-400" aria-hidden="true" />
                Share study materials from Curricula
                <ArrowRight
                  size={15}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            }
          >
            <NeedsAttentionList
              items={attentionItems}
              empty={
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="Nothing needs your attention"
                  description="This cohort has no readiness or pacing flags right now. Monitoring continues as new mastery data arrives."
                />
              }
            />
          </DashboardPanel>

          <DashboardPanel
            title="Readiness distribution"
            description={readinessTakeaway}
            actions={
              <SegmentedControl<ReadinessFilter>
                label="Readiness bands shown"
                size="sm"
                value={showAtRiskOnly ? 'at-risk' : 'all'}
                onChange={(value) => setShowAtRiskOnly(value === 'at-risk')}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'at-risk', label: 'At risk', count: lowBands },
                ]}
              />
            }
          >
            <CohortRiskChart data={readinessDistribution} height={240} />
          </DashboardPanel>
        </div>

        <DashboardPanel
          title="Course mastery"
          description={courseTakeaway}
          footer={
            weakestCourse ? (
              <div className="flex items-start gap-3">
                <span className="bg-ai-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white">
                  <Sparkles size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-500">Sina insight</p>
                  <p className="mt-0.5 text-sm leading-6 text-stone-700">
                    This cohort would benefit from a focused{' '}
                    <span className="font-medium text-stone-900">
                      {weakestCourse.system} workshop
                    </span>
                    .
                    {courseReviewImpact !== undefined && (
                      <>
                        {' '}
                        Estimated impact:{' '}
                        <span className="font-medium tabular-nums text-brand-700">
                          +{courseReviewImpact}% readiness
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : undefined
          }
        >
          {courseMastery.length > 0 ? (
            <div
              role="img"
              aria-label={`Average mastery by course: ${courseMastery
                .map((course) => `${course.system} ${course.mastery}%`)
                .join(', ')}`}
            >
              <SystemMasteryChart data={courseMastery} />
            </div>
          ) : (
            <EmptyState
              compact
              icon={BookOpen}
              title="No course mastery yet"
              description="Each course in this cohort appears here once its learners start answering items."
            />
          )}
        </DashboardPanel>
      </div>
    );
  };

  return (
    <>
      {header}

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-stone-500">
        <UsersRound size={14} className="text-stone-400" aria-hidden="true" />
        <span className="sr-only">{selectedCohort.title}: </span>
        {cohortFacts.join(' · ')}
      </p>

      {(catalogError || cohortError) && (
        <div className="mt-6 space-y-3">
          {catalogError && (
            <InlineAlert tone="warning" title="Some workspace data didn't load">
              {catalogError}
            </InlineAlert>
          )}
          {cohortError && (
            <InlineAlert title="Couldn't load cohort metrics">{cohortError}</InlineAlert>
          )}
        </div>
      )}

      {renderBody()}
    </>
  );
};

export default FacultyDashboard;
