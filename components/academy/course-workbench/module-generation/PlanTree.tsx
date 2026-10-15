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
import { Badge, Button, ConfirmDialog, IconButton, Input, Menu, cn } from '@/components/ui';
import type { ItemSuggestion } from '@/types/CourseAITypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type {
  ModulePlan,
  ModulePlanIssue,
  ModulePlanItemRef,
  ModulePlanSession,
} from '@/types/ModuleGenerationTypes';
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
  removeStaleFromSession,
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

/** Insertion line above / below the hovered row. */
const edgeHint = (hint: DropHint, key: string) => {
  if (!hint || hint.key !== key) return '';
  if (hint.position === 'before') return 'shadow-[inset_0_2px_0_0_theme(colors.brand.500)]';
  if (hint.position === 'after') return 'shadow-[inset_0_-2px_0_0_theme(colors.brand.500)]';
  return '';
};

/** Highlight for dropping something into the hovered container. */
const intoHint = (hint: DropHint, key: string) =>
  hint?.key === key && hint.position === 'into'
    ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-400'
    : '';

const halfOf = (event: React.DragEvent<HTMLElement>): 'before' | 'after' => {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
};

/** Compact native select for the "Move…" controls. */
const moveSelectClass =
  'h-7 w-[5.5rem] flex-shrink-0 cursor-pointer rounded-md border border-stone-200 bg-white pl-2 pr-1 text-xs text-stone-600 shadow-card outline-none transition hover:border-stone-300 focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-40';

const DragHandle: React.FC<{
  disabled: boolean;
  title: string;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  size?: number;
  className?: string;
}> = ({ disabled, title, onDragStart, onDragEnd, size = 14, className }) => (
  <span
    draggable={!disabled}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    title={title}
    aria-hidden="true"
    className={cn(
      'flex w-4 flex-shrink-0 justify-center text-stone-300 transition-colors',
      disabled ? 'cursor-default' : 'cursor-grab hover:text-stone-500 active:cursor-grabbing',
      className,
    )}
  >
    <GripVertical size={size} />
  </span>
);

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
    const length = draft.trim().length;
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Input
          autoFocus
          onFocus={(event) => event.target.select()}
          value={draft}
          aria-label={label}
          maxLength={MAX_PLAN_TITLE_LENGTH + 20}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') {
              // Cancel the rename without closing the wizard.
              event.stopPropagation();
              setDraft(null);
            }
          }}
          className="!h-8 min-w-0 flex-1 font-medium"
        />
        <span
          className={cn(
            'flex-shrink-0 text-xs tabular-nums',
            length > MAX_PLAN_TITLE_LENGTH ? 'text-red-600' : 'text-stone-400',
          )}
        >
          {length}/{MAX_PLAN_TITLE_LENGTH}
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
      aria-label={`Rename ${label.toLowerCase()}: ${value.trim() || 'Untitled'}`}
      className={cn(
        'group/title -mx-1 flex min-w-0 max-w-full items-start gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:hover:bg-transparent',
        className,
      )}
    >
      <span className={cn('min-w-0 break-words', invalid && 'text-red-600')}>
        {value.trim() || 'Untitled'}
      </span>
      <Pencil
        size={12}
        aria-hidden="true"
        className="mt-[0.3em] flex-shrink-0 text-stone-400 opacity-0 transition group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
      />
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
        className={cn('flex items-center gap-2 bg-white py-1.5 pl-1.5 pr-1', stale && 'bg-red-50')}
      >
        <DragHandle
          disabled={disabled}
          title="Drag to another session"
          onDragStart={startDrag({ kind: 'item', module: mi, session: si, item: ii })}
          onDragEnd={endDrag}
          size={13}
        />
        <span className="flex-shrink-0 text-stone-400" title={modality?.label}>
          <Icon size={14} />
          <span className="sr-only">{modality?.label ?? 'Item'}:</span>
        </span>
        <span
          className={cn(
            'line-clamp-2 min-w-0 flex-1 break-words text-[13px] leading-5',
            stale ? 'text-red-700 line-through' : loading ? 'text-stone-400' : 'text-stone-700',
          )}
        >
          {title}
        </span>
        {suggestion && (
          <Badge tone="violet" icon={Sparkles} title="Drafted by AI; created when you accept">
            New
          </Badge>
        )}
        {stale && <Badge tone="red">Deleted</Badge>}
        {preview && (
          <IconButton size="sm" icon={Eye} label="Preview item" onClick={() => onPreview(preview)} />
        )}
        <select
          value=""
          disabled={disabled}
          aria-label="Move item to another session"
          title="Move to another session"
          onChange={(event) => {
            const [toModule, toSession] = event.target.value.split(':').map(Number);
            onEdit((current) =>
              moveItem(current, { module: mi, session: si, item: ii }, { module: toModule, session: toSession }),
            );
          }}
          className={moveSelectClass}
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
        <IconButton
          size="sm"
          icon={X}
          tone="danger"
          label="Remove from session"
          disabled={disabled}
          onClick={() => onEdit((current) => deleteItem(current, mi, si, ii))}
          className={stale ? 'text-red-600' : undefined}
        />
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
    const files = (session.sourceFileIds ?? [])
      .map((id) => uploadNames.get(id))
      .filter((name): name is string => Boolean(name));

    return (
      <li
        key={`${mi}-${si}-${session.title}`}
        data-drag-card
        onDragOver={sessionBodyDragOver(mi, si)}
        onDrop={sessionBodyDrop(mi, si)}
        onDragLeave={() => setHint((current) => (current?.key === key ? null : current))}
        className={cn(
          'transition-colors last:rounded-b-xl',
          intoHint(hint, key) ||
            (stale ? 'bg-red-50/40' : nodeIssues.length > 0 && 'bg-amber-50/40'),
          edgeHint(hint, key),
        )}
      >
        <div
          onDragOver={sessionHeaderDragOver(mi, si)}
          onDrop={sessionHeaderDrop(mi, si)}
          className="flex items-start gap-2 px-3 pt-3"
        >
          <DragHandle
            disabled={disabled}
            title="Drag to reorder or move to another module"
            onDragStart={startDrag({ kind: 'session', module: mi, session: si })}
            onDragEnd={endDrag}
            className="mt-0.5"
          />
          <span className="mt-0.5 w-8 flex-shrink-0 text-xs leading-5 tabular-nums text-stone-400">
            {mi + 1}.{si + 1}
          </span>
          <div className="min-w-0 flex-1">
            <InlineTitle
              value={session.title}
              label="Session title"
              disabled={disabled}
              onCommit={(title) => onEdit((current) => renameSession(current, mi, si, title))}
              className="text-sm font-medium leading-6 text-stone-900"
            />
            {session.rationale && (
              <p className="mt-0.5 flex items-start gap-1.5 text-[13px] leading-5 text-stone-500">
                <Lightbulb size={13} className="mt-[3px] flex-shrink-0 text-stone-400" aria-hidden="true" />
                {session.rationale}
              </p>
            )}
            {(objectiveCount > 0 || files.length > 0) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                {objectiveCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1"
                    title={objectiveNames.length > 0 ? objectiveNames.join('\n') : undefined}
                  >
                    <Target size={12} className="text-stone-400" aria-hidden="true" />
                    {objectiveCount} objective{objectiveCount === 1 ? '' : 's'}
                  </span>
                )}
                {files.map((name) => (
                  <span key={name} className="inline-flex min-w-0 max-w-full items-center gap-1" title={name}>
                    <FileText size={12} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
                    <span className="truncate">{name}</span>
                  </span>
                ))}
              </p>
            )}
            {stale && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                  <AlertTriangle size={12} aria-hidden="true" /> Refers to deleted content
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onEdit((current) => removeStaleFromSession(current, mi, si, staleIds))}
                >
                  Remove stale references
                </Button>
              </div>
            )}
            {nodeIssues.map((text) => (
              <p key={text} className="mt-1 text-xs text-amber-700">
                {text}
              </p>
            ))}
          </div>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <IconButton
              size="sm"
              icon={ChevronUp}
              label="Move session up"
              disabled={disabled || si === 0}
              onClick={() => onEdit((current) => moveSession(current, { module: mi, session: si }, mi, si - 1))}
            />
            <IconButton
              size="sm"
              icon={ChevronDown}
              label="Move session down"
              disabled={disabled || si === sessionCount - 1}
              onClick={() => onEdit((current) => moveSession(current, { module: mi, session: si }, mi, si + 2))}
            />
            {plan.modules.length > 1 && (
              <select
                value=""
                disabled={disabled}
                aria-label="Move session to another module"
                title="Move to another module"
                onChange={(event) => {
                  const toModule = Number(event.target.value);
                  onEdit((current) =>
                    moveSession(current, { module: mi, session: si }, toModule, current.modules[toModule].sessions.length),
                  );
                }}
                className={cn(moveSelectClass, 'mx-0.5')}
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
            <Menu
              size="sm"
              label="Session actions"
              items={[
                {
                  label: 'Delete session',
                  icon: Trash2,
                  tone: 'danger',
                  disabled,
                  onSelect: () => setPendingDelete({ kind: 'session', module: mi, session: si }),
                },
              ]}
            />
          </div>
        </div>
        <div className="pb-3 pl-[4.75rem] pr-3 pt-2">
          {session.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2 text-center text-xs text-amber-800">
              Drag an item here, or delete this session.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
              {session.items.map((ref, ii) => renderItem(ref, mi, si, ii))}
            </ul>
          )}
        </div>
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
          const sessionCount = module.sessions.length;
          return (
            <li
              key={`${mi}-${module.title}`}
              data-drag-card
              className={cn(
                'rounded-xl border bg-white transition-shadow',
                stale ? 'border-red-200' : nodeIssues.length > 0 ? 'border-amber-300' : 'border-stone-200',
                edgeHint(hint, key) || 'shadow-card',
              )}
            >
              <div
                onDragOver={moduleHeaderDragOver(mi)}
                onDrop={moduleHeaderDrop(mi)}
                onDragLeave={() => setHint((current) => (current?.key === key ? null : current))}
                className={cn(
                  'flex items-start gap-2 rounded-t-xl px-3 py-3 transition-colors',
                  sessionCount === 0 && 'rounded-b-xl',
                  intoHint(hint, key) || 'bg-stone-50/70',
                )}
              >
                <DragHandle
                  disabled={disabled}
                  title="Drag to reorder modules"
                  onDragStart={startDrag({ kind: 'module', module: mi })}
                  onDragEnd={endDrag}
                  size={15}
                  className="mt-1"
                />
                <span className="mt-0.5 w-8 flex-shrink-0 text-[13px] font-medium leading-6 tabular-nums text-stone-400">
                  {mi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <InlineTitle
                    value={module.title}
                    label="Module title"
                    disabled={disabled}
                    onCommit={(title) => onEdit((current) => renameModule(current, mi, title))}
                    className="text-[15px] font-semibold leading-7 text-stone-900"
                  />
                  {module.rationale && (
                    <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{module.rationale}</p>
                  )}
                  {nodeIssues.map((text) => (
                    <p key={text} className="mt-1 text-xs text-amber-700">
                      {text}
                    </p>
                  ))}
                </div>
                <div className="flex flex-shrink-0 items-center gap-0.5 pt-0.5">
                  <span className="mr-1.5 text-xs tabular-nums text-stone-500">
                    {sessionCount} session{sessionCount === 1 ? '' : 's'}
                  </span>
                  <IconButton
                    size="sm"
                    icon={ChevronUp}
                    label="Move module up"
                    disabled={disabled || mi === 0}
                    onClick={() => onEdit((current) => moveModule(current, mi, mi - 1))}
                  />
                  <IconButton
                    size="sm"
                    icon={ChevronDown}
                    label="Move module down"
                    disabled={disabled || mi === plan.modules.length - 1}
                    onClick={() => onEdit((current) => moveModule(current, mi, mi + 2))}
                  />
                  <Menu
                    size="sm"
                    label="Module actions"
                    items={[
                      {
                        label: 'Delete module',
                        icon: Trash2,
                        tone: 'danger',
                        disabled,
                        onSelect: () => setPendingDelete({ kind: 'module', module: mi }),
                      },
                    ]}
                  />
                </div>
              </div>
              {sessionCount === 0 ? (
                <p className="rounded-b-xl border-t border-stone-100 bg-amber-50/40 px-4 py-3 text-center text-xs text-amber-800">
                  No sessions. Drag a session onto this module’s title, or delete the module.
                </p>
              ) : (
                <ol className="divide-y divide-stone-100 border-t border-stone-100">
                  {module.sessions.map((session, si) => renderSession(session, mi, si, sessionCount))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'module' ? 'Delete module from draft?' : 'Delete session from draft?'}
        description={
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
