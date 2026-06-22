import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Sparkles, Target, Users } from 'lucide-react';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import {
  getCourseObjectiveCount,
  getCourseStage,
  inputClass,
  SectionLabel,
  StatTile,
  STAGE_STYLES,
} from './shared';

interface CourseOverviewPanelProps {
  course: TeacherCourse;
  cohortsUsingCourse: TeacherCohort[];
  learnerCount: number;
  pendingSuggestions: number;
  onSave: (data: { title: string; code: string; summary: string }) => Promise<void>;
}

const CourseOverviewPanel: React.FC<CourseOverviewPanelProps> = ({
  course,
  cohortsUsingCourse,
  learnerCount,
  pendingSuggestions,
  onSave,
}) => {
  const [form, setForm] = useState({
    title: course.title,
    code: course.code,
    summary: course.summary,
  });
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ title: course.title, code: course.code, summary: course.summary });
  }, [course.id, course.title, course.code, course.summary]);

  const isDirty = useMemo(
    () =>
      form.title.trim() !== course.title ||
      form.code.trim() !== course.code ||
      form.summary.trim() !== course.summary,
    [form, course],
  );

  const stage = getCourseStage(course);
  const objectiveCount = getCourseObjectiveCount(course);

  const handleSave = async () => {
    if (!form.title.trim() || isSaving) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 border-y border-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
        <div className="px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Stage
          </p>
          <span
            className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${STAGE_STYLES[stage]}`}
          >
            {stage}
          </span>
        </div>
        <StatTile label="Objectives" value={objectiveCount} accent="emerald" />
        <StatTile label="Learners" value={learnerCount} />
        <StatTile
          label="Pending review"
          value={pendingSuggestions}
          accent={pendingSuggestions > 0 ? 'amber' : 'slate'}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        {/* Details */}
        <section>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Target size={16} />
              </div>
              <div>
                <SectionLabel>Course details</SectionLabel>
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  Course shell
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || !form.title.trim() || isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#16324F] px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#1B3E62] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>

          <div className="mt-5 space-y-3.5">
            <div>
              <SectionLabel>Title</SectionLabel>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Course title"
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <SectionLabel>Code</SectionLabel>
              <input
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="Course code"
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <SectionLabel>Summary</SectionLabel>
              <textarea
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, summary: event.target.value }))
                }
                placeholder="What does this course cover?"
                className={`mt-2 min-h-[120px] resize-none ${inputClass}`}
              />
            </div>
          </div>
        </section>

        {/* Cohort usage */}
        <section className="border-t border-slate-200 pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-600">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Cohort usage
              </p>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Where it&apos;s attached
              </h3>
            </div>
          </div>

          <div className="mt-5">
            {cohortsUsingCourse.length === 0 ? (
              <div className="border-y border-slate-200 px-1 py-8 text-center text-sm font-medium text-slate-400">
                Not assigned to any cohort yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-y border-slate-200">
                {cohortsUsingCourse.map((cohort) => (
                  <div key={cohort.id} className="px-1 py-3.5">
                    <p className="font-bold text-slate-900">{cohort.title}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {cohort.term || 'No term'} · {cohort.studentIds.length} students
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendingSuggestions > 0 && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#1BD183]/30 bg-[#1BD183]/10 px-4 py-3">
              <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-[#1BD183]" />
              <p className="text-xs font-semibold text-emerald-700">
                {pendingSuggestions} AI objective suggestion
                {pendingSuggestions === 1 ? '' : 's'} waiting in the factory tab.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CourseOverviewPanel;
