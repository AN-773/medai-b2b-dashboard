
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronRight, Check, Edit3, Trash2, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { LearningObjective, Syndrome, Topic } from '@/types/TestsServiceTypes';
import { useGlobal } from '@/contexts/GlobalContext';

interface ObjectiveListProps {
  topic: Topic;
  subTopic?: Syndrome | null;
  searchTerm: string;
  bloomFilter: string;
  setBloomFilter: (val: string) => void;
  onBack: () => void;
  onEdit: (id: string, text: string, bloom: string) => void;
  onDelete: (id: string) => void;
  onViewLinked: (obj: LearningObjective) => void;
  isLoading?: boolean;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
}

const BLOOM_COLORS: Record<string, string> = {
  'Remember': 'bg-slate-100 text-slate-600 border-slate-200',
  'Understand': 'bg-blue-50 text-blue-600 border-blue-200',
  'Apply': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Analyze': 'bg-purple-50 text-purple-600 border-purple-200',
};

const ObjectiveList: React.FC<ObjectiveListProps> = ({
  topic, subTopic, searchTerm, bloomFilter, setBloomFilter, onBack, onEdit, onDelete, onViewLinked, isLoading,
  currentPage = 1, totalItems = 0, itemsPerPage = 20, onPageChange
}: ObjectiveListProps) => {
  const { cognitiveSkills } = useGlobal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editBloom, setEditBloom] = useState('');

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasMorePages = currentPage < totalPages;
  const loadedCount = itemsPerPage * currentPage;

  const handleStartEdit = (e: React.MouseEvent, obj: LearningObjective) => {
    e.stopPropagation();
    setEditingId(obj.id);
    setEditText(obj.title);
    setEditBloom(obj.cognitiveSkillId);
  };

  const handleSave = () => {
    if (editingId) {
      onEdit(editingId, editText, editBloom);
      setEditingId(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this learning objective?")) {
      onDelete(id);
    }
  };

  return (
    <div className="animate-in slide-in-from-right-8 duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-10">
        <div className="flex items-center gap-4 mb-8">
            <button onClick={onBack} className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group">
            <ArrowLeft size={20} className="text-slate-400 group-hover:text-slate-900" />
            </button>
            <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{subTopic?.title || topic.title}</h2>
            <div className="flex items-center gap-3 mt-2">
                {subTopic && (
                    <span className="px-3 py-1 bg-indigo-50 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    {topic.title}
                    </span>
                )}
                {!subTopic && (
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {topic.syndromes?.length} Subtopics
                    </span>
                )}
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-sm font-bold text-slate-400">{loadedCount} of {totalItems} Objectives</span>
            </div>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="relative group">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                <select
                    value={bloomFilter}
                    onChange={(e) => setBloomFilter(e.target.value)}
                    className="pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1BD183] appearance-none cursor-pointer hover:border-[#1BD183] transition-colors shadow-sm min-w-[140px]"
                >
                    <option value="All">All Types</option>
                    {Object.keys(BLOOM_COLORS).map(level => (
                        <option key={level} value={level}>{level}</option>
                    ))}
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={12} />
            </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1BD183] mb-4"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Objectives...</p>
        </div>
      ) : (
      <div className="space-y-6">
        {topic?.objectives?.map((obj) => (
          <div key={obj.id} className="relative group">
            {editingId === obj.id ? (
              <div className="flex flex-col gap-6 bg-white p-8 rounded-[2rem] border-2 border-[#1BA6D1] shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
                <div>
                   <label className="text-[10px] font-black text-[#1BA6D1] uppercase tracking-widest mb-3 block">Objective Definition</label>
                   <textarea
                     value={editText}
                     onChange={(e) => setEditText(e.target.value)}
                     className="w-full text-lg text-slate-900 font-medium bg-slate-50 border border-slate-200 rounded-2xl p-6 focus:outline-none focus:ring-4 focus:ring-[#1BD183]/10 focus:border-[#1BD183] min-h-[140px] resize-none leading-relaxed"
                   />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-full md:w-auto flex-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Cognitive Level (Bloom's)</label>
                     <select
                       value={editBloom}
                       onChange={(e) => setEditBloom(e.target.value)}
                       className="w-full bg-white border border-slate-200 text-slate-800 text-sm font-bold rounded-xl p-3 pr-10 focus:ring-[#1BD183] focus:border-[#1BD183] outline-none cursor-pointer hover:border-indigo-300 transition-colors"
                     >
                        {cognitiveSkills.map(skill => (
                          <option key={skill.id} value={skill.id}>{skill.title}</option>
                        ))}
                     </select>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => setEditingId(null)}
                      className="flex-1 md:flex-none px-6 py-3.5 text-white text-xs uppercase tracking-widest bg-[#191A19] hover:bg-[#191A19]/90 rounded-xl transition-colors border border-transparent"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSave}
                      className="flex-1 md:flex-none px-8 py-3.5 bg-primary-gradient hover:bg-primary-gradient-hover text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Check size={16} /> Save Changes
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => onViewLinked(obj)}
                className="flex items-start gap-6 p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:shadow-xl hover:border-indigo-100 transition-all duration-300 cursor-pointer"
              >
                <div className="pt-1">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs shadow-inner">
                    {obj.id.split('-')[1] || 'OBJ'}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${BLOOM_COLORS[obj?.cognitiveSkill?.title] || 'bg-slate-100'}`}>
                      {obj?.cognitiveSkill?.title}
                    </span>
                    {(obj.questions?.length || 0) > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-lg">
                        <Check size={10} /> {obj.questions?.length} Items
                      </span>
                    )}
                  </div>
                  <p className="text-lg text-slate-800 leading-relaxed font-medium">{obj.title}</p>
                </div>
                
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <button 
                    onClick={(e) => handleStartEdit(e, obj)}
                    className="p-3 text-slate-400 hover:text-[#1BD183] hover:bg-indigo-50 rounded-xl transition-colors"
                    title="Edit Objective"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" 
                    title="Delete Objective"
                    onClick={(e) => handleDelete(e, obj.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {topic?.objectives?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Filter size={24} className="mb-2 opacity-50" />
                <p className="text-xs font-black uppercase tracking-widest">No objectives found</p>
            </div>
        )}

        {!searchTerm && bloomFilter === 'All' && (
            <button className="w-full py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center gap-3 text-slate-400 hover:text-[#1BD183] hover:border-[#1BD183] hover:bg-[#1BD183]/30 transition-all group">
            <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-[#1BD183]/30 transition-colors shadow-sm">
                <Plus size={20} />
            </div>
            <span className="font-black text-xs uppercase tracking-widest">Add Learning Objective</span>
            </button>
        )}

        {/* Load More Button */}
        {hasMorePages && !searchTerm && bloomFilter === 'All' && (
          <button 
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={isLoading}
            className="w-full py-6 bg-gradient-to-r from-[#1BA6D1]/5 to-[#1BD183]/5 border border-[#1BD183]/20 rounded-2xl flex items-center justify-center gap-3 text-[#1BD183] hover:from-[#1BA6D1]/10 hover:to-[#1BD183]/10 hover:border-[#1BD183]/40 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ChevronDown size={20} className="group-hover:translate-y-0.5 transition-transform" />
            )}
            <span className="font-black text-xs uppercase tracking-widest">
              {isLoading ? 'Loading...' : `Load More (${totalItems - loadedCount} remaining)`}
            </span>
          </button>
        )}
      </div>
      )}
    </div>
  );
};

export default ObjectiveList;
