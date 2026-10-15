import React, { useMemo } from 'react';
import { ArrowRightLeft, ArrowUpDown } from 'lucide-react';
import type { Discipline } from '@/types/TestsServiceTypes';
import {
  Button,
  Dialog,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Select,
  cn,
} from '@/components/ui';
import {
  buildDisciplineOptionLabels,
  formatLearningObjectiveCount,
  getShortIdentifier,
} from './shared';

// ---------------------------------------------------------------------------
// Create / rename
// ---------------------------------------------------------------------------

interface DisciplineTitleDialogProps {
  open: boolean;
  /** The discipline being renamed; omit to create a new one. */
  discipline?: Discipline | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  saving: boolean;
  /** Blocks submitting without being a "saving" state (e.g. a move is running). */
  disabled?: boolean;
  error: string | null;
  onDismissError: () => void;
}

export const DisciplineTitleDialog: React.FC<DisciplineTitleDialogProps> = ({
  open,
  discipline,
  value,
  onChange,
  onSubmit,
  onClose,
  saving,
  disabled = false,
  error,
  onDismissError,
}) => {
  const isRename = Boolean(discipline);
  const unchanged = isRename && value.trim() === discipline?.title.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={isRename ? 'Rename discipline' : 'New discipline'}
      description={
        isRename
          ? 'The new name shows everywhere this discipline is used.'
          : 'New disciplines become available anywhere the taxonomy is used.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={saving}
            disabled={disabled || !value.trim() || unchanged}
          >
            {isRename ? 'Save' : 'Create discipline'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && !disabled && !unchanged) onSubmit();
        }}
        className="space-y-4"
      >
        {error && <InlineAlert onDismiss={onDismissError}>{error}</InlineAlert>}
        <Field
          label="Title"
          description={
            discipline ? (
              <>
                ID <span className="font-mono">{getShortIdentifier(discipline.id)}</span>
              </>
            ) : undefined
          }
        >
          {(id) => (
            <Input
              id={id}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Pathology"
              autoComplete="off"
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Move learning objectives between disciplines
// ---------------------------------------------------------------------------

interface MoveObjectivesDialogProps {
  open: boolean;
  onClose: () => void;
  disciplines: Discipline[];
  sourceId: string;
  targetId: string;
  onSourceChange: (id: string) => void;
  onTargetChange: (id: string) => void;
  onSwap: () => void;
  /** Opens the final confirmation. */
  onSubmit: () => void;
  isMoving: boolean;
  isSaving: boolean;
  selectionError: string | null;
  error: string | null;
  onDismissError: () => void;
}

export const MoveObjectivesDialog: React.FC<MoveObjectivesDialogProps> = ({
  open,
  onClose,
  disciplines,
  sourceId,
  targetId,
  onSourceChange,
  onTargetChange,
  onSwap,
  onSubmit,
  isMoving,
  isSaving,
  selectionError,
  error,
  onDismissError,
}) => {
  const labels = useMemo(() => buildDisciplineOptionLabels(disciplines), [disciplines]);
  const source = disciplines.find((discipline) => discipline.id === sourceId) ?? null;
  const target = disciplines.find((discipline) => discipline.id === targetId) ?? null;
  const sourceCount =
    typeof source?.learningObjectivesTotal === 'number' ? source.learningObjectivesTotal : null;
  const controlsDisabled = isMoving || isSaving || disciplines.length === 0;

  const summary = selectionError
    ? selectionError
    : source && target
      ? sourceCount === null
        ? `Move linked objectives from “${source.title}” into “${target.title}”.`
        : `Move ${formatLearningObjectiveCount(sourceCount).toLowerCase()} from “${source.title}” into “${target.title}”.`
      : 'Choose a source and target discipline to prepare the transfer.';

  const renderOptions = (excludeId: string) =>
    disciplines
      .filter((discipline) => discipline.id !== excludeId)
      .map((discipline) => (
        <option key={discipline.id} value={discipline.id}>
          {labels.get(discipline.id) ?? discipline.title}
        </option>
      ));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!isMoving}
      width="max-w-lg"
      title="Move learning objectives"
      description="Reassign every objective linked to one discipline to another, without opening each objective."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={ArrowRightLeft}
            onClick={onSubmit}
            loading={isMoving}
            disabled={isSaving || !sourceId || !targetId || Boolean(selectionError)}
          >
            Move objectives
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineAlert onDismiss={onDismissError}>{error}</InlineAlert>}

        <div>
          <Field
            label="From"
            description={
              source
                ? formatLearningObjectiveCount(source.learningObjectivesTotal)
                : 'The discipline currently holding the objective links.'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={sourceId}
                onChange={(event) => onSourceChange(event.target.value)}
                disabled={controlsDisabled}
                data-autofocus={!sourceId || undefined}
              >
                <option value="">Select source discipline…</option>
                {renderOptions(targetId)}
              </Select>
            )}
          </Field>

          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-100" />
            <IconButton
              icon={ArrowUpDown}
              label="Swap source and target"
              size="sm"
              onClick={onSwap}
              disabled={isMoving || (!sourceId && !targetId)}
            />
            <div className="h-px flex-1 bg-stone-100" />
          </div>

          <Field
            label="To"
            description={
              target
                ? 'Incoming links will be added to this discipline.'
                : 'The discipline that should receive the moved links.'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={targetId}
                onChange={(event) => onTargetChange(event.target.value)}
                disabled={controlsDisabled}
                data-autofocus={(sourceId && !targetId) || undefined}
              >
                <option value="">Select target discipline…</option>
                {renderOptions(sourceId)}
              </Select>
            )}
          </Field>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
          <p
            className={cn(
              'text-sm font-medium',
              selectionError ? 'text-red-700' : 'text-stone-900',
            )}
          >
            {summary}
          </p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            This updates discipline links only. The learning objective records themselves stay
            intact.
          </p>
        </div>
      </div>
    </Dialog>
  );
};
