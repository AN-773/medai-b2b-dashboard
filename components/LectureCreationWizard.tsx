
import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Save, Upload, Target, X, CheckCircle2, BookOpen, FileText, MonitorPlay, ClipboardCheck, Loader2 } from 'lucide-react';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import { testsService } from '../services/testsService';
import { BackendApiItem, ItemUpsertRequest, LearningObjective } from '../types/TestsServiceTypes';
import SearchableSelect, { SelectOption } from './SearchableSelect';

interface LectureCreationWizardProps {
  onBack: () => void;
  onComplete: (request: ItemUpsertRequest) => void;
  initialItem?: BackendApiItem | null;
}

const LectureCreationWizard: React.FC<LectureCreationWizardProps> = ({ onBack, onComplete, initialItem }) => {
  const [step, setStep] = useState(1);

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
    setSelectedOrganSystemId,
    setSelectedTopicId,
    setSelectedSyndromeId,
    setSelectedObjectiveId,
    fillFiltersFromObjective,
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

  // Step 2: Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 3: Materials
  const [lectureText, setLectureText] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  // Step 4: Item Mapping
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [mappableItems, setMappableItems] = useState<BackendApiItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Initialize from existing item
  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.lecture?.title || '');
      setDescription(initialItem.lecture?.summary || '');
      setLectureText(initialItem.lecture?.content || '');

      if (initialItem.learningObjectiveId) {
        const loStub: LearningObjective = {
          id: initialItem.learningObjectiveId,
          title: '',
          identifier: '',
          createdAt: '',
          updatedAt: '',
        };
        fillFiltersFromObjective(loStub);
      }
    }
  }, [initialItem, fillFiltersFromObjective]);

  // Fetch items for mapping when reaching step 4
  useEffect(() => {
    if (step === 4) {
      const fetchItems = async () => {
        setIsLoadingItems(true);
        try {
          const response = await testsService.getItems(
            1, 200, 'mcq,saq', undefined, undefined, undefined,
            selectedOrganSystemId || undefined
          );
          setMappableItems(response.items);
        } catch (e) {
          console.error('Failed to fetch items for mapping:', e);
        } finally {
          setIsLoadingItems(false);
        }
      };
      fetchItems();
    }
  }, [step, selectedOrganSystemId]);

  const toggleItemMapping = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFinalize = () => {
    const request: ItemUpsertRequest = {
      item: {
        ...(initialItem?.id ? { id: initialItem.id } : {}),
        type: 'lecture',
        status: 'draft',
        lecture: {
          title,
          content: lectureText,
          summary: description,
        },
      },
      learningObjectiveId: selectedObjectiveId || undefined,
      tags: [],
    };
    onComplete(request);
  };

  const selectedOrganSystem = organSystems.find(os => os.id === selectedOrganSystemId);

  const steps = [
    { label: 'Alignment', icon: Target },
    { label: 'Details', icon: FileText },
    { label: 'Materials', icon: Upload },
    { label: 'Item Map', icon: ClipboardCheck }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight text-center sm:text-left">
            {initialItem ? 'Edit' : 'New'} Instructional Asset
          </h2>
          <p className="text-sm text-slate-500 font-medium text-center sm:text-left">Step {step}: {steps[step - 1].label}</p>
        </div>
        <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition shadow-sm self-end sm:self-auto">
          <X size={20} />
        </button>
      </div>

      {/* Modern Stepper */}
      <div className="flex items-center justify-between px-4 xl:px-10 py-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar gap-4">
        {steps.map((s, i) => {
          const stepNum = i + 1;
          const Icon = s.icon;
          const isCompleted = step > stepNum;
          const isActive = step === stepNum;

          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-2 group min-w-[60px]">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' :
                  isActive ? 'bg-primary-gradient text-white shadow-xl shadow-emerald-100' :
                  'bg-slate-50 text-slate-400 border border-slate-200'
                }`}>
                  {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${isActive ? 'text-[#1BD183]' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px min-w-[20px] max-w-[80px] -mt-6 transition-colors duration-500 ${step > stepNum ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Alignment */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-white p-6 xl:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <Target size={24} className="text-[#1BD183]" />
                Curriculum Alignment
              </h3>

              <div className="space-y-4">
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
                  label="Syndrome / Subtopic"
                  options={syndromeOptions}
                  value={selectedSyndromeId || 'ALL'}
                  onChange={(val) => setSelectedSyndromeId(val === 'ALL' ? '' : val)}
                  disabled={!selectedTopicId || isLoadingSyndromes}
                  placeholder="Select Syndrome..."
                  allOption={{ id: 'ALL', name: 'Select Syndrome...' }}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedOrganSystemId || !selectedTopicId}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary-gradient text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-6 xl:p-10 text-white space-y-6">
            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em]">Learning Objectives</h4>
            <p className="text-sm text-slate-400 font-medium leading-relaxed italic">
              Select the primary learning objective this lecture targets within the {selectedOrganSystem?.title || 'selected system'}.
            </p>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
              {isLoadingObjectives ? (
                <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading objectives...
                </div>
              ) : objectives.length > 0 ? objectives.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => setSelectedObjectiveId(obj.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all ${
                    selectedObjectiveId === obj.id
                    ? 'bg-primary-gradient border-emerald-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <p className="text-xs font-black uppercase tracking-tight mb-1">{obj.identifier}</p>
                  <p className="text-sm font-bold leading-tight">{obj.title}</p>
                </button>
              )) : (
                <div className="py-12 text-center text-slate-600 border border-dashed border-white/10 rounded-2xl">
                   <p className="text-[10px] font-black uppercase tracking-widest">Select a syndrome to view objectives</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Basic Information */}
      {step === 2 && (
        <div className="max-w-3xl mx-auto bg-white p-6 xl:p-12 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Identity & Briefing</h3>
            <p className="text-slate-500 font-medium">Provide instructional meta-data for indexers.</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Lecture Title</label>
              <input
                placeholder="e.g. Molecular Mechanisms of Insulin Resistance"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full p-5 border rounded-2xl bg-slate-50 border-slate-200 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#1BD183] outline-none transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Executive Summary</label>
              <textarea
                placeholder="Briefly describe the clinical utility of this material..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-5 border rounded-2xl bg-slate-50 border-slate-200 h-40 font-medium text-slate-700 focus:ring-2 focus:ring-[#1BD183] outline-none transition"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-8 border-t border-slate-100">
            <button onClick={() => setStep(1)} className="flex items-center justify-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-900 transition py-4 sm:py-0">
              <ArrowLeft size={16} /> Previous Step
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!title}
              className="flex items-center justify-center gap-3 bg-primary-gradient text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg disabled:opacity-50"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Material Upload & Lecture Text */}
      {step === 3 && (
        <div className="space-y-8">
          <div className="bg-white p-6 xl:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <BookOpen size={24} className="text-emerald-600" />
              Instructional Core
            </h3>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Full Lecture Text (Markdown Supported)</label>
              <textarea
                placeholder="Paste the core lecture content here..."
                value={lectureText}
                onChange={e => setLectureText(e.target.value)}
                className="w-full p-6 border rounded-2xl bg-slate-50 border-slate-200 h-80 font-mono text-sm text-slate-700 focus:ring-2 focus:ring-[#1BD183] outline-none transition shadow-inner"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 xl:p-10 bg-white border border-slate-200 rounded-[2.5rem] flex flex-col items-center text-center gap-6 group hover:border-emerald-200 transition-all cursor-pointer">
              <div className="w-20 h-20 bg-emerald-50 text-[#1BD183] rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MonitorPlay size={40} />
              </div>
              <div>
                <p className="font-black text-slate-900 text-lg uppercase tracking-tight">Media Source</p>
                <p className="text-xs text-slate-400 font-medium mt-1">Upload lecture video or recorded clinical case.</p>
              </div>
              <input type="file" id="vid-up" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
              <label htmlFor="vid-up" className="cursor-pointer w-full sm:w-auto px-10 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition">
                {videoFile ? videoFile.name : 'Select File'}
              </label>
            </div>

            <div className="p-6 xl:p-10 bg-white border border-slate-200 rounded-[2.5rem] flex flex-col items-center text-center gap-6 group hover:border-emerald-200 transition-all cursor-pointer">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload size={40} />
              </div>
              <div>
                <p className="font-black text-slate-900 text-lg uppercase tracking-tight">VTT Transcript</p>
                <p className="text-xs text-slate-400 font-medium mt-1">Ingest closed-captioning for AI auditing.</p>
              </div>
              <input type="file" id="trans-up" className="hidden" onChange={e => setTranscriptFile(e.target.files?.[0] || null)} />
              <label htmlFor="trans-up" className="cursor-pointer w-full sm:w-auto px-10 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition">
                {transcriptFile ? transcriptFile.name : 'Select File'}
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-4">
            <button onClick={() => setStep(2)} className="flex items-center justify-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-900 transition py-4 sm:py-0">
              <ArrowLeft size={16} /> Previous Step
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex items-center justify-center gap-3 bg-primary-gradient text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Item Mapping (Link Questions) */}
      {step === 4 && (
        <div className="space-y-8">
          <div className="bg-white p-6 xl:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                 <ClipboardCheck size={24} className="text-[#1BD183]" />
                 Learning Item Mapping
               </h3>
               <span className="text-[10px] font-black bg-primary-gradient text-white px-3 py-1 rounded-full">{selectedItemIds.length} Linked</span>
            </div>
            <p className="text-sm text-slate-500 font-medium max-w-2xl">
              Link existing high-yield MCQs or SAQs from the repository that students should complete after finishing this instructional unit.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingItems ? (
                <div className="col-span-2 py-12 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading items...
                </div>
              ) : mappableItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleItemMapping(item.id)}
                  className={`p-6 border rounded-[2rem] cursor-pointer transition-all flex items-start gap-4 hover:shadow-md ${
                    selectedItemIds.includes(item.id)
                    ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100/50'
                    : 'bg-slate-50 border-transparent'
                  }`}
                >
                  <div className={`mt-1 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedItemIds.includes(item.id) ? 'bg-primary-gradient text-white' : 'bg-slate-200 text-white'
                  }`}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-[#1BD183] uppercase tracking-widest">{item.identifier}</p>
                    <p className="text-sm font-bold text-slate-900 line-clamp-2 mt-1 leading-snug">
                      {item.mcq?.stem || item.saq?.question || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse xl:flex-row justify-between items-center bg-slate-900 p-6 xl:p-8 rounded-[2.5rem] shadow-xl text-white gap-6">
            <button onClick={() => setStep(3)} className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-white transition">
              <ArrowLeft size={16} /> Back to Materials
            </button>
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
               <button
                 onClick={handleFinalize}
                 className="flex items-center justify-center gap-3 bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition shadow-2xl shadow-emerald-500/20 active:scale-95 w-full sm:w-auto"
               >
                 <Save size={18} /> Finalize Asset
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LectureCreationWizard;
