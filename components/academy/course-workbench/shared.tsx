import React from 'react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';

export type CourseStage = 'Shell only' | 'Objectives ready' | 'Review pending';

export const getCourseObjectiveCount = (course: TeacherCourse) =>
  course.learningObjectivesTotal ?? course.learningObjectives.length;

export const getCoursePendingSuggestionCount = (course: TeacherCourse) =>
  course.pendingLearningObjectiveSuggestionsTotal ?? 0;

export const getCourseStage = (course: TeacherCourse): CourseStage => {
  if (getCoursePendingSuggestionCount(course) > 0) return 'Review pending';
  if (getCourseObjectiveCount(course) > 0) return 'Objectives ready';
  return 'Shell only';
};

export const STAGE_STYLES: Record<CourseStage, string> = {
  'Shell only': 'bg-slate-100 text-slate-500 border-slate-200',
  'Objectives ready': 'bg-amber-50 text-amber-700 border-amber-200',
  'Review pending': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const BLOOM_STYLES: Record<string, string> = {
  Remember: 'bg-slate-100 text-slate-600 border-slate-200',
  Understand: 'bg-blue-50 text-blue-700 border-blue-200',
  Apply: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Analyze: 'bg-purple-50 text-purple-700 border-purple-200',
  Evaluate: 'bg-orange-50 text-orange-700 border-orange-200',
  Create: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const bloomStyle = (level?: string) =>
  (level && BLOOM_STYLES[level]) || 'bg-slate-100 text-slate-600 border-slate-200';

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15 placeholder:text-slate-400';

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
    {children}
  </p>
);

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  accent?: 'slate' | 'emerald' | 'amber' | 'rose';
}> = ({ label, value, accent = 'slate' }) => {
  const accentText =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'amber'
        ? 'text-amber-600'
        : accent === 'rose'
          ? 'text-rose-600'
          : 'text-slate-900';
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-black ${accentText}`}>{value}</p>
    </div>
  );
};
