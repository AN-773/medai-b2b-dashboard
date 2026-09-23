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
import { isJobRunning } from './planUtils';

/** Progress feed poll interval (contract: ~3 s while the Progress step is visible). */
export const PROGRESS_POLL_MS = 3000;
const MAX_EVENTS_KEPT = 300;

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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const jobIdentifierRef = useRef<string | null>(initialJob?.identifier ?? null);
  const lastSeqRef = useRef(0);
  const onJobChangeRef = useRef(onJobChange);
  onJobChangeRef.current = onJobChange;

  const applyJob = useCallback((next: ModuleGenerationJob | null) => {
    if (next?.identifier !== jobIdentifierRef.current) {
      jobIdentifierRef.current = next?.identifier ?? null;
      lastSeqRef.current = 0;
      setEvents([]);
    }
    setJob(next);
    onJobChangeRef.current?.(next);
  }, []);

  const loadJob = useCallback(
    async (jobIdentifier: string) => {
      jobIdentifierRef.current = jobIdentifier;
      const detail = await moduleGenerationService.getJob(jobIdentifier);
      if (jobIdentifierRef.current !== jobIdentifier) return null;
      applyJob(detail);
      return detail;
    },
    [applyJob],
  );

  // Resume the job the wizard was opened with.
  useEffect(() => {
    if (!initialJob) return;
    let active = true;
    setIsLoading(true);
    loadJob(initialJob.identifier)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(
    async (options: ModuleGenerationOptions) => {
      setIsStarting(true);
      setError(null);
      setNotice(null);
      try {
        const created = await moduleGenerationService.startGeneration(courseIdentifier, options);
        await loadJob(created.identifier);
      } catch (startError) {
        const openJob = openJobFromConflict(startError);
        if (openJob) {
          setNotice(
            'This course already has an AI draft in progress or awaiting review, so we opened it instead.',
          );
          try {
            await loadJob(openJob.identifier);
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

  const running = isJobRunning(job);
  const jobIdentifier = job?.identifier ?? null;

  // Progress polling: the detail (status / stage) and the event feed. Runs one
  // round for a finished job so its end-state feed is shown too.
  useEffect(() => {
    if (!jobIdentifier) return;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const detail = running ? await moduleGenerationService.getJob(jobIdentifier) : null;
        const page = await moduleGenerationService.listEvents(jobIdentifier, {
          afterSeq: lastSeqRef.current,
        });
        if (cancelled || jobIdentifierRef.current !== jobIdentifier) return;
        if (page.items.length > 0) {
          lastSeqRef.current = page.lastSeq;
          setEvents((current) => [...current, ...page.items].slice(-MAX_EVENTS_KEPT));
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
    error,
    notice,
    setNotice,
    start,
    cancel,
    reset,
    /** Replace the job after the review step reloaded or changed it. */
    applyJob,
    reload: loadJob,
  };
};
