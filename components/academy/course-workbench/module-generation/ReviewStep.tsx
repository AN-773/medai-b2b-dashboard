import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, CloudOff, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, InlineAlert, cn } from '@/components/ui';
import { moduleGenerationCourseData } from '@/services/moduleGenerationService';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type {
  AcceptModulePlanResponse,
  ModuleGenerationJob,
  ModulePlan,
} from '@/types/ModuleGenerationTypes';
import SessionItemDetailModal, {
  type SessionItemDetail,
} from '@/components/academy/course-workbench/SessionItemDetailModal';
import PlanTree from './PlanTree';
import { countPlan } from './planUtils';
import { type PlanSaveState, useModulePlanEditor } from './useModulePlanEditor';
import { WizardFooter } from './WizardFooter';

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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

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

  const saveTone =
    editor.saveState === 'saved'
      ? 'text-stone-500'
      : editor.saveState === 'saving' || editor.saveState === 'dirty'
        ? 'text-stone-600'
        : 'text-amber-700';

  return (
    <>
      <div className="space-y-4 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px] tabular-nums text-stone-500">
            <span>
              <span className="font-medium text-stone-900">{plural(counts.modules, 'module')}</span>
              {' · '}
              {plural(counts.sessions, 'session')}
              {' · '}
              {plural(counts.items, 'item')}
            </span>
            {counts.newItems > 0 && (
              <Badge tone="violet" icon={Sparkles} title="Drafted by AI; created when you accept">
                {counts.newItems} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span role="status" className={cn('flex items-center gap-1.5 text-xs', saveTone)}>
              {editor.saveState === 'saving' ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : editor.saveState === 'saved' ? (
                <CheckCircle2 size={13} aria-hidden="true" />
              ) : (
                <CloudOff size={13} aria-hidden="true" />
              )}
              {SAVE_LABELS[editor.saveState]}
            </span>
            {(editor.saveState === 'dirty' || editor.saveState === 'error') && (
              <Button variant="secondary" size="sm" onClick={() => void editor.save()}>
                Save
              </Button>
            )}
          </div>
        </div>

        {warnings.length > 0 && (
          <InlineAlert tone="warning" title="Notes from the AI">
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </InlineAlert>
        )}

        {editor.strippedNotice && (
          <InlineAlert tone="info" onDismiss={editor.dismissStrippedNotice}>
            {editor.strippedNotice}
          </InlineAlert>
        )}

        {editor.message && (
          <InlineAlert
            tone={editor.message.tone === 'error' ? 'error' : 'info'}
            onDismiss={editor.dismissMessage}
          >
            {editor.message.text}
          </InlineAlert>
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

      <WizardFooter
        start={
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => setConfirmDiscard(true)}
            disabled={busy}
            loading={editor.isDiscarding}
          >
            Discard draft
          </Button>
        }
        hint={
          hasStaleRefs ? (
            <span className="text-amber-700">Remove the highlighted items to accept.</span>
          ) : (
            <span className="hidden sm:inline">Modules are added after your existing ones.</span>
          )
        }
      >
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          icon={Check}
          onClick={() => void editor.accept()}
          disabled={!canAccept}
          loading={editor.isAccepting}
        >
          Accept and create {plural(counts.modules, 'module')}
        </Button>
      </WizardFooter>

      <SessionItemDetailModal item={previewItem} onClose={() => setPreviewItem(null)} />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this draft?"
        description="The draft and every item the AI drafted for it will be discarded. Nothing is added to the course. You can generate a new draft afterwards."
        confirmLabel="Discard draft"
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
