import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Layers,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import type { Curriculum } from '@/types/TestsServiceTypes';
import {
  getCourseObjectiveCount,
  getCourseStage,
  STAGE_STYLES,
} from './shared';

interface NewCourseInput {
  title: string;
  summary: string;
}

interface CourseLibrarySidebarProps {
  curricula: Curriculum[];
  selectedCurriculum: Curriculum | null;
  isLoadingCurricula: boolean;
  curriculumError: string | null;
  onCurriculumChange: (curriculumId: string | null) => void;
  courses: TeacherCourse[];
  filteredCourses: TeacherCourse[];
  selectedCourseId: string | null;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (courseId: string) => void;
  onDelete: (courseId: string) => void;
  onCreateCourse: (input: NewCourseInput) => Promise<void>;
  totals: { courses: number; objectives: number; reviews: number };
  cohortCountByCourse: Map<string, number>;
  learnerCountByCourse: Map<string, number>;
}

const emptyForm: NewCourseInput = { title: '', summary: '' };

const CourseLibrarySidebar: React.FC<CourseLibrarySidebarProps> = ({
  curricula,
  selectedCurriculum,
  isLoadingCurricula,
  curriculumError,
  onCurriculumChange,
  courses,
  filteredCourses,
  selectedCourseId,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelect,
  onDelete,
  onCreateCourse,
  totals,
  cohortCountByCourse,
  learnerCountByCourse,
}) => {
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState<NewCourseInput>(emptyForm);
  const [isSubmitting, setSubmitting] = useState(false);
  const hasCurriculum = Boolean(selectedCurriculum);

  useEffect(() => {
    if (!selectedCurriculum) {
      setComposerOpen(false);
    }
  }, [selectedCurriculum]);

  const toggleComposer = () => {
    if (!selectedCurriculum) return;
    setComposerOpen((open) => {
      const next = !open;
      if (next) window.setTimeout(() => titleRef.current?.focus(), 0);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || isSubmitting || !selectedCurriculum) return;
    setSubmitting(true);
    try {
      await onCreateCourse(form);
      setForm(emptyForm);
      setComposerOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="flex h-full w-[340px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="overflow-y-auto border-b border-slate-100 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16324F] text-white">
            <Layers size={17} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              Course factory
            </p>
            <h2 className="text-base font-black tracking-tight text-slate-900">
              Course library
            </h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200">
          {[
            { label: 'Courses', value: totals.courses },
            { label: 'Objectives', value: totals.objectives },
            { label: 'Review', value: totals.reviews },
          ].map((stat) => (
            <div key={stat.label} className="px-2.5 py-2 text-center">
              <p className="text-lg font-black leading-none text-slate-900">
                {stat.value}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Curriculum
          </label>
          <select
            value={selectedCurriculum?.id ?? ''}
            onChange={(event) => onCurriculumChange(event.target.value || null)}
            disabled={isLoadingCurricula || curricula.length === 0}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {isLoadingCurricula
                ? 'Loading curricula...'
                : curricula.length === 0
                  ? 'No curricula available'
                  : 'Select a curriculum'}
            </option>
            {curricula.map((curriculum) => (
              <option key={curriculum.id} value={curriculum.id}>
                {curriculum.title}
              </option>
            ))}
          </select>
          {curriculumError ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">
              {curriculumError}
            </p>
          ) : !isLoadingCurricula && curricula.length === 0 ? (
            <p className="mt-1.5 text-xs font-medium text-amber-700">
              Create a curriculum first before managing courses.
            </p>
          ) : null}
        </div>

        <div className="relative mt-4">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={
              hasCurriculum ? 'Search courses…' : 'Select a curriculum first'
            }
            disabled={!hasCurriculum}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          />
        </div>

        <button
          type="button"
          onClick={toggleComposer}
          disabled={!hasCurriculum}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1BD183] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-[#06241a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} /> New course
        </button>

        {isComposerOpen && (
          <form
            onSubmit={handleSubmit}
            className="mt-3 space-y-2.5 border-t border-slate-200 pt-3.5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                New course shell
              </p>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
              >
                <X size={14} />
              </button>
            </div>
            <input
              ref={titleRef}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Course title"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#1BD183]"
            />
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Curriculum
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedCurriculum?.title ?? 'No curriculum selected'}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  New courses are created inside the selected curriculum.
                </p>
              </div>
            </div>
            <textarea
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="Short summary"
              className="min-h-[96px] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-[#1BD183]"
            />
            <button
              type="submit"
              disabled={!form.title.trim() || isSubmitting || !selectedCurriculum}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16324F] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#1B3E62] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Create
            </button>
          </form>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {isLoading && hasCurriculum && courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={22} className="mb-3 animate-spin text-[#1BD183]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">
              Loading courses…
            </p>
          </div>
        ) : !hasCurriculum ? (
          <div className="mt-10 px-5 text-center">
            <BookOpen size={26} className="mx-auto mb-3 text-slate-300" />
            <p className="text-xs font-bold text-slate-500">
              Select a curriculum to view its courses.
            </p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="mt-10 px-5 text-center">
            <BookOpen size={26} className="mx-auto mb-3 text-slate-300" />
            <p className="text-xs font-bold text-slate-500">
              {searchQuery
                ? 'No courses in this curriculum match this search.'
                : 'No courses in this curriculum yet. Create the first one.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredCourses.map((course) => {
              const isSelected = course.id === selectedCourseId;
              const stage = getCourseStage(course);
              const objectiveCount = getCourseObjectiveCount(course);
              const learners = learnerCountByCourse.get(course.id) || 0;
              const cohorts = cohortCountByCourse.get(course.id) || 0;

              return (
                <li key={course.id}>
                  <div
                    className={`group relative border-l-2 px-5 py-3 transition ${
                      isSelected
                        ? 'border-[#1BD183] bg-emerald-50/50'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(course.id)}
                      className="block w-full text-left"
                    >
                      <p className="truncate pr-7 text-sm font-bold text-slate-900">
                        {course.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${STAGE_STYLES[stage]}`}
                        >
                          {stage}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                          {objectiveCount} LO
                        </span>
                        {course.locked && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">
                            <Lock size={10} />
                            Locked
                          </span>
                        )}
                        {cohorts > 0 && (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                            {cohorts} cohort{cohorts === 1 ? '' : 's'}
                          </span>
                        )}
                        {learners > 0 && (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                            {learners} learners
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(course.id)}
                      title="Delete course"
                      className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default CourseLibrarySidebar;
