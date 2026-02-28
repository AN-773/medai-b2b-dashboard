import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Network, Loader2, ChevronDown } from 'lucide-react';
import { OrganSystem, Topic } from '@/types/TestsServiceTypes';
import { testsService } from '@/services/testsService';

interface CreateSubTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    identifier?: string;
    topicId: string;
  }) => Promise<void>;
  organSystems: OrganSystem[];
  defaultOrganSystemId?: string;
  defaultTopicId?: string;
  initialData?: { name: string; identifier?: string; topicId?: string; organSystemId?: string } | null;
}

const CreateSubTopicModal: React.FC<CreateSubTopicModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  organSystems,
  defaultOrganSystemId,
  defaultTopicId,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [identifier, setIdentifier] = useState(initialData?.identifier || '');
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState(defaultOrganSystemId || '');
  const [selectedTopicId, setSelectedTopicId] = useState(
    initialData?.topicId || defaultTopicId || '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch topics dynamically from API when organ system changes
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    if (!selectedOrganSystemId) {
      setAvailableTopics([]);
      return;
    }
    let active = true;
    setLoadingTopics(true);
    testsService.getTopics(selectedOrganSystemId).then(res => {
      if (active) setAvailableTopics(res.items);
    }).catch(err => {
      console.error('Failed to fetch topics:', err);
      if (active) setAvailableTopics([]);
    }).finally(() => {
      if (active) setLoadingTopics(false);
    });
    return () => { active = false; };
  }, [selectedOrganSystemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Subtopic name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        topicId: selectedTopicId,
      });
      // Reset form and close
      setName('');
      setIdentifier('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create subtopic',
      );
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

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      setName(initialData?.name || '');
      setIdentifier(initialData?.identifier || '');
      setSelectedTopicId(initialData?.topicId || defaultTopicId || '');
      setSelectedOrganSystemId(initialData?.organSystemId || defaultOrganSystemId || '');
    }
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, initialData, defaultTopicId, defaultOrganSystemId]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
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
              <Network size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {initialData ? 'Edit Subtopic' : 'Create New Subtopic'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                {initialData ? 'Update subtopic details or move to another topic' : 'Add a new subtopic to your curriculum'}
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
            {/* Organ System Dropdown */}
            <div className="space-y-2">
              <label
                htmlFor="organ-system-select"
                className="block text-sm font-bold text-slate-700"
              >
                Organ System <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="organ-system-select"
                  value={selectedOrganSystemId}
                  onChange={(e) => {
                    setSelectedOrganSystemId(e.target.value);
                    // Reset topic selection when organ system changes
                    setSelectedTopicId('');
                  }}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select an Organ System
                  </option>
                  {organSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Topic Dropdown */}
            <div className="space-y-2">
              <label
                htmlFor="topic-select"
                className="block text-sm font-bold text-slate-700"
              >
                Topic <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="topic-select"
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  disabled={isSubmitting || !selectedOrganSystemId || loadingTopics}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                >
                  <option value="" disabled>
                    {loadingTopics ? 'Loading topics...' : selectedOrganSystemId ? 'Select a Topic' : 'Select an Organ System first'}
                  </option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Subtopic Name */}
            <div className="space-y-2">
              <label
                htmlFor="subtopic-name"
                className="block text-sm font-bold text-slate-700"
              >
                Subtopic Name <span className="text-red-500">*</span>
              </label>
              <input
                id="subtopic-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Atrial Fibrillation"
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
              disabled={isSubmitting || !name.trim() || !selectedTopicId}
              className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#1BD183]/30 hover:shadow-xl hover:shadow-[#1BD183]/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {initialData ? 'Updating...' : 'Creating...'}
                </>
              ) : initialData ? (
                'Update Subtopic'
              ) : (
                'Create Subtopic'
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


export default CreateSubTopicModal;
