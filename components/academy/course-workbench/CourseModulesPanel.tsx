import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
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
import {
  Button,
  ConfirmDialog,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Select,
  Spinner,
  StatusDot,
  cn,
} from '@/components/ui';
import {
  itemTitle,
  MODALITIES,
} from '@/components/academy/course-workbench/ObjectiveItemsList';
import SessionItemDetailModal from '@/components/academy/course-workbench/SessionItemDetailModal';
import {
  CreateWithAIButton,
  ModuleGenerationBanner,
  ModuleGenerationWizard,
  useModuleGenerationLauncher,
} from './module-generation';

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

interface OutlineModule {
  id: string;
  title: string;
  displayOrder: number;
  sessions: TeacherCourseSession[];
  /** The legacy bucket for sessions saved before modules existed. */
  isUngrouped?: boolean;
  source?: TeacherCourseModule;
}

interface PickerGroup {
  objectiveId: string;
  objectiveTitle: string;
  items: SessionEligibleItem[];
  itemTotal: number;
  selectedCount: number;
  isLoading: boolean;
}

type PickerMode = 'selected' | 'browse';

const UNGROUPED_MODULE_ID = '__ungrouped__';
const OBJECTIVES_PER_PAGE = 20;
const ITEMS_PAGE_SIZE = 200;
const ITEM_FETCH_CONCURRENCY = 4;

const STATUS_META: Record<
  BackendApiItem['status'],
  { label: string; tone: 'green' | 'neutral' | 'amber' }
> = {
  live: { label: 'Live', tone: 'green' },
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending review', tone: 'amber' },
};

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

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

const buildEmptySessionForm = (displayOrder: number, moduleId = ''): SessionEditorState => ({
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

const formatSessionMode = (mode: TeacherCourseSessionMode) =>
  mode === 'mcq'
    ? 'MCQ'
    : mode === 'saq'
      ? 'SAQ'
      : mode === 'lecture'
        ? 'Lecture'
        : mode === 'flashcard'
          ? 'Flashcards'
          : 'Mixed';

const formatReleaseDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

const modalityByType = new Map(MODALITIES.map((modality) => [modality.type, modality] as const));

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
  const fetchPage = (page: number) =>
    testsService.getItems(page, ITEMS_PAGE_SIZE, undefined, undefined, undefined, objective.id);

  const firstPage = await fetchPage(1);
  let items = firstPage.items || [];

  if (typeof firstPage.total === 'number') {
    const totalPages = Math.ceil(firstPage.total / ITEMS_PAGE_SIZE);
    for (let page = firstPage.page + 1; page <= totalPages; page += 1) {
      items = items.concat((await fetchPage(page)).items || []);
    }
  } else {
    let lastPageItems = firstPage.items || [];
    let nextPage = firstPage.page + 1;
    while (lastPageItems.length === ITEMS_PAGE_SIZE) {
      lastPageItems = (await fetchPage(nextPage)).items || [];
      if (lastPageItems.length === 0) break;
      items = items.concat(lastPageItems);
      nextPage += 1;
    }
  }

  return items.map((item) => ({
    ...item,
    objectiveId: objective.id,
    objectiveTitle: objective.title,
  }));
};

const listObjectiveItemsInBatches = async (
  objectives: TeacherCourse['learningObjectives'],
): Promise<SessionEligibleItem[]> => {
  const items: SessionEligibleItem[] = [];
  for (let index = 0; index < objectives.length; index += ITEM_FETCH_CONCURRENCY) {
    const chunk = objectives.slice(index, index + ITEM_FETCH_CONCURRENCY);
    const chunkItems = await Promise.all(chunk.map((objective) => listObjectiveItems(objective)));
    items.push(...chunkItems.flat());
  }
  return items;
};

const sortEligibleItems = (items: SessionEligibleItem[]) =>
  [...items].sort((left, right) => {
    if (left.objectiveTitle !== right.objectiveTitle) {
      return left.objectiveTitle.localeCompare(right.objectiveTitle);
    }
    const leftTitle = itemTitle(left);
    const rightTitle = itemTitle(right);
    if (leftTitle !== rightTitle) return leftTitle.localeCompare(rightTitle);
    return left.id.localeCompare(right.id);
  });

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Icon tile for a session's delivery mode. */
const ModeIcon: React.FC<{ mode: TeacherCourseSessionMode }> = ({ mode }) => {
  const modality = mode === 'mixed' ? null : modalityByType.get(mode);
  const Icon = modality?.icon ?? Layers;
  return (
    <span
      className={cn(
        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border',
        modality?.badge ?? 'border-stone-200 bg-stone-50 text-stone-500',
      )}
      aria-hidden="true"
    >
      <Icon size={14} />
    </span>
  );
};

/**
 * The course outline — modules and their sessions, in the order learners see
 * them. The outline is the page; a session opens in a drawer to edit its
 * details and pick its items, and modules are created/renamed in a dialog.
 */
const CourseModulesPanel: React.FC<CourseModulesPanelProps> = ({
  course,
  entryAction = null,
  onEntryActionHandled,
}) => {
  // --- Outline data ------------------------------------------------------------
  const [modules, setModules] = useState<TeacherCourseModule[]>([]);
  const [sessions, setSessions] = useState<TeacherCourseSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const activeCourseIdRef = useRef(course.id);
  const loadRequestIdRef = useRef(0);
  activeCourseIdRef.current = course.id;

  // --- Module dialog ----------------------------------------------------------------
  const [moduleDialog, setModuleDialog] = useState<{ module: TeacherCourseModule | null } | null>(
    null,
  );
  const [moduleForm, setModuleForm] = useState<ModuleEditorState>({ title: '', displayOrder: 1 });
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleToDelete, setModuleToDelete] = useState<TeacherCourseModule | null>(null);
  const [isDeletingModule, setIsDeletingModule] = useState(false);

  // --- Session drawer ---------------------------------------------------------------
  // `null` = closed; `{ session: null }` = creating a new session.
  const [drawer, setDrawer] = useState<{ session: TeacherCourseSession | null } | null>(null);
  const [form, setForm] = useState<SessionEditorState>(buildEmptySessionForm(1));
  const [pickerMode, setPickerMode] = useState<PickerMode>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const [pickerPage, setPickerPage] = useState(1);
  const [objectivePriorityIds, setObjectivePriorityIds] = useState<string[]>([]);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<TeacherCourseSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [previewItem, setPreviewItem] = useState<SessionEligibleItem | null>(null);

  // --- Picker item cache (lazy, per objective) --------------------------------------
  const [eligibleItems, setEligibleItems] = useState<SessionEligibleItem[]>([]);
  const [loadedObjectiveIds, setLoadedObjectiveIds] = useState<Set<string>>(() => new Set());
  const [loadingObjectiveIds, setLoadingObjectiveIds] = useState<Set<string>>(() => new Set());
  // Tracked in a ref so the lazy-load effect can re-run without re-issuing requests.
  const inFlightObjectiveIdsRef = useRef<Set<string>>(new Set());

  const orderedModules = useMemo(() => sortModules(modules), [modules]);

  const objectiveById = useMemo(
    () => new Map(course.learningObjectives.map((objective) => [objective.id, objective] as const)),
    [course.learningObjectives],
  );

  const flash = useCallback((text: string) => {
    setToast(text);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /** Session items are known up front, so selected items render before any fetch. */
  const mergeEligibleItems = useCallback(
    (loadedSessions: TeacherCourseSession[], fetchedItems: SessionEligibleItem[]) => {
      const byId = new Map(fetchedItems.map((item) => [item.id, item] as const));
      loadedSessions.forEach((session) => {
        session.items.forEach((item) => {
          if (byId.has(item.id)) return;
          byId.set(item.id, {
            ...item,
            objectiveId: item.learningObjectiveId || '',
            objectiveTitle:
              objectiveById.get(item.learningObjectiveId || '')?.title || 'Course item',
          });
        });
      });
      return sortEligibleItems(Array.from(byId.values()));
    },
    [objectiveById],
  );

  const loadPanelData = useCallback(async () => {
    const requestCourseId = course.id;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const isCurrent = () =>
      activeCourseIdRef.current === requestCourseId && loadRequestIdRef.current === requestId;

    setIsLoading(true);
    setLoadError(null);
    try {
      const [loadedModules, loadedSessions] = await Promise.all([
        academyStudioBackend.listCourseModules(course),
        academyStudioBackend.listCourseSessions(course),
      ]);
      if (!isCurrent()) return;
      setModules(sortModules(loadedModules));
      setSessions(sortSessions(loadedSessions));
      setEligibleItems((current) => mergeEligibleItems(loadedSessions, current));
    } catch (error) {
      console.error('Failed to load course modules:', error);
      if (!isCurrent()) return;
      setLoadError(errorMessage(error, 'Unable to load the modules for this course.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [course, mergeEligibleItems]);

  const moduleGeneration = useModuleGenerationLauncher(course, loadPanelData);

  // Reset everything when switching courses.
  useEffect(() => {
    loadRequestIdRef.current += 1;
    inFlightObjectiveIdsRef.current = new Set();
    setModules([]);
    setSessions([]);
    setEligibleItems([]);
    setLoadedObjectiveIds(new Set());
    setLoadingObjectiveIds(new Set());
    setCollapsedModuleIds(new Set());
    setDrawer(null);
    setModuleDialog(null);
    setModuleToDelete(null);
    setSessionToDelete(null);
    setLoadError(null);
    setIsLoading(true);
  }, [course.id]);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

  // --- Outline ----------------------------------------------------------------------
  const outline = useMemo<OutlineModule[]>(() => {
    const byModule = new Map<string, TeacherCourseSession[]>();
    sessions.forEach((session) => {
      const key = session.moduleId || UNGROUPED_MODULE_ID;
      byModule.set(key, [...(byModule.get(key) || []), session]);
    });
    const rows: OutlineModule[] = orderedModules.map((module) => ({
      id: module.id,
      title: module.title,
      displayOrder: module.displayOrder,
      sessions: sortSessions(byModule.get(module.id) || []),
      source: module,
    }));
    const ungrouped = byModule.get(UNGROUPED_MODULE_ID);
    if (ungrouped?.length) {
      rows.push({
        id: UNGROUPED_MODULE_ID,
        title: 'Ungrouped sessions',
        displayOrder: Number.MAX_SAFE_INTEGER,
        sessions: sortSessions(ungrouped),
        isUngrouped: true,
      });
    }
    return rows;
  }, [orderedModules, sessions]);

  const nextModuleOrder =
    orderedModules.reduce((max, module) => Math.max(max, module.displayOrder), 0) + 1;

  const nextSessionOrder = useCallback(
    (moduleId: string) =>
      sessions
        .filter((session) => (session.moduleId || '') === moduleId)
        .reduce((max, session) => Math.max(max, session.displayOrder), 0) + 1,
    [sessions],
  );

  const toggleModule = (moduleId: string) =>
    setCollapsedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });

  const allCollapsed =
    outline.length > 0 && outline.every((module) => collapsedModuleIds.has(module.id));

  // --- Module dialog actions ---------------------------------------------------------
  const openNewModule = useCallback(() => {
    setModuleError(null);
    setModuleForm({ title: '', displayOrder: nextModuleOrder });
    setModuleDialog({ module: null });
  }, [nextModuleOrder]);

  const openRenameModule = (module: TeacherCourseModule) => {
    setModuleError(null);
    setModuleForm({
      id: module.id,
      identifier: module.identifier,
      title: module.title,
      displayOrder: module.displayOrder,
    });
    setModuleDialog({ module });
  };

  const saveModule = async () => {
    const title = moduleForm.title.trim();
    if (!title || isSavingModule) return;
    const requestCourseId = course.id;
    const isEditing = Boolean(moduleForm.id);
    setIsSavingModule(true);
    setModuleError(null);
    try {
      const saved = await academyStudioBackend.saveCourseModule(course, {
        id: moduleForm.id,
        identifier: moduleForm.identifier,
        title,
        displayOrder: moduleForm.displayOrder,
      });
      if (activeCourseIdRef.current !== requestCourseId) return;
      setModules((current) =>
        sortModules(
          current.some((module) => module.id === saved.id)
            ? current.map((module) => (module.id === saved.id ? saved : module))
            : [...current, saved],
        ),
      );
      setModuleDialog(null);
      flash(isEditing ? 'Module saved.' : 'Module created — add its first session.');
    } catch (error) {
      console.error('Failed to save course module:', error);
      setModuleError(errorMessage(error, 'Unable to save this module.'));
    } finally {
      setIsSavingModule(false);
    }
  };

  const confirmDeleteModule = async () => {
    if (!moduleToDelete) return;
    const deleting = moduleToDelete;
    setIsDeletingModule(true);
    try {
      await academyStudioBackend.deleteCourseModule(course, deleting);
      setModules((current) => current.filter((module) => module.id !== deleting.id));
      setModuleToDelete(null);
      flash('Module deleted.');
    } catch (error) {
      console.error('Failed to delete course module:', error);
      setModuleToDelete(null);
      setLoadError(errorMessage(error, 'Unable to delete this module.'));
    } finally {
      setIsDeletingModule(false);
    }
  };

  // --- Session drawer actions ----------------------------------------------------------
  const openSession = (session: TeacherCourseSession) => {
    setSessionError(null);
    setSearchQuery('');
    setPickerPage(1);
    setPickerMode(session.items.length > 0 ? 'selected' : 'browse');
    setObjectivePriorityIds(collectObjectiveIds(session.items));
    setForm(sessionToForm(session));
    setDrawer({ session });
  };

  const openNewSession = useCallback(
    (moduleId: string) => {
      setSessionError(null);
      setSearchQuery('');
      setPickerPage(1);
      setPickerMode('browse');
      setObjectivePriorityIds([]);
      setForm(buildEmptySessionForm(nextSessionOrder(moduleId), moduleId));
      setDrawer({ session: null });
    },
    [nextSessionOrder],
  );

  const editingSession = drawer?.session ?? null;

  const isSessionDirty = useMemo(() => {
    if (!drawer) return false;
    if (!editingSession) return Boolean(form.title.trim()) || form.itemIds.length > 0;
    if (
      form.title.trim() !== editingSession.title ||
      form.moduleId !== editingSession.moduleId ||
      form.displayOrder !== editingSession.displayOrder ||
      form.scheduledDate !== editingSession.scheduledDate
    ) {
      return true;
    }
    const savedIds = new Set(editingSession.items.map((item) => item.id));
    return savedIds.size !== form.itemIds.length || form.itemIds.some((id) => !savedIds.has(id));
  }, [drawer, editingSession, form]);

  const requestCloseDrawer = () => {
    if (isSavingSession) return;
    if (isSessionDirty) {
      setIsConfirmingDiscard(true);
      return;
    }
    setDrawer(null);
  };

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

  const canSaveSession =
    Boolean(form.title.trim()) && Boolean(form.moduleId) && selectedItems.length > 0;

  const saveSession = async () => {
    if (!canSaveSession || isSavingSession) return;
    const requestCourseId = course.id;
    const isEditing = Boolean(form.id);
    setIsSavingSession(true);
    setSessionError(null);
    try {
      const saved = await academyStudioBackend.saveCourseSession(course, {
        id: form.id,
        identifier: form.identifier,
        moduleId: form.moduleId,
        title: form.title.trim(),
        displayOrder: form.displayOrder,
        scheduledDate: form.scheduledDate,
        items: selectedItems,
      });
      if (activeCourseIdRef.current !== requestCourseId) return;
      setSessions((current) =>
        sortSessions(
          current.some((session) => session.id === saved.id)
            ? current.map((session) => (session.id === saved.id ? saved : session))
            : [...current, saved],
        ),
      );
      setCollapsedModuleIds((current) => {
        if (!current.has(saved.moduleId)) return current;
        const next = new Set(current);
        next.delete(saved.moduleId);
        return next;
      });
      setDrawer(null);
      flash(isEditing ? 'Session saved.' : 'Session created.');
    } catch (error) {
      console.error('Failed to save course session:', error);
      setSessionError(errorMessage(error, 'Unable to save this session.'));
    } finally {
      setIsSavingSession(false);
    }
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const deleting = sessionToDelete;
    setIsDeletingSession(true);
    try {
      await academyStudioBackend.deleteCourseSession(course, deleting);
      setSessions((current) => current.filter((session) => session.id !== deleting.id));
      setSessionToDelete(null);
      setDrawer(null);
      flash('Session deleted.');
    } catch (error) {
      console.error('Failed to delete course session:', error);
      setSessionToDelete(null);
      setSessionError(errorMessage(error, 'Unable to delete this session.'));
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Arriving from Content's "Create session": start a session in the first module.
  useEffect(() => {
    if (entryAction !== 'create-session' || isLoading) return;
    if (orderedModules.length > 0) {
      openNewSession(orderedModules[0].id);
    } else {
      openNewModule();
      flash('Create a module first, then add sessions to it.');
    }
    onEntryActionHandled?.();
  }, [
    entryAction,
    flash,
    isLoading,
    onEntryActionHandled,
    openNewModule,
    openNewSession,
    orderedModules,
  ]);

  // --- Item picker ------------------------------------------------------------------------
  const eligibleItemsByObjective = useMemo(() => {
    const byObjective = new Map<string, SessionEligibleItem[]>();
    eligibleItems.forEach((item) => {
      byObjective.set(item.objectiveId, [...(byObjective.get(item.objectiveId) || []), item]);
    });
    return byObjective;
  }, [eligibleItems]);

  const sessionObjectiveIds = useMemo(
    () => new Set(collectObjectiveIds(sessions.flatMap((session) => session.items))),
    [sessions],
  );

  const availableObjectives = useMemo(
    () =>
      course.learningObjectives.filter(
        (objective) =>
          (objective.itemTotals?.total ?? 0) > 0 || sessionObjectiveIds.has(objective.id),
      ),
    [course.learningObjectives, sessionObjectiveIds],
  );

  const availableItemTotal = useMemo(
    () =>
      Math.max(
        availableObjectives.reduce(
          (total, objective) => total + (objective.itemTotals?.total ?? 0),
          0,
        ),
        eligibleItems.length,
      ),
    [availableObjectives, eligibleItems.length],
  );

  const pickerGroups = useMemo<PickerGroup[]>(() => {
    const selectedIds = new Set(form.itemIds);
    const prioritized = new Set(objectivePriorityIds);
    const showSelectedOnly = pickerMode === 'selected';

    return availableObjectives
      .map((objective): PickerGroup | null => {
        const loaded = sortEligibleItems(eligibleItemsByObjective.get(objective.id) || []);
        const selectedCount = loaded.filter((item) => selectedIds.has(item.id)).length;
        if (showSelectedOnly && selectedCount === 0) return null;
        const scoped = showSelectedOnly
          ? loaded.filter((item) => selectedIds.has(item.id))
          : loaded;

        const objectiveMatches =
          !deferredSearch ||
          [objective.title, objective.organSystem]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(deferredSearch);
        const items = objectiveMatches
          ? scoped
          : scoped.filter((item) =>
              [itemTitle(item), item.identifier, item.type, item.status]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(deferredSearch),
            );
        if (deferredSearch && !objectiveMatches && items.length === 0) return null;

        return {
          objectiveId: objective.id,
          objectiveTitle: objective.title,
          items: [
            ...items.filter((item) => selectedIds.has(item.id)),
            ...items.filter((item) => !selectedIds.has(item.id)),
          ],
          itemTotal: objective.itemTotals?.total ?? loaded.length,
          selectedCount,
          isLoading: !showSelectedOnly && loadingObjectiveIds.has(objective.id),
        };
      })
      .filter((group): group is PickerGroup => Boolean(group))
      .sort((left, right) => {
        const leftFirst = prioritized.has(left.objectiveId);
        const rightFirst = prioritized.has(right.objectiveId);
        if (leftFirst !== rightFirst) return leftFirst ? -1 : 1;
        return left.objectiveTitle.localeCompare(right.objectiveTitle);
      });
  }, [
    availableObjectives,
    deferredSearch,
    eligibleItemsByObjective,
    form.itemIds,
    loadingObjectiveIds,
    objectivePriorityIds,
    pickerMode,
  ]);

  useEffect(() => {
    setPickerPage(1);
  }, [deferredSearch, pickerMode]);

  const pickerTotalPages = Math.max(1, Math.ceil(pickerGroups.length / OBJECTIVES_PER_PAGE));
  const pickerCurrentPage = Math.min(pickerPage, pickerTotalPages);
  const visibleGroups = useMemo(
    () =>
      pickerGroups.slice(
        (pickerCurrentPage - 1) * OBJECTIVES_PER_PAGE,
        pickerCurrentPage * OBJECTIVES_PER_PAGE,
      ),
    [pickerCurrentPage, pickerGroups],
  );

  // Fetch the full item list for objectives the teacher can currently see.
  useEffect(() => {
    if (!drawer) return;
    const toLoad = Array.from(
      new Set([
        ...visibleGroups.map((group) => group.objectiveId),
        ...collectObjectiveIds(selectedItems),
        ...objectivePriorityIds,
      ]),
    ).filter(
      (objectiveId) =>
        objectiveById.has(objectiveId) &&
        !loadedObjectiveIds.has(objectiveId) &&
        !inFlightObjectiveIdsRef.current.has(objectiveId),
    );
    if (toLoad.length === 0) return;

    const requestCourseId = course.id;
    toLoad.forEach((objectiveId) => inFlightObjectiveIdsRef.current.add(objectiveId));
    setLoadingObjectiveIds((current) => new Set([...current, ...toLoad]));

    void listObjectiveItemsInBatches(toLoad.map((objectiveId) => objectiveById.get(objectiveId)!))
      .then((fetched) => {
        if (activeCourseIdRef.current !== requestCourseId) return;
        setEligibleItems((current) => mergeEligibleItems(sessions, [...current, ...fetched]));
        setLoadedObjectiveIds((current) => new Set([...current, ...toLoad]));
      })
      .catch((error) => {
        console.error('Failed to load course items for the session picker:', error);
        if (activeCourseIdRef.current !== requestCourseId) return;
        setSessionError(errorMessage(error, 'Unable to load course items.'));
      })
      .finally(() => {
        toLoad.forEach((objectiveId) => inFlightObjectiveIdsRef.current.delete(objectiveId));
        if (activeCourseIdRef.current !== requestCourseId) return;
        setLoadingObjectiveIds((current) => {
          const next = new Set(current);
          toLoad.forEach((objectiveId) => next.delete(objectiveId));
          return next;
        });
      });
  }, [
    course.id,
    drawer,
    loadedObjectiveIds,
    mergeEligibleItems,
    objectiveById,
    objectivePriorityIds,
    selectedItems,
    sessions,
    visibleGroups,
  ]);

  const toggleItem = (itemId: string) =>
    setForm((current) => ({
      ...current,
      itemIds: current.itemIds.includes(itemId)
        ? current.itemIds.filter((id) => id !== itemId)
        : [...current.itemIds, itemId],
    }));

  const toggleGroup = (items: SessionEligibleItem[]) => {
    const ids = items.map((item) => item.id);
    setForm((current) => {
      const allSelected = ids.every((id) => current.itemIds.includes(id));
      return {
        ...current,
        itemIds: allSelected
          ? current.itemIds.filter((id) => !ids.includes(id))
          : Array.from(new Set([...current.itemIds, ...ids])),
      };
    });
  };

  const selectionBreakdown = MODALITIES.map((modality) => ({
    label: modality.label,
    count: selectedItems.filter((item) => item.type === modality.type).length,
  }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${entry.label}`)
    .join(' · ');

  const drawerHint = !form.moduleId
    ? 'Choose a module.'
    : !form.title.trim()
      ? 'Add a title.'
      : selectedItems.length === 0
        ? 'Select at least one item.'
        : editingSession && !isSessionDirty
          ? 'No changes'
          : `${plural(selectedItems.length, 'item')} selected`;

  // --- Render -------------------------------------------------------------------------------
  if (course.learningObjectives.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Add objectives first"
        description="Sessions are built from items linked to this course's learning objectives."
      />
    );
  }

  const formModule = orderedModules.find((module) => module.id === form.moduleId) ?? null;

  const renderSessionRow = (session: TeacherCourseSession, module: OutlineModule) => (
    <li key={session.id}>
      <button
        type="button"
        onClick={() => openSession(session)}
        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none"
      >
        <span className="w-9 flex-shrink-0 text-right text-xs tabular-nums text-stone-400">
          {module.isUngrouped ? '—' : `${module.displayOrder}.${session.displayOrder}`}
        </span>
        <ModeIcon mode={session.mode} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-stone-900">{session.title}</span>
          <span className="block text-xs text-stone-500">
            {formatSessionMode(session.mode)} · {plural(session.itemCount, 'item')}
          </span>
        </span>
        <span className="hidden flex-shrink-0 items-center gap-1.5 text-[13px] sm:flex">
          {session.scheduledDate ? (
            <span className="inline-flex items-center gap-1.5 text-stone-600">
              <CalendarDays size={14} className="text-stone-400" />
              {formatReleaseDate(session.scheduledDate)}
            </span>
          ) : (
            <span className="text-stone-400">Available now</span>
          )}
        </span>
        <ChevronRight
          size={16}
          className="flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
        />
      </button>
    </li>
  );

  const renderModule = (module: OutlineModule) => {
    const isCollapsed = collapsedModuleIds.has(module.id);
    const itemCount = module.sessions.reduce((total, session) => total + session.itemCount, 0);
    const source = module.source;

    return (
      <section
        key={module.id}
        aria-label={module.title}
        className={cn(
          'overflow-hidden rounded-xl border bg-white shadow-card',
          module.isUngrouped ? 'border-amber-200' : 'border-stone-200',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 py-2 pl-2 pr-3',
            module.isUngrouped && 'bg-amber-50/60',
          )}
        >
          <button
            type="button"
            onClick={() => toggleModule(module.id)}
            aria-expanded={!isCollapsed}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-stone-50"
          >
            <ChevronDown
              size={16}
              className={cn(
                'flex-shrink-0 text-stone-400 transition-transform',
                isCollapsed && '-rotate-90',
              )}
            />
            {!module.isUngrouped && (
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-[13px] font-semibold tabular-nums text-stone-600">
                {module.displayOrder}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] font-semibold leading-6 text-stone-900">
                {module.title}
              </span>
              <span className="block text-xs text-stone-500">
                {plural(module.sessions.length, 'session')}
                {itemCount > 0 && ` · ${plural(itemCount, 'item')}`}
              </span>
            </span>
          </button>
          {source && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => openNewSession(source.id)}
                className="hidden sm:inline-flex"
              >
                Add session
              </Button>
              <Menu
                size="sm"
                label={`Actions for ${module.title}`}
                items={[
                  { label: 'Add session', icon: Plus, onSelect: () => openNewSession(source.id) },
                  { label: 'Rename', icon: Pencil, onSelect: () => openRenameModule(source) },
                  {
                    label: 'Delete module',
                    icon: Trash2,
                    tone: 'danger',
                    disabled: module.sessions.length > 0,
                    hint:
                      module.sessions.length > 0
                        ? 'Move or delete its sessions first'
                        : undefined,
                    onSelect: () => setModuleToDelete(source),
                  },
                ]}
              />
            </>
          )}
        </div>

        {!isCollapsed &&
          (module.isUngrouped ? (
            <>
              <p className="border-t border-amber-200/70 bg-amber-50/60 px-4 pb-3 text-[13px] text-amber-900">
                These sessions were created before modules existed. Open each one and choose a
                module for it.
              </p>
              <ol className="divide-y divide-stone-100 border-t border-stone-100">
                {module.sessions.map((session) => renderSessionRow(session, module))}
              </ol>
            </>
          ) : module.sessions.length === 0 ? (
            <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-3 text-[13px] text-stone-500">
              No sessions yet.
              <button
                type="button"
                onClick={() => source && openNewSession(source.id)}
                className="font-medium text-stone-800 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-500"
              >
                Add the first session
              </button>
            </div>
          ) : (
            <ol className="divide-y divide-stone-100 border-t border-stone-100">
              {module.sessions.map((session) => renderSessionRow(session, module))}
            </ol>
          ))}
      </section>
    );
  };

  const renderPicker = () => {
    if (availableItemTotal === 0) {
      return (
        <EmptyState
          compact
          icon={Layers}
          title="No content to add yet"
          description="Create or approve items on the Content tab, then come back to add them to sessions."
        />
      );
    }
    if (pickerGroups.length === 0) {
      return (
        <EmptyState
          compact
          icon={Layers}
          title={pickerMode === 'selected' ? 'No items in this session yet' : 'No items match'}
          description={
            pickerMode === 'selected'
              ? 'Browse the course items and tick the ones learners should work through.'
              : 'Try a different search.'
          }
          action={
            pickerMode === 'selected' ? (
              <Button variant="secondary" size="sm" onClick={() => setPickerMode('browse')}>
                Browse items
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <>
        <div className="space-y-4">
          {visibleGroups.map((group) => {
            const allSelected =
              group.items.length > 0 &&
              group.items.every((item) => form.itemIds.includes(item.id));
            return (
              <div key={group.objectiveId} className="rounded-xl border border-stone-200">
                <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-2.5">
                  <p
                    title={group.objectiveTitle}
                    className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-5 text-stone-700"
                  >
                    {group.objectiveTitle}
                  </p>
                  <span
                    className={cn(
                      'mt-0.5 flex-shrink-0 text-xs tabular-nums',
                      group.selectedCount > 0 ? 'font-medium text-brand-700' : 'text-stone-400',
                    )}
                    title={`${group.selectedCount} of ${group.itemTotal} selected`}
                  >
                    {group.selectedCount}/{group.itemTotal}
                  </span>
                  {pickerMode === 'browse' && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.items)}
                      disabled={group.items.length === 0 || group.isLoading}
                      className="mt-0.5 flex-shrink-0 text-xs font-medium text-stone-600 underline decoration-stone-300 underline-offset-2 transition hover:text-stone-900 disabled:text-stone-300 disabled:no-underline"
                    >
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                {group.isLoading ? (
                  <Spinner label="Loading items…" className="justify-start px-4 py-3" />
                ) : group.items.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-stone-500">No items match the search.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {group.items.map((item) => {
                      const modality = modalityByType.get(item.type);
                      const Icon = modality?.icon ?? Layers;
                      const isSelected = form.itemIds.includes(item.id);
                      const status = STATUS_META[item.status] ?? {
                        label: item.status,
                        tone: 'neutral' as const,
                      };
                      return (
                        <li key={item.id} className="flex items-start">
                          <label
                            className={cn(
                              'flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-2.5 pl-4 pr-2 transition-colors',
                              isSelected ? 'bg-brand-50/50' : 'hover:bg-stone-50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleItem(item.id)}
                              className="mt-1 h-4 w-4 flex-shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span
                              className={cn(
                                'mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border',
                                modality?.badge ?? 'border-stone-200 bg-stone-50 text-stone-500',
                              )}
                            >
                              <Icon size={13} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-sm leading-5 text-stone-800">
                                {itemTitle(item)}
                              </span>
                              <span className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                                {modality?.label ?? item.type}
                                <StatusDot tone={status.tone}>{status.label}</StatusDot>
                              </span>
                            </span>
                          </label>
                          <IconButton
                            icon={Eye}
                            label="Preview item"
                            size="sm"
                            className="mr-2 mt-2"
                            onClick={() => setPreviewItem(item)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {pickerTotalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-[13px] text-stone-500">
            <span>
              Objectives {(pickerCurrentPage - 1) * OBJECTIVES_PER_PAGE + 1}–
              {Math.min(pickerCurrentPage * OBJECTIVES_PER_PAGE, pickerGroups.length)} of{' '}
              {pickerGroups.length}
            </span>
            <div className="flex gap-1">
              <IconButton
                icon={ChevronLeft}
                label="Previous page"
                size="sm"
                disabled={pickerCurrentPage <= 1}
                onClick={() => setPickerPage(pickerCurrentPage - 1)}
              />
              <IconButton
                icon={ChevronRight}
                label="Next page"
                size="sm"
                disabled={pickerCurrentPage >= pickerTotalPages}
                onClick={() => setPickerPage(pickerCurrentPage + 1)}
              />
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Modules"
        meta={
          !isLoading && (
            <span className="text-[13px] tabular-nums text-stone-500">
              {plural(orderedModules.length, 'module')} · {plural(sessions.length, 'session')}
            </span>
          )
        }
        description="The outline learners follow, in order. Open a session to choose its items and release date."
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Reload outline"
              onClick={() => void loadPanelData()}
              disabled={isLoading}
              className={isLoading ? '[&_svg]:animate-spin' : undefined}
            />
            <CreateWithAIButton {...moduleGeneration.buttonProps} />
            <Button variant="primary" icon={Plus} onClick={openNewModule}>
              New module
            </Button>
          </>
        }
      />

      {loadError && <InlineAlert onDismiss={() => setLoadError(null)}>{loadError}</InlineAlert>}

      <ModuleGenerationBanner {...moduleGeneration.bannerProps} />

      {isLoading && outline.length === 0 ? (
        <Spinner label="Loading the outline…" className="py-24" />
      ) : outline.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={Layers}
            title="No modules yet"
            description="Modules group sessions into the outline learners follow — e.g. one module per organ system or week."
            action={
              <>
                <Button variant="primary" icon={Plus} onClick={openNewModule}>
                  New module
                </Button>
                <CreateWithAIButton {...moduleGeneration.buttonProps} />
              </>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-stone-500">
              {plural(availableItemTotal, 'item')} available across{' '}
              {plural(availableObjectives.length, 'objective')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCollapsedModuleIds(
                  allCollapsed ? new Set() : new Set(outline.map((module) => module.id)),
                )
              }
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          </div>
          <div className="space-y-3">{outline.map(renderModule)}</div>
          <button
            type="button"
            onClick={openNewModule}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition hover:border-stone-400 hover:bg-stone-50 hover:text-stone-800"
          >
            <Plus size={16} />
            Add module
          </button>
        </>
      )}

      {/* Module create / rename */}
      <Dialog
        open={Boolean(moduleDialog)}
        onClose={() => setModuleDialog(null)}
        dismissible={!isSavingModule}
        title={moduleDialog?.module ? 'Rename module' : 'New module'}
        description={
          moduleDialog?.module
            ? undefined
            : 'Group related sessions — for example one module per organ system or week.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setModuleDialog(null)} disabled={isSavingModule}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void saveModule()}
              disabled={!moduleForm.title.trim()}
              loading={isSavingModule}
            >
              {moduleDialog?.module ? 'Save' : 'Create module'}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveModule();
          }}
          className="space-y-4"
        >
          {moduleError && <InlineAlert>{moduleError}</InlineAlert>}
          <div className="flex gap-3">
            <Field label="Title" className="flex-1">
              {(id) => (
                <Input
                  id={id}
                  value={moduleForm.title}
                  onChange={(event) =>
                    setModuleForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="e.g. Cardiovascular foundations"
                />
              )}
            </Field>
            <Field label="Position" className="w-24">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={moduleForm.displayOrder}
                  onChange={(event) =>
                    setModuleForm((current) => ({
                      ...current,
                      displayOrder: Number(event.target.value || 0),
                    }))
                  }
                />
              )}
            </Field>
          </div>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Dialog>

      {/* Session editor */}
      <Drawer
        open={Boolean(drawer)}
        onClose={requestCloseDrawer}
        dismissible={!isSavingSession && !isConfirmingDiscard}
        width="max-w-3xl"
        title={editingSession ? editingSession.title : 'New session'}
        description={
          formModule ? `Module ${formModule.displayOrder} · ${formModule.title}` : 'No module chosen'
        }
        footer={
          <>
            {editingSession && (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => setSessionToDelete(editingSession)}
                className="-ml-2"
              >
                Delete
              </Button>
            )}
            <span className="ml-auto truncate text-[13px] text-stone-500">{drawerHint}</span>
            <Button variant="ghost" onClick={requestCloseDrawer} disabled={isSavingSession}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void saveSession()}
              disabled={!canSaveSession || (Boolean(editingSession) && !isSessionDirty)}
              loading={isSavingSession}
            >
              {editingSession ? 'Save session' : 'Create session'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 px-6 py-5">
          {sessionError && (
            <InlineAlert onDismiss={() => setSessionError(null)}>{sessionError}</InlineAlert>
          )}
          <Field label="Title">
            {(id) => (
              <Input
                id={id}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="e.g. Week 1 · Mixed review"
                data-autofocus={editingSession ? undefined : true}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-4">
            <Field label="Module" className="min-w-[14rem] flex-1">
              {(id) => (
                <Select
                  id={id}
                  value={form.moduleId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, moduleId: event.target.value }))
                  }
                >
                  <option value="">Choose a module</option>
                  {orderedModules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.displayOrder}. {module.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Position" className="w-24">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayOrder: Number(event.target.value || 0),
                    }))
                  }
                />
              )}
            </Field>
            <Field label="Release date" hint="Optional" className="w-44">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, scheduledDate: event.target.value }))
                  }
                />
              )}
            </Field>
          </div>
          {!course.locked && !form.scheduledDate && (
            <p className="text-xs text-stone-500">
              With no release date, learners can open this session right away.
            </p>
          )}
        </div>

        <div className="sticky top-0 z-10 border-y border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto min-w-0">
              <p className="text-sm font-semibold text-stone-900">Items</p>
              <p className="truncate text-xs text-stone-500">
                {selectedItems.length > 0 ? (
                  <>
                    {selectionBreakdown}
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, itemIds: [] }))}
                      className="ml-2 font-medium text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-red-600"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  'What learners work through in this session'
                )}
              </p>
            </div>
            <SegmentedControl<PickerMode>
              label="Show items"
              size="sm"
              value={pickerMode}
              onChange={setPickerMode}
              options={[
                { value: 'selected', label: 'In session', count: selectedItems.length },
                { value: 'browse', label: 'Browse all' },
              ]}
            />
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search items or objectives"
              className="w-full sm:w-60"
            />
          </div>
        </div>

        <div className="px-6 py-5">{renderPicker()}</div>
      </Drawer>

      <ConfirmDialog
        open={isConfirmingDiscard}
        title="Discard changes?"
        description="Your edits to this session haven't been saved."
        confirmLabel="Discard"
        onConfirm={() => {
          setIsConfirmingDiscard(false);
          setDrawer(null);
        }}
        onCancel={() => setIsConfirmingDiscard(false)}
      />

      <ConfirmDialog
        open={Boolean(moduleToDelete)}
        title="Delete module?"
        description={`“${moduleToDelete?.title ?? ''}” will be removed from the outline.`}
        confirmLabel="Delete module"
        busy={isDeletingModule}
        onConfirm={() => void confirmDeleteModule()}
        onCancel={() => setModuleToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(sessionToDelete)}
        title="Delete session?"
        description={`“${sessionToDelete?.title ?? ''}” will be removed. Learners' existing copies will no longer receive updates from it.`}
        confirmLabel="Delete session"
        busy={isDeletingSession}
        onConfirm={() => void confirmDeleteSession()}
        onCancel={() => setSessionToDelete(null)}
      />

      <SessionItemDetailModal item={previewItem} onClose={() => setPreviewItem(null)} />
      <ModuleGenerationWizard {...moduleGeneration.wizardProps} />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[140] flex -translate-x-1/2 items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
        >
          <CheckCircle2 size={16} className="text-brand-400" />
          {toast}
        </div>
      )}
    </div>
  );
};

export default CourseModulesPanel;
