import * as React from 'react';
import { useEffect, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import { MasteryLoadingView } from './masteryShared';

export interface MasteryOutletContext {
  cohorts: TeacherCohort[];
  courses: TeacherCourse[];
  isCatalogLoading: boolean;
  catalogError: string | null;
}

export const useMasteryContext = () => useOutletContext<MasteryOutletContext>();

/**
 * Loads the cohort/course catalog once for the Mastery overview and cohort
 * pages. It renders no chrome of its own: each page starts with its
 * PageHeader (cohort switching lives in the cohort page's header actions) and
 * shows `catalogError` under it.
 */
const MasteryLayout: React.FC = () => {
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsCatalogLoading(true);
    academyStudioBackend
      .loadCatalogSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setCohorts(snapshot.cohorts);
        setCourses(snapshot.courses);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load cohorts/courses:', error);
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'Unable to load cohorts from the backend.',
        );
      })
      .finally(() => {
        if (!active) return;
        setIsCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isBootstrapping =
    isCatalogLoading && cohorts.length === 0 && courses.length === 0;

  if (isBootstrapping) {
    return <MasteryLoadingView label="Loading cohorts…" />;
  }

  const contextValue: MasteryOutletContext = {
    cohorts,
    courses,
    isCatalogLoading,
    catalogError,
  };

  return <Outlet context={contextValue} />;
};

export default MasteryLayout;
