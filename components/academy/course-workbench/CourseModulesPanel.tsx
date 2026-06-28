import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { testsService } from '@/services/testsService';
import type {
  TeacherCourse,
  TeacherCourseModule,
  TeacherCourseSession,
  TeacherCourseSessionMode,
} from '@/types/AcademyStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import ConfirmationModal from '@/components/ConfirmationModal';
import {
  itemTitle,
  MODALITIES,
} from '@/components/academy/course-workbench/ObjectiveItemsList';
import SessionItemDetailModal from '@/components/academy/course-workbench/SessionItemDetailModal';
import HoverTooltip from '@/components/academy/course-workbench/HoverTooltip';
import { inputClass, SectionLabel } from './shared';

interface CourseModulesPanelProps {
  course: TeacherCourse;
  entryAction?: 'create-session' | null;
  onEntryActionHandled?: () => void;
}

interface SessionEligibleItem extends BackendApiItem {
  objectiveId: string;
  objectiveTitle: string;
}

interface ModuleEditorState {
  id?: string;
  identifier?: string;
  title: string;
  displayOrder: number;
}

interface SessionEditorState {
  id?: string;
  identifier?: string;
  moduleId: string;
  title: string;
  displayOrder: number;
  scheduledDate: string;
  itemIds: string[];
}

interface ModuleCard {
  id: string;
  title: string;
  displayOrder: number;
  sessionCount: number;
  isVirtual?: boolean;
}

const STATUS_STYLES: Record<BackendApiItem['status'], string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-slate-100 text-slate-500 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const MODE_STYLES: Record<TeacherCourseSessionMode, string> = {
  mcq: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  saq: 'bg-blue-50 text-blue-700 border-blue-200',
  flashcard: 'bg-purple-50 text-purple-700 border-purple-200',
  lecture: 'bg-amber-50 text-amber-700 border-amber-200',
  mixed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const UNGROUPED_MODULE_ID = '__ungrouped__';
const OBJECTIVES_PER_PAGE = 20;
const ITEMS_PAGE_SIZE = 200;

const sortModules = (modules: TeacherCourseModule[]) =>
  [...modules].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }
    return left.id.localeCompare(right.id);
  });

const sortSessions = (sessions: TeacherCourseSession[]) =>
  [...sessions].sort((left, right) => {
    const leftModuleOrder =
      typeof left.moduleDisplayOrder === 'number'
        ? left.moduleDisplayOrder
        : Number.MAX_SAFE_INTEGER;
    const rightModuleOrder =
      typeof right.moduleDisplayOrder === 'number'
        ? right.moduleDisplayOrder
        : Number.MAX_SAFE_INTEGER;
    if (leftModuleOrder !== rightModuleOrder) {
      return leftModuleOrder - rightModuleOrder;
    }
    const leftModuleTitle = left.moduleTitle?.trim() || '';
    const rightModuleTitle = right.moduleTitle?.trim() || '';
    if (leftModuleTitle !== rightModuleTitle) {
      return leftModuleTitle.localeCompare(rightModuleTitle);
    }
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    if (left.scheduledDate !== right.scheduledDate) {
      if (!left.scheduledDate) return -1;
      if (!right.scheduledDate) return 1;
      return left.scheduledDate.localeCompare(right.scheduledDate);
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }
    return left.id.localeCompare(right.id);
  });

const buildEmptyModuleForm = (displayOrder: number): ModuleEditorState => ({
  title: '',
  displayOrder,
});

const moduleToForm = (module: TeacherCourseModule): ModuleEditorState => ({
  id: module.id,
  identifier: module.identifier,
  title: module.title,
  displayOrder: module.displayOrder,
});

const buildEmptySessionForm = (
  displayOrder: number,
  moduleId = '',
): SessionEditorState => ({
  moduleId,
  title: '',
  displayOrder,
  scheduledDate: '',
  itemIds: [],
});

const sessionToForm = (session: TeacherCourseSession): SessionEditorState => ({
  id: session.id,
  identifier: session.identifier,
  moduleId: session.moduleId,
  title: session.title,
  displayOrder: session.displayOrder,
  scheduledDate: session.scheduledDate,
  itemIds: session.items.map((item) => item.id),
});

const sessionModeFromItems = (
  items: Pick<BackendApiItem, 'type'>[],
): TeacherCourseSessionMode => {
  if (items.length === 0) return 'mixed';
  const firstType = items[0].type;
  return items.every((item) => item.type === firstType) ? firstType : 'mixed';
};

const formatSessionMode = (mode: TeacherCourseSessionMode) =>
  mode === 'mcq'
    ? 'MCQ'
    : mode === 'saq'
      ? 'SAQ'
      : mode === 'lecture'
        ? 'Lecture'
        : mode === 'flashcard'
          ? 'Flashcard'
          : 'Mixed';

const formatReleaseDate = (value: string) => {
  if (!value) return 'No release date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
};

const modalityByType = new Map(
  MODALITIES.map((modality) => [modality.type, modality] as const),
);

const collectObjectiveIds = (
  items: Pick<BackendApiItem, 'learningObjectiveId'>[],
): string[] =>
  Array.from(
    new Set(
      items
        .map((item) => item.learningObjectiveId)
        .filter((objectiveId): objectiveId is string => Boolean(objectiveId)),
    ),
  );

const listObjectiveItems = async (
  objective: TeacherCourse['learningObjectives'][number],
): Promise<SessionEligibleItem[]> => {
  const firstPage = await testsService.getItems(
    1,
    ITEMS_PAGE_SIZE,
    undefined,
    undefined,
    undefined,
    objective.id,
  );

  let items = firstPage.items || [];

  if (typeof firstPage.total === 'number') {
    const totalPages = Math.ceil(firstPage.total / ITEMS_PAGE_SIZE);

    for (let page = firstPage.page + 1; page <= totalPages; page += 1) {
      const nextPage = await testsService.getItems(
        page,
        ITEMS_PAGE_SIZE,
        undefined,
        undefined,
        undefined,
        objective.id,
      );
      items = items.concat(nextPage.items || []);
    }
  } else {
    let lastPageItems = firstPage.items || [];
    let nextPage = firstPage.page + 1;

    while (lastPageItems.length === ITEMS_PAGE_SIZE) {
      const pageResult = await testsService.getItems(
        nextPage,
        ITEMS_PAGE_SIZE,
        undefined,
        undefined,
        undefined,
        objective.id,
      );
      lastPageItems = pageResult.items || [];

      if (lastPageItems.length === 0) break;

      items = items.concat(lastPageItems);
      nextPage += 1;
    }
  }

  return items.map(
    (item): SessionEligibleItem => ({
      ...item,
      objectiveId: objective.id,
      objectiveTitle: objective.title,
    }),
  );
};

const sortEligibleItems = (items: SessionEligibleItem[]) =>
  [...items].sort((left, right) => {
    if (left.objectiveTitle !== right.objectiveTitle) {
      return left.objectiveTitle.localeCompare(right.objectiveTitle);
    }
    const leftTitle = itemTitle(left);
    const rightTitle = itemTitle(right);
    if (leftTitle !== rightTitle) {
      return leftTitle.localeCompare(rightTitle);
    }
    return left.id.localeCompare(right.id);
  });

const CourseModulesPanel: React.FC<CourseModulesPanelProps> = ({
  course,
  entryAction = null,
  onEntryActionHandled,
}) => {
  const [modules, setModules] = useState<TeacherCourseModule[]>([]);
  const [sessions, setSessions] = useState<TeacherCourseSession[]>([]);
  const [eligibleItems, setEligibleItems] = useState<SessionEligibleItem[]>([]);
  const [moduleForm, setModuleForm] = useState<ModuleEditorState>(
    buildEmptyModuleForm(1),
  );
  const [form, setForm] = useState<SessionEditorState>(buildEmptySessionForm(1));
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  // Master-detail: which editor the right-hand pane is showing.
  const [editorMode, setEditorMode] = useState<'module' | 'session'>('module');
  // Outline tree collapse state (absence from the set = expanded).
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [objectivePriorityIds, setObjectivePriorityIds] = useState<string[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [isDeletingModule, setIsDeletingModule] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [moduleToDelete, setModuleToDelete] = useState<TeacherCourseModule | null>(
    null,
  );
  const [sessionToDelete, setSessionToDelete] = useState<TeacherCourseSession | null>(
    null,
  );
  const [previewItem, setPreviewItem] = useState<SessionEligibleItem | null>(null);
  const activeCourseIdRef = useRef(course.id);
  const loadRequestIdRef = useRef(0);
  const moduleSaveRequestIdRef = useRef(0);
  const moduleDeleteRequestIdRef = useRef(0);
  const sessionSaveRequestIdRef = useRef(0);
  const sessionDeleteRequestIdRef = useRef(0);
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  activeCourseIdRef.current = course.id;

  const realModules = useMemo(() => sortModules(modules), [modules]);

  const objectiveTitleById = useMemo(
    () =>
      new Map(
        course.learningObjectives.map((objective) => [objective.id, objective.title] as const),
      ),
    [course.learningObjectives],
  );

  const nextModuleDisplayOrder = useMemo(
    () =>
      realModules.reduce(
        (maxOrder, module) => Math.max(maxOrder, module.displayOrder),
        0,
      ) + 1,
    [realModules],
  );

  const nextSessionDisplayOrderByModule = useMemo(() => {
    const byModule = new Map<string, number>();
    sessions.forEach((session) => {
      const moduleId = session.moduleId || '';
      byModule.set(
        moduleId,
        Math.max(byModule.get(moduleId) || 0, session.displayOrder),
      );
    });
    return byModule;
  }, [sessions]);

  const getNextSessionDisplayOrder = useCallback(
    (moduleId: string) => (nextSessionDisplayOrderByModule.get(moduleId) || 0) + 1,
    [nextSessionDisplayOrderByModule],
  );

  const hydrateEligibleItems = useCallback(
    (
      loadedSessions: TeacherCourseSession[],
      fetchedItems: SessionEligibleItem[],
    ): SessionEligibleItem[] => {
      const byId = new Map(fetchedItems.map((item) => [item.id, item] as const));

      loadedSessions.forEach((session) => {
        session.items.forEach((item) => {
          if (byId.has(item.id)) return;
          byId.set(item.id, {
            ...item,
            objectiveId: item.learningObjectiveId || '',
            objectiveTitle:
              objectiveTitleById.get(item.learningObjectiveId || '') ||
              'Course item',
          });
        });
      });

      return sortEligibleItems(Array.from(byId.values()));
    },
    [objectiveTitleById],
  );

  const isCurrentLoadRequest = (requestCourseId: string, requestId: number) =>
    activeCourseIdRef.current === requestCourseId &&
    loadRequestIdRef.current === requestId;

  const isCurrentModuleSaveRequest = (requestCourseId: string, requestId: number) =>
    activeCourseIdRef.current === requestCourseId &&
    moduleSaveRequestIdRef.current === requestId;

  const isCurrentModuleDeleteRequest = (
    requestCourseId: string,
    requestId: number,
  ) =>
    activeCourseIdRef.current === requestCourseId &&
    moduleDeleteRequestIdRef.current === requestId;

  const isCurrentSessionSaveRequest = (
    requestCourseId: string,
    requestId: number,
  ) =>
    activeCourseIdRef.current === requestCourseId &&
    sessionSaveRequestIdRef.current === requestId;

  const isCurrentSessionDeleteRequest = (
    requestCourseId: string,
    requestId: number,
  ) =>
    activeCourseIdRef.current === requestCourseId &&
    sessionDeleteRequestIdRef.current === requestId;

  const loadPanelData = useCallback(async () => {
    const requestCourseId = course.id;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setIsLoading(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      const [loadedModules, loadedSessions, itemPages] = await Promise.all([
        academyStudioBackend.listCourseModules(course),
        academyStudioBackend.listCourseSessions(course),
        Promise.all(course.learningObjectives.map((objective) => listObjectiveItems(objective))),
      ]);

      const mergedItems = hydrateEligibleItems(
        loadedSessions,
        itemPages.flat(),
      );
      const orderedModules = sortModules(loadedModules);
      const orderedSessions = sortSessions(loadedSessions);
      const nextDisplayOrderForLoadedModule = (moduleId: string) =>
        orderedSessions.reduce((maxOrder, session) => {
          if ((session.moduleId || '') !== moduleId) {
            return maxOrder;
          }
          return Math.max(maxOrder, session.displayOrder);
        }, 0) + 1;
      const initialModuleId =
        orderedModules[0]?.id ||
        (orderedSessions.some((session) => !session.moduleId)
          ? UNGROUPED_MODULE_ID
          : null);
      const initialModuleSessions =
        initialModuleId === UNGROUPED_MODULE_ID
          ? orderedSessions.filter((session) => !session.moduleId)
          : orderedSessions.filter((session) => session.moduleId === initialModuleId);
      const firstSession = initialModuleSessions[0] || null;

      if (!isCurrentLoadRequest(requestCourseId, requestId)) return;

      setModules(orderedModules);
      setSessions(orderedSessions);
      setEligibleItems(mergedItems);
      setSelectedModuleId(initialModuleId);
      setEditorMode('module');
      setIsCreatingSession(false);
      setModuleForm(
        initialModuleId && initialModuleId !== UNGROUPED_MODULE_ID
          ? moduleToForm(orderedModules.find((module) => module.id === initialModuleId)!)
          : buildEmptyModuleForm(
              orderedModules.reduce(
                (maxOrder, module) => Math.max(maxOrder, module.displayOrder),
                0,
              ) + 1,
            ),
      );
      setObjectivePriorityIds(
        firstSession ? collectObjectiveIds(firstSession.items) : [],
      );
      setSelectedSessionId(firstSession?.id ?? null);
      setForm(
        firstSession
          ? sessionToForm(firstSession)
          : buildEmptySessionForm(
              nextDisplayOrderForLoadedModule(
                initialModuleId && initialModuleId !== UNGROUPED_MODULE_ID
                  ? initialModuleId
                  : '',
              ),
              initialModuleId && initialModuleId !== UNGROUPED_MODULE_ID
                ? initialModuleId
                : '',
            ),
      );
    } catch (error) {
      console.error('Failed to load course modules:', error);
      if (!isCurrentLoadRequest(requestCourseId, requestId)) return;
      setModules([]);
      setSessions([]);
      setEligibleItems([]);
      setObjectivePriorityIds([]);
      setSelectedModuleId(null);
      setIsCreatingSession(false);
      setSelectedSessionId(null);
      setModuleForm(buildEmptyModuleForm(1));
      setForm(buildEmptySessionForm(1));
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load course modules for this course.',
      );
    } finally {
      if (isCurrentLoadRequest(requestCourseId, requestId)) {
        setIsLoading(false);
      }
    }
  }, [course, hydrateEligibleItems]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    moduleSaveRequestIdRef.current += 1;
    moduleDeleteRequestIdRef.current += 1;
    sessionSaveRequestIdRef.current += 1;
    sessionDeleteRequestIdRef.current += 1;
    setModules([]);
    setSessions([]);
    setEligibleItems([]);
    setObjectivePriorityIds([]);
    setSelectedModuleId(null);
    setIsCreatingSession(false);
    setSelectedSessionId(null);
    setModuleForm(buildEmptyModuleForm(1));
    setForm(buildEmptySessionForm(1));
    setEditorMode('module');
    setCollapsedModuleIds(new Set());
    setSearchQuery('');
    setPickerPage(1);
    setModuleToDelete(null);
    setSessionToDelete(null);
    setLoadError(null);
    setStatusMessage(null);
    setIsLoading(true);
    setIsSavingModule(false);
    setIsDeletingModule(false);
    setIsSavingSession(false);
    setIsDeletingSession(false);
  }, [course.id]);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

  useEffect(() => {
    setPickerPage(1);
  }, [deferredSearch, eligibleItems]);

  const displayedModules = useMemo(() => {
    const counts = sessions.reduce((byModule, session) => {
      const moduleId = session.moduleId || UNGROUPED_MODULE_ID;
      byModule.set(moduleId, (byModule.get(moduleId) || 0) + 1);
      return byModule;
    }, new Map<string, number>());

    const cards: ModuleCard[] = realModules.map((module) => ({
      id: module.id,
      title: module.title,
      displayOrder: module.displayOrder,
      sessionCount: counts.get(module.id) || 0,
    }));

    if (counts.get(UNGROUPED_MODULE_ID)) {
      cards.push({
        id: UNGROUPED_MODULE_ID,
        title: 'Ungrouped',
        displayOrder: Number.MAX_SAFE_INTEGER,
        sessionCount: counts.get(UNGROUPED_MODULE_ID) || 0,
        isVirtual: true,
      });
    }

    return cards;
  }, [realModules, sessions]);

  const currentModule = useMemo(
    () => realModules.find((module) => module.id === selectedModuleId) || null,
    [realModules, selectedModuleId],
  );

  const currentModuleSessions = useMemo(() => {
    if (selectedModuleId === UNGROUPED_MODULE_ID) {
      return sortSessions(sessions.filter((session) => !session.moduleId));
    }
    if (!selectedModuleId) {
      return [];
    }
    return sortSessions(
      sessions.filter((session) => session.moduleId === selectedModuleId),
    );
  }, [selectedModuleId, sessions]);

  // Flattened outline tree: every module (incl. the virtual "Ungrouped" bucket)
  // paired with its sessions, sorted for display in the left rail.
  const outline = useMemo(
    () =>
      displayedModules.map((module) => ({
        module,
        sessions:
          module.id === UNGROUPED_MODULE_ID
            ? sortSessions(sessions.filter((session) => !session.moduleId))
            : sortSessions(
                sessions.filter((session) => session.moduleId === module.id),
              ),
      })),
    [displayedModules, sessions],
  );

  const toggleModuleCollapsed = useCallback((moduleId: string) => {
    setCollapsedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectedModuleId && selectedModuleId !== UNGROUPED_MODULE_ID && currentModule) {
      setModuleForm((current) => {
        if (
          current.id === currentModule.id &&
          current.title === currentModule.title &&
          current.displayOrder === currentModule.displayOrder
        ) {
          return current;
        }
        return moduleToForm(currentModule);
      });
    }
  }, [currentModule, selectedModuleId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setIsCreatingSession(false);
      setSelectedSessionId(null);
      setObjectivePriorityIds([]);
      setForm(buildEmptySessionForm(1));
      return;
    }

    if (isCreatingSession) {
      return;
    }

    const activeSession =
      currentModuleSessions.find((session) => session.id === selectedSessionId) || null;
    if (activeSession) {
      return;
    }

    const nextSession = currentModuleSessions[0] || null;
    if (nextSession) {
      setObjectivePriorityIds(collectObjectiveIds(nextSession.items));
      setSelectedSessionId(nextSession.id);
      setPickerPage(1);
      setForm(sessionToForm(nextSession));
      return;
    }

    const defaultModuleId =
      selectedModuleId === UNGROUPED_MODULE_ID ? '' : selectedModuleId;
    setObjectivePriorityIds([]);
    setSelectedSessionId(null);
    setPickerPage(1);
    setForm(
      buildEmptySessionForm(
        getNextSessionDisplayOrder(defaultModuleId),
        defaultModuleId,
      ),
    );
  }, [
    currentModuleSessions,
    getNextSessionDisplayOrder,
    isCreatingSession,
    selectedModuleId,
    selectedSessionId,
  ]);

  const eligibleItemById = useMemo(
    () => new Map(eligibleItems.map((item) => [item.id, item] as const)),
    [eligibleItems],
  );

  const selectedItems = useMemo(
    () =>
      form.itemIds
        .map((itemId) => eligibleItemById.get(itemId))
        .filter((item): item is SessionEligibleItem => Boolean(item)),
    [eligibleItemById, form.itemIds],
  );

  const selectedMode = useMemo(
    () => sessionModeFromItems(selectedItems),
    [selectedItems],
  );

  const prioritizedObjectiveIds = useMemo(
    () => new Set(objectivePriorityIds),
    [objectivePriorityIds],
  );

  const selectionCounts = useMemo(
    () =>
      MODALITIES.map((modality) => ({
        ...modality,
        count: selectedItems.filter((item) => item.type === modality.type).length,
      })),
    [selectedItems],
  );

  const visibleItems = useMemo(
    () =>
      deferredSearch
        ? eligibleItems.filter((item) => {
            const haystack = [
              itemTitle(item),
              item.objectiveTitle,
              item.identifier,
              item.type,
              item.status,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(deferredSearch);
          })
        : eligibleItems,
    [deferredSearch, eligibleItems],
  );

  const allGroups = useMemo(() => {
    const selectedIds = new Set(form.itemIds);
    const groups = new Map<
      string,
      { objectiveTitle: string; items: SessionEligibleItem[] }
    >();

    visibleItems.forEach((item) => {
      const group =
        groups.get(item.objectiveId) || {
          objectiveTitle: item.objectiveTitle,
          items: [],
        };
      group.items.push(item);
      groups.set(item.objectiveId, group);
    });

    return Array.from(groups.entries())
      .map(([objectiveId, group]) => {
        const sorted = sortEligibleItems(group.items);
        const items = [
          ...sorted.filter((item) => selectedIds.has(item.id)),
          ...sorted.filter((item) => !selectedIds.has(item.id)),
        ];
        return { objectiveId, objectiveTitle: group.objectiveTitle, items };
      })
      .sort((left, right) => {
        const leftIsPrioritized = prioritizedObjectiveIds.has(left.objectiveId);
        const rightIsPrioritized = prioritizedObjectiveIds.has(right.objectiveId);
        if (leftIsPrioritized !== rightIsPrioritized) {
          return leftIsPrioritized ? -1 : 1;
        }
        return left.objectiveTitle.localeCompare(right.objectiveTitle);
      });
  }, [prioritizedObjectiveIds, visibleItems, form.itemIds]);

  const pickerTotalPages = Math.max(
    1,
    Math.ceil(allGroups.length / OBJECTIVES_PER_PAGE),
  );
  const pickerCurrentPage = Math.min(Math.max(1, pickerPage), pickerTotalPages);

  const groupedVisibleItems = useMemo(
    () =>
      allGroups.slice(
        (pickerCurrentPage - 1) * OBJECTIVES_PER_PAGE,
        pickerCurrentPage * OBJECTIVES_PER_PAGE,
      ),
    [allGroups, pickerCurrentPage],
  );

  const currentSession = useMemo(
    () =>
      currentModuleSessions.find((session) => session.id === selectedSessionId) || null,
    [currentModuleSessions, selectedSessionId],
  );

  const selectedBreakdown = selectionCounts
    .filter((modality) => modality.count > 0)
    .map((modality) => `${modality.label} ×${modality.count}`)
    .join(' · ');

  const canSaveModule = Boolean(moduleForm.title.trim());
  const canSaveSession =
    Boolean(form.title.trim()) &&
    Boolean(form.moduleId) &&
    selectedItems.length > 0;
  const currentModuleSessionCount = currentModuleSessions.length;

  const startNewModule = useCallback(() => {
    setEditorMode('module');
    setIsCreatingSession(false);
    setSelectedModuleId(null);
    setSelectedSessionId(null);
    setObjectivePriorityIds([]);
    setLoadError(null);
    setStatusMessage(null);
    setPickerPage(1);
    setModuleForm(buildEmptyModuleForm(nextModuleDisplayOrder));
    setForm(buildEmptySessionForm(1));
  }, [nextModuleDisplayOrder]);

  const handleSelectModule = useCallback(
    (moduleId: string) => {
      setEditorMode('module');
      setIsCreatingSession(false);
      setSelectedModuleId(moduleId);
      setCollapsedModuleIds((current) => {
        if (!current.has(moduleId)) return current;
        const next = new Set(current);
        next.delete(moduleId);
        return next;
      });
      setLoadError(null);
      setStatusMessage(null);
      setPickerPage(1);
      if (moduleId === UNGROUPED_MODULE_ID) {
        setModuleForm(buildEmptyModuleForm(nextModuleDisplayOrder));
        return;
      }
      const module = realModules.find((candidate) => candidate.id === moduleId);
      if (module) {
        setModuleForm(moduleToForm(module));
      }
    },
    [nextModuleDisplayOrder, realModules],
  );

  const startNewSessionInModule = useCallback(
    (moduleId: string) => {
      if (!moduleId || moduleId === UNGROUPED_MODULE_ID) return;
      setEditorMode('session');
      setSelectedModuleId(moduleId);
      setIsCreatingSession(true);
      setObjectivePriorityIds([]);
      setSelectedSessionId(null);
      setLoadError(null);
      setStatusMessage(null);
      setPickerPage(1);
      setForm(buildEmptySessionForm(getNextSessionDisplayOrder(moduleId), moduleId));
    },
    [getNextSessionDisplayOrder],
  );

  const startNewSession = useCallback(() => {
    const moduleId =
      selectedModuleId && selectedModuleId !== UNGROUPED_MODULE_ID
        ? selectedModuleId
        : realModules[0]?.id || '';
    if (!moduleId) return;
    startNewSessionInModule(moduleId);
  }, [realModules, selectedModuleId, startNewSessionInModule]);

  useEffect(() => {
    if (entryAction !== 'create-session' || isLoading) {
      return;
    }

    if (realModules.length > 0) {
      setLoadError(null);
      startNewSession();
    } else {
      startNewModule();
      setLoadError(null);
      setStatusMessage('Create a module first, then add a session inside it.');
    }

    onEntryActionHandled?.();
  }, [
    entryAction,
    isLoading,
    onEntryActionHandled,
    realModules.length,
    startNewModule,
    startNewSession,
  ]);

  const handleSelectSession = (session: TeacherCourseSession) => {
    setEditorMode('session');
    setIsCreatingSession(false);
    setSelectedModuleId(session.moduleId || UNGROUPED_MODULE_ID);
    setObjectivePriorityIds(collectObjectiveIds(session.items));
    setSelectedSessionId(session.id);
    setLoadError(null);
    setStatusMessage(null);
    setPickerPage(1);
    setForm(sessionToForm(session));
  };

  const handleToggleItem = (itemId: string) => {
    setForm((current) => {
      const itemIds = current.itemIds.includes(itemId)
        ? current.itemIds.filter((candidate) => candidate !== itemId)
        : [...current.itemIds, itemId];

      return {
        ...current,
        itemIds,
      };
    });
  };

  const handleToggleGroup = (groupItems: SessionEligibleItem[]) => {
    const ids = groupItems.map((item) => item.id);
    setForm((current) => {
      const allSelected = ids.every((id) => current.itemIds.includes(id));
      const itemIds = allSelected
        ? current.itemIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current.itemIds, ...ids]));
      return { ...current, itemIds };
    });
  };

  const handleClearSelection = () => {
    setForm((current) => ({ ...current, itemIds: [] }));
  };

  const handleSaveModule = async () => {
    const trimmedTitle = moduleForm.title.trim();
    if (!trimmedTitle) {
      setLoadError('Module title is required.');
      return;
    }

    const requestCourseId = course.id;
    const requestId = moduleSaveRequestIdRef.current + 1;
    const wasEditingExistingModule = Boolean(moduleForm.id);
    moduleSaveRequestIdRef.current = requestId;

    setIsSavingModule(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      const saved = await academyStudioBackend.saveCourseModule(course, {
        id: moduleForm.id,
        identifier: moduleForm.identifier,
        title: trimmedTitle,
        displayOrder: moduleForm.displayOrder,
      });

      if (!isCurrentModuleSaveRequest(requestCourseId, requestId)) return;

      setModules((current) => {
        const next = current.some((module) => module.id === saved.id)
          ? current.map((module) => (module.id === saved.id ? saved : module))
          : [...current, saved];
        return sortModules(next);
      });
      setSelectedModuleId(saved.id);
      setModuleForm(moduleToForm(saved));
      setStatusMessage(
        wasEditingExistingModule
          ? 'Course module updated.'
          : 'Course module saved. Add sessions inside it below.',
      );
    } catch (error) {
      console.error('Failed to save course module:', error);
      if (!isCurrentModuleSaveRequest(requestCourseId, requestId)) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to save this course module.',
      );
    } finally {
      if (isCurrentModuleSaveRequest(requestCourseId, requestId)) {
        setIsSavingModule(false);
      }
    }
  };

  const confirmDeleteModule = async () => {
    if (!moduleToDelete) return;

    const deletingModule = moduleToDelete;
    const requestCourseId = course.id;
    const requestId = moduleDeleteRequestIdRef.current + 1;
    moduleDeleteRequestIdRef.current = requestId;

    setIsDeletingModule(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      await academyStudioBackend.deleteCourseModule(course, deletingModule);
      if (!isCurrentModuleDeleteRequest(requestCourseId, requestId)) return;

      const nextModules = sortModules(
        modules.filter((module) => module.id !== deletingModule.id),
      );
      const fallbackModuleId =
        nextModules[0]?.id ||
        (sessions.some((session) => !session.moduleId) ? UNGROUPED_MODULE_ID : null);

      setModules(nextModules);
      setSelectedModuleId(fallbackModuleId);
      setModuleForm(
        fallbackModuleId && fallbackModuleId !== UNGROUPED_MODULE_ID
          ? moduleToForm(nextModules.find((module) => module.id === fallbackModuleId)!)
          : buildEmptyModuleForm(
              nextModules.reduce(
                (maxOrder, module) => Math.max(maxOrder, module.displayOrder),
                0,
              ) + 1,
            ),
      );
      setModuleToDelete(null);
      setStatusMessage('Course module deleted.');
    } catch (error) {
      console.error('Failed to delete course module:', error);
      if (!isCurrentModuleDeleteRequest(requestCourseId, requestId)) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to delete this course module.',
      );
    } finally {
      if (isCurrentModuleDeleteRequest(requestCourseId, requestId)) {
        setIsDeletingModule(false);
      }
    }
  };

  const handleSaveSession = async () => {
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setLoadError('Session title is required.');
      return;
    }
    if (!form.moduleId) {
      setLoadError('Select a module before saving this session.');
      return;
    }
    if (selectedItems.length === 0) {
      setLoadError('Select at least one item before saving this session.');
      return;
    }

    const requestCourseId = course.id;
    const requestId = sessionSaveRequestIdRef.current + 1;
    const wasEditingExistingSession = Boolean(form.id);
    sessionSaveRequestIdRef.current = requestId;

    setIsSavingSession(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      const saved = await academyStudioBackend.saveCourseSession(course, {
        id: form.id,
        identifier: form.identifier,
        moduleId: form.moduleId,
        title: trimmedTitle,
        displayOrder: form.displayOrder,
        scheduledDate: form.scheduledDate,
        items: selectedItems,
      });

      if (!isCurrentSessionSaveRequest(requestCourseId, requestId)) return;

      setSessions((current) => {
        const next = current.some((session) => session.id === saved.id)
          ? current.map((session) => (session.id === saved.id ? saved : session))
          : [...current, saved];
        return sortSessions(next);
      });
      setIsCreatingSession(false);
      setSelectedModuleId(saved.moduleId || UNGROUPED_MODULE_ID);
      setSelectedSessionId(saved.id);
      setForm(sessionToForm(saved));
      setStatusMessage(
        wasEditingExistingSession
          ? 'Session updated.'
          : 'Session saved inside its module.',
      );
    } catch (error) {
      console.error('Failed to save course session:', error);
      if (!isCurrentSessionSaveRequest(requestCourseId, requestId)) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to save this session.',
      );
    } finally {
      if (isCurrentSessionSaveRequest(requestCourseId, requestId)) {
        setIsSavingSession(false);
      }
    }
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    const deletingSession = sessionToDelete;
    const requestCourseId = course.id;
    const requestId = sessionDeleteRequestIdRef.current + 1;
    sessionDeleteRequestIdRef.current = requestId;

    setIsDeletingSession(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      await academyStudioBackend.deleteCourseSession(course, deletingSession);
      if (!isCurrentSessionDeleteRequest(requestCourseId, requestId)) return;

      setSessions((current) =>
        sortSessions(
          current.filter((session) => session.id !== deletingSession.id),
        ),
      );
      setSessionToDelete(null);
      setStatusMessage('Session deleted.');
    } catch (error) {
      console.error('Failed to delete course session:', error);
      if (!isCurrentSessionDeleteRequest(requestCourseId, requestId)) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to delete this session.',
      );
    } finally {
      if (isCurrentSessionDeleteRequest(requestCourseId, requestId)) {
        setIsDeletingSession(false);
      }
    }
  };

  if (course.learningObjectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
          <Layers size={22} />
        </div>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
          Add objectives first
        </p>
        <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
          Modules can only contain items linked through this course&apos;s learning
          objectives.
        </p>
      </div>
    );
  }

  const editorPane =
    editorMode === 'module' ? (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionLabel>{currentModule ? 'Edit module' : 'New module'}</SectionLabel>
            <h3 className="mt-1 truncate text-xl font-black tracking-tight text-slate-900">
              {currentModule ? currentModule.title : 'Create a module'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Modules group sessions into the structure learners see first.
            </p>
          </div>
          {currentModule ? (
            <button
              type="button"
              onClick={() => setModuleToDelete(currentModule)}
              disabled={currentModuleSessionCount > 0}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          ) : null}
        </div>

        {selectedModuleId === UNGROUPED_MODULE_ID ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            Legacy sessions without module assignments live here. Create a module,
            then re-save each ungrouped session into its new module.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block min-w-0">
                <SectionLabel>Module title</SectionLabel>
                <input
                  value={moduleForm.title}
                  onChange={(event) =>
                    setModuleForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Cardiovascular foundations"
                  className={`mt-2 ${inputClass}`}
                />
              </label>

              <label className="block min-w-0">
                <SectionLabel>Display order</SectionLabel>
                <input
                  type="number"
                  min={0}
                  value={moduleForm.displayOrder}
                  onChange={(event) =>
                    setModuleForm((current) => ({
                      ...current,
                      displayOrder: Number(event.target.value || 0),
                    }))
                  }
                  className={`mt-2 ${inputClass}`}
                />
              </label>
            </div>

            {currentModule && currentModuleSessionCount > 0 && (
              <p className="text-xs font-medium text-slate-500">
                Move or delete this module&apos;s {currentModuleSessionCount} session
                {currentModuleSessionCount === 1 ? '' : 's'} before deleting the
                module itself.
              </p>
            )}
          </>
        )}
      </div>
    ) : (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionLabel>
              {currentSession ? 'Edit session' : 'New session'}
            </SectionLabel>
            <h3 className="mt-1 truncate text-xl font-black tracking-tight text-slate-900">
              {currentSession ? currentSession.title : 'Create a session'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Each session belongs to a module and needs at least one
              course-linked item.
            </p>
          </div>
          {currentSession ? (
            <button
              type="button"
              onClick={() => setSessionToDelete(currentSession)}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-600 transition hover:bg-rose-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          <label className="block min-w-0">
            <SectionLabel>Module</SectionLabel>
            <select
              value={form.moduleId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  moduleId: event.target.value,
                }))
              }
              className={`mt-2 ${inputClass}`}
            >
              <option value="">Select a module</option>
              {realModules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.displayOrder}. {module.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <SectionLabel>Title</SectionLabel>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="e.g. Week 1 mixed review"
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <SectionLabel>Display order</SectionLabel>
              <input
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayOrder: Number(event.target.value || 0),
                  }))
                }
                className={`mt-2 ${inputClass}`}
              />
            </label>

            <label className="block min-w-0">
              <SectionLabel>Release date</SectionLabel>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduledDate: event.target.value,
                  }))
                }
                className={`mt-2 ${inputClass}`}
              />
            </label>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <SectionLabel>Course items</SectionLabel>
              <p className="mt-1 text-sm text-slate-500">
                Pick any mix of items linked to this course.
              </p>
            </div>
            <label className="relative block w-full sm:w-72">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search items or objectives"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15"
              />
            </label>
          </div>

          {selectedItems.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
              <span className="text-slate-900">
                {selectedItems.length} selected
              </span>
              {selectedBreakdown && (
                <span className="text-slate-400">· {selectedBreakdown}</span>
              )}
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-slate-400 transition hover:text-rose-600"
              >
                · Clear
              </button>
            </div>
          )}

          {eligibleItems.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500">
              This course does not have any linked items yet. Create or approve
              content on the Content tab first.
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500">
              No course items match this search.
            </div>
          ) : (
            <>
              <div className="mt-5 space-y-6">
                {groupedVisibleItems.map((group) => {
                  const allSelected = group.items.every((item) =>
                    form.itemIds.includes(item.id),
                  );
                  return (
                    <div key={group.objectiveId} className="min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <HoverTooltip
                          label={group.objectiveTitle}
                          className="block min-w-0 truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-400"
                        >
                          {group.objectiveTitle}
                        </HoverTooltip>
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group.items)}
                          className="inline-flex flex-shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-[#1BD183]"
                        >
                          <CheckCheck size={12} />
                          {allSelected ? 'Clear' : 'Select all'}
                        </button>
                      </div>
                      <div className="grid gap-2 lg:grid-cols-2">
                        {group.items.map((item) => {
                          const modality = modalityByType.get(item.type);
                          const Icon = modality?.icon || Layers;
                          const isSelected = form.itemIds.includes(item.id);

                          return (
                            <label
                              key={item.id}
                              className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${
                                isSelected
                                  ? 'border-[#1BD183] bg-emerald-50/70'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleItem(item.id)}
                                className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-[#1BD183] focus:ring-[#1BD183]"
                              />
                              <span
                                className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${modality?.badge || 'border-slate-200 bg-slate-50 text-slate-500'}`}
                              >
                                <Icon size={15} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <HoverTooltip
                                  label={itemTitle(item)}
                                  className="block truncate text-sm font-bold text-slate-900"
                                >
                                  {itemTitle(item)}
                                </HoverTooltip>
                                <span className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    {formatSessionMode(item.type)}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${STATUS_STYLES[item.status]}`}
                                  >
                                    {item.status}
                                  </span>
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  // Keep the wrapping label from toggling the checkbox.
                                  event.preventDefault();
                                  setPreviewItem(item);
                                }}
                                title="View item details"
                                aria-label="View item details"
                                className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-[#1BD183] hover:text-[#16324F]"
                              >
                                <Maximize2 size={14} />
                              </button>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500">
                  {allGroups.length} objective
                  {allGroups.length === 1 ? '' : 's'}
                  {pickerTotalPages > 1
                    ? ` · page ${pickerCurrentPage} of ${pickerTotalPages}`
                    : ''}
                </p>
                {pickerTotalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPickerPage(Math.max(1, pickerCurrentPage - 1))
                      }
                      disabled={pickerCurrentPage <= 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPickerPage(
                          Math.min(pickerTotalPages, pickerCurrentPage + 1),
                        )
                      }
                      disabled={pickerCurrentPage >= pickerTotalPages}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Compact header: identity + at-a-glance stats + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#16324F] text-white">
            <CalendarClock size={16} />
          </div>
          <div className="min-w-0">
            <SectionLabel>Course modules</SectionLabel>
            <h3 className="truncate text-lg font-black tracking-tight text-slate-900">
              Build the learner-facing outline
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 sm:flex">
            <span className="text-slate-900">{displayedModules.length}</span>
            modules
            <span className="text-slate-300">·</span>
            <span className="text-slate-900">{sessions.length}</span>
            sessions
            <span className="text-slate-300">·</span>
            <span className="text-slate-900">{eligibleItems.length}</span>
            items
          </div>
          <span
            title={
              course.locked
                ? 'Locked course — learners follow the published module flow from this course.'
                : 'Unlocked course — learners see module sessions immediately unless you schedule a release date.'
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
              course.locked
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {course.locked ? <Lock size={13} /> : <Unlock size={13} />}
            {course.locked ? 'Locked' : 'Unlocked'}
          </span>
          <button
            type="button"
            onClick={() => void loadPanelData()}
            disabled={isLoading}
            title="Refresh"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      {(loadError || statusMessage) && (
        <div className="space-y-2 pt-4">
          {loadError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span className="min-w-0">{loadError}</span>
            </div>
          )}
          {statusMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {statusMessage}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm font-semibold text-slate-500">
          <Loader2 size={16} className="mr-2 animate-spin" />
          Loading modules and sessions…
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto pt-4 custom-scrollbar xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-6 xl:overflow-hidden">
          {/* Outline rail (master) */}
          <aside className="flex min-h-0 min-w-0 flex-col xl:overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <SectionLabel>Outline</SectionLabel>
                {outline.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                    {outline.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={startNewModule}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#16324F] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#1B3E62]"
              >
                <Plus size={13} />
                Module
              </button>
            </div>

            {outline.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <ListChecks size={20} />
                </div>
                <p className="mt-4 text-sm font-black text-slate-700">
                  No modules yet
                </p>
                <p className="mt-1.5 max-w-sm text-xs font-medium leading-5 text-slate-500">
                  Create the first module, then add sessions inside it.
                </p>
                <button
                  type="button"
                  onClick={startNewModule}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#16324F] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#1B3E62]"
                >
                  <Plus size={13} />
                  New module
                </button>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2 custom-scrollbar xl:pr-1">
                {outline.map(({ module, sessions: moduleSessions }) => {
                  const isModuleActive =
                    editorMode === 'module' && selectedModuleId === module.id;
                  const isExpanded = !collapsedModuleIds.has(module.id);
                  return (
                    <div
                      key={module.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        isModuleActive
                          ? 'border-[#1BD183] shadow-sm'
                          : 'border-slate-200'
                      }`}
                    >
                      <div
                        className={`flex items-center ${
                          isModuleActive ? 'bg-emerald-50/70' : 'bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleModuleCollapsed(module.id)}
                          aria-label={isExpanded ? 'Collapse module' : 'Expand module'}
                          className="flex flex-shrink-0 items-center self-stretch px-2 text-slate-400 transition hover:text-slate-700"
                        >
                          {isExpanded ? (
                            <ChevronDown size={15} />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectModule(module.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-3 text-left"
                        >
                          <span
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                              isModuleActive
                                ? 'bg-[#1BD183] text-[#06241a]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {Number.isFinite(module.displayOrder) && !module.isVirtual
                              ? module.displayOrder
                              : '•'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-900">
                              {module.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                              {module.sessionCount} session
                              {module.sessionCount === 1 ? '' : 's'}
                              {module.isVirtual ? ' · legacy' : ''}
                            </span>
                          </span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-1 border-t border-slate-100 bg-slate-50/50 p-2">
                          {moduleSessions.length === 0 ? (
                            <p className="px-2 py-2 text-[11px] font-semibold text-slate-400">
                              No sessions yet.
                            </p>
                          ) : (
                            moduleSessions.map((session) => {
                              const isSessionActive =
                                editorMode === 'session' &&
                                selectedSessionId === session.id;
                              return (
                                <button
                                  key={session.id}
                                  type="button"
                                  onClick={() => handleSelectSession(session)}
                                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                                    isSessionActive
                                      ? 'border-[#1BD183] bg-white shadow-sm'
                                      : 'border-transparent bg-white/60 hover:border-slate-200 hover:bg-white'
                                  }`}
                                >
                                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-black text-slate-500">
                                    {session.displayOrder}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-bold text-slate-900">
                                      {session.title}
                                    </span>
                                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                      <span
                                        className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${MODE_STYLES[session.mode]}`}
                                      >
                                        {formatSessionMode(session.mode)}
                                      </span>
                                      <span className="truncate text-[10px] font-semibold text-slate-500">
                                        {session.itemCount} item
                                        {session.itemCount === 1 ? '' : 's'}
                                      </span>
                                    </span>
                                  </span>
                                </button>
                              );
                            })
                          )}

                          {!module.isVirtual && (
                            <button
                              type="button"
                              onClick={() => startNewSessionInModule(module.id)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-[#1BD183] hover:text-[#07895a]"
                            >
                              <Plus size={12} />
                              Add session
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Editor pane (detail) */}
          <section className="mt-6 flex min-h-0 min-w-0 flex-col border-t border-slate-200 pt-6 xl:mt-0 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 xl:overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto pb-4 custom-scrollbar xl:pr-1">
              {editorPane}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              {editorMode === 'module' ? (
                selectedModuleId === UNGROUPED_MODULE_ID ? (
                  <p className="text-xs font-semibold text-slate-500">
                    Legacy queue — re-save these sessions into a real module.
                  </p>
                ) : (
                  <>
                    <p className="min-w-0 text-xs font-semibold text-slate-500">
                      {canSaveModule
                        ? currentModule
                          ? 'Ready to update this module.'
                          : 'Ready to create this module.'
                        : 'Add a title to continue.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveModule}
                      disabled={isSavingModule || !canSaveModule}
                      className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-[#16324F] px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#1B3E62] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSavingModule ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      {currentModule ? 'Save module' : 'Create module'}
                    </button>
                  </>
                )
              ) : (
                <>
                  <p className="min-w-0 text-xs font-semibold text-slate-500">
                    {canSaveSession
                      ? `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} · ${formatSessionMode(selectedMode)}`
                      : !form.moduleId
                        ? 'Pick a module to continue.'
                        : !form.title.trim()
                          ? 'Add a title to continue.'
                          : 'Select at least one item to save.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveSession}
                    disabled={isSavingSession || !canSaveSession}
                    className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-[#16324F] px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#1B3E62] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSavingSession ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {currentSession ? 'Save session' : 'Create session'}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(moduleToDelete)}
        title="Delete module?"
        message={`Remove “${moduleToDelete?.title || 'this module'}”? Its sessions must already be moved or deleted first.`}
        confirmLabel={isDeletingModule ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          if (!isDeletingModule) void confirmDeleteModule();
        }}
        onCancel={() => {
          if (!isDeletingModule) setModuleToDelete(null);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(sessionToDelete)}
        title="Delete session?"
        message={`Remove “${sessionToDelete?.title || 'this session'}” from this module? Existing learner copies will no longer be updated from this teacher session.`}
        confirmLabel={isDeletingSession ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          if (!isDeletingSession) void confirmDeleteSession();
        }}
        onCancel={() => {
          if (!isDeletingSession) setSessionToDelete(null);
        }}
      />

      <SessionItemDetailModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
};

export default CourseModulesPanel;
