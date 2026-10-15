import React from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Loader2, Plus, UsersRound } from 'lucide-react';
import type { TeacherStudent } from '@/types/AcademyStudioTypes';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  SearchInput,
  SectionHeader,
  Spinner,
  StatusDot,
} from '@/components/ui';
import { plural } from './cohortModel';

interface CohortLearnersPanelProps {
  memberCount: number;
  students: TeacherStudent[];
  studentTotal: number;
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  isLoading: boolean;
  loadError: string | null;
  search: string;
  /** The search actually sent to the backend (deferred). */
  appliedSearch: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  isMember: (studentId: string) => boolean;
  onToggleLearner: (studentId: string) => void;
  onOpenRegistry: () => void;
}

/**
 * Who is in the cohort. Lists the organisation's learner registry (paged on
 * the server) with each learner's membership and a one-click add / remove.
 */
const CohortLearnersPanel: React.FC<CohortLearnersPanelProps> = ({
  memberCount,
  students,
  studentTotal,
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  isLoading,
  loadError,
  search,
  appliedSearch,
  onSearchChange,
  onPageChange,
  isMember,
  onToggleLearner,
  onOpenRegistry,
}) => {
  const renderBody = () => {
    if (loadError) {
      return <InlineAlert title="Couldn't load learners">{loadError}</InlineAlert>;
    }
    if (students.length === 0) {
      if (isLoading) return <Spinner label="Loading learners…" className="py-20" />;
      return appliedSearch ? (
        <EmptyState
          compact
          icon={UsersRound}
          title="No learners match"
          description={`Nobody in the registry matches “${appliedSearch}”.`}
          action={
            <Button variant="ghost" size="sm" onClick={() => onSearchChange('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={UsersRound}
          title="No learners in your registry yet"
          description="Invite or import learners first, then come back to add them to this cohort."
          action={
            <Button variant="secondary" icon={ArrowUpRight} onClick={onOpenRegistry}>
              Open learner registry
            </Button>
          }
        />
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60 text-xs text-stone-500">
                <th scope="col" className="px-4 py-2 font-medium">
                  Learner
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Program
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Learner code
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody className={isLoading ? 'opacity-60 transition-opacity' : undefined}>
              {students.map((student) => {
                const member = isMember(student.id);
                return (
                  <tr
                    key={student.id}
                    className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50"
                  >
                    <td className="max-w-[18rem] px-4 py-2.5">
                      <p className="truncate text-sm font-medium text-stone-900">{student.name}</p>
                      <p className="truncate text-stone-500">{student.email}</p>
                    </td>
                    <td className={student.program ? 'px-4 py-2.5 text-stone-700' : 'px-4 py-2.5 text-stone-400'}>
                      {student.program || 'No program'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-stone-700">
                      {student.learnerCode || <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {member ? (
                        <StatusDot tone="green">In cohort</StatusDot>
                      ) : (
                        <span className="text-xs text-stone-400">Not in cohort</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {member ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onToggleLearner(student.id)}
                          aria-label={`Remove ${student.name} from this cohort`}
                          className="hover:text-red-600"
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Plus}
                          onClick={() => onToggleLearner(student.id)}
                          aria-label={`Add ${student.name} to this cohort`}
                        >
                          Add
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-2">
          <p className="text-[13px] tabular-nums text-stone-500">
            {rangeStart}–{rangeEnd} of {plural(studentTotal, 'learner')}
          </p>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[13px] tabular-nums text-stone-500">
              Page {page} of {totalPages}
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
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Learners"
        meta={
          <Badge tone={memberCount > 0 ? 'green' : 'neutral'} icon={memberCount > 0 ? Check : undefined}>
            {plural(memberCount, 'learner')} in cohort
          </Badge>
        }
        description="Add learners from your organisation's registry. Changes save straight away."
        actions={
          <Button variant="secondary" icon={ArrowUpRight} onClick={onOpenRegistry}>
            Learner registry
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search learners by name or email"
          className="w-full sm:w-80"
        />
        {isLoading && students.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-stone-500">
            <Loader2 size={14} className="animate-spin text-brand-600" />
            Loading…
          </span>
        )}
      </div>

      {renderBody()}
    </div>
  );
};

export default CohortLearnersPanel;
