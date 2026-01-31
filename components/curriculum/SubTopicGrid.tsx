
import React from 'react';
import { Network, ChevronRight, Plus, Filter, ArrowLeft } from 'lucide-react';
import { USMLEStandardTopic } from '../../types';

interface SubTopicGridProps {
  topic: USMLEStandardTopic;
  onSelect: (subTopic: string) => void;
  onBack: () => void;
  searchTerm: string;
}

const SubTopicGrid: React.FC<SubTopicGridProps> = ({ topic, onSelect, onBack, searchTerm }) => {
  const subTopics = topic.subTopics?.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group">
           <ArrowLeft size={20} className="text-slate-400 group-hover:text-slate-900" />
        </button>
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Select Specific Subtopic</h2>
           <p className="text-sm font-medium text-slate-500 mt-1">{topic.name}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {subTopics.map(sub => {
          // Count objectives for this subtopic
          const objCount = topic.objectives?.filter(o => o.subTopic === sub).length || 0;
          return (
            <div 
              key={sub}
              onClick={() => onSelect(sub)}
              className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#1BD183] hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-12 relative z-10">
                <div className="p-4 bg-slate-50 rounded-[1.2rem] group-hover:bg-[#1BD183] group-hover:text-white transition-colors duration-300">
                  <Network size={24} className="text-slate-400 group-hover:text-white" />
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center group-hover:border-[#1BD183] transition-colors">
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#1BD183]" />
                </div>
              </div>
              <h3 className="font-black text-xl text-slate-900 mb-2 relative z-10 pr-4 leading-tight">{sub}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide relative z-10">
                {objCount} Learning Objectives
              </p>
            </div>
          );
        })}
        {/* Add New Subtopic Stub */}
        <button className="border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 hover:border-[#1BD183] hover:bg-[#1BD183]/30 transition-all min-h-[240px] group">
          <div className="p-4 bg-slate-50 rounded-full mb-4 group-hover:bg-white group-hover:shadow-md group-hover:text-[#1BD183] transition-all">
             <Plus size={32} />
          </div>
          <span className="font-black text-xs uppercase tracking-widest">Add New Subtopic</span>
        </button>
      </div>
      {subTopics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Filter size={32} className="mb-2 opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest">No subtopics found for this topic</p>
        </div>
      )}
    </div>
  );
};

export default SubTopicGrid;
