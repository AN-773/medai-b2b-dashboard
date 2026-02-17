
import React, { useState, useMemo } from 'react';
import { Search, LayoutGrid, ChevronRight, MoreVertical, Edit, Trash2, Plus, X, Check, Loader2 } from 'lucide-react';
import { OrganSystem } from '../../types/TestsServiceTypes';

interface SidebarProps {
  systems: OrganSystem[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => Promise<void>;
  onEdit?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({ systems, activeId, onSelect, onCreate, onEdit, onDelete }: SidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const filteredSystems: OrganSystem[] = useMemo(() => {
    return systems.filter(system => system.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [systems, searchTerm]);

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setActiveDropdownId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !onEdit) return;
    setIsSubmitting(true);
    try {
      await onEdit(editingId, editName.trim());
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setIsSubmitting(false);
      setEditingId(null);
      setEditName('');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !onCreate) return;
    setIsSubmitting(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    if (confirm('Are you sure you want to delete this organ system? All its topics and subtopics will also be deleted.')) {
      try {
        await onDelete(id);
      } catch (error) {
        console.error('Failed to delete:', error);
      }
    }
    setActiveDropdownId(null);
  };

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
      
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
        {filteredSystems.map(system => (
          <div key={system.id} className="relative group/item">
            {editingId === system.id ? (
              <div className="flex items-center gap-2 p-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                  }}
                  className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1BD183]"
                  autoFocus
                  disabled={isSubmitting}
                />
                <button onClick={handleSaveEdit} disabled={isSubmitting} className="p-1.5 text-[#1BD183] hover:bg-[#1BD183]/10 rounded-lg transition-colors">
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button onClick={() => { setEditingId(null); setEditName(''); }} disabled={isSubmitting} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => onSelect(system.id)}
                  className={`flex-1 min-w-0 flex items-center justify-between p-4 rounded-2xl text-xs font-bold transition-all ${
                    activeId === system.id 
                      ? 'bg-[#1BD183] text-black' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{system.title}</span>
                  {activeId === system.id && <ChevronRight size={14} className="text-slate-400" />}
                </button>
                {(onEdit || onDelete) && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownId(activeDropdownId === system.id ? null : system.id);
                      }}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors opacity-0 group-hover/item:opacity-100"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {activeDropdownId === system.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-[999] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        {onEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(system.id, system.title);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit size={14} />
                            Rename
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(system.id);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {filteredSystems.length === 0 && (
          <div className="px-6 py-4 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">No systems found</p>
          </div>
        )}
      </div>

      {/* Add New System */}
      {onCreate && (
        <div className="p-4 border-t border-slate-100">
          {isCreating ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                }}
                placeholder="System name..."
                className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1BD183] placeholder:text-slate-400"
                autoFocus
                disabled={isSubmitting}
              />
              <button onClick={handleCreate} disabled={isSubmitting || !newName.trim()} className="p-1.5 text-[#1BD183] hover:bg-[#1BD183]/10 rounded-lg transition-colors disabled:opacity-50">
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => { setIsCreating(false); setNewName(''); }} disabled={isSubmitting} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] hover:bg-[#1BD183]/5 transition-all text-xs font-black uppercase tracking-widest"
            >
              <Plus size={14} />
              Add System
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
