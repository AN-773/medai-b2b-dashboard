import React, { useMemo, useState } from 'react';
import { Check, Clock, Loader2, Minus, X } from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';
import { Button, InlineAlert, cn } from '@/components/ui';
import { facultyChatErrorCopy } from '@/services/facultyChatErrors';
import {
  answerTextOf,
  isAnswerTruncated,
  isTurnInFlight,
  type FacultyStep,
  type FacultyStepStatus,
  type FacultyTurn,
} from '@/services/facultyChatReducer';
import { asOfLine } from '@/utils/facultyResults';
import { AnswerRating, type SubmitFeedback } from './AskFeedback';
import { AskProvenance } from './AskProvenance';
import { AskResultChart } from './AskResultChart';
import { AskResultTable } from './AskResultTable';

interface AskAnswerCardProps {
  turn: FacultyTurn;
  onFeedback: SubmitFeedback;
  /** Reopen an answer whose connection dropped. */
  onReconnect: () => void;
  /** Ask the same question again. Omitted while another answer is running. */
  onAskAgain?: (turn: FacultyTurn) => void;
  onNewConversation: () => void;
}

const STEP_ICONS: Record<FacultyStepStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  running: Loader2,
  succeeded: Check,
  failed: X,
  stopped: Minus,
};

const StepRow: React.FC<{ step: FacultyStep }> = ({ step }) => {
  const Icon = STEP_ICONS[step.status];
  return (
    <li className="flex items-center gap-2 text-[13px] text-stone-500">
      <Icon
        size={14}
        className={cn(
          'flex-shrink-0',
          step.status === 'running' && 'animate-spin text-brand-600',
          step.status === 'succeeded' && 'text-brand-600',
        )}
      />
      <span dir="auto" className="min-w-0 truncate">
        {step.label}
        {step.status === 'running' && '…'}
      </span>
    </li>
  );
};

const WAITING_LABELS: Partial<Record<FacultyTurn['phase'], string>> = {
  submitting: 'Sending your question…',
  streaming: 'Working on your answer…',
  reconnecting: 'Reconnecting…',
  paused: 'Still working on your answer…',
  cancelling: 'Stopping…',
};

/** Why a finished turn has no full answer, in the dean's terms. */
const noticeFor = (turn: FacultyTurn): { tone: 'error' | 'warning' | 'info'; text: string } | null => {
  if (turn.phase === 'disconnected') return { tone: 'warning', text: facultyChatErrorCopy(turn.error) };
  if (turn.phase !== 'done') return null;
  switch (turn.outcome) {
    case 'rejected':
    case 'failed':
      return { tone: 'error', text: facultyChatErrorCopy(turn.error ?? { kind: 'turn_failed' }) };
    case 'cancelled':
      return { tone: 'info', text: 'You stopped this answer.' };
    case 'budget_exceeded':
    case 'step_limit_exceeded':
      return { tone: 'warning', text: 'This question needed more work than one answer allows. Try narrowing it down.' };
    default:
      return null;
  }
};

const NO_ANSWER_NOTICE = { tone: 'info', text: 'There is no saved answer for this question.' } as const;

/** Kinds where sending the same words to the same thread cannot work. */
const THREAD_REFUSALS = new Set(['surface_mismatch', 'tenant_mismatch']);

/**
 * One question and its answer (plan §2.1): the steps while it is being worked
 * on, the written answer, the data behind it, how it was computed, and how
 * fresh it is. The written answer goes through {@link MarkdownContent}, which
 * has no path to raw HTML; everything else here is a React text node.
 */
export const AskAnswerCard: React.FC<AskAnswerCardProps> = React.memo(
  ({ turn, onFeedback, onReconnect, onAskAgain, onNewConversation }) => {
    const [showEarlier, setShowEarlier] = useState(false);

    const text = answerTextOf(turn);
    const inFlight = isTurnInFlight(turn);
    const nothingBack = turn.phase === 'done' && text === '' && turn.tables.length === 0 && turn.charts.length === 0;
    const notice = noticeFor(turn) ?? (nothingBack ? NO_ANSWER_NOTICE : null);
    const asOf = asOfLine(turn.tables);
    // While streaming, a running step or the words themselves already say so.
    const quietlyBusy = turn.phase === 'streaming' && (text !== '' || turn.steps.some((step) => step.status === 'running'));
    const waitingLabel = quietlyBusy ? undefined : WAITING_LABELS[turn.phase];

    // A query is often a look at the data rather than the answer. Keep the
    // ones a chart draws and the last one in view, and fold the others.
    const { shownTables, earlierTables, looseCharts } = useMemo(() => {
      const charted = new Set(turn.charts.map((chart) => chart.queryId));
      const last = turn.tables[turn.tables.length - 1];
      const isShown = (table: FacultyTurn['tables'][number]) => table === last || charted.has(table.queryId);
      const known = new Set(turn.tables.map((table) => table.queryId));
      return {
        shownTables: turn.tables.filter(isShown),
        earlierTables: turn.tables.filter((table) => !isShown(table)),
        looseCharts: turn.charts.filter((chart) => !known.has(chart.queryId)),
      };
    }, [turn.tables, turn.charts]);

    const canRate =
      turn.phase === 'done' &&
      turn.operationId !== null &&
      text !== '' &&
      (turn.outcome === 'completed' || turn.outcome === 'unknown');

    const blockedThread = turn.error !== null && THREAD_REFUSALS.has(turn.error.kind);

    return (
      <article className="space-y-3">
        {turn.question.text && (
          <div className="flex justify-end">
            <p
              dir="auto"
              className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm leading-6 text-stone-900"
            >
              {turn.question.text}
            </p>
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          {inFlight && (
            <div aria-live="polite">
              {turn.steps.length > 0 && (
                <ul aria-label="What the assistant is doing" className="space-y-1.5">
                  {turn.steps.map((step) => (
                    <StepRow key={step.toolCallId} step={step} />
                  ))}
                </ul>
              )}
              {waitingLabel && (
                <p className={cn('flex items-center gap-2 text-[13px] text-stone-500', turn.steps.length > 0 && 'mt-1.5')}>
                  <Loader2 size={14} className="flex-shrink-0 animate-spin text-brand-600" />
                  {waitingLabel}
                </p>
              )}
            </div>
          )}

          {text && (
            <div dir="auto">
              <MarkdownContent content={text} variant="reading" />
              {isAnswerTruncated(turn) && turn.outcome !== 'cancelled' && (
                <p className="mt-2 text-[13px] text-amber-800">This answer was cut off before it finished.</p>
              )}
            </div>
          )}

          {notice && (
            <InlineAlert
              tone={notice.tone}
              action={
                turn.phase === 'disconnected' ? (
                  <Button size="sm" variant="secondary" onClick={onReconnect}>
                    Reconnect
                  </Button>
                ) : blockedThread ? (
                  <Button size="sm" variant="secondary" onClick={onNewConversation}>
                    New question
                  </Button>
                ) : turn.error?.retryable && onAskAgain ? (
                  <Button size="sm" variant="secondary" onClick={() => onAskAgain(turn)}>
                    Ask again
                  </Button>
                ) : undefined
              }
            >
              {notice.text}
            </InlineAlert>
          )}

          {looseCharts.map((chart) => (
            <AskResultChart key={chart.chartId} chart={chart} />
          ))}

          {shownTables.map((table) => (
            <div key={table.queryId} className="space-y-4">
              {turn.charts
                .filter((chart) => chart.queryId === table.queryId)
                .map((chart) => (
                  <AskResultChart key={chart.chartId} chart={chart} />
                ))}
              <AskResultTable table={table} operationId={turn.operationId} onFeedback={onFeedback} />
            </div>
          ))}

          {earlierTables.length > 0 && (
            <div className="space-y-4">
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={showEarlier}
                onClick={() => setShowEarlier((current) => !current)}
              >
                {showEarlier
                  ? 'Hide the other results'
                  : `Show ${earlierTables.length} other ${earlierTables.length === 1 ? 'result' : 'results'}`}
              </Button>
              {showEarlier &&
                earlierTables.map((table) => (
                  <AskResultTable
                    key={table.queryId}
                    table={table}
                    operationId={turn.operationId}
                    onFeedback={onFeedback}
                  />
                ))}
            </div>
          )}

          {(asOf || canRate || turn.tables.length > 0) && !inFlight && (
            <footer className="space-y-3 border-t border-stone-100 pt-3">
              <AskProvenance tables={turn.tables} />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {asOf ? (
                  <p className="flex items-center gap-1.5 text-[13px] text-stone-500">
                    <Clock size={14} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
                    {asOf}
                  </p>
                ) : (
                  <span />
                )}
                {canRate && turn.operationId && <AnswerRating operationId={turn.operationId} onSubmit={onFeedback} />}
              </div>
            </footer>
          )}
        </div>
      </article>
    );
  },
);
AskAnswerCard.displayName = 'AskAnswerCard';
