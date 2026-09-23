import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GripVertical,
  Layers,
  Lightbulb,
  Pencil,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import type { ItemSuggestion } from '@/types/CourseAITypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type {
  ModulePlan,
  ModulePlanIssue,
  ModulePlanItemRef,
  ModulePlanSession,
} from '@/types/ModuleGenerationTypes';
import ConfirmationModal from '@/components/ConfirmationModal';
import {
  itemTitle,
  MODALITIES,
} from '@/components/academy/course-workbench/ObjectiveItemsList';
import type { SessionItemDetail } from '@/components/academy/course-workbench/SessionItemDetailModal';
import {
  deleteItem,
  deleteModule,
  deleteSession,
  MAX_PLAN_TITLE_LENGTH,
  moveItem,
  moveModule,
  moveSession,
  parseIssuePath,
  refId,
  renameModule,
  renameSession,
  sessionDependencyIds,
} from './planUtils';
import { suggestionTitle, suggestionToItemDetail } from './itemPreview';

type PlanEdit = (update: (plan: ModulePlan) => ModulePlan) => void;

type DragPayload =
  | { kind: 'module'; module: number }
  | { kind: 'session'; module: number; session: number }
  | { kind: 'item'; module: number; session: number; item: number };

type DropHint = { key: string; position: 'before' | 'after' | 'into' } | null;

interface PlanTreeProps {
  plan: ModulePlan;
  staleIds: Set<string>;
  issues: ModulePlanIssue[];
  /** Existing items by id: `undefined` while loading, `null` when unavailable. */
  existingItems: Record<string, BackendApiItem | null | undefined>;
  suggestionsById: Map<string, ItemSuggestion>;
  uploadNames: Map<string, string>;
  objectiveTitles: Map<string, string>;
  disabled: boolean;
  onEdit: PlanEdit;
  onPreview: (item: SessionItemDetail) => void;
}

const modalityByType = new Map(MODALITIES.map((modality) => [modality.type, modality] as const));

const hintClass = (hint: DropHint, key: string) => {
  if (!hint || hint.key !== key) return '';
  if (hint.position === 'before') return 'shadow-[inset_0_3px_0_0_#1BD183]';
  if (hint.position === 'after') return 'shadow-[inset_0_-3px_0_0_#1BD183]';
  return 'ring-2 ring-[#1BD183]/60 bg-emerald-50/60';
};

const halfOf = (event: React.DragEvent<HTMLElement>): 'before' | 'after' => {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
};

// ---------------------------------------------------------------------------
// Inline title editor
// ---------------------------------------------------------------------------

const InlineTitle: React.FC<{
  value: string;
  label: string;
  disabled: boolean;
  onCommit: (value: string) => void;
  className: string;
}> = ({ value, label, disabled, onCommit, className }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = !value.trim() || value.trim().length > MAX_PLAN_TITLE_LENGTH;

  if (draft !== null) {
    const commit = () => {
      if (draft !== value) onCommit(draft.trim() ? draft.trim() : draft);
      setDraft(null);
    };
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <input
          autoFocus
          value={draft}
          aria-label={label}
          maxLength={MAX_PLAN_TITLE_LENGTH + 20}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setDraft(null);
          }}
          className="min-w-0 flex-1 rounded-lg border border-[#1BD183] bg-white px-2.5 py-1 text-sm font-bold text-slate-900 outline-none ring-2 ring-[#1BD183]/15"
        />
        <span
          className={`flex-shrink-0 text-[10px] font-bold ${
            draft.trim().length > MAX_PLAN_TITLE_LENGTH ? 'text-rose-600' : 'text-slate-400'
          }`}
        >
          {draft.trim().length}/{MAX_PLAN_TITLE_LENGTH}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setDraft(value)}
      title="Rename"
      className={`group/title flex min-w-0 flex-1 items-center gap-1.5 text-left ${className}`}
    >
      <span className={`min-w-0 break-words ${invalid ? 'text-rose-600' : ''}`}>
        {value.trim() || 'Untitled'}
      </span>
      <Pencil size={12} className="flex-shrink-0 text-slate-300 opacity-0 transition group-hover/title:opacity-100" />
    </button>
  );
};

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

const PlanTree: React.FC<PlanTreeProps> = ({
  plan,
  staleIds,
  issues,
  existingItems,
  suggestionsById,
  uploadNames,
  objectiveTitles,
  disabled,
  onEdit,
  onPreview,
}) => {
  const dragRef = useRef<DragPayload | null>(null);
  const [hint, setHint] = useState<DropHint>(null);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'module'; module: number } | { kind: 'session'; module: number; session: number } | null
  >(null);

  const issuesByNode = useMemo(() => {
    const byNode = new Map<string, string[]>();
    issues.forEach((issue) => {
      const { module, session } = parseIssuePath(issue.path);
      if (module === undefined) return;
      // Item-level issues are shown on their session.
      const key = session === undefined ? `m:${module}` : `s:${module}:${session}`;
      byNode.set(key, [...(byNode.get(key) ?? []), issue.message]);
    });
    return byNode;
  }, [issues]);

  const updateHint = (next: DropHint) =>
    setHint((current) =>
      current?.key === next?.key && current?.position === next?.position ? current : next,
    );

  const startDrag = (payload: DragPayload) => (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    dragRef.current = payload;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', payload.kind);
    const card = event.currentTarget.closest('[data-drag-card]');
    if (card instanceof HTMLElement) event.dataTransfer.setDragImage(card, 16, 16);
  };

  const endDrag = () => {
    dragRef.current = null;
    setHint(null);
  };

  const moduleHeaderDragOver = (mi: number) => (event: React.DragEvent<HTMLElement>) => {
    const payload = dragRef.current;
    if (!payload || payload.kind === 'item') return;
    event.preventDefault();
    event.stopPropagation();
    updateHint({ key: `m:${mi}`, position: payload.kind === 'module' ? halfOf(event) : 'into' });
  };

  const moduleHeaderDrop = (mi: number) => (event: React.DragEvent<HTMLElement>) => {
    const payload = dragRef.current;
    if (!payload || payload.kind === 'item') return;
    event.preventDefault();
    event.stopPropagation();
    if (payload.kind === 'module') {
      const target = halfOf(event) === 'before' ? mi : mi + 1;
      onEdit((current) => moveModule(current, payload.module, target));
    } else {
      onEdit((current) =>
        moveSession(
          current,
          { module: payload.module, session: payload.session },
          mi,
          current.modules[mi].sessions.length,
        ),
      );
    }
    endDrag();
  };

  const sessionHeaderDragOver = (mi: number, si: number) => (event: React.DragEvent<HTMLElement>) => {
    const payload = dragRef.current;
    if (!payload || payload.kind !== 'session') return;
    event.preventDefault();
    event.stopPropagation();
    updateHint({ key: `s:${mi}:${si}`, position: halfOf(event) });
  };

  const sessionHeaderDrop = (mi: number, si: number) => (event: React.DragEvent<HTMLElement>) => {
    const payload = dragRef.current;
    if (!payload || payload.kind !== 'session') return;
    event.preventDefault();
    event.stopPropagation();
    const target = halfOf(event) === 'before' ? si : si + 1;
    onEdit((current) =>
      moveSession(current, { module: payload.module, session: payload.session }, mi, target),
    );
    endDrag();
  };

  const sessionBodyDragOver = (mi: number, si: number) => (event: React.DragEvent<HTMLElement>) => {
    const payload = dragRef.current;
    if (!payload || payload.kind !== 'item') return;
    event.preventDefault();
    event.stopPropagation();
    updateHint({ key: `s:${mi}:${si}`, position: 'into' });
  };

  const sessionBodyDrop = (mi: number, si: number) => (event: React.DragEvent<HTMLElement>) => {
    const payload = dragRef.current;
    if (!payload || payload.kind !== 'item') return;
    event.preventDefault();
    event.stopPropagation();
    onEdit((current) =>
      moveItem(
        current,
        { module: payload.module, session: payload.session, item: payload.item },
        { module: mi, session: si },
      ),
    );
    endDrag();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'module') {
      const { module } = pendingDelete;
      onEdit((current) => deleteModule(current, module));
    } else {
      const { module, session } = pendingDelete;
      onEdit((current) => deleteSession(current, module, session));
    }
    setPendingDelete(null);
  };

  const sessionTargets = plan.modules.map((module, mi) => ({
    title: module.title || `Module ${mi + 1}`,
    sessions: module.sessions.map((session, si) => ({
      value: `${mi}:${si}`,
      label: session.title || `Session ${si + 1}`,
    })),
  }));

  const renderItem = (ref: ModulePlanItemRef, mi: number, si: number, ii: number) => {
    const id = refId(ref);
    const suggestion = ref.itemSuggestionId ? suggestionsById.get(ref.itemSuggestionId) : undefined;
    const existing = ref.itemId ? existingItems[ref.itemId] : undefined;
    const type = suggestion?.type ?? existing?.type;
    const modality = type ? modalityByType.get(type) : undefined;
    const Icon = modality?.icon ?? Layers;
    const stale = staleIds.has(id);
    const loading = Boolean(ref.itemId) && existing === undefined;
    const title = suggestion
      ? suggestionTitle(suggestion)
      : existing
        ? itemTitle(existing)
        : loading
          ? 'Loading item…'
          : ref.itemSuggestionId
            ? 'Drafted item (no longer available)'
            : 'Item unavailable';
    const preview = suggestion
      ? suggestionToItemDetail(suggestion)
      : existing
        ? (existing as SessionItemDetail)
        : null;

    return (
      <li
        key={`${id}-${ii}`}
        data-drag-card
        className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
          stale ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-white'
        }`}
      >
        <span
          draggable={!disabled}
          onDragStart={startDrag({ kind: 'item', module: mi, session: si, item: ii })}
          onDragEnd={endDrag}
          title="Drag to another session"
          className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </span>
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border ${
            modality?.badge ?? 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
          title={modality?.label}
        >
          <Icon size={12} />
        </span>
        <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${stale ? 'text-rose-700 line-through' : 'text-slate-700'}`}>
          {title}
        </span>
        {suggestion && (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#1BD183]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
            <Sparkles size={10} /> New
          </span>
        )}
        {stale && (
          <span className="flex-shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-700">
            Deleted
          </span>
        )}
        {preview && (
          <button
            type="button"
            onClick={() => onPreview(preview)}
            title="Preview"
            className="flex-shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Eye size={14} />
          </button>
        )}
        <select
          value=""
          disabled={disabled}
          aria-label="Move item to session"
          title="Move to another session"
          onChange={(event) => {
            const [toModule, toSession] = event.target.value.split(':').map(Number);
            onEdit((current) =>
              moveItem(current, { module: mi, session: si, item: ii }, { module: toModule, session: toSession }),
            );
          }}
          className="w-[4.5rem] flex-shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-500 outline-none hover:border-slate-300"
        >
          <option value="" disabled>
            Move…
          </option>
          {sessionTargets.map((target, targetModule) => (
            <optgroup key={targetModule} label={target.title}>
              {target.sessions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.value === `${mi}:${si}`}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEdit((current) => deleteItem(current, mi, si, ii))}
          title="Remove from session"
          className={`flex-shrink-0 rounded-lg p-1 transition ${
            stale ? 'text-rose-600 hover:bg-rose-100' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'
          }`}
        >
          <X size={14} />
        </button>
      </li>
    );
  };

  const renderSession = (session: ModulePlanSession, mi: number, si: number, sessionCount: number) => {
    const key = `s:${mi}:${si}`;
    const stale = sessionDependencyIds(session).some((id) => staleIds.has(id));
    const nodeIssues = issuesByNode.get(key) ?? [];
    const objectiveNames = (session.learningObjectiveIds ?? [])
      .map((id) => objectiveTitles.get(id))
      .filter((title): title is string => Boolean(title));
    const objectiveCount = session.learningObjectiveIds?.length ?? 0;
    const files = (session.sourceFileIds ?? []).map((id) => uploadNames.get(id)).filter(Boolean);

    return (
      <li
        key={`${mi}-${si}-${session.title}`}
        data-drag-card
        onDragOver={sessionBodyDragOver(mi, si)}
        onDrop={sessionBodyDrop(mi, si)}
        onDragLeave={() => setHint((current) => (current?.key === key ? null : current))}
        className={`rounded-2xl border bg-slate-50/70 transition ${
          stale
            ? 'border-rose-300 bg-rose-50/40'
            : nodeIssues.length > 0
              ? 'border-amber-300'
              : 'border-slate-200'
        } ${hint?.key === key && hint.position === 'into' ? hintClass(hint, key) : ''}`}
      >
        <div
          onDragOver={sessionHeaderDragOver(mi, si)}
          onDrop={sessionHeaderDrop(mi, si)}
          className={`flex items-start gap-2 rounded-t-2xl px-3 pt-2.5 ${
            hint?.key === key && hint.position !== 'into' ? hintClass(hint, key) : ''
          }`}
        >
          <span
            draggable={!disabled}
            onDragStart={startDrag({ kind: 'session', module: mi, session: si })}
            onDragEnd={endDrag}
            title="Drag to reorder or move to another module"
            className="mt-1 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          >
            <GripVertical size={15} />
          </span>
          <span className="mt-0.5 flex h-6 min-w-[1.5rem] flex-shrink-0 items-center justify-center rounded-lg bg-white px-1.5 text-[11px] font-black text-slate-500">
            {mi + 1}.{si + 1}
          </span>
          <div className="min-w-0 flex-1">
            <InlineTitle
              value={session.title}
              label="Session title"
              disabled={disabled}
              onCommit={(title) => onEdit((current) => renameSession(current, mi, si, title))}
              className="text-sm font-bold text-slate-800"
            />
            {session.rationale && (
              <p className="mt-1 flex items-start gap-1.5 text-xs font-medium italic leading-5 text-slate-500">
                <Lightbulb size={12} className="mt-1 flex-shrink-0 text-amber-400" />
                {session.rationale}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400">
              {objectiveCount > 0 && (
                <span
                  className="flex items-center gap-1"
                  title={objectiveNames.length > 0 ? objectiveNames.join('\n') : undefined}
                >
                  <Target size={11} />
                  {objectiveCount} objective{objectiveCount === 1 ? '' : 's'}
                </span>
              )}
              {files.map((name) => (
                <span key={name} className="flex min-w-0 items-center gap-1">
                  <FileText size={11} className="flex-shrink-0" />
                  <span className="truncate">{name}</span>
                </span>
              ))}
              {stale && (
                <span className="flex items-center gap-1 font-black text-rose-600">
                  <AlertTriangle size={11} /> Needs attention
                </span>
              )}
            </div>
            {nodeIssues.map((text) => (
              <p key={text} className="mt-1 text-[11px] font-bold text-amber-700">
                {text}
              </p>
            ))}
          </div>
          <div className="flex flex-shrink-0 items-center">
            <button
              type="button"
              disabled={disabled || si === 0}
              onClick={() => onEdit((current) => moveSession(current, { module: mi, session: si }, mi, si - 1))}
              title="Move up"
              className="rounded-lg p-1 text-slate-300 transition hover:bg-white hover:text-slate-600 disabled:opacity-30"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              disabled={disabled || si === sessionCount - 1}
              onClick={() => onEdit((current) => moveSession(current, { module: mi, session: si }, mi, si + 2))}
              title="Move down"
              className="rounded-lg p-1 text-slate-300 transition hover:bg-white hover:text-slate-600 disabled:opacity-30"
            >
              <ChevronDown size={14} />
            </button>
            {plan.modules.length > 1 && (
              <select
                value=""
                disabled={disabled}
                aria-label="Move session to module"
                title="Move to another module"
                onChange={(event) => {
                  const toModule = Number(event.target.value);
                  onEdit((current) =>
                    moveSession(current, { module: mi, session: si }, toModule, current.modules[toModule].sessions.length),
                  );
                }}
                className="ml-1 w-[4.5rem] cursor-pointer rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-500 outline-none hover:border-slate-300"
              >
                <option value="" disabled>
                  Move…
                </option>
                {plan.modules.map((module, target) => (
                  <option key={target} value={target} disabled={target === mi}>
                    {target + 1}. {module.title || 'Untitled module'}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPendingDelete({ kind: 'session', module: mi, session: si })}
              title="Delete session"
              className="ml-0.5 rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <ul className="space-y-1 px-3 pb-3 pt-2">
          {session.items.length === 0 ? (
            <li className="rounded-xl border border-dashed border-amber-300 px-3 py-2 text-center text-[11px] font-bold text-amber-700">
              Drag an item here, or delete this session.
            </li>
          ) : (
            session.items.map((ref, ii) => renderItem(ref, mi, si, ii))
          )}
        </ul>
      </li>
    );
  };

  return (
    <>
      <ol className="space-y-4">
        {plan.modules.map((module, mi) => {
          const key = `m:${mi}`;
          const stale = module.sessions.some((session) =>
            sessionDependencyIds(session).some((id) => staleIds.has(id)),
          );
          const nodeIssues = issuesByNode.get(key) ?? [];
          return (
            <li
              key={`${mi}-${module.title}`}
              data-drag-card
              className={`rounded-3xl border bg-white transition ${
                stale ? 'border-rose-200' : nodeIssues.length > 0 ? 'border-amber-300' : 'border-slate-200'
              }`}
            >
              <div
                onDragOver={moduleHeaderDragOver(mi)}
                onDrop={moduleHeaderDrop(mi)}
                onDragLeave={() => setHint((current) => (current?.key === key ? null : current))}
                className={`flex items-start gap-2.5 rounded-t-3xl px-4 py-3 ${hintClass(hint, key)}`}
              >
                <span
                  draggable={!disabled}
                  onDragStart={startDrag({ kind: 'module', module: mi })}
                  onDragEnd={endDrag}
                  title="Drag to reorder modules"
                  className="mt-1.5 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                >
                  <GripVertical size={16} />
                </span>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#16324F] text-xs font-black text-white">
                  {mi + 1}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <InlineTitle
                    value={module.title}
                    label="Module title"
                    disabled={disabled}
                    onCommit={(title) => onEdit((current) => renameModule(current, mi, title))}
                    className="text-base font-black tracking-tight text-slate-900"
                  />
                  {module.rationale && (
                    <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{module.rationale}</p>
                  )}
                  {nodeIssues.map((text) => (
                    <p key={text} className="mt-1 text-[11px] font-bold text-amber-700">
                      {text}
                    </p>
                  ))}
                </div>
                <div className="flex flex-shrink-0 items-center pt-1">
                  <span className="mr-2 text-[11px] font-bold text-slate-400">
                    {module.sessions.length} session{module.sessions.length === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    disabled={disabled || mi === 0}
                    onClick={() => onEdit((current) => moveModule(current, mi, mi - 1))}
                    title="Move up"
                    className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || mi === plan.modules.length - 1}
                    onClick={() => onEdit((current) => moveModule(current, mi, mi + 2))}
                    title="Move down"
                    className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setPendingDelete({ kind: 'module', module: mi })}
                    title="Delete module"
                    className="ml-0.5 rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <ol className="space-y-2 px-4 pb-4">
                {module.sessions.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-amber-300 px-3 py-3 text-center text-xs font-bold text-amber-700">
                    No sessions. Drag a session onto this module’s title, or delete the module.
                  </li>
                ) : (
                  module.sessions.map((session, si) => renderSession(session, mi, si, module.sessions.length))
                )}
              </ol>
            </li>
          );
        })}
      </ol>

      <ConfirmationModal
        isOpen={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'module' ? 'Delete module from draft?' : 'Delete session from draft?'}
        message={
          pendingDelete?.kind === 'module'
            ? `Remove “${plan.modules[pendingDelete.module]?.title || 'this module'}” and its sessions from the draft? Its items stay in the course; drafted items in it are dropped when you accept.`
            : pendingDelete
              ? `Remove “${plan.modules[pendingDelete.module]?.sessions[pendingDelete.session]?.title || 'this session'}” from the draft? Its items stay in the course; drafted items in it are dropped when you accept.`
              : ''
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
};

export default PlanTree;
