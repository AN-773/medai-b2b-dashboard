import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CheckCheck, Layers, Sparkles, Target, X } from 'lucide-react';
import {
  Badge,
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  SectionHeader,
  SegmentedControl,
  Spinner,
} from '@/components/ui';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type {
  ItemSuggestion,
  ItemSuggestionDraft,
  ItemSuggestionType,
} from '@/types/CourseAITypes';
import { getJobProgress, type ItemFactory } from '@/hooks/useItemFactory';
import { courseAIService } from '@/services/courseAIService';
import { resourceIdentifier } from '@/utils/resourceId';
import ObjectiveItemsList, {
  ItemModality,
  MODALITIES,
} from './ObjectiveItemsList';
import { bloomStyle } from './shared';
import CourseDraftsCard from './content/CourseDraftsCard';
import GenerateDrawer from './content/GenerateDrawer';
import GenerationStrip, { GenerationBar, generationLabel } from './content/GenerationProgress';
import ItemReviewCard from './content/ItemReviewCard';
import ObjectiveRail from './content/ObjectiveRail';
import PlanEditor from './content/PlanEditor';
import {
  clampPlanValue,
  createDefaultPlan,
  DRAFT_STATUS_OPTIONS,
  plural,
  visiblePlanEntries,
  type ItemPlan,
} from './content/contentConfig';

interface CourseContentPanelProps {
  course: TeacherCourse;
  itemFactory: ItemFactory;
  /** Open the in-page editor to author a brand new item for an objective. */
  onCreateItem: (modality: ItemModality, objectiveId: string) => void;
  /** Jump into the module-first session builder for this course. */
  onCreateSession: () => void;
  /** Open the in-page editor for an existing live item. */
  onOpenItem: (item: BackendApiItem) => void;
  /** Bumped by the host after a manual save so the live list refetches. */
  refreshSignal: number;
}

type ReviewMode = 'by-objective' | 'all';

const VISIBLE_MODALITIES = MODALITIES.filter((modality) => modality.type !== 'lecture');

const COURSE_REVIEW_PAGE_SIZE = 100;
const CONTENT_OBJECTIVES_PAGE_SIZE = 25;

const EMPTY_COURSE_SUGGESTION_COUNTS: Record<SuggestionStatus, number> = {
  pending: 0,
  accepted: 0,
  rejected: 0,
};

const OBJECTIVE_DRAFTS_EMPTY: Record<SuggestionStatus, { title: string; description?: string }> = {
  pending: {
    title: 'No drafts to review',
    description: 'Set the counts above and choose Draft to have AI write items for this objective.',
  },
  accepted: { title: 'No accepted drafts' },
  rejected: { title: 'No rejected drafts' },
};

const CourseContentPanel: React.FC<CourseContentPanelProps> = ({
  course,
  itemFactory,
  onCreateItem,
  onCreateSession,
  onOpenItem,
  refreshSignal,
}) => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [batchPlan, setBatchPlan] = useState<ItemPlan>(createDefaultPlan);
  const [objectivePlan, setObjectivePlan] = useState<ItemPlan>(createDefaultPlan);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus>('pending');
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | null>(null);
  // Objectives ticked for a batch generation run, plus the batch-review confirm.
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchConfirm, setBatchConfirm] = useState<'accept' | 'reject' | null>(null);
  // Bumped after an AI draft is accepted so the live items list refetches and
  // shows the freshly promoted item. Combined with the host's refreshSignal
  // (bumped after a manual save).
  const [acceptedTick, setAcceptedTick] = useState(0);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('by-objective');
  const [courseStatusFilter, setCourseStatusFilter] = useState<SuggestionStatus>('pending');
  const [courseSuggestions, setCourseSuggestions] = useState<ItemSuggestion[]>([]);
  const [courseSuggestionCounts, setCourseSuggestionCounts] = useState<
    Record<SuggestionStatus, number>
  >(EMPTY_COURSE_SUGGESTION_COUNTS);
  const [isLoadingCourseSuggestions, setIsLoadingCourseSuggestions] = useState(false);
  const [courseSuggestionError, setCourseSuggestionError] = useState<string | null>(null);
  const [courseSuggestionsTick, setCourseSuggestionsTick] = useState(0);
  const [objectivePage, setObjectivePage] = useState(1);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  const objectives = course.learningObjectives;

  const coveredObjectiveCount = useMemo(
    () => objectives.filter((objective) => (objective.itemTotals?.total ?? 0) > 0).length,
    [objectives],
  );

  const filteredObjectives = useMemo(() => {
    const trimmed = deferredQuery.trim().toLowerCase();
    if (!trimmed) return objectives;
    return objectives.filter(
      (objective) =>
        objective.title.toLowerCase().includes(trimmed) ||
        (objective.organSystem || '').toLowerCase().includes(trimmed),
    );
  }, [deferredQuery, objectives]);
  const totalObjectivePages = Math.max(
    1,
    Math.ceil(filteredObjectives.length / CONTENT_OBJECTIVES_PAGE_SIZE),
  );
  const objectivePageStart = (objectivePage - 1) * CONTENT_OBJECTIVES_PAGE_SIZE;
  const pagedObjectives = useMemo(
    () =>
      filteredObjectives.slice(
        objectivePageStart,
        objectivePageStart + CONTENT_OBJECTIVES_PAGE_SIZE,
      ),
    [filteredObjectives, objectivePageStart],
  );
  const objectiveRangeStart = filteredObjectives.length === 0 ? 0 : objectivePageStart + 1;
  const objectiveRangeEnd =
    filteredObjectives.length === 0
      ? 0
      : Math.min(filteredObjectives.length, objectivePageStart + CONTENT_OBJECTIVES_PAGE_SIZE);

  const objectiveTitleById = useMemo(() => {
    const titleById = new Map<string, string>();
    objectives.forEach((objective) => {
      titleById.set(objective.id, objective.title);
      titleById.set(resourceIdentifier(objective.id), objective.title);
    });
    return titleById;
  }, [objectives]);

  const courseGenerationStatus = itemFactory.job?.status;

  const selectedObjectiveId = itemFactory.selectedObjectiveId;
  const selectedObjective = useMemo(
    () => objectives.find((objective) => objective.id === selectedObjectiveId) || null,
    [objectives, selectedObjectiveId],
  );

  // Batch selection is keyed by objective id, so clear it when the course
  // changes (the panel instance is reused across courses).
  useEffect(() => {
    setBatchSelectedIds([]);
    setBatchConfirm(null);
    setCourseSuggestions([]);
    setCourseSuggestionCounts(EMPTY_COURSE_SUGGESTION_COUNTS);
    setCourseSuggestionError(null);
    setCourseStatusFilter('pending');
    setReviewMode('by-objective');
    setObjectivePage(1);
    setIsGenerateOpen(false);
  }, [course.id]);

  useEffect(() => {
    setObjectivePage(1);
  }, [query]);

  useEffect(() => {
    setObjectivePage((current) => Math.min(current, totalObjectivePages));
  }, [totalObjectivePages]);

  const refreshCourseSuggestions = useCallback(() => {
    setCourseSuggestionsTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCourseSuggestions = async () => {
      setIsLoadingCourseSuggestions(true);
      setCourseSuggestionError(null);

      try {
        const countResults = await Promise.all(
          DRAFT_STATUS_OPTIONS.map((filter) =>
            courseAIService.listItemSuggestions(course.id, {
              status: filter.value,
              limit: 1,
              page: 1,
            }),
          ),
        );
        if (cancelled) return;

        setCourseSuggestionCounts(
          DRAFT_STATUS_OPTIONS.reduce(
            (counts, filter, index) => ({
              ...counts,
              [filter.value]:
                typeof countResults[index].total === 'number'
                  ? countResults[index].total
                  : countResults[index].items?.length ?? 0,
            }),
            { ...EMPTY_COURSE_SUGGESTION_COUNTS },
          ),
        );

        const firstPage = await courseAIService.listItemSuggestions(course.id, {
          status: courseStatusFilter,
          limit: COURSE_REVIEW_PAGE_SIZE,
          page: 1,
        });
        if (cancelled) return;

        let items = firstPage.items || [];
        const total = typeof firstPage.total === 'number' ? firstPage.total : items.length;
        const totalPages = Math.ceil(total / COURSE_REVIEW_PAGE_SIZE);

        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await courseAIService.listItemSuggestions(course.id, {
            status: courseStatusFilter,
            limit: COURSE_REVIEW_PAGE_SIZE,
            page,
          });
          if (cancelled) return;
          items = items.concat(nextPage.items || []);
        }

        setCourseSuggestions(items);
      } catch (error) {
        console.error('Failed to fetch course item suggestions:', error);
        if (!cancelled) {
          setCourseSuggestionError('Failed to load AI drafts for this course.');
          setCourseSuggestions([]);
        }
      } finally {
        if (!cancelled) setIsLoadingCourseSuggestions(false);
      }
    };

    void fetchCourseSuggestions();

    return () => {
      cancelled = true;
    };
  }, [course.id, courseStatusFilter, courseSuggestionsTick, courseGenerationStatus]);

  const visibleSuggestions = useMemo(
    () => itemFactory.filterByStatus(statusFilter),
    [itemFactory, statusFilter],
  );

  const itemsActive = itemFactory.isGenerating || itemFactory.isPolling;
  const progress = getJobProgress(itemFactory.job);

  // True while any bulk accept/reject (per-objective or whole batch) is running.
  // Used to lock every per-item action so nothing fires concurrently.
  const isBulkBusy = itemFactory.busyObjectiveId !== null || itemFactory.isJobBatchBusy;

  const batchPlanEntries = useMemo(() => visiblePlanEntries(batchPlan), [batchPlan]);
  const batchPlanTotal = batchPlanEntries.reduce((sum, entry) => sum + entry.count, 0);
  const objectivePlanEntries = useMemo(
    () => visiblePlanEntries(objectivePlan),
    [objectivePlan],
  );
  const objectivePlanTotal = objectivePlanEntries.reduce((sum, entry) => sum + entry.count, 0);

  const handleGenerateItems = () => {
    if (!selectedObjectiveId || objectivePlanTotal === 0) return;
    void itemFactory.generate({
      learningObjectiveIds: [selectedObjectiveId],
      plan: objectivePlanEntries,
    });
  };

  const adjustBatchPlan = (type: ItemSuggestionType, delta: number) =>
    setBatchPlan((current) => ({
      ...current,
      [type]: clampPlanValue(current[type] + delta),
    }));

  const adjustObjectivePlan = (type: ItemSuggestionType, delta: number) =>
    setObjectivePlan((current) => ({
      ...current,
      [type]: clampPlanValue(current[type] + delta),
    }));

  // --- Batch generation across many / all objectives ------------------------

  const toggleBatchSelection = (objectiveId: string) =>
    setBatchSelectedIds((current) =>
      current.includes(objectiveId)
        ? current.filter((id) => id !== objectiveId)
        : [...current, objectiveId],
    );

  const visibleObjectiveIds = useMemo(
    () => pagedObjectives.map((objective) => objective.id),
    [pagedObjectives],
  );
  const allVisibleSelected =
    visibleObjectiveIds.length > 0 &&
    visibleObjectiveIds.every((id) => batchSelectedIds.includes(id));
  const someVisibleSelected = visibleObjectiveIds.some((id) => batchSelectedIds.includes(id));

  const toggleSelectAllVisible = () =>
    setBatchSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleObjectiveIds.includes(id))
        : Array.from(new Set([...current, ...visibleObjectiveIds])),
    );

  const handleGenerateForAll = () => {
    if (batchPlanTotal === 0 || itemsActive) return;
    // Pass explicit ids (rather than relying on the backend's "omit = all")
    // so the demo mock — which can't enumerate course LOs — also works.
    void itemFactory.generate({
      learningObjectiveIds: objectives.map((objective) => objective.id),
      plan: batchPlanEntries,
    });
    setBatchSelectedIds([]);
  };

  const handleGenerateForSelected = () => {
    if (batchPlanTotal === 0 || itemsActive || batchSelectedIds.length === 0) return;
    void itemFactory.generate({
      learningObjectiveIds: batchSelectedIds,
      plan: batchPlanEntries,
    });
  };

  const handleAcceptSuggestion = async (suggestion: ItemSuggestion) => {
    const ok = await itemFactory.acceptSuggestion(suggestion);
    if (ok) {
      setAcceptedTick((tick) => tick + 1);
      refreshCourseSuggestions();
    }
  };

  const handleRejectSuggestion = async (suggestion: ItemSuggestion) => {
    const ok = await itemFactory.rejectSuggestion(suggestion);
    if (ok) refreshCourseSuggestions();
  };

  const handleSaveSuggestion = async (
    suggestion: ItemSuggestion,
    draft: ItemSuggestionDraft,
  ) => {
    const ok = await itemFactory.patchSuggestion(suggestion, draft);
    if (ok) refreshCourseSuggestions();
    return ok;
  };

  const objectiveTitleForSuggestion = (suggestion: ItemSuggestion) =>
    objectiveTitleById.get(suggestion.learningObjectiveId) ||
    objectiveTitleById.get(resourceIdentifier(suggestion.learningObjectiveId)) ||
    'Objective';

  const liveRefreshSignal = refreshSignal + acceptedTick;

  const header = (
    <SectionHeader
      title="Content"
      description="Author practice items for each objective by hand or with AI, then package them into modules."
      meta={
        objectives.length > 0 ? (
          <Badge
            tone={coveredObjectiveCount === objectives.length ? 'green' : 'neutral'}
            className="tabular-nums"
          >
            {coveredObjectiveCount.toLocaleString()} of {objectives.length.toLocaleString()}{' '}
            {objectives.length === 1 ? 'objective has' : 'objectives have'} content
          </Badge>
        ) : undefined
      }
      actions={
        objectives.length > 0 ? (
          <>
            <Button icon={Layers} onClick={onCreateSession}>
              Create session
            </Button>
            <Button variant="ai" icon={Sparkles} onClick={() => setIsGenerateOpen(true)}>
              Generate with AI
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (objectives.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-xl border border-dashed border-stone-200">
          <EmptyState
            icon={Target}
            title="No objectives to build content for"
            description="Content is written against learning objectives. Add objectives on the Objectives tab, then come back to author MCQs, SAQs and flashcards by hand or with AI."
          />
        </div>
      </div>
    );
  }

  const renderObjectiveDrafts = () => {
    if (itemsActive) {
      return (
        <div className="px-6 py-10">
          <Spinner label={generationLabel(progress)} />
          <GenerationBar progress={progress} className="mx-auto mt-3 max-w-[220px]" />
        </div>
      );
    }

    if (itemFactory.isLoadingSuggestions) {
      return <Spinner label="Loading drafts…" className="py-12" />;
    }

    if (visibleSuggestions.length === 0) {
      return (
        <EmptyState
          compact
          icon={Sparkles}
          title={OBJECTIVE_DRAFTS_EMPTY[statusFilter].title}
          description={OBJECTIVE_DRAFTS_EMPTY[statusFilter].description}
        />
      );
    }

    return (
      <div className="divide-y divide-stone-100">
        {visibleSuggestions.map((suggestion) => (
          <ItemReviewCard
            key={suggestion.id}
            suggestion={suggestion}
            isBusy={itemFactory.busySuggestionId === suggestion.id}
            locked={isBulkBusy}
            onSave={(draft) => handleSaveSuggestion(suggestion, draft)}
            onAccept={() => void handleAcceptSuggestion(suggestion)}
            onReject={() => void handleRejectSuggestion(suggestion)}
          />
        ))}
      </div>
    );
  };

  const renderWorkspace = () => {
    if (!selectedObjective) {
      return (
        <EmptyState
          icon={Target}
          title="Select an objective"
          description="Choose an objective from the list to add items by hand or draft them with AI."
          className="h-full min-h-[360px]"
        />
      );
    }

    const showBulkActions =
      statusFilter === 'pending' &&
      itemFactory.stats.pending > 0 &&
      !itemsActive &&
      !itemFactory.isLoadingSuggestions;

    return (
      <div className="min-w-0 space-y-8 p-6">
        <header className="space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold leading-6 text-stone-900">
              {selectedObjective.title}
            </h3>
            {(selectedObjective.cognitiveSkill || selectedObjective.organSystem) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {selectedObjective.cognitiveSkill && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
                      bloomStyle(selectedObjective.cognitiveSkill),
                    )}
                  >
                    {selectedObjective.cognitiveSkill}
                  </span>
                )}
                {selectedObjective.organSystem && (
                  <Badge tone="neutral">{selectedObjective.organSystem}</Badge>
                )}
              </div>
            )}
          </div>

          <div role="group" aria-label="Add item" className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] font-medium text-stone-700">Add item</span>
            {VISIBLE_MODALITIES.map((modality) => {
              const Icon = modality.icon;
              return (
                <Button
                  key={modality.type}
                  size="sm"
                  onClick={() => onCreateItem(modality.type, selectedObjective.id)}
                >
                  <Icon size={14} className="text-stone-500" />
                  {modality.label}
                </Button>
              );
            })}
          </div>
        </header>

        <section className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <Sparkles size={15} className="text-violet-brand" aria-hidden="true" />
            Draft with AI
          </h4>
          <p className="mt-0.5 text-[13px] leading-5 text-stone-500">
            Choose how many of each type to draft. Drafts wait below until you review them.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <PlanEditor
              plan={objectivePlan}
              adjustPlan={adjustObjectivePlan}
              label="Drafts for this objective"
            />
            <Button
              variant="ai"
              icon={Sparkles}
              loading={itemsActive}
              disabled={objectivePlanTotal === 0}
              onClick={handleGenerateItems}
            >
              {objectivePlanTotal > 0 ? `Draft ${plural(objectivePlanTotal, 'item')}` : 'Draft items'}
            </Button>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Items</h4>
          <ObjectiveItemsList
            objectiveId={selectedObjective.id}
            refreshSignal={liveRefreshSignal}
            onOpenItem={onOpenItem}
          />
        </section>

        <section>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">AI drafts</h4>
          <div className="overflow-hidden rounded-xl border border-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-2.5">
              <SegmentedControl<SuggestionStatus>
                label="Draft status"
                size="sm"
                value={statusFilter}
                onChange={setStatusFilter}
                options={DRAFT_STATUS_OPTIONS.map((option) => ({
                  ...option,
                  count: itemFactory.stats[option.value],
                }))}
              />
              {showBulkActions && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    icon={CheckCheck}
                    loading={itemFactory.busyObjectiveId === selectedObjective.id}
                    disabled={isBulkBusy}
                    onClick={() => setConfirmAction('accept')}
                  >
                    Accept all
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={X}
                    disabled={isBulkBusy}
                    onClick={() => setConfirmAction('reject')}
                  >
                    Reject all
                  </Button>
                </div>
              )}
            </div>
            {renderObjectiveDrafts()}
          </div>
        </section>
      </div>
    );
  };

  const objectivePending = itemFactory.stats.pending;
  const batchPending = itemFactory.jobPendingCount;

  return (
    <div className="space-y-6">
      {header}

      {itemFactory.error && (
        <InlineAlert tone="error" onDismiss={itemFactory.clearError}>
          {itemFactory.error}
        </InlineAlert>
      )}

      {itemsActive && (
        <GenerationStrip
          progress={progress}
          action={
            <Button variant="ghost" size="sm" onClick={() => setIsGenerateOpen(true)}>
              Details
            </Button>
          }
        />
      )}

      <div className="space-y-4">
        <SegmentedControl<ReviewMode>
          label="Review mode"
          value={reviewMode}
          onChange={setReviewMode}
          options={[
            { value: 'by-objective', label: 'By objective' },
            {
              value: 'all',
              label: 'All AI drafts',
              count: courseSuggestionCounts.pending > 0 ? courseSuggestionCounts.pending : undefined,
            },
          ]}
        />

        {reviewMode === 'all' ? (
          <CourseDraftsCard
            status={courseStatusFilter}
            onStatusChange={setCourseStatusFilter}
            counts={courseSuggestionCounts}
            suggestions={courseSuggestions}
            isLoading={isLoadingCourseSuggestions}
            error={courseSuggestionError}
            onRefresh={refreshCourseSuggestions}
            objectiveTitleFor={objectiveTitleForSuggestion}
            busySuggestionId={itemFactory.busySuggestionId}
            isBulkBusy={isBulkBusy}
            onSave={handleSaveSuggestion}
            onAccept={(suggestion) => void handleAcceptSuggestion(suggestion)}
            onReject={(suggestion) => void handleRejectSuggestion(suggestion)}
          />
        ) : (
          <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white xl:flex-row">
            <ObjectiveRail
              query={query}
              onQueryChange={setQuery}
              objectives={pagedObjectives}
              filteredCount={filteredObjectives.length}
              rangeStart={objectiveRangeStart}
              rangeEnd={objectiveRangeEnd}
              page={objectivePage}
              totalPages={totalObjectivePages}
              onPrevPage={() => setObjectivePage((current) => Math.max(1, current - 1))}
              onNextPage={() =>
                setObjectivePage((current) => Math.min(totalObjectivePages, current + 1))
              }
              selectedObjectiveId={selectedObjectiveId}
              onSelectObjective={(objectiveId) => itemFactory.selectObjective(objectiveId)}
              batchSelectedIds={batchSelectedIds}
              onToggleBatch={toggleBatchSelection}
              allVisibleSelected={allVisibleSelected}
              someVisibleSelected={someVisibleSelected}
              onToggleSelectPage={toggleSelectAllVisible}
              onClearSelection={() => setBatchSelectedIds([])}
              pendingCountFor={(objectiveId) => itemFactory.buildGroup(objectiveId).pendingCount}
            />
            <section aria-label="Selected objective" className="min-w-0 flex-1">
              {renderWorkspace()}
            </section>
          </div>
        )}
      </div>

      <GenerateDrawer
        open={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        dismissible={batchConfirm === null}
        objectiveCount={objectives.length}
        selectedCount={batchSelectedIds.length}
        onClearSelection={() => setBatchSelectedIds([])}
        plan={batchPlan}
        adjustPlan={adjustBatchPlan}
        planTotal={batchPlanTotal}
        isRunning={itemsActive}
        progress={progress}
        error={itemFactory.error}
        onDismissError={itemFactory.clearError}
        onGenerateAll={handleGenerateForAll}
        onGenerateSelected={handleGenerateForSelected}
        pendingCount={batchPending}
        isBulkBusy={isBulkBusy}
        isBatchBusy={itemFactory.isJobBatchBusy}
        onAcceptBatch={() => setBatchConfirm('accept')}
        onRejectBatch={() => setBatchConfirm('reject')}
        onReviewIndividually={() => {
          setReviewMode('all');
          setCourseStatusFilter('pending');
          setIsGenerateOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        tone={confirmAction === 'reject' ? 'danger' : 'default'}
        title={confirmAction === 'reject' ? 'Reject all drafts?' : 'Accept all drafts?'}
        description={
          confirmAction === 'reject'
            ? `Reject all ${plural(objectivePending, 'pending draft')} for this objective? This can’t be undone.`
            : `Add all ${plural(objectivePending, 'pending draft')} for this objective to the course as live items?`
        }
        confirmLabel={confirmAction === 'reject' ? 'Reject all' : 'Accept all'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          const group = itemFactory.selectedGroup;
          setConfirmAction(null);
          if (!group) return;
          if (action === 'accept') {
            void itemFactory.acceptAllForObjective(group).then((result) => {
              if (result && result.accepted > 0) setAcceptedTick((tick) => tick + 1);
              if (result) refreshCourseSuggestions();
            });
          } else if (action === 'reject') {
            void itemFactory.rejectAllForObjective(group).then((result) => {
              if (result) refreshCourseSuggestions();
            });
          }
        }}
      />

      <ConfirmDialog
        open={batchConfirm !== null}
        tone={batchConfirm === 'reject' ? 'danger' : 'default'}
        title={batchConfirm === 'reject' ? 'Reject the whole batch?' : 'Accept the whole batch?'}
        description={
          batchConfirm === 'reject'
            ? `Reject all ${plural(batchPending, 'pending draft')} from the last generation? This can’t be undone.`
            : `Add all ${plural(batchPending, 'pending draft')} from the last generation to the course as live items?`
        }
        confirmLabel={batchConfirm === 'reject' ? 'Reject batch' : 'Accept batch'}
        onCancel={() => setBatchConfirm(null)}
        onConfirm={() => {
          const action = batchConfirm;
          setBatchConfirm(null);
          if (action === 'accept') {
            void itemFactory.acceptAllForJob().then((result) => {
              if (result && result.accepted > 0) setAcceptedTick((tick) => tick + 1);
              if (result) refreshCourseSuggestions();
            });
          } else if (action === 'reject') {
            void itemFactory.rejectAllForJob().then((result) => {
              if (result) refreshCourseSuggestions();
            });
          }
        }}
      />
    </div>
  );
};

export default CourseContentPanel;
