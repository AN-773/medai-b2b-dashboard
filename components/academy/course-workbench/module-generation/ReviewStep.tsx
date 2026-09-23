import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Info,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { moduleGenerationCourseData } from '@/services/moduleGenerationService';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type {
  AcceptModulePlanResponse,
  ModuleGenerationJob,
  ModulePlan,
} from '@/types/ModuleGenerationTypes';
import ConfirmationModal from '@/components/ConfirmationModal';
import SessionItemDetailModal, {
  type SessionItemDetail,
} from '@/components/academy/course-workbench/SessionItemDetailModal';
import PlanTree from './PlanTree';
import { countPlan } from './planUtils';
import { type PlanSaveState, useModulePlanEditor } from './useModulePlanEditor';

interface ReviewStepProps {
  job: ModuleGenerationJob;
  uploads: CourseUpload[];
  objectiveTitles: Map<string, string>;
  onJobReloaded: (job: ModuleGenerationJob) => void;
  onAccepted: (response: AcceptModulePlanResponse) => void;
  onDiscarded: (job: CourseGenerationJob) => void;
  onClose: () => void;
}

/** Loads the existing items a plan references, once each. */
const usePlanItemDetails = (plan: ModulePlan) => {
  const [items, setItems] = useState<Record<string, BackendApiItem | null>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  // Sorted, so reordering or renaming does not refetch.
  const idsKey = useMemo(
    () =>
      Array.from(
        new Set(
          plan.modules.flatMap((module) =>
            module.sessions.flatMap((session) =>
              session.items.map((ref) => ref.itemId).filter((id): id is string => Boolean(id)),
            ),
          ),
        ),
      )
        .sort()
        .join('\n'),
    [plan],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const missing = idsKey
      .split('\n')
      .filter((id) => id && !requestedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requestedRef.current.add(id));
    moduleGenerationCourseData
      .getItems(missing)
      .catch(() => Object.fromEntries(missing.map((id) => [id, null])))
      .then((loaded) => {
        if (mountedRef.current) setItems((current) => ({ ...current, ...loaded }));
      });
  }, [idsKey]);

  return items;
};

const SAVE_LABELS: Record<PlanSaveState, string> = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  invalid: 'Fix the highlighted issues to save',
  error: 'Not saved',
};

const ReviewStep: React.FC<ReviewStepProps> = ({
  job,
  uploads,
  objectiveTitles,
  onJobReloaded,
  onAccepted,
  onDiscarded,
  onClose,
}) => {
  const editor = useModulePlanEditor({ job, onJobReloaded, onAccepted, onDiscarded });
  const existingItems = usePlanItemDetails(editor.plan);
  const [previewItem, setPreviewItem] = useState<SessionItemDetail | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const suggestionsById = useMemo(
    () => new Map((job.itemSuggestions ?? []).map((suggestion) => [suggestion.id, suggestion])),
    [job.itemSuggestions],
  );
  const uploadNames = useMemo(
    () => new Map(uploads.map((upload) => [upload.id, upload.fileName || upload.identifier])),
    [uploads],
  );

  const counts = countPlan(editor.plan);
  const warnings = editor.plan.warnings ?? [];
  const busy = editor.isAccepting || editor.isDiscarding;
  const issues = editor.localIssues.length > 0 ? editor.localIssues : editor.serverIssues;
  const hasStaleRefs = useMemo(() => {
    if (editor.staleIds.size === 0) return false;
    return editor.plan.modules.some((module) =>
      module.sessions.some((session) =>
        [
          ...session.items.map((ref) => ref.itemId ?? ref.itemSuggestionId ?? ''),
          ...(session.learningObjectiveIds ?? []),
          ...(session.sourceFileIds ?? []),
        ].some((id) => editor.staleIds.has(id)),
      ),
    );
  }, [editor.plan, editor.staleIds]);
  const canAccept =
    !busy && editor.localIssues.length === 0 && !hasStaleRefs && editor.saveState !== 'saving';

  return (
    <>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">
              <span className="font-black text-slate-900">{counts.modules}</span> modules ·{' '}
              <span className="font-black text-slate-900">{counts.sessions}</span> sessions ·{' '}
              <span className="font-black text-slate-900">{counts.items}</span> items
              {counts.newItems > 0 && (
                <>
                  {' '}
                  (<span className="font-black text-emerald-700">{counts.newItems} new</span>)
                </>
              )}
            </p>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className={`flex items-center gap-1.5 ${
                  editor.saveState === 'saved'
                    ? 'text-slate-400'
                    : editor.saveState === 'saving' || editor.saveState === 'dirty'
                      ? 'text-slate-500'
                      : 'text-amber-700'
                }`}
              >
                {editor.saveState === 'saving' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : editor.saveState === 'saved' ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <CloudOff size={13} />
                )}
                {SAVE_LABELS[editor.saveState]}
              </span>
              {(editor.saveState === 'dirty' || editor.saveState === 'error') && (
                <button
                  type="button"
                  onClick={() => void editor.save()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-slate-600 transition hover:border-slate-300"
                >
                  <Save size={12} /> Save
                </button>
              )}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                <AlertTriangle size={14} /> Notes from the AI
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-medium text-amber-800">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {editor.message && (
            <div
              role="alert"
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                editor.message.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
              }`}
            >
              {editor.message.tone === 'error' ? (
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              ) : (
                <Info size={16} className="mt-0.5 flex-shrink-0" />
              )}
              <span className="min-w-0 flex-1">{editor.message.text}</span>
              <button
                type="button"
                onClick={editor.dismissMessage}
                title="Dismiss"
                className="flex-shrink-0 opacity-60 transition hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <PlanTree
            plan={editor.plan}
            staleIds={editor.staleIds}
            issues={issues}
            existingItems={existingItems}
            suggestionsById={suggestionsById}
            uploadNames={uploadNames}
            objectiveTitles={objectiveTitles}
            disabled={busy}
            onEdit={editor.edit}
            onPreview={setPreviewItem}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          {editor.isDiscarding ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          Discard draft
        </button>
        <div className="flex items-center justify-end gap-2">
          <span className="hidden text-xs font-semibold text-slate-400 lg:inline">
            {hasStaleRefs
              ? 'Remove the highlighted items to accept.'
              : 'Modules are added after your existing ones.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void editor.accept()}
            disabled={!canAccept}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:opacity-90 disabled:opacity-50"
          >
            {editor.isAccepting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Accept and create {counts.modules} module{counts.modules === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      <SessionItemDetailModal item={previewItem} onClose={() => setPreviewItem(null)} />
      <ConfirmationModal
        isOpen={confirmDiscard}
        title="Discard this draft?"
        message="The draft and every item the AI drafted for it will be discarded. Nothing is added to the course. You can generate a new draft afterwards."
        confirmLabel={editor.isDiscarding ? 'Discarding…' : 'Discard'}
        onConfirm={() => {
          setConfirmDiscard(false);
          void editor.discard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
};

export default ReviewStep;
