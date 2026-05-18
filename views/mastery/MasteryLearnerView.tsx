import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell as PieCell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Calendar,
  Clock as ClockIcon,
  Layers,
  Zap,
} from 'lucide-react';
import { ReadinessGauge } from '@/components/student_mastery/ReadinessGauge';
import { SystemMasteryChart } from '@/components/student_mastery/SystemMasteryChart';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { cohortMetricsService } from '@/services/cohortMetricsService';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import type {
  CohortMetricsReport,
  LearnerMetricsReport,
} from '@/types/CohortMetricsTypes';
import {
  MASTERY_BUCKET_COLORS,
  MasteryLoadingView,
  StatusBadge,
  findCohortByRouteId,
  formatPacing,
  formatPercent,
  formatScore,
  getCohortIdentifier,
  getCourseIdentifier,
  getIdSuffix,
} from './masteryShared';

const MasteryLearnerView: React.FC = () => {
  const { cohortId: cohortRouteId, studentId: studentRouteId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseRouteId = searchParams.get('courseId');

  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  const [cohortReport, setCohortReport] = useState<CohortMetricsReport | null>(
    null,
  );
  const [isCohortLoading, setIsCohortLoading] = useState(false);

  const [learnerReport, setLearnerReport] =
    useState<LearnerMetricsReport | null>(null);
  const [isLearnerLoading, setIsLearnerLoading] = useState(false);
  const [learnerError, setLearnerError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsCatalogLoading(true);
    academyStudioBackend
      .loadCatalogSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setCohorts(snapshot.cohorts);
        setCourses(snapshot.courses);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load cohorts/courses:', error);
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
    setSearchParams(nextParams, { replace: true });
  }, [cohortReport, courseRouteId, searchParams, setSearchParams]);

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
    setSearchParams(nextParams);
  };

  const handleBackToCohort = () => {
    if (selectedCohort) {
      navigate(
        `/mastery/cohorts/${encodeURIComponent(getIdSuffix(selectedCohort.id))}`,
      );
    } else if (cohortRouteId) {
      navigate(`/mastery/cohorts/${encodeURIComponent(cohortRouteId)}`);
    } else {
      navigate('/mastery');
    }
  };

  const isBootstrapping =
    isCatalogLoading && cohorts.length === 0 && courses.length === 0;
  const isAwaitingCourse = Boolean(cohortReport && !matchedCourse);
  const showLoadingView =
    isBootstrapping ||
    ((isCohortLoading || isLearnerLoading || isAwaitingCourse) &&
      !learnerReport);

  if (showLoadingView) {
    return (
      <div>
        <MasteryLoadingView />
      </div>
    );
  }

  if (!selectedCohort || !studentRouteId) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
        Learner not found.{' '}
        <button
          className="text-[#1BD183] font-bold underline"
          onClick={() => navigate('/mastery')}
        >
          Back to cohorts
        </button>
      </div>
    );
  }

  const learnerName = studentRouteId;
  const status = learnerReport?.status || 'on_track';
  const masteryBuckets = learnerReport?.masteryDistribution;
  const masteryDonutData = masteryBuckets
    ? (Object.entries(masteryBuckets) as Array<[string, number]>)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => ({
          name: key === 'untouched' ? 'Untouched' : `${key}%`,
          bucket: key,
          value: count,
        }))
    : [];
  const perLOData =
    learnerReport?.loBreakdown.map((row) => ({
      system:
        row.loTitle.length > 28 ? `${row.loTitle.slice(0, 25)}…` : row.loTitle,
      mastery: row.touched ? Math.round(row.mastery * 100) : 0,
    })) || [];

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleBackToCohort}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group"
        >
          <ArrowLeft
            size={20}
            className="text-slate-400 group-hover:text-slate-900"
          />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-[#1BD183]/10 text-[#1BD183] rounded-lg text-[10px] font-black uppercase tracking-widest">
              {selectedCohort.title}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              ID: {studentRouteId}
            </span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {learnerName}
          </h2>
        </div>
      </div>

      {cohortReport && cohortReport.courses.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {cohortReport.courses.map((course) => {
            const courseSuffix = getIdSuffix(course.courseId);
            const isActive = courseSuffix === courseRouteId;
            return (
              <button
                key={course.courseId}
                type="button"
                onClick={() => handleCourseSelect(course.courseId)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#16324F] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {course.courseTitle}
              </button>
            );
          })}
        </div>
      )}

      {learnerError && (
        <div className="mb-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm flex items-center gap-3">
          <AlertTriangle size={16} />
          {learnerError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden flex flex-col items-center text-center">
            <h3 className="text-sm font-black text-[#1BD183] uppercase tracking-[0.2em] mb-6">
              Readiness
            </h3>
            <ReadinessGauge
              value={formatScore(learnerReport?.metrics.readiness ?? 0)}
              size="large"
            />
            <div className="mt-6">
              <StatusBadge status={status} />
            </div>
            <p className="mt-4 text-slate-400 text-xs font-medium max-w-[220px]">
              {matchedCourse ? (
                <>
                  Course: <br />
                  <strong className="text-white text-base">
                    {matchedCourse.courseTitle}
                  </strong>
                </>
              ) : (
                'Select a course tab above to inspect the learner detail.'
              )}
            </p>
          </div>

          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Activity size={16} className="text-rose-500" /> Engine Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-500">Pacing</span>
                <span className="text-xs font-black text-slate-800">
                  {formatPacing(learnerReport?.metrics.pacing ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500">
                    Curriculum Coverage
                  </span>
                  <span className="text-[9px] font-medium text-slate-400">
                    {learnerReport
                      ? `${learnerReport.progress.losTouched} / ${learnerReport.universe.los} LOs touched`
                      : 'Awaiting data'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1BD183]"
                      style={{
                        width: `${Math.min(100, formatScore(learnerReport?.metrics.coverage ?? 0))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-black text-[#1BD183]">
                    {formatPercent(learnerReport?.metrics.coverage ?? 0)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500">
                    Mastery
                  </span>
                  <span className="text-[9px] font-medium text-slate-400">
                    {learnerReport
                      ? `${learnerReport.progress.itemsCorrect} / ${learnerReport.progress.itemsAnswered} correct`
                      : 'Awaiting data'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.min(100, formatScore(learnerReport?.metrics.mastery ?? 0))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-black text-emerald-600">
                    {formatPercent(learnerReport?.metrics.mastery ?? 0)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <ClockIcon size={12} /> Days remaining
                </span>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800">
                    {learnerReport
                      ? `${learnerReport.window.daysRemaining}d`
                      : '—'}
                  </span>
                  <p className="text-[9px] text-slate-400">
                    {learnerReport
                      ? `${learnerReport.window.expectedLOsCovered.toFixed(1)} LOs expected by now`
                      : 'No window'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Learning Objectives
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
              Per-LO Mastery for this Course
            </p>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
            {isLearnerLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Loading learner metrics…
              </div>
            ) : perLOData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No learning objectives to display.
              </div>
            ) : (
              <SystemMasteryChart data={perLOData} />
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#1BD183] rounded-[2.5rem] p-10 text-white shadow-xl shadow-[#1BD183]/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap size={150} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight mb-2">
              Mastery Distribution
            </h3>
            <p className="text-white/80 text-xs font-medium mb-4 uppercase tracking-widest">
              LOs by Mastery Band
            </p>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              {masteryDonutData.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-white/70 text-xs">
                  {isLearnerLoading
                    ? 'Loading…'
                    : 'No data yet for this learner.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={masteryDonutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {masteryDonutData.map((entry) => (
                        <PieCell
                          key={entry.bucket}
                          fill={
                            MASTERY_BUCKET_COLORS[entry.bucket] || '#94a3b8'
                          }
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        color: '#0f172a',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold">
                {masteryBuckets &&
                  (Object.entries(masteryBuckets) as Array<
                    [string, number]
                  >).map(([key, count]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 text-white/90"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            MASTERY_BUCKET_COLORS[key] || '#94a3b8',
                        }}
                      />
                      <span className="uppercase tracking-widest">
                        {key === 'untouched' ? 'Untouched' : `${key}%`}
                      </span>
                      <span className="ml-auto">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-slate-500">Last answered</span>
                <span className="ml-auto text-slate-800 font-bold">
                  {learnerReport?.progress.lastAnsweredAt
                    ? new Date(
                        learnerReport.progress.lastAnsweredAt,
                      ).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <BarChart2 size={14} className="text-slate-400" />
                <span className="text-slate-500">Items answered</span>
                <span className="ml-auto text-slate-800 font-bold">
                  {learnerReport?.progress.itemsAnswered ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Layers size={14} className="text-slate-400" />
                <span className="text-slate-500">LOs in universe</span>
                <span className="ml-auto text-slate-800 font-bold">
                  {learnerReport?.universe.los ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasteryLearnerView;
