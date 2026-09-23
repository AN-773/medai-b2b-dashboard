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
import { normalizePlan, validateModulePlan } from './planUtils';

/** Edits are saved this long after the last change. */
const AUTOSAVE_DELAY_MS = 1200;

export type PlanSaveState = 'saved' | 'dirty' | 'saving' | 'invalid' | 'error';

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
 * - `stale_ids` (409, from save or accept): keep the ids so the tree can
 *   highlight the affected sessions and items; removing them clears it.
 * - `400`: keep the server's `issues` next to the local validation.
 */
export const useModulePlanEditor = ({
  job,
  onJobReloaded,
  onAccepted,
  onDiscarded,
}: UseModulePlanEditorArgs) => {
  const jobIdentifier = job.identifier;
  const [plan, setPlanState] = useState<ModulePlan>(() =>
    normalizePlan(job.plan ?? { modules: [] }),
  );
  const [saveState, setSaveState] = useState<PlanSaveState>('saved');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [staleIds, setStaleIds] = useState<Set<string>>(() => new Set());
  const [serverIssues, setServerIssues] = useState<ModulePlanIssue[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const planRef = useRef(plan);
  const versionRef = useRef<number>(job.version ?? 1);
  const dirtyRef = useRef(false);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);

  const callbacksRef = useRef({ onJobReloaded, onAccepted, onDiscarded });
  callbacksRef.current = { onJobReloaded, onAccepted, onDiscarded };

  const localIssues = useMemo(() => validateModulePlan(plan), [plan]);

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
        setStaleIds(new Set(conflict.staleIds ?? []));
        setServerIssues(conflict.issues ?? []);
        setMessage({
          tone: 'error',
          text:
            action === 'accept'
              ? 'Nothing was created: some items or objectives in this draft were deleted or rejected since it was made. Remove the highlighted items or sessions, then accept again.'
              : 'Some items or objectives in this draft were deleted or rejected since it was made. Remove the highlighted items or sessions to save.',
        });
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
    [reload],
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
        setServerIssues([]);
        setMessage((current) => (current?.tone === 'error' ? null : current));
        setSaveState(dirtyRef.current ? 'dirty' : 'saved');
        return true;
      } catch (error) {
        if (!mountedRef.current) return false;
        // The edit is still unsaved unless a reload replaced it.
        dirtyRef.current = true;
        const handled = await handlePlanError(error, 'save');
        if (!handled) {
          setMessage({
            tone: 'error',
            text: moduleGenerationErrorMessage(error, 'Could not save your changes.'),
          });
        }
        setSaveState(dirtyRef.current ? 'error' : 'saved');
        return false;
      }
    })();
    savingRef.current = request;
    const ok = await request;
    savingRef.current = null;
    if (ok && dirtyRef.current && mountedRef.current) {
      timerRef.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    }
    return ok;
  }, [handlePlanError, jobIdentifier]);

  /** Apply an edit locally and schedule a save. */
  const edit = useCallback(
    (update: (current: ModulePlan) => ModulePlan) => {
      const next = update(planRef.current);
      if (next === planRef.current) return;
      planRef.current = next;
      dirtyRef.current = true;
      setPlanState(next);
      window.clearTimeout(timerRef.current);
      if (validateModulePlan(next).length > 0) {
        setSaveState('invalid');
        return;
      }
      setSaveState('dirty');
      timerRef.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  const accept = useCallback(async () => {
    setMessage(null);
    const saved = await flush();
    if (!saved) return;
    setIsAccepting(true);
    try {
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

  // Best-effort save of pending edits when the wizard closes.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timerRef.current);
      if (dirtyRef.current && validateModulePlan(planRef.current).length === 0) {
        void moduleGenerationService
          .updatePlan(jobIdentifier, { plan: planRef.current, version: versionRef.current })
          .catch(() => undefined);
      }
    };
  }, [jobIdentifier]);

  return {
    plan,
    saveState,
    message,
    dismissMessage: () => setMessage(null),
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
