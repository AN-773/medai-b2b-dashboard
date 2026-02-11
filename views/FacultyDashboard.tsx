import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Activity,
  AlertTriangle,
  Brain,
  Clock,
  Calendar,
  GraduationCap,
  TrendingUp,
  Download,
  Settings,
  Plus,
  BarChart3,
  Users,
  RefreshCw,
  ArrowRightLeft,
  Clock as ClockIcon,
} from 'lucide-react';
import { MOCK_STUDENTS, MOCK_COHORTS } from '../constants';
import { FacultyAlert, SINACohort } from '../types';
import {
  generateFacultyAlerts,
  getFacultyTimeSavings,
  exportFacultyReport,
} from '../utils/facultyEngine';
import { CohortRiskChart } from '@/components/student_mastery/CohortRiskChart';
import { SystemMasteryChart } from '@/components/student_mastery/SystemMasteryChart';

type FacultyView = 'OVERVIEW' | 'INTERVENTIONS';
type TimeRange = 'WEEK' | 'MONTH' | 'SEMESTER' | 'YEAR';

interface FacultyDashboardProps {
  onNavigate?: (view, context?: any) => void;
}

const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const [activeView, setActiveView] = useState<FacultyView>('OVERVIEW');
  const [selectedCohortId, setSelectedCohortId] =
    useState<string>('COH-MS1-FALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('SEMESTER');
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  const [alerts, setAlerts] = useState<FacultyAlert[]>([]);

  // --- DATA PROCESSING via Static Mock (SSOT) ---
  const currentCohortDef = useMemo(
    () =>
      MOCK_COHORTS.find((c) => c.id === selectedCohortId) || MOCK_COHORTS[0],
    [selectedCohortId],
  );

  const cohortStudentsRaw = useMemo(
    () => MOCK_STUDENTS.filter((s) => s.cohortId === selectedCohortId),
    [selectedCohortId],
  );

  // Use static mock data to generate the unified SINACohort model
  const cohortData: SINACohort = useMemo(
    () => ({
      analytics: {
        avgReadiness: 72,
        readinessChange: '+4%',
        atRiskCount: 12,
        riskChange: '-2',
        avgTAPR: 85,
        taprChange: '+1.2',
        avgCoverage: 64,
        coverageChange: '+8%',
        readinessDistribution: [
          { range: 'High', count: 45 },
          { range: 'Medium', count: 30 },
          { range: 'Low', count: 12 },
          { range: 'Critical', count: 5 },
        ],
        systemMastery: [
          { system: 'Cardiovascular', mastery: 82 },
          { system: 'Respiratory', mastery: 78 },
          { system: 'Renal', mastery: 65 },
          { system: 'Neurology', mastery: 70 },
          { system: 'Gastrointestinal', mastery: 75 },
        ],
      },
      interventions: [
        {
          id: '1',
          priority: 'HIGH',
          title: 'Renal Physiology Workshop',
          description:
            'Targeted session to address specific gaps in renal physiology concepts observed across the cohort.',
          estimatedTime: '2 hours',
          expectedImpact: 8,
          confidence: 92,
          studentCount: 15,
          studentIds: ['S001', 'S005', 'S012'],
        },
        {
          id: '2',
          priority: 'MEDIUM',
          title: 'Pharmacology Review',
          description:
            'Review session for key pharmacological agents and mechanisms.',
          estimatedTime: '1.5 hours',
          expectedImpact: 5,
          confidence: 85,
          studentCount: 22,
          studentIds: ['S002', 'S008'],
        },
        {
          id: '3',
          priority: 'LOW',
          title: 'Study Group Formation',
          description:
            'Facilitate peer-led study groups for students with similar learning paces.',
          estimatedTime: '1 hour',
          expectedImpact: 3,
          confidence: 78,
          studentCount: 10,
          studentIds: [],
        },
      ],
    }),
    [cohortStudentsRaw, selectedCohortId],
  );

  const timeSavings = useMemo(
    () => getFacultyTimeSavings(cohortStudentsRaw),
    [cohortStudentsRaw],
  );

  // Generate alerts (can also be moved to backend service in future)
  useEffect(() => {
    const newAlerts = generateFacultyAlerts(cohortStudentsRaw);
    setAlerts(newAlerts);
  }, [cohortStudentsRaw]);

  // --- COMPONENTS ---

  // 1. Header Navigation
  const HeaderNavigation = () => (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6">
            <div className="flex items-center justify-between xl:justify-start gap-2 p-1.5 bg-white rounded-[2.5rem] w-full xl:w-fit overflow-x-auto no-scrollbar">
              {[
                { id: 'OVERVIEW', icon: BarChart3, label: 'Overview' },
                { id: 'INTERVENTIONS', icon: Brain, label: 'Interventions' },
              ].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setActiveView(type.id);
                  }}
                  className={`flex-1 xl:flex-none flex items-center justify-center gap-2 xl:gap-3 px-4 xl:px-8 py-3 xl:py-3.5 rounded-[2rem] text-[10px] xl:text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeView === type.id ? 'bg-[#1BD183] text-white shadow-md shadow-[#1BD183]/20' : 'text-slate-500 hover:bg-slate-300/50'}`}
                >
                  {type.id === 'OVERVIEW' ? (
                    <BarChart3 size={14} />
                  ) : (
                    <Brain size={14} />
                  )}{' '}
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
              onClick={() =>
                exportFacultyReport(cohortStudentsRaw, cohortData.analytics)
              }
              className="w-full xl:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#191A19] border border-slate-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2a2b2a] shadow-sm "
            >
              <Download size={14} />
              Export Report
            </button>
        </div>
      </div>
    </div>
  );

  // 2. Cohort Selector & Quick Stats
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
            className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            {MOCK_COHORTS.map((cohort) => (
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
                  {cohort.yearLevel} {cohort.intakeTerm}
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Calendar size={12} /> {cohort.studentCount} students
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
              <div className="font-bold text-lg">{currentCohortDef.name}</div>
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

  // 3. Overview Dashboard (Default View)
  const OverviewDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Cohort Readiness"
          value={`${cohortData.analytics.avgReadiness}%`}
          change={cohortData.analytics.readinessChange}
          icon={<Target className="text-[#1BD183]" size={24} />}
          color="indigo"
          subtitle="USMLE Step 1 Projection"
        />
        <MetricCard
          title="At Risk Students"
          value={cohortData.analytics.atRiskCount}
          change={cohortData.analytics.riskChange}
          icon={<AlertTriangle className="text-rose-600" size={24} />}
          color="rose"
          subtitle="Early detection rate"
        />
        <MetricCard
          title="Avg TAPR"
          value={cohortData.analytics.avgTAPR}
          change={cohortData.analytics.taprChange}
          icon={<Clock className="text-amber-600" size={24} />}
          color="amber"
          subtitle="Pacing velocity"
        />
        <MetricCard
          title="Coverage"
          value={`${cohortData.analytics.avgCoverage}%`}
          change={cohortData.analytics.coverageChange}
          icon={<Activity className="text-emerald-600" size={24} />}
          color="emerald"
          subtitle="Curriculum completion"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Readiness Distribution */}
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
          <CohortRiskChart data={cohortData.analytics.readinessDistribution} />
        </div>

        {/* System Mastery Comparison */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-slate-900 uppercase tracking-tight">
              System Mastery
            </h4>
            <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-lg">
              Weakest: <span className="text-rose-600 font-black">Renal</span>
            </div>
          </div>
          <SystemMasteryChart data={cohortData.analytics.systemMastery} />
        </div>
      </div>

      {/* Alerts & Interventions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faculty Alerts */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm h-full">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-slate-900 uppercase tracking-tight">
              Priority Alerts
            </h4>
            <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
              {alerts.filter((a) => a.priority === 'HIGH').length} Critical
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

        {/* Quick Actions */}
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
                onClick={() =>
                  onNavigate?.('MASTERY', { cohortId: selectedCohortId })
                }
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

          {/* System Insights */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-4 p-4 bg-slate-900 rounded-2xl text-white shadow-lg">
              <Brain className="text-[#1BD183] mt-1 shrink-0" size={24} />
              <div>
                <div className="font-black text-sm uppercase tracking-widest text-slate-400 mb-1">
                  System Insight
                </div>
                <div className="text-sm font-medium leading-relaxed">
                  Cohort would benefit from a focused{' '}
                  <strong className="text-white">Renal workshop</strong>.
                  Estimated impact:{' '}
                  <span className="text-emerald-400 font-bold">
                    +8% readiness
                  </span>
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 5. Interventions View using unified SINACohort.interventions
  const InterventionsView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Intervention Queue */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Intervention Queue
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              System-recommended actions prioritized by impact
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-200">
              {
                cohortData.interventions.filter((i) => i.priority === 'HIGH')
                  .length
              }{' '}
              Critical
            </span>
            <button className="px-5 py-2.5 bg-[#1BD183] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1BD183]/90 transition shadow-lg shadow-[#1BD183]/20 flex items-center gap-2 active:scale-95">
              <Plus size={14} />
              Add Custom
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {cohortData.interventions.map((intervention) => (
            <div
              key={intervention.id}
              className="p-6 border border-slate-200 rounded-[1.5rem] hover:border-indigo-200 hover:shadow-md transition-all group bg-white"
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

              {/* Students affected */}
              {intervention.studentIds &&
                intervention.studentIds.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                      Affected Students:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {intervention.studentIds
                        .slice(0, 5)
                        .map((studentId: string) => {
                          const student = cohortStudentsRaw.find(
                            (s) => s.studentId === studentId,
                          );
                          return student ? (
                            <div
                              key={studentId}
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                              <span className="text-xs font-bold text-slate-700">
                                {student.studentName}
                              </span>
                            </div>
                          ) : null;
                        })}
                      {intervention.studentIds.length > 5 && (
                        <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                          +{intervention.studentIds.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* Intervention History & Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="font-black text-slate-900 uppercase tracking-tight mb-6">
            Intervention History
          </h4>
          <div className="space-y-3">
            {[
              {
                type: 'Renal Workshop',
                date: '2 weeks ago',
                impact: '+8% readiness',
              },
              {
                type: 'Study Group',
                date: '3 weeks ago',
                impact: '+5% engagement',
              },
              {
                type: 'Flashcard Review',
                date: '1 month ago',
                impact: '+6% mastery',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    {item.type}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    {item.date}
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                  {item.impact}
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
                <option>Targeted Workshop</option>
                <option>Study Group Session</option>
                <option>Individual Tutoring</option>
                <option>Resource Assignment</option>
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
                +6-9% Readiness Impact
              </div>
              <div className="text-[10px] font-medium text-[#1BD183]/80 mt-2">
                Based on similar interventions with this cohort
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

  // --- MAIN RENDER ---
  return (
    <div className="">
      <HeaderNavigation />

      <div className="pt-6">
        <CohortSelector />

        <div className="mt-8">
          {activeView === 'OVERVIEW' && <OverviewDashboard />}
          {activeView === 'INTERVENTIONS' && <InterventionsView />}
        </div>
      </div>
    </div>
  );
};

// Helper Components
const MetricCard = ({ title, value, change, icon, color, subtitle }: any) => {
  const colorClasses: any = {
    indigo: 'bg-[#1BD183]/10 text-[#1BD183]',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
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
