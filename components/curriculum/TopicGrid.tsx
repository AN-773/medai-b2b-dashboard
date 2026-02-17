import React, { useState } from 'react';
import { FileText, ChevronRight, Plus, Filter, MoreVertical, Edit, Trash2 } from 'lucide-react';
import CreateTopicModal from './CreateTopicModal';
import { Topic } from '@/types/TestsServiceTypes';

interface TopicGridProps {
  topics: Topic[];
  onSelect: (id: string) => void;
  searchTerm: string;
  onCreateTopic?: (data: { name: string; identifier?: string }) => Promise<void>;
  onEdit?: (id: string, name: string, organSystemId?: string) => void;
  onDelete?: (id: string) => void;
  organSystemName?: string;
  organSystems?: { id: string, title: string }[];
  currentSystemId?: string;
}

const TopicGrid: React.FC<TopicGridProps> = ({ 
  topics, 
  onSelect, 
  searchTerm, 
  onCreateTopic,
  onEdit,
  onDelete,
  organSystemName,
  organSystems,
  currentSystemId
}: TopicGridProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<{id: string, name: string, identifier?: string} | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const filteredTopics: Topic[] = topics.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleModalSubmit = async (data: { name: string; identifier?: string; organSystemId: string }) => {
    if (editingTopic && onEdit) {
      // For now, simpler update that takes only name? NO, service update takes name.
      await onEdit(editingTopic.id, data.name, data.organSystemId);
    } else if (onCreateTopic) {
             // We need to handle the case where onCreateTopic might not expect organSystemId if strictly typed to older version, 
             // but we can cast or update type. For now, let's assume onCreateTopic will be updated or we ignore the extra field if not used yet
      await onCreateTopic(data);
    }
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingTopic(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Select a Topic</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTopics.map(topic => (
          <div 
            key={topic.id}
            onClick={() => onSelect(topic.id)}
            onMouseLeave={() => {
                if(activeDropdownId === topic.id) {
                    setActiveDropdownId(null);
                }
            }}
            className="group bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#1BD183] hover:-translate-y-1 transition-all cursor-pointer relative"
          >
              <div className="flex justify-between items-start mb-12 relative">
                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-[#1BD183] group-hover:text-white transition-colors duration-300">
                  <FileText size={24} className="text-slate-400 group-hover:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === topic.id ? null : topic.id);
                            }}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <MoreVertical size={20} />
                        </button>
                        
                        {activeDropdownId === topic.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-[999] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                {onEdit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTopic({id: topic.id, name: topic.title, identifier: topic.identifier});
                                            setIsCreateModalOpen(true);
                                            setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <Edit size={16} />
                                        Edit Topic
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm('Are you sure you want to delete this topic?')) {
                                                onDelete(topic.id);
                                            }
                                            setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        Delete Topic
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
              </div>
            <h3 title={topic.title} className="font-black text-base text-slate-900 mb-2 relative pr-4 leading-tight line-clamp-2">{topic.title}</h3>
          </div>
        ))}
        <button 
          onClick={() => {
            setEditingTopic(null);
            setIsCreateModalOpen(true);
          }}
          className="border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] hover:bg-[#1BD183]/10 transition-all min-h-[240px] group"
        >
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

      <CreateTopicModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
        organSystems={organSystems || []}
        defaultSystemId={currentSystemId}
        initialData={editingTopic ? { ...editingTopic, organSystemId: currentSystemId } : null}
      />
    </div>
  );
};

export default TopicGrid;