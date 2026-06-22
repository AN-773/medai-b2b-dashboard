import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Loader2, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { testsService } from '@/services/testsService';
import type { TeacherCourse, TeacherLearningObjective } from '@/types/AcademyStudioTypes';
import type { LearningObjective } from '@/types/TestsServiceTypes';
import { bloomStyle, getCourseObjectiveCount, SectionLabel } from './shared';
import CreateCourseObjectiveModal from './CreateCourseObjectiveModal';

type SearchLearningObjective = LearningObjective & {
  source?: string;
  organSystem?: { title?: string } | null;
};

const normalizeSearchLearningObjective = (
  objective: SearchLearningObjective,
): TeacherLearningObjective => ({
  id: objective.id,
  title: objective.title,
  organSystem:
    objective.organSystem?.title ||
    objective.syndrome?.topic?.organSystem?.title ||
    undefined,
  cognitiveSkill: objective.cognitiveSkill?.title || undefined,
  source: objective.source === 'ai' ? 'ai' : 'manual',
  createdAt: objective.createdAt || new Date().toISOString(),
});

interface CourseObjectivesPanelProps {
  course: TeacherCourse;
  attachedIds: Set<string>;
  onAttach: (objective: TeacherLearningObjective) => Promise<void>;
  onCreate: (objective: TeacherLearningObjective) => Promise<void>;
  onRemove: (objective: TeacherLearningObjective) => Promise<void>;
}

const CourseObjectivesPanel: React.FC<CourseObjectivesPanelProps> = ({
  course,
  attachedIds,
  onAttach,
  onCreate,
  onRemove,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeacherLearningObjective[]>([]);
  const [isSearching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const objectiveCount = getCourseObjectiveCount(course);

  useEffect(() => {
    setQuery('');
    setResults([]);
  }, [course.id]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void testsService
        .getLearningObjectives(1, 25, undefined, trimmed)
        .then((response) => {
          if (cancelled) return;
          setResults(
            response.items.map((objective) =>
              normalizeSearchLearningObjective(objective as SearchLearningObjective),
            ),
          );
        })
        .catch((error) => {
          if (cancelled) return;
          console.error('Failed to search learning objectives:', error);
          setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const runAction = async (
    id: string,
    action: () => Promise<void>,
  ) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      {/* Search / attach */}
      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Search size={16} />
            </div>
            <div>
              <SectionLabel>Catalog</SectionLabel>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Attach existing objectives
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-[#1BD183]/20 transition hover:shadow-xl hover:shadow-[#1BD183]/30 active:scale-[0.98]"
          >
            <Sparkles size={14} /> New objective
          </button>
        </div>

        <div className="relative mt-5">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the learning objective catalog…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15 placeholder:text-slate-400"
          />
        </div>

        <div className="mt-4 max-h-[420px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-200 pr-1 custom-scrollbar">
          {isSearching && (
            <div className="flex items-center gap-2 px-1 py-3 text-sm font-semibold text-slate-500">
              <Loader2 size={15} className="animate-spin" /> Searching…
            </div>
          )}

          {!isSearching && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-1 py-10 text-center text-sm font-semibold text-slate-500">
              No objectives matched “{query.trim()}”.
            </div>
          )}

          {!isSearching && query.trim().length < 2 && (
            <div className="px-1 py-10 text-center text-sm font-medium text-slate-500">
              Type at least 2 characters to search the catalog.
            </div>
          )}

          {results.map((objective) => {
            const isAttached = attachedIds.has(objective.id);
            return (
              <div key={objective.id} className="px-1 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{objective.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isAttached || busyId === objective.id}
                    onClick={() => void runAction(objective.id, () => onAttach(objective))}
                    className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                      isAttached
                        ? 'cursor-not-allowed bg-emerald-50 text-emerald-600'
                        : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
                    }`}
                  >
                    {busyId === objective.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : isAttached ? (
                      <Check size={13} />
                    ) : (
                      <Plus size={13} />
                    )}
                    {isAttached ? 'Added' : 'Attach'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Attached list */}
      <section className="border-t border-slate-200 pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1BD183] text-[#06241a]">
            <BookOpen size={16} />
          </div>
          <div>
            <SectionLabel>This course</SectionLabel>
            <h3 className="text-lg font-black tracking-tight text-slate-900">
              {objectiveCount} objective
              {objectiveCount === 1 ? '' : 's'}
            </h3>
          </div>
        </div>

        <div className="mt-5 max-h-[460px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-200 pr-1 custom-scrollbar">
          {course.learningObjectives.length === 0 ? (
            <div className="px-1 py-14 text-center text-sm font-semibold text-slate-500">
              No objectives yet. Attach from the catalog or accept AI suggestions
              in the factory tab.
            </div>
          ) : (
            course.learningObjectives.map((objective) => (
              <div key={objective.id} className="px-1 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{objective.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-500">
                        {objective.source}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === objective.id}
                    onClick={() => void runAction(objective.id, () => onRemove(objective))}
                    title="Remove from course"
                    className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {busyId === objective.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <CreateCourseObjectiveModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        course={course}
        onCreated={onCreate}
      />
    </div>
  );
};

export default CourseObjectivesPanel;
