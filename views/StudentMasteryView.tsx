import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { MOCK_STUDENTS, MOCK_COHORTS } from '../constants';
import {
  Users,
  Target,
  Activity,
  ChevronRight,
  Brain,
  Zap,
  GraduationCap,
  Calendar,
  Filter,
  Layers,
  ArrowRightLeft,
  ArrowLeft,
  BookOpen,
  TrendingUp,
  BarChart2,
  Clock as ClockIcon,
} from 'lucide-react';
import { SINAStudent } from '../types';
import { ReadinessGauge } from '@/components/student_mastery/ReadinessGauge';
import { TAPRBadge } from '@/components/student_mastery/TAPRBadge';
import { SystemMasteryChart } from '@/components/student_mastery/SystemMasteryChart';

type ViewMode = 'GLOBAL' | 'COHORT' | 'STUDENT';

interface StudentMasteryViewProps {
  initialCohortId?: string | null;
  initialStudentId?: string | null;
}

const StudentMasteryView: React.FC<StudentMasteryViewProps> = ({
  initialCohortId,
  initialStudentId,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialStudentId ? 'STUDENT' : initialCohortId ? 'COHORT' : 'GLOBAL',
  );
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
    initialCohortId || null,
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialStudentId || null,
  );

  // --- LOCAL MOCK ANALYSIS HELPERS ---

  // Helper to simulate AI analysis of a student
  const mockAnalyzeStudent = (student: any): SINAStudent => {
    // Calculate TAPR (Target Acquisition Pace Ratio) roughly based on recent gains
    // Base TAPR 1.0 + adjustment
    const tapr = 0.8 + student.recentDailyGain / 3;

    // Determine Risk Level
    let riskLevel: SINAStudent['riskLevel'] = 'On Track';
    if (student.atRisk) riskLevel = 'High';
    if (student.readiness > 85) riskLevel = 'Advanced';
    if (student.readiness < 55) riskLevel = 'Critical';

    // Mock Evidence (confidence) based on coverage
    const evidence = Math.min(1.0, student.coverage / 80);

    // Mock Intervention based on weakest subject
    const entries = Object.entries(
      student.masteryScores as Record<string, number>,
    );
    entries.sort((a, b) => a[1] - b[1]);
    const weakestSystem = entries[0][0];

    return {
      studentId: student.studentId,
      studentName: student.studentName,
      cohortId: student.cohortId,
      mastery: student.masteryScores,
      readiness: student.totalScore, // Mapping totalScore to readiness
      tapr: Number(tapr.toFixed(2)),
      coverage: student.coverage,
      evidence: Number(evidence.toFixed(2)),
      riskLevel,
      predictedStep1: student.predictedStep1,
      primaryIntervention: `Focused review of ${weakestSystem} pathology`,
      recentDailyGain: student.recentDailyGain,
      daysUntilStep1: student.daysUntilStep1,
    };
  };

  // Helper to simulate Agent cohort analysis
  const mockAnalyzeCohort = (students: SINAStudent[]) => {
    if (students.length === 0)
      return { analytics: { avgReadiness: 0, avgTAPR: 0 } };

    const avgReadiness = Math.round(
      students.reduce((acc, s) => acc + s.readiness, 0) / students.length,
    );
    const avgTAPR = Number(
      (students.reduce((acc, s) => acc + s.tapr, 0) / students.length).toFixed(
        2,
      ),
    );

    return {
      analytics: {
        avgReadiness,
        avgTAPR,
      },
    };
  };

  // 1. Process all students (Mock analysis)
  const allAnalyzedStudents = useMemo(() => {
    return MOCK_STUDENTS.map((student) => {
      // Use Local Mock Analysis instead of Agent
      const analysis = mockAnalyzeStudent(student);
      const cohortName =
        MOCK_COHORTS.find((c) => c.id === student.cohortId)?.name || 'Unknown';

      return {
        ...analysis,
        cohortName,
      };
    });
  }, []);

  // 2. Determine Scope & Active Data
  const activeData = useMemo(() => {
    if (viewMode === 'STUDENT' && selectedStudentId) {
      return allAnalyzedStudents.filter(
        (s) => s.studentId === selectedStudentId,
      );
    }
    if (viewMode === 'COHORT' && selectedCohortId) {
      return allAnalyzedStudents.filter((s) => s.cohortId === selectedCohortId);
    }
    return allAnalyzedStudents;
  }, [viewMode, selectedCohortId, selectedStudentId, allAnalyzedStudents]);

  // 3. Cohort Comparison Metrics (Global View)
  const cohortMetrics = useMemo(() => {
    return MOCK_COHORTS.map((cohort) => {
      // Find analyzed students for this cohort
      const cohortStudents = allAnalyzedStudents.filter(
        (s) => s.cohortId === cohort.id,
      );
      const sinaCohort = mockAnalyzeCohort(cohortStudents);
      return {
        id: cohort.id,
        name: cohort.intakeTerm, // Fall vs Spring
        avgReadiness: sinaCohort.analytics.avgReadiness,
        avgTapr: sinaCohort.analytics.avgTAPR,
        count: cohortStudents.length,
      };
    });
  }, [allAnalyzedStudents]);

  // --- ACTIONS ---

  const handleCohortSelect = (id: string) => {
    setSelectedCohortId(id);
    setViewMode('COHORT');
    setSelectedStudentId(null);
  };

  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    setViewMode('STUDENT');
  };

  const handleBackToGlobal = () => {
    setViewMode('GLOBAL');
    setSelectedCohortId(null);
    setSelectedStudentId(null);
  };

  const handleBackToCohort = () => {
    if (selectedCohortId) {
      setViewMode('COHORT');
      setSelectedStudentId(null);
    } else {
      handleBackToGlobal();
    }
  };

  const handleScheduleAppointment = (studentName: string) => {
    alert(
      `Scheduling an intervention review with ${studentName}. Opening faculty calendar integration...`,
    );
  };

  // --- RENDER: STUDENT DETAIL VIEW ---
  if (viewMode === 'STUDENT' && activeData.length === 1) {
    const student = activeData[0];
    const performanceData = Object.entries(student.mastery).map(
      ([sys, score]) => ({
        system: sys,
        mastery: score as number,
      }),
    );

    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 pb-20">
        {/* Header */}
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
                {student.cohortName}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                ID: {student.studentId}
              </span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {student.studentName}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Readiness & Risk */}
          <div className="space-y-8">
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden flex flex-col items-center text-center">
              <h3 className="text-sm font-black text-[#1BD183] uppercase tracking-[0.2em] mb-6">
                Exam Readiness
              </h3>
              <ReadinessGauge value={student.readiness} size="large" />
              <p className="mt-6 text-slate-400 text-xs font-medium max-w-[200px]">
                Projected USMLE Step 1 Range: <br />{' '}
                <strong className="text-white text-lg">
                  {student.predictedStep1}
                </strong>
              </p>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Activity size={16} className="text-rose-500" /> SINA Engine
                Metrics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <span className="text-xs font-bold text-slate-500">
                    Pace (TAPR)
                  </span>
                  <TAPRBadge tapr={student.tapr} showLabel={false} />
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500">
                      Curriculum Coverage
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      Total Items Attempted
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1BD183]"
                        style={{ width: `${student.coverage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-black text-[#1BD183]">
                      {student.coverage}%
                    </span>
                  </div>
                </div>

                {/* Data Confidence / Evidence */}
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500">
                      Metric Confidence
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      Evidence (n/N_min)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${student.evidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-black text-emerald-600">
                      {(student.evidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <span className="text-xs font-bold text-slate-500">
                    Velocity
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-600">
                      +{student.recentDailyGain} / day
                    </span>
                    <p className="text-[9px] text-slate-400">
                      Mastery Gain (7d avg)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle: System Breakdown - Using Shared Component */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm flex flex-col">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                System Mastery
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                Performance by Organ System
              </p>
            </div>
            <div className="flex-1 w-full min-h-[300px]">
              <SystemMasteryChart data={performanceData} />
            </div>
          </div>

          {/* Right: AI Action Plan */}
          <div className="space-y-8">
            <div className="bg-[#1BD183] rounded-[2.5rem] p-10 text-white shadow-xl shadow-[#1BD183]/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap size={150} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">
                Sina Adaptive Plan
              </h3>
              <p className="text-white/80 text-xs font-medium mb-8 uppercase tracking-widest">
                Risk Level: {student.riskLevel}
              </p>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 mb-6">
                <div className="flex items-start gap-4">
                  <Brain className="shrink-0 text-yellow-300" size={24} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1">
                      Recommended Intervention
                    </p>
                    <p className="text-sm font-bold leading-snug">
                      "{student.primaryIntervention}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button className="w-full py-4 bg-white text-[#1BD183] rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white/90 transition shadow-lg flex items-center justify-center gap-2 active:scale-95">
                  <BookOpen size={16} /> Assign Remediation
                </button>
                <button
                  onClick={() => handleScheduleAppointment(student.studentName)}
                  className="w-full py-4 bg-black/20 border border-white/20 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black/30 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <Calendar size={16} /> Schedule Appointment
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
                Activity Log
              </h3>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    <span className="text-slate-500">
                      Completed{' '}
                      <strong className="text-slate-700">
                        Renal Block {i}
                      </strong>
                    </span>
                    <span className="ml-auto text-slate-400 font-mono">
                      2h ago
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN DASHBOARD (GLOBAL OR COHORT) ---
  return (
    <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-in fade-in duration-700">
      {/* 1. Cohort Navigator Sidebar */}
      <div className="w-full h-[calc(100vh-140px)] xl:w-72 xl:sticky xl:top-6 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 flex flex-col gap-6 shrink-0 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-6">
          <button
            onClick={handleBackToGlobal}
            className={`w-full text-left p-4 rounded-2xl transition-all border group ${viewMode === 'GLOBAL' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${viewMode === 'GLOBAL' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>
                <GraduationCap size={20} />
              </div>
              <div>
                <p className="text-sm font-black tracking-tight">
                  Global View
                </p>
                <p className={`text-[10px] font-medium mt-0.5 ${viewMode === 'GLOBAL' ? 'text-slate-400' : 'text-slate-400'}`}>
                  University Analytics
                </p>
              </div>
            </div>
          </button>

          <div className="space-y-6">
            {['MS1', 'MS2'].map((year) => {
              const cohorts = MOCK_COHORTS.filter((c) => c.yearLevel === year);
              if (cohorts.length === 0) return null;
              return (
                <div key={year}>
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1BD183]/80 bg-[#1BD183]/10 px-2 py-1 rounded-lg">
                      {year} Cohorts
                    </span>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>
                  <div className="space-y-2">
                    {cohorts.map((cohort) => (
                      <button
                        key={cohort.id}
                        onClick={() => handleCohortSelect(cohort.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all group ${
                          selectedCohortId === cohort.id
                            ? 'bg-[#1BD183]/5 border-[#1BD183]/20 text-[#1BD183] shadow-sm'
                            : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedCohortId === cohort.id ? 'bg-[#1BD183]' : 'bg-slate-300 group-hover:bg-[#1BD183]/50'}`}></div>
                          {cohort.intakeTerm} Intake
                        </div>
                        {selectedCohortId === cohort.id && (
                             <ChevronRight size={14} className="text-[#1BD183]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
        {/* HUD: Aggregate Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col justify-between min-h-[280px]">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight mb-1">
                    {viewMode === 'COHORT'
                      ? MOCK_COHORTS.find((c) => c.id === selectedCohortId)
                          ?.name
                      : 'Cohort Comparison'}
                  </h2>
                  <p className="text-xs font-medium text-slate-400">
                    {activeData.length} Students Enrolled
                  </p>
                </div>
                <div className="p-3 bg-[#1BD183]/10 text-[#1BD183] rounded-2xl">
                  {viewMode === 'COHORT' ? (
                    <Users size={24} />
                  ) : (
                    <Activity size={24} />
                  )}
                </div>
              </div>

              <div className="mt-8 flex items-end gap-6">
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Avg Readiness Calculated via SINA Engine (Weighted Mastery × Coverage × TAPR)
                  </p>
                </div>
                <div className="w-1/2 flex justify-end">
                  <div className="scale-125 origin-bottom-right">
                    <ReadinessGauge
                      value={Math.round(
                        activeData.reduce((acc, s) => acc + s.readiness, 0) /
                          activeData.length,
                      )}
                      size="medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Intake Comparison Engine (Fall vs Spring) */}
          {viewMode === 'GLOBAL' && (
            <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1BD183]/5 text-[#1BD183] rounded-xl">
                    <ArrowRightLeft size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                    Fall vs Spring Engine
                  </h3>
                </div>
              </div>
              <div className="flex-1 w-full flex items-center justify-center text-slate-400">
                {/* Placeholder for Comparison Chart if needed, using standard Scatter for now */}
                <p className="text-xs font-bold uppercase tracking-widest">
                  SINA Comparison Mode Active
                </p>
              </div>
            </div>
          )}

          {/* TAPR Scatter Plot (Velocity vs Coverage) */}
          {viewMode === 'COHORT' && (
            <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1BD183]/5 text-[#1BD183] rounded-xl">
                    <TrendingUp size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                    TAPR Velocity Matrix
                  </h3>
                </div>
                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                  X: Coverage • Y: Mastery
                </div>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="coverage"
                      name="Coverage"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      unit="%"
                    />
                    <YAxis
                      type="number"
                      dataKey="readiness"
                      name="Readiness"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 text-xs">
                              <p className="font-black text-slate-900">
                                {data.studentName}
                              </p>
                              <p className="text-slate-500">
                                TAPR: {data.tapr}x
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter name="Students" data={activeData}>
                      {activeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.tapr < 0.8
                              ? '#f43f5e'
                              : entry.tapr > 1.2
                                ? '#10b981'
                                : '#fbbf24'
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* 3. Student List with TAPR Indicators */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Zap size={20} className="text-[#1BD183]" />
                Adaptive Intervention Queue
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Real-time recommendations for {activeData.length} students.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-20 shadow-sm">
                  <th className="px-6 py-5 min-w-[240px]">Student / Cohort</th>
                  <th className="px-6 py-5 text-center min-w-[140px]">Readiness Score</th>
                  <th className="px-6 py-5 text-center min-w-[120px]">TAPR (Pace)</th>
                  <th className="px-6 py-5 text-center min-w-[120px]">Evidence</th>
                  <th className="px-6 py-5 text-center min-w-[140px]">Step 1 Forecast</th>
                  <th className="px-6 py-5 min-w-[280px]">AI Recommended Action</th>
                  <th className="px-6 py-5 text-right w-16">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeData
                  .sort((a, b) => a.readiness - b.readiness)
                  .map((student) => (
                    <tr
                      key={student.studentId}
                      onClick={() => handleStudentSelect(student.studentId)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${student.tapr < 0.8 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {student.studentName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm group-hover:text-[#1BD183] transition-colors">
                              {student.studentName}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {student.cohortName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span
                          className={`text-lg font-black ${student.readiness < 60 ? 'text-rose-500' : student.readiness < 80 ? 'text-amber-500' : 'text-emerald-500'}`}
                        >
                          {student.readiness}%
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <TAPRBadge tapr={student.tapr} showLabel={false} />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1">
                          <BarChart2 size={10} />
                          {(student.evidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                          {student.predictedStep1}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <Brain
                            size={16}
                            className="text-[#1BD183]/60 shrink-0"
                          />
                          <p className="text-xs font-bold text-slate-600 italic line-clamp-1">
                            "{student.primaryIntervention}"
                          </p>
                        </div>
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
        </div>
      </div>
    </div>
  );
};

export default StudentMasteryView;
