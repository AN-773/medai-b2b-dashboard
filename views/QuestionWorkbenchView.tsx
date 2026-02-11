
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_ITEMS, MOCK_ISSUES, MOCK_LECTURES } from '../constants';
import { 
  Question, 
  QuestionType, 
  BloomsLevel, 
  Issue, 
  ItemType,
  BackendItem,
  LectureAsset
} from '../types';
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
  const [activeItemType, setActiveItemType] = useState<ItemType>(ItemType.MCQ);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('DASHBOARD');
  const [viewMode, setViewMode] = useState<WorkbenchViewMode>('DASHBOARD');
  const [selectedItem, setSelectedItem] = useState<BackendItem | LectureAsset | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
  const [allBackendItems, setAllBackendItems] = useState<BackendItem[]>(MOCK_ITEMS);
  const [allLectures, setAllLectures] = useState<LectureAsset[]>(MOCK_LECTURES);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const questions: Question[] = useMemo(() => {
    if (activeItemType === ItemType.LECTURE) {
      return allLectures.map(l => ({
        id: l.id,
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

    return allBackendItems
      .filter(item => item.type === activeItemType)
      .map(item => ({
        id: item.id,
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
  }, [activeItemType, allBackendItems, allLectures]);

  const filteredIssues = useMemo(() => {
    return MOCK_ISSUES.filter(issue => {
      const item = allBackendItems.find(i => i.id === issue.questionId);
      return item?.type === activeItemType;
    });
  }, [activeItemType, allBackendItems]);

  const handleEditItem = (item: any) => {
    if (activeItemType === ItemType.LECTURE) {
      setSelectedItem(item);
      setViewMode('LECTURE_EDITOR');
    } else {
      const q: Question = {
        id: item.id,
        text: item.stem || item.title || '',
        type: QuestionType.SingleBestAnswer,
        bloomsLevel: (item.taxonomy?.bloomLevel as BloomsLevel) || BloomsLevel.Understand,
        options: item.options || [],
        explanation: item.explanation || item.description || '',
        learningObjectives: item.learningObjective ? [item.learningObjective] : [],
        tags: item.taxonomy ? [item.taxonomy.organSystemId] : [],
        createdAt: item.createdAt,
        status: item.status
      };
      setEditingQuestion(q);
      setViewMode('QUESTION_EDITOR');
    }
  };

  const handleCreateNew = () => {
    if (activeItemType === ItemType.LECTURE) {
      setViewMode('LECTURE_WIZARD');
    } else {
      setEditingQuestion(null);
      setViewMode('QUESTION_EDITOR');
    }
  };

  const handleSaveQuestion = (q: Question) => {
    const isNew = !allBackendItems.find(item => item.id === q.id);
    const newItem: BackendItem = {
      id: q.id,
      type: activeItemType as 'MCQ' | 'SAQ',
      stem: q.text,
      options: q.options,
      explanation: q.explanation,
      status: q.status,
      itemType: activeItemType === ItemType.MCQ ? 'single-best-answer' : 'short-answer',
      version: 1,
      authorId: 'AUTH-CURRENT',
      createdAt: q.createdAt,
      updatedAt: new Date().toISOString(),
      timeToAuthorMinutes: 10,
      taxonomy: {
        organSystemId: q.tags[0] || 'USMLE-ENDO',
        disciplineId: 'DISC-PHARM',
        bloomLevel: q.bloomsLevel,
        syndromeTopicId: 'TOPIC-GEN',
        usmleContentId: 'USMLE-GEN'
      },
      linkedMediaIds: [],
      linkedLectureIds: [],
      learningObjective: q.learningObjectives[0] || ''
    };

    if (isNew) {
      setAllBackendItems(prev => [newItem, ...prev]);
      showToast(`${activeItemType} Created`);
    } else {
      setAllBackendItems(prev => prev.map(item => item.id === q.id ? newItem : item));
      showToast(`${activeItemType} Updated`);
    }
    setViewMode('DASHBOARD');
  };

  if (viewMode === 'QUESTION_EDITOR') return <QuestionEditor onBack={() => setViewMode('DASHBOARD')} onSave={handleSaveQuestion} initialQuestion={editingQuestion} />;
  if (viewMode === 'LECTURE_WIZARD') return <LectureCreationWizard onBack={() => setViewMode('DASHBOARD')} onComplete={(l) => { setAllLectures(prev => [l, ...prev]); showToast("Lecture Created"); setViewMode('DASHBOARD'); }} />;
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
          <ItemModuleDashboard 
            onCreateClick={handleCreateNew}
            onViewAllClick={() => navigate('/bank-explorer')}
            onEditClick={(q) => handleEditItem(allBackendItems.find(i => i.id === q.id) || allLectures.find(l => l.id === q.id))}
            onDelete={(id) => { 
              if (activeItemType === ItemType.LECTURE) {
                setAllLectures(prev => prev.filter(i => i.id !== id));
              } else {
                setAllBackendItems(prev => prev.filter(i => i.id !== id)); 
              }
              showToast("Asset Deleted", "success"); 
            }}
            onIssueClick={(issue) => { setActiveTab('INTEGRITY'); }}
            onItemClick={(q) => handleEditItem(allBackendItems.find(i => i.id === q.id) || allLectures.find(l => l.id === q.id))}
            questions={questions}
            issues={filteredIssues}
            itemType={activeItemType}
          />
        )}
        {activeTab === 'INTEGRITY' && (
          <ItemIntegrityView 
            items={allBackendItems.filter(i => i.type === activeItemType)} 
            onUpdate={(updated) => { 
              setAllBackendItems(prev => prev.map(i => i.id === updated.id ? updated : i)); 
              showToast("Item Remediated Successfully"); 
            }} 
          />
        )}
        {activeTab === 'LAB' && (
          <AILabView onSaveNew={(newItem) => { 
            setAllBackendItems(prev => [newItem, ...prev]); 
            showToast("Lab Asset Committed to Bank"); 
            setActiveTab('DASHBOARD'); 
          }} />
        )}
      </div>
    </div>
  );
};

export default QuestionWorkbenchView;
