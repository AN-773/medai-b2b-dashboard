import { formatDistanceToNowStrict } from 'date-fns';
import type { BadgeTone } from '@/components/ui';
import type {
  CohortStudyPlanJob,
  TeacherCohort,
  TeacherCourse,
} from '@/types/AcademyStudioTypes';

/**
 * Pure cohort rules shared by the Cohorts index and workspace: publish
 * readiness, publish state, delivery mode and small formatting helpers.
 */

export type CohortPublishState = 'not-ready' | 'ready' | 'publishing' | 'published' | 'failed';

export interface CohortPublishReadiness {
  hasStudents: boolean;
  hasCourses: boolean;
  allCoursesHaveObjectives: boolean;
  missingObjectiveCourseCount: number;
  lockedCoursesMissingItemsCount: number;
  canPublish: boolean;
}

export interface CohortFormValues {
  title: string;
  term: string;
  description: string;
  startDate: string;
  endDate: string;
}

export const emptyCohortForm: CohortFormValues = {
  title: '',
  term: '',
  description: '',
  startDate: '',
  endDate: '',
};

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const getIdSuffix = (value: string) => value.split('/').pop() || value;

export const getCourseObjectiveCount = (course: TeacherCourse) =>
  course.learningObjectivesTotal ?? course.learningObjectives.length;

export const getCourseMissingItemCount = (course: TeacherCourse) =>
  typeof course.learningObjectivesWithoutItemsTotal === 'number'
    ? course.learningObjectivesWithoutItemsTotal
    : course.learningObjectives.filter((objective) => (objective.itemTotals?.total ?? 0) === 0)
        .length;

export const getLockedSelectionMissingItemCount = (
  course: TeacherCourse,
  selectedObjectiveIds?: string[],
) => {
  if (!course.locked) return 0;

  if (!selectedObjectiveIds) {
    return getCourseMissingItemCount(course);
  }

  if (!course.learningObjectivesLoaded) {
    return 0;
  }

  const selected = new Set(selectedObjectiveIds);
  return course.learningObjectives.filter(
    (objective) => selected.has(objective.id) && (objective.itemTotals?.total ?? 0) === 0,
  ).length;
};

export const getCohortDateRangeError = (startDate: string, endDate: string) => {
  if ((startDate && !endDate) || (!startDate && endDate)) {
    return 'Set both a start date and an end date for the cohort.';
  }

  if (startDate && endDate && startDate > endDate) {
    return 'The cohort start date must be on or before the end date.';
  }

  return null;
};

export const getCourseSelection = (cohort: TeacherCohort, courseId: string) =>
  cohort.courseSelections.find((entry) => entry.courseId === courseId);

export const getEffectiveObjectiveCount = (cohort: TeacherCohort, course: TeacherCourse) => {
  const selection = getCourseSelection(cohort, course.id);
  return selection ? selection.learningObjectiveIds.length : getCourseObjectiveCount(course);
};

/** "Full course" or "12 of 40 objectives" — how this cohort receives a course. */
export const formatDeliveryLabel = (cohort: TeacherCohort | null, course: TeacherCourse | null) => {
  if (!cohort || !course) return 'No course selected';
  const selection = getCourseSelection(cohort, course.id);
  if (!selection) return 'Full course';
  return `Curated · ${selection.learningObjectiveIds.length} of ${plural(
    getCourseObjectiveCount(course),
    'objective',
  )}`;
};

export const getCohortPublishReadiness = (
  cohort: TeacherCohort | null,
  courseById: ReadonlyMap<string, TeacherCourse>,
): CohortPublishReadiness => {
  if (!cohort) {
    return {
      hasStudents: false,
      hasCourses: false,
      allCoursesHaveObjectives: false,
      missingObjectiveCourseCount: 0,
      lockedCoursesMissingItemsCount: 0,
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
  const allCoursesHaveObjectives = hasCourses && missingObjectiveCourseCount === 0;
  const lockedCoursesMissingItemsCount = assignedCourses.filter((course) => {
    const selection = getCourseSelection(cohort, course.id);
    return getLockedSelectionMissingItemCount(course, selection?.learningObjectiveIds) > 0;
  }).length;

  return {
    hasStudents,
    hasCourses,
    allCoursesHaveObjectives,
    missingObjectiveCourseCount,
    lockedCoursesMissingItemsCount,
    canPublish: hasStudents && allCoursesHaveObjectives && lockedCoursesMissingItemsCount === 0,
  };
};

export const getCohortPublishState = (
  readiness: CohortPublishReadiness,
  latestJob: CohortStudyPlanJob | null,
  isPendingRequest: boolean,
): CohortPublishState => {
  if (isPendingRequest || latestJob?.status === 'queued' || latestJob?.status === 'processing') {
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

export const PUBLISH_STATE_META: Record<CohortPublishState, { label: string; tone: BadgeTone }> = {
  'not-ready': { label: 'Needs setup', tone: 'neutral' },
  ready: { label: 'Ready to publish', tone: 'blue' },
  publishing: { label: 'Publishing', tone: 'amber' },
  published: { label: 'Published', tone: 'green' },
  failed: { label: 'Publish failed', tone: 'red' },
};

export const getLockedCoverageMessage = (count: number) =>
  count === 1
    ? 'One locked course needs item coverage before publishing.'
    : `${count} locked courses need item coverage before publishing.`;

export const getCohortPublishSupportText = (
  readiness: CohortPublishReadiness,
  state: CohortPublishState,
) => {
  if (state === 'published') return 'Study plans were already generated for this cohort.';
  if (state === 'publishing') return 'Study plan generation is in progress for this cohort.';
  if (state === 'failed') return 'The last publish job failed. You can retry publishing.';
  if (!readiness.hasStudents) return 'Add at least one learner before publishing this cohort.';
  if (!readiness.hasCourses) return 'Attach at least one course before publishing this cohort.';
  if (!readiness.allCoursesHaveObjectives) {
    return readiness.missingObjectiveCourseCount === 1
      ? 'One attached course is missing learning objectives.'
      : `${readiness.missingObjectiveCourseCount} attached courses are missing learning objectives.`;
  }
  if (readiness.lockedCoursesMissingItemsCount > 0) {
    return getLockedCoverageMessage(readiness.lockedCoursesMissingItemsCount);
  }
  return 'This cohort is ready to generate study plans.';
};

const parseDate = (value: string) => {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const formatDate = (value: string) => {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : null;
};

/** "Jan 12 – May 30, 2026", or null when the cohort has no dates. */
export const formatDateRange = (startDate: string, endDate: string) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start && !end) return null;
  if (start && end) {
    try {
      return dateFormatter.formatRange(start, end);
    } catch {
      return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
    }
  }
  return start ? `From ${dateFormatter.format(start)}` : `Until ${dateFormatter.format(end!)}`;
};

export const relativeTime = (value: string) => {
  const date = parseDate(value);
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : null;
};

export const cohortToForm = (cohort: TeacherCohort): CohortFormValues => ({
  title: cohort.title,
  term: cohort.term,
  description: cohort.description,
  startDate: cohort.startDate,
  endDate: cohort.endDate,
});
