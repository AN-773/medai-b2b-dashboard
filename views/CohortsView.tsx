import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Check,
  Layers3,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import {
  CohortStudyPlanJob,
  TeacherCohort,
  TeacherCourse,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';

const panelClass =
  'rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm';
const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10';
const textareaClass = `${inputClass} min-h-[120px] resize-none`;

const emptyCohortForm = {
  title: '',
  term: '',
  description: '',
};

const PUBLISH_POLL_INTERVAL_MS = 5000;

type CohortPublishState =
  | 'not-ready'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed';

interface CohortPublishReadiness {
  hasStudents: boolean;
  hasCourses: boolean;
  allCoursesHaveObjectives: boolean;
  missingObjectiveCourseCount: number;
  canPublish: boolean;
}

const formatModeLabel = (
  cohort: TeacherCohort | null,
  course: TeacherCourse | null,
) => {
  if (!cohort || !course) return 'No course selected';

  const selection = cohort.courseSelections.find(
    (entry) => entry.courseId === course.id,
  );

  if (!selection) return 'Full course mode';
  return `${selection.learningObjectiveIds.length}/${course.learningObjectives.length} objectives selected`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getIdSuffix = (value: string) => value.split('/').pop() || value;

const getEffectiveObjectiveCount = (
  cohort: TeacherCohort,
  course: TeacherCourse,
) => {
  const selection = cohort.courseSelections.find(
    (entry) => entry.courseId === course.id,
  );

  return selection
    ? selection.learningObjectiveIds.length
    : course.learningObjectives.length;
};

const getCohortPublishReadiness = (
  cohort: TeacherCohort | null,
  courseById: ReadonlyMap<string, TeacherCourse>,
): CohortPublishReadiness => {
  if (!cohort) {
    return {
      hasStudents: false,
      hasCourses: false,
      allCoursesHaveObjectives: false,
      missingObjectiveCourseCount: 0,
      canPublish: false,
    };
  }

  const assignedCourses = cohort.courseIds
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is TeacherCourse => Boolean(course));
  const hasStudents = cohort.studentIds.length > 0;
  const hasCourses = assignedCourses.length > 0;
  const missingObjectiveCourseCount = assignedCourses.filter(
    (course) => getEffectiveObjectiveCount(cohort, course) === 0,
  ).length;
  const allCoursesHaveObjectives =
    hasCourses && missingObjectiveCourseCount === 0;

  return {
    hasStudents,
    hasCourses,
    allCoursesHaveObjectives,
    missingObjectiveCourseCount,
    canPublish: hasStudents && allCoursesHaveObjectives,
  };
};

const getCohortPublishState = (
  readiness: CohortPublishReadiness,
  latestJob: CohortStudyPlanJob | null,
  isPendingRequest: boolean,
): CohortPublishState => {
  if (
    isPendingRequest ||
    latestJob?.status === 'queued' ||
    latestJob?.status === 'processing'
  ) {
    return 'publishing';
  }

  if (latestJob?.status === 'completed') {
    return 'published';
  }

  if (!readiness.canPublish) {
    return 'not-ready';
  }

  if (latestJob?.status === 'failed') {
    return 'failed';
  }

  return 'ready';
};

const getCohortPublishLabel = (state: CohortPublishState) => {
  switch (state) {
    case 'publishing':
      return 'Publishing';
    case 'published':
      return 'Published';
    case 'failed':
      return 'Publish failed';
    case 'ready':
      return 'Ready to publish';
    default:
      return 'Not ready';
  }
};

const getCohortPublishBadgeClass = (state: CohortPublishState) => {
  switch (state) {
    case 'publishing':
      return 'bg-amber-100 text-amber-700';
    case 'published':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'ready':
      return 'bg-sky-100 text-sky-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

const getCohortPublishSupportText = (
  readiness: CohortPublishReadiness,
  state: CohortPublishState,
) => {
  if (state === 'published') {
    return 'Study plans were already generated for this cohort.';
  }

  if (state === 'publishing') {
    return 'Study plan generation is in progress for this cohort.';
  }

  if (state === 'failed') {
    return 'The last publish job failed. You can retry publishing.';
  }

  if (!readiness.hasStudents) {
    return 'Add at least one learner before publishing this cohort.';
  }

  if (!readiness.hasCourses) {
    return 'Attach at least one course before publishing this cohort.';
  }

  if (!readiness.allCoursesHaveObjectives) {
    return readiness.missingObjectiveCourseCount === 1
      ? 'One attached course is missing learning objectives.'
      : `${readiness.missingObjectiveCourseCount} attached courses are missing learning objectives.`;
  }

  return 'This cohort is ready to generate study plans.';
};

const CohortsView: React.FC = () => {
  const navigate = useNavigate();
  const createTitleRef = useRef<HTMLInputElement | null>(null);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [cohortPublishJobs, setCohortPublishJobs] = useState<
    Record<string, CohortStudyPlanJob | null>
  >({});
  const [pendingPublishIds, setPendingPublishIds] = useState<string[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateComposer, setShowCreateComposer] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [newCohortForm, setNewCohortForm] = useState(emptyCohortForm);
  const [cohortForm, setCohortForm] = useState(emptyCohortForm);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cohortRequestPendingRef = useRef(false);
  const [isCohortRequestPending, setIsCohortRequestPending] = useState(false);

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
      const snapshot = await academyStudioBackend.loadSnapshot();
      setStudents(snapshot.students);
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
    if (!cohorts.length) {
      setSelectedCohortId(null);
      return;
    }

    if (
      !selectedCohortId ||
      !cohorts.some((cohort) => cohort.id === selectedCohortId)
    ) {
      setSelectedCohortId(cohorts[0].id);
    }
  }, [cohorts, selectedCohortId]);

  const selectedCohort =
    cohorts.find((cohort) => cohort.id === selectedCohortId) || null;
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

  useEffect(() => {
    if (!selectedCohort) {
      setCohortForm(emptyCohortForm);
      return;
    }

    setCohortForm({
      title: selectedCohort.title,
      term: selectedCohort.term,
      description: selectedCohort.description,
    });
  }, [selectedCohort]);

  useEffect(() => {
    if (isWorkspaceOpen && !selectedCohort) {
      setIsWorkspaceOpen(false);
    }
  }, [isWorkspaceOpen, selectedCohort]);

  useEffect(() => {
    if (!isWorkspaceOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isWorkspaceOpen]);

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

  const selectedAssignedCourse =
    assignedCourses.find((course) => course.id === selectedCourseId) || null;
  const selectedCourseSelection = selectedCohort?.courseSelections.find(
    (selection) => selection.courseId === selectedAssignedCourse?.id,
  );
  const selectedObjectiveIds = new Set(
    selectedCourseSelection?.learningObjectiveIds || [],
  );
  const isCustomMode = Boolean(selectedCourseSelection);

  const filteredCohorts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cohorts;

    return cohorts.filter((cohort) =>
      [cohort.title, cohort.term, cohort.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [cohorts, searchQuery]);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) =>
      [student.name, student.email, student.program, student.learnerCode]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [studentSearch, students]);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return courses;

    return courses.filter((course) =>
      [course.title, course.code, course.summary]
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

  const saveCohortRecord = async (cohort: TeacherCohort) => {
    return runLockedCohortRequest(async () => {
      const savedCohort = await academyStudioBackend.saveCohort(cohort);
      await loadData();
      setSelectedCohortId(savedCohort.id);
      return savedCohort;
    });
  };

  const createCohortShell = async (source: typeof newCohortForm) => {
    return runLockedCohortRequest(async () => {
      const savedCohort = await academyStudioBackend.saveCohort({
        title: source.title.trim(),
        term: source.term.trim(),
        description: source.description.trim(),
        studentIds: [],
        courseIds: [],
        courseSelections: [],
      });
      await loadData();
      setSelectedCohortId(savedCohort.id);
      return savedCohort.id;
    });
  };

  const handleCreateCohort = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCohortForm.title.trim()) return;

    try {
      const savedCohortId = await createCohortShell(newCohortForm);
      if (!savedCohortId) return;
      setNewCohortForm(emptyCohortForm);
      setShowCreateComposer(false);
      setMessage('Cohort created. Use the edit icon to open its workspace.');
    } catch (error) {
      reportMutationError(error, 'Unable to create this cohort.');
    }
  };

  const handleSaveCohort = async () => {
    if (!selectedCohort || !cohortForm.title.trim()) return;

    try {
      const savedCohort = await saveCohortRecord({
        ...selectedCohort,
        title: cohortForm.title.trim(),
        term: cohortForm.term.trim(),
        description: cohortForm.description.trim(),
      });
      if (!savedCohort) return;
      setMessage('Cohort details updated.');
    } catch (error) {
      reportMutationError(error, 'Unable to save this cohort.');
    }
  };

  const handleDeleteCohort = async (cohortId: string) => {
    const cohort = cohorts.find((entry) => entry.id === cohortId);
    if (!cohort) return;
    if (!window.confirm(`Delete cohort "${cohort.title}"?`)) return;

    try {
      const deleted = await runLockedCohortRequest(async () => {
        await academyStudioBackend.deleteCohort(cohort);
        if (selectedCohortId === cohort.id) {
          setIsWorkspaceOpen(false);
        }
        setMessage(`Deleted "${cohort.title}".`);
        await loadData();
        return true;
      });
      if (!deleted) return;
    } catch (error) {
      reportMutationError(error, `Unable to delete "${cohort.title}".`);
    }
  };

  const handlePublishCohort = async () => {
    if (!selectedCohort || !selectedCohortPublishReadiness.canPublish) return;

    try {
      const started = await runLockedCohortRequest(async () => {
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
    const nextIds = isAssigned
      ? selectedCohort.studentIds.filter(
          (id) => getIdSuffix(id) !== studentIdSuffix,
        )
      : [...selectedCohort.studentIds, studentId];

    try {
      const savedCohort = await saveCohortRecord({
        ...selectedCohort,
        studentIds: nextIds,
      });
      if (!savedCohort) return;
    } catch (error) {
      reportMutationError(error, 'Unable to update cohort learners.');
    }
  };

  const handleToggleCourse = async (courseId: string) => {
    if (!selectedCohort) return;

    const nextCourseIds = selectedCohort.courseIds.includes(courseId)
      ? selectedCohort.courseIds.filter((id) => id !== courseId)
      : [...selectedCohort.courseIds, courseId];
    const nextSelections = selectedCohort.courseSelections.filter((selection) =>
      nextCourseIds.includes(selection.courseId),
    );

    try {
      const savedCohort = await saveCohortRecord({
        ...selectedCohort,
        courseIds: nextCourseIds,
        courseSelections: nextSelections,
      });
      if (!savedCohort) return;

      if (!selectedCohort.courseIds.includes(courseId)) {
        setSelectedCourseId(courseId);
        setMessage('Course attached to the cohort.');
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
    const remainingSelections = selectedCohort.courseSelections.filter(
      (selection) => selection.courseId !== courseId,
    );

    try {
      const savedCohort = await saveCohortRecord({
        ...selectedCohort,
        courseSelections:
          uniqueIds.length === 0
            ? remainingSelections
            : [...remainingSelections, { courseId, learningObjectiveIds: uniqueIds }],
      });
      return Boolean(savedCohort);
    } catch (error) {
      reportMutationError(error, 'Unable to update cohort delivery.');
      return false;
    }
  };

  const handleEnableCustomMode = async () => {
    if (!selectedAssignedCourse) return;
    if (selectedAssignedCourse.learningObjectives.length === 0) {
      setMessage(
        'This course has no learning objectives yet. Open the Courses page first.',
      );
      return;
    }

    try {
      const updated = await updateCourseSelection(
        selectedAssignedCourse.id,
        selectedAssignedCourse.learningObjectives.map((objective) => objective.id),
      );
      if (!updated) return;
      setMessage('Curated mode enabled for the selected cohort course.');
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
    setStudentSearch('');
    setCourseSearch('');
    setIsWorkspaceOpen(true);
  };

  const closeWorkspace = () => {
    setIsWorkspaceOpen(false);
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

  const reportMutationError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    setLoadError(getErrorMessage(error, fallback));
  };

  const renderCohortWorkspace = (showCloseAction: boolean) => {
    if (!selectedCohort) return null;

    return (
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Cohort workspace
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {selectedCohort.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Update the cohort shell, then manage students, courses, and
                delivery in this workspace.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getCohortPublishBadgeClass(
                    selectedCohortPublishState,
                  )}`}
                >
                  {getCohortPublishLabel(selectedCohortPublishState)}
                </span>
                <span className="text-sm text-slate-500">
                  {getCohortPublishSupportText(
                    selectedCohortPublishReadiness,
                    selectedCohortPublishState,
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {showCloseAction && (
                <button
                  type="button"
                  onClick={closeWorkspace}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Close
                </button>
              )}
              {selectedCohortPublishState !== 'not-ready' && (
                <button
                  type="button"
                  onClick={handlePublishCohort}
                  disabled={
                    selectedCohortPublishState === 'publishing' ||
                    selectedCohortPublishState === 'published'
                  }
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    selectedCohortPublishState === 'published'
                      ? 'cursor-default bg-emerald-100 text-emerald-700'
                      : selectedCohortPublishState === 'publishing'
                        ? 'cursor-default bg-amber-100 text-amber-700'
                        : 'bg-[#1BD183] text-white hover:bg-[#18bc76]'
                  }`}
                >
                  {selectedCohortPublishState === 'publishing'
                    ? 'Publishing'
                    : selectedCohortPublishState === 'published'
                      ? 'Published'
                      : selectedCohortPublishState === 'failed'
                        ? 'Publish again'
                        : 'Publish'}
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveCohort}
                className="rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1B3E62]"
              >
                Save cohort
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCohort(selectedCohort.id)}
                className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="grid gap-4">
              <input
                value={cohortForm.title}
                onChange={(event) =>
                  setCohortForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Cohort title"
                className={inputClass}
              />
              <input
                value={cohortForm.term}
                onChange={(event) =>
                  setCohortForm((current) => ({
                    ...current,
                    term: event.target.value,
                  }))
                }
                placeholder="Term or intake"
                className={inputClass}
              />
            </div>

            <textarea
              value={cohortForm.description}
              onChange={(event) =>
                setCohortForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Short description"
              className={textareaClass}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Students</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {selectedCohort.studentIds.length}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Courses</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {selectedCohort.courseIds.length}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Delivery</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {formatModeLabel(selectedCohort, selectedAssignedCourse)}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Publish status</p>
              <p
                className={`mt-2 text-lg font-black ${selectedCohortPublishState === 'published' ? 'text-emerald-700' : selectedCohortPublishState === 'publishing' ? 'text-amber-700' : selectedCohortPublishState === 'failed' ? 'text-rose-700' : selectedCohortPublishState === 'ready' ? 'text-sky-700' : 'text-slate-900'}`}
              >
                {getCohortPublishLabel(selectedCohortPublishState)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className={panelClass}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Students
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Assign known learners to this cohort
                </h3>
              </div>

              <div className="flex w-full flex-col gap-3 xl:max-w-md xl:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search students"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/students')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Registry
                </button>
              </div>
            </div>

            <div className="mt-6 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {students.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">
                  {isLoading
                    ? 'Loading learners from the backend.'
                    : 'No learners found.'}
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isAssigned = assignedStudentIdSuffixes.has(
                    getIdSuffix(student.id),
                  );

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleToggleStudent(student.id)}
                      className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                        isAssigned
                          ? 'border-[#1BD183] bg-emerald-50 ring-2 ring-[#1BD183]/10'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {student.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {student.email}
                          </p>
                          <p className="mt-3 text-sm text-slate-500">
                            {student.program || 'No program'} ·{' '}
                            {student.learnerCode}
                          </p>
                        </div>

                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            isAssigned
                              ? 'bg-[#1BD183] text-white'
                              : 'bg-white text-slate-300'
                          }`}
                        >
                          <Check size={15} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className={panelClass}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Courses
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Attach shared courses to this cohort
                </h3>
              </div>

              <div className="flex w-full flex-col gap-3 xl:max-w-md xl:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    placeholder="Search courses"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Open courses
                </button>
              </div>
            </div>

            <div className="mt-6 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {courses.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">
                  {isLoading
                    ? 'Loading courses from the backend.'
                    : 'No courses exist yet. Create them from the Courses page.'}
                </div>
              ) : (
                filteredCourses.map((course) => {
                  const isAssigned = selectedCohort.courseIds.includes(
                    course.id,
                  );
                  const isActive = selectedAssignedCourse?.id === course.id;

                  return (
                    <div
                      key={course.id}
                      className={`rounded-[1.5rem] border px-4 py-4 transition ${
                        isAssigned
                          ? 'border-[#1BD183] bg-emerald-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {course.title}
                            </p>
                            {isActive && (
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {course.summary || 'No summary yet'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {course.code || 'No code'}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {course.learningObjectives.length} objectives
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {course.contentDrafts.length} AI drafts
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleCourse(course.id)}
                            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                              isAssigned
                                ? 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {isAssigned ? 'Remove' : 'Add'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openCoursePage(course.id)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                          >
                            Open
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <section className={panelClass}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Cohort delivery
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                Control what this cohort receives from each course
              </h3>
            </div>

            {selectedAssignedCourse && (
              <button
                type="button"
                onClick={() => openCoursePage(selectedAssignedCourse.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Edit on course page
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>

          {!assignedCourses.length ? (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm font-semibold text-slate-500">
              Attach at least one course to this cohort before curating the
              learning objectives.
            </div>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                {assignedCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedCourseId === course.id
                        ? 'bg-[#16324F] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {course.title}
                  </button>
                ))}
              </div>

              {selectedAssignedCourse && (
                <>
                  <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Active course
                        </p>
                        <h4 className="mt-1 text-lg font-black text-slate-900">
                          {selectedAssignedCourse.title}
                        </h4>
                        <p className="mt-2 text-sm text-slate-500">
                          {formatModeLabel(
                            selectedCohort,
                            selectedAssignedCourse,
                          )}
                        </p>
                      </div>

                      <div className="flex gap-2 rounded-[1.25rem] bg-white p-1.5 shadow-sm">
                        <button
                          type="button"
                          onClick={handleDisableCustomMode}
                          className={`rounded-[1rem] px-4 py-2 text-sm font-semibold transition ${
                            !isCustomMode
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Full course
                        </button>
                        <button
                          type="button"
                          onClick={handleEnableCustomMode}
                          className={`rounded-[1rem] px-4 py-2 text-sm font-semibold transition ${
                            isCustomMode
                              ? 'bg-[#16324F] text-white'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Curate objectives
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {selectedAssignedCourse.learningObjectives.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">
                        This course has no objectives yet. Add them from the
                        Courses page first.
                      </div>
                    ) : (
                      selectedAssignedCourse.learningObjectives.map(
                        (objective) => (
                          <button
                            key={objective.id}
                            type="button"
                            disabled={!isCustomMode}
                            onClick={() =>
                              handleToggleObjectiveSelection(objective.id)
                            }
                            className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                              isCustomMode &&
                              selectedObjectiveIds.has(objective.id)
                                ? 'border-[#1BD183] bg-emerald-50'
                                : 'border-slate-200 bg-slate-50'
                            } ${!isCustomMode ? 'cursor-default' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {objective.title}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {objective.organSystem && (
                                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                                      {objective.organSystem}
                                    </span>
                                  )}
                                  {objective.cognitiveSkill && (
                                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                                      {objective.cognitiveSkill}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isCustomMode ? (
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                    selectedObjectiveIds.has(objective.id)
                                      ? 'bg-[#1BD183] text-white'
                                      : 'bg-white text-slate-300'
                                  }`}
                                >
                                  <Check size={15} />
                                </div>
                              ) : (
                                <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-500">
                                  Inherited
                                </div>
                              )}
                            </div>
                          </button>
                        ),
                      )
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    );
  };

  return (
    <div
      className={`teacher-readable space-y-6 ${
        isCohortRequestPending ? 'cursor-wait' : ''
      }`}
      aria-busy={isCohortRequestPending}
    >
      <div className="rounded-[1.75rem] border border-emerald-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <Check size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {selectedCohort
                ? `${selectedCohort.title} is active. Open its workspace to add learners, attach courses, and curate delivery.`
                : 'Create a cohort shell, then pull in students and shared courses.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCohort
                ? `${selectedCohort.studentIds.length} students, ${selectedCohort.courseIds.length} courses, ${selectedCohort.courseSelections.length} curated deliveries`
                : `${cohorts.length} cohorts, ${students.length} registry students, ${courses.length} shared courses, ${curatedCourseCount} curated deliveries`}
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
            <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
              <div className="rounded-[1rem] bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Cohorts</p>
                <p className="mt-1.5 text-xl font-black text-slate-900">
                  {cohorts.length}
                </p>
              </div>
              <div className="rounded-[1rem] bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Learner links</p>
                <p className="mt-1.5 text-xl font-black text-slate-900">
                  {totalLearnerAssignments}
                </p>
              </div>
              <div className="rounded-[1rem] bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Course links</p>
                <p className="mt-1.5 text-xl font-black text-slate-900">
                  {totalCourseAssignments}
                </p>
              </div>
              <div className="rounded-[1rem] bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Curated deliveries</p>
                <p className="mt-1.5 text-xl font-black text-slate-900">
                  {curatedCourseCount}
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
                  placeholder="Search cohort title or term"
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/students')}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                >
                  Open students
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                >
                  Open courses
                </button>

                <button
                  type="button"
                  onClick={handleToggleComposer}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1B3E62]"
                >
                  <Plus size={16} />
                  Add cohort
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
                {students.length} registry students
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
                {courses.length} shared courses
              </span>
              {selectedCohort && (
                <span className="text-slate-500">
                  Active cohort: {selectedCohort.title}
                </span>
              )}
            </div>

            {showCreateComposer && (
              <form
                onSubmit={handleCreateCohort}
                className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      New cohort shell
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      Add a cohort to the library
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
                      value={newCohortForm.title}
                      onChange={(event) =>
                        setNewCohortForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Cohort title"
                      className={inputClass}
                    />
                    <textarea
                      value={newCohortForm.description}
                      onChange={(event) =>
                        setNewCohortForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Short description"
                      className={textareaClass}
                    />
                  </div>

                  <div className="grid gap-4">
                    <input
                      value={newCohortForm.term}
                      onChange={(event) =>
                        setNewCohortForm((current) => ({
                          ...current,
                          term: event.target.value,
                        }))
                      }
                      placeholder="Term or intake"
                      className={inputClass}
                    />

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Plus size={15} />
                      Create cohort
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
                <div className="space-y-3">
                  {filteredCohorts.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm font-semibold text-slate-500">
                      {isLoading
                        ? 'Loading cohorts from the backend.'
                        : 'No cohorts matched the current search.'}
                    </div>
                  ) : (
                    filteredCohorts.map((cohort) => {
                      const isSelected = cohort.id === selectedCohortId;
                      const curatedCount = cohort.courseSelections.length;
                      const publishReadiness = getCohortPublishReadiness(
                        cohort,
                        courseById,
                      );
                      const publishState = getCohortPublishState(
                        publishReadiness,
                        cohortPublishJobs[cohort.id] || null,
                        pendingPublishIdSet.has(cohort.id),
                      );

                      return (
                        <div
                          key={cohort.id}
                          className={`rounded-[1.6rem] border px-5 py-4 transition ${
                            isSelected
                              ? 'border-[#1BD183] bg-emerald-50/70 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <button
                              type="button"
                              onClick={() => setSelectedCohortId(cohort.id)}
                              className="flex min-w-0 flex-1 items-center gap-4 text-left"
                            >
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                                <Layers3 size={18} />
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-base font-semibold text-slate-900">
                                    {cohort.title}
                                  </p>
                                  {curatedCount > 0 && (
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                      {curatedCount} curated
                                    </span>
                                  )}
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getCohortPublishBadgeClass(
                                      publishState,
                                    )}`}
                                  >
                                    {getCohortPublishLabel(publishState)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">
                                  {cohort.description || 'No description yet'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                    {cohort.term || 'No term'}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                    {cohort.studentIds.length} students
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                    {cohort.courseIds.length} courses
                                  </span>
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center justify-between gap-3 xl:justify-end">
                              <div className="text-left xl:text-right">
                                <p className="text-xs text-slate-500">Updated</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  {new Date(cohort.updatedAt).toLocaleDateString()}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openWorkspace(cohort.id)}
                                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                  aria-label={`Edit ${cohort.title}`}
                                  title="Edit cohort"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCohort(cohort.id)}
                                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                                  aria-label={`Delete ${cohort.title}`}
                                  title="Delete cohort"
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

      {selectedCohort ? (
        <div className="rounded-[2rem] border border-slate-200 bg-[#F4F5F2] p-4 shadow-sm md:p-6">
          {renderCohortWorkspace(false)}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">
            Use the edit icon on a cohort card to open its workspace as a popup.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            From there you can update cohort details, add students, attach
            courses, and control delivery.
          </p>
        </div>
      )}

      {isWorkspaceOpen &&
        selectedCohort &&
        createPortal(
        <div
          className="teacher-readable fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
        >
          <div
            className="absolute inset-0 bg-slate-950/82 backdrop-blur-lg"
            onClick={closeWorkspace}
          />
          <div
            className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[2.35rem] border border-white/50 bg-[#F4F5F2] shadow-[0_40px_120px_rgba(15,17,16,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[92vh] overflow-y-auto overscroll-contain p-4 md:p-6">
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeWorkspace}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  aria-label="Close cohort workspace"
                >
                  <X size={18} />
                </button>
              </div>

              {renderCohortWorkspace(true)}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isCohortRequestPending && (
        <div
          className="fixed inset-0 z-[140] cursor-wait bg-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default CohortsView;
