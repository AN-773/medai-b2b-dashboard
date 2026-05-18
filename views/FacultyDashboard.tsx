import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Brain,
  Calendar,
  Clock,
  Clock as ClockIcon,
  Download,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CohortRiskChart } from '@/components/student_mastery/CohortRiskChart';
import { SystemMasteryChart } from '@/components/student_mastery/SystemMasteryChart';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { cohortMetricsService } from '@/services/cohortMetricsService';
import type { TeacherCohort } from '@/types/AcademyStudioTypes';
import type { CohortMetricsReport } from '@/types/CohortMetricsTypes';
import type { FacultyAlert, Intervention } from '@/types';
import {
  formatPacing,
  formatScore,
  getCohortIdentifier,
  getIdSuffix,
} from './mastery/masteryShared';

type FacultyView = 'OVERVIEW' | 'INTERVENTIONS';
type TimeRange = 'WEEK' | 'MONTH' | 'SEMESTER' | 'YEAR';

type ReadinessDistributionEntry = {
  range: string;
  count: number;
};

type CourseMasteryEntry = {
  system: string;
  mastery: number;
};

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

const buildTimeSavings = (learnerCount: number, atRiskCount: number) => {
  const traditionalTime = learnerCount * 0.5;
  const assistedTime =
    atRiskCount * (5 / 60) + Math.max(learnerCount - atRiskCount, 0) * (2 / 60);
  const weeklySavings = Math.max(traditionalTime - assistedTime, 0);

  return {
    hoursThisWeek: Math.round(weeklySavings * 5),
    hoursThisMonth: Math.round(weeklySavings * 20),
    efficiencyGain: Math.round(
      ((traditionalTime - assistedTime) / (traditionalTime || 1)) * 100,
    ),
  };
};

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
      title: `${behindCount} Students At Risk`,
      description: `${Math.round((behindCount / Math.max(report.learnerCount, 1)) * 100)}% of the cohort is currently behind pacing expectations.`,
      priority: behindCount / Math.max(report.learnerCount, 1) >= 0.25 ? 'HIGH' : 'MEDIUM',
      timeAgo: 'Live',
      suggestedAction: 'Review intervention queue',
    });
  }

  if (weakestCourse) {
    alerts.push({
      id: 'alert-weakest-course',
      title: `${weakestCourse.system} Weakness Detected`,
      description: `Average mastery in ${weakestCourse.system} is ${weakestCourse.mastery}%.`,
      priority: weakestCourse.mastery < 60 ? 'HIGH' : 'MEDIUM',
      timeAgo: 'Live',
      suggestedAction: `Schedule ${weakestCourse.system} review`,
    });
  }

  if (report.window.daysRemaining > 0) {
    alerts.push({
      id: 'alert-window',
      title: `${report.window.daysRemaining} Days Remaining`,
      description: `${report.window.expectedLOsCovered.toFixed(0)} learning objectives should be covered by now to stay on pace.`,
      priority: report.window.daysRemaining <= 14 ? 'HIGH' : 'LOW',
      timeAgo: 'Live',
      suggestedAction: 'Align pacing plan',
    });
  }

  if (alerts.length > 0) return alerts;

  return [
    {
      id: 'alert-clear',
      title: 'No Priority Alerts',
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
      title: `${weakestCourse.system} Review Session`,
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
      title: 'Pacing Reset Session',
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
      title: 'Peer Mentoring Group',
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

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<FacultyView>('OVERVIEW');
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('SEMESTER');
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);

  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
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

  const timeSavings = useMemo(
    () =>
      buildTimeSavings(
        cohortReport?.learnerCount || selectedCohort?.studentIds.length || 0,
        cohortReport?.atRiskCount || 0,
      ),
    [cohortReport, selectedCohort],
  );

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

  const selectedCohortName = selectedCohort?.title || 'No cohort selected';
  const selectedCohortMeta = selectedCohort?.term || `${cohortReport?.learnerCount || 0} learners`;
  const weakestCourse = courseMastery[0] || null;

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

  const HeaderNavigation = () => (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6">
            <div className="flex items-center justify-between xl:justify-start gap-2 p-1.5 bg-white rounded-[2.5rem] w-full xl:w-fit overflow-x-auto no-scrollbar">
              {[
                { id: 'OVERVIEW' as const, icon: BarChart3, label: 'Overview' },
                {
                  id: 'INTERVENTIONS' as const,
                  icon: Brain,
                  label: 'Interventions',
                },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveView(type.id);
                  }}
                  className={`flex-1 xl:flex-none flex items-center justify-center gap-2 xl:gap-3 px-4 xl:px-8 py-3 xl:py-3.5 rounded-[2rem] text-[10px] xl:text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeView === type.id ? 'bg-[#1BD183] text-white shadow-md shadow-[#1BD183]/20' : 'text-slate-500 hover:bg-slate-300/50'}`}
                >
                  <type.icon size={14} />
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleExportReport}
            disabled={!cohortReport}
            className="w-full xl:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#191A19] border border-slate-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2a2b2a] shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Download size={14} />
            Export Report
          </button>
        </div>
      </div>
    </div>
  );

  const CohortSelector = () => (
    <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
          Cohort Management
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Time Range:
          </span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#1BD183]"
          >
            <option value="WEEK">This Week</option>
            <option value="MONTH">This Month</option>
            <option value="SEMESTER">This Semester</option>
            <option value="YEAR">This Year</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {cohorts.map((cohort) => (
              <button
                key={cohort.id}
                onClick={() => setSelectedCohortId(cohort.id)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedCohortId === cohort.id
                    ? 'bg-[#1BD183]/10 border-[#1BD183] shadow-sm ring-2 ring-[#1BD183]/20'
                    : 'bg-white border-slate-200 hover:border-[#1BD183]/30 hover:shadow-sm'
                }`}
              >
                <div
                  className={`font-black text-sm mb-1 ${selectedCohortId === cohort.id ? 'text-[#1BD183]' : 'text-slate-700'}`}
                >
                  {cohort.title}
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Calendar size={12} />
                  {cohortReport && selectedCohortId === cohort.id
                    ? cohortReport.learnerCount
                    : cohort.studentIds.length}{' '}
                  learners
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-72 space-y-3">
          <div className="bg-slate-900 rounded-2xl p-5 text-white flex justify-between items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Active View
              </div>
              <div className="font-bold text-lg">{selectedCohortName}</div>
              <div className="text-xs text-slate-400 mt-1">{selectedCohortMeta}</div>
            </div>
            <Users className="text-[#1BD183]" />
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex justify-between items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                Faculty Time Saved
              </div>
              <div className="font-black text-lg text-emerald-800">
                {timeSavings.hoursThisWeek}h{' '}
                <span className="text-xs font-medium opacity-70">
                  this week
                </span>
              </div>
            </div>
            <Clock className="text-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );

  const OverviewDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Cohort Readiness"
          value={`${analytics.avgReadiness}%`}
          icon={<Target className="text-[#1BD183]" size={24} />}
          color="emerald"
          subtitle="USMLE Step 1 Projection"
        />
        <MetricCard
          title="At Risk Students"
          value={analytics.atRiskCount}
          icon={<AlertTriangle className="text-rose-600" size={24} />}
          color="rose"
          subtitle="Early detection rate"
        />
        <MetricCard
          title="Avg TAPR"
          value={formatPacing(analytics.avgPacing)}
          icon={<Clock className="text-amber-600" size={24} />}
          color="amber"
          subtitle="Pacing velocity"
        />
        <MetricCard
          title="Coverage"
          value={`${analytics.avgCoverage}%`}
          icon={<Activity className="text-emerald-600" size={24} />}
          color="emerald"
          subtitle="Curriculum completion"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-slate-900 uppercase tracking-tight">
              Readiness Distribution
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  showAtRiskOnly
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {showAtRiskOnly ? 'Show All' : 'Filter At Risk'}
              </button>
            </div>
          </div>
          <CohortRiskChart data={readinessDistribution} />
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-slate-900 uppercase tracking-tight">
              Courses Mastery
            </h4>
            <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-lg">
              Weakest:{' '}
              <span className="text-rose-600 font-black">
                {weakestCourse?.system || 'No data'}
              </span>
            </div>
          </div>
          {courseMastery.length > 0 ? (
            <SystemMasteryChart data={courseMastery} />
          ) : (
            <div className="min-h-[250px] flex items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400">
              No course mastery data
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm h-full">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-slate-900 uppercase tracking-tight">
              Priority Alerts
            </h4>
            <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
              {alerts.filter((alert) => alert.priority === 'HIGH').length} Critical
            </span>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border-l-4 transition-all hover:translate-x-1 ${
                  alert.priority === 'HIGH'
                    ? 'border-l-rose-500 bg-rose-50'
                    : alert.priority === 'MEDIUM'
                      ? 'border-l-amber-500 bg-amber-50'
                      : 'border-l-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900 mb-1 text-sm">
                      {alert.title}
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                      {alert.description}
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {alert.timeAgo}
                  </div>
                </div>
                {alert.suggestedAction && (
                  <div className="mt-3 pt-3 border-t border-black/5">
                    <button className="text-[10px] font-black uppercase tracking-widest text-[#1BD183] hover:text-[#1BD183]/80 flex items-center gap-1">
                      {alert.suggestedAction} <ArrowRightLeft size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-black text-slate-900 uppercase tracking-tight">
                Quick Actions
              </h4>
              <RefreshCw size={18} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-5 bg-[#1BD183]/10 text-[#1BD183] rounded-2xl hover:bg-[#1BD183]/20 transition-colors text-left group">
                <div className="font-black text-sm mb-1 group-hover:translate-x-1 transition-transform">
                  Schedule Review
                </div>
                <div className="text-[10px] font-medium opacity-70">
                  Meet with at-risk students
                </div>
              </button>
              <button className="p-5 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition-colors text-left group">
                <div className="font-black text-sm mb-1 group-hover:translate-x-1 transition-transform">
                  Send Resources
                </div>
                <div className="text-[10px] font-medium opacity-70">
                  Share study materials
                </div>
              </button>
              <button
                onClick={handleLaunchAnalytics}
                className="p-5 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 transition-colors text-left group col-span-2"
              >
                <div className="font-black text-sm mb-1 group-hover:translate-x-1 transition-transform flex items-center gap-2">
                  <BarChart3 size={16} /> Launch Deep Analytics
                </div>
                <div className="text-[10px] font-medium opacity-70">
                  Open full student mastery dashboard
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-4 p-4 bg-slate-900 rounded-2xl text-white shadow-lg">
              <Brain className="text-[#1BD183] mt-1 shrink-0" size={24} />
              <div>
                <div className="font-black text-sm uppercase tracking-widest text-slate-400 mb-1">
                  Course Insight
                </div>
                <div className="text-sm font-medium leading-relaxed">
                  {weakestCourse ? (
                    <>
                      Cohort would benefit from a focused{' '}
                      <strong className="text-white">
                        {weakestCourse.system} review
                      </strong>
                      . Estimated impact:{' '}
                      <span className="text-emerald-400 font-bold">
                        +{Math.max(4, Math.round((80 - weakestCourse.mastery) / 3))}% readiness
                      </span>
                      .
                    </>
                  ) : (
                    'Course-level insight will appear once detailed cohort metrics are available.'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const InterventionsView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Intervention Queue
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Course-recommended actions prioritized by impact
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-200">
              {interventions.filter((intervention) => intervention.priority === 'HIGH').length}{' '}
              Critical
            </span>
            <button className="px-5 py-2.5 bg-[#1BD183] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1BD183]/90 transition shadow-lg shadow-[#1BD183]/20 flex items-center gap-2 active:scale-95">
              <Plus size={14} />
              Add Custom
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {interventions.map((intervention) => (
            <div
              key={intervention.id}
              className="p-6 border border-slate-200 rounded-[1.5rem] hover:border-emerald-200 hover:shadow-md transition-all group bg-white"
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        intervention.priority === 'HIGH'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : intervention.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {intervention.priority} PRIORITY
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Targets {intervention.studentCount} students
                    </div>
                  </div>

                  <h4 className="font-black text-slate-900 text-lg mb-2">
                    {intervention.title}
                  </h4>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mb-4 max-w-2xl">
                    {intervention.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <ClockIcon size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">
                        {intervention.estimatedTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-500" />
                      <span className="text-xs font-black text-emerald-600 uppercase tracking-wide">
                        +{intervention.expectedImpact}% readiness
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Brain size={14} className="text-[#1BD183]" />
                      <span className="text-xs font-black text-[#1BD183] uppercase tracking-wide">
                        Confidence: {intervention.confidence}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-lg">
                    Implement
                  </button>
                  <button className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition">
                    Schedule
                  </button>
                </div>
              </div>

            </div>
          ))}

          {interventions.length === 0 && (
            <div className="p-8 text-center text-sm font-medium text-slate-500 bg-slate-50 rounded-[1.5rem]">
              No intervention recommendations available for this cohort yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="font-black text-slate-900 uppercase tracking-tight mb-6">
            Intervention History
          </h4>
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    {alert.title}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    {alert.timeAgo}
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                  {alert.priority}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="font-black text-slate-900 uppercase tracking-tight mb-6">
            Intervention Simulator
          </h4>
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Select Intervention Type
              </label>
              <select className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#1BD183]">
                {interventions.map((intervention) => (
                  <option key={intervention.id}>{intervention.title}</option>
                ))}
                {interventions.length === 0 && <option>Targeted Workshop</option>}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Expected Duration (hours)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                defaultValue="3"
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#1BD183]"
              />
            </div>
            <div className="p-5 bg-[#1BD183]/10 rounded-2xl border border-[#1BD183]/20 text-center">
              <div className="text-xs font-black text-[#1BD183] uppercase tracking-widest mb-1">
                Projection
              </div>
              <div className="text-2xl font-black text-[#1BD183]">
                +{interventions[0]?.expectedImpact || 0}% Readiness Impact
              </div>
              <div className="text-[10px] font-medium text-[#1BD183]/80 mt-2">
                Based on current cohort metrics and recommended interventions
              </div>
            </div>
            <button className="w-full py-4 bg-[#1BD183] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1BD183]/90 transition shadow-lg flex items-center justify-center gap-2">
              <Brain size={16} /> Simulate Impact
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isCatalogLoading && cohorts.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
        Loading faculty dashboard…
      </div>
    );
  }

  if (!selectedCohort) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
        No cohorts available yet.
      </div>
    );
  }

  return (
    <div>
      <HeaderNavigation />

      <div className="pt-6 space-y-6">
        {catalogError && (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800 shadow-sm">
            {catalogError}
          </div>
        )}

        {cohortError && (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm">
            {cohortError}
          </div>
        )}

        {isCohortLoading && (
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            Loading live cohort metrics…
          </div>
        )}

        <CohortSelector />

        <div className="mt-8">
          {activeView === 'OVERVIEW' && <OverviewDashboard />}
          {activeView === 'INTERVENTIONS' && <InterventionsView />}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  change,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: React.ReactNode;
  change?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'rose' | 'amber';
  subtitle?: string;
}) => {
  const colorClasses = {
    emerald: 'bg-[#1BD183]/10 text-[#1BD183]',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colorClasses[color]}`}>{icon}</div>
        {change && (
          <div
            className={`text-xs font-black px-2 py-1 rounded-lg ${
              change.startsWith('+')
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            {change}
          </div>
        )}
      </div>
      <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
      <div className="text-sm font-bold text-slate-700 uppercase tracking-tight">
        {title}
      </div>
      {subtitle && (
        <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default FacultyDashboard;
