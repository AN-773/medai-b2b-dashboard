/**
 * The faculty chat as UI state: a pure reducer over requests and stream events.
 *
 * A conversation is a list of **turns**, one per question: the question, the
 * steps the agent took ("Querying your institution's data"), the assistant's
 * messages as they stream, and how the turn ended. That is the dean's answer
 * card (plan §2.1), so it is the unit here rather than a flat message list.
 *
 * Ported from the learner app's `streamProtocol/v2Contract.js` fold, with two
 * deliberate differences:
 *
 * - **A repeated `message.started` truncates.** agent-v2 re-sends it for a
 *   message id the client already holds when a super-step ran twice, and means
 *   "discard that message and begin again". The learner fold appends instead (a
 *   gap it documents); here the message's text and the steps anchored to it
 *   are dropped and rebuilt.
 * - **Events are de-duplicated by `seq`.** A replay never double-appends text.
 *
 * Unknown event types only move the cursor (agent-v2 REF-6 C18: ignorable,
 * never fatal). `faculty.table` and `faculty.chart` fill a turn's `tables` and
 * `charts`; a body that does not parse is ignored the same way.
 */

import type { FacultyStreamItem } from './facultyChatClient';
import { splitFoldedContext, type FacultyPageContext } from './facultyChatContext';
import type { FacultyChatErrorInfo } from './facultyChatErrors';
import {
  MESSAGE_FINISH_REASONS,
  TURN_COMPLETION_REASONS,
  isPlainObject,
  parseFacultyChart,
  parseFacultyResults,
  parseFacultyTable,
  type CancelledTurn,
  type FacultyChart,
  type FacultyStreamEvent,
  type FacultyTable,
  type MessageFinishReason,
  type TranscriptMessageView,
  type TurnCompletionReason,
  type TurnPauseReason,
} from './facultyChatWire';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Where a turn is.
 *
 * - `submitting`: `POST /v1/turns` is in flight.
 * - `streaming`: accepted, and the stream is open (or opening).
 * - `reconnecting`: the stream dropped and is being reopened from the cursor.
 * - `disconnected`: reopening gave up. The turn may still be running; retry re-attaches.
 * - `paused`: parked on an approval or a job. Faculty tools need neither, so this should not happen.
 * - `cancelling`: the dean pressed stop; waiting for the ending.
 * - `done`: ended; see `outcome`.
 */
export type FacultyTurnPhase =
  | 'submitting'
  | 'streaming'
  | 'reconnecting'
  | 'disconnected'
  | 'paused'
  | 'cancelling'
  | 'done';

/**
 * How a `done` turn ended: one of agent-v2's completion reasons, `failed`
 * (`turn.failed`), `rejected` (the POST was refused, e.g. 403/409/429), or
 * `unknown` (reloaded from a transcript that does not say).
 */
export type FacultyTurnOutcome = TurnCompletionReason | 'failed' | 'rejected' | 'unknown';

export type FacultyStepStatus = 'running' | 'succeeded' | 'failed' | 'stopped';

/** One visible step: a tool call, with a short label for the dean. */
export interface FacultyStep {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly label: string;
  readonly status: FacultyStepStatus;
  /** The assistant message that made the call. */
  readonly messageId: string | null;
  readonly startedAt: string | null;
  readonly settledAt: string | null;
}

export interface FacultyAssistantMessage {
  readonly messageId: string;
  readonly text: string;
  /** `null` while streaming. `interrupted` means the text is a prefix: say so. */
  readonly finishReason: MessageFinishReason | null;
  readonly streaming: boolean;
}

/** One question and everything that came back for it. */
export interface FacultyTurn {
  /** Stable React key: the operation id (which the client picks up front), or a local id. */
  readonly key: string;
  readonly operationId: string | null;
  readonly question: {
    readonly text: string;
    readonly context: FacultyPageContext | null;
    readonly askedAt: string | null;
  };
  readonly phase: FacultyTurnPhase;
  /** Set when `phase` is `done`. */
  readonly outcome: FacultyTurnOutcome | null;
  readonly pauseReason: TurnPauseReason | null;
  /** In order. Usually one; a turn that called tools has one per model step. */
  readonly messages: readonly FacultyAssistantMessage[];
  readonly steps: readonly FacultyStep[];
  /** One per query, in the order they ran. Rows live here and only here: the model sees a preview. */
  readonly tables: readonly FacultyTable[];
  /** One per `showChart`, in order. Each carries its own rows. */
  readonly charts: readonly FacultyChart[];
  /** Follow-up questions, if agent-v2 offers any (FAG-1 turns them off for faculty). */
  readonly suggestions: readonly string[];
  /** Why it failed, was rejected, or lost its stream. */
  readonly error: FacultyChatErrorInfo | null;
  /** The resume cursor: the last `seq` seen, as the `Last-Event-ID` string. */
  readonly lastEventId: string | null;
  /** The last `seq` folded; anything at or below it is a duplicate. */
  readonly lastSeq: number;
  /** The current reconnect attempt, 0 while connected. */
  readonly reconnectAttempt: number;
  /** Frames that could not be decoded. Reported, not fatal. */
  readonly malformedFrames: number;
}

export interface FacultyChatState {
  /** The conversation, once known: given, or minted by the first turn. */
  readonly threadId: string | null;
  readonly transcript: 'none' | 'loading' | 'loaded' | 'failed';
  readonly turns: readonly FacultyTurn[];
  /** A failure not tied to one turn's outcome: loading the transcript, or a cancel that did not go through. */
  readonly error: FacultyChatErrorInfo | null;
}

export const initialFacultyChatState = (threadId: string | null = null): FacultyChatState => ({
  threadId,
  transcript: 'none',
  turns: [],
  error: null,
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type FacultyChatAction =
  /** Switch to a thread (or `null`: a new conversation). Clears everything. */
  | { readonly type: 'thread.opened'; readonly threadId: string | null }
  | { readonly type: 'transcript.loading' }
  | {
      readonly type: 'transcript.loaded';
      readonly threadId: string;
      readonly messages: readonly TranscriptMessageView[];
      /** A turn still running: its question is kept, its answer is left for the stream replay. */
      readonly activeOperationId?: string | null;
    }
  | { readonly type: 'transcript.failed'; readonly error: FacultyChatErrorInfo }
  | {
      readonly type: 'turn.submitted';
      readonly key: string;
      readonly operationId: string | null;
      readonly text: string;
      readonly context: FacultyPageContext | null;
      readonly at: string;
    }
  | { readonly type: 'turn.accepted'; readonly key: string; readonly operationId: string; readonly threadId: string }
  | { readonly type: 'turn.rejected'; readonly key: string; readonly error: FacultyChatErrorInfo }
  /** Reading (or re-reading) a turn's stream. Creates the turn if this state has not seen it. */
  | { readonly type: 'turn.attached'; readonly operationId: string }
  | { readonly type: 'stream.item'; readonly operationId: string; readonly item: FacultyStreamItem }
  /** `streamTurn` gave up reconnecting, or could not open at all. */
  | { readonly type: 'stream.lost'; readonly operationId: string; readonly error: FacultyChatErrorInfo }
  | { readonly type: 'turn.cancel_requested'; readonly key: string }
  | { readonly type: 'turn.cancel_settled'; readonly operationId: string; readonly result: CancelledTurn }
  | { readonly type: 'turn.cancel_failed'; readonly operationId: string; readonly error: FacultyChatErrorInfo }
  | { readonly type: 'error.dismissed' };

// ---------------------------------------------------------------------------
// Step labels
// ---------------------------------------------------------------------------

/**
 * Short labels for the faculty tools (FAG-3/4/5) and the skill loader.
 *
 * The tool's *arguments* are not on the wire (agent-v2 keeps them off it on
 * purpose), so a label can say what kind of step this is but not "Looking up
 * 'renal'". That needs a faculty `tool.progress` kind from agent-v2. A query
 * step does get its own words once its `faculty.table` arrives: its `purpose`
 * ("Checking readiness snapshot") replaces this label.
 */
export const FACULTY_STEP_LABELS: Readonly<Record<string, string>> = {
  describeFacultyViews: 'Reading what data is available',
  lookupValues: 'Looking up matching names',
  runFacultyQuery: 'Querying your institution’s data',
  showChart: 'Drawing a chart',
  loadSkill: 'Reading the guidance for this question',
};

/** `runFacultyQuery` → "Run faculty query", for a tool with no label yet. */
export const stepLabelFor = (toolName: string): string => {
  const known = FACULTY_STEP_LABELS[toolName];
  if (known) return known;
  const words = toolName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Working';
};

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const IN_FLIGHT_PHASES: ReadonlySet<FacultyTurnPhase> = new Set([
  'submitting',
  'streaming',
  'reconnecting',
  'paused',
  'cancelling',
]);

/** Whether a turn is still being worked on (and the composer should wait). */
export const isTurnInFlight = (turn: FacultyTurn): boolean => IN_FLIGHT_PHASES.has(turn.phase);

/** The turn the dean is waiting on, if any. `disconnected` counts: it may still be running. */
export const activeTurnOf = (state: FacultyChatState): FacultyTurn | null => {
  const last = state.turns[state.turns.length - 1];
  return last && (isTurnInFlight(last) || last.phase === 'disconnected') ? last : null;
};

/** Whether a new question may be sent now. */
export const canSend = (state: FacultyChatState): boolean =>
  state.transcript !== 'loading' && !state.turns.some(isTurnInFlight);

/** The answer's text: every assistant message with words, in order. */
export const answerTextOf = (turn: FacultyTurn): string =>
  turn.messages
    .map((message) => message.text)
    .filter((text) => text.trim() !== '')
    .join('\n\n');

/** Whether any part of the answer was cut off (cancelled, crashed, or capped). */
export const isAnswerTruncated = (turn: FacultyTurn): boolean =>
  turn.messages.some((message) => message.finishReason === 'interrupted');

// ---------------------------------------------------------------------------
// Folding one stream event onto a turn
// ---------------------------------------------------------------------------

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const nonEmpty = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

const isFinishReason = (value: unknown): value is MessageFinishReason =>
  (MESSAGE_FINISH_REASONS as readonly unknown[]).includes(value);
const isCompletionReason = (value: unknown): value is TurnCompletionReason =>
  (TURN_COMPLETION_REASONS as readonly unknown[]).includes(value);
const isPauseReason = (value: unknown): value is TurnPauseReason =>
  value === 'awaiting_approval' || value === 'awaiting_job';

const blankTurn = (key: string, operationId: string | null): FacultyTurn => ({
  key,
  operationId,
  question: { text: '', context: null, askedAt: null },
  phase: 'streaming',
  outcome: null,
  pauseReason: null,
  messages: [],
  steps: [],
  tables: [],
  charts: [],
  suggestions: [],
  error: null,
  lastEventId: null,
  lastSeq: -1,
  reconnectAttempt: 0,
  malformedFrames: 0,
});

/** End a turn: close what is still open, so a prefix is never shown as a finished answer. */
const finishTurn = (turn: FacultyTurn, outcome: FacultyTurnOutcome, error: FacultyChatErrorInfo | null): FacultyTurn => ({
  ...turn,
  phase: 'done',
  outcome,
  error,
  pauseReason: null,
  reconnectAttempt: 0,
  messages: turn.messages.map((message) =>
    message.streaming ? { ...message, streaming: false, finishReason: message.finishReason ?? 'interrupted' } : message,
  ),
  steps: turn.steps.map((step) => (step.status === 'running' ? { ...step, status: 'stopped' } : step)),
});

const withMessage = (
  turn: FacultyTurn,
  messageId: string,
  update: (message: FacultyAssistantMessage) => FacultyAssistantMessage,
): FacultyTurn => {
  const index = turn.messages.findIndex((message) => message.messageId === messageId);
  if (index === -1) {
    const created = update({ messageId, text: '', finishReason: null, streaming: true });
    return { ...turn, messages: [...turn.messages, created] };
  }
  const messages = turn.messages.slice();
  messages[index] = update(messages[index]);
  return { ...turn, messages };
};

/** Hands a phase back to "streaming" once events flow again, without undoing a pause or a stop. */
const liveAgain = (phase: FacultyTurnPhase): FacultyTurnPhase =>
  phase === 'reconnecting' || phase === 'disconnected' ? 'streaming' : phase;

/** The list with `item` added, or in place of the entry with the same id (a retried step re-sends it). */
const upsertBy = <T>(items: readonly T[], item: T, idOf: (entry: T) => string): readonly T[] => {
  const index = items.findIndex((entry) => idOf(entry) === idOf(item));
  if (index === -1) return [...items, item];
  const next = items.slice();
  next[index] = item;
  return next;
};

/**
 * The first query step still running takes the result's own words. Queries in
 * parallel may swap labels, which is harmless: each label is one of them.
 */
const labelQueryStep = (steps: readonly FacultyStep[], purpose: string): readonly FacultyStep[] => {
  if (!purpose) return steps;
  const index = steps.findIndex(
    (step) =>
      step.toolName === 'runFacultyQuery' &&
      step.status === 'running' &&
      step.label === FACULTY_STEP_LABELS.runFacultyQuery,
  );
  if (index === -1) return steps;
  const next = steps.slice();
  next[index] = { ...next[index], label: purpose };
  return next;
};

/**
 * Faculty extension events (plan §3.6). Each handler folds one event onto a
 * turn; a body that does not parse changes nothing.
 */
export const FACULTY_EXTENSION_HANDLERS: Readonly<
  Record<string, (turn: FacultyTurn, event: FacultyStreamEvent) => FacultyTurn>
> = {
  'faculty.table': (turn, event) => {
    const table = parseFacultyTable(event);
    if (!table) return turn;
    return {
      ...turn,
      tables: upsertBy(turn.tables, table, (entry) => entry.queryId),
      steps: labelQueryStep(turn.steps, table.purpose),
    };
  },
  'faculty.chart': (turn, event) => {
    const chart = parseFacultyChart(event);
    return chart ? { ...turn, charts: upsertBy(turn.charts, chart, (entry) => entry.chartId) } : turn;
  },
};

/**
 * One stream event, folded onto its turn. Pure; returns the same object when
 * nothing changes. A done turn takes nothing more, and a `seq` at or below the
 * last one folded is a duplicate.
 */
export const reduceStreamEvent = (turn: FacultyTurn, event: FacultyStreamEvent): FacultyTurn => {
  if (turn.phase === 'done' || event.seq <= turn.lastSeq) return turn;

  const next: FacultyTurn = {
    ...turn,
    lastSeq: event.seq,
    lastEventId: String(event.seq),
    phase: liveAgain(turn.phase),
    reconnectAttempt: 0,
    error: turn.error?.kind === 'stream_lost' ? null : turn.error,
  };
  const fields = event as unknown as Record<string, unknown>;

  switch (event.type) {
    case 'turn.paused':
      return {
        ...next,
        phase: next.phase === 'cancelling' ? 'cancelling' : 'paused',
        pauseReason: isPauseReason(fields.reason) ? fields.reason : null,
      };

    case 'approval.requested':
      // Faculty tools never ask for approval, and this dashboard cannot answer
      // one. If it happens the turn is parked; say so rather than spin.
      return {
        ...next,
        phase: next.phase === 'cancelling' ? 'cancelling' : 'paused',
        pauseReason: 'awaiting_approval',
      };

    case 'turn.resumed':
      return { ...next, phase: next.phase === 'cancelling' ? 'cancelling' : 'streaming', pauseReason: null };

    case 'turn.completed':
      return finishTurn(next, isCompletionReason(fields.reason) ? fields.reason : 'completed', null);

    case 'turn.failed': {
      const problem = isPlainObject(fields.error) ? fields.error : {};
      return finishTurn(next, 'failed', {
        kind: 'turn_failed',
        status: null,
        code: nonEmpty(problem.code),
        message: str(problem.message),
        retryable: problem.retryable === true,
      });
    }

    case 'message.started': {
      const messageId = nonEmpty(fields.messageId);
      if (!messageId) return next;
      const known = next.messages.some((message) => message.messageId === messageId);
      if (!known) {
        return { ...next, messages: [...next.messages, { messageId, text: '', finishReason: null, streaming: true }] };
      }
      // A super-step ran again under the same id: discard and begin again.
      return {
        ...withMessage(next, messageId, () => ({ messageId, text: '', finishReason: null, streaming: true })),
        steps: next.steps.filter((step) => step.messageId !== messageId),
      };
    }

    case 'text.delta': {
      const messageId = nonEmpty(fields.messageId);
      const text = str(fields.text);
      if (!messageId || !text) return next;
      return withMessage(next, messageId, (message) => ({ ...message, text: message.text + text, streaming: true }));
    }

    case 'message.completed': {
      const messageId = nonEmpty(fields.messageId);
      if (!messageId) return next;
      return withMessage(next, messageId, (message) => ({
        ...message,
        streaming: false,
        finishReason: isFinishReason(fields.reason) ? fields.reason : 'complete',
      }));
    }

    case 'tool.started': {
      const toolCallId = nonEmpty(fields.toolCallId);
      if (!toolCallId || next.steps.some((step) => step.toolCallId === toolCallId)) return next;
      const toolName = str(fields.toolName).trim();
      return {
        ...next,
        steps: [
          ...next.steps,
          {
            toolCallId,
            toolName,
            label: stepLabelFor(toolName),
            status: 'running',
            messageId: nonEmpty(fields.messageId),
            startedAt: nonEmpty(event.at),
            settledAt: null,
          },
        ],
      };
    }

    case 'tool.settled': {
      const toolCallId = nonEmpty(fields.toolCallId);
      if (!toolCallId || !next.steps.some((step) => step.toolCallId === toolCallId)) return next;
      return {
        ...next,
        steps: next.steps.map((step) =>
          step.toolCallId === toolCallId
            ? { ...step, status: fields.ok === true ? 'succeeded' : 'failed', settledAt: nonEmpty(event.at) }
            : step,
        ),
      };
    }

    case 'suggestions.offered': {
      const questions = Array.isArray(fields.questions)
        ? fields.questions.filter((q): q is string => typeof q === 'string' && q.trim() !== '').map((q) => q.trim())
        : [];
      return { ...next, suggestions: questions };
    }

    default: {
      const extension = FACULTY_EXTENSION_HANDLERS[event.type];
      // Known-but-silent events (turn.started, step.*, reasoning.delta,
      // usage.updated, stream.heartbeat, tool.progress) and unknown ones only
      // move the cursor.
      return extension ? extension(next, event) : next;
    }
  }
};

// ---------------------------------------------------------------------------
// Rebuilding turns from a transcript
// ---------------------------------------------------------------------------

/** The provider's stored tool calls (`[{ id, name, ... }]`), as `{ toolCallId, toolName }`. */
const toolCallsOf = (value: unknown): { toolCallId: string; toolName: string }[] =>
  (Array.isArray(value) ? value : []).flatMap((call) => {
    if (!isPlainObject(call)) return [];
    const toolCallId = nonEmpty(call.id) ?? nonEmpty(call.toolCallId);
    const toolName = nonEmpty(call.name) ?? nonEmpty(call.toolName);
    return toolCallId && toolName ? [{ toolCallId, toolName }] : [];
  });

/**
 * A thread's transcript as turns, one per operation, in order.
 *
 * Tool rows only settle the steps their calls opened (a result row exists, so
 * the call finished; whether it went well is not on the row). Assistant rows
 * carry the tables and charts as `facultyResults`. System rows are not shown. For `activeOperationId`, only the question is kept: the stream
 * replay that follows carries the whole answer, and keeping the stored half
 * too would show it twice.
 */
export const turnsFromTranscript = (
  rows: readonly TranscriptMessageView[],
  activeOperationId: string | null = null,
): FacultyTurn[] => {
  const groups = new Map<string, TranscriptMessageView[]>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row !== 'object' || row === null) continue;
    const operationId = str(row.operationId).trim();
    if (!operationId) continue;
    const group = groups.get(operationId);
    if (group) group.push(row);
    else groups.set(operationId, [row]);
  }

  const turns: FacultyTurn[] = [];
  for (const [operationId, group] of groups) {
    const userRow = group.find((row) => row.role === 'user');
    const assistantRows = group.filter((row) => row.role === 'assistant');
    if (!userRow && assistantRows.length === 0) continue;

    const { text, context } = splitFoldedContext(str(userRow?.content));
    const base: FacultyTurn = {
      ...blankTurn(operationId, operationId),
      question: { text, context, askedAt: nonEmpty(userRow?.createdAt) },
    };

    if (operationId === activeOperationId) {
      turns.push(base);
      continue;
    }

    const settled = new Set(
      group.filter((row) => row.role === 'tool').map((row) => str(row.toolCallId).trim()).filter(Boolean),
    );
    const messages: FacultyAssistantMessage[] = assistantRows.map((row) => ({
      messageId: str(row.messageId),
      text: str(row.content),
      finishReason: isFinishReason(row.finishReason) ? row.finishReason : null,
      streaming: false,
    }));
    const steps: FacultyStep[] = assistantRows.flatMap((row) =>
      toolCallsOf(row.toolCalls).map(({ toolCallId, toolName }) => ({
        toolCallId,
        toolName,
        label: stepLabelFor(toolName),
        status: settled.has(toolCallId) ? 'succeeded' : 'stopped',
        messageId: nonEmpty(row.messageId),
        startedAt: nonEmpty(row.createdAt),
        settledAt: null,
      })),
    );
    const last = messages[messages.length - 1];
    const results = assistantRows.map((row) => parseFacultyResults(row.facultyResults));

    turns.push({
      ...base,
      phase: 'done',
      outcome: last?.finishReason === 'complete' ? 'completed' : 'unknown',
      messages,
      steps,
      tables: results.flatMap((result) => result.tables),
      charts: results.flatMap((result) => result.charts),
    });
  }
  return turns;
};

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

const updateTurn = (
  state: FacultyChatState,
  matches: (turn: FacultyTurn) => boolean,
  update: (turn: FacultyTurn) => FacultyTurn,
): FacultyChatState => {
  const index = state.turns.findIndex(matches);
  if (index === -1) return state;
  const current = state.turns[index];
  const updated = update(current);
  if (updated === current) return state;
  const turns = state.turns.slice();
  turns[index] = updated;
  return { ...state, turns };
};

const byKey = (key: string) => (turn: FacultyTurn) => turn.key === key;
const byOperation = (operationId: string) => (turn: FacultyTurn) => turn.operationId === operationId;

export const facultyChatReducer = (state: FacultyChatState, action: FacultyChatAction): FacultyChatState => {
  switch (action.type) {
    case 'thread.opened':
      return initialFacultyChatState(action.threadId);

    case 'transcript.loading':
      return { ...state, transcript: 'loading', error: null };

    case 'transcript.loaded': {
      if (state.threadId !== null && state.threadId !== action.threadId) return state;
      const loaded = turnsFromTranscript(action.messages, action.activeOperationId ?? null);
      const loadedIds = new Set(loaded.map((turn) => turn.operationId));
      // Keep any turn this state already holds that the transcript does not
      // (one submitted while the load was in flight).
      const kept = state.turns.filter((turn) => turn.operationId === null || !loadedIds.has(turn.operationId));
      return { ...state, threadId: action.threadId, transcript: 'loaded', turns: [...loaded, ...kept] };
    }

    case 'transcript.failed':
      return { ...state, transcript: 'failed', error: action.error };

    case 'turn.submitted':
      return {
        ...state,
        error: null,
        turns: [
          ...state.turns,
          {
            ...blankTurn(action.key, action.operationId),
            question: { text: action.text, context: action.context, askedAt: action.at },
            phase: 'submitting',
          },
        ],
      };

    case 'turn.accepted': {
      const next = updateTurn(state, byKey(action.key), (turn) => ({
        ...turn,
        operationId: action.operationId,
        // A stop pressed while the POST was in flight stays a stop.
        phase: turn.phase === 'cancelling' ? 'cancelling' : 'streaming',
      }));
      return { ...next, threadId: next.threadId ?? action.threadId };
    }

    case 'turn.rejected':
      return updateTurn(state, byKey(action.key), (turn) => finishTurn(turn, 'rejected', action.error));

    case 'turn.attached': {
      if (!state.turns.some(byOperation(action.operationId))) {
        return { ...state, turns: [...state.turns, blankTurn(action.operationId, action.operationId)] };
      }
      return updateTurn(state, byOperation(action.operationId), (turn) =>
        turn.phase === 'done'
          ? turn
          : {
              ...turn,
              phase: turn.phase === 'disconnected' ? 'streaming' : turn.phase,
              error: turn.error?.kind === 'stream_lost' ? null : turn.error,
            },
      );
    }

    case 'stream.item': {
      const { item } = action;
      const next = updateTurn(state, byOperation(action.operationId), (turn) => {
        if (turn.phase === 'done') return turn;
        switch (item.kind) {
          case 'open':
            return turn.phase === 'reconnecting' || turn.phase === 'disconnected'
              ? { ...turn, phase: 'streaming', reconnectAttempt: 0 }
              : turn;
          case 'reconnecting':
            return {
              ...turn,
              phase: turn.phase === 'cancelling' || turn.phase === 'paused' ? turn.phase : 'reconnecting',
              reconnectAttempt: item.attempt,
            };
          case 'malformed':
            return {
              ...turn,
              malformedFrames: turn.malformedFrames + 1,
              lastEventId: item.id !== null && /^\d+$/.test(item.id) ? item.id : turn.lastEventId,
            };
          case 'event':
            return reduceStreamEvent(turn, item.event);
          default:
            return turn;
        }
      });
      if (item.kind === 'event' && item.event.type === 'turn.started' && next.threadId === null) {
        const threadId = nonEmpty((item.event as unknown as Record<string, unknown>).threadId);
        return threadId ? { ...next, threadId } : next;
      }
      return next;
    }

    case 'stream.lost':
      return updateTurn(state, byOperation(action.operationId), (turn) =>
        turn.phase === 'done' ? turn : { ...turn, phase: 'disconnected', error: action.error, reconnectAttempt: 0 },
      );

    case 'turn.cancel_requested':
      return updateTurn(state, byKey(action.key), (turn) =>
        isTurnInFlight(turn) || turn.phase === 'disconnected' ? { ...turn, phase: 'cancelling' } : turn,
      );

    case 'turn.cancel_settled': {
      const { result } = action;
      if (result.status !== 'completed' && result.status !== 'failed') return state;
      // The stream normally brings the ending first; this covers a stream
      // that is not open (disconnected) so the card still settles.
      return updateTurn(state, byOperation(action.operationId), (turn) =>
        turn.phase === 'done'
          ? turn
          : result.status === 'failed'
            ? finishTurn(turn, 'failed', null)
            : finishTurn(turn, result.completionReason ?? 'cancelled', null),
      );
    }

    case 'turn.cancel_failed': {
      const next = updateTurn(state, byOperation(action.operationId), (turn) =>
        turn.phase === 'cancelling' ? { ...turn, phase: 'streaming' } : turn,
      );
      return { ...next, error: action.error };
    }

    case 'error.dismissed':
      return state.error === null ? state : { ...state, error: null };

    default:
      return state;
  }
};
