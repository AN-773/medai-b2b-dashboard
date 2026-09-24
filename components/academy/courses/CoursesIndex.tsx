import React, { useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { BookOpen, ChevronRight, Library, Lock, Plus, Target, UsersRound } from 'lucide-react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import type { Curriculum } from '@/types/TestsServiceTypes';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Spinner,
} from '@/components/ui';
import { TopBar } from '@/components/shell/TopBar';
import {
  getCourseObjectiveCount,
  getCoursePendingSuggestionCount,
} from '@/components/academy/course-workbench/shared';

type CourseFilter = 'all' | 'review' | 'empty';

interface CoursesIndexProps {
  curricula: Curriculum[];
  selectedCurriculum: Curriculum | null;
  isLoadingCurricula: boolean;
  curriculumError: string | null;
  onCurriculumChange: (curriculumId: string | null) => void;
  /** Courses in the selected curriculum. */
  courses: TeacherCourse[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  cohortCountByCourse: Map<string, number>;
  onOpenCourse: (courseId: string) => void;
  onNewCourse: () => void;
}

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

const relativeTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : formatDistanceToNowStrict(date, { addSuffix: true });
};

export const CoursesBreadcrumb: React.FC<{
  courseTitle?: string;
  onCoursesClick?: () => void;
}> = ({ courseTitle, onCoursesClick }) => (
  <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
    <span className="hidden text-stone-400 sm:inline">Teaching</span>
    <ChevronRight size={14} className="hidden flex-shrink-0 text-stone-300 sm:block" />
    {courseTitle ? (
      <>
        <button
          type="button"
          onClick={onCoursesClick}
          className="rounded px-1 -mx-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
        >
          Courses
        </button>
        <ChevronRight size={14} className="flex-shrink-0 text-stone-300" />
        <span className="truncate font-medium text-stone-900" aria-current="page">
          {courseTitle}
        </span>
      </>
    ) : (
      <span className="font-medium text-stone-900" aria-current="page">
        Courses
      </span>
    )}
  </nav>
);

const CourseCard: React.FC<{
  course: TeacherCourse;
  cohortCount: number;
  onOpen: () => void;
}> = ({ course, cohortCount, onOpen }) => {
  const objectiveCount = getCourseObjectiveCount(course);
  const pending = getCoursePendingSuggestionCount(course);
  const updated = relativeTime(course.updatedAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full min-h-[184px] flex-col rounded-xl border border-stone-200 bg-white p-5 text-left shadow-card transition hover:border-stone-300 hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <div className="flex w-full items-start gap-3">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-6 text-stone-900">
          {course.title}
        </h3>
        {pending > 0 ? (
          <Badge tone="amber" dot>
            {pending} to review
          </Badge>
        ) : objectiveCount === 0 ? (
          <Badge tone="neutral">Draft</Badge>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-stone-500">
        {course.summary || <span className="text-stone-400">No summary yet</span>}
      </p>

      <div className="mt-auto w-full pt-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-stone-100 pt-3 text-[13px] text-stone-600">
          <span className="inline-flex items-center gap-1.5">
            <Target size={14} className="text-stone-400" />
            {objectiveCount > 0 ? plural(objectiveCount, 'objective') : 'No objectives'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersRound size={14} className="text-stone-400" />
            {cohortCount > 0 ? plural(cohortCount, 'cohort') : 'Not assigned'}
          </span>
          {course.locked && (
            <span className="inline-flex items-center gap-1" title="Locked: only this course's own items are delivered">
              <Lock size={13} className="text-stone-400" />
              Locked
            </span>
          )}
          {updated && (
            <span className="ml-auto text-xs text-stone-400">Updated {updated}</span>
          )}
        </div>
      </div>
    </button>
  );
};

const CoursesIndex: React.FC<CoursesIndexProps> = ({
  curricula,
  selectedCurriculum,
  isLoadingCurricula,
  curriculumError,
  onCurriculumChange,
  courses,
  isLoading,
  searchQuery,
  onSearchChange,
  cohortCountByCourse,
  onOpenCourse,
  onNewCourse,
}) => {
  const [filter, setFilter] = useState<CourseFilter>('all');

  const counts = useMemo(
    () => ({
      all: courses.length,
      review: courses.filter((course) => getCoursePendingSuggestionCount(course) > 0).length,
      empty: courses.filter((course) => getCourseObjectiveCount(course) === 0).length,
    }),
    [courses],
  );

  const visibleCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return courses
      .filter((course) =>
        filter === 'review'
          ? getCoursePendingSuggestionCount(course) > 0
          : filter === 'empty'
            ? getCourseObjectiveCount(course) === 0
            : true,
      )
      .filter(
        (course) =>
          !query ||
          [course.title, course.summary].some((value) => value?.toLowerCase().includes(query)),
      )
      // Most recently edited first, so "continue where I left off" is one click.
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [courses, filter, searchQuery]);

  const renderBody = () => {
    if (isLoadingCurricula || (isLoading && selectedCurriculum && courses.length === 0)) {
      return <Spinner label="Loading courses…" className="py-24" />;
    }
    if (curriculumError) {
      return (
        <EmptyState icon={Library} title="Couldn't load curricula" description={curriculumError} />
      );
    }
    if (curricula.length === 0) {
      return (
        <EmptyState
          icon={Library}
          title="Create a curriculum first"
          description="Courses live inside a curriculum. Set one up in Curricula, then come back to build courses in it."
        />
      );
    }
    if (!selectedCurriculum) {
      return (
        <EmptyState
          icon={Library}
          title="Choose a curriculum"
          description="Pick the curriculum you're working on to see its courses."
        />
      );
    }
    if (courses.length === 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description={`Create the first course in ${selectedCurriculum.title}. You'll add objectives, content and modules next.`}
          action={
            <Button variant="primary" icon={Plus} onClick={onNewCourse}>
              New course
            </Button>
          }
        />
      );
    }
    if (visibleCourses.length === 0) {
      return (
        <EmptyState
          compact
          icon={BookOpen}
          title="No courses match"
          description="Try a different search or filter."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange('');
                setFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleCourses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            cohortCount={cohortCountByCourse.get(course.id) || 0}
            onOpen={() => onOpenCourse(course.id)}
          />
        ))}
        {filter === 'all' && !searchQuery && (
          <button
            type="button"
            onClick={onNewCourse}
            className="flex min-h-[184px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 text-sm font-medium text-stone-500 transition hover:border-stone-400 hover:bg-stone-50 hover:text-stone-800"
          >
            <Plus size={18} />
            New course
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <TopBar>
        <CoursesBreadcrumb />
      </TopBar>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8">
        <PageHeader
          title="Courses"
          description="Build a course from learning objectives, author practice content for them, then package it into modules for your cohorts."
          actions={
            <Button
              variant="primary"
              icon={Plus}
              onClick={onNewCourse}
              disabled={!selectedCurriculum}
            >
              New course
            </Button>
          }
        />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-[13px] text-stone-500">Curriculum</span>
            <Select
              value={selectedCurriculum?.id ?? ''}
              onChange={(event) => onCurriculumChange(event.target.value || null)}
              disabled={isLoadingCurricula || curricula.length === 0}
              className="w-56"
            >
              <option value="">{isLoadingCurricula ? 'Loading…' : 'Select a curriculum'}</option>
              {curricula.map((curriculum) => (
                <option key={curriculum.id} value={curriculum.id}>
                  {curriculum.title}
                </option>
              ))}
            </Select>
          </label>
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search courses"
            disabled={!selectedCurriculum}
            className="w-full sm:w-72"
          />
          {selectedCurriculum && courses.length > 0 && (
            <SegmentedControl<CourseFilter>
              label="Filter courses"
              value={filter}
              onChange={setFilter}
              className="sm:ml-auto"
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'review', label: 'Needs review', count: counts.review },
                { value: 'empty', label: 'No objectives', count: counts.empty },
              ]}
            />
          )}
        </div>

        <div className="mt-5">{renderBody()}</div>
      </div>
    </>
  );
};

export default CoursesIndex;
