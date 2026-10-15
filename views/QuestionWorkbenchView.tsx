import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Question,
  QuestionType,
  BloomsLevel,
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
import { ChevronDown, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  Button,
  InlineAlert,
  Menu,
  PageHeader,
  SegmentedControl,
  Spinner,
} from '@/components/ui';
import WorkbenchTabs, { panelId, tabId } from '@/components/workbench/WorkbenchTabs';
import WorkbenchToast, {
  type ToastMessage,
  type ToastTone,
} from '@/components/workbench/WorkbenchToast';
import {
  ITEM_TYPES,
  ITEM_TYPE_SPEC,
  apiTypeLabel,
} from '@/components/workbench/itemTypes';

type WorkbenchViewMode =
  | 'DASHBOARD'
  | 'QUESTION_EDITOR'
  | 'LECTURE_WIZARD'
  | 'LECTURE_EDITOR'
  | 'LECTURE_DETAIL'
  | 'LECTURE_PLAYER'
  | 'SAQ_EDITOR'
  | 'FLASHCARD_EDITOR';

type WorkbenchTab = 'DASHBOARD' | 'INTEGRITY' | 'LAB';

const TAB_PREFIX = 'workbench';

// The AI lab and integrity audit have no working backend yet; they were hidden
// before the redesign and stay hidden until they do.
const SHOW_PREVIEW_SECTIONS = false;

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
  const [isLoading, setIsLoading] = useState(true);
  // Which type `itemsList` currently holds, so a type switch shows a spinner
  // instead of the previous type's items.
  const [loadedType, setLoadedType] = useState<ItemType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestRequestedType = useRef<ItemType>(activeItemType);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = (message: string, type: ToastTone = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    // Progress toasts stay until the next message replaces them.
    if (type !== 'progress') {
      toastTimer.current = window.setTimeout(() => setToast(null), 3000);
    }
  };

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const loadItems = async (itemType: ItemType = activeItemType) => {
    latestRequestedType.current = itemType;
    setIsLoading(true);
    setLoadError(null);
    try {
      const typeFilter = itemType.toLowerCase();
      const [draft, live, pending, response] = await Promise.all([
        testsService.getItems(1, 1, typeFilter, 'draft'),
        testsService.getItems(1, 1, typeFilter, 'live'),
        testsService.getItems(1, 1, typeFilter, 'pending'),
        testsService.getItems(1, 200, typeFilter),
      ]);
      // A newer type switch superseded this request.
      if (latestRequestedType.current !== itemType) return;

      setTotalQuestions(response.total);
      setTotalDraftQuestions(draft.total + pending.total);
      setTotalLiveQuestions(live.total);
      setItemsList(response.items);
      setLoadedType(itemType);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      if (latestRequestedType.current === itemType) {
        setLoadError(`Couldn't load ${ITEM_TYPE_SPEC[itemType].plural}. Check your connection and try again.`);
      }
    } finally {
      if (latestRequestedType.current === itemType) setIsLoading(false);
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
    // Pending items count as drafts (see the Drafts figure), not as archived.
    const statusMap = (s: string): Question['status'] =>
      s === 'live' ? 'Published' : s === 'draft' || s === 'pending' ? 'Draft' : 'Archived';

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

  const handleCreateNew = (type: ItemType = activeItemType) => {
    const params = new URLSearchParams();
    params.set('questionId', ITEM_TYPE_SPEC[type].newParam);

    if (redirectPath) {
      params.set('redirect', redirectPath);
    }

    // Creating another type from the "New item" menu switches the list to that
    // type, so the saved item lands in the list it belongs to.
    if (type !== activeItemType) {
      setActiveItemType(type);
      setActiveTab('DASHBOARD');
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
    setActiveTab((current) => (current === 'LAB' ? 'DASHBOARD' : current));
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
      showToast('Saving…', 'progress');
      const savedItem = await testsService.upsertItem(request);
      const label = apiTypeLabel(savedItem.type);

      const isNew = !itemsList.find((item) => item.id === savedItem.id);

      if (isNew) {
        setItemsList((prev) => [savedItem, ...prev]);
        showToast(`${label} created.`);
      } else {
        setItemsList((prev) =>
          prev.map((item) => (item.id === savedItem.id ? savedItem : item)),
        );
        showToast(`${label} saved.`);
      }
      handleBackToDashboard();
    } catch (error) {
      console.error('Failed to save item:', error);
      showToast("Couldn't save the item. Try again.", 'error');
    }
  };

  const handleDeleteItem = async (identifier: string) => {
    try {
      await testsService.deleteItem(identifier);
      await loadItems();
      showToast('Item deleted.');
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast("Couldn't delete the item. Try again.", 'error');
    }
  };

  // --- Editors: full-width on the canvas, over the workbench -----------------
  const renderEditor = () => {
    switch (viewMode) {
      case 'QUESTION_EDITOR':
        return (
          <QuestionEditor
            onBack={handleBackToDashboard}
            onSave={handleSaveItem}
            initialQuestion={editingItem}
          />
        );
      case 'LECTURE_WIZARD':
        return (
          <LectureCreationWizard
            onBack={handleBackToDashboard}
            onComplete={handleSaveItem}
            initialItem={selectedItem}
          />
        );
      case 'SAQ_EDITOR':
        return (
          <SAQEditor
            initialQuestion={selectedItem}
            onBack={handleBackToDashboard}
            onSave={handleSaveItem}
          />
        );
      case 'FLASHCARD_EDITOR':
        return (
          <FlashcardEditor
            initialQuestion={selectedItem}
            onBack={handleBackToDashboard}
            onSave={handleSaveItem}
          />
        );
      case 'LECTURE_EDITOR':
        return (
          <LectureEditor
            initialData={selectedItem}
            onBack={() => setViewMode('DASHBOARD')}
            onSave={() => {
              showToast('Lecture saved.');
              setViewMode('DASHBOARD');
            }}
          />
        );
      default:
        return null;
    }
  };

  const editor = renderEditor();
  const toastHost = <WorkbenchToast toast={toast} onDismiss={() => setToast(null)} />;

  if (viewMode === 'LECTURE_PLAYER' && selectedItem)
    return (
      <>
        <LecturePlayerView
          lectureId={selectedItem.id}
          onBack={() => setViewMode('DASHBOARD')}
          onEdit={(l) => {
            setSelectedItem(l);
            setViewMode('LECTURE_EDITOR');
          }}
        />
        {toastHost}
      </>
    );

  const activeSpec = ITEM_TYPE_SPEC[activeItemType];
  const listIsCurrent = loadedType === activeItemType;

  const typeSwitcher = (
    <SegmentedControl<ItemType>
      label="Item type"
      value={activeItemType}
      onChange={handleSelectType}
      options={ITEM_TYPES.map((spec) => ({ value: spec.type, label: spec.plural }))}
    />
  );

  const loadErrorAlert = loadError && (
    <InlineAlert
      tone="error"
      title={`Couldn't load ${activeSpec.plural}`}
      action={
        <Button
          size="sm"
          icon={RefreshCw}
          loading={isLoading}
          onClick={() => void loadItems()}
        >
          Retry
        </Button>
      }
    >
      {loadError}
    </InlineAlert>
  );

  const renderItemsTab = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {typeSwitcher}
        {isLoading && listIsCurrent && <Spinner label="Refreshing…" />}
      </div>
      {loadErrorAlert}
      {isLoading && !listIsCurrent ? (
        <Spinner label={`Loading ${activeSpec.plural}…`} className="py-24" />
      ) : listIsCurrent ? (
        <ItemModuleDashboard
          key={activeItemType}
          onCreateClick={() => handleCreateNew(activeItemType)}
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
      ) : null}
    </div>
  );

  const renderIntegrityTab = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {typeSwitcher}
        <p className="text-[13px] text-stone-500">
          Audit items for writing flaws and difficulty drift, then apply a suggested rewrite.
        </p>
      </div>
      {loadErrorAlert}
      {isLoading && !listIsCurrent ? (
        <Spinner label={`Loading ${activeSpec.plural}…`} className="py-24" />
      ) : listIsCurrent ? (
        <ItemIntegrityView
          key={activeItemType}
          items={itemsList
            .filter((i) => i.type === activeItemType.toLowerCase())
            .map(toBackendItem)}
          onUpdate={(updated) => {
            // Convert back: find and update in itemsList by id
            setItemsList((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, status: updated.status as any } : i)),
            );
            showToast('Rewrite applied.');
          }}
        />
      ) : null}
    </div>
  );

  const renderLabTab = () => (
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
        showToast('Draft added to the list.');
        setActiveTab('DASHBOARD');
      }}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item workbench"
        description="Write MCQs, SAQs, flashcards and lectures for your item bank, or draft new items with AI."
        actions={
          <>
            {SHOW_PREVIEW_SECTIONS && (
              <Button variant="ai" icon={Sparkles} onClick={() => setActiveTab('LAB')}>
                Generate with AI
              </Button>
            )}
            <Menu
              label="New item"
              align="end"
              items={ITEM_TYPES.map((spec) => ({
                label: spec.menuLabel,
                icon: spec.icon,
                hint: spec.description,
                onSelect: () => handleCreateNew(spec.type),
              }))}
              trigger={({ ref, ...triggerProps }) => (
                <Button
                  ref={ref}
                  variant="primary"
                  icon={Plus}
                  iconRight={ChevronDown}
                  {...triggerProps}
                >
                  New item
                </Button>
              )}
            />
          </>
        }
      />

      {SHOW_PREVIEW_SECTIONS && (
        <WorkbenchTabs<WorkbenchTab>
          label="Workbench sections"
          idPrefix={TAB_PREFIX}
          active={activeTab}
          onSelect={setActiveTab}
          tabs={[
            { id: 'DASHBOARD', label: 'Items' },
            { id: 'LAB', label: 'AI lab', badge: 'Preview' },
            { id: 'INTEGRITY', label: 'Integrity audit', badge: 'Preview' },
          ]}
        />
      )}

      <div
        role="tabpanel"
        id={panelId(TAB_PREFIX, activeTab)}
        aria-labelledby={tabId(TAB_PREFIX, activeTab)}
      >
        {activeTab === 'DASHBOARD' && renderItemsTab()}
        {activeTab === 'INTEGRITY' && renderIntegrityTab()}
        {activeTab === 'LAB' && renderLabTab()}
      </div>

      {/* Item editors open full-width on the canvas, over the workbench. */}
      {editor && (
        <div className="fixed inset-0 z-[90] !mt-0 overflow-y-auto bg-canvas p-4 custom-scrollbar sm:p-6">
          {editor}
        </div>
      )}

      {toastHost}
    </div>
  );
};

export default QuestionWorkbenchView;
