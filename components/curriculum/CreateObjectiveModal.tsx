import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Loader2, ChevronDown } from 'lucide-react';
import { OrganSystem, CognitiveSkill, Discipline, Topic, Syndrome } from '@/types/TestsServiceTypes';
import { useGlobal } from '@/contexts/GlobalContext';
import { testsService } from '@/services/testsService';
import MultiSearchableSelect from '../MultiSearchableSelect';

interface CreateObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    syndromeId: string;
    cognitiveSkillId: string;
    disciplines: string[];
    exam?: string;
  }) => Promise<void>;
  topic: Topic;
  subTopic?: Syndrome | null;
  initialData?: {
    title: string;
    syndromeId?: string;
    cognitiveSkillId?: string;
    disciplines?: string[];
    exam?: string;
  } | null;
}

const CreateObjectiveModal: React.FC<CreateObjectiveModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  topic,
  subTopic,
  initialData,
}) => {
  const { cognitiveSkills } = useGlobal();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [title, setTitle] = useState(initialData?.title || '');
  const [selectedSyndromeId, setSelectedSyndromeId] = useState(
    initialData?.syndromeId || subTopic?.id || '',
  );
  const [selectedCognitiveSkillId, setSelectedCognitiveSkillId] = useState(
    initialData?.cognitiveSkillId || '',
  );
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    initialData?.disciplines || [],
  );
  const [selectedExam, setSelectedExam] = useState<string>(
    initialData?.exam || '',
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSyndromes = topic.syndromes || [];
  const EXAM_OPTIONS = ['STEP 1', 'STEP 2', 'STEP 3'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Objective title is required');
      return;
    }
    if (!selectedSyndromeId) {
      setError('Subtopic is required');
      return;
    }
    if (!selectedCognitiveSkillId) {
      setError('Cognitive Skill is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        syndromeId: selectedSyndromeId,
        cognitiveSkillId: selectedCognitiveSkillId,
        disciplines: selectedDisciplines,
        exam: selectedExam || undefined,
      });
      // Reset form and close
      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create objective');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setSelectedSyndromeId(subTopic?.id || '');
    setSelectedCognitiveSkillId('');
    setSelectedDisciplines([]);
    setSelectedExam('');
    setError(null);
  }

  const handleClose = () => {
    if (!isSubmitting) {
      handleReset();
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setSelectedSyndromeId(initialData?.syndromeId || subTopic?.id || '');
      setSelectedCognitiveSkillId(initialData?.cognitiveSkillId || '');
      setSelectedDisciplines(initialData?.disciplines || []);
      setSelectedExam(initialData?.exam || '');
      
      const fetchDisciplines = async () => {
        setIsLoadingDisciplines(true);
        try {
          const res = await testsService.getDisciplines(1, 200);
          setDisciplines(res.items || []);
        } catch (error) {
          console.error('Failed to fetch disciplines:', error);
        } finally {
          setIsLoadingDisciplines(false);
        }
      };
      
      if (disciplines.length === 0) {
        fetchDisciplines();
      }
    }
  }, [isOpen, initialData, subTopic]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-4">
           
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {initialData ? 'Edit Objective' : 'Create New Objective'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Add an objective to {subTopic?.title || topic.title}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto modal-custom-scrollbar">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="objective-title"
                className="block text-sm font-bold text-slate-700"
              >
                Objective Definition <span className="text-red-500">*</span>
              </label>
              <textarea
                id="objective-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Explain the pathophysiology of..."
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50 min-h-[100px] resize-none"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="subtopic"
                className="block text-sm font-bold text-slate-700"
              >
                Subtopic <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="subtopic"
                  value={selectedSyndromeId}
                  onChange={(e) => setSelectedSyndromeId(e.target.value)}
                  disabled={isSubmitting || !!subTopic}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select a Subtopic
                  </option>
                  {availableSyndromes.map((syn) => (
                    <option key={syn.id} value={syn.id}>
                      {syn.title}
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
                htmlFor="cognitive-skill"
                className="block text-sm font-bold text-slate-700"
              >
                Cognitive Skill (Bloom's) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="cognitive-skill"
                  value={selectedCognitiveSkillId}
                  onChange={(e) => setSelectedCognitiveSkillId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select a Cognitive Skill
                  </option>
                  {cognitiveSkills?.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.title}
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
                htmlFor="exam-type"
                className="block text-sm font-bold text-slate-700"
              >
                Exam Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="exam-type"
                  required
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] focus:border-transparent transition-all disabled:opacity-50"
                >
                  <option value="">Select Exam Type</option>
                  {EXAM_OPTIONS.map((exam) => (
                    <option key={exam} value={exam}>
                      {exam}
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
              <MultiSearchableSelect
                label="Disciplines"
                options={disciplines.map(d => ({ id: d.id, name: d.title }))}
                values={selectedDisciplines}
                onChange={setSelectedDisciplines}
                placeholder={isLoadingDisciplines ? "Loading disciplines..." : "Select disciplines..."}
                disabled={isSubmitting || isLoadingDisciplines}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
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
              disabled={isSubmitting || !title.trim() || !selectedSyndromeId || !selectedCognitiveSkillId || !selectedExam}
              className="shrink-0 flex items-center gap-2 text-sm bg-primary-gradient border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : initialData ? (
                'Save Changes'
              ) : (
                'Create Objective'
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

export default CreateObjectiveModal;

