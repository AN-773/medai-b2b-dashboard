import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { ReadinessGauge } from '@/components/student_mastery/ReadinessGauge';
import { useMasteryContext } from './MasteryLayout';
import { formatScore, getIdSuffix } from './masteryShared';

const MasteryGlobalView: React.FC = () => {
  const { cohorts, isCatalogLoading } = useMasteryContext();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-slate-900 rounded-[2.5rem] px-5 py-6 sm:px-6 sm:py-7 text-white relative overflow-hidden min-h-[240px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(27,209,131,0.12),_transparent_35%)] pointer-events-none" />
          <div className="relative z-10 flex h-full items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Cohort Readiness
              </p>
              <ReadinessGauge value={formatScore(0)} size="medium" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1BD183]/5 text-[#1BD183] rounded-xl">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                Cohort Overview
              </h3>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <p className="text-xs font-bold uppercase tracking-widest">
              Pick a cohort from the sidebar
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Layers size={20} className="text-[#1BD183]" />
            Cohorts
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Select a cohort to inspect its metrics and learners.
          </p>
        </div>

        {isCatalogLoading ? (
          <div className="px-8 py-16 text-center text-sm text-slate-400">
            Loading cohorts…
          </div>
        ) : cohorts.length === 0 ? (
          <div className="px-8 py-16 text-center text-sm text-slate-400">
            No cohorts found. Create one from the Cohorts page first.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cohorts.map((cohort) => (
              <li key={cohort.id}>
                <Link
                  to={`/mastery/cohorts/${encodeURIComponent(getIdSuffix(cohort.id))}`}
                  className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-8 py-5 hover:bg-slate-50 transition text-left"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{cohort.title}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {cohort.description || 'No description yet'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {cohort.term || 'No term'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {cohort.studentIds.length} learners
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {cohort.courseIds.length} courses
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default MasteryGlobalView;
