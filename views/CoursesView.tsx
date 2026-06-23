import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Layers,
  Library,
  Loader2,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { curriculumService } from '@/services/curriculumService';
import { resourceIdentifier } from '@/utils/resourceId';
import {
  TeacherCourse,
  TeacherCohort,
  TeacherLearningObjective,
} from '@/types/AcademyStudioTypes';
import type {
  BackendApiItem,
  Curriculum,
  ItemUpsertRequest,
} from '@/types/TestsServiceTypes';
import { testsService } from '@/services/testsService';
import { useCourseFactory } from '@/hooks/useCourseFactory';
import { useAuth } from '@/contexts/AuthContext';
import CourseLibrarySidebar from '@/components/academy/course-workbench/CourseLibrarySidebar';
import CourseOverviewPanel from '@/components/academy/course-workbench/CourseOverviewPanel';
import CourseObjectivesPanel from '@/components/academy/course-workbench/CourseObjectivesPanel';
import CourseContentPanel from '@/components/academy/course-workbench/CourseContentPanel';
import CourseFactoryPanel from '@/components/academy/course-workbench/CourseFactoryPanel';
import ObjectiveItemsDrawer, {
  ItemModality,
} from '@/components/academy/course-workbench/ObjectiveItemsDrawer';
import QuestionEditor from '@/components/QuestionEditor';
import SAQEditor from '@/components/SAQEditor';
import FlashcardEditor from '@/components/FlashcardEditor';
import LectureCreationWizard from '@/components/LectureCreationWizard';
import {
  getCourseObjectiveCount,
  getCoursePendingSuggestionCount,
  getCourseStage,
  STAGE_STYLES,
} from '@/components/academy/course-workbench/shared';

type WorkbenchTab = 'overview' | 'objectives' | 'content' | 'factory';

const isWorkbenchTab = (value: string | null): value is WorkbenchTab =>
  value === 'overview' ||
  value === 'objectives' ||
  value === 'content' ||
  value === 'factory';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const courseIdentifierOf = (course: TeacherCourse) =>
  course.backendIdentifier || resourceIdentifier(course.id);

const CoursesView: React.FC = () => {
  const { currentUser, isSuperadmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCurricula, setIsLoadingCurricula] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(() => {
    const tabParam = searchParams.get('tab');
    return isWorkbenchTab(tabParam) ? tabParam : 'overview';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingCourseObjectivesId, setLoadingCourseObjectivesId] = useState<
    string | null
  >(null);
  const pendingCourseIdRef = useRef<string | null | undefined>(undefined);
  const [courseObjectiveErrors, setCourseObjectiveErrors] = useState<
    Record<string, string>
  >({});
  const canManage =
    isSuperadmin ||
    currentUser?.role === 'Administrator' ||
    currentUser?.tenantRole === 'admin' ||
    currentUser?.tenantRole === 'owner';

  const loadData = async (preserveId?: string) => {
    setIsLoading(true);
    try {
      const snapshot = await academyStudioBackend.loadCatalogSnapshot();
      setCourses(snapshot.courses);
      setCohorts(snapshot.cohorts);
      setLoadError(null);
      if (preserveId) setSelectedCourseId(preserveId);
    } catch (error) {
      console.error('Failed to load academy studio data:', error);
      setLoadError(getErrorMessage(error, 'Unable to load courses from the backend.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    let active = true;

    const loadCurricula = async () => {
      setIsLoadingCurricula(true);
      try {
        const response = await curriculumService.getCurricula(
          1,
          200,
          false,
          undefined,
          canManage ? 'management' : undefined,
        );
        if (!active) return;
        setCurricula(response.items ?? []);
        setCurriculumError(null);
      } catch (error) {
        console.error('Failed to load curricula for course workbench:', error);
        if (!active) return;
        setCurricula([]);
        setCurriculumError('Unable to load curricula.');
      } finally {
        if (active) setIsLoadingCurricula(false);
      }
    };

    void loadCurricula();

    return () => {
      active = false;
    };
  }, [canManage]);

  useEffect(() => {
    if (isLoadingCurricula) return;

    setSelectedCurriculumId((current) => {
      if (current && curricula.some((curriculum) => curriculum.id === current)) {
        return current;
      }
      return curricula.length === 1 ? curricula[0].id : null;
    });
  }, [curricula, isLoadingCurricula]);

  // Deep-link restore: infer the curriculum from a ?courseId so a direct link
  // — or returning from the content workbench — re-scopes to the right track
  // instead of dropping the teacher on the empty "select a curriculum" state.
  useEffect(() => {
    if (isLoadingCurricula) return;
    const queryCourseId = searchParams.get('courseId');
    if (!queryCourseId) return;

    const alreadyScoped =
      selectedCurriculumId &&
      courses.some(
        (course) =>
          course.id === queryCourseId &&
          course.curriculumId === selectedCurriculumId,
      );
    if (alreadyScoped) return;

    const course = courses.find((entry) => entry.id === queryCourseId);
    if (
      course?.curriculumId &&
      course.curriculumId !== selectedCurriculumId &&
      curricula.some((curriculum) => curriculum.id === course.curriculumId)
    ) {
      setSelectedCurriculumId(course.curriculumId);
    }
  }, [courses, curricula, isLoadingCurricula, searchParams, selectedCurriculumId]);

  const selectedCurriculum =
    curricula.find((curriculum) => curriculum.id === selectedCurriculumId) || null;

  const curriculumCourses = useMemo(
    () =>
      selectedCurriculumId
        ? courses.filter((course) => course.curriculumId === selectedCurriculumId)
        : [],
    [courses, selectedCurriculumId],
  );

  // Keep selection in sync with ?courseId and the active curriculum scope.
  useEffect(() => {
    const queryCourseId = searchParams.get('courseId');
    if (isLoadingCurricula || !selectedCurriculumId) {
      return;
    }

    if (
      pendingCourseIdRef.current !== undefined &&
      queryCourseId !== pendingCourseIdRef.current
    ) {
      return;
    }

    if (
      queryCourseId &&
      curriculumCourses.some((course) => course.id === queryCourseId)
    ) {
      pendingCourseIdRef.current = undefined;
      setSelectedCourseId(queryCourseId);
      return;
    }

    if (pendingCourseIdRef.current === null && !queryCourseId) {
      pendingCourseIdRef.current = undefined;
      setSelectedCourseId(null);
      return;
    }

    pendingCourseIdRef.current = undefined;

    if (
      selectedCourseId &&
      !curriculumCourses.some((course) => course.id === selectedCourseId)
    ) {
      setSelectedCourseId(null);
    }
  }, [
    curriculumCourses,
    isLoadingCurricula,
    searchParams,
    selectedCourseId,
    selectedCurriculumId,
  ]);

  const selectedCourse =
    curriculumCourses.find((course) => course.id === selectedCourseId) || null;
  const selectedCourseIdentifier = selectedCourse
    ? courseIdentifierOf(selectedCourse)
    : null;
  const selectedCourseNeedsObjectives = Boolean(
    (activeTab === 'objectives' || activeTab === 'content') &&
      selectedCourse &&
      !selectedCourse.learningObjectivesLoaded,
  );

  // In-page content authoring — the editors render as an overlay so the
  // teacher never leaves the course page.
  const [manageObjective, setManageObjective] =
    useState<TeacherLearningObjective | null>(null);
  const [authoring, setAuthoring] = useState<{
    modality: ItemModality;
    item: BackendApiItem | null;
  } | null>(null);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);

  const factory = useCourseFactory(selectedCourseIdentifier, () => {
    if (selectedCourseId) void loadData(selectedCourseId);
  });

  const loadCourseObjectives = useCallback(async (course: TeacherCourse) => {
    if (course.learningObjectivesLoaded) {
      return course;
    }

    setLoadingCourseObjectivesId(course.id);
    setCourseObjectiveErrors((current) => {
      if (!current[course.id]) return current;
      const next = { ...current };
      delete next[course.id];
      return next;
    });

    try {
      const hydratedCourse =
        await academyStudioBackend.loadCourseWithLearningObjectives(course);
      setCourses((current) =>
        current.map((candidate) =>
          candidate.id === hydratedCourse.id
            ? {
                ...candidate,
                learningObjectives: hydratedCourse.learningObjectives,
                learningObjectivesLoaded: true,
                learningObjectivesTotal: hydratedCourse.learningObjectivesTotal,
              }
            : candidate,
        ),
      );
      return hydratedCourse;
    } catch (error) {
      console.error(
        `Failed to load learning objectives for course "${course.title}".`,
        error,
      );
      setCourseObjectiveErrors((current) => ({
        ...current,
        [course.id]: getErrorMessage(
          error,
          'Unable to load this course\'s learning objectives.',
        ),
      }));
      throw error;
    } finally {
      setLoadingCourseObjectivesId((current) =>
        current === course.id ? null : current,
      );
    }
  }, []);

  useEffect(() => {
    if (!selectedCourseNeedsObjectives || !selectedCourse) {
      return;
    }

    void loadCourseObjectives(selectedCourse).catch(() => {});
  }, [
    loadCourseObjectives,
    selectedCourse?.backendIdentifier,
    selectedCourse?.id,
    selectedCourse?.learningObjectivesLoaded,
    selectedCourseNeedsObjectives,
  ]);

  // --- Derived cohort/learner maps -----------------------------------------
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
    const sets = new Map<string, Set<string>>();
    cohorts.forEach((cohort) => {
      cohort.courseIds.forEach((courseId) => {
        const learners = sets.get(courseId) || new Set<string>();
        cohort.studentIds.forEach((studentId) => learners.add(studentId));
        sets.set(courseId, learners);
      });
    });
    return new Map(
      Array.from(sets.entries()).map(([courseId, learners]) => [courseId, learners.size]),
    );
  }, [cohorts]);

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return curriculumCourses.filter((course) => {
      if (!query) return true;
      return [course.title, course.code, course.summary]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [curriculumCourses, searchQuery]);

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

  const selectedCourseObjectiveCount = selectedCourse
    ? getCourseObjectiveCount(selectedCourse)
    : 0;
  const selectedCoursePendingSuggestions = selectedCourse
    ? getCoursePendingSuggestionCount(selectedCourse)
    : factory.stats.pending;

  const totals = useMemo(
    () => ({
      courses: curriculumCourses.length,
      objectives: curriculumCourses.reduce(
        (count, course) => count + getCourseObjectiveCount(course),
        0,
      ),
      reviews: curriculumCourses.reduce(
        (count, course) => count + getCoursePendingSuggestionCount(course),
        0,
      ),
    }),
    [curriculumCourses],
  );

  const flashMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((current) => (current === text ? null : current)), 3200);
  };

  const reportError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    setLoadError(getErrorMessage(error, fallback));
  };

  // --- In-page content authoring -------------------------------------------
  const makeItemSkeleton = (
    modality: ItemModality,
    learningObjectiveId: string,
  ): BackendApiItem => ({
    id: '',
    identifier: '',
    type: modality,
    status: 'draft',
    learningObjectiveId: learningObjectiveId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mcq: modality === 'mcq' ? { stem: '', choices: [] } : null,
    saq: null,
    lecture: null,
    flashcard: null,
    tags: [],
  });

  const handleCreateItem = (modality: ItemModality, objectiveId: string) => {
    setAuthoring({ modality, item: makeItemSkeleton(modality, objectiveId) });
  };

  const handleOpenItem = async (item: BackendApiItem) => {
    const modality = item.type as ItemModality;
    // Open immediately with the list payload, then swap in the full record so
    // editors that need nested data (e.g. MCQ choices) get it.
    setAuthoring({ modality, item });
    try {
      const full = await testsService.getItem(item.identifier || item.id);
      setAuthoring((current) =>
        current && current.item?.id === item.id
          ? { modality, item: full }
          : current,
      );
    } catch (error) {
      console.error('Failed to load full item for editing:', error);
    }
  };

  // Silently re-hydrate the selected course's objectives so per-objective item
  // totals (itemTotals) reflect a just-authored item, without flashing the
  // objectives loading gate behind the drawer.
  const refreshSelectedCourseObjectiveTotals = async () => {
    if (!selectedCourse) return;
    try {
      const hydrated =
        await academyStudioBackend.loadCourseWithLearningObjectives(selectedCourse);
      setCourses((current) =>
        current.map((candidate) =>
          candidate.id === hydrated.id
            ? {
                ...candidate,
                learningObjectives: hydrated.learningObjectives,
                learningObjectivesLoaded: true,
                learningObjectivesTotal: hydrated.learningObjectivesTotal,
              }
            : candidate,
        ),
      );
    } catch (error) {
      console.error('Failed to refresh objective item totals:', error);
    }
  };

  const handleSaveItem = async (request: ItemUpsertRequest) => {
    try {
      await testsService.upsertItem(request);
      setAuthoring(null);
      setContentRefreshKey((key) => key + 1);
      flashMessage('Item saved.');
      void refreshSelectedCourseObjectiveTotals();
    } catch (error) {
      reportError(error, 'Unable to save this item.');
    }
  };

  // Restore the active tab when navigating back (e.g. returning from the
  // content workbench via a `?tab=content` redirect).
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (isWorkbenchTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectTab = (tab: WorkbenchTab) => {
    setActiveTab(tab);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', tab);
      return next;
    });
  };

  // --- Course CRUD ----------------------------------------------------------
  const handleSelectCourse = (courseId: string) => {
    pendingCourseIdRef.current = courseId;
    setSelectedCourseId(courseId);
    setActiveTab('overview');
    setSearchParams({ courseId });
  };

  const handleCurriculumChange = (curriculumId: string | null) => {
    setSelectedCurriculumId(curriculumId);
    setSelectedCourseId(null);
    pendingCourseIdRef.current = null;
    setSearchQuery('');
    setActiveTab('overview');
    setSearchParams({});
  };

  const handleCreateCourse = async (input: {
    title: string;
    code: string;
    summary: string;
  }) => {
    if (!selectedCurriculum) return;
    try {
      const saved = await academyStudioBackend.saveCourse({
        title: input.title.trim(),
        code: input.code.trim(),
        summary: input.summary.trim(),
        curriculumId: selectedCurriculum.id,
        learningObjectives: [],
        contentDrafts: [],
      });
      await loadData(saved.id);
      pendingCourseIdRef.current = saved.id;
      setSearchParams({ courseId: saved.id });
      setActiveTab('overview');
      flashMessage('Course created.');
    } catch (error) {
      reportError(error, 'Unable to create this course.');
    }
  };

  const handleSaveCourse = async (data: {
    title: string;
    code: string;
    summary: string;
  }) => {
    if (!selectedCourse || !data.title.trim()) return;
    try {
      const saved = await academyStudioBackend.saveCourse({
        ...selectedCourse,
        title: data.title.trim(),
        code: data.code.trim(),
        summary: data.summary.trim(),
      });
      await loadData(saved.id);
      flashMessage('Course details saved.');
    } catch (error) {
      reportError(error, 'Unable to save this course.');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    const course = courses.find((entry) => entry.id === courseId);
    if (!course) return;
    if (!window.confirm(`Delete course "${course.title}"? This cannot be undone.`)) return;
    try {
      await academyStudioBackend.deleteCourse(course);
      if (selectedCourseId === course.id) {
        pendingCourseIdRef.current = null;
        setSelectedCourseId(null);
        setSearchParams({});
      }
      await loadData();
      flashMessage(`Deleted "${course.title}".`);
    } catch (error) {
      reportError(error, `Unable to delete "${course.title}".`);
    }
  };

  const handleAttachObjective = async (objective: TeacherLearningObjective) => {
    if (!selectedCourse || selectedCourseObjectiveIds.has(objective.id)) return;
    try {
      await academyStudioBackend.saveCourseLearningObjectives(selectedCourse, [
        ...selectedCourse.learningObjectives,
        objective,
      ]);
      await loadData(selectedCourse.id);
      flashMessage('Objective attached.');
    } catch (error) {
      reportError(error, 'Unable to attach this learning objective.');
    }
  };

  const handleCreateObjective = async (objective: TeacherLearningObjective) => {
    if (!selectedCourse) return;
    // Created objectives surface their own error in the modal, so let failures
    // propagate rather than swallowing them with reportError.
    await academyStudioBackend.saveCourseLearningObjectives(selectedCourse, [
      ...selectedCourse.learningObjectives,
      objective,
    ]);
    await loadData(selectedCourse.id);
    flashMessage('New objective created and attached.');
  };

  const handleRemoveObjective = async (objective: TeacherLearningObjective) => {
    if (!selectedCourse) return;
    if (!window.confirm(`Remove "${objective.title}" from ${selectedCourse.title}?`)) return;
    try {
      await academyStudioBackend.saveCourseLearningObjectives(
        selectedCourse,
        selectedCourse.learningObjectives.filter((candidate) => candidate.id !== objective.id),
      );
      await loadData(selectedCourse.id);
      flashMessage('Objective removed.');
    } catch (error) {
      reportError(error, 'Unable to remove this learning objective.');
    }
  };

  // --- Render ---------------------------------------------------------------
  // Shared loading/error placeholder for tabs that depend on the course's
  // learning objectives being hydrated (Objectives + Content).
  const renderObjectivesGate = (course: TeacherCourse) => {
    const objectiveError = courseObjectiveErrors[course.id] || null;
    return objectiveError ? (
      <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        <p className="font-semibold">{objectiveError}</p>
        <button
          type="button"
          onClick={() => void loadCourseObjectives(course)}
          disabled={loadingCourseObjectivesId === course.id}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingCourseObjectivesId === course.id ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          Retry
        </button>
      </div>
    ) : (
      <div className="flex min-h-[240px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 text-sm font-semibold text-slate-500">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Loading course objectives...
      </div>
    );
  };

  const tabs: { id: WorkbenchTab; label: string; icon: typeof Target; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Target },
    {
      id: 'objectives',
      label: 'Objectives',
      icon: BookOpen,
      badge: selectedCourseObjectiveCount,
    },
    { id: 'content', label: 'Content', icon: Library },
    {
      id: 'factory',
      label: 'AI Factory',
      icon: Sparkles,
      badge: selectedCoursePendingSuggestions,
    },
  ];

  return (
    <div className="teacher-readable relative flex h-[calc(100vh-140px)] overflow-hidden rounded-[1rem] border border-slate-200 bg-white font-sans text-slate-900">
      <CourseLibrarySidebar
        curricula={curricula}
        selectedCurriculum={selectedCurriculum}
        isLoadingCurricula={isLoadingCurricula}
        curriculumError={curriculumError}
        onCurriculumChange={handleCurriculumChange}
        courses={curriculumCourses}
        filteredCourses={filteredCourses}
        selectedCourseId={selectedCourseId}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={handleSelectCourse}
        onDelete={handleDeleteCourse}
        onCreateCourse={handleCreateCourse}
        totals={totals}
        cohortCountByCourse={cohortCountByCourse}
        learnerCountByCourse={learnerCountByCourse}
      />

      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {!selectedCurriculum ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-slate-400">
            <Layers size={48} className="mb-5 opacity-30" />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Select a curriculum
            </p>
            <p className="mt-2 max-w-sm text-xs font-medium">
              Choose the curriculum first, then the course library will scope to
              that track and new courses will be created inside it.
            </p>
          </div>
        ) : !selectedCourse ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-slate-400">
            <Layers size={48} className="mb-5 opacity-30" />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Select a course
            </p>
            <p className="mt-2 max-w-sm text-xs font-medium">
              Pick a course from {selectedCurriculum.title} to manage its shell,
              attach learning objectives, and run the AI objective factory on
              uploaded sources.
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="border-b border-slate-100 px-6 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="truncate text-2xl font-black tracking-tight text-slate-900">
                      {selectedCourse.title}
                    </h2>
                    {selectedCourse.code && (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                        {selectedCourse.code}
                      </span>
                    )}
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${STAGE_STYLES[getCourseStage(selectedCourse)]}`}
                    >
                      {getCourseStage(selectedCourse)}
                    </span>
                  </div>
                  {selectedCourse.summary && (
                    <p className="mt-1.5 max-w-2xl truncate text-sm text-slate-500">
                      {selectedCourse.summary}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteCourse(selectedCourse.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex items-center gap-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => selectTab(tab.id)}
                      className={`relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition ${
                        isActive
                          ? 'border-[#1BD183] text-slate-900'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                      {tab.badge ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                            tab.id === 'factory'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto bg-white p-6 custom-scrollbar">
              {activeTab === 'overview' && (
                <CourseOverviewPanel
                  course={selectedCourse}
                  cohortsUsingCourse={cohortsUsingSelectedCourse}
                  learnerCount={learnerCountByCourse.get(selectedCourse.id) || 0}
                  pendingSuggestions={selectedCoursePendingSuggestions}
                  onSave={handleSaveCourse}
                />
              )}
              {activeTab === 'objectives' && (
                selectedCourseNeedsObjectives ? (
                  renderObjectivesGate(selectedCourse)
                ) : (
                  <CourseObjectivesPanel
                    course={selectedCourse}
                    attachedIds={selectedCourseObjectiveIds}
                    onAttach={handleAttachObjective}
                    onCreate={handleCreateObjective}
                    onRemove={handleRemoveObjective}
                    onManageItems={setManageObjective}
                  />
                )
              )}
              {activeTab === 'content' && (
                selectedCourseNeedsObjectives ? (
                  renderObjectivesGate(selectedCourse)
                ) : (
                  <CourseContentPanel
                    course={selectedCourse}
                    onManageObjective={setManageObjective}
                    onManageObjectives={() => selectTab('objectives')}
                  />
                )
              )}
              {activeTab === 'factory' && <CourseFactoryPanel factory={factory} />}
            </div>
          </>
        )}
      </div>

      {/* Per-objective content drawer (author / inspect items in place) */}
      {manageObjective && (
        <ObjectiveItemsDrawer
          objectiveId={manageObjective.id}
          objectiveTitle={manageObjective.title}
          refreshSignal={contentRefreshKey}
          onCreate={handleCreateItem}
          onOpenItem={(item) => void handleOpenItem(item)}
          onClose={() => setManageObjective(null)}
        />
      )}

      {/* In-page item editor overlay — keeps authoring inside the course page */}
      {authoring && (
        <div className="absolute inset-0 z-[70] overflow-y-auto bg-slate-50 p-4 custom-scrollbar sm:p-6">
          {authoring.modality === 'mcq' && (
            <QuestionEditor
              initialQuestion={authoring.item}
              onBack={() => setAuthoring(null)}
              onSave={handleSaveItem}
            />
          )}
          {authoring.modality === 'saq' && (
            <SAQEditor
              initialQuestion={authoring.item}
              onBack={() => setAuthoring(null)}
              onSave={handleSaveItem}
            />
          )}
          {authoring.modality === 'flashcard' && (
            <FlashcardEditor
              initialQuestion={authoring.item}
              onBack={() => setAuthoring(null)}
              onSave={handleSaveItem}
            />
          )}
          {authoring.modality === 'lecture' && (
            <LectureCreationWizard
              initialItem={authoring.item}
              onBack={() => setAuthoring(null)}
              onComplete={handleSaveItem}
            />
          )}
        </div>
      )}

      {/* Floating toasts — overlay so they never shift the layout */}
      {(message || loadError) && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[120] flex w-[min(92vw,360px)] flex-col gap-2">
          {message && (
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-xl shadow-emerald-900/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-500" />
              <span className="flex-1">{message}</span>
              <button
                onClick={() => setMessage(null)}
                className="rounded-lg p-0.5 text-emerald-400 transition hover:bg-emerald-50"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {loadError && (
            <div className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-white px-4 py-3 shadow-xl shadow-rose-900/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-rose-500" />
              <p className="flex-1 text-sm font-semibold text-rose-700">{loadError}</p>
              <button
                onClick={() => setLoadError(null)}
                className="rounded-lg p-0.5 text-rose-400 transition hover:bg-rose-100"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoursesView;
