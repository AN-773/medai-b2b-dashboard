import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TeacherCohort, TeacherStudent } from '@/types/AcademyStudioTypes';
import { Badge, IconButton, Spinner, cn } from '@/components/ui';
import {
  formatDate,
  getInitials,
  getStudentSourceLabel,
  plural,
} from './studentRegistryUtils';

interface StudentsTableProps {
  students: TeacherStudent[];
  cohortsByStudent: Map<string, TeacherCohort[]>;
  isLoading: boolean;
  selectedStudentId: string | null;
  onOpenStudent: (student: TeacherStudent) => void;
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  /** Students on the current page who belong to at least one cohort. */
  inCohortOnPage: number;
  onPageChange: (page: number) => void;
}

const MAX_COHORT_BADGES = 2;

export const StudentAvatar: React.FC<{ student: TeacherStudent; size?: 'sm' | 'lg' }> = ({
  student,
  size = 'sm',
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'flex flex-shrink-0 items-center justify-center rounded-full bg-stone-100 font-medium text-stone-600',
      size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm',
    )}
  >
    {getInitials(student.name, student.email)}
  </span>
);

const CohortCell: React.FC<{ cohorts: TeacherCohort[] }> = ({ cohorts }) => {
  if (cohorts.length === 0) {
    return <span className="text-stone-400">No cohort</span>;
  }
  const shown = cohorts.slice(0, MAX_COHORT_BADGES);
  const rest = cohorts.slice(MAX_COHORT_BADGES);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((cohort) => (
        <Badge key={cohort.id} className="max-w-[11rem]" title={cohort.title}>
          <span className="min-w-0 truncate">{cohort.title}</span>
        </Badge>
      ))}
      {rest.length > 0 && (
        <Badge title={rest.map((cohort) => cohort.title).join(', ')}>+{rest.length}</Badge>
      )}
    </div>
  );
};

const StudentsTable: React.FC<StudentsTableProps> = ({
  students,
  cohortsByStudent,
  isLoading,
  selectedStudentId,
  onOpenStudent,
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  inCohortOnPage,
  onPageChange,
}) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Student
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Student code
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Cohorts
            </th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
              Program
            </th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
              Added
            </th>
            <th scope="col" className="w-10 px-2 py-2.5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody
          aria-busy={isLoading}
          className={cn('transition-opacity', isLoading && 'opacity-60')}
        >
          {students.map((student) => {
            const cohorts = cohortsByStudent.get(student.id) || [];
            const added = formatDate(student.createdAt);
            const isSelected = student.id === selectedStudentId;
            return (
              <tr
                key={student.id}
                onClick={() => onOpenStudent(student)}
                className={cn(
                  'group cursor-pointer border-b border-stone-100 transition-colors last:border-b-0 hover:bg-stone-50',
                  isSelected && 'bg-stone-50',
                )}
              >
                <td className="max-w-[20rem] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar student={student} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenStudent(student);
                        }}
                        className="block max-w-full truncate rounded text-left text-sm font-medium text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        {student.name || 'Unnamed student'}
                      </button>
                      <p className="truncate text-stone-500">
                        {student.email || <span className="text-stone-400">No email yet</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-stone-600">
                  {student.learnerCode || <span className="text-stone-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <CohortCell cohorts={cohorts} />
                </td>
                <td className="hidden max-w-[14rem] px-4 py-3 text-stone-700 lg:table-cell">
                  <span className="line-clamp-2">
                    {student.program || <span className="text-stone-400">—</span>}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                  <p className="tabular-nums text-stone-700">{added ?? '—'}</p>
                  <p className="text-xs text-stone-500">{getStudentSourceLabel(student.source)}</p>
                </td>
                <td className="px-2 py-3 text-right">
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="text-stone-300 transition-colors group-hover:text-stone-500"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-200 px-4 py-2.5 text-[13px] text-stone-500">
      <p className="tabular-nums">
        {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {plural(total, 'student')}
        {students.length > 0 && (
          <span className="hidden sm:inline">
            {' · '}
            {inCohortOnPage.toLocaleString()} on this page in a cohort
          </span>
        )}
      </p>
      <div className="flex items-center gap-1">
        {isLoading && <Spinner className="mr-2" />}
        <span className="mr-1 tabular-nums">
          Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        </span>
        <IconButton
          icon={ChevronLeft}
          label="Previous page"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1 || isLoading}
        />
        <IconButton
          icon={ChevronRight}
          label="Next page"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || isLoading}
        />
      </div>
    </div>
  </div>
);

export default StudentsTable;
