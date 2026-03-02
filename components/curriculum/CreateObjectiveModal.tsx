import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Loader2, ChevronDown, Sparkles, CheckCircle2, Save, AlertCircle } from 'lucide-react';
import { OrganSystem, CognitiveSkill, Discipline, Topic, Syndrome, GeneratedObjective } from '@/types/TestsServiceTypes';
import { useGlobal } from '@/contexts/GlobalContext';
import { testsService } from '@/services/testsService';
import MultiSearchableSelect from '../MultiSearchableSelect';
import SearchableSelect from '../SearchableSelect';

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
  initialMode?: 'manual' | 'generate';
  organSystemName?: string;
}

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze'] as const;

const CreateObjectiveModal: React.FC<CreateObjectiveModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  topic,
  subTopic,
  initialData,
  initialMode = 'manual',
  organSystemName = '',
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

  // Generation State
  const [activeTab, setActiveTab] = useState<'manual' | 'generate'>(initialMode);
  const [selectedBloom, setSelectedBloom] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedObjective, setGeneratedObjective] = useState<GeneratedObjective | null>(null);
  const [isSavingGen, setIsSavingGen] = useState(false);
  const [isSavedGen, setIsSavedGen] = useState(false);

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

    // Reset generate states
    setSelectedBloom('');
    setSelectedDisciplineId('');
    setAdditionalContext('');
    setGeneratedObjective(null);
    setIsSavedGen(false);
  }

  const handleClose = () => {
    if (!isSubmitting && !isSavingGen && !isGenerating) {
      handleReset();
      onClose();
    }
  };

  const bloomToCognitiveSkillId = (bloomLevel: string): string => {
    const skill = cognitiveSkills.find(
      (s) => s.title.toLowerCase() === bloomLevel.toLowerCase()
    );
    return skill?.id || '';
  };

  const handleGenerate = async () => {
    const topicName = subTopic?.title || topic.title;
    if (!topicName || !selectedBloom || !selectedDisciplineId || !organSystemName) return;

    const disciplineName = disciplines.find((d) => d.id === selectedDisciplineId)?.title || '';

    setIsGenerating(true);
    setError(null);
    setGeneratedObjective(null);
    setIsSavedGen(false);

    try {
      const result = await testsService.generateLearningObjective(
        organSystemName,
        topic.title,
        subTopic?.title || '',
        'step2',
        selectedBloom,
        disciplineName,
        additionalContext || undefined,
      );

      if (result && result.title) {
        setGeneratedObjective(result);
      } else {
        setError('No learning objective was generated. Try different parameters.');
      }
    } catch (e: any) {
      console.error('LO Generation error:', e);
      setError('Failed to generate learning objective. ' + (e.message || ''));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!generatedObjective) return;

    const syndromeId = subTopic?.id || '';
    if (!syndromeId) {
      setError('A subtopic must be selected to save the objective.');
      return;
    }

    const cognitiveSkillId = bloomToCognitiveSkillId(generatedObjective.bloom_level);
    if (!cognitiveSkillId) {
      setError(`No matching cognitive skill found for "${generatedObjective.bloom_level}".`);
      return;
    }

    setIsSavingGen(true);
    setError(null);

    try {
      await onSubmit({
        title: generatedObjective.title,
        syndromeId,
        cognitiveSkillId,
        disciplines: [selectedDisciplineId],
        exam: 'STEP 2',
      });
      setIsSavedGen(true);
    } catch (e: any) {
      console.error('Failed to save objective:', e);
      setError('Failed to save the objective. ' + (e.message || ''));
    } finally {
      setIsSavingGen(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedObjective(null);
    setError(null);
    setIsSavedGen(false);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setTitle(initialData?.title || '');
      setSelectedSyndromeId(initialData?.syndromeId || subTopic?.id || '');
      setSelectedCognitiveSkillId(initialData?.cognitiveSkillId || '');
      setSelectedDisciplines(initialData?.disciplines || []);
      setSelectedExam(initialData?.exam || '');
      setError(null);
      
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
  }, [isOpen, initialData, subTopic, initialMode]);

  if (!isOpen) return null;

  const topicName = subTopic?.title || topic.title;
  const canGenerate = selectedBloom && selectedDisciplineId;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 border-b border-slate-100 flex-shrink-0">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1BA6D1] to-[#1BD183] flex items-center justify-center shadow-lg">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {initialData ? 'Edit Objective' : 'Objective Definition'}
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">
                    {topicName}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting || isGenerating || isSavingGen}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 self-start"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            {/* Tabs */}
            {!initialData && (
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'manual'
                      ? 'border-[#1BD183] text-[#1BD183]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => setActiveTab('generate')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'generate'
                      ? 'border-[#1BD183] text-[#1BD183]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  AI Generate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form Body Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative p-6">
          {error && (
            <div className={`mb-6 p-4 border rounded-xl flex items-start gap-3 ${
              activeTab === 'generate' 
                ? 'bg-rose-50 border-rose-200 text-rose-600' 
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Manual Tab Content */}
          {activeTab === 'manual' && (
            <form id="manual-form" onSubmit={handleSubmit} className="space-y-5">
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
            </form>
          )}

          {/* AI Generation Tab Content */}
          {activeTab === 'generate' && (
            <div>
              {!generatedObjective && !isGenerating && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                      Bloom Level <span className="text-rose-400">*</span>
                    </label>
                    <SearchableSelect
                      options={BLOOM_LEVELS.map((level) => ({ id: level, name: level }))}
                      value={selectedBloom}
                      onChange={setSelectedBloom}
                      placeholder="Select a Bloom Level..."
                      allOption={{ id: '', name: 'Select a Bloom Level...' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Discipline <span className="text-rose-400">*</span>
                    </label>
                    <SearchableSelect
                      options={disciplines.map((d) => ({ id: d.id, name: d.title }))}
                      value={selectedDisciplineId}
                      onChange={setSelectedDisciplineId}
                      placeholder="Select a discipline..."
                      allOption={{ id: '', name: 'Select a discipline...' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Additional Context
                    </label>
                    <textarea
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      placeholder="Add specific focus areas..."
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[80px] resize-none focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all"
                    />
                  </div>

                  <button
                    disabled={!canGenerate || isGenerating}
                    onClick={handleGenerate}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:shadow-lg hover:shadow-[#1BD183]/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Sparkles size={18} /> Generate Objective
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1BA6D1] to-[#1BD183] flex items-center justify-center shadow-lg mb-6 animate-pulse">
                    <Sparkles size={28} className="text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-2">Generating Learning Objective...</p>
                  <p className="text-xs text-slate-400">This may take up to 30 seconds</p>
                  <Loader2 size={24} className="animate-spin text-[#1BD183] mt-4" />
                </div>
              )}

              {/* Generated Result */}
              {generatedObjective && !isGenerating && (
                <div className="space-y-4 pt-2">
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border-slate-200 rounded-md text-[9px] font-black uppercase tracking-widest border">
                        {generatedObjective.bloom_level}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400">
                        {generatedObjective.competency}
                      </span>
                      {generatedObjective.usmle_subtopic && (
                        <>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-[9px] font-medium text-slate-400">
                            {generatedObjective.usmle_subtopic}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="px-5 py-5">
                      <textarea
                        value={generatedObjective.title}
                        onChange={(e) => setGeneratedObjective({ ...generatedObjective, title: e.target.value })}
                        disabled={isSavingGen || isSavedGen}
                        className="w-full text-sm text-slate-800 leading-relaxed bg-transparent border-0 focus:ring-0 p-0 resize-none min-h-[60px]"
                      />
                    </div>
                  </div>

                  {isSavedGen && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95">
                      <CheckCircle2 size={18} className="text-emerald-500" />
                      <p className="text-emerald-700 text-sm font-bold">
                        Objective saved successfully!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-white rounded-b-[2rem] flex-shrink-0">
          {activeTab === 'manual' ? (
            <div className="flex items-center gap-3 w-full justify-end">
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
                form="manual-form"
                disabled={isSubmitting || !title.trim() || !selectedSyndromeId || !selectedCognitiveSkillId || !selectedExam}
                className="shrink-0 flex items-center justify-center min-w-[150px] gap-2 text-sm bg-primary-gradient border border-slate-200 text-white px-4 py-3 rounded-xl font-medium shadow-sm transition-colors"
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
          ) : (
            generatedObjective && !isGenerating && (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={handleRegenerate}
                  disabled={isSavingGen}
                  className="px-5 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Sparkles size={14} /> Regenerate
                </button>
                
                {!isSavedGen ? (
                  <button
                    onClick={handleSaveGenerated}
                    disabled={isSavingGen}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-[#1BD183]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {isSavingGen ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Objective
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex items-center gap-2 px-6 py-3 bg-[#191A19] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#2a2b2a] transition-all active:scale-[0.98]"
                  >
                    Done
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default CreateObjectiveModal;

