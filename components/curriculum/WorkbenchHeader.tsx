
import React from 'react';
import { BookOpen, Search, Upload, Download, Plus } from 'lucide-react';

interface WorkbenchHeaderProps {
  onImport: () => void;
  onExport: () => void;
  searchTerm: string;
  setSearch: (term: string) => void;
  searchPlaceholder: string;
}

const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({ 
  onImport, 
  onExport, 
  searchTerm, 
  setSearch, 
  searchPlaceholder
}) => {
  return (
    <header className="h-20 border-b border-slate-100 flex items-center justify-between px-10 flex-shrink-0 bg-white/80 backdrop-blur-xl z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-[#1BD183]">
            <BookOpen size={20} />
            </div>
            <h1 className="font-black text-sm uppercase tracking-wide text-slate-900">Curriculum Workbench</h1>
        </div>
        
        <div className="relative group hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1BD183] transition-colors" size={14} />
            <input 
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-100/50 hover:bg-slate-100 focus:bg-white border-none rounded-xl py-2.5 pl-9 pr-4 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1BD183]/20 w-64 transition-all"
            />
        </div>
      </div>

      <div className="flex items-center gap-4 ps-4">
        <button 
            onClick={onImport}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1BD183] transition-colors flex items-center gap-2"
            title="Format: System, Topic, Objective, Bloom"
        >
            <Upload size={14} /> Import Data
        </button>

        <button 
            onClick={onExport}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1BD183] transition-colors flex items-center gap-2"
        >
            <Download size={14} /> Export Map
        </button>

        {/* <button className="bg-primary-gradient text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95">
          <Plus size={14} /> New Objective
        </button> */}
      </div>
    </header>
  );
};

export default WorkbenchHeader;
