import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ReadinessGauge } from '@/components/student_mastery/ReadinessGauge';
import { cohortMetricsService } from '@/services/cohortMetricsService';
import type {
  CohortLearnerMetricsPage,
  CohortMetricsLearnerSummary,
  CohortMetricsReport,
  CohortMetricsStatus,
} from '@/types/CohortMetricsTypes';

const LEARNERS_PAGE_SIZE = 50;
import { useMasteryContext } from './MasteryLayout';
import {
  StatusBadge,
  MasteryLoadingView,
  findCohortByRouteId,
  formatPacing,
  formatPercent,
  formatScore,
  getCohortIdentifier,
  getIdSuffix,
  statusMeta,
} from './masteryShared';

const MasteryCohortView: React.FC = () => {
  const { cohortId: cohortRouteId } = useParams();
  const navigate = useNavigate();
  const { cohorts } = useMasteryContext();

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

  const handleLearnerSelect = (learner: CohortMetricsLearnerSummary) => {
    if (!selectedCohort) return;
    const learnerSuffix = getIdSuffix(learner.userId);
    const defaultCourseId = cohortReport?.courses?.[0]?.courseId;
    const courseQuery = defaultCourseId
      ? `?courseId=${encodeURIComponent(getIdSuffix(defaultCourseId))}`
      : '';
    navigate(
      `/mastery/cohorts/${encodeURIComponent(
        getIdSuffix(selectedCohort.id),
      )}/learners/${encodeURIComponent(learnerSuffix)}${courseQuery}`,
    );
  };

  if (!selectedCohort) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
        Cohort not found. Pick one from the sidebar.
      </div>
    );
  }

  if (isCohortLoading && !cohortReport) {
    return <MasteryLoadingView />;
  }

  const heroMetrics = cohortReport?.metrics;
  const statusDistribution = cohortReport?.statusDistribution;

  return (
    <>
      {cohortError && (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm flex items-center gap-3">
          <AlertTriangle size={16} />
          {cohortError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-slate-900 rounded-[2.5rem] px-5 py-6 sm:px-6 sm:py-7 text-white relative overflow-hidden min-h-[240px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(27,209,131,0.12),_transparent_35%)] pointer-events-none" />
          <div className="relative z-10 flex h-full items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Cohort Readiness
              </p>
              <ReadinessGauge
                value={formatScore(heroMetrics?.readiness ?? 0)}
                size="medium"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1BD183]/5 text-[#1BD183] rounded-xl">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                Cohort Status
              </h3>
            </div>
          </div>

          {isCohortLoading && (
            <p className="text-xs text-slate-400">Loading cohort metrics…</p>
          )}

          {statusDistribution && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(['behind', 'on_track', 'ahead'] as CohortMetricsStatus[]).map(
                (status) => {
                  const meta = statusMeta[status];
                  return (
                    <div
                      key={status}
                      className={`rounded-2xl border border-slate-200 ${meta.pillBg} p-4`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-2xl font-black text-slate-900">
                        {statusDistribution[status] || 0}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {cohortReport?.window && (
            <div className="mt-auto text-xs text-slate-500 flex flex-wrap gap-x-6 gap-y-2">
              {cohortReport.window.startsAt && cohortReport.window.endsAt ? (
                <>
                  <span>
                    <strong className="text-slate-800">
                      {cohortReport.window.daysRemaining}d
                    </strong>{' '}
                    remaining
                  </span>
                  <span>
                    <strong className="text-slate-800">
                      {cohortReport.window.expectedLOsCovered.toFixed(1)}
                    </strong>{' '}
                    LOs expected by now
                  </span>
                  <span>
                    {(cohortReport.window.elapsedFraction * 100).toFixed(0)}%
                    of window elapsed
                  </span>
                </>
              ) : (
                <span>No deadline set for this cohort.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {cohortReport && cohortReport.courses.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <BookOpen size={20} className="text-[#1BD183]" />
                Courses
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {cohortReport.courses.length} courses in this cohort.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-5 min-w-[240px]">Course</th>
                  <th className="px-6 py-5 text-center min-w-[120px]">
                    Readiness
                  </th>
                  <th className="px-6 py-5 text-center min-w-[120px]">
                    Mastery
                  </th>
                  <th className="px-6 py-5 text-center min-w-[120px]">
                    Coverage
                  </th>
                  <th className="px-6 py-5 text-center min-w-[120px]">
                    Pacing
                  </th>
                  <th className="px-6 py-5 text-center min-w-[100px]">LOs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cohortReport.courses.map((course) => (
                  <tr key={course.courseId} className="hover:bg-slate-50">
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900 text-sm">
                        {course.courseTitle}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-lg font-black text-slate-900">
                        {formatPercent(course.metrics.readiness)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                      {formatPercent(course.metrics.mastery)}
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                      {formatPercent(course.metrics.coverage)}
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                      {formatPacing(course.metrics.pacing)}
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                      {course.universe.los}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Zap size={20} className="text-[#1BD183]" />
              Learners
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {cohortReport
                ? `${cohortReport.learnerCount} learners enrolled`
                : 'Loading…'}
            </p>
          </div>
        </div>

        {learnersError && (
          <div className="px-8 py-3 text-xs font-semibold text-rose-700 bg-rose-50 border-b border-rose-100">
            {learnersError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-20 shadow-sm">
                <th className="px-6 py-5 min-w-[240px]">Learner</th>
                <th className="px-6 py-5 text-center min-w-[140px]">
                  Readiness
                </th>
                <th className="px-6 py-5 text-center min-w-[120px]">
                  Mastery
                </th>
                <th className="px-6 py-5 text-center min-w-[120px]">
                  Coverage
                </th>
                <th className="px-6 py-5 text-center min-w-[120px]">Pacing</th>
                <th className="px-6 py-5 text-center min-w-[120px]">Status</th>
                <th className="px-6 py-5 text-right w-16">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!learnersPage && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-slate-400"
                  >
                    {isLearnersLoading
                      ? 'Loading learners…'
                      : 'No learner data available.'}
                  </td>
                </tr>
              )}
              {learnersPage?.items.map((learner) => (
                <tr
                  key={learner.userId}
                  onClick={() => handleLearnerSelect(learner)}
                  className="hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">
                        {learner.name
                          .split(' ')
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm group-hover:text-[#1BD183] transition-colors">
                          {learner.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {getIdSuffix(learner.userId)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span
                      className={`text-lg font-black ${
                        learner.metrics.readiness < 0.6
                          ? 'text-rose-500'
                          : learner.metrics.readiness < 0.8
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                      }`}
                    >
                      {formatPercent(learner.metrics.readiness)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                    {formatPercent(learner.metrics.mastery)}
                  </td>
                  <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                    {formatPercent(learner.metrics.coverage)}
                  </td>
                  <td className="px-6 py-5 text-center text-xs font-bold text-slate-700">
                    {formatPacing(learner.metrics.pacing)}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <StatusBadge status={learner.status} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 text-slate-300 group-hover:text-[#1BD183] group-hover:bg-[#1BD183]/10 rounded-xl transition-all">
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {learnersPage && learnersPage.total > LEARNERS_PAGE_SIZE && (
          <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              Page {learnersPage.page} of{' '}
              {Math.max(1, Math.ceil(learnersPage.total / learnersPage.limit))}
              {' · '}
              {learnersPage.total} learners
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setLearnersPageIndex((index) => Math.max(1, index - 1))
                }
                disabled={learnersPage.page <= 1 || isLearnersLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setLearnersPageIndex((index) => index + 1)}
                disabled={
                  learnersPage.page * learnersPage.limit >=
                    learnersPage.total || isLearnersLoading
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MasteryCohortView;
