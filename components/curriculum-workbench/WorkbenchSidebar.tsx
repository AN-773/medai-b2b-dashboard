import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Library,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  Link2,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { Curriculum, OrganSystem } from '../../types/TestsServiceTypes';
import { identifierOf } from '../../utils/resourceId';

interface WorkbenchSidebarProps {
  curricula: Curriculum[];
  isLoadingCurricula: boolean;
  activeCurriculumIdentifier: string | null;
  onCurriculumChange: (identifier: string) => void;
  onCreateCurriculum: () => void;

  organSystems: OrganSystem[];
  isLoadingOrganSystems: boolean;
  activeSystemId: string | null;
  onSelectSystem: (id: string) => void;
  onCreateSystem: (name: string) => Promise<void>;
  onOpenAttach: () => void;
  onEditSystem: (id: string, name: string) => Promise<void>;
  onDeleteSystem: (id: string) => Promise<void>;

  canManage: boolean;
}

const WorkbenchSidebar: React.FC<WorkbenchSidebarProps> = ({
  curricula,
  isLoadingCurricula,
  activeCurriculumIdentifier,
  onCurriculumChange,
  onCreateCurriculum,
  organSystems,
  isLoadingOrganSystems,
  activeSystemId,
  onSelectSystem,
  onCreateSystem,
  onOpenAttach,
  onEditSystem,
  onDeleteSystem,
  canManage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const hasCurriculum = !!activeCurriculumIdentifier;

  useEffect(() => {
    if (!activeDropdownId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setActiveDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDropdownId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDropdownId]);

  const displaySystems = useMemo(
    () =>
      organSystems
        .filter((s) => s.title)
        .filter((s) => s.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [organSystems, searchTerm],
  );

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setActiveDropdownId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setIsSubmitting(true);
    try {
      await onEditSystem(editingId, editName.trim());
    } catch (error) {
      console.error('Failed to update organ system:', error);
    } finally {
      setIsSubmitting(false);
      setEditingId(null);
      setEditName('');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateSystem(newName.trim());
      setNewName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create organ system:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        'Delete this organ system entirely? This removes it (and its topics/subtopics) for all curricula, not just this one. This cannot be undone.',
      )
    ) {
      try {
        await onDeleteSystem(id);
      } catch (error) {
        console.error('Failed to delete organ system:', error);
      }
    }
    setActiveDropdownId(null);
  };

  return (
    <div
      ref={sidebarRef}
      className="w-80 bg-white flex-shrink-0 flex flex-col border-r border-slate-100 h-full"
    >
      <div className="p-8 pb-4">
        <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Library size={14} /> MSAi® Curriculum
        </h2>

        {/* Curriculum dropdown (replaces the old Step 1 / Step 2 toggle) */}
        <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          <Library size={11} /> Curriculum
        </label>
        <div className="flex items-center gap-2 mb-5">
          <div className="relative flex-1">
            <select
              value={activeCurriculumIdentifier ?? ''}
              onChange={(e) => e.target.value && onCurriculumChange(e.target.value)}
              disabled={isLoadingCurricula}
              className="w-full appearance-none bg-slate-50 text-xs font-bold text-slate-700 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all hover:bg-slate-100 cursor-pointer disabled:opacity-60"
            >
              <option value="">{isLoadingCurricula ? 'Loading…' : 'Select a curriculum…'}</option>
              {curricula.map((c) => {
                const slug = identifierOf(c);
                return (
                  <option key={c.id} value={slug}>
                    {c.title}
                    {c.status === 'published' ? ` · v${c.currentVersion}` : ' · draft'}
                  </option>
                );
              })}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
          {canManage && (
            <button
              onClick={onCreateCurriculum}
              title="New curriculum"
              className="flex-shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-2xl bg-[#1BD183]/10 text-[#0f8f59] hover:bg-[#1BD183]/20 transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
        </div>

        {hasCurriculum && (
          <div className="relative group">
            <Search
              className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-[#1BD183] transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search organ systems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 text-xs font-bold text-slate-700 pl-11 pr-4 py-3.5 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all placeholder:text-slate-400 hover:bg-slate-100 focus:bg-white"
            />
          </div>
        )}
      </div>

      {!hasCurriculum ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-8 text-center">
          <Library size={28} className="mb-3 opacity-30" />
          <p className="text-[10px] font-black uppercase tracking-widest">
            Select a curriculum to manage its organ systems
          </p>
        </div>
      ) : (
        <>
          <div className="px-8 pb-2 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Organ Systems
            </span>
            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {displaySystems.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
            {isLoadingOrganSystems ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 size={18} className="animate-spin mb-3 text-[#1BD183]" />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading…</p>
              </div>
            ) : (
              displaySystems.map((system) => (
                <div key={system.id} className="relative group/item">
                  {editingId === system.id ? (
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditName('');
                          }
                        }}
                        className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1BD183]"
                        autoFocus
                        disabled={isSubmitting}
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSubmitting}
                        className="p-1.5 text-[#1BD183] hover:bg-[#1BD183]/10 rounded-lg transition-colors"
                      >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditName('');
                        }}
                        disabled={isSubmitting}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <button
                        onClick={() => onSelectSystem(system.id)}
                        className={`flex-1 min-w-0 flex items-center justify-between p-4 rounded-2xl text-xs font-bold transition-all ${
                          activeSystemId === system.id
                            ? 'bg-[#1BD183] text-black'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">{system.title}</span>
                        {activeSystemId === system.id && (
                          <ChevronRight size={14} className="text-slate-700" />
                        )}
                      </button>
                      {canManage && (
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
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-[999] animate-in fade-in zoom-in-95 duration-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(system.id, system.title);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Edit size={14} /> Rename
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(system.id);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {!isLoadingOrganSystems && displaySystems.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                  {searchTerm ? 'No matching organ systems' : 'No organ systems linked yet'}
                </p>
              </div>
            )}
          </div>

          {canManage && (
            <div className="p-4 border-t border-slate-100 space-y-2">
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewName('');
                      }
                    }}
                    placeholder="Organ system name…"
                    className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1BD183] placeholder:text-slate-400"
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={isSubmitting || !newName.trim()}
                    className="p-1.5 text-[#1BD183] hover:bg-[#1BD183]/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewName('');
                    }}
                    disabled={isSubmitting}
                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] hover:bg-[#1BD183]/5 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    <Plus size={14} /> Create
                  </button>
                  <button
                    onClick={onOpenAttach}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#1BA6D1] hover:text-[#1BA6D1] hover:bg-[#1BA6D1]/5 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    <Link2 size={14} /> Attach
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkbenchSidebar;
