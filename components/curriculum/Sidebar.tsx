
import React, { useState, useMemo } from 'react';
import { Search, LayoutGrid, ChevronRight } from 'lucide-react';
import { USMLEStandardCategory } from '../../types';

interface SidebarProps {
  systems: USMLEStandardCategory[];
  activeId: string;
  onSelect: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ systems, activeId, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSystems = useMemo(() => {
    return systems.filter(sys => sys.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [systems, searchTerm]);

  return (
    <div className="w-80 bg-white flex-shrink-0 flex flex-col border-r border-slate-100 h-full">
      <div className="p-8 pb-4">
        <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <LayoutGrid size={14} /> MSAi® Curriculum
        </h2>
        <div className="relative group">
          <Search className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search Systems..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 text-xs font-bold text-slate-700 pl-11 pr-4 py-3.5 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400 hover:bg-slate-100 focus:bg-white"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-1 custom-scrollbar">
        {filteredSystems.map(system => (
          <button
            key={system.id}
            onClick={() => onSelect(system.id)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl text-xs font-bold transition-all group ${
              activeId === system.id 
                ? 'bg-[#1BD183] text-black' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="truncate">{system.name}</span>
            {activeId === system.id && <ChevronRight size={14} className="text-slate-400" />}
          </button>
        ))}
        {filteredSystems.length === 0 && (
          <div className="px-6 py-4 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">No systems found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
