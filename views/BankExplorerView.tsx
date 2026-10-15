import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Database,
  Hash,
  Plus,
  RefreshCw,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { testsService } from '../services/testsService';
import BulkProgressModal, { type BulkItemResult } from '../components/BulkProgressModal';
import { useGlobal } from '@/contexts/GlobalContext';
import { BackendApiItem, Discipline, Tag, Subject } from '@/types/TestsServiceTypes';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  Input,
  Menu,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  type ButtonVariant,
} from '@/components/ui';
import {
  PaginationFooter,
  revealTop,
} from '@/components/academy/course-workbench/objectives/ListHelpers';
import BankFiltersDrawer from '@/components/bank/BankFiltersDrawer';
import ItemBankTable from '@/components/bank/ItemBankTable';
import ResultsBar from '@/components/bank/ResultsBar';
import { Toast, useToast } from '@/components/bank/Toast';
import {
  ALL,
  EMPTY_FILTERS,
  STATUS_META,
  STATUS_OPTIONS,
  TYPE_META,
  TYPE_OPTIONS,
  countActiveFilters,
  errorMessage,
  itemId,
  itemStem,
  plural,
  type BankFilterState,
  type BulkStatus,
  type Option,
} from '@/components/bank/itemMeta';

interface BankExplorerViewProps {
  onEditItem?: (itemId: string) => void;
}

/** Workbench deep-link ids that open a blank editor of each type. */
const NEW_ITEM_OPTIONS = [
  { type: 'mcq', label: 'Multiple choice (MCQ)', questionId: 'new' },
  { type: 'saq', label: 'Short answer (SAQ)', questionId: 'new_saq' },
  { type: 'flashcard', label: 'Flashcard', questionId: 'new_flashcard' },
  { type: 'lecture', label: 'Lecture', questionId: 'new_lecture' },
] as const;

const NewItemMenu: React.FC<{ onCreate: (questionId: string) => void; variant?: ButtonVariant }> = ({
  onCreate,
  variant = 'primary',
}) => (
  <Menu
    label="New item"
    items={NEW_ITEM_OPTIONS.map((option) => ({
      label: option.label,
      icon: TYPE_META[option.type].icon,
      onSelect: () => onCreate(option.questionId),
    }))}
    trigger={(props) => (
      <Button variant={variant} icon={Plus} iconRight={ChevronDown} {...props}>
        New item
      </Button>
    )}
  />
);

type PendingAction =
  | { kind: 'delete'; item: BackendApiItem }
  | { kind: 'bulk-delete'; ids: string[] }
  | { kind: 'bulk-status'; ids: string[]; status: BulkStatus };

interface BulkProgressState {
  isOpen: boolean;
  title: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  isProcessing: boolean;
  results: BulkItemResult[];
}

const CLOSED_PROGRESS: BulkProgressState = {
  isOpen: false,
  title: '',
  totalItems: 0,
  completedItems: 0,
  failedItems: 0,
  isProcessing: false,
  results: [],
};

const clip = (text: string, length = 120) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

const BankExplorerView: React.FC<BankExplorerViewProps> = ({ onEditItem }) => {
  const [items, setItems] = useState<BackendApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const { cognitiveSkills } = useGlobal();
  const { toast, showToast, dismiss: dismissToast } = useToast();

  // Filter data from testsService
  const [organSystems, setOrganSystems] = useState<Option[]>([]);
  const [topics, setTopics] = useState<Option[]>([]);
  const [subTopics, setSubTopics] = useState<Option[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [subTopicsLoading, setSubTopicsLoading] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [filters, setFilters] = useState<BankFilterState>(EMPTY_FILTERS);
  const [selectedQID, setSelectedQID] = useState<string>('');
  const [isFiltersOpen, setFiltersOpen] = useState(false);

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState(''); // Actual query sent to API
  const [localSearchQuery, setLocalSearchQuery] = useState(''); // Input value
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);

  // Debounce search query; a new query starts again from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery === searchQueryRef.current) return;
      setSearchQuery(localSearchQuery);
      setPage(1);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  const fetchItems = useCallback(async () => {
    // Only the latest request may update the list, so fast typing or paging
    // can't leave an older response on screen.
    const requestId = ++requestRef.current;
    try {
      setLoading(true);
      setFetchError(null);

      const response = await testsService.getItems(
        page,
        limit,
        filters.type === ALL ? undefined : filters.type,
        filters.status === ALL ? undefined : filters.status,
        filters.examType === ALL ? undefined : filters.examType,
        undefined, // learningObjectiveId
        filters.organSystemId === ALL ? undefined : filters.organSystemId,
        filters.topicId === ALL ? undefined : filters.topicId,
        filters.disciplines.length > 0 ? filters.disciplines.join(',') : undefined,
        filters.subjectId === ALL ? undefined : filters.subjectId,
        filters.tags.length > 0 ? filters.tags.join(',') : undefined,
        searchQuery || undefined,
        filters.subTopicId === ALL ? undefined : filters.subTopicId,
        filters.cognitiveSkillId === ALL ? undefined : filters.cognitiveSkillId,
        selectedQID || undefined,
      );

      if (requestId !== requestRef.current) return;
      setItems(response.items);
      setTotal(response.total);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.error('Failed to fetch items:', error);
      setFetchError(errorMessage(error, 'Something went wrong while loading items.'));
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  }, [page, limit, filters, searchQuery, selectedQID]);

  useEffect(() => {
    void fetchItems();
    setSelectedItems([]);
  }, [fetchItems]);

  // Deleting the last items on the last page leaves an empty page behind.
  useEffect(() => {
    if (loading || total === 0) return;
    const lastPage = Math.max(1, Math.ceil(total / limit));
    if (page > lastPage) setPage(lastPage);
  }, [loading, total, page, limit]);

  // Fetch initial filter data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setFiltersLoading(true);
        const [sysRes, discRes, tagsRes, subjRes] = await Promise.all([
          testsService.getOrganSystems(),
          testsService.getDisciplines(1, 200),
          testsService.getTags(1, 200),
          testsService.getSubjects(1, 200),
        ]);

        setOrganSystems((sysRes.items || []).map((sys) => ({ id: sys.id, name: sys.title })));
        setDisciplines(discRes.items || []);
        setTags(tagsRes.items || []);
        setSubjects(subjRes.items || []);
      } catch (error) {
        console.error('Failed to fetch initial filter data:', error);
      } finally {
        setFiltersLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch topics when organ system changes
  useEffect(() => {
    let cancelled = false;
    const fetchTopics = async () => {
      if (filters.organSystemId === ALL) {
        setTopics([]);
        setSubTopics([]);
        return;
      }
      setTopicsLoading(true);
      try {
        const response = await testsService.getTopics(filters.organSystemId);
        if (cancelled) return;
        setTopics((response.items || []).map((t) => ({ id: t.id, name: t.title })));
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      } finally {
        if (!cancelled) setTopicsLoading(false);
      }
    };
    fetchTopics();
    return () => {
      cancelled = true;
    };
  }, [filters.organSystemId]);

  // Fetch syndromes when topic changes
  useEffect(() => {
    let cancelled = false;
    const fetchSyndromes = async () => {
      if (filters.topicId === ALL) {
        setSubTopics([]);
        return;
      }
      setSubTopicsLoading(true);
      try {
        const response = await testsService.getSyndromes(filters.topicId);
        if (cancelled) return;
        setSubTopics((response.items || []).map((s) => ({ id: s.id, name: s.title })));
      } catch (error) {
        console.error('Failed to fetch syndromes:', error);
      } finally {
        if (!cancelled) setSubTopicsLoading(false);
      }
    };
    fetchSyndromes();
    return () => {
      cancelled = true;
    };
  }, [filters.topicId]);

  // --- OPTIONS ---
  const skillOptions = useMemo<Option[]>(
    () => (cognitiveSkills || []).map((cs) => ({ id: cs.id, name: cs.title })),
    [cognitiveSkills],
  );
  // The items API filters subjects by title.
  const subjectOptions = useMemo<Option[]>(
    () => subjects.map((s) => ({ id: s.title, name: s.title })),
    [subjects],
  );
  const disciplineOptions = useMemo<Option[]>(
    () => disciplines.map((d) => ({ id: d.id, name: d.title })),
    [disciplines],
  );
  const tagOptions = useMemo<Option[]>(() => tags.map((t) => ({ id: t.id, name: t.title })), [tags]);

  const cognitiveSkillName = useCallback(
    (item: BackendApiItem) => {
      const objective = item.learningObjective;
      const skillId = objective?.cognitiveSkillId;
      if (!skillId) return objective?.cognitiveSkill?.title ?? null;
      return (
        cognitiveSkills?.find((cs) => cs.id === skillId)?.title ||
        objective?.cognitiveSkill?.title ||
        skillId.split('/').pop() ||
        null
      );
    },
    [cognitiveSkills],
  );

  // --- FILTERS ---
  const updateFilters = (patch: Partial<BankFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const clearDrawerFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const clearFilters = () => {
    setLocalSearchQuery('');
    setSearchQuery('');
    setSelectedQID('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const activeFilterCount = countActiveFilters(filters);
  const hasActiveFilters = localSearchQuery !== '' || selectedQID !== '' || activeFilterCount > 0;
  const hasAppliedFilters = searchQuery !== '' || selectedQID !== '' || activeFilterCount > 0;

  const nameOf = (options: Option[], id: string) =>
    options.find((option) => option.id === id)?.name ?? id;

  // Filters that only live in the drawer, shown as removable chips so they're never invisible.
  const hiddenFilterChips: { key: string; label: string; value: string; onRemove: () => void }[] = [
    ...(filters.examType !== ALL
      ? [{ key: 'exam', label: 'Exam', value: filters.examType, onRemove: () => updateFilters({ examType: ALL }) }]
      : []),
    ...(filters.cognitiveSkillId !== ALL
      ? [
          {
            key: 'skill',
            label: 'Cognitive skill',
            value: nameOf(skillOptions, filters.cognitiveSkillId),
            onRemove: () => updateFilters({ cognitiveSkillId: ALL }),
          },
        ]
      : []),
    ...(filters.organSystemId !== ALL
      ? [
          {
            key: 'system',
            label: 'Organ system',
            value: nameOf(organSystems, filters.organSystemId),
            onRemove: () => updateFilters({ organSystemId: ALL, topicId: ALL, subTopicId: ALL }),
          },
        ]
      : []),
    ...(filters.topicId !== ALL
      ? [
          {
            key: 'topic',
            label: 'Topic',
            value: nameOf(topics, filters.topicId),
            onRemove: () => updateFilters({ topicId: ALL, subTopicId: ALL }),
          },
        ]
      : []),
    ...(filters.subTopicId !== ALL
      ? [
          {
            key: 'subtopic',
            label: 'Subtopic',
            value: nameOf(subTopics, filters.subTopicId),
            onRemove: () => updateFilters({ subTopicId: ALL }),
          },
        ]
      : []),
    ...(filters.subjectId !== ALL
      ? [
          {
            key: 'subject',
            label: 'Subject',
            value: filters.subjectId,
            onRemove: () => updateFilters({ subjectId: ALL }),
          },
        ]
      : []),
    ...filters.disciplines.map((id) => ({
      key: `discipline-${id}`,
      label: 'Discipline',
      value: nameOf(disciplineOptions, id),
      onRemove: () =>
        updateFilters({ disciplines: filters.disciplines.filter((value) => value !== id) }),
    })),
    ...filters.tags.map((id) => ({
      key: `tag-${id}`,
      label: 'Tag',
      value: nameOf(tagOptions, id),
      onRemove: () => updateFilters({ tags: filters.tags.filter((value) => value !== id) }),
    })),
  ];

  // --- PAGINATION ---
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    revealTop(resultsRef.current);
  };

  // --- SELECTION ---
  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((i) => i.id));
    }
  };

  const clearSelection = () => setSelectedItems([]);

  // Row click: while picking rows it toggles selection, otherwise it opens the item.
  const handleRowActivate = (item: BackendApiItem) => {
    if (selectedItems.length > 0) {
      toggleSelectItem(item.id);
    } else {
      onEditItem?.(itemId(item));
    }
  };

  // --- ACTIONS ---
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isDeleting, setDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState>(CLOSED_PROGRESS);

  // Single item delete
  const handleDelete = (item: BackendApiItem) => setPendingAction({ kind: 'delete', item });

  const deleteSingleItem = async (item: BackendApiItem) => {
    setDeleting(true);
    try {
      await testsService.deleteItem(item.id);
      setSelectedItems((prev) => prev.filter((id) => id !== item.id));
      showToast(`Deleted ${itemId(item)}`);
      fetchItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast(errorMessage(error, 'Couldn’t delete the item.'), 'error');
    } finally {
      setDeleting(false);
      setPendingAction(null);
    }
  };

  /** Runs one request per item in order, reporting progress and per-item results. */
  const runBulk = async (
    ids: string[],
    titles: { running: string; success: string },
    operation: (id: string) => Promise<unknown>,
  ) => {
    const results: BulkItemResult[] = ids.map((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return {
        id,
        label: item ? itemId(item) : id,
        detail: item ? itemStem(item) : undefined,
        state: 'queued',
      };
    });
    setBulkProgress({
      isOpen: true,
      title: titles.running,
      totalItems: ids.length,
      completedItems: 0,
      failedItems: 0,
      isProcessing: true,
      results,
    });

    const updateResult = (id: string, patch: Partial<BulkItemResult>, counts?: { completed: number; failed: number }) =>
      setBulkProgress((prev) => ({
        ...prev,
        ...(counts ? { completedItems: counts.completed, failedItems: counts.failed } : {}),
        results: prev.results.map((result) => (result.id === id ? { ...result, ...patch } : result)),
      }));

    let completed = 0;
    let failed = 0;
    for (const id of ids) {
      updateResult(id, { state: 'working' });
      try {
        await operation(id);
        completed++;
        updateResult(id, { state: 'done' }, { completed, failed });
      } catch (error) {
        failed++;
        updateResult(
          id,
          { state: 'failed', message: errorMessage(error, 'The request failed.') },
          { completed, failed },
        );
      }
    }

    setBulkProgress((prev) => ({
      ...prev,
      title: failed > 0 ? `Finished with ${plural(failed, 'error')}` : titles.success,
      isProcessing: false,
    }));
    setSelectedItems([]);
    fetchItems();
  };

  // Bulk delete with progress
  const handleBulkDelete = () => setPendingAction({ kind: 'bulk-delete', ids: [...selectedItems] });

  // Bulk status change with progress
  const handleBulkStatusChange = (newStatus: BulkStatus) =>
    setPendingAction({ kind: 'bulk-status', ids: [...selectedItems], status: newStatus });

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'delete') {
      void deleteSingleItem(pendingAction.item);
      return;
    }

    const action = pendingAction;
    setPendingAction(null);
    const count = plural(action.ids.length, 'item');

    if (action.kind === 'bulk-delete') {
      void runBulk(action.ids, { running: `Deleting ${count}…`, success: `Deleted ${count}` }, (id) =>
        testsService.deleteItem(id),
      );
      return;
    }

    const statusLabel = STATUS_META[action.status].label;
    const pageItems = items;
    void runBulk(
      action.ids,
      { running: `Setting ${count} to ${statusLabel}…`, success: `Updated ${count}` },
      async (id) => {
        const targetItem = pageItems.find((item) => item.id === id);
        if (!targetItem) throw new Error('This item is no longer in the list.');
        await testsService.upsertItem({
          item: { id: targetItem.id, type: targetItem.type, status: action.status },
        });
      },
    );
  };

  const confirmCopy = (() => {
    if (!pendingAction) return null;
    if (pendingAction.kind === 'delete') {
      const { item } = pendingAction;
      return {
        title: 'Delete this item?',
        description: (
          <>
            “{clip(itemStem(item))}” ({itemId(item)}) will be permanently removed from the bank.
            This can’t be undone.
          </>
        ),
        confirmLabel: 'Delete item',
        tone: 'danger' as const,
      };
    }
    const count = plural(pendingAction.ids.length, 'item');
    if (pendingAction.kind === 'bulk-delete') {
      return {
        title: `Delete ${count}?`,
        description: `The ${count} you selected will be permanently removed from the bank. This can’t be undone.`,
        confirmLabel: `Delete ${count}`,
        tone: 'danger' as const,
      };
    }
    return {
      title: 'Change status?',
      description: `The ${count} you selected will be set to “${STATUS_META[pendingAction.status].label}”.`,
      confirmLabel: `Update ${count}`,
      tone: 'default' as const,
    };
  })();

  // --- RENDER ---
  const renderResults = () => {
    if (!hasLoaded) return <Spinner label="Loading items…" className="py-24" />;

    if (items.length === 0) {
      // About to step back from a page that no longer exists — don't flash "empty".
      if (total > 0 && page > Math.ceil(total / limit)) {
        return <Spinner label="Loading items…" className="py-16" />;
      }
      if (fetchError) {
        return (
          <EmptyState
            compact
            icon={AlertTriangle}
            title="Couldn’t load items"
            description={fetchError}
            action={
              <Button size="sm" icon={RefreshCw} onClick={() => void fetchItems()} loading={loading}>
                Try again
              </Button>
            }
          />
        );
      }
      if (loading) return <Spinner label="Loading items…" className="py-16" />;
      if (hasAppliedFilters) {
        return (
          <EmptyState
            compact
            icon={SearchX}
            title="No items match"
            description="Try a different search, or remove some filters."
            action={
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        );
      }
      return (
        <EmptyState
          icon={Database}
          title="The item bank is empty"
          description="Questions, flashcards and lectures you create in the workbench show up here."
          action={onEditItem && <NewItemMenu onCreate={onEditItem} variant="secondary" />}
        />
      );
    }

    return (
      <>
        <ResultsBar
          total={total}
          selectedCount={selectedItems.length}
          hasActiveFilters={hasAppliedFilters}
          isRefreshing={loading}
          onClearSelection={clearSelection}
          onChangeStatus={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
        {fetchError && (
          <InlineAlert
            className="mx-4 mt-3"
            title="Couldn’t refresh the list"
            action={
              <Button size="sm" variant="ghost" onClick={() => void fetchItems()}>
                Retry
              </Button>
            }
          >
            {fetchError}
          </InlineAlert>
        )}
        <ItemBankTable
          items={items}
          selectedIds={selectedItems}
          selectionMode={selectedItems.length > 0}
          onToggle={toggleSelectItem}
          onToggleAll={toggleSelectAll}
          onActivate={handleRowActivate}
          onOpen={onEditItem ? (item) => onEditItem(itemId(item)) : undefined}
          onDelete={handleDelete}
          cognitiveSkillName={cognitiveSkillName}
          busy={loading}
        />
        <PaginationFooter
          className="rounded-b-xl border-t border-stone-100 px-4"
          page={page}
          pageSize={limit}
          total={total}
          onPageChange={changePage}
          disabled={loading}
        />
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Item bank"
        description="Search every question, flashcard and lecture in your bank, open one in the workbench, or update several at once."
        actions={onEditItem && <NewItemMenu onCreate={onEditItem} />}
      />

      {/* Toolbar: search + the most used filters; the rest live in the drawer. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-full sm:w-72"
          value={localSearchQuery}
          onChange={setLocalSearchQuery}
          placeholder="Search item text"
          aria-label="Search items by text"
        />
        <label className="relative block w-full sm:w-40">
          <span className="sr-only">Find by item ID (QID)</span>
          <Hash
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <Input
            value={selectedQID}
            onChange={(event) => {
              setSelectedQID(event.target.value);
              setPage(1);
            }}
            placeholder="QID"
            autoComplete="off"
            spellCheck={false}
            className="pl-8"
          />
        </label>
        <Select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(event) => updateFilters({ type: event.target.value })}
          className="w-full sm:w-36"
        >
          <option value={ALL}>All types</option>
          {TYPE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(event) => updateFilters({ status: event.target.value })}
          className="w-full sm:w-36"
        >
          <option value={ALL}>All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
        <Button icon={SlidersHorizontal} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
          All filters
          {activeFilterCount > 0 && (
            <span className="rounded-md bg-stone-900 px-1.5 text-xs leading-5 tabular-nums text-white">
              {activeFilterCount}
              <span className="sr-only"> applied</span>
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {hiddenFilterChips.length > 0 && (
        <ul aria-label="Other active filters" className="mt-3 flex flex-wrap items-center gap-1.5">
          {hiddenFilterChips.map((chip) => (
            <li
              key={chip.key}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-stone-100 py-0.5 pl-2 pr-1 text-xs text-stone-700 ring-1 ring-inset ring-stone-200/70"
            >
              <span className="text-stone-500">{chip.label}:</span>
              <span className="truncate font-medium">{chip.value}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter ${chip.label}: ${chip.value}`}
                className="rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={resultsRef} className="mt-5 rounded-xl border border-stone-200 bg-white">
        {renderResults()}
      </div>

      <BankFiltersDrawer
        open={isFiltersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={updateFilters}
        onClear={clearDrawerFilters}
        organSystems={organSystems}
        topics={topics}
        subTopics={subTopics}
        topicsLoading={topicsLoading}
        subTopicsLoading={subTopicsLoading}
        cognitiveSkills={skillOptions}
        subjects={subjectOptions}
        disciplines={disciplineOptions}
        tags={tagOptions}
        optionsLoading={filtersLoading}
        resultTotal={total}
        isLoadingResults={loading}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmCopy?.title ?? ''}
        description={confirmCopy?.description ?? ''}
        confirmLabel={confirmCopy?.confirmLabel}
        tone={confirmCopy?.tone}
        busy={isDeleting}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
      />

      <BulkProgressModal
        isOpen={bulkProgress.isOpen}
        title={bulkProgress.title}
        totalItems={bulkProgress.totalItems}
        completedItems={bulkProgress.completedItems}
        failedItems={bulkProgress.failedItems}
        isProcessing={bulkProgress.isProcessing}
        results={bulkProgress.results}
        onClose={() => setBulkProgress((prev) => ({ ...prev, isOpen: false }))}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default BankExplorerView;
