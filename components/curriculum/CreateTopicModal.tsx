import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, ChevronDown } from 'lucide-react';
import { OrganSystem } from '@/types/TestsServiceTypes';

interface CreateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    identifier?: string;
    organSystemId: string;
  }) => Promise<void>;
  organSystems: OrganSystem[];
  defaultSystemId?: string;
  initialData?: {
    name: string;
    identifier?: string;
    organSystemId?: string;
  } | null;
}

const CreateTopicModal: React.FC<CreateTopicModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  organSystems,
  defaultSystemId,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [identifier, setIdentifier] = useState(initialData?.identifier || '');
  const [selectedSystemId, setSelectedSystemId] = useState(
    initialData?.organSystemId || defaultSystemId || '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Topic name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        organSystemId: selectedSystemId,
      });
      // Reset form and close
      setName('');
      setIdentifier('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setIdentifier('');
      setError(null);
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setIdentifier(initialData?.identifier || '');
      setSelectedSystemId(initialData?.organSystemId || defaultSystemId || '');
    }
  }, [isOpen, initialData, defaultSystemId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#1BD183] to-[#15a968] rounded-2xl shadow-lg shadow-[#1BD183]/20">
              <FileText size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {initialData ? 'Edit Topic' : 'Create New Topic'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Add a new topic to your curriculum
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="organ-system"
                className="block text-sm font-bold text-slate-700"
              >
                Organ System <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="organ-system"
                  value={selectedSystemId}
                  onChange={(e) => setSelectedSystemId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select an Organ System
                  </option>
                  {organSystems.map((sys) => (
                    <option key={sys.id} value={sys.id}>
                      {sys.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="topic-name"
                className="block text-sm font-bold text-slate-700"
              >
                Topic Name <span className="text-red-500">*</span>
              </label>
              <input
                id="topic-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cardiac Arrhythmias"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                autoFocus
              />
            </div>
          </div>

          {/* Actions */}
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
              disabled={isSubmitting || !name.trim() || !selectedSystemId}
              className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#1BD183]/30 hover:shadow-xl hover:shadow-[#1BD183]/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : initialData ? (
                'Update Topic'
              ) : (
                'Create Topic'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTopicModal;
