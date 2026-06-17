import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Rocket, Loader2, Layers } from 'lucide-react';
import { Curriculum } from '../../types/TestsServiceTypes';

interface PublishModalProps {
  isOpen: boolean;
  curriculum: Curriculum | null;
  organSystemCount: number;
  learningObjectiveCount: number;
  onClose: () => void;
  onSubmit: (summary?: string) => Promise<unknown>;
}

const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  curriculum,
  organSystemCount,
  learningObjectiveCount,
  onClose,
  onSubmit,
}) => {
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummary('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !curriculum) return null;

  const nextVersion = (curriculum.currentVersion ?? 0) + 1;

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(summary.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish.');
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
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#1BD183] to-[#15a968] rounded-2xl shadow-lg shadow-[#1BD183]/20">
              <Rocket size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Publish Version {nextVersion}</h2>
              <p className="text-sm text-slate-500 font-medium">{curriculum.title}</p>
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

          <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <Layers size={18} className="text-[#1BD183] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-600 font-medium leading-relaxed">
              This freezes the current working state into an immutable snapshot
              {' '}
              (<span className="font-black text-slate-900">{organSystemCount}</span> organ
              {' '}
              system{organSystemCount === 1 ? '' : 's'},{' '}
              <span className="font-black text-slate-900">{learningObjectiveCount}</span> learning
              {' '}
              objective{learningObjectiveCount === 1 ? '' : 's'}) and opens a fresh draft. Previous
              versions stay readable.
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="publish-summary" className="block text-sm font-bold text-slate-700">
              Release summary <span className="text-slate-400 font-medium">(optional)</span>
            </label>
            <textarea
              id="publish-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Q3 curriculum release"
              rows={3}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50 resize-none"
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
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Rocket size={16} />
                  Publish v{nextVersion}
                </>
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

export default PublishModal;
