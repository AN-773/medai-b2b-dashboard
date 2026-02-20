
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Question, 
  QuestionType, 
  BloomsLevel, 
  Issue, 
  ItemType,
  BackendItem,
  LectureAsset
} from '../types';
import { testsService } from '../services/testsService';
import { Question as ApiQuestion } from '../types/TestsServiceTypes';
import ItemModuleDashboard from '../components/ItemModuleDashboard';
import QuestionEditor from '../components/QuestionEditor';
import LectureCreationWizard from '../components/LectureCreationWizard';
import LectureEditor from '../components/LectureEditor';
import LecturePlayerView from '../components/LecturePlayerView';
import ItemIntegrityView from '../components/ItemIntegrityView';
import AILabView from '../components/AILabView';
import { 
  Plus, 
  Layout, 
  Database,
  ClipboardCheck,
  FileText,
  MonitorPlay,
  CheckCircle,
  X,
  FlaskConical,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

type WorkbenchViewMode = 'DASHBOARD' | 'QUESTION_EDITOR' | 'LECTURE_WIZARD' | 'LECTURE_EDITOR' | 'LECTURE_DETAIL' | 'LECTURE_PLAYER';
type WorkbenchTab = 'DASHBOARD' | 'INTEGRITY' | 'LAB';

const QuestionWorkbenchView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeItemType, setActiveItemType] = useState<ItemType>(ItemType.MCQ);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('DASHBOARD');
  const [viewMode, setViewMode] = useState<WorkbenchViewMode>(searchParams.get('questionId') ? 'QUESTION_EDITOR' : 'DASHBOARD');
  const [selectedItem, setSelectedItem] = useState<BackendItem | LectureAsset | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<ApiQuestion | null>(null);
  
  const [questionsList, setQuestionsList] = useState<BackendItem[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalLiveQuestions, setTotalLiveQuestions] = useState(0);
  const [totalDraftQuestions, setTotalDraftQuestions] = useState(0);
  const [lectures, setLectures] = useState<LectureAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  console.log("Question ID", searchParams.get('questionId'));
  console.log("View mode", viewMode);
  

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        const draft = await testsService.getQuestions(1, 1, null, null, null, null, null, 'draft');
        const live = await testsService.getQuestions(1, 1, null, null, null, null, null, 'live');
        const pending = await testsService.getQuestions(1, 1, null, null, null, null, null, 'pending');
        const response = await testsService.getQuestions(1, 200);
        setTotalQuestions(response.total);
        setTotalDraftQuestions(draft.total + pending.total);
        setTotalLiveQuestions(live.total);
        const mappedQuestions: BackendItem[] = response.items.map((q) => ({
            id: q.id,
            identifier: q.identifier,
            type: 'MCQ', // Default to MCQ for now as API doesn't specify ItemType enum explicitly in the same way
            stem: q.title,
            options: (q.choices || []).map(c => ({
                id: c.id,
                text: c.content,
                isCorrect: c.isCorrect,
                explanation: c.explanation
            })),
            explanation: q.choices?.find(c => c.isCorrect)?.explanation || '',
            status: q.status as 'Draft' | 'Published' | 'Archived',
            itemType: 'single-best-answer',
            version: 1,
            authorId: 'AUTH-CURRENT',
            createdAt: q.createdAt,
            updatedAt: q.updatedAt,
            timeToAuthorMinutes: 10,
            taxonomy: {
                organSystemId: q.organSystemId || '',
                disciplineId: '',
                bloomLevel: BloomsLevel.Understand, // Default
                syndromeTopicId: q.topicId || '',
                usmleContentId: ''
            },
            linkedMediaIds: [],
            linkedLectureIds: [],
            learningObjective: q.learningObjectiveId || ''
        }));
        setQuestionsList(mappedQuestions);
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        showToast("Failed to fetch questions", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  // Deep-link: auto-open query param
  useEffect(() => {
    const questionId = searchParams.get('questionId');
    
    if (!questionId) {
      if (viewMode === 'QUESTION_EDITOR') {
        setViewMode('DASHBOARD');
        setEditingQuestion(null);
      }
      return;
    }

    if (questionId === 'new') {
      // Parse context from URL
      const contextQ: Partial<ApiQuestion> = {
         id: '',
         identifier: '',
         title: '',
         status: 'Draft',
         organSystemId: searchParams.get('organSystemId') || '',
         topicId: searchParams.get('topicId') || '',
         syndromeId: searchParams.get('syndromeId') || '',
         learningObjectiveId: searchParams.get('learningObjectiveId') || '',
         cognitiveSkillId: '', // Todo: map bloomLevel string to ID if needed
         choices: [
            { id: '1', content: '', isCorrect: false, explanation: '', createdAt: '', updatedAt: '' },
            { id: '2', content: '', isCorrect: false, explanation: '', createdAt: '', updatedAt: '' },
            { id: '3', content: '', isCorrect: false, explanation: '', createdAt: '', updatedAt: '' },
            { id: '4', content: '', isCorrect: false, explanation: '', createdAt: '', updatedAt: '' },
         ],
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString()
      };
      
      setEditingQuestion(contextQ as ApiQuestion);
      setViewMode('QUESTION_EDITOR');
      return;
    }

    if (questionId === 'new_lecture') {
        setViewMode('LECTURE_WIZARD');
        return;
    }

    const fetchAndOpen = async () => {
      try {
        const res = await testsService.getQuestion(questionId);
        const apiQ: ApiQuestion | undefined = res;
        if (apiQ) {
          // Pass the API question directly - QuestionEditor now handles this type
          setEditingQuestion(apiQ);
          setViewMode('QUESTION_EDITOR');
        }
      } catch (err) {
        console.error('Failed to fetch question for deep link:', err);
      }
    };

    fetchAndOpen();
  }, [searchParams, viewMode]);

  const questions: Question[] = useMemo(() => {
    if (activeItemType === ItemType.LECTURE) {
      return lectures.map(l => ({
        id: l.id,
        identifier: l.identifier,
        text: l.title,
        type: QuestionType.SingleBestAnswer,
        bloomsLevel: BloomsLevel.Understand,
        options: [],
        explanation: l.description,
        learningObjectives: l.linkedObjectiveIds,
        tags: ['Lecture'],
        createdAt: l.createdAt,
        status: l.status as any
      }));
    }

    return questionsList
      .filter(item => item.type === activeItemType || (activeItemType === ItemType.MCQ && item.type === 'MCQ') || (activeItemType === ItemType.SAQ && item.type === 'SAQ'))
      .map(item => ({
        id: item.id,
        identifier: item.identifier,
        text: item.stem,
        type: QuestionType.SingleBestAnswer,
        bloomsLevel: item.taxonomy.bloomLevel as BloomsLevel,
        options: item.options || [],
        explanation: item.explanation || '',
        learningObjectives: [item.learningObjective || ''],
        tags: [item.taxonomy.organSystemId],
        createdAt: item.createdAt,
        status: item.status
      }));
  }, [activeItemType, questionsList, lectures]);

  const filteredIssues = useMemo(() => {
    return []; // Issues mock removed
  }, []);

  const handleEditItem = (type: ItemType, identifier: string) => {
    if (type === ItemType.LECTURE) {
      // setSelectedItem(item);
      setViewMode('LECTURE_EDITOR');
    } else {
      // Set URL param to trigger the useEffect which fetches the full question and opens editor
      setSearchParams({ questionId: identifier });
    }
  };

  const handleCreateNew = () => {
    if (activeItemType === ItemType.LECTURE) {
      setViewMode('LECTURE_WIZARD');
    } else {
      setSearchParams({ questionId: 'new' });
    }
  };

  const handleBackToDashboard = () => {
    setSearchParams({});
    setEditingQuestion(null);
  };

  const handleSaveQuestion = async (q: ApiQuestion) => {
    try {
      showToast("Saving...", "success");
      const savedQ = await testsService.upsertQuestion(q);
      
      const isNew = !questionsList.find(item => item.id === savedQ.id); 
      
      const newItem: BackendItem = {
        id: savedQ.id,
        identifier: savedQ.identifier,
        type: activeItemType as 'MCQ' | 'SAQ',
        stem: savedQ.title,
        options: (savedQ.choices || []).map(c => ({
          id: c.id,
          text: c.content,
          isCorrect: c.isCorrect
        })),
        explanation: savedQ.choices?.find(c => c.isCorrect)?.explanation || '',
        status: savedQ.status as 'Draft' | 'Published' | 'Archived',
        itemType: activeItemType === ItemType.MCQ ? 'single-best-answer' : 'short-answer',
        version: 1,
        authorId: 'AUTH-CURRENT',
        createdAt: savedQ.createdAt,
        updatedAt: savedQ.updatedAt, 
        timeToAuthorMinutes: 10,
        taxonomy: {
          organSystemId: savedQ.organSystemId || '',
          disciplineId: 'DISC-PHARM',
          bloomLevel: BloomsLevel.Understand,
          syndromeTopicId: savedQ.topicId || '',
          usmleContentId: 'USMLE-GEN'
        },
        linkedMediaIds: [],
        linkedLectureIds: [],
        learningObjective: savedQ.learningObjectiveId || ''
      };

      if (isNew) {
        setQuestionsList(prev => [newItem, ...prev]);
        showToast(`${activeItemType} Created Successfully`);
      } else {
        setQuestionsList(prev => prev.map(item => item.id === savedQ.id ? newItem : item));
        showToast(`${activeItemType} Updated Successfully`);
      }
      handleBackToDashboard();
    } catch (error) {
      console.error("Failed to save question:", error);
      showToast("Failed to save question", "error");
    }
  };

  if (viewMode === 'QUESTION_EDITOR') return <QuestionEditor onBack={handleBackToDashboard} onSave={handleSaveQuestion} initialQuestion={editingQuestion} />;
  if (viewMode === 'LECTURE_WIZARD') return <LectureCreationWizard onBack={() => setViewMode('DASHBOARD')} onComplete={(l) => { setLectures(prev => [l, ...prev]); showToast("Lecture Created"); setViewMode('DASHBOARD'); }} />;
  if (viewMode === 'LECTURE_EDITOR') return <LectureEditor initialData={selectedItem} onBack={() => setViewMode('DASHBOARD')} onSave={() => { showToast("Saved"); setViewMode('DASHBOARD'); }} />;
  if (viewMode === 'LECTURE_PLAYER' && selectedItem) return <LecturePlayerView lectureId={selectedItem.id} onBack={() => setViewMode('DASHBOARD')} onEdit={(l) => { setSelectedItem(l); setViewMode('LECTURE_EDITOR'); }} />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 w-[90vw] xl:w-auto">
          <div className={`px-6 xl:px-8 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}>
            <div className="flex items-center gap-3 overflow-hidden">
                <CheckCircle size={20} className="shrink-0" />
                <span className="text-xs xl:text-sm font-black uppercase tracking-widest truncate">{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="shrink-0"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Global Type Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6">
        <div className="flex items-center justify-between xl:justify-start gap-2 p-1.5 bg-white rounded-[2.5rem] w-full xl:w-fit overflow-x-auto no-scrollbar">
          {[ItemType.MCQ, ItemType.SAQ, ItemType.LECTURE].map(type => (
            <button
              key={type}
              onClick={() => { setActiveItemType(type as ItemType); setViewMode('DASHBOARD'); }}
              className={`flex-1 xl:flex-none flex items-center justify-center gap-2 xl:gap-3 px-4 xl:px-8 py-3 xl:py-3.5 rounded-[2rem] text-[10px] xl:text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeItemType === type ? 'bg-primary-gradient text-white ' : 'text-slate-500 hover:bg-slate-300/50'}`}
            >
              {type === ItemType.MCQ ? <ClipboardCheck size={14} className="xl:w-4 xl:h-4" /> : type === ItemType.SAQ ? <FileText size={14} className="xl:w-4 xl:h-4" /> : <MonitorPlay size={14} className="xl:w-4 xl:h-4" />}
              {type}s
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/bank-explorer')} className="w-full xl:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#191A19] border border-slate-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2a2b2a] shadow-sm "><Database size={14} /> Global Repository</button>
      </div>

      {/* Workbench Sub-Navigation */}
      <div className="flex items-center gap-2 w-full xl:w-auto">
        <div className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-[2rem] w-full xl:w-fit shadow-sm overflow-x no-scrollbar">
          {[
            { id: 'DASHBOARD', icon: Layout, label: 'Dashboard' },
            { id: 'INTEGRITY', icon: ShieldCheck, label: 'Integrity Audit', alert: filteredIssues.length > 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 xl:px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.alert && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white">
                  {filteredIssues.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* View Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'DASHBOARD' && (
          isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <ItemModuleDashboard 
              onCreateClick={handleCreateNew}
              onViewAllClick={() => navigate('/bank-explorer')}
              onEditClick={(q) => handleEditItem(activeItemType, q.identifier)}
              onDelete={(id) => { 
                if (activeItemType === ItemType.LECTURE) {
                  setLectures(prev => prev.filter(i => i.id !== id));
                } else {
                  setQuestionsList(prev => prev.filter(i => i.id !== id)); 
                }
                showToast("Asset Deleted", "success"); 
              }}
              onIssueClick={(issue) => { setActiveTab('INTEGRITY'); }}
              onItemClick={(q) => handleEditItem(activeItemType, q.identifier)}
              totalQuestions={totalQuestions}
              totalDraftQuestions={totalDraftQuestions}
              totalLiveQuestions={totalLiveQuestions}
              questions={questions}
              issues={filteredIssues}
              itemType={activeItemType}
            />
          )
        )}
        {activeTab === 'INTEGRITY' && (
          <ItemIntegrityView 
            items={questionsList.filter(i => i.type === activeItemType)} 
            onUpdate={(updated) => { 
              setQuestionsList(prev => prev.map(i => i.id === updated.id ? updated : i)); 
              showToast("Item Remediated Successfully"); 
            }} 
          />
        )}
        {activeTab === 'LAB' && (
          <AILabView onSaveNew={(newItem) => { 
            setQuestionsList(prev => [newItem, ...prev]); 
            showToast("Lab Asset Committed to Bank"); 
            setActiveTab('DASHBOARD'); 
          }} />
        )}
      </div>
    </div>
  );
};

export default QuestionWorkbenchView;
