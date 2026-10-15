/**
 * Pure helpers for AI module generation: job lifecycle predicates, plan
 * validation (mirrors the server rules in `contracts/course-ai-contract.md`,
 * "PUT plan") and immutable plan edits used by the review tree.
 */

import type { CourseGenerationJob } from '@/types/CourseAITypes';
import { identifierOf } from '@/utils/resourceId';
import type {
  ModulePlan,
  ModulePlanIssue,
  ModulePlanItemRef,
  ModulePlanModule,
  ModulePlanSession,
} from '@/types/ModuleGenerationTypes';

export const MAX_PLAN_TITLE_LENGTH = 120;
export const MAX_INSTRUCTIONS_LENGTH = 4000;

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

type JobLifecycle = Pick<CourseGenerationJob, 'status' | 'reviewState'>;

/** `queued` or `processing`: the worker still owns the job. */
export const isJobRunning = (job: JobLifecycle | null | undefined) =>
  job?.status === 'queued' || job?.status === 'processing';

/** A draft the teacher has not accepted or discarded yet. */
export const isJobAwaitingReview = (job: JobLifecycle | null | undefined) =>
  job?.status === 'completed' && job.reviewState === 'awaiting_review';

/** Matches the server's `open=true` filter. */
export const isJobOpen = (job: JobLifecycle | null | undefined) =>
  isJobRunning(job) || isJobAwaitingReview(job);

/** Job route identifier: `identifier`, or the last path segment of `id`. */
export const jobIdentifierOf = (job: Pick<CourseGenerationJob, 'id' | 'identifier'>) =>
  identifierOf(job);

/**
 * A `completed` job whose draft has not been returned yet: no `reviewState`,
 * or awaiting review without a `plan`. Refetch instead of opening Review.
 */
export const isJobDraftIncomplete = (
  job: (JobLifecycle & { plan?: ModulePlan | null }) | null | undefined,
) =>
  job?.status === 'completed' &&
  (!job.reviewState || (job.reviewState === 'awaiting_review' && !job.plan));

export type WizardStep = 'options' | 'progress' | 'review' | 'done';

/** Which wizard step shows a given job. */
export const wizardStepForJob = (job: JobLifecycle | null | undefined): WizardStep => {
  if (!job) return 'options';
  if (isJobRunning(job)) return 'progress';
  if (job.status === 'failed' || job.status === 'cancelled') return 'progress';
  if (job.status === 'completed') {
    if (job.reviewState === 'accepted') return 'done';
    if (job.reviewState === 'discarded') return 'options';
    return 'review';
  }
  return 'options';
};

// ---------------------------------------------------------------------------
// Item refs
// ---------------------------------------------------------------------------

/** The id an item ref points at (existing item or job suggestion). */
export const refId = (ref: ModulePlanItemRef): string =>
  (ref.itemId ?? ref.itemSuggestionId ?? '').trim();

export const isSuggestionRef = (ref: ModulePlanItemRef) =>
  Boolean(ref.itemSuggestionId && !ref.itemId);

/** Every id a session depends on; used to highlight `staleIds`. */
export const sessionDependencyIds = (session: ModulePlanSession): string[] => [
  ...session.items.map(refId),
  ...(session.learningObjectiveIds ?? []),
  ...(session.sourceFileIds ?? []),
];

// ---------------------------------------------------------------------------
// Validation (client-side mirror of the server rules)
// ---------------------------------------------------------------------------

const titleIssue = (
  title: string,
  path: string,
  label: string,
): ModulePlanIssue | null => {
  const trimmed = title.trim();
  if (!trimmed) {
    return { code: 'missing_title', path, message: `${label} needs a title.` };
  }
  if (trimmed.length > MAX_PLAN_TITLE_LENGTH) {
    return {
      code: 'title_too_long',
      path,
      message: `${label} title is longer than ${MAX_PLAN_TITLE_LENGTH} characters.`,
    };
  }
  return null;
};

/**
 * Structural checks the server also runs. Id existence is only checked on the
 * server (it reports those as `staleIds`).
 */
export const validateModulePlan = (plan: ModulePlan): ModulePlanIssue[] => {
  const issues: ModulePlanIssue[] = [];
  if (plan.modules.length === 0) {
    issues.push({ code: 'empty_plan', path: 'modules', message: 'Keep at least one module.' });
  }
  const seen = new Set<string>();
  plan.modules.forEach((module, mi) => {
    const modulePath = `modules[${mi}]`;
    const moduleTitle = titleIssue(module.title, modulePath, `Module ${mi + 1}`);
    if (moduleTitle) issues.push(moduleTitle);
    if (module.sessions.length === 0) {
      issues.push({
        code: 'empty_module',
        path: modulePath,
        message: `Module ${mi + 1} has no sessions. Add one or delete the module.`,
      });
    }
    module.sessions.forEach((session, si) => {
      const sessionPath = `${modulePath}.sessions[${si}]`;
      const sessionTitle = titleIssue(session.title, sessionPath, `Session ${mi + 1}.${si + 1}`);
      if (sessionTitle) issues.push(sessionTitle);
      if (session.items.length === 0) {
        issues.push({
          code: 'empty_session',
          path: sessionPath,
          message: `Session ${mi + 1}.${si + 1} has no items. Move an item into it or delete it.`,
        });
      }
      session.items.forEach((ref, ii) => {
        const itemPath = `${sessionPath}.items[${ii}]`;
        const hasItem = Boolean(ref.itemId?.trim());
        const hasSuggestion = Boolean(ref.itemSuggestionId?.trim());
        if (hasItem === hasSuggestion) {
          issues.push({
            code: 'invalid_item_ref',
            path: itemPath,
            message: 'Each item must reference exactly one item or suggestion.',
          });
          return;
        }
        const id = refId(ref);
        if (seen.has(id)) {
          issues.push({
            code: 'duplicate_item',
            path: itemPath,
            id,
            message: 'An item can appear in only one session.',
          });
        }
        seen.add(id);
      });
    });
  });
  return issues;
};

/** `modules[1].sessions[2].items[0]` → `{ module: 1, session: 2 }`. */
export const parseIssuePath = (path: string): { module?: number; session?: number } => {
  const module = /modules\[(\d+)\]/.exec(path);
  const session = /sessions\[(\d+)\]/.exec(path);
  return {
    module: module ? Number(module[1]) : undefined,
    session: session ? Number(session[1]) : undefined,
  };
};

// ---------------------------------------------------------------------------
// Immutable edits. Every edit renumbers `order` to 1..n.
// ---------------------------------------------------------------------------

const renumber = (plan: ModulePlan): ModulePlan => ({
  ...plan,
  modules: plan.modules.map((module, mi) => ({
    ...module,
    order: mi + 1,
    sessions: module.sessions.map((session, si) => ({ ...session, order: si + 1 })),
  })),
});

/** Sort by `order` and renumber; use on plans received from the server. */
export const normalizePlan = (plan: ModulePlan): ModulePlan =>
  renumber({
    ...plan,
    modules: [...plan.modules]
      .sort((left, right) => left.order - right.order)
      .map((module) => ({
        ...module,
        sessions: [...module.sessions]
          .sort((left, right) => left.order - right.order)
          .map((session) => ({ ...session, items: [...session.items] })),
      })),
  });

const updateModule = (
  plan: ModulePlan,
  mi: number,
  update: (module: ModulePlanModule) => ModulePlanModule,
): ModulePlan =>
  renumber({
    ...plan,
    modules: plan.modules.map((module, index) => (index === mi ? update(module) : module)),
  });

const updateSession = (
  plan: ModulePlan,
  mi: number,
  si: number,
  update: (session: ModulePlanSession) => ModulePlanSession,
): ModulePlan =>
  updateModule(plan, mi, (module) => ({
    ...module,
    sessions: module.sessions.map((session, index) =>
      index === si ? update(session) : session,
    ),
  }));

const moveWithin = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  const target = Math.max(0, Math.min(to > from ? to - 1 : to, next.length));
  next.splice(target, 0, moved);
  return next;
};

export const renameModule = (plan: ModulePlan, mi: number, title: string) =>
  updateModule(plan, mi, (module) => ({ ...module, title }));

export const renameSession = (plan: ModulePlan, mi: number, si: number, title: string) =>
  updateSession(plan, mi, si, (session) => ({ ...session, title }));

export const deleteModule = (plan: ModulePlan, mi: number) =>
  renumber({ ...plan, modules: plan.modules.filter((_, index) => index !== mi) });

export const deleteSession = (plan: ModulePlan, mi: number, si: number) =>
  updateModule(plan, mi, (module) => ({
    ...module,
    sessions: module.sessions.filter((_, index) => index !== si),
  }));

export const deleteItem = (plan: ModulePlan, mi: number, si: number, ii: number) =>
  updateSession(plan, mi, si, (session) => ({
    ...session,
    items: session.items.filter((_, index) => index !== ii),
  }));

/** Move module `from` so it lands before the module currently at `to` (`to = length` appends). */
export const moveModule = (plan: ModulePlan, from: number, to: number) =>
  from === to ? plan : renumber({ ...plan, modules: moveWithin(plan.modules, from, to) });

/**
 * Move a session to module `toModule`, before the session currently at
 * `toIndex` there (`toIndex = length` appends).
 */
export const moveSession = (
  plan: ModulePlan,
  from: { module: number; session: number },
  toModule: number,
  toIndex: number,
): ModulePlan => {
  if (from.module === toModule) {
    return updateModule(plan, toModule, (module) => ({
      ...module,
      sessions: moveWithin(module.sessions, from.session, toIndex),
    }));
  }
  const moving = plan.modules[from.module]?.sessions[from.session];
  if (!moving) return plan;
  return renumber({
    ...plan,
    modules: plan.modules.map((module, mi) => {
      if (mi === from.module) {
        return { ...module, sessions: module.sessions.filter((_, si) => si !== from.session) };
      }
      if (mi === toModule) {
        const sessions = [...module.sessions];
        sessions.splice(Math.min(toIndex, sessions.length), 0, moving);
        return { ...module, sessions };
      }
      return module;
    }),
  });
};

/** Move an item to the end of another session. */
export const moveItem = (
  plan: ModulePlan,
  from: { module: number; session: number; item: number },
  to: { module: number; session: number },
): ModulePlan => {
  if (from.module === to.module && from.session === to.session) return plan;
  const ref = plan.modules[from.module]?.sessions[from.session]?.items[from.item];
  if (!ref) return plan;
  const removed = deleteItem(plan, from.module, from.session, from.item);
  return updateSession(removed, to.module, to.session, (session) => ({
    ...session,
    items: [...session.items, ref],
  }));
};

/** Stale ids a session carries as metadata (objectives and source files). */
export const staleSessionMetadataIds = (session: ModulePlanSession, staleIds: Set<string>) => ({
  objectives: (session.learningObjectiveIds ?? []).filter((id) => staleIds.has(id)),
  files: (session.sourceFileIds ?? []).filter((id) => staleIds.has(id)),
});

const withoutIds = (ids: string[] | undefined, drop: Set<string>) =>
  ids ? ids.filter((id) => !drop.has(id)) : ids;

/** Drop every stale reference (items, objectives, files) from one session. */
export const removeStaleFromSession = (
  plan: ModulePlan,
  mi: number,
  si: number,
  staleIds: Set<string>,
): ModulePlan =>
  updateSession(plan, mi, si, (session) => ({
    ...session,
    items: session.items.filter((ref) => !staleIds.has(refId(ref))),
    learningObjectiveIds: withoutIds(session.learningObjectiveIds, staleIds),
    sourceFileIds: withoutIds(session.sourceFileIds, staleIds),
  }));

export interface StrippedSessionMetadata {
  session: string;
  objectives: number;
  files: number;
}

/**
 * Remove stale learning objective and source file ids from every session.
 * They are metadata only (accept stores titles, order and items), so this is
 * safe to do automatically; stale item refs are left for the teacher.
 */
export const stripStaleMetadata = (
  plan: ModulePlan,
  staleIds: Set<string>,
): { plan: ModulePlan; removed: StrippedSessionMetadata[] } => {
  const removed: StrippedSessionMetadata[] = [];
  const modules = plan.modules.map((module) => ({
    ...module,
    sessions: module.sessions.map((session) => {
      const stale = staleSessionMetadataIds(session, staleIds);
      if (stale.objectives.length === 0 && stale.files.length === 0) return session;
      removed.push({
        session: session.title,
        objectives: stale.objectives.length,
        files: stale.files.length,
      });
      return {
        ...session,
        learningObjectiveIds: withoutIds(session.learningObjectiveIds, staleIds),
        sourceFileIds: withoutIds(session.sourceFileIds, staleIds),
      };
    }),
  }));
  return { plan: removed.length > 0 ? { ...plan, modules } : plan, removed };
};

/** "2 objectives and 1 file from “Session A”; 1 objective from “Session B”". */
export const describeStrippedMetadata = (removed: StrippedSessionMetadata[]) =>
  removed
    .map(({ session, objectives, files }) => {
      const parts = [
        objectives > 0 ? `${objectives} objective${objectives === 1 ? '' : 's'}` : '',
        files > 0 ? `${files} file${files === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      return `${parts.join(' and ')} from “${session || 'Untitled session'}”`;
    })
    .join('; ');

export const countPlan =(plan: ModulePlan | null | undefined) => {
  const modules = plan?.modules ?? [];
  const sessions = modules.reduce((sum, module) => sum + module.sessions.length, 0);
  const items = modules.reduce(
    (sum, module) =>
      sum + module.sessions.reduce((inner, session) => inner + session.items.length, 0),
    0,
  );
  const newItems = modules.reduce(
    (sum, module) =>
      sum +
      module.sessions.reduce(
        (inner, session) => inner + session.items.filter(isSuggestionRef).length,
        0,
      ),
    0,
  );
  return { modules: modules.length, sessions, items, newItems };
};
