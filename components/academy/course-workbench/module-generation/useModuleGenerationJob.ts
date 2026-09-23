import { useCallback, useEffect, useRef, useState } from 'react';
import { moduleGenerationService } from '@/services/moduleGenerationService';
import {
  moduleGenerationErrorMessage,
  openJobFromConflict,
} from '@/services/moduleGenerationErrors';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type {
  ModuleGenerationEvent,
  ModuleGenerationJob,
  ModuleGenerationOptions,
} from '@/types/ModuleGenerationTypes';
import { isJobDraftIncomplete, isJobRunning, jobIdentifierOf } from './planUtils';
import { waitForPendingPlanSave } from './useModulePlanEditor';

/** Progress feed poll interval (contract: ~3 s while the Progress step is visible). */
export const PROGRESS_POLL_MS = 3000;
/** Contract maximum per events request; pages are fetched until one is short. */
const EVENTS_PAGE_LIMIT = 500;
const MAX_EVENTS_KEPT = 1000;
/** Delay before re-reading a completed job whose draft was not returned yet. */
const INCOMPLETE_DRAFT_RETRY_MS = 1500;

interface UseModuleGenerationJobArgs {
  courseIdentifier: string;
  /** Job to resume (from the banner or a previous run), or `null` for a new one. */
  initialJob: CourseGenerationJob | null;
  /** Called whenever the job's lifecycle changes, so the banner stays in sync. */
  onJobChange?: (job: CourseGenerationJob | null) => void;
}

/**
 * Owns one modules job inside the wizard: loading its detail, starting and
 * cancelling it, and polling the detail and the event feed every 3 s while it
 * is queued or processing.
 *
 * The wizard mounts this only while it is open, so polling stops on close or
 * unmount; it also stops as soon as the job leaves `queued` / `processing`
 * (the wizard then shows Review or an end state instead of Progress).
 */
export const useModuleGenerationJob = ({
  courseIdentifier,
  initialJob,
  onJobChange,
}: UseModuleGenerationJobArgs) => {
  const [job, setJob] = useState<ModuleGenerationJob | null>(null);
  const [events, setEvents] = useState<ModuleGenerationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(initialJob));
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRefetchingDraft, setIsRefetchingDraft] = useState(false);
  const [retriedDraftFor, setRetriedDraftFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const jobIdentifierRef = useRef<string | null>(null);
  const lastSeqRef = useRef(0);
  const onJobChangeRef = useRef(onJobChange);
  onJobChangeRef.current = onJobChange;

  /** Point the hook at another job (or none), dropping the old feed. */
  const switchJob = useCallback((identifier: string | null) => {
    if (identifier === jobIdentifierRef.current) return;
    jobIdentifierRef.current = identifier;
    lastSeqRef.current = 0;
    setEvents([]);
  }, []);

  const applyJob = useCallback(
    (next: ModuleGenerationJob | null) => {
      switchJob(next ? jobIdentifierOf(next) : null);
      setJob(next);
      onJobChangeRef.current?.(next);
    },
    [switchJob],
  );

  const loadJob = useCallback(
    async (jobIdentifier: string) => {
      switchJob(jobIdentifier);
      // A save from a review step that just closed must land first.
      await waitForPendingPlanSave(jobIdentifier);
      const detail = await moduleGenerationService.getJob(jobIdentifier);
      if (jobIdentifierRef.current !== jobIdentifier) return null;
      applyJob(detail);
      return detail;
    },
    [applyJob, switchJob],
  );

  // Resume the job the wizard was opened with.
  useEffect(() => {
    if (!initialJob) return;
    let active = true;
    setIsLoading(true);
    loadJob(jobIdentifierOf(initialJob))
      .catch((loadError) => {
        if (active) setError(moduleGenerationErrorMessage(loadError, 'Could not load the generation job.'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // Only on mount: later changes come from this hook itself.
  }, []);

  const start = useCallback(
    async (options: ModuleGenerationOptions) => {
      setIsStarting(true);
      setError(null);
      setNotice(null);
      try {
        const created = await moduleGenerationService.startGeneration(courseIdentifier, options);
        await loadJob(jobIdentifierOf(created));
      } catch (startError) {
        const openJob = openJobFromConflict(startError);
        if (openJob) {
          setNotice(
            'This course already has an AI draft in progress or awaiting review, so we opened it instead.',
          );
          try {
            await loadJob(jobIdentifierOf(openJob));
          } catch (loadError) {
            setError(moduleGenerationErrorMessage(loadError, 'Could not load the open job.'));
          }
        } else {
          setError(moduleGenerationErrorMessage(startError, 'Could not start generating modules.'));
        }
      } finally {
        setIsStarting(false);
      }
    },
    [courseIdentifier, loadJob],
  );

  const cancel = useCallback(async () => {
    const identifier = jobIdentifierRef.current;
    if (!identifier) return;
    setIsCancelling(true);
    setError(null);
    try {
      await moduleGenerationService.cancel(identifier);
      await loadJob(identifier);
    } catch (cancelError) {
      // 409: it finished meanwhile; show whatever state it ended in.
      await loadJob(identifier).catch(() => undefined);
      setError(moduleGenerationErrorMessage(cancelError, 'Could not cancel the job.'));
    } finally {
      setIsCancelling(false);
    }
  }, [loadJob]);

  /** Back to the Options step (after a failed, cancelled or discarded job). */
  const reset = useCallback(() => {
    setError(null);
    setNotice(null);
    applyJob(null);
  }, [applyJob]);

  /** Re-read the current job (e.g. a completed job whose draft was missing). */
  const refetch = useCallback(async () => {
    const identifier = jobIdentifierRef.current;
    if (!identifier) return;
    setIsRefetchingDraft(true);
    try {
      await loadJob(identifier);
    } catch (loadError) {
      setError(moduleGenerationErrorMessage(loadError, 'Could not load the draft.'));
    } finally {
      setIsRefetchingDraft(false);
    }
  }, [loadJob]);

  const running = isJobRunning(job);
  const jobIdentifier = job ? jobIdentifierOf(job) : null;
  const draftIncomplete = isJobDraftIncomplete(job);

  // A completed job without its draft (or review state): refetch once.
  useEffect(() => {
    if (!draftIncomplete || !jobIdentifier || retriedDraftFor === jobIdentifier) return;
    const timer = window.setTimeout(() => {
      setRetriedDraftFor(jobIdentifier);
      void refetch();
    }, INCOMPLETE_DRAFT_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [draftIncomplete, jobIdentifier, refetch, retriedDraftFor]);

  // Progress polling: the detail (status / stage) and the event feed. Runs one
  // round for a finished job so its end-state feed is shown too.
  useEffect(() => {
    if (!jobIdentifier) return;
    let cancelled = false;
    let timer: number | undefined;

    const fetchNewEvents = async () => {
      const fetched: ModuleGenerationEvent[] = [];
      let afterSeq = lastSeqRef.current;
      // Page until a short page, so a long run never hides its last events.
      for (;;) {
        const page = await moduleGenerationService.listEvents(jobIdentifier, {
          afterSeq,
          limit: EVENTS_PAGE_LIMIT,
        });
        fetched.push(...page.items);
        if (page.items.length > 0) afterSeq = page.lastSeq;
        if (cancelled || page.items.length < EVENTS_PAGE_LIMIT) break;
      }
      return { fetched, afterSeq };
    };

    const tick = async () => {
      try {
        const detail = running ? await moduleGenerationService.getJob(jobIdentifier) : null;
        const { fetched, afterSeq } = await fetchNewEvents();
        if (cancelled || jobIdentifierRef.current !== jobIdentifier) return;
        if (fetched.length > 0) {
          lastSeqRef.current = afterSeq;
          setEvents((current) => [...current, ...fetched].slice(-MAX_EVENTS_KEPT));
        }
        if (detail) applyJob(detail);
        if (detail && !isJobRunning(detail)) return;
      } catch {
        // Transient; try again on the next tick.
      }
      if (!cancelled && running) timer = window.setTimeout(tick, PROGRESS_POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applyJob, jobIdentifier, running]);

  return {
    job,
    events,
    isLoading,
    isStarting,
    isCancelling,
    /** Completed, but the draft has not arrived yet: show loading, not Review. */
    awaitingDraft:
      draftIncomplete && (retriedDraftFor !== jobIdentifier || isRefetchingDraft),
    /** Still no draft after the retry. */
    draftUnavailable:
      draftIncomplete && retriedDraftFor === jobIdentifier && !isRefetchingDraft,
    error,
    notice,
    setNotice,
    start,
    cancel,
    reset,
    refetch,
    /** Replace the job after the review step reloaded or changed it. */
    applyJob,
  };
};
