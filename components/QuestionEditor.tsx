
import React, { useState, useEffect, useMemo } from 'react';
import { testsService } from '../services/testsService'; // Import testsService
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
  Loader2,
  Plus,
  Trash2,
  Link as LinkIcon
} from 'lucide-react';
import { QuestionOption, QuestionType } from '../types';
import { BackendApiItem, ItemUpsertRequest, Choice, GeneratedQuestion, ChatMessage, LearningObjective } from '../types/TestsServiceTypes';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import { useGlobal } from '../contexts/GlobalContext';
import SearchableSelect, { SelectOption } from './SearchableSelect';
import MultiSearchableSelect from './MultiSearchableSelect';
import CreateTopicModal from './curriculum/CreateTopicModal';
import CreateSubTopicModal from './curriculum/CreateSubTopicModal';
import ImageSelectionModal, { MultimediaType, MultimediaSelection } from './ImageSelectionModal';
import ConfirmationModal from './ConfirmationModal';


interface QuestionEditorProps {
  onBack: () => void;
  onSave: (request: ItemUpsertRequest) => void;
  onChangeStatus?: (identifier: string, status: string) => void;
  initialQuestion?: BackendApiItem | null;
}

const RenderMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const sections = content.split(/\n\n+/);
  return (
    <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
      {sections.map((section, idx) => {
        if (section.trim().startsWith('###')) {
          const headerText = section.replace(/^###\s*/, '').replace(/\*\*/g, '');
          return (
            <h4 key={idx} className="text-md font-bold text-slate-900 mt-6 mb-2 border-b border-emerald-100 pb-1">
              {headerText}
            </h4>
          );
        }
        const parts = section.split(/(\*\*.*?\*\*)/);
        return (
          <p key={idx}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};



const QuestionEditor: React.FC<QuestionEditorProps> = ({ onBack, onSave, onChangeStatus, initialQuestion }) => {
  const [sidebarWidth, setSidebarWidth] = useState(480); 

  const [additionalContext, setAdditionalContext] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [stemMultimediaFileId, setStemMultimediaFileId] = useState<string | undefined>(undefined);
  const [stemMultimediaType, setStemMultimediaType] = useState<MultimediaType>('image');
  const [imageModalTarget, setImageModalTarget] = useState<string>('stem'); // 'stem' | 'choice-N' | 'explanation-N'
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpPrompt, setFollowUpPrompt] = useState('');

  const [options, setOptions] = useState<QuestionOption[]>([
    { id: '1', text: '', isCorrect: false, explanation: '' },
    { id: '2', text: '', isCorrect: false, explanation: '' },
    { id: '3', text: '', isCorrect: false, explanation: '' },
    { id: '4', text: '', isCorrect: false, explanation: '' },
  ]);
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string>('');
  
  const [tags, setTags] = useState<string[]>([]); // Keep for backward compatibility if needed, but we use selectedTags now
  const [references, setReferences] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isCreateTopicModalOpen, setIsCreateTopicModalOpen] = useState(false);
  const [isCreateSubTopicModalOpen, setIsCreateSubTopicModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [deleteChoiceIdx, setDeleteChoiceIdx] = useState<number | null>(null);

  const openImageModal = (target: string) => {
    setImageModalTarget(target);
    setIsImageModalOpen(true);
  };

  const handleMultimediaSelected = (data: MultimediaSelection) => {
    if (imageModalTarget === 'stem') {
      setAttachedImage(data.url);
      setStemMultimediaFileId(data.fileId);
      setStemMultimediaType(data.type);
    } else if (imageModalTarget.startsWith('choice-')) {
      const idx = parseInt(imageModalTarget.split('-')[1]);
      const newOpts = [...options];
      newOpts[idx] = {
        ...newOpts[idx],
        multimediaUrl: data.url,
        multimediaFileId: data.fileId,
        multimediaType: data.type,
      };
      setOptions(newOpts);
    } else if (imageModalTarget.startsWith('explanation-')) {
      const idx = parseInt(imageModalTarget.split('-')[1]);
      const newOpts = [...options];
      newOpts[idx] = {
        ...newOpts[idx],
        explanationMultimediaUrl: data.url,
        explanationMultimediaFileId: data.fileId,
        explanationMultimediaType: data.type,
      };
      setOptions(newOpts);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Curriculum Data Hook
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
    setAllFilters,
    clearFilters,
    refreshTopics,
    refreshSyndromes,
    // Metadata
    tags: availableTags,
    disciplines: availableDisciplines,
    competencies: availableCompetencies,
    subjects: availableSubjects,
    difficulties: availableDifficulties,
    isLoadingTags,
    isLoadingDisciplines,
    isLoadingCompetencies,
    isLoadingSubjects,
    isLoadingDifficulties,
    selectedSkillId,
    setSelectedSkillId,
    selectedExam,
    setSelectedExam
  } = useQuestionEditorData();

  // Global cognitive skills
  const { cognitiveSkills, isLoadingSkills } = useGlobal();

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

  const tagOptions: SelectOption[] = useMemo(() => 
    availableTags.map(t => ({ id: t.id, name: t.title })),
  [availableTags]);

  const disciplineOptions: SelectOption[] = useMemo(() => 
    availableDisciplines.map(d => ({ id: d.id, name: d.title })),
  [availableDisciplines]);

  const competencyOptions: SelectOption[] = useMemo(() => 
    availableCompetencies.map(c => ({ id: c.id, name: c.title })),
  [availableCompetencies]);

  const subjectOptions: SelectOption[] = useMemo(() => 
    availableSubjects.map(s => ({ id: s.title, name: s.title })),
  [availableSubjects]);

  const difficultyOptions: SelectOption[] = useMemo(() => 
    availableDifficulties.map(d => ({ id: d.id, name: d.title })),
  [availableDifficulties]);

  // Debounced objective search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (objectiveSearchQuery && objectiveSearchQuery.length >= 2) {
        searchObjectives(objectiveSearchQuery, true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [objectiveSearchQuery, searchObjectives]);

  // Debug: Log options and selected values to check for mismatches
  useEffect(() => {
    if (selectedOrganSystemId) {
        const match = organSystems.find(os => os.id === selectedOrganSystemId);
        console.log("Organ System Match Check:", { 
            selectedId: selectedOrganSystemId, 
            found: !!match, 
            sampleOptionId: organSystems[0]?.id 
        });
    }
    if (selectedTopicId) {
        const match = topics.find(t => t.id === selectedTopicId);
        console.log("Topic Match Check:", { 
            selectedId: selectedTopicId, 
            found: !!match, 
            sampleOptionId: topics[0]?.id 
        });
    }
    if (selectedSyndromeId) {
        const match = syndromes.find(s => s.id === selectedSyndromeId);
        console.log("Syndrome Match Check:", { 
            selectedId: selectedSyndromeId, 
            found: !!match, 
            syndromesCount: syndromes.length,
            sampleOptionId: syndromes[0]?.id 
        });
    }
    if (selectedObjectiveId) {
        const match = objectives.find(o => o.id === selectedObjectiveId);
        console.log("Objective Match Check:", { 
            selectedId: selectedObjectiveId, 
            found: !!match, 
            objectivesCount: objectives.length,
            sampleOptionId: objectives[0]?.id 
        });
    }
  }, [selectedOrganSystemId, selectedTopicId, selectedSyndromeId, selectedObjectiveId, organSystems, topics, syndromes, objectives]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (initialQuestion) {
      console.log("QuestionEditor Initialized with:", initialQuestion);

      // Read from BackendApiItem shape
      setQuestionText(initialQuestion.mcq?.stem || '');

      if (initialQuestion.mcq?.choices) {
        setOptions(initialQuestion.mcq.choices.map((c: Choice) => ({
          id: c.id || '',
          text: c.content,
          isCorrect: c.isCorrect,
          explanation: c.explanation || '',
          multimediaUrl: c.multimedia?.url,
          multimediaFileId: c.multimedia?.fileId,
          multimediaType: (c.multimedia?.type as MultimediaType) || undefined,
          explanationMultimediaUrl: c.explanationMultimedia?.url,
          explanationMultimediaFileId: c.explanationMultimedia?.fileId,
          explanationMultimediaType: (c.explanationMultimedia?.type as MultimediaType) || undefined,
        })));
      }

      // Tags
      if (initialQuestion.tags) setSelectedTags(initialQuestion.tags.map(t => t.id));

      // Populate hierarchy filters from the LearningObjective
      if (initialQuestion.learningObjectiveId) {
        setLearningObjectives([initialQuestion.learningObjectiveId]);
        // Use fillFiltersFromObjective to auto-populate organSystem/topic/syndrome/skill/exam
        const loStub: LearningObjective = {
          id: initialQuestion.learningObjectiveId,
          title: '',
          identifier: '',
          createdAt: '',
          updatedAt: '',
        };
        fillFiltersFromObjective(loStub).then((fullObj) => {
          // Populate read-only metadata from the LO
          if (fullObj.disciplines) setSelectedDisciplines(fullObj.disciplines.map(d => d.id));
          if (fullObj.subject) setSelectedSubject(fullObj.subject.title);
        });
      }

      // Load references from metadata (will be on item.metadata once backend supports it)
      const metadata = (initialQuestion as any).metadata;
      if (metadata?.references && Array.isArray(metadata.references)) {
        setReferences(metadata.references as string[]);
      }
    } else {
        console.log("No initialQuestion provided");
    }
  }, [initialQuestion, fillFiltersFromObjective]);



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

  const handleGenerate = async (isFollowUp = false) => {
    if (!selectedObjectiveId) {
        setError("Please select a learning objective first.");
        return;
    }
    
    setIsGenerating(true);
    setError(null);
    try {
      const difficulty = "Medium";
      const tags = selectedTags; // IDs is fine, backend expects strings
      
      let currentHistory = [...chatHistory];
      if (isFollowUp && followUpPrompt.trim()) {
        currentHistory.push({ role: 'user', content: followUpPrompt });
        setFollowUpPrompt('');
        setChatHistory(currentHistory);
      } else if (!isFollowUp) {
        currentHistory = [];
        setChatHistory(currentHistory);
      }
      
      const generatedQuestion: GeneratedQuestion = await testsService.generateQuestion(
          `Organ System ${selectedOrganSystem?.title} - Topic ${selectedTopic?.title} - Syndrome ${selectedSyndrome?.title} - Learning Objective ${selectedObjective?.title}`,
          difficulty,
          tags,
          selectedExam,
          additionalContext,
          currentHistory.length > 0 ? currentHistory : undefined
      );
      
      if (generatedQuestion) {
          setQuestionText(generatedQuestion.stem);
          setReferences(generatedQuestion.references);
          if (generatedQuestion.subject) {
              const newSub = generatedQuestion.subject.trim();
              if (newSub) {
                  setSelectedSubject(newSub);
              }
          }
          setOptions(generatedQuestion.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              isCorrect: generatedQuestion.correct_option_id === opt.id,
              explanation: generatedQuestion.correct_option_id === opt.id 
                  ? generatedQuestion.correct_explanation 
                  : (generatedQuestion.distractor_explanations.find((d) => d.id === opt.id)?.explanation || '')
          })));
          
          setChatHistory([
            ...currentHistory,
            { role: 'assistant', content: JSON.stringify(generatedQuestion) }
          ]);
      }
      
    } catch (e: any) {
      console.error("Generation error:", e);
      setError("Failed to generate question. Please try again. " + (e.message || ""));
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

  const handleSave = (targetStatus: 'draft' | 'live') => {
    if (!questionText || options.length < 2 || !options.some(o => o.isCorrect)) {
      setError("Please ensure question text exists and there is at least one correct option.");
      return;
    }
    const request: ItemUpsertRequest = {
      item: {
        ...(initialQuestion?.id ? { id: initialQuestion.id } : {}),
        type: 'mcq',
        status: targetStatus,
      },
      learningObjectiveId: selectedObjectiveId || undefined,
      tags: selectedTags,
      metadata: references.length > 0 ? { references } : undefined,
      multimedia: attachedImage ? {
        multimedia: { url: attachedImage, type: stemMultimediaType || 'image' },
        fileId: stemMultimediaFileId,
      } : null,
      choices: options.map(o => ({
        choice: {
          ...((o.id.length > 5 && !o.id.startsWith('temp_')) ? { id: o.id } : {}),
          content: o.text,
          isCorrect: o.isCorrect,
          explanation: o.explanation || '',
        },
        multimedia: o.multimediaUrl ? {
          multimedia: { url: o.multimediaUrl, type: o.multimediaType || 'image' },
        } : null,
        explanationMultimedia: o.explanationMultimediaUrl ? {
          multimedia: { url: o.explanationMultimediaUrl, type: o.explanationMultimediaType || 'image' },
        } : null,
      })),
    };
    onSave(request);
  };

  const handleCreateTopic = async (data: { name: string; identifier?: string; organSystemId: string }) => {
    try {
      const result = await testsService.upsertTopic(data.name, data.organSystemId);
      await refreshTopics();
      setSelectedTopicId(result.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleCreateSubTopic = async (data: { name: string; identifier?: string; topicId: string }) => {
    try {
      const result = await testsService.upsertSyndrome('', data.name, data.topicId);
      await refreshSyndromes();
      setSelectedSyndromeId(result.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
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
          {initialQuestion?.identifier && onChangeStatus && (
            <select
              value={initialQuestion.status.toLowerCase()}
              onChange={(e) => onChangeStatus(initialQuestion.identifier, e.target.value)}
              className="shrink-0 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#1BD183]"
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="live">Live</option>
            </select>
          )}

          <button onClick={() => handleSave('draft')} className="shrink-0 flex items-center gap-2 text-sm bg-primary-gradient border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
            <FileText size={18} /> <span className="hidden sm:inline">Save</span><span className="inline sm:hidden">Draft</span>
          </button>
          {/* <button onClick={() => handleSave('Published')} className="shrink-0 flex items-center gap-2 text-sm bg-primary-gradient border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
            <Save size={18} /> <span className="hidden sm:inline">Publish</span><span className="inline sm:hidden">Save</span>
          </button> */}
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
              {objectiveSearchQuery && objectives.length > 0 && (
                <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {objectives.map(obj => (
                    <button
                      key={obj.id}
                      onClick={async () => {
                        const fullObj = await fillFiltersFromObjective(obj);
                        if (fullObj && fullObj.disciplines) {
                          setSelectedDisciplines(fullObj.disciplines.map(d => d.id));
                        }
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

              {/* Exam Selector */}
              <SearchableSelect
                  label="Exam Type"
                  options={[
                    {
                      id: 'STEP 1',
                      name: 'STEP 1'
                    },
                    {
                      id: 'STEP 2',
                      name: 'STEP 2'
                    }
                  ]}
                  value={selectedExam || 'ALL'}
                  onChange={(val) => setSelectedExam(val === 'ALL' ? '' : val as 'STEP 1' | 'STEP 2')}
                  disabled={isLoadingOrganSystems}
                  placeholder="Select Exam Type..."
                  allOption={{ id: 'ALL', name: 'Select Exam Type...' }}
              />

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
                onAddClick={() => setIsCreateTopicModalOpen(true)}
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
                disabled={!selectedTopicId || isLoadingSyndromes}
                placeholder="Select Syndrome..."
                allOption={{ id: 'ALL', name: 'Select Syndrome...' }}
                onAddClick={() => setIsCreateSubTopicModalOpen(true)}
              />
              {isLoadingSyndromes && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Loading syndromes...
                </div>
              )}

              {/* Cognitive Skill */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cognitive Skill</label>
                {isLoadingSkills ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin" /> Loading skills...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {cognitiveSkills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => setSelectedSkillId(selectedSkillId === skill.id ? '' : skill.id)}
                        className={`px-3 py-2 text-xs font-semibold transition-all ${
                          selectedSkillId === skill.id 
                            ? 'bg-primary-gradient text-white shadow-md' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {skill.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Objective */}
              <SearchableSelect
                label="Learning Objective"
                options={objectiveOptions}
                value={selectedObjectiveId || 'ALL'}
                onChange={async (val) => {
                  const id = val === 'ALL' ? '' : val;
                  setSelectedObjectiveId(id);
                  if (id) {
                    try {
                      const fullObj = await testsService.getLearningObjective(id.split('/').pop() || '');
                      if (fullObj) {
                        if (fullObj.disciplines && fullObj.disciplines.length > 0) {
                          setSelectedDisciplines(fullObj.disciplines.map(d => d.id));
                        }
                      }
                    } catch (e) {
                      console.error('Failed to fetch full objective details:', e);
                    }
                  }
                }}
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



          {/* Metadata Section */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <FileText className="text-[#1BD183]" size={18} /> Metadata
            </h3>
            <div className="space-y-4">
              {/* Disciplines (read-only, derived from LO) */}
              <MultiSearchableSelect
                label="Disciplines"
                options={disciplineOptions}
                values={selectedDisciplines}
                onChange={setSelectedDisciplines}
                disabled={true}
                placeholder="Derived from Learning Objective"
              />

              {/* Competencies (read-only, derived from LO) */}
              <MultiSearchableSelect
                label="Competencies"
                options={competencyOptions}
                values={selectedCompetencies}
                onChange={setSelectedCompetencies}
                disabled={true}
                placeholder="Derived from Learning Objective"
              />

              {/* Subject (read-only, derived from LO) */}
              <SearchableSelect
                label="Subject"
                options={subjectOptions}
                value={selectedSubject || 'ALL'}
                onChange={(val) => setSelectedSubject(val === 'ALL' ? '' : val)}
                disabled={true}
                placeholder="Derived from Learning Objective"
                allOption={{ id: 'ALL', name: 'Select Subject...' }}
              />

              {/* Tags */}
              <MultiSearchableSelect
                label="Tags"
                options={tagOptions}
                values={selectedTags}
                onChange={setSelectedTags}
                disabled={isLoadingTags}
                placeholder="Select Tags..."
              />
            </div>
          </div>



          {/* AI Generator Section */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Sparkles className="text-[#1BD183]" size={18} /> AI Generator
            </h3>
            <div className="space-y-4">
              {chatHistory.length === 0 ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Additional Context (Optional)</label>
                    <textarea 
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg min-h-[80px] resize-none focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all" 
                      placeholder="Add specific focus areas, clinical scenarios, or patient demographics..." 
                    />
                  </div>
                  <button 
                    onClick={() => handleGenerate(false)} 
                    disabled={isGenerating || (!selectedObjectiveId || !selectedSkillId || !selectedOrganSystemId || !selectedExam)} 
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
                </>
              ) : (
                <>
                  {(chatHistory.some(msg => msg.role === 'user') || isGenerating) && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                      {chatHistory.filter(msg => msg.role === 'user').map((msg, idx) => (
                         <div key={idx} className="bg-white p-2 rounded border border-slate-100 text-sm text-slate-700 shadow-sm">
                           <span className="font-semibold text-xs text-[#1BD183] block mb-1">You</span>
                           {msg.content}
                         </div>
                      ))}
                      {isGenerating && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                          <Loader2 size={14} className="animate-spin" /> AI is thinking...
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                     <textarea 
                       value={followUpPrompt}
                       onChange={(e) => setFollowUpPrompt(e.target.value)}
                       className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg min-h-[60px] resize-none focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all" 
                       placeholder="Ask the AI to modify the question (e.g., 'change option A')..." 
                     />
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleGenerate(false)}
                      disabled={isGenerating}
                      className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all"
                    >
                      Reset
                    </button>
                    <button 
                      onClick={() => handleGenerate(true)} 
                      disabled={isGenerating || !followUpPrompt.trim()} 
                      className="flex-[2] flex items-center justify-center gap-2 primary-button text-white py-2 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <span>Send Update</span>}
                    </button>
                  </div>
                </>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-900">Question Stem</label>
                  <button
                    onClick={() => openImageModal('stem')}
                    className={`p-1 rounded transition-colors ${attachedImage ? 'text-[#1BD183] bg-[#F3F6F3]' : 'text-slate-300 hover:text-[#1BD183] hover:bg-[#F3F6F3]'}`}
                    title="Add media to question stem"
                  >
                    {stemMultimediaType === 'hyperlink' ? <LinkIcon size={16} /> : <ImageIcon size={16} />}
                  </button>
                </div>
                <textarea 
                  value={questionText} 
                  onChange={(e) => setQuestionText(e.target.value)} 
                  className="w-full p-4 text-lg border border-slate-200 rounded-lg min-h-[150px] focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all" 
                  placeholder="Clinical scenario..."
                />
                {attachedImage && (
                  <div className="mt-3">
                    <div className="relative inline-block rounded-lg overflow-hidden border border-slate-200 group/media">
                      {stemMultimediaType === 'hyperlink' ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-sm">
                          <LinkIcon size={14} className="text-[#1BD183] flex-shrink-0" />
                          <a href={attachedImage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[300px]">{attachedImage}</a>
                        </div>
                      ) : (
                        <img src={attachedImage} className="w-full max-h-64 object-cover" alt="Stem media" />
                      )}
                      <button
                        onClick={() => { setAttachedImage(null); setStemMultimediaFileId(undefined); }}
                        className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-900 mb-4">Answer Options</label>
                <div className="space-y-3">
                  {options.map((option, idx) => (
                    <div key={option.id} className={`flex flex-col gap-2 p-4 rounded-lg border-2 transition-all group ${option.isCorrect ? 'border-emerald-500 bg-emerald-50/30' : 'border-transparent bg-slate-50'}`}>
                      <div className="flex items-start gap-3">
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
                          className="flex-1 bg-transparent text-slate-800 focus:outline-none font-medium" 
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        />
                        <button
                          onClick={() => openImageModal(`choice-${idx}`)}
                          className={`mt-1 p-1 rounded transition-colors ${option.multimediaUrl ? 'text-[#1BD183] bg-[#F3F6F3]' : 'text-slate-300 hover:text-[#1BD183] hover:bg-[#F3F6F3]'}`}
                          title="Add media to choice"
                        >
                          {option.multimediaType === 'hyperlink' ? <LinkIcon size={16} /> : <ImageIcon size={16} />}
                        </button>
                        <button 
                          onClick={() => setDeleteChoiceIdx(idx)}
                          className="mt-1 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                          title="Remove Option"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Choice Multimedia Preview */}
                      {option.multimediaUrl && (
                        <div className="pl-9 mt-1">
                          <div className="relative inline-block rounded-lg overflow-hidden border border-slate-200 group/media">
                            {option.multimediaType === 'hyperlink' ? (
                              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-sm">
                                <LinkIcon size={14} className="text-[#1BD183] flex-shrink-0" />
                                <a href={option.multimediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[300px]">{option.multimediaUrl}</a>
                              </div>
                            ) : (
                              <img src={option.multimediaUrl} alt="Choice media" className="h-20 w-auto object-cover" />
                            )}
                            <button
                              onClick={() => {
                                const newOpts = [...options];
                                newOpts[idx] = { ...newOpts[idx], multimediaUrl: undefined, multimediaFileId: undefined, multimediaType: undefined };
                                setOptions(newOpts);
                              }}
                              className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Per-Option Explanation */}
                      <div className="pl-9 mt-1">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-400 uppercase">Explanation</label>
                          <button
                            onClick={() => openImageModal(`explanation-${idx}`)}
                            className={`p-1 rounded transition-colors ${option.explanationMultimediaUrl ? 'text-[#1BD183] bg-[#F3F6F3]' : 'text-slate-300 hover:text-[#1BD183] hover:bg-[#F3F6F3]'}`}
                            title="Add media to explanation"
                          >
                            {option.explanationMultimediaType === 'hyperlink' ? <LinkIcon size={14} /> : <ImageIcon size={14} />}
                          </button>
                        </div>
                        <textarea
                          value={option.explanation || ''}
                          onChange={(e) => {
                            const newOpts = [...options];
                            newOpts[idx].explanation = e.target.value;
                            setOptions(newOpts);
                          }}
                          className="w-full min-h-[110px] p-2 text-sm border border-slate-200 rounded bg-white/50 focus:bg-white focus:ring-1 focus:ring-[#1BD183]/50 focus:border-[#1BD183] transition-all resize-y"
                          placeholder={`Why is option ${String.fromCharCode(65 + idx)} ${option.isCorrect ? 'correct' : 'incorrect'}?`}
                        />
                        {/* Explanation Multimedia Preview */}
                        {option.explanationMultimediaUrl && (
                          <div className="mt-2">
                            <div className="relative inline-block rounded-lg overflow-hidden border border-slate-200 group/media">
                              {option.explanationMultimediaType === 'hyperlink' ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-sm">
                                  <LinkIcon size={14} className="text-[#1BD183] flex-shrink-0" />
                                  <a href={option.explanationMultimediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[300px]">{option.explanationMultimediaUrl}</a>
                                </div>
                              ) : (
                                <img src={option.explanationMultimediaUrl} alt="Explanation media" className="h-20 w-auto object-cover" />
                              )}
                              <button
                                onClick={() => {
                                  const newOpts = [...options];
                                  newOpts[idx] = { ...newOpts[idx], explanationMultimediaUrl: undefined, explanationMultimediaFileId: undefined, explanationMultimediaType: undefined };
                                  setOptions(newOpts);
                                }}
                                className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => setOptions([...options, { id: `temp_${Date.now()}`, text: '', isCorrect: false, explanation: '' }])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 font-medium hover:border-[#1BD183] hover:text-[#1BD183] transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Add Answer Option
                  </button>
                </div>
              </div>

              {/* References Section */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="text-[#1BD183]" size={16} /> References
                </label>
                <div className="space-y-2">
                  {references.map((ref, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <input
                        value={ref}
                        onChange={(e) => {
                          const updated = [...references];
                          updated[idx] = e.target.value;
                          setReferences(updated);
                        }}
                        className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all bg-white"
                        placeholder="Reference title or URL..."
                      />
                      <button
                        onClick={() => setReferences(references.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setReferences([...references, ''])}
                    className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-400 hover:border-[#1BD183] hover:text-[#1BD183] transition-all"
                  >
                    <Plus size={14} /> Add Reference
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-8">
                  {attachedImage && <img src={attachedImage} className="w-full h-80 object-cover mb-8 rounded-xl shadow-md" />}
                  <p className="text-lg text-slate-900 leading-relaxed mb-8 font-serif">{questionText || "Question text..."}</p>
                  <div className="space-y-4">
                    {options.map((opt, idx) => (
                      <div key={opt.id} className="cursor-pointer">
                        <div className={`p-4 rounded-xl border flex gap-4 transition-colors ${opt.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${opt.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + idx)}</span>
                          <div className="flex-1">
                            <span className="text-slate-700 font-medium">{opt.text}</span>
                            {opt.explanation && (
                              <div className="mt-3 text-sm text-slate-600 bg-white/60 p-3 rounded-lg border border-slate-200/50">
                                <span className="font-semibold text-xs uppercase tracking-wider text-slate-400 mb-1 block">Explanation</span>
                                <RenderMarkdown content={opt.explanation} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
      
      <CreateTopicModal
        isOpen={isCreateTopicModalOpen}
        onClose={() => setIsCreateTopicModalOpen(false)}
        onSubmit={handleCreateTopic}
        organSystems={organSystems}
        defaultSystemId={selectedOrganSystemId}
      />

      <CreateSubTopicModal
        isOpen={isCreateSubTopicModalOpen}
        onClose={() => setIsCreateSubTopicModalOpen(false)}
        onSubmit={handleCreateSubTopic}
        organSystems={organSystems}
        defaultOrganSystemId={selectedOrganSystemId}
        defaultTopicId={selectedTopicId}
      />

      <ImageSelectionModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageSelected={handleMultimediaSelected}
      />

      <ConfirmationModal
        isOpen={deleteChoiceIdx !== null}
        title="Delete Answer Option"
        message={`Are you sure you want to delete Option ${deleteChoiceIdx !== null ? String.fromCharCode(65 + deleteChoiceIdx) : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={() => {
          if (deleteChoiceIdx !== null) {
            setOptions(options.filter((_, i) => i !== deleteChoiceIdx));
            setDeleteChoiceIdx(null);
          }
        }}
        onCancel={() => setDeleteChoiceIdx(null)}
      />
    </div>
  );
};

export default QuestionEditor;
