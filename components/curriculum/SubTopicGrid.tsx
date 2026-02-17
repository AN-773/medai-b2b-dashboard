import React, { useState } from 'react';
import { Network, ChevronRight, Plus, Filter, ArrowLeft, MoreVertical, Edit, Trash2 } from 'lucide-react';
import CreateSubTopicModal from './CreateSubTopicModal';
import { Syndrome, Topic, OrganSystem } from '@/types/TestsServiceTypes';

interface SubTopicGridProps {
  topic: Topic;
  onSelect: (subTopic: Syndrome) => void;
  onBack: () => void;
  searchTerm: string;
  onCreateSubTopic?: (data: { name: string; identifier?: string }) => Promise<void>;
  onEdit?: (id: string, name: string, topicId: string) => void;
  onDelete?: (id: string) => void;
  organSystems?: OrganSystem[];
  currentSystemId?: string;
}

const SubTopicGrid: React.FC<SubTopicGridProps> = ({ 
  topic, 
  onSelect, 
  onBack, 
  searchTerm,
  onCreateSubTopic,
  onEdit,
  onDelete,
  organSystems,
  currentSystemId,
}: SubTopicGridProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSubTopic, setEditingSubTopic] = useState<{id: string, name: string, identifier?: string} | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const subTopics: Syndrome[] = topic.syndromes?.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleModalSubmit = async (data: { name: string; identifier?: string; topicId: string }) => {
    if (editingSubTopic && onEdit) {
      await onEdit(editingSubTopic.id, data.name, data.topicId);
    } else if (onCreateSubTopic) {
      await onCreateSubTopic(data);
    }
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingSubTopic(null);
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
              onMouseLeave={() => {
                  if(activeDropdownId === sub.id) {
                      setActiveDropdownId(null);
                  }
              }}
              className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#1BD183] hover:-translate-y-1 transition-all cursor-pointer relative"
            >
              <div className="flex justify-between items-start mb-12 relative">
                <div className="p-4 bg-slate-50 rounded-[1.2rem] group-hover:bg-[#1BD183] group-hover:text-white transition-colors duration-300">
                  <Network size={24} className="text-slate-400 group-hover:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === sub.id ? null : sub.id);
                            }}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <MoreVertical size={20} />
                        </button>
                        
                        {activeDropdownId === sub.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-[999] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                {onEdit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingSubTopic({id: sub.id, name: sub.title, identifier: sub.identifier});
                                            setIsCreateModalOpen(true);
                                            setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <Edit size={16} />
                                        Edit Subtopic
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm('Are you sure you want to delete this subtopic?')) {
                                                onDelete(sub.id);
                                            }
                                            setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        Delete Subtopic
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
              </div>
              <h3 title={sub.title} className="font-black text-base text-slate-900 mb-2 relative pr-4 leading-tight line-clamp-2">{sub.title}</h3>
            </div>
          );
        })}
        {/* Add New Subtopic Button */}
        <button 
          onClick={() => {
            setEditingSubTopic(null);
            setIsCreateModalOpen(true);
          }}
          className="border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 hover:border-[#1BD183] hover:bg-[#1BD183]/10 transition-all min-h-[240px] group"
        >
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

      <CreateSubTopicModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
        organSystems={organSystems || []}
        defaultOrganSystemId={currentSystemId}
        defaultTopicId={topic.id}
        initialData={editingSubTopic ? { ...editingSubTopic, topicId: topic.id, organSystemId: currentSystemId } : null}
      />
    </div>
  );
};

export default SubTopicGrid;
