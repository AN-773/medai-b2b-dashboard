import * as React from 'react';
import { useEffect, useState } from 'react';
import { Outlet, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import MasterySidebar from './MasterySidebar';
import { MasteryLoadingView } from './masteryShared';

export interface MasteryOutletContext {
  cohorts: TeacherCohort[];
  courses: TeacherCourse[];
  isCatalogLoading: boolean;
  catalogError: string | null;
}

export const useMasteryContext = () => useOutletContext<MasteryOutletContext>();

const MasteryLayout: React.FC = () => {
  const { cohortId } = useParams();
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
    return (
      <div>
        <MasteryLoadingView />
      </div>
    );
  }

  const contextValue: MasteryOutletContext = {
    cohorts,
    courses,
    isCatalogLoading,
    catalogError,
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-in fade-in duration-700">
      <MasterySidebar
        cohorts={cohorts}
        isCatalogLoading={isCatalogLoading}
        selectedCohortRouteId={cohortId || null}
      />
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
        {catalogError && (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm flex items-center gap-3">
            <AlertTriangle size={16} />
            {catalogError}
          </div>
        )}
        <Outlet context={contextValue} />
      </div>
    </div>
  );
};

export default MasteryLayout;
