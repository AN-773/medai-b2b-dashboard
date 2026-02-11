
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  ArrowLeft, 
  Save, 
  Eye, 
  Check, 
  X,
  Layout,
  FileText,
  ImageIcon,
  Wand2,
  Layers,
  Search,
  Brain,
  Loader2
} from 'lucide-react';
import { BloomsLevel, Question, QuestionOption, QuestionType, Reference } from '../types';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import SearchableSelect, { SelectOption } from './SearchableSelect';


interface QuestionEditorProps {
  onBack: () => void;
  onSave: (question: Question) => void;
  initialQuestion?: Question | null;
}

const RenderMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const sections = content.split(/\n\n+/);
  return (
    <div className="space-y-4 text-sm text-indigo-900/80 leading-relaxed">
      {sections.map((section, idx) => {
        if (section.trim().startsWith('###')) {
          const headerText = section.replace(/^###\s*/, '').replace(/\*\*/g, '');
          return (
            <h4 key={idx} className="text-md font-bold text-indigo-900 mt-6 mb-2 border-b border-indigo-100 pb-1">
              {headerText}
            </h4>
          );
        }
        const parts = section.split(/(\*\*.*?\*\*)/);
        return (
          <p key={idx}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-indigo-900">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

// Cognitive Skill / Bloom's Level options
const COGNITIVE_SKILLS = [
  { id: 'remember', label: 'Remember', description: 'Recall facts and basic concepts' },
  { id: 'understand', label: 'Understand', description: 'Explain ideas or concepts' },
  { id: 'apply', label: 'Apply', description: 'Use information in new situations' },
  { id: 'analyze', label: 'Analyze', description: 'Draw connections among ideas' },
];

const QuestionEditor: React.FC<QuestionEditorProps> = ({ onBack, onSave, initialQuestion }) => {
  const [sidebarWidth, setSidebarWidth] = useState(480); 
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel>(BloomsLevel.Understand);
  const [additionalContext, setAdditionalContext] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false },
  ]);
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Curriculum Data Hook
  const {
    organSystems,
    topics,
    syndromes,
    objectives,
    isLoadingOrganSystems,
    isLoadingTopics,
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
    clearFilters
  } = useQuestionEditorData();

  // Transform data to SelectOption format for SearchableSelect
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

  // Debounced objective search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (objectiveSearchQuery && objectiveSearchQuery.length >= 2) {
        searchObjectives(objectiveSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [objectiveSearchQuery, searchObjectives]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (initialQuestion) {
      setQuestionText(initialQuestion.text);
      setExplanation(initialQuestion.explanation);
      setOptions(initialQuestion.options);
      setLearningObjectives(initialQuestion.learningObjectives);
      setTags(initialQuestion.tags);
      setBloomsLevel(initialQuestion.bloomsLevel);
      if (initialQuestion.references) setReferences(initialQuestion.references);
    }
  }, [initialQuestion]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(mouseMoveEvent.clientX, window.innerWidth * 0.6));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleGenerate = async () => {
    if (!selectedTopicId) return;
    setIsGenerating(true);
    setError(null);
    try {
      // AI generation placeholder
      const generated = null;
      if (generated) {
        // Handle generated content
      }
    } catch (e) {
      setError("Failed to generate question. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!questionText) {
      setError("Please provide question text or a topic to generate an image.");
      return;
    }
    setIsGeneratingImage(true);
    try {
      const imageUrl = null;
      if (imageUrl) setAttachedImage(imageUrl);
    } catch (e) {
      setError("Failed to generate clinical image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSave = (targetStatus: 'Draft' | 'Published') => {
    if (!questionText || options.length < 2 || !options.some(o => o.isCorrect)) {
      setError("Please ensure question text exists and there is at least one correct option.");
      return;
    }
    const newQuestion: Question = {
      id: initialQuestion ? initialQuestion.id : `q-${Date.now()}`,
      text: questionText,
      bloomsLevel,
      type: QuestionType.SingleBestAnswer,
      options,
      explanation,
      learningObjectives: selectedObjectiveId ? [selectedObjectiveId, ...learningObjectives] : learningObjectives,
      references,
      tags: selectedOrganSystemId ? [selectedOrganSystemId, ...tags] : tags,
      createdAt: initialQuestion ? initialQuestion.createdAt : new Date().toISOString(),
      status: targetStatus,
      analysis: initialQuestion?.analysis 
    };
    onSave(newQuestion);
  };

  // Find display names for selected items
  const selectedOrganSystem = organSystems.find(os => os.id === selectedOrganSystemId);
  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  const selectedSyndrome = syndromes.find(s => s.id === selectedSyndromeId);
  const selectedObjective = objectives.find(o => o.id === selectedObjectiveId);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 xl:px-6 py-3 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 sticky top-0 z-10 h-auto xl:h-[72px]">
        <div className="flex items-center gap-4 w-full xl:w-auto">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h2 className="font-semibold text-slate-900">{initialQuestion ? 'Edit Question' : 'Create Question'}</h2>
            <p className="text-xs text-slate-500">{initialQuestion ? `Editing ID: ${initialQuestion.id}` : 'AI-Powered Workbench'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar pb-2 xl:pb-0">
          <div className="bg-[#F3F6F3] p-1 rounded-[40px] flex gap-1 mr-4 shrink-0">
            <button onClick={() => setViewMode('edit')} className={`px-3 py-1.5 rounded-[40px] text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'edit' ? 'bg-primary-gradient text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Layout size={16} /> <span className="hidden sm:inline">Edit</span>
            </button>
            <button onClick={() => setViewMode('preview')} className={`px-3 py-1.5 rounded-[40px] text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'preview' ? 'bg-primary-gradient text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Eye size={16} /> <span className="hidden sm:inline">Preview</span>
            </button>
          </div>
          <button onClick={() => handleSave('Draft')} className="shrink-0 flex items-center gap-2 text-sm bg-[#191A19] border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
            <FileText size={18} /> <span className="hidden sm:inline">Save Draft</span><span className="inline sm:hidden">Draft</span>
          </button>
          <button onClick={() => handleSave('Published')} className="shrink-0 flex items-center gap-2 text-sm bg-primary-gradient border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
            <Save size={18} /> <span className="hidden sm:inline">Publish</span><span className="inline sm:hidden">Save</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col xl:flex-row">
        {/* Sidebar */}
        <div className={`bg-white flex flex-col overflow-y-auto flex-shrink-0 border-b xl:border-b-0 xl:border-r border-slate-200 custom-scrollbar ${viewMode === 'preview' ? 'hidden md:flex' : 'flex'}`} style={{ width: isMobile ? '100%' : sidebarWidth, height: isMobile ? 'auto' : '100%' }}>
          
          {/* Curriculum Alignment Section */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Layers className="text-[#1BD183]" size={18} /> Curriculum Alignment
            </h3>
            
            {/* Objective Search */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Search Objectives</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  value={objectiveSearchQuery}
                  onChange={(e) => setObjectiveSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all" 
                  placeholder="Search by objective text..." 
                />
                {isLoadingObjectives && objectiveSearchQuery && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1BD183] animate-spin" />
                )}
              </div>
              {/* Search Results Dropdown */}
              {objectiveSearchQuery && objectives.length > 0 && !selectedSyndromeId && (
                <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {objectives.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => {
                        fillFiltersFromObjective(obj);
                        setObjectiveSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                    >
                      <span className="font-medium text-slate-800 line-clamp-2">{obj.title}</span>
                      {obj.syndrome && (
                        <span className="text-xs text-slate-500 block mt-0.5">{obj.syndrome.title}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 text-center my-3">— or filter by hierarchy —</div>

            {/* Cascading Filters */}
            <div className="space-y-3">
              {/* Organ System */}
              <SearchableSelect
                label="Organ System"
                options={organSystemOptions}
                value={selectedOrganSystemId || 'ALL'}
                onChange={(val) => setSelectedOrganSystemId(val === 'ALL' ? '' : val)}
                disabled={isLoadingOrganSystems}
                placeholder="Select Organ System..."
                allOption={{ id: 'ALL', name: 'Select Organ System...' }}
              />
              {isLoadingOrganSystems && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Loading organ systems...
                </div>
              )}

              {/* Topic */}
              <SearchableSelect
                label="Topic"
                options={topicOptions}
                value={selectedTopicId || 'ALL'}
                onChange={(val) => setSelectedTopicId(val === 'ALL' ? '' : val)}
                disabled={!selectedOrganSystemId || isLoadingTopics}
                placeholder="Select Topic..."
                allOption={{ id: 'ALL', name: 'Select Topic...' }}
              />
              {isLoadingTopics && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Loading topics...
                </div>
              )}

              {/* Syndrome (Subtopic) */}
              <SearchableSelect
                label="Syndrome / Subtopic"
                options={syndromeOptions}
                value={selectedSyndromeId || 'ALL'}
                onChange={(val) => setSelectedSyndromeId(val === 'ALL' ? '' : val)}
                disabled={!selectedTopicId || syndromes.length === 0}
                placeholder="Select Syndrome..."
                allOption={{ id: 'ALL', name: 'Select Syndrome...' }}
              />

              {/* Objective */}
              <SearchableSelect
                label="Learning Objective"
                options={objectiveOptions}
                value={selectedObjectiveId || 'ALL'}
                onChange={(val) => setSelectedObjectiveId(val === 'ALL' ? '' : val)}
                disabled={!selectedSyndromeId || objectives.length === 0}
                placeholder="Select Objective..."
                allOption={{ id: 'ALL', name: 'Select Objective...' }}
              />
              {isLoadingObjectives && selectedSyndromeId && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Loading objectives...
                </div>
              )}

              {/* Clear Filters */}
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

          {/* Cognitive Skill (Bloom's Level) Section */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Brain className="text-[#1BD183]" size={18} /> Cognitive Skill
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(BloomsLevel).map((level) => (
                <button
                  key={level}
                  onClick={() => setBloomsLevel(level)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    bloomsLevel === level 
                      ? 'bg-primary-gradient text-white shadow-md' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* AI Generator Section */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Sparkles className="text-[#1BD183]" size={18} /> AI Generator
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Additional Context</label>
                <textarea 
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg min-h-[80px] resize-none" 
                  placeholder="Add specific focus areas, clinical scenarios, or patient demographics..." 
                />
              </div>
              <button 
                onClick={handleGenerate} 
                disabled={isGenerating || !selectedTopicId} 
                className="w-full flex items-center justify-center gap-2 primary-button text-white py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Draft
                  </>
                )}
              </button>
              {!selectedTopicId && (
                <p className="text-xs text-slate-400 text-center">Select a topic to enable AI generation</p>
              )}
            </div>
          </div>
          
          {/* Clinical Visuals Section */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <ImageIcon className="text-[#1BD183]" size={18} /> Clinical Visuals
            </h3>
            <div className="space-y-4">
              {attachedImage ? (
                <div className="relative rounded-xl overflow-hidden group">
                  <img src={attachedImage} alt="Clinical Visual" className="w-full h-40 object-cover" />
                  <button onClick={() => setAttachedImage(null)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                </div>
              ) : (
                <button 
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 p-6 rounded-2xl text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] transition-all group"
                >
                  {isGeneratingImage ? <Loader2 size={24} className="animate-spin text-[#1BD183]" /> : <Wand2 size={24} />}
                  <span className="text-xs font-bold uppercase tracking-widest">{isGeneratingImage ? "Synthesizing..." : "Generate AI Visual"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-4 xl:p-8 relative custom-scrollbar">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <X size={16} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                <X size={14} />
              </button>
            </div>
          )}

          {viewMode === 'edit' ? (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Question Stem</label>
                <textarea 
                  value={questionText} 
                  onChange={(e) => setQuestionText(e.target.value)} 
                  className="w-full p-4 text-lg border border-slate-200 rounded-lg min-h-[150px] focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all" 
                  placeholder="Clinical scenario..."
                />
                {attachedImage && <img src={attachedImage} className="mt-4 rounded-xl w-full h-64 object-cover border border-slate-100 shadow-sm" />}
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-900 mb-4">Answer Options</label>
                <div className="space-y-3">
                  {options.map((option, idx) => (
                    <div key={option.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${option.isCorrect ? 'border-emerald-500 bg-emerald-50/30' : 'border-transparent bg-slate-50'}`}>
                      <button 
                        onClick={() => setOptions(options.map(o => ({...o, isCorrect: o.id === option.id})))} 
                        className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${option.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}
                      >
                        {option.isCorrect && <Check size={14} />}
                      </button>
                      <input 
                        value={option.text} 
                        onChange={(e) => { 
                          const newOpts = [...options]; 
                          newOpts[idx].text = e.target.value; 
                          setOptions(newOpts); 
                        }} 
                        className="flex-1 bg-transparent text-slate-800 focus:outline-none" 
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Explanation</label>
                <textarea 
                  value={explanation} 
                  onChange={(e) => setExplanation(e.target.value)} 
                  className="w-full p-4 text-sm border border-slate-200 rounded-lg min-h-[200px] bg-indigo-50/20 focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all" 
                  placeholder="Support Markdown..."
                />
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-8">
                  {attachedImage && <img src={attachedImage} className="w-full h-80 object-cover mb-8 rounded-xl shadow-md" />}
                  <p className="text-lg text-slate-900 leading-relaxed mb-8 font-serif">{questionText || "Question text..."}</p>
                  <div className="space-y-3">
                    {options.map((opt, idx) => (
                      <div key={opt.id} className="p-4 rounded-xl border border-slate-200 flex gap-4">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-500">{String.fromCharCode(65 + idx)}</span>
                        <span className="text-slate-700">{opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {explanation && (
                  <div className="bg-indigo-50 border-t border-indigo-100 p-8">
                    <h4 className="text-sm font-bold text-indigo-900 mb-2 uppercase tracking-widest">Psychometric Explanation</h4>
                    <RenderMarkdown content={explanation} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
