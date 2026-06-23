import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileText,
  Layers,
  MonitorPlay,
  Plus,
  Search,
} from 'lucide-react';
import type {
  ItemTypeTotals,
  TeacherCourse,
  TeacherLearningObjective,
} from '@/types/AcademyStudioTypes';
import { bloomStyle, SectionLabel } from './shared';

const MAX_VISIBLE = 60;

const CONTENT_TYPES: {
  key: keyof ItemTypeTotals['byType'];
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: 'mcq', label: 'MCQs', icon: ClipboardCheck },
  { key: 'saq', label: 'SAQs', icon: FileText },
  { key: 'flashcard', label: 'Flashcards', icon: Layers },
  { key: 'lecture', label: 'Lectures', icon: MonitorPlay },
];

interface CourseContentPanelProps {
  course: TeacherCourse;
  /** Open the items drawer for an objective (author / inspect its content). */
  onManageObjective: (objective: TeacherLearningObjective) => void;
  /** Jump to the objectives tab when nothing is attached yet. */
  onManageObjectives?: () => void;
}

const CourseContentPanel: React.FC<CourseContentPanelProps> = ({
  course,
  onManageObjective,
  onManageObjectives,
}) => {
  const [query, setQuery] = useState('');
  const objectives = course.learningObjectives;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return objectives;
    return objectives.filter(
      (objective) =>
        objective.title.toLowerCase().includes(trimmed) ||
        (objective.organSystem || '').toLowerCase().includes(trimmed),
    );
  }, [objectives, query]);

  if (objectives.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-8 text-center">
        <BookOpen size={40} className="mb-4 text-slate-300" />
        <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
          No objectives to build against
        </p>
        <p className="mt-2 max-w-sm text-xs font-medium text-slate-500">
          Content is authored against learning objectives. Attach at least one
          objective to this course, then come back to produce lectures,
          flashcards, SAQs, and MCQs.
        </p>
        {onManageObjectives && (
          <button
            type="button"
            onClick={onManageObjectives}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> Add objectives
          </button>
        )}
      </div>
    );
  }

  const visible = filtered.slice(0, MAX_VISIBLE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Content production</SectionLabel>
          <h3 className="text-lg font-black tracking-tight text-slate-900">
            Build &amp; inspect items per objective
          </h3>
          <p className="mt-1 max-w-xl text-xs font-medium text-slate-500">
            Pick a learning objective to author and review its lectures,
            flashcards, SAQs, and MCQs — all without leaving the course.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
          {objectives.length} objective{objectives.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this course’s objectives…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-semibold text-slate-500">
          No objectives match “{query.trim()}”.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-[1.25rem] border border-slate-200">
          {visible.map((objective) => (
            <button
              key={objective.id}
              type="button"
              onClick={() => onManageObjective(objective)}
              className="group flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-[#1BD183]">
                <Database size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {objective.title}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {objective.organSystem && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {objective.organSystem}
                    </span>
                  )}
                  {objective.cognitiveSkill && (
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${bloomStyle(objective.cognitiveSkill)}`}
                    >
                      {objective.cognitiveSkill}
                    </span>
                  )}
                </span>
              </span>
              {objective.itemTotals && (
                <span className="hidden flex-shrink-0 items-center gap-1 md:flex">
                  {CONTENT_TYPES.map(({ key, label, icon: Icon }) => {
                    const count = objective.itemTotals!.byType[key];
                    return (
                      <span
                        key={key}
                        title={`${count} ${label}`}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                          count > 0
                            ? 'border-slate-200 bg-white text-slate-600'
                            : 'border-transparent bg-slate-50 text-slate-300'
                        }`}
                      >
                        <Icon size={11} /> {count}
                      </span>
                    );
                  })}
                </span>
              )}
              <span className="flex flex-shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 transition group-hover:text-[#1BD183]">
                Manage
                <ChevronRight size={15} />
              </span>
            </button>
          ))}
        </div>
      )}

      {filtered.length > MAX_VISIBLE && (
        <p className="text-center text-xs font-medium text-slate-400">
          Showing the first {MAX_VISIBLE} of {filtered.length}. Refine your
          search to narrow the list.
        </p>
      )}
    </div>
  );
};

export default CourseContentPanel;
