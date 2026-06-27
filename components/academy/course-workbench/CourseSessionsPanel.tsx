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
  ChevronLeft,
  ChevronRight,
  Layers,
  ListChecks,
  Loader2,
  Lock,
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
  TeacherCourseSession,
  TeacherCourseSessionMode,
} from '@/types/AcademyStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import ConfirmationModal from '@/components/ConfirmationModal';
import {
  itemTitle,
  MODALITIES,
} from '@/components/academy/course-workbench/ObjectiveItemsList';
import { inputClass, SectionLabel, StatTile } from './shared';

interface CourseSessionsPanelProps {
  course: TeacherCourse;
}

interface SessionEligibleItem extends BackendApiItem {
  objectiveId: string;
  objectiveTitle: string;
}

interface SessionEditorState {
  id?: string;
  identifier?: string;
  title: string;
  displayOrder: number;
  scheduledDate: string;
  itemIds: string[];
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

const buildEmptyForm = (displayOrder: number): SessionEditorState => ({
  title: '',
  displayOrder,
  scheduledDate: '',
  itemIds: [],
});

const sessionToForm = (session: TeacherCourseSession): SessionEditorState => ({
  id: session.id,
  identifier: session.identifier,
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

const OBJECTIVES_PER_PAGE = 20;
const ITEMS_PAGE_SIZE = 200;

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

const CourseSessionsPanel: React.FC<CourseSessionsPanelProps> = ({ course }) => {
  const [sessions, setSessions] = useState<TeacherCourseSession[]>([]);
  const [eligibleItems, setEligibleItems] = useState<SessionEligibleItem[]>([]);
  const [form, setForm] = useState<SessionEditorState>(buildEmptyForm(1));
  const [objectivePriorityIds, setObjectivePriorityIds] = useState<string[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<TeacherCourseSession | null>(
    null,
  );
  // Ignore async results once the panel switches courses or a newer request starts.
  const activeCourseIdRef = useRef(course.id);
  const loadRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const deleteRequestIdRef = useRef(0);
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  activeCourseIdRef.current = course.id;

  const nextDisplayOrder = useMemo(
    () =>
      sessions.reduce(
        (maxOrder, session) => Math.max(maxOrder, session.displayOrder),
        0,
      ) + 1,
    [sessions],
  );

  const objectiveTitleById = useMemo(
    () =>
      new Map(
        course.learningObjectives.map((objective) => [objective.id, objective.title] as const),
      ),
    [course.learningObjectives],
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

  const isCurrentSaveRequest = (requestCourseId: string, requestId: number) =>
    activeCourseIdRef.current === requestCourseId &&
    saveRequestIdRef.current === requestId;

  const isCurrentDeleteRequest = (requestCourseId: string, requestId: number) =>
    activeCourseIdRef.current === requestCourseId &&
    deleteRequestIdRef.current === requestId;

  const loadPanelData = useCallback(async () => {
    const requestCourseId = course.id;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setIsLoading(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      const [loadedSessions, itemPages] = await Promise.all([
        academyStudioBackend.listCourseSessions(course),
        Promise.all(course.learningObjectives.map((objective) => listObjectiveItems(objective))),
      ]);

      const mergedItems = hydrateEligibleItems(
        loadedSessions,
        itemPages.flat(),
      );
      const orderedSessions = sortSessions(loadedSessions);
      const firstSession = orderedSessions[0] || null;
      const initialDisplayOrder =
        orderedSessions.reduce(
          (maxOrder, session) => Math.max(maxOrder, session.displayOrder),
          0,
        ) + 1;

      if (!isCurrentLoadRequest(requestCourseId, requestId)) return;

      setSessions(orderedSessions);
      setEligibleItems(mergedItems);
      setObjectivePriorityIds(
        firstSession ? collectObjectiveIds(firstSession.items) : [],
      );
      setSelectedSessionId(firstSession?.id ?? null);
      setForm(
        firstSession ? sessionToForm(firstSession) : buildEmptyForm(initialDisplayOrder),
      );
    } catch (error) {
      console.error('Failed to load course sessions:', error);
      if (!isCurrentLoadRequest(requestCourseId, requestId)) return;
      setSessions([]);
      setEligibleItems([]);
      setObjectivePriorityIds([]);
      setSelectedSessionId(null);
      setForm(buildEmptyForm(1));
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load teacher sessions for this course.',
      );
    } finally {
      if (isCurrentLoadRequest(requestCourseId, requestId)) {
        setIsLoading(false);
      }
    }
  }, [course, hydrateEligibleItems]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    saveRequestIdRef.current += 1;
    deleteRequestIdRef.current += 1;
    setSessions([]);
    setEligibleItems([]);
    setObjectivePriorityIds([]);
    setSelectedSessionId(null);
    setForm(buildEmptyForm(1));
    setSearchQuery('');
    setPickerPage(1);
    setSessionToDelete(null);
    setLoadError(null);
    setStatusMessage(null);
    setIsLoading(true);
    setIsSaving(false);
    setIsDeleting(false);
  }, [course.id]);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

  // Reset to the first page whenever the filtered item set changes.
  useEffect(() => {
    setPickerPage(1);
  }, [deferredSearch, eligibleItems]);

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
        // Selected items bubble to the top of their objective.
        const items = [
          ...sorted.filter((item) => selectedIds.has(item.id)),
          ...sorted.filter((item) => !selectedIds.has(item.id)),
        ];
        return { objectiveId, objectiveTitle: group.objectiveTitle, items };
      })
      .sort((left, right) => {
        // Keep objective pages stable after the initial prioritized display.
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
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [selectedSessionId, sessions],
  );

  const canSave = Boolean(form.title.trim()) && selectedItems.length > 0;

  const selectedBreakdown = selectionCounts
    .filter((modality) => modality.count > 0)
    .map((modality) => `${modality.label} ×${modality.count}`)
    .join(' · ');

  const startNewSession = useCallback(() => {
    setObjectivePriorityIds([]);
    setSelectedSessionId(null);
    setStatusMessage(null);
    setPickerPage(1);
    setForm(buildEmptyForm(nextDisplayOrder));
  }, [nextDisplayOrder]);

  const handleSelectSession = (session: TeacherCourseSession) => {
    setObjectivePriorityIds(collectObjectiveIds(session.items));
    setSelectedSessionId(session.id);
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

  const handleSave = async () => {
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setLoadError('Session title is required.');
      return;
    }
    if (selectedItems.length === 0) {
      setLoadError('Select at least one item before saving this session.');
      return;
    }

    const requestCourseId = course.id;
    const requestId = saveRequestIdRef.current + 1;
    const wasEditingExistingSession = Boolean(form.id);
    saveRequestIdRef.current = requestId;

    setIsSaving(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      const saved = await academyStudioBackend.saveCourseSession(course, {
        id: form.id,
        identifier: form.identifier,
        title: trimmedTitle,
        displayOrder: form.displayOrder,
        scheduledDate: form.scheduledDate,
        items: selectedItems,
      });

      if (!isCurrentSaveRequest(requestCourseId, requestId)) return;

      setSessions((current) => {
        const next = current.some((session) => session.id === saved.id)
          ? current.map((session) => (session.id === saved.id ? saved : session))
          : [...current, saved];
        return sortSessions(next);
      });
      setSelectedSessionId(saved.id);
      setForm(sessionToForm(saved));
      setStatusMessage(
        wasEditingExistingSession
          ? 'Teacher session updated.'
          : 'Teacher session saved and ready for published study plans.',
      );
    } catch (error) {
      console.error('Failed to save course session:', error);
      if (!isCurrentSaveRequest(requestCourseId, requestId)) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to save this teacher session.',
      );
    } finally {
      if (isCurrentSaveRequest(requestCourseId, requestId)) {
        setIsSaving(false);
      }
    }
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    const deletingSession = sessionToDelete;
    const requestCourseId = course.id;
    const requestId = deleteRequestIdRef.current + 1;
    deleteRequestIdRef.current = requestId;

    setIsDeleting(true);
    setLoadError(null);
    setStatusMessage(null);

    try {
      await academyStudioBackend.deleteCourseSession(course, deletingSession);
      if (!isCurrentDeleteRequest(requestCourseId, requestId)) return;
      setSessions((current) => {
        const next = current.filter((session) => session.id !== deletingSession.id);
        const ordered = sortSessions(next);
        const replacement = ordered[0] || null;
        setObjectivePriorityIds(
          replacement ? collectObjectiveIds(replacement.items) : [],
        );
        setSelectedSessionId(replacement?.id ?? null);
        setPickerPage(1);
        setForm(
          replacement
            ? sessionToForm(replacement)
            : buildEmptyForm(
                ordered.reduce(
                  (maxOrder, session) =>
                    Math.max(maxOrder, session.displayOrder),
                  0,
                ) + 1,
              ),
        );
        return ordered;
      });
      setSessionToDelete(null);
      setStatusMessage('Teacher session deleted.');
    } catch (error) {
      console.error('Failed to delete course session:', error);
      if (!isCurrentDeleteRequest(requestCourseId, requestId)) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to delete this teacher session.',
      );
    } finally {
      if (isCurrentDeleteRequest(requestCourseId, requestId)) {
        setIsDeleting(false);
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
          Teacher sessions can only use items linked through this course&apos;s
          learning objectives.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="-mx-6 flex-1 space-y-8 overflow-y-auto px-6 pb-4 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#16324F] text-white">
            <CalendarClock size={16} />
          </div>
          <div className="min-w-0">
            <SectionLabel>Teacher sessions</SectionLabel>
            <h3 className="truncate text-lg font-black tracking-tight text-slate-900">
              Prebuilt study-plan sessions
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadPanelData()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 border-y border-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
        <StatTile label="Teacher sessions" value={sessions.length} accent="emerald" />
        <StatTile label="Eligible items" value={eligibleItems.length} />
        <StatTile
          label="Selected items"
          value={form.itemIds.length}
          accent={form.itemIds.length > 0 ? 'amber' : 'slate'}
        />
        <div className="px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Learner access
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xl font-black text-slate-900">
            {course.locked ? <Lock size={16} /> : <Unlock size={16} />}
            {course.locked ? 'Locked' : 'Unlocked'}
          </p>
        </div>
      </div>

      {/* Lock notice */}
      <p className="flex items-start gap-2 text-xs font-medium leading-5 text-slate-500">
        {course.locked ? (
          <Lock size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
        ) : (
          <Unlock size={14} className="mt-0.5 flex-shrink-0 text-emerald-500" />
        )}
        <span className="min-w-0">
          {course.locked
            ? 'Locked course — once published, these prebuilt sessions are the learner’s primary entry point.'
            : 'Unlocked course — published sessions appear immediately. Add a release date to schedule one for later.'}
        </span>
      </p>

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

      {isLoading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
          <Loader2 size={16} className="mr-2 animate-spin" />
          Loading teacher sessions…
        </div>
      ) : (
        <>
          {/* Session queue — wrapping card grid, never a fixed side column */}
          <section className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SectionLabel>Session queue</SectionLabel>
                {sessions.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                    {sessions.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={startNewSession}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-[#16324F] px-3.5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#1B3E62]"
              >
                <Plus size={14} />
                New session
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <ListChecks size={20} />
                </div>
                <p className="mt-4 text-sm font-black text-slate-700">
                  No teacher sessions yet
                </p>
                <p className="mt-1.5 max-w-sm text-xs font-medium leading-5 text-slate-500">
                  Build your first one in the editor below — pick a title and any
                  mix of course items.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session) => {
                  const isActive = selectedSessionId === session.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => handleSelectSession(session)}
                      className={`group flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                        isActive
                          ? 'border-[#1BD183] bg-emerald-50/70 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                          isActive
                            ? 'bg-[#1BD183] text-[#06241a]'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        {session.displayOrder}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-slate-900">
                          {session.title}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-1.5">
                          <span
                            className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${MODE_STYLES[session.mode]}`}
                          >
                            {formatSessionMode(session.mode)}
                          </span>
                          <span className="truncate text-[11px] font-semibold text-slate-500">
                            {session.itemCount} item
                            {session.itemCount === 1 ? '' : 's'} ·{' '}
                            {session.scheduledDate
                              ? formatReleaseDate(session.scheduledDate)
                              : 'Immediate'}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Session editor */}
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <SectionLabel>Session editor</SectionLabel>
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  {currentSession ? 'Edit teacher session' : 'Create teacher session'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  A session needs a title, a display order, and at least one
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

            {/* Form fields */}
            <div className="mt-6 space-y-4">
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

            {/* Item picker */}
            <div className="mt-8 border-t border-slate-100 pt-6">
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
                          <h4
                            title={group.objectiveTitle}
                            className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-400"
                          >
                            {group.objectiveTitle}
                          </h4>
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
                                  <span className="block truncate text-sm font-bold text-slate-900">
                                    {itemTitle(item)}
                                  </span>
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
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  </div>

                  {/* Pagination */}
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

          </section>

        </>
      )}
      </div>

      {!isLoading && (
        <div className="-mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <p className="min-w-0 text-xs font-semibold text-slate-500">
            {canSave
              ? `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} · ${formatSessionMode(selectedMode)}`
              : !form.title.trim()
                ? 'Add a title to continue.'
                : 'Select at least one item to save.'}
          </p>
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={startNewSession}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Plus size={14} />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-[#16324F] px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#1B3E62] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {currentSession ? 'Save session' : 'Create session'}
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(sessionToDelete)}
        title="Delete session?"
        message={`Remove “${sessionToDelete?.title || 'this session'}” from published study plans? Existing learner copies will no longer be updated from this teacher session.`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          if (!isDeleting) void confirmDeleteSession();
        }}
        onCancel={() => {
          if (!isDeleting) setSessionToDelete(null);
        }}
      />
    </div>
  );
};

export default CourseSessionsPanel;
