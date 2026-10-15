import * as React from 'react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeacherCohort } from '@/types/AcademyStudioTypes';
import { Select } from '@/components/ui';
import { findCohortByRouteId, getIdSuffix, masteryCohortPath } from './masteryShared';

interface MasterySidebarProps {
  cohorts: TeacherCohort[];
  isCatalogLoading: boolean;
  selectedCohortRouteId: string | null;
}

/**
 * Cohort navigation for the Mastery area. It used to be a tall sticky sidebar;
 * it is now a compact cohort switcher that sits in the page header's actions,
 * so the analytics below get the full page width. "All cohorts" goes back to
 * the Mastery overview.
 */
const MasterySidebar: React.FC<MasterySidebarProps> = ({
  cohorts,
  isCatalogLoading,
  selectedCohortRouteId,
}) => {
  const navigate = useNavigate();
  const selectId = useId();
  const selected = findCohortByRouteId(cohorts, selectedCohortRouteId ?? undefined);
  const isEmptyAndLoading = isCatalogLoading && cohorts.length === 0;

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <label htmlFor={selectId} className="flex-shrink-0 text-[13px] text-stone-500">
        Cohort
      </label>
      <Select
        id={selectId}
        value={selected ? getIdSuffix(selected.id) : ''}
        onChange={(event) =>
          navigate(event.target.value ? masteryCohortPath(event.target.value) : '/mastery')
        }
        disabled={isEmptyAndLoading}
        className="min-w-0 flex-1 sm:w-60 sm:flex-none"
      >
        <option value="">{isEmptyAndLoading ? 'Loading…' : 'All cohorts'}</option>
        {cohorts.map((cohort) => (
          <option key={cohort.id} value={getIdSuffix(cohort.id)}>
            {cohort.title}
          </option>
        ))}
      </Select>
    </div>
  );
};

export default MasterySidebar;
