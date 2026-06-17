import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Library, Loader2 } from 'lucide-react';

interface CurriculumFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<unknown>;
}

const CurriculumFormModal: React.FC<CurriculumFormModalProps> = ({
  isOpen,
  mode,
  initialTitle = '',
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setError(null);
    }
  }, [isOpen, initialTitle]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(title.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreate = mode === 'create';

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#1BD183] to-[#15a968] rounded-2xl shadow-lg shadow-[#1BD183]/20">
              <Library size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {isCreate ? 'New Curriculum' : 'Rename Curriculum'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                {isCreate
                  ? 'A slug is generated from the title and is permanent.'
                  : 'The slug stays the same; only the display title changes.'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="curriculum-title" className="block text-sm font-bold text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="curriculum-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cardiology"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving…
                </>
              ) : isCreate ? (
                'Create Curriculum'
              ) : (
                'Save Title'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default CurriculumFormModal;
