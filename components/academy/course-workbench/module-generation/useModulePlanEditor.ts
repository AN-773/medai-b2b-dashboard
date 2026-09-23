import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { moduleGenerationService } from '@/services/moduleGenerationService';
import {
  moduleGenerationErrorMessage,
  planConflictFrom,
  planValidationErrorFrom,
} from '@/services/moduleGenerationErrors';
import type {
  AcceptModulePlanResponse,
  ModuleGenerationJob,
  ModulePlan,
  ModulePlanIssue,
} from '@/types/ModuleGenerationTypes';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import {
  describeStrippedMetadata,
  jobIdentifierOf,
  normalizePlan,
  stripStaleMetadata,
  validateModulePlan,
} from './planUtils';

/** Edits are saved this long after the last change. */
const AUTOSAVE_DELAY_MS = 1200;

export type PlanSaveState = 'saved' | 'dirty' | 'saving' | 'invalid' | 'error';

/**
 * Saves still running after the review step unmounted (the wizard closed with
 * pending edits), by job identifier. Reopening the job waits for them so it
 * never reads a draft older than the one being written.
 */
const pendingCloseSaves = new Map<string, Promise<void>>();

export const waitForPendingPlanSave = (jobIdentifier: string) =>
  pendingCloseSaves.get(jobIdentifier) ?? Promise.resolve();

interface UseModulePlanEditorArgs {
  job: ModuleGenerationJob;
  /** The job was re-read from the server (stale version, already accepted, …). */
  onJobReloaded: (job: ModuleGenerationJob) => void;
  onAccepted: (response: AcceptModulePlanResponse) => void;
  onDiscarded: (job: CourseGenerationJob) => void;
}

/**
 * Local copy of a draft plan with debounced saves through `PUT plan`
 * (optimistic concurrency on `version`), plus accept and discard.
 *
 * - `stale_version` (409): the draft changed elsewhere; reload it and say so.
 * - `stale_ids` (409, from save or accept): stale learning objective and file
 *   ids are metadata, so they are stripped automatically (with a notice);
 *   stale item refs stay highlighted for the teacher to remove.
 * - `400`: keep the server's `issues` next to the local validation until the
 *   next edit (their paths go stale as soon as the tree changes).
 */
export const useModulePlanEditor = ({
  job,
  onJobReloaded,
  onAccepted,
  onDiscarded,
}: UseModulePlanEditorArgs) => {
  const jobIdentifier = jobIdentifierOf(job);
  const [plan, setPlanState] = useState<ModulePlan>(() =>
    normalizePlan(job.plan ?? { modules: [] }),
  );
  const [saveState, setSaveState] = useState<PlanSaveState>('saved');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [staleIds, setStaleIds] = useState<Set<string>>(() => new Set());
  /** What was stripped automatically after a `stale_ids` 409; kept apart from `message`. */
  const [strippedNotice, setStrippedNotice] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<ModulePlanIssue[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const planRef = useRef(plan);
  const versionRef = useRef<number>(job.version ?? 1);
  const dirtyRef = useRef(false);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const callbacksRef = useRef({ onJobReloaded, onAccepted, onDiscarded });
  callbacksRef.current = { onJobReloaded, onAccepted, onDiscarded };

  const localIssues = useMemo(() => validateModulePlan(plan), [plan]);

  const scheduleSave = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS);
  }, []);

  /** Apply a new plan locally, mark it dirty and (by default) schedule a save. */
  const applyLocal = useCallback(
    (next: ModulePlan, { save = true }: { save?: boolean } = {}) => {
      planRef.current = next;
      dirtyRef.current = true;
      setPlanState(next);
      setServerIssues([]);
      window.clearTimeout(timerRef.current);
      if (validateModulePlan(next).length > 0) {
        setSaveState('invalid');
        return;
      }
      setSaveState('dirty');
      if (save) scheduleSave();
    },
    [scheduleSave],
  );

  const replacePlan = useCallback((next: ModulePlan, version: number | null | undefined) => {
    const normalized = normalizePlan(next);
    planRef.current = normalized;
    versionRef.current = version ?? versionRef.current;
    dirtyRef.current = false;
    setPlanState(normalized);
    setSaveState('saved');
  }, []);

  const reload = useCallback(
    async (text: string | null) => {
      window.clearTimeout(timerRef.current);
      try {
        const detail = await moduleGenerationService.getJob(jobIdentifier);
        if (!mountedRef.current) return;
        if (detail.plan) replacePlan(detail.plan, detail.version);
        setServerIssues([]);
        if (text) setMessage({ tone: 'info', text });
        callbacksRef.current.onJobReloaded(detail);
      } catch (error) {
        if (mountedRef.current) {
          setMessage({
            tone: 'error',
            text: moduleGenerationErrorMessage(error, 'Could not reload the draft.'),
          });
        }
      }
    },
    [jobIdentifier, replacePlan],
  );

  /** Handle a 400 / 409 from save or accept. Returns true when handled. */
  const handlePlanError = useCallback(
    async (error: unknown, action: 'save' | 'accept') => {
      const conflict = planConflictFrom(error);
      if (conflict?.reason === 'stale_version') {
        await reload(
          'Someone else saved this draft since you opened it. We loaded their version; re-apply your last change if it is missing.',
        );
        return true;
      }
      if (conflict?.reason === 'stale_ids') {
        const stale = new Set(conflict.staleIds ?? []);
        setStaleIds(stale);
        setServerIssues(conflict.issues ?? []);
        const stripped = stripStaleMetadata(planRef.current, stale);
        const staleItemsLeft = planRef.current.modules.some((module) =>
          module.sessions.some((session) =>
            session.items.some((ref) => stale.has(ref.itemId ?? ref.itemSuggestionId ?? '')),
          ),
        );
        if (stripped.removed.length > 0) {
          setStrippedNotice(
            `Some learning objectives or files in this draft no longer exist, so we removed them from the sessions: ${describeStrippedMetadata(stripped.removed)}.`,
          );
          // Saving is pointless while stale items remain (it would 409 again);
          // the save after the teacher removes them includes this change.
          applyLocal(stripped.plan, { save: !staleItemsLeft });
        }
        if (staleItemsLeft) {
          setMessage({
            tone: 'error',
            text: `${action === 'accept' ? 'Nothing was created. ' : ''}Some items were deleted or rejected since the draft was made. Remove the highlighted items, then accept again.`,
          });
        } else {
          setMessage(
            action === 'accept'
              ? { tone: 'info', text: 'Nothing was created yet. Accept again once the draft is saved.' }
              : null,
          );
        }
        return true;
      }
      if (conflict?.reason === 'not_awaiting_review') {
        await reload('This draft was already accepted or discarded.');
        return true;
      }
      const validation = planValidationErrorFrom(error);
      if (validation) {
        setServerIssues(validation.issues);
        if (validation.staleIds?.length) setStaleIds(new Set(validation.staleIds));
        setMessage({ tone: 'error', text: validation.error || 'The draft is not valid yet.' });
        return true;
      }
      return false;
    },
    [applyLocal, reload],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timerRef.current);
    while (savingRef.current) {
      await savingRef.current;
    }
    if (!dirtyRef.current) return true;
    if (validateModulePlan(planRef.current).length > 0) {
      setSaveState('invalid');
      return false;
    }

    const snapshot = planRef.current;
    dirtyRef.current = false;
    setSaveState('saving');
    const request = (async () => {
      try {
        const draft = await moduleGenerationService.updatePlan(jobIdentifier, {
          plan: snapshot,
          version: versionRef.current,
        });
        versionRef.current = draft.version;
        if (!mountedRef.current) return true;
        setMessage((current) => (current?.tone === 'error' ? null : current));
        setSaveState(dirtyRef.current ? 'dirty' : 'saved');
        return true;
      } catch (error) {
        // The edit is still unsaved unless a reload replaces it.
        dirtyRef.current = true;
        if (!mountedRef.current) return false;
        const handled = await handlePlanError(error, 'save');
        if (!handled) {
          setMessage({
            tone: 'error',
            text: moduleGenerationErrorMessage(error, 'Could not save your changes.'),
          });
        }
        setSaveState((current) =>
          current === 'dirty' || current === 'invalid' ? current : dirtyRef.current ? 'error' : 'saved',
        );
        return false;
      }
    })();
    savingRef.current = request;
    const ok = await request;
    savingRef.current = null;
    if (ok && dirtyRef.current && mountedRef.current) scheduleSave();
    return ok;
  }, [handlePlanError, jobIdentifier, scheduleSave]);
  flushRef.current = flush;

  /** Apply an edit locally and schedule a save. */
  const edit = useCallback(
    (update: (current: ModulePlan) => ModulePlan) => {
      const next = update(planRef.current);
      if (next === planRef.current) return;
      applyLocal(next);
    },
    [applyLocal],
  );

  const accept = useCallback(async () => {
    // Lock the tree first so no edit can slip in between the save and accept.
    setIsAccepting(true);
    setMessage(null);
    try {
      // Save until nothing is pending: an edit committed while a save was in
      // flight (e.g. a title input blurring) marks the draft dirty again.
      do {
        const saved = await flush();
        if (!saved || !mountedRef.current) return;
      } while (dirtyRef.current);

      const response = await moduleGenerationService.accept(jobIdentifier, {
        version: versionRef.current,
      });
      if (!mountedRef.current) return;
      setStaleIds(new Set());
      callbacksRef.current.onAccepted(response);
    } catch (error) {
      if (!mountedRef.current) return;
      const handled = await handlePlanError(error, 'accept');
      if (!handled) {
        setMessage({
          tone: 'error',
          text: moduleGenerationErrorMessage(error, 'Could not create the modules.'),
        });
      }
    } finally {
      if (mountedRef.current) setIsAccepting(false);
    }
  }, [flush, handlePlanError, jobIdentifier]);

  const discard = useCallback(async () => {
    window.clearTimeout(timerRef.current);
    dirtyRef.current = false;
    setIsDiscarding(true);
    setMessage(null);
    try {
      const discarded = await moduleGenerationService.discard(jobIdentifier);
      if (mountedRef.current) callbacksRef.current.onDiscarded(discarded);
    } catch (error) {
      if (!mountedRef.current) return;
      const handled = await handlePlanError(error, 'save');
      if (!handled) {
        setMessage({
          tone: 'error',
          text: moduleGenerationErrorMessage(error, 'Could not discard the draft.'),
        });
      }
    } finally {
      if (mountedRef.current) setIsDiscarding(false);
    }
  }, [handlePlanError, jobIdentifier]);

  // When the wizard closes with pending edits, let any in-flight save settle,
  // then save what is still dirty with the version at that point.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timerRef.current);
      const inFlight = savingRef.current;
      if (!inFlight && !dirtyRef.current) return;
      const closeSave = (async () => {
        if (inFlight) await inFlight.catch(() => false);
        if (!dirtyRef.current || validateModulePlan(planRef.current).length > 0) return;
        dirtyRef.current = false;
        try {
          const draft = await moduleGenerationService.updatePlan(jobIdentifier, {
            plan: planRef.current,
            version: versionRef.current,
          });
          versionRef.current = draft.version;
        } catch {
          // Best effort: the wizard is closed and the draft on the server is intact.
        }
      })().finally(() => {
        if (pendingCloseSaves.get(jobIdentifier) === closeSave) pendingCloseSaves.delete(jobIdentifier);
      });
      pendingCloseSaves.set(jobIdentifier, closeSave);
    };
  }, [jobIdentifier]);

  return {
    plan,
    saveState,
    message,
    dismissMessage: () => setMessage(null),
    strippedNotice,
    dismissStrippedNotice: () => setStrippedNotice(null),
    staleIds,
    localIssues,
    serverIssues,
    isAccepting,
    isDiscarding,
    edit,
    save: flush,
    accept,
    discard,
  };
};
