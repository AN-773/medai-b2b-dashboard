import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookImage,
  BookOpen,
  Check,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import AICoursePreviewModal from '@/components/academy/AICoursePreviewModal';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { testsService } from '@/services/testsService';
import {
  TeacherCohort,
  TeacherCourse,
  TeacherLearningObjective,
} from '@/types/AcademyStudioTypes';
import type { LearningObjective } from '@/types/TestsServiceTypes';

const panelClass =
  'rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm';
const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10';
const textareaClass = `${inputClass} min-h-[120px] resize-none`;

type CourseFilter = 'all' | 'shell' | 'objectives' | 'content';
type CourseSort = 'updated' | 'title' | 'cohorts';

const emptyCourseForm = {
  title: '',
  code: '',
  summary: '',
};

const getPublishLabel = (course: TeacherCourse) =>
  course.contentDrafts.length > 0 || course.sourceFiles.length > 0
    ? 'Published'
    : 'Unpublished';

const getProgressLabel = (learnerCount: number) =>
  learnerCount > 0 ? 'Learning in progress' : 'Learning not started';

const getCourseStage = (course: TeacherCourse) => {
  if (course.contentDrafts.length > 0) return 'Content ready';
  if (course.learningObjectives.length > 0) return 'Objectives ready';
  return 'Shell only';
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type SearchLearningObjective = LearningObjective & {
  source?: string;
  organSystem?: {
    title?: string;
  } | null;
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

const CoursesView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const createTitleRef = useRef<HTMLInputElement | null>(null);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [showCreateComposer, setShowCreateComposer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CourseFilter>('all');
  const [sortMode, setSortMode] = useState<CourseSort>('updated');
  const [newCourseForm, setNewCourseForm] = useState(emptyCourseForm);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [objectiveQuery, setObjectiveQuery] = useState('');
  const [objectiveSearchResults, setObjectiveSearchResults] = useState<
    TeacherLearningObjective[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isObjectiveSearchLoading, setIsObjectiveSearchLoading] =
    useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const snapshot = await academyStudioBackend.loadSnapshot();
      setCourses(snapshot.courses);
      setCohorts(snapshot.cohorts);
    } catch (error) {
      console.error('Failed to load academy studio data:', error);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load courses from the backend.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const queryCourseId = searchParams.get('courseId');
    if (queryCourseId && courses.some((course) => course.id === queryCourseId)) {
      setSelectedCourseId(queryCourseId);
      return;
    }

    if (!courses.length) {
      setSelectedCourseId(null);
      return;
    }

    if (
      !selectedCourseId ||
      !courses.some((course) => course.id === selectedCourseId)
    ) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, searchParams, selectedCourseId]);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) || null;

  useEffect(() => {
    if (!selectedCourse) {
      setCourseForm(emptyCourseForm);
      setObjectiveQuery('');
      setObjectiveSearchResults([]);
      return;
    }

    setCourseForm({
      title: selectedCourse.title,
      code: selectedCourse.code,
      summary: selectedCourse.summary,
    });
    setObjectiveQuery('');
    setObjectiveSearchResults([]);
  }, [selectedCourse]);

  const cohortCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    cohorts.forEach((cohort) => {
      cohort.courseIds.forEach((courseId) => {
        counts.set(courseId, (counts.get(courseId) || 0) + 1);
      });
    });
    return counts;
  }, [cohorts]);

  const learnerCountByCourse = useMemo(() => {
    const counts = new Map<string, Set<string>>();

    cohorts.forEach((cohort) => {
      cohort.courseIds.forEach((courseId) => {
        const courseLearners = counts.get(courseId) || new Set<string>();
        cohort.studentIds.forEach((studentId) => courseLearners.add(studentId));
        counts.set(courseId, courseLearners);
      });
    });

    return new Map(
      Array.from(counts.entries()).map(([courseId, learnerIds]) => [
        courseId,
        learnerIds.size,
      ]),
    );
  }, [cohorts]);

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = courses.filter((course) => {
      const matchesQuery =
        !query ||
        [course.title, course.code, course.summary]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));

      const stage = getCourseStage(course);
      const matchesFilter =
        statusFilter === 'all' ||
        (statusFilter === 'shell' && stage === 'Shell only') ||
        (statusFilter === 'objectives' && stage === 'Objectives ready') ||
        (statusFilter === 'content' && stage === 'Content ready');

      return matchesQuery && matchesFilter;
    });

    return filtered.sort((left, right) => {
      if (sortMode === 'title') {
        return left.title.localeCompare(right.title);
      }

      if (sortMode === 'cohorts') {
        return (
          (cohortCountByCourse.get(right.id) || 0) -
          (cohortCountByCourse.get(left.id) || 0)
        );
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [cohortCountByCourse, courses, searchQuery, sortMode, statusFilter]);

  const cohortsUsingSelectedCourse = useMemo(
    () =>
      selectedCourse
        ? cohorts.filter((cohort) => cohort.courseIds.includes(selectedCourse.id))
        : [],
    [cohorts, selectedCourse],
  );

  const selectedCourseObjectiveIds = useMemo(
    () => new Set(selectedCourse?.learningObjectives.map((objective) => objective.id) || []),
    [selectedCourse],
  );

  useEffect(() => {
    if (!selectedCourse) {
      setObjectiveSearchResults([]);
      setIsObjectiveSearchLoading(false);
      return;
    }

    const trimmedQuery = objectiveQuery.trim();
    if (trimmedQuery.length < 2) {
      setObjectiveSearchResults([]);
      setIsObjectiveSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsObjectiveSearchLoading(true);

    const timer = window.setTimeout(() => {
      void testsService
        .getLearningObjectives(1, 25, undefined, trimmedQuery)
        .then((response) => {
          if (cancelled) return;
          setObjectiveSearchResults(
            response.items.map((objective) =>
              normalizeSearchLearningObjective(
                objective as SearchLearningObjective,
              ),
            ),
          );
        })
        .catch((error) => {
          if (cancelled) return;
          console.error('Failed to search learning objectives:', error);
          setObjectiveSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) {
            setIsObjectiveSearchLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [objectiveQuery, selectedCourse]);

  const totalObjectiveCount = useMemo(
    () =>
      courses.reduce(
        (count, course) => count + course.learningObjectives.length,
        0,
      ),
    [courses],
  );

  const totalSourceFileCount = useMemo(
    () => courses.reduce((count, course) => count + course.sourceFiles.length, 0),
    [courses],
  );

  const totalLearnerCoverage = useMemo(
    () =>
      Array.from(learnerCountByCourse.values()).reduce(
        (count, learnerCount) => count + learnerCount,
        0,
      ),
    [learnerCountByCourse],
  );

  const saveCourseRecord = async (course: TeacherCourse) => {
    const savedCourse = await academyStudioBackend.saveCourse(course);
    await loadData();
    setSelectedCourseId(savedCourse.id);
    setSearchParams({ courseId: savedCourse.id });
    return savedCourse;
  };

  const createCourseShell = async (source: typeof newCourseForm) => {
    const savedCourse = await academyStudioBackend.saveCourse({
      title: source.title.trim(),
      code: source.code.trim(),
      summary: source.summary.trim(),
      learningObjectives: [],
      sourceFiles: [],
      contentDrafts: [],
    });
    await loadData();
    setSelectedCourseId(savedCourse.id);
    setSearchParams({ courseId: savedCourse.id });
    return savedCourse.id;
  };

  const handleCreateCourse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCourseForm.title.trim()) return;

    try {
      await createCourseShell(newCourseForm);
      setNewCourseForm(emptyCourseForm);
      setShowCreateComposer(false);
      setMessage('Course created and selected.');
    } catch (error) {
      reportMutationError(error, 'Unable to create this course.');
    }
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse || !courseForm.title.trim()) return;

    try {
      await saveCourseRecord({
        ...selectedCourse,
        title: courseForm.title.trim(),
        code: courseForm.code.trim(),
        summary: courseForm.summary.trim(),
      });
      setMessage('Course details updated.');
    } catch (error) {
      reportMutationError(error, 'Unable to save this course.');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    const course = courses.find((entry) => entry.id === courseId);
    if (!course) return;
    if (!window.confirm(`Delete course "${course.title}"?`)) return;

    try {
      await academyStudioBackend.deleteCourse(course);
      if (selectedCourseId === course.id) {
        setSearchParams({});
      }
      setMessage(`Deleted "${course.title}".`);
      await loadData();
    } catch (error) {
      reportMutationError(error, `Unable to delete "${course.title}".`);
    }
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSearchParams({ courseId });
  };

  const handleAttachObjective = async (
    objective: TeacherLearningObjective,
  ) => {
    if (!selectedCourse) return;
    if (selectedCourseObjectiveIds.has(objective.id)) return;

    try {
      await academyStudioBackend.saveCourseLearningObjectives(selectedCourse, [
        ...selectedCourse.learningObjectives,
        objective,
      ]);
      setObjectiveQuery('');
      setObjectiveSearchResults([]);
      setMessage('Learning objective attached to the course.');
      await loadData();
    } catch (error) {
      reportMutationError(error, 'Unable to attach this learning objective.');
    }
  };

  const handleRemoveObjective = async (
    objective: TeacherLearningObjective,
  ) => {
    if (!selectedCourse) return;
    if (
      !window.confirm(
        `Delete "${objective.title}" from ${selectedCourse.title}?`,
      )
    ) {
      return;
    }

    try {
      await academyStudioBackend.saveCourseLearningObjectives(
        selectedCourse,
        selectedCourse.learningObjectives.filter(
          (candidate) => candidate.id !== objective.id,
        ),
      );
      setMessage('Learning objective removed.');
      await loadData();
    } catch (error) {
      reportMutationError(error, 'Unable to remove this learning objective.');
    }
  };

  const handleSaveAiDraft = async (
    sourceFile: TeacherCourse['sourceFiles'][number],
    contentDrafts: TeacherCourse['contentDrafts'],
  ) => {
    if (!selectedCourse) return;

    try {
      academyStudioBackend.saveCourseContentDraftMetadata(
        selectedCourse.id,
        sourceFile,
        contentDrafts,
      );
      setAiModalOpen(false);
      setMessage('AI course preview saved to the selected course.');
      await loadData();
    } catch (error) {
      reportMutationError(error, 'Unable to save the AI course preview.');
    }
  };

  const handleOpenAiPreview = async () => {
    try {
      if (selectedCourse) {
        setAiModalOpen(true);
        return;
      }

      const nextId = await createCourseShell({
        title: `New Course ${courses.length + 1}`,
        code: '',
        summary: '',
      });
      setMessage('A draft course shell was created for AI generation.');
      setSearchParams({ courseId: nextId });
      setAiModalOpen(true);
    } catch (error) {
      reportMutationError(error, 'Unable to prepare an AI course draft.');
    }
  };

  const cycleFilterAndSort = () => {
    setStatusFilter((current) => {
      if (current === 'all') return 'content';
      if (current === 'content') return 'objectives';
      if (current === 'objectives') return 'shell';
      return 'all';
    });

    setSortMode((current) => {
      if (current === 'updated') return 'title';
      if (current === 'title') return 'cohorts';
      return 'updated';
    });
  };

  const handleToggleComposer = () => {
    setShowCreateComposer((current) => {
      const next = !current;
      if (!current) {
        window.setTimeout(() => createTitleRef.current?.focus(), 0);
      }
      return next;
    });
  };

  const selectedCourseLearners = selectedCourse
    ? learnerCountByCourse.get(selectedCourse.id) || 0
    : 0;

  const reportMutationError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    setLoadError(getErrorMessage(error, fallback));
  };

  const renderCourseWorkspace = () => {
    if (!selectedCourse) return null;

    return (
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Course workspace
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {selectedCourse.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Manage the course shell, then add objectives and AI content in
                this workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveCourse}
                className="rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1B3E62]"
              >
                Save course
              </button>
              <button
                type="button"
                onClick={handleOpenAiPreview}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                <Upload size={15} />
                AI preview
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCourse(selectedCourse.id)}
                className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="grid gap-4">
              <input
                value={courseForm.title}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Course title"
                className={inputClass}
              />
              <input
                value={courseForm.code}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="Course code"
                className={inputClass}
              />
            </div>

            <textarea
              value={courseForm.summary}
              onChange={(event) =>
                setCourseForm((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              placeholder="Course summary"
              className={textareaClass}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Stage</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {getCourseStage(selectedCourse)}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Learners</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {selectedCourseLearners}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Objectives</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {selectedCourse.learningObjectives.length}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Sources</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {selectedCourse.sourceFiles.length}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className={panelClass}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Learning objectives
                </p>
                <h3 className="text-xl font-black tracking-tight text-slate-900">
                  Attach and manage course objectives
                </h3>
              </div>
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3">
                <input
                  value={objectiveQuery}
                  onChange={(event) => setObjectiveQuery(event.target.value)}
                  placeholder="Search existing learning objectives"
                  className={inputClass}
                />
              </div>


              {isObjectiveSearchLoading && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                  Searching objectives...
                </div>
              )}

              {!isObjectiveSearchLoading &&
                objectiveQuery.trim().length >= 2 &&
                objectiveSearchResults.length === 0 && (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No learning objectives matched this search.
                  </div>
                )}

              {objectiveSearchResults.length > 0 && (
                <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {objectiveSearchResults.map((objective) => {
                    const isAttached = selectedCourseObjectiveIds.has(
                      objective.id,
                    );

                    return (
                      <div
                        key={objective.id}
                        className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {objective.title}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {objective.organSystem && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                  {objective.organSystem}
                                </span>
                              )}
                              {objective.cognitiveSkill && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                  {objective.cognitiveSkill}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isAttached}
                            onClick={() => void handleAttachObjective(objective)}
                            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                              isAttached
                                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {isAttached ? 'Attached' : 'Attach'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {selectedCourse.learningObjectives.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">
                  No objectives yet. Add the first one above.
                </div>
              ) : (
                selectedCourse.learningObjectives.map((objective) => (
                  <div
                    key={objective.id}
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {objective.title}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {objective.organSystem && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {objective.organSystem}
                            </span>
                          )}
                          {objective.cognitiveSkill && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {objective.cognitiveSkill}
                            </span>
                          )}
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {objective.source}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleRemoveObjective(objective)}
                        className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className={panelClass}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    AI content
                  </p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    PDF sources and saved AI drafts
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAiPreview}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1B3E62]"
                >
                  <Upload size={15} />
                  AI preview
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {selectedCourse.sourceFiles.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No source PDF uploaded yet.
                  </div>
                ) : (
                  selectedCourse.sourceFiles.map((file) => (
                    <div
                      key={file.id}
                      className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-white p-3 text-slate-500 shadow-sm">
                          <FileText size={17} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {file.name}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            {file.uploadedFileId
                              ? 'Uploaded to the file service'
                              : 'Stored locally for this prototype'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 space-y-3">
                {selectedCourse.contentDrafts.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No AI draft saved yet.
                  </div>
                ) : (
                  selectedCourse.contentDrafts.map((draft, index) => (
                    <div
                      key={draft.id}
                      className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">
                          Learning objective set {index + 1}: {draft.title}
                        </p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {draft.objectives.length} objectives
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        {draft.objectives.slice(0, 3).map((objective) => (
                          <p key={`${draft.id}-${objective}`}>{objective}</p>
                        ))}
                        {draft.objectives.length > 3 && (
                          <p className="text-xs font-semibold text-slate-400">
                            +{draft.objectives.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-[#101311] p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3 text-[#1BD183]">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Cohort usage
                  </p>
                  <h3 className="text-xl font-black tracking-tight text-white">
                    Where this course is attached
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {cohortsUsingSelectedCourse.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-8 text-sm font-medium text-slate-300">
                    This course is not assigned to any cohort yet.
                  </div>
                ) : (
                  cohortsUsingSelectedCourse.map((cohort) => (
                    <div
                      key={cohort.id}
                      className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4"
                    >
                      <p className="font-semibold text-white">
                        {cohort.title}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {cohort.term || 'No term'} · {cohort.studentIds.length}{' '}
                        students
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="teacher-readable space-y-6">
        <div className="rounded-[1.75rem] border border-emerald-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
              <Check size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {selectedCourse
                  ? 'Manage the selected course inline below.'
                  : 'Add a course or use AI to generate one from a PDF source.'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedCourse
                  ? `Selected course: ${selectedCourse.title}`
                  : `${courses.length} courses, ${totalObjectiveCount} objectives, ${totalSourceFileCount} source files, ${totalLearnerCoverage} learner links`}
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 shadow-sm">
            {message}
          </div>
        )}

        {loadError && (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm">
            {loadError}
          </div>
        )}

        <div className="space-y-6">
          <section className="space-y-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">
                Library totals
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-[1rem] bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Courses</p>
                  <p className="mt-1.5 text-xl font-black text-slate-900">
                    {courses.length}
                  </p>
                </div>
                <div className="rounded-[1rem] bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Objectives</p>
                  <p className="mt-1.5 text-xl font-black text-slate-900">
                    {totalObjectiveCount}
                  </p>
                </div>
                <div className="rounded-[1rem] bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Source files</p>
                  <p className="mt-1.5 text-xl font-black text-slate-900">
                    {totalSourceFileCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search course name or ID"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={cycleFilterAndSort}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                  >
                    <SlidersHorizontal size={16} />
                    Filter and sort
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleComposer}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1B3E62]"
                  >
                    <Plus size={16} />
                    Add course
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAiPreview}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#7F54E9] to-[#57B6E6] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    <Sparkles size={16} />
                    Generate course
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
                  Multi-select off
                </span>
                <span className="text-slate-500">
                  Filter: {statusFilter} · Sort: {sortMode}
                </span>
              </div>

              {showCreateComposer && (
                <form
                  onSubmit={handleCreateCourse}
                  className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">
                        New course shell
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                        Add a course to the library
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateComposer(false)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
                    <div className="grid gap-4">
                      <input
                        ref={createTitleRef}
                        value={newCourseForm.title}
                        onChange={(event) =>
                          setNewCourseForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Course title"
                        className={inputClass}
                      />
                      <textarea
                        value={newCourseForm.summary}
                        onChange={(event) =>
                          setNewCourseForm((current) => ({
                            ...current,
                            summary: event.target.value,
                          }))
                        }
                        placeholder="Short summary"
                        className={textareaClass}
                      />
                    </div>

                    <div className="grid gap-4">
                      <input
                        value={newCourseForm.code}
                        onChange={(event) =>
                          setNewCourseForm((current) => ({
                            ...current,
                            code: event.target.value,
                          }))
                        }
                        placeholder="Course code"
                        className={inputClass}
                      />

                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Plus size={15} />
                        Create course
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
                  <div className="space-y-3">
                    {filteredCourses.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm font-semibold text-slate-500">
                        {isLoading
                          ? 'Loading courses from the backend.'
                          : 'No courses matched the current search or filter state.'}
                      </div>
                    ) : (
                      filteredCourses.map((course) => {
                        const learnerCount = learnerCountByCourse.get(course.id) || 0;
                        const courseLinks = cohortCountByCourse.get(course.id) || 0;
                        const publishLabel = getPublishLabel(course);
                        const progressLabel = getProgressLabel(learnerCount);
                        const isSelected = course.id === selectedCourseId;

                        return (
                          <div
                            key={course.id}
                            className={`rounded-[1.6rem] border px-5 py-4 transition ${
                              isSelected
                                ? 'border-[#1BD183] bg-emerald-50/70 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <button
                                type="button"
                                onClick={() => handleSelectCourse(course.id)}
                                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                              >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                                  <BookImage size={18} />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-base font-semibold text-slate-900">
                                    {course.title}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {learnerCount} learners
                                    {course.learningObjectives.length > 0
                                      ? `  ${course.learningObjectives.length} skills`
                                      : ''}
                                  </p>
                                </div>
                              </button>

                              <div className="flex flex-col gap-3 xl:items-end">
                                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                      publishLabel === 'Published'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {publishLabel}
                                  </span>
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                      progressLabel === 'Learning in progress'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {progressLabel}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                    {courseLinks} cohort{courseLinks === 1 ? '' : 's'}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 xl:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCourse(course.id)}
                                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                                    aria-label={`Delete ${course.title}`}
                                    title="Delete course"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>

        {selectedCourse ? (
          <div className="rounded-[2rem] border border-slate-200 bg-[#F4F5F2] p-4 shadow-sm md:p-6">
            {renderCourseWorkspace()}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-600">
              Select a course card to manage it inline here.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              You can update the course shell, add learning objectives, upload
              PDF sources, and review cohort usage in this panel.
            </p>
          </div>
        )}
      </div>

      <AICoursePreviewModal
        isOpen={aiModalOpen}
        course={selectedCourse}
        onClose={() => setAiModalOpen(false)}
        onSave={handleSaveAiDraft}
      />
    </>
  );
};

export default CoursesView;
