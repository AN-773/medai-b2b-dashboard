import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, GraduationCap } from 'lucide-react';
import type { TeacherCohort } from '@/types/AcademyStudioTypes';
import { getIdSuffix } from './masteryShared';

interface MasterySidebarProps {
  cohorts: TeacherCohort[];
  isCatalogLoading: boolean;
  selectedCohortRouteId: string | null;
}

const MasterySidebar: React.FC<MasterySidebarProps> = ({
  cohorts,
  isCatalogLoading,
  selectedCohortRouteId,
}) => {
  const isGlobalView = !selectedCohortRouteId;

  return (
    <div className="w-full h-[calc(100vh-140px)] xl:w-72 xl:sticky xl:top-6 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 flex flex-col gap-6 shrink-0 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-6">
        <Link
          to="/mastery"
          className={`block w-full text-left p-4 rounded-2xl transition-all border group ${
            isGlobalView
              ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isGlobalView
                  ? 'bg-white/10 text-white'
                  : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
              }`}
            >
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">Global View</p>
              <p className="text-[10px] font-medium mt-0.5 text-slate-400">
                All Cohorts
              </p>
            </div>
          </div>
        </Link>

        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1BD183]/80 bg-[#1BD183]/10 px-2 py-1 rounded-lg">
              Cohorts
            </span>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>

          {isCatalogLoading && (
            <p className="text-xs text-slate-400 px-2">Loading cohorts…</p>
          )}

          {!isCatalogLoading && cohorts.length === 0 && (
            <p className="text-xs text-slate-400 px-2">
              No cohorts available.
            </p>
          )}

          <div className="space-y-2">
            {cohorts.map((cohort) => {
              const routeId = getIdSuffix(cohort.id);
              const isActive = selectedCohortRouteId === routeId;
              return (
                <Link
                  key={cohort.id}
                  to={`/mastery/cohorts/${encodeURIComponent(routeId)}`}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all group ${
                    isActive
                      ? 'bg-[#1BD183]/5 border-[#1BD183]/20 text-[#1BD183] shadow-sm'
                      : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-[#1BD183]'
                          : 'bg-slate-300 group-hover:bg-[#1BD183]/50'
                      }`}
                    ></div>
                    <span className="truncate text-left">{cohort.title}</span>
                  </div>
                  {isActive && (
                    <ChevronRight size={14} className="text-[#1BD183]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterySidebar;
