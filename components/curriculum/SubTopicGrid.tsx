import React, { useState } from 'react';
import { Network, ChevronRight, Plus, Filter, ArrowLeft } from 'lucide-react';
import CreateSubTopicModal from './CreateSubTopicModal';
import { Syndrome, Topic } from '@/types/TestsServiceTypes';

interface SubTopicGridProps {
  topic: Topic;
  onSelect: (subTopic: Syndrome) => void;
  onBack: () => void;
  searchTerm: string;
  onCreateSubTopic?: (data: { name: string; identifier?: string }) => Promise<void>;
}

const SubTopicGrid: React.FC<SubTopicGridProps> = ({ 
  topic, 
  onSelect, 
  onBack, 
  searchTerm,
  onCreateSubTopic 
}: SubTopicGridProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const subTopics: Syndrome[] = topic.syndromes?.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const handleCreateSubTopic = async (data: { name: string; identifier?: string }) => {
    if (onCreateSubTopic) {
      await onCreateSubTopic(data);
    } else {
      // Placeholder - will be replaced when API endpoints are provided
      console.log('Create subtopic:', data);
      throw new Error('API endpoint not yet implemented');
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group">
           <ArrowLeft size={20} className="text-slate-400 group-hover:text-slate-900" />
        </button>
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Select Specific Subtopic</h2>
           <p className="text-sm font-medium text-slate-500 mt-1">{topic.title}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {subTopics.map(sub => {
          return (
            <div 
              key={sub.id}
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
              <h3 className="font-black text-xl text-slate-900 mb-2 relative z-10 pr-4 leading-tight">{sub.title}</h3>
            </div>
          );
        })}
        {/* Add New Subtopic Button */}
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 hover:border-[#6366f1] hover:bg-[#6366f1]/10 transition-all min-h-[240px] group"
        >
          <div className="p-4 bg-slate-50 rounded-full mb-4 group-hover:bg-white group-hover:shadow-md group-hover:text-[#6366f1] transition-all">
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

      <CreateSubTopicModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubTopic}
        topicName={topic.title}
      />
    </div>
  );
};

export default SubTopicGrid;
