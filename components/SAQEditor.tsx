import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Target,
  FileText,
  Loader2,
  Search
} from 'lucide-react';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import SearchableSelect, { SelectOption } from './SearchableSelect';

import { BackendApiItem, ItemUpsertRequest, ApiItemStatus, LearningObjective } from '../types/TestsServiceTypes';

interface SAQEditorProps {
  onBack: () => void;
  onSave: (request: ItemUpsertRequest) => void | Promise<void>;
  initialQuestion?: BackendApiItem | null;
}

const SAQEditor: React.FC<SAQEditorProps> = ({ onBack, onSave, initialQuestion }) => {
  const {
    organSystems,
    topics,
    syndromes,
    objectives,
    isLoadingOrganSystems,
    isLoadingTopics,
    isLoadingSyndromes,
    isLoadingObjectives,
    selectedOrganSystemId,
    selectedTopicId,
    selectedSyndromeId,
    selectedObjectiveId,
    objectiveSearchQuery,
    setSelectedOrganSystemId,
    setSelectedTopicId,
    setSelectedSyndromeId,
    setSelectedObjectiveId,
    setObjectiveSearchQuery,
    searchObjectives,
    fillFiltersFromObjective,
    clearFilters,
    selectedExam,
    setSelectedExam,
  } = useQuestionEditorData();

  // Transform to SelectOption format
  const organSystemOptions: SelectOption[] = useMemo(() =>
    organSystems.map(os => ({ id: os.id, name: os.title })),
  [organSystems]);

  const topicOptions: SelectOption[] = useMemo(() =>
    topics.map(t => ({ id: t.id, name: t.title })),
  [topics]);

  const syndromeOptions: SelectOption[] = useMemo(() =>
    syndromes.map(s => ({ id: s.id, name: s.title })),
  [syndromes]);

  const objectiveOptions: SelectOption[] = useMemo(() =>
    objectives.map(obj => ({ id: obj.id, name: obj.title || 'Untitled Objective' })),
  [objectives]);

  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ApiItemStatus>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialQuestion?.identifier);

  // Initialize from BackendApiItem
  useEffect(() => {
    if (initialQuestion) {
      setQuestionText(initialQuestion.saq?.question || '');
      setAnswerText(initialQuestion.saq?.answer || '');
      setSelectedStatus(initialQuestion.status || 'draft');
      if (initialQuestion.tags) setSelectedTags(initialQuestion.tags.map(t => t.id));

      // Populate hierarchy from LO
      if (initialQuestion.learningObjectiveId) {
        const loStub: LearningObjective = {
          id: initialQuestion.learningObjectiveId,
          title: '',
          identifier: '',
          createdAt: '',
          updatedAt: '',
        };
        fillFiltersFromObjective(loStub);
      }
    }
  }, [initialQuestion, fillFiltersFromObjective]);

  // Debounced objective search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (objectiveSearchQuery && objectiveSearchQuery.length >= 2) {
        searchObjectives(objectiveSearchQuery, true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [objectiveSearchQuery, searchObjectives]);

  const handleSaveClick = async () => {
    if (isSaving) return;
    if (!questionText.trim() || !answerText.trim()) {
      setError('Both the question prompt and answer guidelines are required.');
      return;
    }
    if (!selectedObjectiveId) {
      setError('Map this SAQ to a learning objective before saving.');
      return;
    }
    setError(null);
    const request: ItemUpsertRequest = {
      item: {
        ...(initialQuestion?.id ? { id: initialQuestion.id } : {}),
        type: 'saq',
        status: selectedStatus,
        saq: {
          question: questionText.trim(),
          answer: answerText.trim(),
        },
      },
      learningObjectiveId: selectedObjectiveId || undefined,
      tags: selectedTags,
    };
    setIsSaving(true);
    try {
      await Promise.resolve(onSave(request));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="editor-sticky-header flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm transition">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-primary-gradient items-center justify-center text-white shadow-lg shadow-emerald-100/60 shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-2xl xl:text-3xl font-black text-slate-900 uppercase tracking-tight">{isEditing ? 'Edit SAQ' : 'Create SAQ'}</h2>
              <p className="text-[10px] xl:text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Item ID: {initialQuestion?.identifier || 'UNASSIGNED'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isEditing && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ApiItemStatus)}
              className="shrink-0 bg-white border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest rounded-2xl px-4 py-4 outline-none focus:border-[#1BD183]"
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="live">Live</option>
            </select>
          )}
          <button onClick={handleSaveClick} disabled={isSaving} className="flex-1 sm:flex-none bg-primary-gradient border border-[#1BD183] text-white px-6 xl:px-8 py-3.5 xl:py-4 rounded-2xl text-[11px] xl:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-100/50 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? <Loader2 size={16} className="animate-spin xl:w-[18px] xl:h-[18px]" /> : <Save size={16} className="xl:w-[18px] xl:h-[18px]" />}
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create SAQ'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
        <div className="xl:col-span-2 space-y-6 xl:space-y-8">
          <div className="bg-white p-6 xl:p-10 rounded-[2rem] xl:rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
             <h3 className="text-base xl:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-[#1BD183] xl:w-5 xl:h-5" />
              Content Specification
            </h3>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Question Text</label>
                <textarea
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  placeholder="Enter the SAQ prompt here..."
                  className="w-full p-4 border rounded-2xl bg-slate-50 border-slate-200 min-h-[120px] focus:ring-2 focus:ring-[#1BD183] outline-none transition font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Answer Guidelines</label>
                <textarea
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  placeholder="Enter the expected answer or grading rubric..."
                  className="w-full p-4 border rounded-2xl bg-emerald-50/50 border-emerald-100 min-h-[160px] focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:space-y-8">
          <div className="bg-white p-6 xl:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] xl:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Target size={16} className="text-[#1BD183]" />
                Taxonomy Mapping
              </h4>
              <span
                className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                  selectedObjectiveId
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                {selectedObjectiveId ? 'Objective set' : 'Required'}
              </span>
            </div>

            <div className="space-y-4">
              {/* Objective Search */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Search Objectives</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={objectiveSearchQuery}
                    onChange={(e) => setObjectiveSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all font-bold"
                    placeholder="Search by objective text..."
                  />
                  {isLoadingObjectives && objectiveSearchQuery && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1BD183] animate-spin" />
                  )}
                </div>
                {objectiveSearchQuery && objectives.length > 0 && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {objectives.map(obj => (
                      <button
                        key={obj.id}
                        onClick={async () => {
                          await fillFiltersFromObjective(obj);
                          setObjectiveSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        <span className="font-medium text-slate-800 line-clamp-2">{obj.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-400 text-center my-2">— or filter by hierarchy —</div>

              <SearchableSelect
                label="Exam Type"
                options={[{ id: 'STEP 1', name: 'STEP 1' }, { id: 'STEP 2', name: 'STEP 2' }]}
                value={selectedExam || 'ALL'}
                onChange={(val) => setSelectedExam(val === 'ALL' ? '' : val as 'STEP 1' | 'STEP 2')}
                placeholder="Select Exam Type..."
                allOption={{ id: 'ALL', name: 'Select Exam Type...' }}
              />

              <SearchableSelect
                label="Organ System"
                options={organSystemOptions}
                value={selectedOrganSystemId || 'ALL'}
                onChange={(val) => setSelectedOrganSystemId(val === 'ALL' ? '' : val)}
                disabled={isLoadingOrganSystems}
                placeholder="Select Organ System..."
                allOption={{ id: 'ALL', name: 'Select Organ System...' }}
              />

              <SearchableSelect
                label="Topic"
                options={topicOptions}
                value={selectedTopicId || 'ALL'}
                onChange={(val) => setSelectedTopicId(val === 'ALL' ? '' : val)}
                disabled={!selectedOrganSystemId || isLoadingTopics}
                placeholder="Select Topic..."
                allOption={{ id: 'ALL', name: 'Select Topic...' }}
              />

              <SearchableSelect
                label="Syndrome"
                options={syndromeOptions}
                value={selectedSyndromeId || 'ALL'}
                onChange={(val) => setSelectedSyndromeId(val === 'ALL' ? '' : val)}
                disabled={!selectedTopicId || isLoadingSyndromes}
                placeholder="Select Syndrome..."
                allOption={{ id: 'ALL', name: 'Select Syndrome...' }}
              />

              <SearchableSelect
                label="Learning Objective"
                options={objectiveOptions}
                value={selectedObjectiveId || 'ALL'}
                onChange={(val) => setSelectedObjectiveId(val === 'ALL' ? '' : val)}
                disabled={!selectedSyndromeId || objectives.length === 0}
                placeholder="Select Objective..."
                allOption={{ id: 'ALL', name: 'Select Objective...' }}
              />

              {(selectedOrganSystemId || objectiveSearchQuery) && (
                <button
                  onClick={clearFilters}
                  className="w-full text-xs text-slate-500 hover:text-slate-700 py-1 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SAQEditor;
