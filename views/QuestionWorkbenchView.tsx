import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Question,
  QuestionType,
  BloomsLevel,
  Issue,
  ItemType,
  BackendItem,
} from '../types';
import { testsService } from '../services/testsService';
import {
  ApiItemType,
  BackendApiItem,
  ItemUpsertRequest,
} from '../types/TestsServiceTypes';
import ItemModuleDashboard from '../components/ItemModuleDashboard';
import QuestionEditor from '../components/QuestionEditor';
import LectureCreationWizard from '../components/LectureCreationWizard';
import LectureEditor from '../components/LectureEditor';
import SAQEditor from '../components/SAQEditor';
import FlashcardEditor from '../components/FlashcardEditor';
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
  ChevronRight,
  Layers,
} from 'lucide-react';

type WorkbenchViewMode =
  | 'DASHBOARD'
  | 'QUESTION_EDITOR'
  | 'LECTURE_WIZARD'
  | 'LECTURE_EDITOR'
  | 'LECTURE_DETAIL'
  | 'LECTURE_PLAYER'
  | 'SAQ_EDITOR'
  | 'FLASHCARD_EDITOR';

// Authoring modalities surfaced in the workbench type switcher
const ITEM_MODALITIES: {
  type: ItemType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { type: ItemType.MCQ, label: 'MCQ', desc: 'Single best answer', icon: ClipboardCheck },
  { type: ItemType.SAQ, label: 'SAQ', desc: 'Short answer', icon: FileText },
  { type: ItemType.FLASHCARD, label: 'Flashcard', desc: 'Active recall', icon: Layers },
  { type: ItemType.LECTURE, label: 'Lecture', desc: 'Instructional', icon: MonitorPlay },
];
type WorkbenchTab = 'DASHBOARD' | 'INTEGRITY' | 'LAB';

// Adapter: convert BackendApiItem to legacy BackendItem for downstream components
// (ItemIntegrityView, AILabView) that haven't been migrated yet
const toBackendItem = (item: BackendApiItem): BackendItem => ({
  id: item.id,
  identifier: item.identifier,
  type: item.type.toUpperCase() as 'MCQ' | 'SAQ',
  stem: item.mcq?.stem || item.saq?.question || '',
  options: (item.mcq?.choices || []).map((c) => ({
    id: c.id || '',
    text: c.content,
    isCorrect: c.isCorrect,
    explanation: c.explanation,
  })),
  explanation: item.mcq?.choices?.find((c) => c.isCorrect)?.explanation || item.saq?.answer || '',
  status: item.status === 'live' ? 'Published' : item.status === 'draft' ? 'Draft' : 'Archived',
  itemType: item.type === 'mcq' ? 'single-best-answer' : 'short-answer',
  version: 1,
  authorId: 'AUTH-CURRENT',
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  timeToAuthorMinutes: 10,
  taxonomy: {
    organSystemId: '',
    disciplineId: '',
    bloomLevel: BloomsLevel.Understand,
    syndromeTopicId: '',
    usmleContentId: '',
  },
  linkedMediaIds: [],
  linkedLectureIds: [],
  learningObjective: item.learningObjectiveId || '',
});

const QuestionWorkbenchView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect');
  const [activeItemType, setActiveItemType] = useState<ItemType>(ItemType.MCQ);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('DASHBOARD');
  const [viewMode, setViewMode] = useState<WorkbenchViewMode>(
    searchParams.get('questionId') ? 'QUESTION_EDITOR' : 'DASHBOARD',
  );
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<BackendApiItem | null>(null);

  const [itemsList, setItemsList] = useState<BackendApiItem[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalLiveQuestions, setTotalLiveQuestions] = useState(0);
  const [totalDraftQuestions, setTotalDraftQuestions] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  console.log('Question ID', searchParams.get('questionId'));
  console.log('View mode', viewMode);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadItems = async (itemType: ItemType = activeItemType) => {
    setIsLoading(true);
    try {
      const typeFilter = itemType.toLowerCase();
      const [draft, live, pending, response] = await Promise.all([
        testsService.getItems(1, 1, typeFilter, 'draft'),
        testsService.getItems(1, 1, typeFilter, 'live'),
        testsService.getItems(1, 1, typeFilter, 'pending'),
        testsService.getItems(1, 200, typeFilter),
      ]);

      setTotalQuestions(response.total);
      setTotalDraftQuestions(draft.total + pending.total);
      setTotalLiveQuestions(live.total);
      setItemsList(response.items);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      showToast('Failed to fetch items', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch items on mount based on activeItemType
  useEffect(() => {
    void loadItems();
  }, [activeItemType]);

  // Deep-link: auto-open query param
  useEffect(() => {
    const extractContext = async () => {
      const questionId = searchParams.get('questionId');

      if (!questionId) {
        if (viewMode !== 'DASHBOARD') {
          setViewMode('DASHBOARD');
          setEditingItem(null);
          setSelectedItem(null);
        }
        return;
      }

      // Skeleton for a brand-new item, pre-linked to a learning objective when
      // one is supplied (e.g. authoring from a course's content panel).
      const makeNewItem = (type: ApiItemType): BackendApiItem => ({
        id: '',
        identifier: '',
        type,
        status: 'draft',
        learningObjectiveId: searchParams.get('learningObjectiveId') || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mcq: type === 'mcq' ? { stem: '', choices: [] } : null,
        saq: null,
        lecture: null,
        flashcard: null,
        tags: [],
      });

      if (questionId === 'new') {
        setEditingItem(makeNewItem('mcq'));
        setViewMode('QUESTION_EDITOR');
        return;
      }

      if (questionId === 'new_lecture') {
        setSelectedItem(makeNewItem('lecture'));
        setViewMode('LECTURE_WIZARD');
        return;
      }
      if (questionId === 'new_saq') {
        setSelectedItem(makeNewItem('saq'));
        setViewMode('SAQ_EDITOR');
        return;
      }
      if (questionId === 'new_flashcard') {
        setSelectedItem(makeNewItem('flashcard'));
        setViewMode('FLASHCARD_EDITOR');
        return;
      }

      const fetchAndOpen = async () => {
        try {
          const res = await testsService.getItem(questionId);
          if (res) {
            if (res.type === 'lecture') {
              setSelectedItem(res);
              setViewMode('LECTURE_WIZARD');
            } else if (res.type === 'saq') {
              setSelectedItem(res);
              setViewMode('SAQ_EDITOR');
            } else if (res.type === 'flashcard') {
              setSelectedItem(res);
              setViewMode('FLASHCARD_EDITOR');
            } else {
              // Pass BackendApiItem directly to QuestionEditor
              setEditingItem(res);
              setViewMode('QUESTION_EDITOR');
            }
          }
        } catch (err) {
          console.error('Failed to fetch item for deep link:', err);
        }
      };

      fetchAndOpen();
    };
    extractContext();
  }, [searchParams, viewMode]);

  // Map BackendApiItem[] to Question[] for ItemModuleDashboard
  const questions: Question[] = useMemo(() => {
    const statusMap = (s: string) => s === 'live' ? 'Published' : s === 'draft' ? 'Draft' : 'Archived';

    return itemsList.map((item) => ({
      id: item.id,
      identifier: item.identifier,
      text:
        item.mcq?.stem ||
        item.saq?.question ||
        item.flashcard?.front ||
        item.lecture?.title ||
        '',
      type: QuestionType.SingleBestAnswer,
      bloomsLevel: BloomsLevel.Understand,
      options: (item.mcq?.choices || []).map((c) => ({
        id: c.id || '',
        text: c.content,
        isCorrect: c.isCorrect,
        explanation: c.explanation,
      })),
      explanation: item.mcq?.choices?.find((c) => c.isCorrect)?.explanation || item.saq?.answer || '',
      learningObjectives: item.learningObjectiveId ? [item.learningObjectiveId] : [],
      tags: item.tags?.map(t => t.title) || [],
      createdAt: item.createdAt,
      status: statusMap(item.status),
    }));
  }, [itemsList]);

  const filteredIssues = useMemo(() => {
    return []; // Issues mock removed
  }, []);

  const handleEditItem = (type: ItemType, identifier: string) => {
    const params = new URLSearchParams();
    params.set('questionId', identifier);
    if (redirectPath) {
      params.set('redirect', redirectPath);
    }
    setSearchParams(params);
  };

  const handleCreateNew = () => {
    const params = new URLSearchParams();

    if (activeItemType === ItemType.LECTURE) {
      params.set('questionId', 'new_lecture');
    } else if (activeItemType === ItemType.SAQ) {
      params.set('questionId', 'new_saq');
    } else if (activeItemType === ItemType.FLASHCARD) {
      params.set('questionId', 'new_flashcard');
    } else {
      params.set('questionId', 'new');
    }

    if (redirectPath) {
      params.set('redirect', redirectPath);
    }

    setSearchParams(params);
  };

  const handleBackToDashboard = () => {
    if (redirectPath) {
      navigate(redirectPath);
      return;
    }

    setSearchParams({});
    setEditingItem(null);
  };

  const handleSelectType = (type: ItemType) => {
    if (type === activeItemType) return;
    setActiveItemType(type);
    setActiveTab('DASHBOARD');
    setViewMode('DASHBOARD');
    setEditingItem(null);
    setSelectedItem(null);
    if (searchParams.toString()) {
      setSearchParams({});
    }
  };

  // Accepts ItemUpsertRequest directly from editors
  const handleSaveItem = async (request: ItemUpsertRequest) => {
    try {
      showToast('Saving...', 'success');
      const savedItem = await testsService.upsertItem(request);

      const isNew = !itemsList.find((item) => item.id === savedItem.id);

      if (isNew) {
        setItemsList((prev) => [savedItem, ...prev]);
        showToast(`${activeItemType} Created Successfully`);
      } else {
        setItemsList((prev) =>
          prev.map((item) => (item.id === savedItem.id ? savedItem : item)),
        );
        showToast(`${activeItemType} Updated Successfully`);
      }
      handleBackToDashboard();
    } catch (error) {
      console.error('Failed to save item:', error);
      showToast('Failed to save item', 'error');
    }
  };

  const handleDeleteItem = async (identifier: string) => {
    try {
      showToast('Deleting item...', 'success');
      await testsService.deleteItem(identifier);
      await loadItems();
      showToast('Asset Deleted', 'success');
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete item', 'error');
    }
  };

  if (viewMode === 'QUESTION_EDITOR')
    return (
      <QuestionEditor
        onBack={handleBackToDashboard}
        onSave={handleSaveItem}
        initialQuestion={editingItem}
      />
    );
  if (viewMode === 'LECTURE_WIZARD')
    return (
      <LectureCreationWizard
        onBack={handleBackToDashboard}
        onComplete={handleSaveItem}
        initialItem={selectedItem}
      />
    );
  if (viewMode === 'SAQ_EDITOR')
    return (
      <SAQEditor
        initialQuestion={selectedItem}
        onBack={handleBackToDashboard}
        onSave={handleSaveItem}
      />
    );
  if (viewMode === 'FLASHCARD_EDITOR')
    return (
      <FlashcardEditor
        initialQuestion={selectedItem}
        onBack={handleBackToDashboard}
        onSave={handleSaveItem}
      />
    );
  if (viewMode === 'LECTURE_EDITOR')
    return (
      <LectureEditor
        initialData={selectedItem}
        onBack={() => setViewMode('DASHBOARD')}
        onSave={() => {
          showToast('Saved');
          setViewMode('DASHBOARD');
        }}
      />
    );
  if (viewMode === 'LECTURE_PLAYER' && selectedItem)
    return (
      <LecturePlayerView
        lectureId={selectedItem.id}
        onBack={() => setViewMode('DASHBOARD')}
        onEdit={(l) => {
          setSelectedItem(l);
          setViewMode('LECTURE_EDITOR');
        }}
      />
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 w-[90vw] xl:w-auto">
          <div
            className={`px-6 xl:px-8 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <CheckCircle size={20} className="shrink-0" />
              <span className="text-xs xl:text-sm font-black uppercase tracking-widest truncate">
                {toast.message}
              </span>
            </div>
            <button onClick={() => setToast(null)} className="shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Authoring Modality Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-stretch gap-3 xl:gap-4">
        <div className="flex-1 bg-white border border-slate-200 rounded-[2rem] shadow-sm p-2 xl:p-2.5">
          <div className="flex items-center gap-1 mb-1 px-3 pt-1">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
              Authoring Modality
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ITEM_MODALITIES.map((modality) => {
              const isActive = activeItemType === modality.type;
              const Icon = modality.icon;
              return (
                <button
                  key={modality.type}
                  onClick={() => handleSelectType(modality.type)}
                  className={`group flex items-center gap-3 px-3 xl:px-4 py-3 xl:py-3.5 rounded-[1.5rem] text-left transition-all ${
                    isActive
                      ? 'bg-primary-gradient text-white shadow-lg shadow-emerald-100'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-400 group-hover:text-[#1BD183]'
                    }`}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-black uppercase tracking-widest truncate">
                      {modality.label}
                    </span>
                    <span
                      className={`block text-[9px] font-bold uppercase tracking-wider truncate ${
                        isActive ? 'text-white/70' : 'text-slate-400'
                      }`}
                    >
                      {modality.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => navigate('/bank-explorer')}
          className="xl:w-48 flex items-center justify-center gap-2 px-6 py-4 bg-[#191A19] border border-slate-800 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-[#2a2b2a] shadow-sm transition-colors"
        >
          <Database size={15} /> Global Repository
        </button>
      </div>

      {/* Workbench Sub-Navigation */}
      {/* <div className="flex items-center gap-2 w-full xl:w-auto">
        <div className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-[2rem] w-full xl:w-fit shadow-sm overflow-x no-scrollbar">
          {[
            { id: 'DASHBOARD', icon: Layout, label: 'Dashboard' },
            {
              id: 'INTEGRITY',
              icon: ShieldCheck,
              label: 'Integrity Audit',
              alert: filteredIssues.length > 0,
            },
          ].map((tab) => (
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
      </div> */}

      {/* View Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'DASHBOARD' &&
          (isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <ItemModuleDashboard
              onCreateClick={handleCreateNew}
              onViewAllClick={() => navigate('/bank-explorer')}
              onEditClick={(q) => handleEditItem(activeItemType, q.identifier || q.id)}
              onDelete={handleDeleteItem}
              onIssueClick={() => {
                setActiveTab('INTEGRITY');
              }}
              onItemClick={(q) => handleEditItem(activeItemType, q.identifier || q.id)}
              totalQuestions={totalQuestions}
              totalDraftQuestions={totalDraftQuestions}
              totalLiveQuestions={totalLiveQuestions}
              questions={questions}
              issues={filteredIssues}
              itemType={activeItemType}
            />
          ))}
        {activeTab === 'INTEGRITY' && (
          <ItemIntegrityView
            items={itemsList
              .filter((i) => i.type === activeItemType.toLowerCase())
              .map(toBackendItem)}
            onUpdate={(updated) => {
              // Convert back: find and update in itemsList by id
              setItemsList((prev) =>
                prev.map((i) => (i.id === updated.id ? { ...i, status: updated.status as any } : i)),
              );
              showToast('Item Remediated Successfully');
            }}
          />
        )}
        {activeTab === 'LAB' && (
          <AILabView
            onSaveNew={(newItem) => {
              // AILabView still emits BackendItem — convert minimally
              const apiItem: BackendApiItem = {
                id: newItem.id,
                identifier: newItem.identifier || '',
                type: newItem.type?.toLowerCase() as any || 'mcq',
                status: newItem.status === 'Published' ? 'live' : 'draft',
                learningObjectiveId: newItem.learningObjective || null,
                createdAt: newItem.createdAt,
                updatedAt: newItem.updatedAt,
                mcq: { stem: newItem.stem, choices: [] },
                saq: null,
                lecture: null,
                flashcard: null,
                tags: [],
              };
              setItemsList((prev) => [apiItem, ...prev]);
              showToast('Lab Asset Committed to Bank');
              setActiveTab('DASHBOARD');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default QuestionWorkbenchView;
