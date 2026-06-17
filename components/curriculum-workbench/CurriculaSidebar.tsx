import React from 'react';
import { Search, Plus, Library, Loader2, ChevronRight } from 'lucide-react';
import { Curriculum } from '../../types/TestsServiceTypes';
import { identifierOf } from '../../utils/resourceId';
import StatusBadge from './StatusBadge';

interface CurriculaSidebarProps {
  curricula: Curriculum[];
  isLoading: boolean;
  activeIdentifier: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (identifier: string) => void;
  onCreate: () => void;
  canManage: boolean;
}

const CurriculaSidebar: React.FC<CurriculaSidebarProps> = ({
  curricula,
  isLoading,
  activeIdentifier,
  searchQuery,
  onSearchChange,
  onSelect,
  onCreate,
  canManage,
}) => {
  return (
    <div className="w-80 bg-white flex-shrink-0 flex flex-col border-r border-slate-100 h-full">
      <div className="p-8 pb-4">
        <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Library size={14} /> MSAi® Curricula
        </h2>

        <div className="relative group">
          <Search
            className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-[#1BD183] transition-colors"
            size={16}
          />
          <input
            type="text"
            placeholder="Search curricula..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 text-xs font-bold text-slate-700 pl-11 pr-4 py-3.5 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all placeholder:text-slate-400 hover:bg-slate-100 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mb-3 text-[#1BD183]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Loading…</p>
          </div>
        ) : curricula.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Library size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
              {searchQuery ? 'No matching curricula' : 'No curricula yet'}
            </p>
          </div>
        ) : (
          curricula.map((curriculum) => {
            const slug = identifierOf(curriculum);
            const isActive = activeIdentifier === slug;
            return (
              <button
                key={curriculum.id}
                onClick={() => onSelect(slug)}
                className={`w-full text-left p-4 rounded-2xl transition-all group ${
                  isActive
                    ? 'bg-[#1BD183]/10 border border-[#1BD183]/30 shadow-sm'
                    : 'border border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`truncate text-sm font-black ${
                      isActive ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                    }`}
                  >
                    {curriculum.title}
                  </span>
                  {isActive && <ChevronRight size={14} className="text-[#1BD183] flex-shrink-0" />}
                </div>
                <StatusBadge status={curriculum.status} currentVersion={curriculum.currentVersion} />
              </button>
            );
          })
        )}
      </div>

      {canManage && (
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onCreate}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] hover:bg-[#1BD183]/5 transition-all text-xs font-black uppercase tracking-widest"
          >
            <Plus size={14} />
            New Curriculum
          </button>
        </div>
      )}
    </div>
  );
};

export default CurriculaSidebar;
