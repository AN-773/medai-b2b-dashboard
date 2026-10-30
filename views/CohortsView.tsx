import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BookOpen, ChevronLeft, Pencil, Send, Trash2 } from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import {
  CohortStudyPlanJob,
  TeacherCohort,
  TeacherCourse,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';
import {
  Badge,
  Button,
  ConfirmDialog,
  InlineAlert,
  Menu,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { AskAboutCohortButton } from '@/components/ask/AskAboutCohortButton';
import CohortsIndex from '@/components/cohorts/CohortsIndex';
import CohortTabs, { type CohortTab, type CohortTabItem } from '@/components/cohorts/CohortTabs';
import CohortOverviewPanel from '@/components/cohorts/CohortOverviewPanel';
import CohortLearnersPanel from '@/components/cohorts/CohortLearnersPanel';
import CohortCoursesPanel from '@/components/cohorts/CohortCoursesPanel';
import AttachCoursesDrawer from '@/components/cohorts/AttachCoursesDrawer';
import CourseDeliveryDrawer from '@/components/cohorts/CourseDeliveryDrawer';
import CohortDetailsDialog from '@/components/cohorts/CohortDetailsDialog';
import CohortToasts from '@/components/cohorts/CohortToasts';
import {
  PUBLISH_STATE_META,
  cohortToForm,
  formatDateRange,
  getCohortDateRangeError,
  getCohortPublishReadiness,
  getCohortPublishState,
  getCourseMissingItemCount,
  getErrorMessage,
  getIdSuffix,
  getLockedCoverageMessage,
  getLockedSelectionMissingItemCount,
  plural,
  type CohortFormValues,
  type CohortPublishState,
} from '@/components/cohorts/cohortModel';

const PUBLISH_POLL_INTERVAL_MS = 5000;
const STUDENT_PAGE_SIZE = 25;
const TOAST_DURATION_MS = 3200;

const CohortsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentRequestIdRef = useRef(0);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [isStudentLoading, setIsStudentLoading] = useState(false);
  const [studentLoadError, setStudentLoadError] = useState<string | null>(null);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [cohortPublishJobs, setCohortPublishJobs] = useState<
    Record<string, CohortStudyPlanJob | null>
  >({});
  const [pendingPublishIds, setPendingPublishIds] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Loading the cohort catalog failed (shown inline with a retry). */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** A mutation failed or was blocked (shown as an error toast). */
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingCourseObjectivesId, setLoadingCourseObjectivesId] = useState<
    string | null
  >(null);
  const [courseObjectiveErrors, setCourseObjectiveErrors] = useState<
    Record<string, string>
  >({});
  const cohortRequestPendingRef = useRef(false);
  const [isCohortRequestPending, setIsCohortRequestPending] = useState(false);
  const deferredStudentSearch = useDeferredValue(studentSearch.trim());

  // Workspace UI state — tabs, drawers and dialogs.
  const [activeTab, setActiveTab] = useState<CohortTab>('overview');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCohortId, setEditCohortId] = useState<string | null>(null);
  const [cohortToDelete, setCohortToDelete] = useState<TeacherCohort | null>(null);
  const [isDeletingCohort, setIsDeletingCohort] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [courseToRemove, setCourseToRemove] = useState<TeacherCourse | null>(null);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);

  // The open cohort lives in the URL (?cohortId=…) so back/forward and
  // deep links land on the right workspace.
  const selectedCohortId = searchParams.get('cohortId');
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setSelectedCohortId = useCallback(
    (cohortId: string | null, options?: { replace?: boolean }) => {
      const current = searchParamsRef.current;
      if ((current.get('cohortId') ?? null) === cohortId) return;
      const next = new URLSearchParams(current);
      if (cohortId) {
        next.set('cohortId', cohortId);
      } else {
        next.delete('cohortId');
      }
      setSearchParams(next, options);
    },
    [setSearchParams],
  );

  const loadCohortPublishJobs = async (nextCohorts: TeacherCohort[]) => {
    if (nextCohorts.length === 0) {
      setCohortPublishJobs({});
      setPendingPublishIds([]);
      return;
    }

    const results = await Promise.allSettled(
      nextCohorts.map(async (cohort) => [
        cohort.id,
        await academyStudioBackend.getLatestCohortStudyPlanJob(cohort),
      ] as const),
    );

    const nextJobs: Record<string, CohortStudyPlanJob | null> = {};

    results.forEach((result, index) => {
      const cohort = nextCohorts[index];
      if (result.status === 'fulfilled') {
        nextJobs[result.value[0]] = result.value[1];
        return;
      }

      console.error(
        `Failed to load publish status for cohort "${cohort.title}".`,
        result.reason,
      );
      nextJobs[cohort.id] = null;
    });

    setCohortPublishJobs(nextJobs);
    setPendingPublishIds((current) =>
      current.filter((cohortId) => nextCohorts.some((cohort) => cohort.id === cohortId)),
    );
  };

  const refreshCohortPublishJob = async (cohort: TeacherCohort) => {
    try {
      const latestJob = await academyStudioBackend.getLatestCohortStudyPlanJob(
        cohort,
      );
      setCohortPublishJobs((current) => ({
        ...current,
        [cohort.id]: latestJob,
      }));

      if (latestJob) {
        setPendingPublishIds((current) =>
          current.filter((cohortId) => cohortId !== cohort.id),
        );
      }

      return latestJob;
    } catch (error) {
      console.error(
        `Failed to refresh publish status for cohort "${cohort.title}".`,
        error,
      );
      throw error;
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const snapshot = await academyStudioBackend.loadCatalogSnapshot();
      setCourses(snapshot.courses);
      setCohorts(snapshot.cohorts);
      await loadCohortPublishJobs(snapshot.cohorts);
    } catch (error) {
      console.error('Failed to load academy cohort data:', error);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load cohorts from the backend.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const requestId = studentRequestIdRef.current + 1;
    studentRequestIdRef.current = requestId;
    setIsStudentLoading(true);
    setStudentLoadError(null);

    void academyStudioBackend
      .loadPagedStudents({
        page: studentPage,
        limit: STUDENT_PAGE_SIZE,
        search: deferredStudentSearch,
      })
      .then((result) => {
        if (studentRequestIdRef.current !== requestId) return;
        setStudents(result.students);
        setStudentTotal(result.total);
      })
      .catch((error: unknown) => {
        if (studentRequestIdRef.current !== requestId) return;
        console.error('Failed to load paginated learners:', error);
        setStudentLoadError(
          getErrorMessage(error, 'Unable to load learners from the backend.'),
        );
      })
      .finally(() => {
        if (studentRequestIdRef.current !== requestId) return;
        setIsStudentLoading(false);
      });
  }, [deferredStudentSearch, studentPage]);

  // Success toasts dismiss themselves.
  useEffect(() => {
    if (!message) return;
    const timeoutId = window.setTimeout(
      () => setMessage((current) => (current === message ? null : current)),
      TOAST_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const selectedCohort =
    cohorts.find((cohort) => cohort.id === selectedCohortId) || null;

  // Drop a stale ?cohortId (deleted cohort, bad link) once the catalog is loaded.
  useEffect(() => {
    if (isLoading || loadError || !selectedCohortId) return;
    if (!cohorts.some((cohort) => cohort.id === selectedCohortId)) {
      setSelectedCohortId(null, { replace: true });
    }
  }, [cohorts, isLoading, loadError, selectedCohortId, setSelectedCohortId]);

  // Opening a different cohort starts on its overview with fresh searches.
  const previousCohortIdRef = useRef(selectedCohortId);
  useEffect(() => {
    if (previousCohortIdRef.current === selectedCohortId) return;
    previousCohortIdRef.current = selectedCohortId;
    setActiveTab('overview');
    setIsAttachOpen(false);
    setIsDeliveryOpen(false);
    setStudentSearch('');
    setStudentPage(1);
    setCourseSearch('');
  }, [selectedCohortId]);

  const assignedStudentIdSuffixes = useMemo(
    () => new Set((selectedCohort?.studentIds || []).map(getIdSuffix)),
    [selectedCohort],
  );
  const pendingPublishIdSet = useMemo(
    () => new Set(pendingPublishIds),
    [pendingPublishIds],
  );
  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course] as const)),
    [courses],
  );
  const selectedCohortPublishJob = selectedCohort
    ? cohortPublishJobs[selectedCohort.id] || null
    : null;
  const selectedCohortPublishReadiness = useMemo(
    () => getCohortPublishReadiness(selectedCohort, courseById),
    [courseById, selectedCohort],
  );
  const isSelectedCohortPublishPending = Boolean(
    selectedCohort && pendingPublishIdSet.has(selectedCohort.id),
  );
  const selectedCohortPublishState = getCohortPublishState(
    selectedCohortPublishReadiness,
    selectedCohortPublishJob,
    isSelectedCohortPublishPending,
  );

  const publishStateById = useMemo(() => {
    const states = new Map<string, CohortPublishState>();
    cohorts.forEach((cohort) => {
      states.set(
        cohort.id,
        getCohortPublishState(
          getCohortPublishReadiness(cohort, courseById),
          cohortPublishJobs[cohort.id] || null,
          pendingPublishIdSet.has(cohort.id),
        ),
      );
    });
    return states;
  }, [cohortPublishJobs, cohorts, courseById, pendingPublishIdSet]);

  const assignedCourses = useMemo(
    () =>
      courses.filter((course) =>
        selectedCohort?.courseIds.includes(course.id),
      ),
    [courses, selectedCohort],
  );

  useEffect(() => {
    if (!selectedCohort) return;

    const shouldPoll =
      isSelectedCohortPublishPending ||
      selectedCohortPublishJob?.status === 'queued' ||
      selectedCohortPublishJob?.status === 'processing';

    if (!shouldPoll) return;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const latestJob = await academyStudioBackend.getLatestCohortStudyPlanJob(
            selectedCohort,
          );
          setCohortPublishJobs((current) => ({
            ...current,
            [selectedCohort.id]: latestJob,
          }));

          if (latestJob) {
            setPendingPublishIds((current) =>
              current.filter((cohortId) => cohortId !== selectedCohort.id),
            );
          }
        } catch (error) {
          console.error(
            `Unable to refresh publish status for cohort "${selectedCohort.title}".`,
            error,
          );
        }
      })();
    }, PUBLISH_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isSelectedCohortPublishPending,
    selectedCohort,
    selectedCohortPublishJob?.status,
  ]);

  useEffect(() => {
    if (!assignedCourses.length) {
      setSelectedCourseId(null);
      return;
    }

    if (
      !selectedCourseId ||
      !assignedCourses.some((course) => course.id === selectedCourseId)
    ) {
      setSelectedCourseId(assignedCourses[0].id);
    }
  }, [assignedCourses, selectedCourseId]);

  // The delivery drawer only makes sense for an attached course.
  useEffect(() => {
    if (isDeliveryOpen && !assignedCourses.some((course) => course.id === selectedCourseId)) {
      setIsDeliveryOpen(false);
    }
  }, [assignedCourses, isDeliveryOpen, selectedCourseId]);

  const selectedAssignedCourse =
    assignedCourses.find((course) => course.id === selectedCourseId) || null;
  const selectedAssignedCourseObjectiveError = selectedAssignedCourse
    ? courseObjectiveErrors[selectedAssignedCourse.id] || null
    : null;
  const selectedAssignedCourseNeedsObjectives = Boolean(
    isDeliveryOpen &&
      selectedAssignedCourse &&
      !selectedAssignedCourse.learningObjectivesLoaded,
  );
  const selectedCourseSelection = selectedCohort?.courseSelections.find(
    (selection) => selection.courseId === selectedAssignedCourse?.id,
  );
  const selectedObjectiveIds = new Set(
    selectedCourseSelection?.learningObjectiveIds || [],
  );
  const isCustomMode = Boolean(selectedCourseSelection);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return courses;

    return courses.filter((course) =>
      [course.title, course.summary]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [courseSearch, courses]);

  const totalLearnerAssignments = useMemo(
    () =>
      cohorts.reduce((count, cohort) => count + cohort.studentIds.length, 0),
    [cohorts],
  );

  const totalCourseAssignments = useMemo(
    () => cohorts.reduce((count, cohort) => count + cohort.courseIds.length, 0),
    [cohorts],
  );

  const curatedCourseCount = useMemo(
    () =>
      cohorts.reduce(
        (count, cohort) => count + cohort.courseSelections.length,
        0,
      ),
    [cohorts],
  );
  const studentTotalPages = Math.max(
    1,
    Math.ceil(studentTotal / STUDENT_PAGE_SIZE),
  );
  const visibleStudentRangeStart =
    studentTotal === 0 ? 0 : (studentPage - 1) * STUDENT_PAGE_SIZE + 1;
  const visibleStudentRangeEnd =
    studentTotal === 0 ? 0 : visibleStudentRangeStart + students.length - 1;

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
    if (!selectedAssignedCourseNeedsObjectives || !selectedAssignedCourse) {
      return;
    }

    void loadCourseObjectives(selectedAssignedCourse).catch(() => {});
  }, [
    loadCourseObjectives,
    selectedAssignedCourse?.backendIdentifier,
    selectedAssignedCourse?.id,
    selectedAssignedCourse?.learningObjectivesLoaded,
    selectedAssignedCourseNeedsObjectives,
  ]);

  const reportMutationError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    setActionError(getErrorMessage(error, fallback));
  };

  const runLockedCohortRequest = async <T,>(
    action: () => Promise<T>,
  ): Promise<T | null> => {
    if (cohortRequestPendingRef.current) return null;

    cohortRequestPendingRef.current = true;
    setIsCohortRequestPending(true);

    try {
      return await action();
    } finally {
      cohortRequestPendingRef.current = false;
      setIsCohortRequestPending(false);
    }
  };

  const commitCohortMutation = async (
    action: () => Promise<TeacherCohort>,
  ) => {
    return runLockedCohortRequest(async () => {
      const savedCohort = await action();
      await loadData();
      // Keep an open workspace pointed at the saved record; edits made from
      // the index don't open the cohort.
      if (searchParamsRef.current.get('cohortId')) {
        setSelectedCohortId(savedCohort.id, { replace: true });
      }
      return savedCohort;
    });
  };

  const saveCohortRecord = async (cohort: TeacherCohort) =>
    commitCohortMutation(() => academyStudioBackend.saveCohort(cohort));

  const createCohortShell = async (source: CohortFormValues) => {
    return runLockedCohortRequest(async () => {
      const savedCohort = await academyStudioBackend.saveCohort({
        title: source.title.trim(),
        term: source.term.trim(),
        description: source.description.trim(),
        startDate: source.startDate.trim(),
        endDate: source.endDate.trim(),
      });
      await loadData();
      setSelectedCohortId(savedCohort.id);
      return savedCohort.id;
    });
  };

  /** Creates the cohort and opens its workspace. Throws so the dialog can show the error. */
  const handleCreateCohort = async (values: CohortFormValues) => {
    if (!values.title.trim()) return false;

    const dateError = getCohortDateRangeError(values.startDate, values.endDate);
    if (dateError) throw new Error(dateError);

    try {
      setActionError(null);
      const savedCohortId = await createCohortShell(values);
      if (!savedCohortId) return false;
      setMessage('Cohort created. Add learners and attach courses next.');
      return true;
    } catch (error) {
      console.error('Unable to create this cohort.', error);
      throw new Error(getErrorMessage(error, 'Unable to create this cohort.'));
    }
  };

  const editingCohort = cohorts.find((cohort) => cohort.id === editCohortId) || null;

  const handleSaveCohort = async (values: CohortFormValues) => {
    const target = editingCohort;
    if (!target || !values.title.trim()) return false;

    const dateError = getCohortDateRangeError(values.startDate, values.endDate);
    if (dateError) throw new Error(dateError);

    try {
      setActionError(null);
      const savedCohort = await saveCohortRecord({
        id: target.id,
        backendIdentifier: target.backendIdentifier,
        title: values.title.trim(),
        term: values.term.trim(),
        description: values.description.trim(),
        startDate: values.startDate.trim(),
        endDate: values.endDate.trim(),
        studentIds: target.studentIds,
        courseIds: target.courseIds,
        courseSelections: target.courseSelections,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      });
      if (!savedCohort) return false;
      setMessage('Cohort details updated.');
      return true;
    } catch (error) {
      console.error('Unable to save this cohort.', error);
      throw new Error(getErrorMessage(error, 'Unable to save this cohort.'));
    }
  };

  const handleDeleteCohort = async (cohortId: string) => {
    const cohort = cohorts.find((entry) => entry.id === cohortId);
    if (!cohort) return;

    setIsDeletingCohort(true);
    try {
      const deleted = await runLockedCohortRequest(async () => {
        await academyStudioBackend.deleteCohort(cohort);
        if (selectedCohortId === cohort.id) {
          setSelectedCohortId(null);
        }
        setMessage(`Deleted "${cohort.title}".`);
        await loadData();
        return true;
      });
      if (!deleted) return;
      setCohortToDelete(null);
    } catch (error) {
      setCohortToDelete(null);
      reportMutationError(error, `Unable to delete "${cohort.title}".`);
    } finally {
      setIsDeletingCohort(false);
    }
  };

  const handlePublishCohort = async () => {
    if (!selectedCohort || !selectedCohortPublishReadiness.canPublish) return;

    try {
      const started = await runLockedCohortRequest(async () => {
        const hydratedCourses = new Map(courseById);
        for (const selection of selectedCohort.courseSelections) {
          const course = hydratedCourses.get(selection.courseId);
          if (!course?.locked || course.learningObjectivesLoaded) continue;
          hydratedCourses.set(course.id, await loadCourseObjectives(course));
        }

        const lockedCoursesMissingItemsCount =
          getCohortPublishReadiness(selectedCohort, hydratedCourses)
            .lockedCoursesMissingItemsCount;
        if (lockedCoursesMissingItemsCount > 0) {
          setActionError(getLockedCoverageMessage(lockedCoursesMissingItemsCount));
          return false;
        }

        setPendingPublishIds((current) =>
          current.includes(selectedCohort.id)
            ? current
            : [...current, selectedCohort.id],
        );
        await academyStudioBackend.publishCohortStudyPlanTemplate(selectedCohort);
        setMessage(`Publishing started for "${selectedCohort.title}".`);
        await refreshCohortPublishJob(selectedCohort);
        return true;
      });
      if (!started) return;
    } catch (error) {
      setPendingPublishIds((current) =>
        current.filter((cohortId) => cohortId !== selectedCohort.id),
      );
      reportMutationError(error, 'Unable to publish this cohort.');
    }
  };

  const handleToggleStudent = async (studentId: string) => {
    if (!selectedCohort) return;

    const studentIdSuffix = getIdSuffix(studentId);
    const isAssigned = selectedCohort.studentIds.some(
      (id) => getIdSuffix(id) === studentIdSuffix,
    );

    try {
      const savedCohort = await commitCohortMutation(() =>
        isAssigned
          ? academyStudioBackend.removeCohortLearner(selectedCohort, studentId)
          : academyStudioBackend.attachCohortLearners(selectedCohort, [studentId]),
      );
      if (!savedCohort) return;
    } catch (error) {
      reportMutationError(error, 'Unable to update cohort learners.');
    }
  };

  const handleToggleCourse = async (courseId: string) => {
    if (!selectedCohort) return;

    const isAssigned = selectedCohort.courseIds.includes(courseId);
    const course = courseById.get(courseId);
    if (
      !isAssigned &&
      course?.locked &&
      getCourseMissingItemCount(course) > 0
    ) {
      setActionError('This locked course needs item coverage before it can be attached.');
      return;
    }

    try {
      const savedCohort = await commitCohortMutation(() =>
        isAssigned
          ? academyStudioBackend.removeCohortCourse(selectedCohort, courseId)
          : academyStudioBackend.attachCohortCourses(selectedCohort, [courseId]),
      );
      if (!savedCohort) return;

      if (!isAssigned) {
        setSelectedCourseId(courseId);
        setMessage('Course attached to the cohort.');
      } else {
        setMessage(course ? `Removed "${course.title}" from the cohort.` : 'Course removed.');
      }
    } catch (error) {
      reportMutationError(error, 'Unable to update cohort courses.');
    }
  };

  const updateCourseSelection = async (
    courseId: string,
    learningObjectiveIds: string[],
  ) => {
    if (!selectedCohort) return;

    const uniqueIds = Array.from(new Set(learningObjectiveIds));
    const currentSelection = selectedCohort.courseSelections.find(
      (selection) => selection.courseId === courseId,
    );
    const currentIds = currentSelection?.learningObjectiveIds || [];
    const currentIdSet = new Set(currentIds);

    try {
      const course = courseById.get(courseId);
      if (course?.locked) {
        const hydratedCourse = course.learningObjectivesLoaded
          ? course
          : await loadCourseObjectives(course);
        if (uniqueIds.length === 0) {
          if (getCourseMissingItemCount(hydratedCourse) > 0) {
            setActionError(
              'This locked course needs item coverage before it can return to full-course mode.',
            );
            return false;
          }
        } else if (
          getLockedSelectionMissingItemCount(hydratedCourse, uniqueIds) > 0
        ) {
          setActionError(
            'Locked course delivery can only include learning objectives with linked items.',
          );
          return false;
        }
      }

      const savedCohort = await commitCohortMutation(async () => {
        if (uniqueIds.length === 0) {
          return academyStudioBackend.clearCohortCourseLearningObjectives(
            selectedCohort,
            courseId,
          );
        }

        const idsToAdd = uniqueIds.filter((id) => !currentIdSet.has(id));
        const desiredIdSet = new Set(uniqueIds);
        const idsToRemove = currentIds.filter((id) => !desiredIdSet.has(id));

        if (idsToAdd.length === 0 && idsToRemove.length === 0) {
          return selectedCohort;
        }

        let nextCohort = selectedCohort;

        if (idsToAdd.length > 0) {
          nextCohort = await academyStudioBackend.appendCohortCourseLearningObjectives(
            nextCohort,
            courseId,
            idsToAdd,
          );
        }

        for (const learningObjectiveId of idsToRemove) {
          nextCohort =
            await academyStudioBackend.removeCohortCourseLearningObjective(
              nextCohort,
              courseId,
              learningObjectiveId,
            );
        }

        return nextCohort;
      });
      return Boolean(savedCohort);
    } catch (error) {
      reportMutationError(error, 'Unable to update cohort delivery.');
      return false;
    }
  };

  const handleEnableCustomMode = async () => {
    if (!selectedAssignedCourse) return;

    let activeCourse = selectedAssignedCourse;
    if (!activeCourse.learningObjectivesLoaded) {
      try {
        activeCourse = await loadCourseObjectives(activeCourse);
      } catch {
        return;
      }
    }

    if (activeCourse.learningObjectives.length === 0) {
      setActionError(
        'This course has no learning objectives yet. Open the Courses page first.',
      );
      return;
    }

    try {
      const updated = await updateCourseSelection(
        activeCourse.id,
        activeCourse.learningObjectives.map((objective) => objective.id),
      );
      if (!updated) return;
      setMessage('Curated mode on. Untick the objectives this cohort should skip.');
    } catch (error) {
      reportMutationError(error, 'Unable to enable curated mode.');
    }
  };

  const handleDisableCustomMode = async () => {
    if (!selectedAssignedCourse) return;
    try {
      const updated = await updateCourseSelection(selectedAssignedCourse.id, []);
      if (!updated) return;
      setMessage('The cohort is back on full-course mode for this course.');
    } catch (error) {
      reportMutationError(error, 'Unable to restore full-course mode.');
    }
  };

  const handleToggleObjectiveSelection = async (objectiveId: string) => {
    if (!selectedAssignedCourse || !isCustomMode) return;

    const nextIds = new Set(selectedObjectiveIds);
    if (nextIds.has(objectiveId)) {
      nextIds.delete(objectiveId);
    } else {
      nextIds.add(objectiveId);
    }

    if (nextIds.size === 0) {
      await handleDisableCustomMode();
      return;
    }

    try {
      const updated = await updateCourseSelection(
        selectedAssignedCourse.id,
        Array.from(nextIds),
      );
      if (!updated) return;
    } catch (error) {
      reportMutationError(error, 'Unable to update curated learning objectives.');
    }
  };

  const openCoursePage = (courseId: string) => {
    navigate(`/courses?courseId=${courseId}`);
  };

  const openWorkspace = (cohortId: string) => {
    setSelectedCohortId(cohortId);
  };

  const closeWorkspace = () => {
    setSelectedCohortId(null);
  };

  const openDelivery = (courseId: string) => {
    setSelectedCourseId(courseId);
    setIsDeliveryOpen(true);
  };

  const requestDeleteCohort = (cohortId: string) => {
    const cohort = cohorts.find((entry) => entry.id === cohortId);
    if (cohort) setCohortToDelete(cohort);
  };

  const handleConfirmRemoveCourse = () => {
    const course = courseToRemove;
    setCourseToRemove(null);
    if (course) void handleToggleCourse(course.id);
  };

  // --- Render ---------------------------------------------------------------
  const renderWorkspace = (cohort: TeacherCohort) => {
    const status = PUBLISH_STATE_META[selectedCohortPublishState];
    const dateRange = formatDateRange(cohort.startDate, cohort.endDate);
    const courseIssues =
      selectedCohortPublishReadiness.missingObjectiveCourseCount +
      selectedCohortPublishReadiness.lockedCoursesMissingItemsCount;
    const tabs: CohortTabItem[] = [
      { id: 'overview', label: 'Overview' },
      {
        id: 'learners',
        label: 'Learners',
        figure: cohort.studentIds.length.toLocaleString(),
      },
      {
        id: 'courses',
        label: 'Courses',
        figure: assignedCourses.length.toLocaleString(),
        attention: courseIssues > 0,
      },
    ];

    const renderPanel = () => {
      switch (activeTab) {
        case 'learners':
          return (
            <CohortLearnersPanel
              memberCount={cohort.studentIds.length}
              students={students}
              studentTotal={studentTotal}
              page={studentPage}
              totalPages={studentTotalPages}
              rangeStart={visibleStudentRangeStart}
              rangeEnd={visibleStudentRangeEnd}
              isLoading={isStudentLoading}
              loadError={studentLoadError}
              search={studentSearch}
              appliedSearch={deferredStudentSearch}
              onSearchChange={(value) => {
                setStudentSearch(value);
                setStudentPage(1);
              }}
              onPageChange={setStudentPage}
              isMember={(studentId) => assignedStudentIdSuffixes.has(getIdSuffix(studentId))}
              onToggleLearner={(studentId) => void handleToggleStudent(studentId)}
              onOpenRegistry={() => navigate('/students')}
            />
          );
        case 'courses':
          return (
            <CohortCoursesPanel
              cohort={cohort}
              assignedCourses={assignedCourses}
              onAttachCourses={() => setIsAttachOpen(true)}
              onOpenDelivery={openDelivery}
              onOpenCourse={openCoursePage}
              onRemoveCourse={setCourseToRemove}
            />
          );
        default:
          return (
            <CohortOverviewPanel
              cohort={cohort}
              assignedCourses={assignedCourses}
              readiness={selectedCohortPublishReadiness}
              publishState={selectedCohortPublishState}
              publishJob={selectedCohortPublishJob}
              onNavigate={setActiveTab}
              onAttachCourses={() => setIsAttachOpen(true)}
              onPublish={() => setIsPublishConfirmOpen(true)}
              onEditDetails={() => setEditCohortId(cohort.id)}
            />
          );
      }
    };

    return (
      <div>
        <PageHeader
          eyebrow={
            <button
              type="button"
              onClick={closeWorkspace}
              className="-mx-1 inline-flex items-center gap-1 rounded px-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Cohorts
            </button>
          }
          title={cohort.title}
          description={cohort.description || undefined}
          meta={
            <>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
              {(cohort.term || dateRange) && (
                <span className="text-[13px] text-stone-400">
                  {[cohort.term, dateRange].filter(Boolean).join(' · ')}
                </span>
              )}
            </>
          }
          actions={
            <>
              <AskAboutCohortButton cohortId={cohort.id} cohortTitle={cohort.title} page="cohort" />
              <Button variant="secondary" icon={Pencil} onClick={() => setEditCohortId(cohort.id)}>
                Edit details
              </Button>
              {selectedCohortPublishState === 'publishing' ? (
                <Button variant="secondary" loading disabled>
                  Publishing
                </Button>
              ) : selectedCohortPublishState === 'ready' ||
                selectedCohortPublishState === 'failed' ? (
                <Button variant="primary" icon={Send} onClick={() => setIsPublishConfirmOpen(true)}>
                  {selectedCohortPublishState === 'failed' ? 'Publish again' : 'Publish'}
                </Button>
              ) : null}
              <Menu
                label="Cohort actions"
                items={[
                  {
                    label: 'Learner registry',
                    icon: ArrowUpRight,
                    onSelect: () => navigate('/students'),
                  },
                  {
                    label: 'Go to courses',
                    icon: BookOpen,
                    onSelect: () => navigate('/courses'),
                  },
                  {
                    label: 'Delete cohort',
                    icon: Trash2,
                    tone: 'danger',
                    onSelect: () => setCohortToDelete(cohort),
                  },
                ]}
              />
            </>
          }
        />

        {loadError && (
          <InlineAlert
            className="mt-5"
            title="Couldn't refresh this cohort"
            action={
              <Button size="sm" variant="secondary" onClick={() => void loadData()} loading={isLoading}>
                Retry
              </Button>
            }
          >
            {loadError}
          </InlineAlert>
        )}

        <div className="mt-5">
          <CohortTabs tabs={tabs} active={activeTab} onSelect={setActiveTab} />
        </div>
        <div
          role="tabpanel"
          id={`cohort-panel-${activeTab}`}
          aria-labelledby={`cohort-tab-${activeTab}`}
          className="pt-6"
        >
          {renderPanel()}
        </div>

        <AttachCoursesDrawer
          open={isAttachOpen}
          onClose={() => setIsAttachOpen(false)}
          cohortTitle={cohort.title}
          courses={filteredCourses}
          totalCourseCount={courses.length}
          attachedCount={assignedCourses.length}
          isLoading={isLoading}
          search={courseSearch}
          onSearchChange={setCourseSearch}
          isAttached={(courseId) => cohort.courseIds.includes(courseId)}
          onAttach={(courseId) => void handleToggleCourse(courseId)}
          onRemove={setCourseToRemove}
          onOpenCourse={openCoursePage}
          onBrowseCourses={() => navigate('/courses')}
        />

        <CourseDeliveryDrawer
          open={isDeliveryOpen && Boolean(selectedAssignedCourse)}
          onClose={() => setIsDeliveryOpen(false)}
          cohort={cohort}
          course={selectedAssignedCourse}
          isCustomMode={isCustomMode}
          selectedObjectiveIds={selectedObjectiveIds}
          needsObjectives={selectedAssignedCourseNeedsObjectives}
          objectiveError={selectedAssignedCourseObjectiveError}
          isRetrying={loadingCourseObjectivesId === selectedAssignedCourse?.id}
          onRetry={() => {
            if (selectedAssignedCourse) void loadCourseObjectives(selectedAssignedCourse).catch(() => {});
          }}
          onEnableCurated={() => void handleEnableCustomMode()}
          onRestoreFullCourse={() => void handleDisableCustomMode()}
          onToggleObjective={(objectiveId) => void handleToggleObjectiveSelection(objectiveId)}
          onOpenCourse={openCoursePage}
        />

        <ConfirmDialog
          open={isPublishConfirmOpen}
          tone="default"
          title="Publish study plans?"
          description={`This generates a study plan for each of the ${plural(
            cohort.studentIds.length,
            'learner',
          )} in “${cohort.title}” from ${plural(assignedCourses.length, 'attached course')}.`}
          confirmLabel="Publish"
          onConfirm={() => {
            setIsPublishConfirmOpen(false);
            void handlePublishCohort();
          }}
          onCancel={() => setIsPublishConfirmOpen(false)}
        />
      </div>
    );
  };

  const renderContent = () => {
    if (selectedCohort) return renderWorkspace(selectedCohort);
    if (selectedCohortId && isLoading) {
      return <Spinner label="Loading cohort…" className="py-24" />;
    }
    return (
      <CohortsIndex
        cohorts={cohorts}
        publishStateById={publishStateById}
        isLoading={isLoading}
        loadError={loadError}
        onRetry={() => void loadData()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totals={{
          learnerAssignments: totalLearnerAssignments,
          courseAssignments: totalCourseAssignments,
          curatedDeliveries: curatedCourseCount,
          sharedCourses: courses.length,
        }}
        onOpenCohort={openWorkspace}
        onEditCohort={setEditCohortId}
        onDeleteCohort={requestDeleteCohort}
        onNewCohort={() => setIsCreateOpen(true)}
      />
    );
  };

  return (
    <div
      className={isCohortRequestPending ? 'cursor-wait' : undefined}
      aria-busy={isCohortRequestPending}
    >
      {renderContent()}

      <CohortDetailsDialog
        open={isCreateOpen}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateCohort}
      />

      <CohortDetailsDialog
        open={Boolean(editingCohort)}
        mode="edit"
        initialValues={editingCohort ? cohortToForm(editingCohort) : undefined}
        onClose={() => setEditCohortId(null)}
        onSubmit={handleSaveCohort}
      />

      <ConfirmDialog
        open={Boolean(cohortToDelete)}
        title="Delete cohort?"
        description={
          <>
            <span className="font-medium text-stone-900">{cohortToDelete?.title}</span> will be
            permanently deleted, along with its learner and course assignments. This can't be
            undone.
          </>
        }
        confirmLabel="Delete cohort"
        busy={isDeletingCohort}
        onConfirm={() => {
          if (cohortToDelete) void handleDeleteCohort(cohortToDelete.id);
        }}
        onCancel={() => setCohortToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(courseToRemove)}
        title="Remove course from cohort?"
        description={
          <>
            Learners in this cohort will no longer get{' '}
            <span className="font-medium text-stone-900">{courseToRemove?.title}</span>
            {selectedCohort?.courseSelections.some(
              (selection) => selection.courseId === courseToRemove?.id,
            )
              ? ', and its curated objective selection will be lost.'
              : '.'}{' '}
            The course itself isn't changed.
          </>
        }
        confirmLabel="Remove course"
        onConfirm={handleConfirmRemoveCourse}
        onCancel={() => setCourseToRemove(null)}
      />

      <CohortToasts
        message={message}
        error={actionError}
        isSaving={isCohortRequestPending}
        onDismissMessage={() => setMessage(null)}
        onDismissError={() => setActionError(null)}
      />

      {isCohortRequestPending && (
        <div
          className="fixed inset-0 z-[140] !mt-0 cursor-wait bg-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default CohortsView;
