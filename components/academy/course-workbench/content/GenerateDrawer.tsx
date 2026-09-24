import React from 'react';
import { CheckCheck, Sparkles, X } from 'lucide-react';
import { Button, Drawer, InlineAlert } from '@/components/ui';
import type { ItemSuggestionType } from '@/types/CourseAITypes';
import type { JobProgress } from '@/hooks/useItemFactory';
import PlanEditor from './PlanEditor';
import { generationLabel, GenerationBar } from './GenerationProgress';
import { plural, type ItemPlan } from './contentConfig';

interface GenerateDrawerProps {
  open: boolean;
  onClose: () => void;
  /** False while a confirm dialog is stacked on top, so Escape closes only that. */
  dismissible: boolean;
  objectiveCount: number;
  selectedCount: number;
  onClearSelection: () => void;
  plan: ItemPlan;
  adjustPlan: (type: ItemSuggestionType, delta: number) => void;
  planTotal: number;
  isRunning: boolean;
  progress: JobProgress | null;
  error: string | null;
  onDismissError: () => void;
  onGenerateAll: () => void;
  onGenerateSelected: () => void;
  /** Pending drafts left over from the last batch job. */
  pendingCount: number;
  /** Any bulk accept/reject in flight (locks the batch actions). */
  isBulkBusy: boolean;
  /** The whole-batch accept/reject specifically. */
  isBatchBusy: boolean;
  onAcceptBatch: () => void;
  onRejectBatch: () => void;
  onReviewIndividually: () => void;
}

const SectionTitle: React.FC<{ title: string; description?: React.ReactNode }> = ({
  title,
  description,
}) => (
  <div className="mb-3">
    <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
    {description && <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{description}</p>}
  </div>
);

/** Batch AI generation across many objectives, plus review of the last batch. */
const GenerateDrawer: React.FC<GenerateDrawerProps> = ({
  open,
  onClose,
  dismissible,
  objectiveCount,
  selectedCount,
  onClearSelection,
  plan,
  adjustPlan,
  planTotal,
  isRunning,
  progress,
  error,
  onDismissError,
  onGenerateAll,
  onGenerateSelected,
  pendingCount,
  isBulkBusy,
  isBatchBusy,
  onAcceptBatch,
  onRejectBatch,
  onReviewIndividually,
}) => {
  const cannotGenerate = planTotal === 0 || isRunning;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={dismissible}
      width="max-w-xl"
      title="Generate with AI"
      description="Draft items across many objectives, then review them together."
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            disabled={cannotGenerate || selectedCount === 0}
            title={selectedCount === 0 ? 'Tick objectives in the list to select them' : undefined}
            onClick={onGenerateSelected}
          >
            {selectedCount > 0 ? `Generate for ${selectedCount} selected` : 'Generate for selected'}
          </Button>
          <Button
            variant="ai"
            icon={Sparkles}
            loading={isRunning}
            disabled={cannotGenerate}
            onClick={onGenerateAll}
          >
            Generate for all {plural(objectiveCount, 'objective')}
          </Button>
        </div>
      }
    >
      <div className="space-y-8 px-6 py-5">
        {error && (
          <InlineAlert tone="error" onDismiss={onDismissError}>
            {error}
          </InlineAlert>
        )}

        {isRunning && (
          <section className="rounded-xl border border-stone-200 p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-stone-900">{generationLabel(progress)}</p>
              {progress && (
                <span className="text-xs tabular-nums text-stone-500">{progress.percent}%</span>
              )}
            </div>
            <GenerationBar progress={progress} className="mt-3" />
            <p className="mt-3 text-[13px] leading-5 text-stone-500">
              You can close this panel. Drafting continues in the background and new drafts
              appear under each objective for review.
            </p>
          </section>
        )}

        <section>
          <SectionTitle
            title="Drafts per objective"
            description="Every objective in the run gets this many drafts of each type."
          />
          <PlanEditor
            plan={plan}
            adjustPlan={adjustPlan}
            layout="stacked"
            label="Drafts per objective"
          />
          <p className="mt-2 text-[13px] text-stone-500 tabular-nums">
            {planTotal === 0
              ? 'Set at least one type to start.'
              : `${plural(planTotal, 'draft')} per objective · up to ${(
                  planTotal * objectiveCount
                ).toLocaleString()} for the whole course`}
          </p>
        </section>

        <section>
          <SectionTitle title="Objectives" />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3">
            <p className="min-w-0 flex-1 text-[13px] leading-5 text-stone-600">
              {selectedCount > 0 ? (
                <>
                  <span className="font-medium text-stone-900">
                    {plural(selectedCount, 'objective')}
                  </span>{' '}
                  selected in the list.
                </>
              ) : (
                <>
                  None selected. Tick objectives in the list to draft for just those, or
                  generate for all {plural(objectiveCount, 'objective')}.
                </>
              )}
            </p>
            {selectedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Clear selection
              </Button>
            )}
          </div>
        </section>

        {pendingCount > 0 && !isRunning && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-sm font-medium text-amber-900">
              {plural(pendingCount, 'draft')} from the last batch{' '}
              {pendingCount === 1 ? 'needs' : 'need'} review
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-amber-800">
              Review them one by one, or decide on the whole batch at once.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                icon={CheckCheck}
                loading={isBatchBusy}
                disabled={isBulkBusy}
                onClick={onAcceptBatch}
              >
                Accept all
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={X}
                disabled={isBulkBusy}
                onClick={onRejectBatch}
              >
                Reject all
              </Button>
              <Button variant="ghost" size="sm" onClick={onReviewIndividually}>
                Review individually
              </Button>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
};

export default GenerateDrawer;
