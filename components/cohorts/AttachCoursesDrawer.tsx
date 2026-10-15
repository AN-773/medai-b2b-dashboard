import React from 'react';
import { ArrowUpRight, BookOpen, Lock, Plus } from 'lucide-react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  IconButton,
  SearchInput,
  Spinner,
  StatusDot,
} from '@/components/ui';
import { getCourseMissingItemCount, getCourseObjectiveCount, plural } from './cohortModel';

interface AttachCoursesDrawerProps {
  open: boolean;
  onClose: () => void;
  cohortTitle: string;
  /** All courses, already filtered by `search`. */
  courses: TeacherCourse[];
  totalCourseCount: number;
  attachedCount: number;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  isAttached: (courseId: string) => boolean;
  onAttach: (courseId: string) => void;
  onRemove: (course: TeacherCourse) => void;
  onOpenCourse: (courseId: string) => void;
  onBrowseCourses: () => void;
}

/** Pick which of the organisation's courses this cohort studies. */
const AttachCoursesDrawer: React.FC<AttachCoursesDrawerProps> = ({
  open,
  onClose,
  cohortTitle,
  courses,
  totalCourseCount,
  attachedCount,
  isLoading,
  search,
  onSearchChange,
  isAttached,
  onAttach,
  onRemove,
  onOpenCourse,
  onBrowseCourses,
}) => {
  const renderBody = () => {
    if (totalCourseCount === 0) {
      if (isLoading) return <Spinner label="Loading courses…" className="py-20" />;
      return (
        <EmptyState
          icon={BookOpen}
          title="No courses exist yet"
          description="Create courses on the Courses page, then come back to attach them."
          action={
            <Button variant="secondary" icon={ArrowUpRight} onClick={onBrowseCourses}>
              Go to courses
            </Button>
          }
        />
      );
    }
    if (courses.length === 0) {
      return (
        <EmptyState
          compact
          icon={BookOpen}
          title="No courses match"
          description="Try a different search."
          action={
            <Button variant="ghost" size="sm" onClick={() => onSearchChange('')}>
              Clear search
            </Button>
          }
        />
      );
    }
    return (
      <ul className="divide-y divide-stone-100">
        {courses.map((course) => {
          const attached = isAttached(course.id);
          const missingItemCount = getCourseMissingItemCount(course);
          const isLockedAttachBlocked = course.locked && !attached && missingItemCount > 0;

          return (
            <li key={course.id} className="flex items-start gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium text-stone-900">{course.title}</p>
                  {course.locked && (
                    <Badge
                      icon={Lock}
                      title="Only items linked to this course's objectives are delivered"
                    >
                      Locked
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-stone-500">
                  {plural(getCourseObjectiveCount(course), 'objective')}
                  {course.summary && <span className="text-stone-400"> · {course.summary}</span>}
                </p>
                {course.locked && missingItemCount > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    {plural(missingItemCount, 'objective')} without items
                    {isLockedAttachBlocked && ' — add content before attaching this locked course'}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
                {attached ? (
                  <>
                    <StatusDot tone="green">Attached</StatusDot>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(course)}
                      aria-label={`Remove ${course.title} from this cohort`}
                      className="hover:text-red-600"
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => onAttach(course.id)}
                    disabled={isLockedAttachBlocked}
                    title={
                      isLockedAttachBlocked
                        ? 'Locked courses need item coverage before attach.'
                        : undefined
                    }
                    aria-label={`Attach ${course.title}`}
                  >
                    Attach
                  </Button>
                )}
                <IconButton
                  icon={ArrowUpRight}
                  size="sm"
                  label={`Open ${course.title} on the Courses page`}
                  onClick={() => onOpenCourse(course.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Attach courses"
      description={cohortTitle}
      toolbar={
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-6 py-3">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search courses"
            className="w-full sm:w-72"
          />
          <Button variant="ghost" size="sm" icon={ArrowUpRight} onClick={onBrowseCourses} className="sm:ml-auto">
            Manage courses
          </Button>
        </div>
      }
      footer={
        <>
          <span className="mr-auto text-[13px] text-stone-500">
            {attachedCount > 0
              ? `${plural(attachedCount, 'course')} attached · changes save straight away`
              : 'Changes save straight away'}
          </span>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {renderBody()}
    </Drawer>
  );
};

export default AttachCoursesDrawer;
