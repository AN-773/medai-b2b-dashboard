import React from 'react';
import { ArrowRightFromLine, ArrowRightToLine, Pencil, Trash2 } from 'lucide-react';
import type { Discipline } from '@/types/TestsServiceTypes';
import { Button, Drawer, InlineAlert } from '@/components/ui';
import {
  DELETE_BLOCKED_HINT,
  formatDate,
  getShortIdentifier,
  hasLinkedObjectives,
  plural,
} from './shared';

interface DisciplineDetailDrawerProps {
  discipline: Discipline | null;
  onClose: () => void;
  onRename: (discipline: Discipline) => void;
  /** Prefill this discipline as the move source. */
  onMoveFrom: (discipline: Discipline) => void;
  /** Prefill this discipline as the move target. */
  onMoveTo: (discipline: Discipline) => void;
  onDelete: (discipline: Discipline) => void;
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
}

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[13px] text-stone-500">{label}</dt>
    <dd className="mt-0.5 truncate text-sm text-stone-900">{children}</dd>
  </div>
);

/**
 * One discipline at a glance: how many objectives it tags, and the clean-up
 * path (move its objectives elsewhere, then delete it).
 */
const DisciplineDetailDrawer: React.FC<DisciplineDetailDrawerProps> = ({
  discipline,
  onClose,
  onRename,
  onMoveFrom,
  onMoveTo,
  onDelete,
  busy,
  error,
  onDismissError,
}) => {
  if (!discipline) {
    return null;
  }

  const count = discipline.learningObjectivesTotal;
  const linked = hasLinkedObjectives(discipline);

  const renderObjectiveSummary = () => {
    if (typeof count !== 'number') {
      return 'The learning objective count isn’t available for this discipline.';
    }
    if (count === 0) {
      return `No learning objectives are tagged with “${discipline.title}”, so it can be deleted safely.`;
    }
    return `${plural(count, 'learning objective')} ${count === 1 ? 'is' : 'are'} tagged with “${discipline.title}”. Move them to another discipline to merge the two, or before deleting this one.`;
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-lg"
      title={discipline.title}
      footer={
        <>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => onDelete(discipline)}
            disabled={busy || linked}
            title={linked ? DELETE_BLOCKED_HINT : undefined}
          >
            Delete
          </Button>
          {linked && (
            <span className="hidden text-xs text-stone-500 sm:inline">Move its objectives first</span>
          )}
          <Button
            className="ml-auto"
            icon={Pencil}
            onClick={() => onRename(discipline)}
            disabled={busy}
          >
            Rename
          </Button>
        </>
      }
    >
      <div className="space-y-6 px-6 py-5">
        {error && <InlineAlert onDismiss={onDismissError}>{error}</InlineAlert>}

        <section className="rounded-xl border border-stone-200 p-5">
          <p className="text-[13px] text-stone-500">Learning objectives</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
            {typeof count === 'number' ? count.toLocaleString() : '—'}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-stone-600">{renderObjectiveSummary()}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {count !== 0 && (
              <Button
                size="sm"
                icon={ArrowRightFromLine}
                onClick={() => onMoveFrom(discipline)}
                disabled={busy}
              >
                Move to another discipline…
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={ArrowRightToLine}
              onClick={() => onMoveTo(discipline)}
              disabled={busy}
            >
              Move objectives here…
            </Button>
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Fact label="ID">
            <span className="font-mono text-[13px]" title={discipline.id}>
              {getShortIdentifier(discipline.id)}
            </span>
          </Fact>
          <Fact label="Created">{formatDate(discipline.createdAt) ?? '—'}</Fact>
          <Fact label="Last updated">{formatDate(discipline.updatedAt) ?? '—'}</Fact>
        </dl>
      </div>
    </Drawer>
  );
};

export default DisciplineDetailDrawer;
