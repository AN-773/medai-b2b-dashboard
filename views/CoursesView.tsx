import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Lock, Pencil, Trash2, X } from 'lucide-react';
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
import { useItemFactory } from '@/hooks/useItemFactory';
import { useAuth } from '@/contexts/AuthContext';
import CoursesIndex, { CoursesBreadcrumb } from '@/components/academy/courses/CoursesIndex';
import CourseStepNav, {
  type StepTab,
  type WorkbenchTab,
} from '@/components/academy/courses/CourseStepNav';
import {
  CourseDetailsDialog,
  NewCourseDialog,
  type NewCourseInput,
} from '@/components/academy/courses/CourseDialogs';
import { TopBar } from '@/components/shell/TopBar';
import {
  Badge,
  Button,
  ConfirmDialog,
  InlineAlert,
  Menu,
  PageHeader,
  Spinner,
} from '@/components/ui';
import CourseOverviewPanel from '@/components/academy/course-workbench/CourseOverviewPanel';
import CourseObjectivesPanel from '@/components/academy/course-workbench/CourseObjectivesPanel';
import CourseContentPanel from '@/components/academy/course-workbench/CourseContentPanel';
import CourseResourcesPanel from '@/components/academy/course-workbench/CourseResourcesPanel';
import CourseModulesPanel from '@/components/academy/course-workbench/CourseModulesPanel';
import { ItemModality } from '@/components/academy/course-workbench/ObjectiveItemsList';
import QuestionEditor from '@/components/QuestionEditor';
import SAQEditor from '@/components/SAQEditor';
import FlashcardEditor from '@/components/FlashcardEditor';
import LectureCreationWizard from '@/components/LectureCreationWizard';
import {
  getCourseObjectiveCount,
  getCoursePendingSuggestionCount,
} from '@/components/academy/course-workbench/shared';

const CURRICULUM_STORAGE_KEY = 'msai_courses_curriculum';

const readStoredCurriculumId = () => {
  try {
    return localStorage.getItem(CURRICULUM_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Maps URL ?tab values (including legacy ones from the old 5-tab layout) onto
// the current 4-tab model so existing deep-links keep resolving.
const TAB_ALIASES: Record<string, WorkbenchTab> = {
  overview: 'overview',
  objectives: 'objectives',
  resources: 'resources',
  content: 'content',
  sessions: 'sessions',
  factory: 'objectives',
  'content-ai': 'content',
};

const normalizeTab = (value: string | null): WorkbenchTab | null =>
  (value && TAB_ALIASES[value]) || null;

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
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(
    () => normalizeTab(searchParams.get('tab')) ?? 'overview',
  );
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
      const stored = readStoredCurriculumId();
      if (stored && curricula.some((curriculum) => curriculum.id === stored)) {
        return stored;
      }
      return curricula.length === 1 ? curricula[0].id : null;
    });
  }, [curricula, isLoadingCurricula]);

  useEffect(() => {
    if (!selectedCurriculumId) return;
    try {
      localStorage.setItem(CURRICULUM_STORAGE_KEY, selectedCurriculumId);
    } catch {
      // Storage unavailable (private mode) — the choice just isn't remembered.
    }
  }, [selectedCurriculumId]);

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
    (activeTab === 'objectives' ||
      activeTab === 'content' ||
      activeTab === 'sessions') &&
      selectedCourse &&
      !selectedCourse.learningObjectivesLoaded,
  );
  // The overview reads coverage from the objectives, but renders without them.
  const shouldHydrateObjectives = Boolean(
    selectedCourse &&
      !selectedCourse.learningObjectivesLoaded &&
      (selectedCourseNeedsObjectives || activeTab === 'overview'),
  );

  // In-page content authoring — the editors render as an overlay so the
  // teacher never leaves the course page.
  const [authoring, setAuthoring] = useState<{
    modality: ItemModality;
    item: BackendApiItem | null;
  } | null>(null);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [isObjectiveFactoryOpen, setIsObjectiveFactoryOpen] = useState(false);
  const [isNewCourseOpen, setIsNewCourseOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<TeacherCourse | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [pendingModulesAction, setPendingModulesAction] = useState<
    'create-session' | null
  >(null);

  const mergeHydratedCourse = useCallback(
    (hydratedCourse: TeacherCourse, pendingDelta = 0) => {
      startTransition(() => {
        setCourses((current) =>
          current.map((candidate) =>
            candidate.id === hydratedCourse.id
              ? {
                  ...candidate,
                  learningObjectives: hydratedCourse.learningObjectives,
                  learningObjectivesLoaded: true,
                  learningObjectivesTotal: hydratedCourse.learningObjectivesTotal,
                  learningObjectivesWithoutItemsTotal:
                    hydratedCourse.learningObjectivesWithoutItemsTotal,
                  pendingLearningObjectiveSuggestionsTotal: Math.max(
                    0,
                    (candidate.pendingLearningObjectiveSuggestionsTotal || 0) + pendingDelta,
                  ),
                }
              : candidate,
          ),
        );
      });
    },
    [],
  );

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
                learningObjectivesWithoutItemsTotal:
                  hydratedCourse.learningObjectivesWithoutItemsTotal,
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
    if (!shouldHydrateObjectives || !selectedCourse) {
      return;
    }

    void loadCourseObjectives(selectedCourse).catch(() => {});
  }, [
    loadCourseObjectives,
    selectedCourse?.backendIdentifier,
    selectedCourse?.id,
    selectedCourse?.learningObjectivesLoaded,
    shouldHydrateObjectives,
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
    : 0;

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

  // Silently re-hydrate the selected course's objectives so local objective and
  // review state stay current without replacing the whole course page state.
  const refreshSelectedCourseObjectives = useCallback(async (pendingDelta = 0) => {
    if (!selectedCourse) return;
    try {
      const hydrated =
        await academyStudioBackend.loadCourseWithLearningObjectives(selectedCourse);
      mergeHydratedCourse(hydrated, pendingDelta);
    } catch (error) {
      console.error('Failed to refresh selected course objectives:', error);
    }
  }, [mergeHydratedCourse, selectedCourse]);

  const factory = useCourseFactory(selectedCourseIdentifier, (acceptedCount) => {
    void refreshSelectedCourseObjectives(-acceptedCount);
  });

  // AI content factory: AI-drafted items reviewed per learning objective.
  const itemFactory = useItemFactory(selectedCourseIdentifier, () => {
    void refreshSelectedCourseObjectives();
  });

  const handleSaveItem = async (request: ItemUpsertRequest) => {
    try {
      await testsService.upsertItem(request);
      setAuthoring(null);
      setContentRefreshKey((key) => key + 1);
      flashMessage('Item saved.');
      void refreshSelectedCourseObjectives();
    } catch (error) {
      reportError(error, 'Unable to save this item.');
    }
  };

  // Restore the active tab when navigating back (e.g. returning from the
  // content workbench via a `?tab=content` redirect).
  useEffect(() => {
    const normalized = normalizeTab(searchParams.get('tab'));
    if (normalized && normalized !== activeTab) {
      setActiveTab(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectTab = useCallback((tab: WorkbenchTab) => {
    setActiveTab(tab);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', tab);
      return next;
    });
  }, [setSearchParams]);

  const handleCreateSessionFromContent = useCallback(() => {
    setPendingModulesAction('create-session');
    selectTab('sessions');
  }, [selectTab]);

  const handleModulesActionHandled = useCallback(() => {
    setPendingModulesAction(null);
  }, []);

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

  const handleCreateCourse = async (input: NewCourseInput) => {
    try {
      const saved = await academyStudioBackend.saveCourse({
        title: input.title.trim(),
        summary: input.summary.trim(),
        curriculumId: input.curriculumId,
        contentDrafts: [],
      });
      await loadData(saved.id);
      setSelectedCurriculumId(input.curriculumId);
      pendingCourseIdRef.current = saved.id;
      setSearchParams({ courseId: saved.id });
      setActiveTab('overview');
      flashMessage('Course created.');
    } catch (error) {
      reportError(error, 'Unable to create this course.');
      throw error;
    }
  };

  const handleSaveCourse = async (data: {
    title: string;
    summary: string;
    locked: boolean;
  }) => {
    if (!selectedCourse || !data.title.trim()) return;
    try {
      const saved = await academyStudioBackend.saveCourse({
        id: selectedCourse.id,
        backendIdentifier: selectedCourse.backendIdentifier,
        teacherId: selectedCourse.teacherId,
        curriculumId: selectedCourse.curriculumId,
        title: data.title.trim(),
        summary: data.summary.trim(),
        locked: data.locked,
      });
      await loadData(saved.id);
      flashMessage('Course details saved.');
    } catch (error) {
      reportError(error, 'Unable to save this course.');
      throw error;
    }
  };

  const handleDeleteCourse = async () => {
    const course = courseToDelete;
    if (!course) return;
    setIsDeletingCourse(true);
    try {
      await academyStudioBackend.deleteCourse(course);
      if (selectedCourseId === course.id) {
        pendingCourseIdRef.current = null;
        setSelectedCourseId(null);
        setSearchParams({});
      }
      setCourseToDelete(null);
      await loadData();
      flashMessage(`Deleted "${course.title}".`);
    } catch (error) {
      reportError(error, `Unable to delete "${course.title}".`);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const handleBackToCourses = () => {
    pendingCourseIdRef.current = null;
    setSelectedCourseId(null);
    setActiveTab('overview');
    setSearchParams({});
  };

  const handleAttachObjective = async (objective: TeacherLearningObjective) => {
    if (!selectedCourse || selectedCourseObjectiveIds.has(objective.id)) return;
    try {
      await academyStudioBackend.attachCourseLearningObjectives(selectedCourse, [
        objective,
      ]);
      await loadData(selectedCourse.id);
      flashMessage('Objective attached.');
    } catch (error) {
      reportError(error, 'Unable to attach this learning objective.');
    }
  };

  const handleAddAllObjectives = async (filters: {
    q?: string;
    organSystemId?: string;
    topicId?: string;
    syndromeId?: string;
  }) => {
    if (!selectedCourse) {
      return { matched: 0, added: 0, alreadyAttached: 0 };
    }
    try {
      const result = await academyStudioBackend.addAllCourseLearningObjectives(
        selectedCourse,
        filters,
      );
      await refreshSelectedCourseObjectives();
      flashMessage(
        result.added === 1
          ? 'Added 1 objective from the catalog.'
          : `Added ${result.added} objectives from the catalog.`,
      );
      return result;
    } catch (error) {
      reportError(error, 'Unable to add all matching learning objectives.');
      throw error;
    }
  };

  const handleCreateObjective = async (objective: TeacherLearningObjective) => {
    if (!selectedCourse) return;
    // Created objectives surface their own error in the modal, so let failures
    // propagate rather than swallowing them with reportError.
    await academyStudioBackend.attachCourseLearningObjectives(selectedCourse, [
      objective,
    ]);
    await loadData(selectedCourse.id);
    flashMessage('New objective created and attached.');
  };

  const handleRemoveObjective = async (objective: TeacherLearningObjective) => {
    if (!selectedCourse) return;
    try {
      await academyStudioBackend.removeCourseLearningObjective(
        selectedCourse,
        objective.id,
      );
      await loadData(selectedCourse.id);
      flashMessage('Objective removed.');
    } catch (error) {
      reportError(error, 'Unable to remove this learning objective.');
    }
  };

  // --- Render ---------------------------------------------------------------
  // Placeholder for tabs that need the course's objectives hydrated first.
  const renderObjectivesGate = (course: TeacherCourse) => {
    const objectiveError = courseObjectiveErrors[course.id] || null;
    return objectiveError ? (
      <InlineAlert
        title="Couldn't load this course's objectives"
        action={
          <Button
            size="sm"
            variant="secondary"
            loading={loadingCourseObjectivesId === course.id}
            onClick={() => void loadCourseObjectives(course)}
          >
            Retry
          </Button>
        }
      >
        {objectiveError}
      </InlineAlert>
    ) : (
      <Spinner label="Loading objectives…" className="py-24" />
    );
  };

  const objectivesCoverageFigure = (() => {
    if (!selectedCourse?.learningObjectivesLoaded) return undefined;
    const total = selectedCourse.learningObjectives.length;
    if (total === 0) return undefined;
    const covered = selectedCourse.learningObjectives.filter(
      (objective) => (objective.itemTotals?.total ?? 0) > 0,
    ).length;
    return { percent: Math.round((covered / total) * 100), complete: covered === total };
  })();

  const tabs: StepTab[] = [
    { id: 'overview', label: 'Overview' },
    {
      id: 'objectives',
      label: 'Objectives',
      step: 1,
      figure: selectedCourseObjectiveCount ? selectedCourseObjectiveCount.toLocaleString() : undefined,
      done: selectedCourseObjectiveCount > 0 && selectedCoursePendingSuggestions === 0,
      attention: selectedCoursePendingSuggestions > 0,
    },
    {
      id: 'content',
      label: 'Content',
      step: 2,
      figure: objectivesCoverageFigure ? `${objectivesCoverageFigure.percent}%` : undefined,
      done: objectivesCoverageFigure?.complete,
    },
    { id: 'sessions', label: 'Modules', step: 3 },
    { id: 'resources', label: 'Resources' },
  ];

  const renderPanel = (course: TeacherCourse) => {
    switch (activeTab) {
      case 'overview':
        return (
          <CourseOverviewPanel
            course={course}
            cohortsUsingCourse={cohortsUsingSelectedCourse}
            learnerCount={learnerCountByCourse.get(course.id) || 0}
            pendingSuggestions={selectedCoursePendingSuggestions}
            onNavigate={selectTab}
            onReviewSuggestions={() => {
              setIsObjectiveFactoryOpen(true);
              selectTab('objectives');
            }}
            onEditDetails={() => setIsDetailsOpen(true)}
          />
        );
      case 'objectives':
        return selectedCourseNeedsObjectives ? (
          renderObjectivesGate(course)
        ) : (
          <CourseObjectivesPanel
            course={course}
            attachedIds={selectedCourseObjectiveIds}
            factory={factory}
            isGenerateOpen={isObjectiveFactoryOpen}
            onGenerateOpenChange={setIsObjectiveFactoryOpen}
            onAttach={handleAttachObjective}
            onAddAll={handleAddAllObjectives}
            onCreate={handleCreateObjective}
            onRemove={handleRemoveObjective}
            onBuildContent={(objective) => {
              itemFactory.selectObjective(objective.id);
              selectTab('content');
            }}
          />
        );
      case 'content':
        return selectedCourseNeedsObjectives ? (
          renderObjectivesGate(course)
        ) : (
          <CourseContentPanel
            course={course}
            itemFactory={itemFactory}
            onCreateItem={handleCreateItem}
            onCreateSession={handleCreateSessionFromContent}
            onOpenItem={(item) => void handleOpenItem(item)}
            refreshSignal={contentRefreshKey}
          />
        );
      case 'sessions':
        return selectedCourseNeedsObjectives ? (
          renderObjectivesGate(course)
        ) : (
          <CourseModulesPanel
            course={course}
            entryAction={pendingModulesAction}
            onEntryActionHandled={handleModulesActionHandled}
          />
        );
      case 'resources':
        return <CourseResourcesPanel course={course} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      {!selectedCourse ? (
        <CoursesIndex
          curricula={curricula}
          selectedCurriculum={selectedCurriculum}
          isLoadingCurricula={isLoadingCurricula}
          curriculumError={curriculumError}
          onCurriculumChange={handleCurriculumChange}
          courses={curriculumCourses}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          cohortCountByCourse={cohortCountByCourse}
          onOpenCourse={handleSelectCourse}
          onNewCourse={() => setIsNewCourseOpen(true)}
        />
      ) : (
        <>
          <TopBar>
            <CoursesBreadcrumb
              courseTitle={selectedCourse.title}
              onCoursesClick={handleBackToCourses}
            />
          </TopBar>
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-5 pt-6 sm:px-8">
            <PageHeader
              title={selectedCourse.title}
              description={selectedCourse.summary || undefined}
              meta={
                <>
                  {selectedCourse.locked && (
                    <Badge
                      tone="neutral"
                      icon={Lock}
                      title="Only items linked to this course's objectives are delivered"
                    >
                      Locked
                    </Badge>
                  )}
                  {selectedCurriculum && (
                    <span className="text-[13px] text-stone-400">{selectedCurriculum.title}</span>
                  )}
                </>
              }
              actions={
                <>
                  <Button variant="secondary" icon={Pencil} onClick={() => setIsDetailsOpen(true)}>
                    Edit details
                  </Button>
                  <Menu
                    label="Course actions"
                    items={[
                      {
                        label: 'Delete course',
                        icon: Trash2,
                        tone: 'danger',
                        onSelect: () => setCourseToDelete(selectedCourse),
                      },
                    ]}
                  />
                </>
              }
            />
          </div>
          <CourseStepNav tabs={tabs} active={activeTab} onSelect={selectTab} />
          <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
            {renderPanel(selectedCourse)}
          </div>

          <CourseDetailsDialog
            open={isDetailsOpen}
            course={selectedCourse}
            onClose={() => setIsDetailsOpen(false)}
            onSave={handleSaveCourse}
          />
        </>
      )}

      <NewCourseDialog
        open={isNewCourseOpen}
        curricula={curricula}
        defaultCurriculumId={selectedCurriculumId}
        onClose={() => setIsNewCourseOpen(false)}
        onCreate={handleCreateCourse}
      />

      <ConfirmDialog
        open={Boolean(courseToDelete)}
        title="Delete course?"
        description={
          <>
            <span className="font-medium text-stone-900">{courseToDelete?.title}</span> will be
            permanently deleted. This can't be undone.
          </>
        }
        confirmLabel="Delete course"
        busy={isDeletingCourse}
        onConfirm={() => void handleDeleteCourse()}
        onCancel={() => setCourseToDelete(null)}
      />

      {/* Item editors open full-screen over the course so authoring never leaves the page. */}
      {authoring && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-canvas p-4 custom-scrollbar sm:p-6">
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

      {/* Toasts */}
      {(message || loadError) && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-1/2 z-[140] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
        >
          {message && (
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in">
              <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" />
              <span className="flex-1">{message}</span>
              <button
                type="button"
                onClick={() => setMessage(null)}
                aria-label="Dismiss"
                className="rounded p-0.5 text-stone-400 transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {loadError && (
            <div
              role="alert"
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-pop animate-dialog-in"
            >
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
              <p className="flex-1">{loadError}</p>
              <button
                type="button"
                onClick={() => setLoadError(null)}
                aria-label="Dismiss"
                className="rounded p-0.5 text-red-400 transition hover:text-red-700"
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
