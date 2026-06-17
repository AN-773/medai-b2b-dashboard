import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2, Loader2, Search, Check, AlertTriangle } from 'lucide-react';
import { OrganSystem } from '../../types/TestsServiceTypes';
import { testsService } from '../../services/testsService';

interface AttachOrganSystemModalProps {
  isOpen: boolean;
  /** Absolute curriculum id the organ systems will be attached to. */
  curriculumId: string | null;
  /** Organ system ids already linked to this curriculum (excluded from the picker). */
  linkedIds: string[];
  onClose: () => void;
  onAttach: (systems: { id: string; title: string }[]) => Promise<void>;
}

const AttachOrganSystemModal: React.FC<AttachOrganSystemModalProps> = ({
  isOpen,
  curriculumId,
  linkedIds,
  onClose,
  onAttach,
}) => {
  const [allSystems, setAllSystems] = useState<OrganSystem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelected({});
    setError(null);
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await testsService.getOrganSystems(1, 500);
        if (active) setAllSystems(res.items.filter((s) => !!s.title));
      } catch (err) {
        if (active) {
          console.error('Failed to load organ systems:', err);
          setError('Could not load organ systems.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const linked = useMemo(() => new Set(linkedIds), [linkedIds]);

  const attachable = useMemo(
    () =>
      allSystems
        .filter((s) => !linked.has(s.id) && s.curriculumId !== curriculumId)
        .filter((s) => s.title.toLowerCase().includes(search.toLowerCase())),
    [allSystems, linked, curriculumId, search],
  );

  const selectedCount = Object.values(selected).filter(Boolean).length;

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async () => {
    const picks = attachable.filter((s) => selected[s.id]).map((s) => ({ id: s.id, title: s.title }));
    if (picks.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onAttach(picks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach organ systems.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#1BA6D1] to-[#15a968] rounded-2xl shadow-lg shadow-[#1BD183]/20">
              <Link2 size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Attach Organ Systems</h2>
              <p className="text-sm text-slate-500 font-medium">
                Link existing organ systems to this curriculum.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 pb-3 flex-shrink-0 space-y-3">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
              An organ system belongs to one curriculum. Attaching one already linked elsewhere
              will move it here.
            </p>
          </div>
          <div className="relative group">
            <Search
              className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-[#1BD183] transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search organ systems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 text-xs font-bold text-slate-700 pl-11 pr-4 py-3.5 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-2 space-y-1.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={20} className="animate-spin mb-3 text-[#1BD183]" />
              <p className="text-[10px] font-black uppercase tracking-widest">Loading…</p>
            </div>
          ) : attachable.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-[11px] font-black uppercase tracking-widest">
              {search ? 'No matching organ systems' : 'No organ systems available to attach'}
            </div>
          ) : (
            attachable.map((s) => {
              const isChecked = !!selected[s.id];
              const linkedElsewhere = !!s.curriculumId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
                    isChecked
                      ? 'border-[#1BD183]/40 bg-[#1BD183]/5'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border flex-shrink-0 ${
                      isChecked ? 'bg-[#1BD183] border-[#1BD183]' : 'border-slate-300'
                    }`}
                  >
                    {isChecked && <Check size={13} className="text-white" />}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-700">
                    {s.title}
                  </span>
                  {linkedElsewhere && (
                    <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      Linked elsewhere
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedCount === 0}
            className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Attaching…
              </>
            ) : (
              <>
                <Link2 size={16} />
                Attach{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default AttachOrganSystemModal;
