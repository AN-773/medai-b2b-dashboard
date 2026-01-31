import React from 'react';
import { FileText, ChevronRight, Plus, Filter } from 'lucide-react';
import { USMLEStandardTopic } from '../../types';

interface TopicGridProps {
  topics: USMLEStandardTopic[];
  onSelect: (id: string) => void;
  searchTerm: string;
}

const TopicGrid: React.FC<TopicGridProps> = ({ topics, onSelect, searchTerm }) => {
  const filteredTopics = topics.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Select a Topic</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTopics.map(topic => (
          <div 
            key={topic.id}
            onClick={() => onSelect(topic.id)}
            className="group bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#1BD183] hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-12 relative z-10">
              <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-[#1BD183] group-hover:text-white transition-colors duration-300">
                <FileText size={24} className="text-slate-400 group-hover:text-white" />
              </div>
              <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center group-hover:border-[#1BD183] transition-colors">
                <ChevronRight size={14} className="text-slate-300 group-hover:text-[#1BD183]" />
              </div>
            </div>
            <h3 className="font-black text-xl text-slate-900 mb-2 relative z-10 pr-4 leading-tight">{topic.name}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide relative z-10">
              {topic.subTopics?.length || 0} Subtopics • {topic.objectives?.length || 0} Objectives
            </p>
          </div>
        ))}
        <button className="border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] hover:bg-[#1BD183]/30 transition-all min-h-[240px] group">
          <div className="p-4 bg-slate-50 rounded-full mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
             <Plus size={32} />
          </div>
          <span className="font-black text-xs uppercase tracking-widest">Add New Topic</span>
        </button>
      </div>
      {filteredTopics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Filter size={32} className="mb-2 opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest">No topics found</p>
        </div>
      )}
    </div>
  );
};

export default TopicGrid;