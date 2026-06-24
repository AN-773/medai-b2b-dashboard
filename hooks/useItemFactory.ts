import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courseAIService } from '@/services/courseAIService';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type {
  CourseGenerationJob,
  GenerateItemSuggestionsRequest,
  ItemSuggestion,
  ItemSuggestionDraft,
} from '@/types/CourseAITypes';

export type ObjectiveGroupStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'empty'
  | 'failed';

export interface ObjectiveGroup {
  /** Full learning objective id (used as the stable group key). */
  learningObjectiveId: string;
  status: ObjectiveGroupStatus;
  suggestions: ItemSuggestion[];
  suggestionsLoaded: boolean;
  isLoadingSuggestions: boolean;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

interface CourseScopeToken {
  courseIdentifier: string | null;
  version: number;
}

const POLL_INTERVAL_MS = 15000;
const MAX_POLL_ATTEMPTS = 960; // ~4 hours of polling
const SUGGESTION_PAGE_SIZE = 100;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isJobActive = (job: CourseGenerationJob | null) =>
  job?.status === 'queued' || job?.status === 'processing';

export interface JobProgress {
  /** Units finished (completed + failed + skipped). */
  done: number;
  /** Total units across every state. */
  total: number;
  /** 0..1 completion ratio. */
  fraction: number;
  /** 0..100 integer percentage. */
  percent: number;
}

/**
 * Derive a progress ratio from a generation job's per-state counts. Returns
 * `null` when the job is absent or carries no countable work (an indeterminate
 * "starting" state). A `completed`/`failed` job always reads as 100%.
 */
export const getJobProgress = (
  job: CourseGenerationJob | null,
): JobProgress | null => {
  if (!job) return null;
  const total =
    job.queuedCount +
    job.processingCount +
    job.completedCount +
    job.failedCount +
    job.skippedCount;
  if (total <= 0) return null;
  const terminal = job.status === 'completed' || job.status === 'failed';
  const done = terminal
    ? total
    : job.completedCount + job.failedCount + job.skippedCount;
  const fraction = Math.min(1, Math.max(0, done / total));
  return { done, total, fraction, percent: Math.round(fraction * 100) };
};

const countByStatus = (suggestions: ItemSuggestion[]) => {
  let pending = 0;
  let accepted = 0;
  let rejected = 0;

  suggestions.forEach((suggestion) => {
    if (suggestion.status === 'pending') pending += 1;
    else if (suggestion.status === 'accepted') accepted += 1;
    else if (suggestion.status === 'rejected') rejected += 1;
  });

  return { pending, accepted, rejected, total: suggestions.length };
};

/**
 * Drives the course "item factory": generating draft content items per learning
 * objective, polling the items generation job, lazily loading suggestions for
 * the selected objective, and review actions (edit / accept / reject, plus
 * per-objective batch actions).
 *
 * Mirrors `useCourseFactory`, but the grouping axis is the learning objective
 * rather than the upload. `onItemsPromoted` is called after any acceptance so
 * the host can refresh per-objective item totals.
 */
export const useItemFactory = (
  courseIdentifier: string | null,
  onItemsPromoted?: () => void,
) => {
  const [suggestionsByObjectiveId, setSuggestionsByObjectiveId] = useState<
    Record<string, ItemSuggestion[]>
  >({});
  const [loadedSuggestionObjectiveIds, setLoadedSuggestionObjectiveIds] =
    useState<string[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(
    null,
  );
  const [job, setJob] = useState<CourseGenerationJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);
  const [busyObjectiveId, setBusyObjectiveId] = useState<string | null>(null);
  const [suggestionsLoadingObjectiveId, setSuggestionsLoadingObjectiveId] =
    useState<string | null>(null);
  // Pending suggestions left in the most recent generation job, across every
  // objective it spanned — drives the course-level "review batch" affordance.
  const [jobPendingCount, setJobPendingCount] = useState(0);
  const [isJobBatchBusy, setIsJobBatchBusy] = useState(false);

  const pollAttemptsRef = useRef(0);
  // Latest job kept in a ref so mutation handlers can resync the batch count
  // without taking `job` as a dependency.
  const jobRef = useRef<CourseGenerationJob | null>(null);
  const courseScopeRef = useRef<CourseScopeToken>({
    courseIdentifier,
    version: 0,
  });

  if (courseScopeRef.current.courseIdentifier !== courseIdentifier) {
    courseScopeRef.current = {
      courseIdentifier,
      version: courseScopeRef.current.version + 1,
    };
  }

  const courseScope = courseScopeRef.current;

  const isCourseScopeActive = useCallback((scope: CourseScopeToken) => {
    return (
      courseScopeRef.current.version === scope.version &&
      courseScopeRef.current.courseIdentifier === scope.courseIdentifier
    );
  }, []);

  const suggestions = useMemo(
    () =>
      selectedObjectiveId
        ? suggestionsByObjectiveId[selectedObjectiveId] || []
        : [],
    [selectedObjectiveId, suggestionsByObjectiveId],
  );

  const fetchSuggestionsForObjective = useCallback(
    async (learningObjectiveId: string) => {
      if (!courseIdentifier) return [];
      const scope = courseScope;
      if (!isCourseScopeActive(scope)) return [];

      setSuggestionsLoadingObjectiveId(learningObjectiveId);
      setError(null);

      try {
        const firstPage = await courseAIService.listItemSuggestions(
          courseIdentifier,
          { learningObjectiveId, limit: SUGGESTION_PAGE_SIZE, page: 1 },
        );
        if (!isCourseScopeActive(scope)) return [];

        let items = firstPage.items || [];
        const total =
          typeof firstPage.total === 'number' ? firstPage.total : items.length;
        const totalPages = Math.ceil(total / SUGGESTION_PAGE_SIZE);

        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await courseAIService.listItemSuggestions(
            courseIdentifier,
            { learningObjectiveId, limit: SUGGESTION_PAGE_SIZE, page },
          );
          if (!isCourseScopeActive(scope)) return [];
          items = items.concat(nextPage.items || []);
        }

        setSuggestionsByObjectiveId((current) => ({
          ...current,
          [learningObjectiveId]: items,
        }));
        setLoadedSuggestionObjectiveIds((current) =>
          current.includes(learningObjectiveId)
            ? current
            : [...current, learningObjectiveId],
        );
        return items;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(
            getErrorMessage(
              err,
              'Unable to load item suggestions for the selected objective.',
            ),
          );
        }
        return null;
      } finally {
        if (isCourseScopeActive(scope)) {
          setSuggestionsLoadingObjectiveId((current) =>
            current === learningObjectiveId ? null : current,
          );
        }
      }
    },
    [courseIdentifier, courseScope, isCourseScopeActive],
  );

  /** Resync how many suggestions are still pending in the latest job. */
  const refreshJobPending = useCallback(async () => {
    const activeJob = jobRef.current;
    if (!courseIdentifier || !activeJob) {
      setJobPendingCount(0);
      return;
    }
    const scope = courseScope;
    try {
      const response = await courseAIService.listItemSuggestions(courseIdentifier, {
        jobId: activeJob.id,
        status: 'pending',
        limit: 1,
      });
      if (!isCourseScopeActive(scope)) return;
      setJobPendingCount(
        typeof response.total === 'number'
          ? response.total
          : response.items?.length ?? 0,
      );
    } catch {
      // Non-fatal: keep the previous count rather than surfacing an error.
    }
  }, [courseIdentifier, courseScope, isCourseScopeActive]);

  const refresh = useCallback(async () => {
    if (!courseIdentifier) return;
    const scope = courseScope;
    setIsLoading(true);
    setError(null);

    try {
      const latestJob = await courseAIService.getLatestGenerationJob(
        courseIdentifier,
        'items',
      );
      if (!isCourseScopeActive(scope)) return;
      setJob(latestJob);
      if (isJobActive(latestJob)) {
        pollAttemptsRef.current = 0;
        setIsPolling(true);
      }
      if (selectedObjectiveId) {
        await fetchSuggestionsForObjective(selectedObjectiveId);
      }
    } catch (err) {
      if (isCourseScopeActive(scope)) {
        setError(getErrorMessage(err, 'Unable to load the item factory.'));
      }
    } finally {
      if (isCourseScopeActive(scope)) {
        setIsLoading(false);
      }
    }
  }, [
    courseIdentifier,
    courseScope,
    fetchSuggestionsForObjective,
    isCourseScopeActive,
    selectedObjectiveId,
  ]);

  // Reset whenever the selected course changes.
  useEffect(() => {
    setSuggestionsByObjectiveId({});
    setLoadedSuggestionObjectiveIds([]);
    setSelectedObjectiveId(null);
    setJob(null);
    setError(null);
    setIsLoading(false);
    setIsGenerating(false);
    setIsPolling(false);
    setBusySuggestionId(null);
    setBusyObjectiveId(null);
    setSuggestionsLoadingObjectiveId(null);
    setJobPendingCount(0);
    setIsJobBatchBusy(false);
    pollAttemptsRef.current = 0;

    if (!courseIdentifier) return;

    let isCancelled = false;
    const scope = courseScope;

    const loadLatestJob = async () => {
      try {
        const latestJob = await courseAIService.getLatestGenerationJob(
          courseIdentifier,
          'items',
        );
        if (isCancelled || !isCourseScopeActive(scope)) return;
        setJob(latestJob);
        if (isJobActive(latestJob)) {
          pollAttemptsRef.current = 0;
          setIsPolling(true);
        }
      } catch (err) {
        if (!isCancelled && isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to load the item factory.'));
        }
      }
    };

    void loadLatestJob();

    return () => {
      isCancelled = true;
    };
  }, [courseIdentifier, courseScope, isCourseScopeActive]);

  // Selecting an objective lazily loads its suggestions.
  useEffect(() => {
    if (!selectedObjectiveId) return;
    if (loadedSuggestionObjectiveIds.includes(selectedObjectiveId)) return;
    void fetchSuggestionsForObjective(selectedObjectiveId);
  }, [
    fetchSuggestionsForObjective,
    loadedSuggestionObjectiveIds,
    selectedObjectiveId,
  ]);

  // While an items job is active, poll it. When it completes, reload the
  // selected objective's suggestions.
  useEffect(() => {
    if (!isPolling || !courseIdentifier) return;
    const scope = courseScope;

    const timer = window.setInterval(async () => {
      pollAttemptsRef.current += 1;

      try {
        const latestJob = await courseAIService.getLatestGenerationJob(
          courseIdentifier,
          'items',
        );
        if (!isCourseScopeActive(scope)) return;
        setJob(latestJob);

        const stillActive = isJobActive(latestJob);
        if (!stillActive || pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false);
          setIsGenerating(false);
          pollAttemptsRef.current = 0;
          if (latestJob?.status === 'completed' && selectedObjectiveId) {
            await fetchSuggestionsForObjective(selectedObjectiveId);
          }
        }
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to poll the item factory.'));
          if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
            setIsPolling(false);
            setIsGenerating(false);
            pollAttemptsRef.current = 0;
          }
        }
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [
    courseIdentifier,
    courseScope,
    fetchSuggestionsForObjective,
    isCourseScopeActive,
    isPolling,
    selectedObjectiveId,
  ]);

  // Keep the job ref current and resync the batch count once a job completes.
  useEffect(() => {
    jobRef.current = job;
    if (job?.status === 'completed') {
      void refreshJobPending();
    } else {
      setJobPendingCount(0);
    }
  }, [job, refreshJobPending]);

  const selectObjective = useCallback((learningObjectiveId: string | null) => {
    setSelectedObjectiveId(learningObjectiveId);
    setError(null);
  }, []);

  const generate = useCallback(
    async (request: GenerateItemSuggestionsRequest) => {
      const targetedObjectiveIds = request.learningObjectiveIds ?? [];
      if (!courseIdentifier || targetedObjectiveIds.length === 0) return;
      const scope = courseScope;
      setIsGenerating(true);
      setError(null);
      try {
        const createdJob = await courseAIService.generateItemSuggestions(
          courseIdentifier,
          request,
        );
        if (!isCourseScopeActive(scope)) return;
        setJob(createdJob);
        // Drop cached suggestions for the targeted objectives so the new
        // generation is fetched fresh once the job completes.
        setSuggestionsByObjectiveId((current) => {
          const next = { ...current };
          targetedObjectiveIds.forEach((id) => delete next[id]);
          return next;
        });
        setLoadedSuggestionObjectiveIds((current) =>
          current.filter((id) => !targetedObjectiveIds.includes(id)),
        );
        pollAttemptsRef.current = 0;
        setIsPolling(true);
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to start item generation.'));
          setIsGenerating(false);
        }
      }
    },
    [courseIdentifier, courseScope, isCourseScopeActive],
  );

  const updateSuggestionInCache = useCallback(
    (
      suggestion: ItemSuggestion,
      update: (current: ItemSuggestion) => ItemSuggestion,
    ) => {
      const objectiveId = suggestion.learningObjectiveId;
      setSuggestionsByObjectiveId((current) => {
        const objectiveSuggestions = current[objectiveId] || [];
        if (objectiveSuggestions.length === 0) return current;

        return {
          ...current,
          [objectiveId]: objectiveSuggestions.map((item) =>
            item.id === suggestion.id ? update(item) : item,
          ),
        };
      });
    },
    [],
  );

  const patchSuggestion = useCallback(
    async (
      suggestion: ItemSuggestion,
      draft: Partial<ItemSuggestionDraft>,
    ) => {
      const scope = courseScope;
      setBusySuggestionId(suggestion.id);
      setError(null);
      try {
        const updated = await courseAIService.patchItemSuggestion(
          suggestion.identifier || suggestion.id,
          draft,
        );
        if (!isCourseScopeActive(scope)) return false;
        updateSuggestionInCache(suggestion, (item) => ({ ...item, ...updated }));
        return true;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to update this suggestion.'));
        }
        return false;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusySuggestionId(null);
        }
      }
    },
    [courseScope, isCourseScopeActive, updateSuggestionInCache],
  );

  const acceptSuggestion = useCallback(
    async (suggestion: ItemSuggestion) => {
      const scope = courseScope;
      setBusySuggestionId(suggestion.id);
      setError(null);
      try {
        const result = await courseAIService.acceptItemSuggestion(
          suggestion.identifier || suggestion.id,
        );
        if (!isCourseScopeActive(scope)) return false;
        updateSuggestionInCache(suggestion, (item) => ({
          ...item,
          status: 'accepted',
          acceptedItemId: result.itemId,
          ...(result.suggestion || {}),
        }));
        void refreshJobPending();
        onItemsPromoted?.();
        return true;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to accept this suggestion.'));
          // 409 means the row is stale - refresh to resync.
          if ((err as { status?: number })?.status === 409) void refresh();
        }
        return false;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusySuggestionId(null);
        }
      }
    },
    [
      courseScope,
      isCourseScopeActive,
      onItemsPromoted,
      refresh,
      refreshJobPending,
      updateSuggestionInCache,
    ],
  );

  const rejectSuggestion = useCallback(
    async (suggestion: ItemSuggestion) => {
      const scope = courseScope;
      setBusySuggestionId(suggestion.id);
      setError(null);
      try {
        const updated = await courseAIService.rejectItemSuggestion(
          suggestion.identifier || suggestion.id,
        );
        if (!isCourseScopeActive(scope)) return false;
        updateSuggestionInCache(suggestion, (item) => ({
          ...item,
          status: 'rejected',
          ...updated,
        }));
        void refreshJobPending();
        return true;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to reject this suggestion.'));
          if ((err as { status?: number })?.status === 409) void refresh();
        }
        return false;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusySuggestionId(null);
        }
      }
    },
    [
      courseScope,
      isCourseScopeActive,
      refresh,
      refreshJobPending,
      updateSuggestionInCache,
    ],
  );

  const acceptAllForObjective = useCallback(
    async (group: ObjectiveGroup) => {
      const scope = courseScope;
      setBusyObjectiveId(group.learningObjectiveId);
      setError(null);
      try {
        const result = await courseAIService.acceptAllForObjective(
          group.learningObjectiveId,
        );
        if (!isCourseScopeActive(scope)) return null;
        await fetchSuggestionsForObjective(group.learningObjectiveId);
        if (!isCourseScopeActive(scope)) return null;
        void refreshJobPending();
        if (result.accepted > 0) onItemsPromoted?.();
        return result;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(
            getErrorMessage(
              err,
              'Unable to accept all suggestions for this objective.',
            ),
          );
        }
        return null;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusyObjectiveId(null);
        }
      }
    },
    [
      courseScope,
      fetchSuggestionsForObjective,
      isCourseScopeActive,
      onItemsPromoted,
      refreshJobPending,
    ],
  );

  const rejectAllForObjective = useCallback(
    async (group: ObjectiveGroup) => {
      const scope = courseScope;
      setBusyObjectiveId(group.learningObjectiveId);
      setError(null);
      try {
        const result = await courseAIService.rejectAllForObjective(
          group.learningObjectiveId,
        );
        if (!isCourseScopeActive(scope)) return null;
        await fetchSuggestionsForObjective(group.learningObjectiveId);
        if (!isCourseScopeActive(scope)) return null;
        void refreshJobPending();
        return result;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(
            getErrorMessage(
              err,
              'Unable to reject all suggestions for this objective.',
            ),
          );
        }
        return null;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusyObjectiveId(null);
        }
      }
    },
    [
      courseScope,
      fetchSuggestionsForObjective,
      isCourseScopeActive,
      refreshJobPending,
    ],
  );

  /** Reload every objective whose suggestions are currently cached. */
  const reloadLoadedObjectives = useCallback(async () => {
    await Promise.all(
      loadedSuggestionObjectiveIds.map((id) => fetchSuggestionsForObjective(id)),
    );
  }, [fetchSuggestionsForObjective, loadedSuggestionObjectiveIds]);

  /** Accept every pending suggestion produced by the latest generation job. */
  const acceptAllForJob = useCallback(async () => {
    const activeJob = jobRef.current;
    if (!activeJob) return null;
    const scope = courseScope;
    setIsJobBatchBusy(true);
    setError(null);
    try {
      const result = await courseAIService.acceptAllForJob(activeJob.identifier);
      if (!isCourseScopeActive(scope)) return null;
      await reloadLoadedObjectives();
      if (!isCourseScopeActive(scope)) return null;
      void refreshJobPending();
      if (result.accepted > 0) onItemsPromoted?.();
      return result;
    } catch (err) {
      if (isCourseScopeActive(scope)) {
        setError(
          getErrorMessage(err, 'Unable to accept this batch of suggestions.'),
        );
      }
      return null;
    } finally {
      if (isCourseScopeActive(scope)) {
        setIsJobBatchBusy(false);
      }
    }
  }, [
    courseScope,
    isCourseScopeActive,
    onItemsPromoted,
    refreshJobPending,
    reloadLoadedObjectives,
  ]);

  /** Reject every pending suggestion produced by the latest generation job. */
  const rejectAllForJob = useCallback(async () => {
    const activeJob = jobRef.current;
    if (!activeJob) return null;
    const scope = courseScope;
    setIsJobBatchBusy(true);
    setError(null);
    try {
      const result = await courseAIService.rejectAllForJob(activeJob.identifier);
      if (!isCourseScopeActive(scope)) return null;
      await reloadLoadedObjectives();
      if (!isCourseScopeActive(scope)) return null;
      void refreshJobPending();
      return result;
    } catch (err) {
      if (isCourseScopeActive(scope)) {
        setError(
          getErrorMessage(err, 'Unable to reject this batch of suggestions.'),
        );
      }
      return null;
    } finally {
      if (isCourseScopeActive(scope)) {
        setIsJobBatchBusy(false);
      }
    }
  }, [
    courseScope,
    isCourseScopeActive,
    refreshJobPending,
    reloadLoadedObjectives,
  ]);

  const buildGroup = useCallback(
    (learningObjectiveId: string): ObjectiveGroup => {
      const groupSuggestions =
        suggestionsByObjectiveId[learningObjectiveId] || [];
      const suggestionCounts = countByStatus(groupSuggestions);
      const suggestionsLoaded =
        loadedSuggestionObjectiveIds.includes(learningObjectiveId);
      const isLoadingSuggestions =
        suggestionsLoadingObjectiveId === learningObjectiveId;

      let status: ObjectiveGroupStatus;
      if (job?.status === 'failed') status = 'failed';
      else if (isGenerating || isJobActive(job)) status = 'generating';
      else if (suggestionsLoaded && groupSuggestions.length === 0)
        status = 'empty';
      else if (suggestionsLoaded) status = 'ready';
      else status = 'idle';

      return {
        learningObjectiveId,
        status,
        suggestions: groupSuggestions,
        suggestionsLoaded,
        isLoadingSuggestions,
        pendingCount: suggestionCounts.pending,
        acceptedCount: suggestionCounts.accepted,
        rejectedCount: suggestionCounts.rejected,
      };
    },
    [
      isGenerating,
      job,
      loadedSuggestionObjectiveIds,
      suggestionsByObjectiveId,
      suggestionsLoadingObjectiveId,
    ],
  );

  const selectedGroup = useMemo(
    () => (selectedObjectiveId ? buildGroup(selectedObjectiveId) : null),
    [buildGroup, selectedObjectiveId],
  );

  const stats = useMemo(() => countByStatus(suggestions), [suggestions]);

  const filterByStatus = useCallback(
    (status: SuggestionStatus) =>
      suggestions.filter((suggestion) => suggestion.status === status),
    [suggestions],
  );

  return {
    suggestions,
    selectedObjectiveId,
    selectedGroup,
    buildGroup,
    job,
    stats,
    isLoading,
    isGenerating,
    isPolling,
    isLoadingSuggestions:
      Boolean(selectedObjectiveId) &&
      suggestionsLoadingObjectiveId === selectedObjectiveId,
    error,
    busySuggestionId,
    busyObjectiveId,
    jobPendingCount,
    isJobBatchBusy,
    clearError: () => setError(null),
    refresh,
    selectObjective,
    generate,
    filterByStatus,
    patchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    acceptAllForObjective,
    rejectAllForObjective,
    acceptAllForJob,
    rejectAllForJob,
  };
};

export type ItemFactory = ReturnType<typeof useItemFactory>;
