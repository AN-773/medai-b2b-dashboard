import React from 'react';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  ListChecks,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import { Badge, Button, EmptyState, Menu, SectionHeader } from '@/components/ui';
import {
  formatDeliveryLabel,
  getCourseObjectiveCount,
  getCourseSelection,
  getEffectiveObjectiveCount,
  getLockedSelectionMissingItemCount,
  plural,
} from './cohortModel';

interface CohortCoursesPanelProps {
  cohort: TeacherCohort;
  assignedCourses: TeacherCourse[];
  onAttachCourses: () => void;
  onOpenDelivery: (courseId: string) => void;
  onOpenCourse: (courseId: string) => void;
  onRemoveCourse: (course: TeacherCourse) => void;
}

/** The courses this cohort studies and how much of each it receives. */
const CohortCoursesPanel: React.FC<CohortCoursesPanelProps> = ({
  cohort,
  assignedCourses,
  onAttachCourses,
  onOpenDelivery,
  onOpenCourse,
  onRemoveCourse,
}) => (
  <div className="space-y-5">
    <SectionHeader
      title="Courses"
      meta={
        assignedCourses.length > 0 ? (
          <span className="text-[13px] tabular-nums text-stone-500">
            {plural(assignedCourses.length, 'course')}
          </span>
        ) : undefined
      }
      description="Learners get every objective of a course by default. Open a course to curate which objectives this cohort receives."
      actions={
        <Button variant="secondary" icon={Plus} onClick={onAttachCourses}>
          Attach courses
        </Button>
      }
    />

    {assignedCourses.length === 0 ? (
      <div className="rounded-xl border border-dashed border-stone-300">
        <EmptyState
          icon={BookOpen}
          title="No courses attached"
          description="Attach the courses this cohort should study. Their objectives and content become the cohort's study plans when you publish."
          action={
            <Button variant="primary" icon={Plus} onClick={onAttachCourses}>
              Attach courses
            </Button>
          }
        />
      </div>
    ) : (
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
        {assignedCourses.map((course) => {
          const selection = getCourseSelection(cohort, course.id);
          const effectiveCount = getEffectiveObjectiveCount(cohort, course);
          const missingItems = getLockedSelectionMissingItemCount(
            course,
            selection?.learningObjectiveIds,
          );
          const totalObjectives = getCourseObjectiveCount(course);

          return (
            <li
              key={course.id}
              className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50"
            >
              <button
                type="button"
                onClick={() => onOpenDelivery(course.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none after:absolute after:inset-0 focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-500"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-stone-900">
                      {course.title}
                    </span>
                    {course.locked && (
                      <Badge
                        icon={Lock}
                        title="Only items linked to this course's objectives are delivered"
                      >
                        Locked
                      </Badge>
                    )}
                    {effectiveCount === 0 && (
                      <Badge tone="amber" dot>
                        No objectives
                      </Badge>
                    )}
                    {missingItems > 0 && (
                      <Badge tone="amber" dot>
                        {plural(missingItems, 'objective')} without items
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-stone-500">
                    {selection
                      ? formatDeliveryLabel(cohort, course)
                      : `Full course · ${plural(totalObjectives, 'objective')}`}
                  </span>
                </span>
                <ChevronRight size={16} className="flex-shrink-0 text-stone-300" aria-hidden="true" />
              </button>
              <div className="relative z-10">
                <Menu
                  size="sm"
                  label={`Actions for ${course.title}`}
                  items={[
                    {
                      label: 'Choose objectives',
                      icon: ListChecks,
                      onSelect: () => onOpenDelivery(course.id),
                    },
                    {
                      label: 'Open course page',
                      icon: ArrowUpRight,
                      onSelect: () => onOpenCourse(course.id),
                    },
                    {
                      label: 'Remove from cohort',
                      icon: Trash2,
                      tone: 'danger',
                      onSelect: () => onRemoveCourse(course),
                    },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

export default CohortCoursesPanel;
