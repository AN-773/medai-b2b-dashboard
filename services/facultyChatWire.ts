/**
 * The agent-v2 wire, as far as the faculty "Ask" chat reads it.
 *
 * Mirrored by hand from agent-v2's `@medai/contracts` (0.108.0, `origin/test`
 * af0de254): `stream/events.ts`, `turns/*`, `threads/list.ts` and
 * `threads/transcript.ts`, plus the 202 body `apps/api/src/server.ts` answers
 * `POST /v1/turns` with. That package is a private workspace package this repo
 * cannot import, so the copy lives here, in one file, and holds only the fields
 * this dashboard reads. `contracts/agent-v2-contract.md` is the prose version.
 *
 * Two kinds of event are deliberately *not* closed over:
 *
 * - **An event this file does not know** is ignorable, never fatal (agent-v2's
 *   REF-6 C18): the backend adds events additively without moving
 *   `PROTOCOL_VERSION`, so a reader must skip what it does not recognise and
 *   still advance its cursor past it.
 * - **`faculty.table` and `faculty.chart`** carry rows straight out of a
 *   database, so nothing in them is trusted to have the shape it should:
 *   {@link parseFacultyTable} and {@link parseFacultyChart} read them
 *   defensively, and a body that does not fit is dropped rather than rendered.
 *
 * The faculty shapes mirror FAG-5's `packages/contracts/src/faculty/results.ts`,
 * which was still uncommitted on `dean/w2-query` when this was written.
 */

import type { FacultyPageContext } from './facultyChatContext';

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/** The screen a turn was asked from. `faculty` is the dean's surface (FAG-1). */
export const FACULTY_SURFACE = 'faculty';

/** The longest `message` agent-v2 accepts (`MAX_MESSAGE_CHARS` in `apps/api/src/turns.ts`). */
export const MAX_TURN_MESSAGE_CHARS = 32_000;

/** The longest `threadId` agent-v2 accepts (`MAX_IDENTIFIER_CHARS`). */
export const MAX_IDENTIFIER_CHARS = 200;

/**
 * The body of `POST /v1/turns` this dashboard sends.
 *
 * A user token decides who the turn belongs to, so `userId`, `origin` and
 * `voiceSessionId` are refused on presence and never sent.
 */
export interface CreateFacultyTurnBody {
  readonly message: string;
  readonly surface: typeof FACULTY_SURFACE;
  /** Where the question was asked from. A hint, never an authorisation (FAG-5). */
  readonly facultyContext?: FacultyPageContext;
  /** Omitted for a new conversation: the server mints one. */
  readonly threadId?: string;
  /** A UUID the client picks, so a retried POST is the same turn (`created: false`). */
  readonly operationId?: string;
}

/** The `202` body of `POST /v1/turns`. */
export interface CreatedTurn {
  readonly operationId: string;
  readonly threadId: string;
  /** `false` when this `operationId` had already been accepted: a retry, not a second turn. */
  readonly created: boolean;
  /** Relative paths that address the turn. */
  readonly stream: string;
  readonly cancel: string;
  readonly approvals: string;
}

export const TURN_STATUSES = [
  'queued',
  'running',
  'waiting_for_human',
  'waiting_for_job',
  'completed',
  'failed',
] as const;
export type TurnStatus = (typeof TURN_STATUSES)[number];

/** Why a turn stopped without failing. */
export type TurnCompletionReason = 'completed' | 'cancelled' | 'budget_exceeded' | 'step_limit_exceeded';

export const TURN_COMPLETION_REASONS: readonly TurnCompletionReason[] = [
  'completed',
  'cancelled',
  'budget_exceeded',
  'step_limit_exceeded',
];

/** The `200` body of `POST /v1/turns/:operationId/cancel`. A turn already over is still a 200. */
export interface CancelledTurn {
  readonly operationId: string;
  /** Whether this call is the one that ended it. */
  readonly cancelled: boolean;
  readonly status: TurnStatus;
  readonly completionReason: TurnCompletionReason | null;
}

// ---------------------------------------------------------------------------
// Stream events (`GET /v1/turns/:operationId/stream`)
// ---------------------------------------------------------------------------

/** Carried by every event. `seq` is also the SSE `id:` and the `Last-Event-ID` cursor. */
export interface StreamEventEnvelope {
  readonly seq: number;
  readonly operationId: string;
  readonly at: string;
}

export const MESSAGE_FINISH_REASONS = ['complete', 'tool_calls', 'interrupted', 'empty'] as const;
export type MessageFinishReason = (typeof MESSAGE_FINISH_REASONS)[number];

export type TurnPauseReason = 'awaiting_approval' | 'awaiting_job';

/** A terminal failure. Clients switch on `code`, never on `message`. */
export interface StreamError {
  readonly code: string;
  /** Safe to show. */
  readonly message: string;
  readonly retryable: boolean;
}

export interface TurnStartedEvent extends StreamEventEnvelope {
  readonly type: 'turn.started';
  readonly threadId: string;
}
export interface TurnPausedEvent extends StreamEventEnvelope {
  readonly type: 'turn.paused';
  readonly reason: TurnPauseReason;
}
export interface TurnResumedEvent extends StreamEventEnvelope {
  readonly type: 'turn.resumed';
  readonly reason: TurnPauseReason;
}
export interface TurnCompletedEvent extends StreamEventEnvelope {
  readonly type: 'turn.completed';
  readonly reason: TurnCompletionReason;
}
export interface TurnFailedEvent extends StreamEventEnvelope {
  readonly type: 'turn.failed';
  readonly error: StreamError;
}
export interface StepStartedEvent extends StreamEventEnvelope {
  readonly type: 'step.started';
  readonly stepIndex: number;
  readonly attempt: number;
}
export interface StepFinishedEvent extends StreamEventEnvelope {
  readonly type: 'step.finished';
  readonly stepIndex: number;
}
/** Repeated for an id the client already holds, it means: discard that message and begin again. */
export interface MessageStartedEvent extends StreamEventEnvelope {
  readonly type: 'message.started';
  readonly messageId: string;
}
export interface MessageCompletedEvent extends StreamEventEnvelope {
  readonly type: 'message.completed';
  readonly messageId: string;
  readonly reason: MessageFinishReason;
}
/** Append; never replace. */
export interface TextDeltaEvent extends StreamEventEnvelope {
  readonly type: 'text.delta';
  readonly messageId: string;
  readonly text: string;
}
export interface ReasoningDeltaEvent extends StreamEventEnvelope {
  readonly type: 'reasoning.delta';
  readonly messageId: string;
  readonly text: string;
}
/** A tool call began. Its arguments are deliberately not on the wire. */
export interface ToolStartedEvent extends StreamEventEnvelope {
  readonly type: 'tool.started';
  readonly messageId: string;
  readonly toolCallId: string;
  readonly toolName: string;
}
/** A tool call finished. The result payload is deliberately not on the wire. */
export interface ToolSettledEvent extends StreamEventEnvelope {
  readonly type: 'tool.settled';
  readonly toolCallId: string;
  readonly ok: boolean;
}
/** What a running *search* says about itself (`SRCH-24`). No faculty tool emits it yet. */
export interface ToolProgressEvent extends StreamEventEnvelope {
  readonly type: 'tool.progress';
  readonly toolCallId: string;
  readonly progress: { readonly kind: string } & Readonly<Record<string, unknown>>;
}
export interface ApprovalRequestedEvent extends StreamEventEnvelope {
  readonly type: 'approval.requested';
  readonly toolCallIds: readonly string[];
  readonly messageId?: string;
  readonly calls?: readonly { readonly toolCallId: string; readonly toolName: string }[];
}
export interface UsageUpdatedEvent extends StreamEventEnvelope {
  readonly type: 'usage.updated';
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly costLimitUsd: number;
}
export interface SuggestionsOfferedEvent extends StreamEventEnvelope {
  readonly type: 'suggestions.offered';
  readonly messageId: string;
  readonly questions: readonly string[];
  readonly tools: readonly string[];
}
/** Keepalive, written every 15 s of quiet. A numbered event, so it moves the cursor. */
export interface StreamHeartbeatEvent extends StreamEventEnvelope {
  readonly type: 'stream.heartbeat';
}

/** Every event agent-v2 can send today (`AgentStreamEvent`). */
export type AgentStreamEvent =
  | TurnStartedEvent
  | TurnPausedEvent
  | TurnResumedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | StepStartedEvent
  | StepFinishedEvent
  | MessageStartedEvent
  | MessageCompletedEvent
  | TextDeltaEvent
  | ReasoningDeltaEvent
  | ToolStartedEvent
  | ToolSettledEvent
  | ToolProgressEvent
  | ApprovalRequestedEvent
  | UsageUpdatedEvent
  | SuggestionsOfferedEvent
  | StreamHeartbeatEvent;

export const STREAM_EVENT_TYPES = [
  'turn.started',
  'turn.paused',
  'turn.resumed',
  'turn.completed',
  'turn.failed',
  'step.started',
  'step.finished',
  'message.started',
  'message.completed',
  'text.delta',
  'reasoning.delta',
  'tool.started',
  'tool.settled',
  'tool.progress',
  'approval.requested',
  'usage.updated',
  'suggestions.offered',
  'stream.heartbeat',
] as const satisfies readonly AgentStreamEvent['type'][];

/** The two events after which a turn says nothing more. */
export const TERMINAL_STREAM_EVENT_TYPES = ['turn.completed', 'turn.failed'] as const;

export const isTerminalStreamEventType = (type: string): boolean =>
  (TERMINAL_STREAM_EVENT_TYPES as readonly string[]).includes(type);

// --- Faculty extension events (plan §3.6, FAG-5) ---------------------------

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** One result row, by column name. Everything in it came out of a database: treat it as text. */
export type FacultyRow = Readonly<Record<string, JsonValue>>;

export interface FacultyColumn {
  readonly name: string;
  /** The database's name for the type (`text`, `numeric`, `timestamptz`, ...). */
  readonly dataType: string;
}

/** How fresh one snapshot behind a result is. `kind` is `faculty.snapshot_status.kind`. */
export interface FacultyAsOf {
  readonly kind: string;
  readonly computedAt: string;
}

/**
 * The full result of one `runFacultyQuery` call, for the UI only (the model
 * sees a ~4,000-character preview).
 */
export interface FacultyTable {
  readonly queryId: string;
  /** What the agent understood this query to be for, in its own words. */
  readonly purpose: string;
  readonly sql: string;
  readonly columns: readonly FacultyColumn[];
  /** At most {@link MAX_FACULTY_RESULT_ROWS}. */
  readonly rows: readonly FacultyRow[];
  /** How many rows are in `rows`, not how many the query matched. */
  readonly rowCount: number;
  /** The query matched more rows than `rows` holds. */
  readonly truncated: boolean;
  readonly durationMs: number;
  /** Empty when every source is live. */
  readonly asOf: readonly FacultyAsOf[];
}

export const FACULTY_CHART_TYPES = ['bar', 'line', 'area', 'pie', 'kpi'] as const;
export type FacultyChartType = (typeof FACULTY_CHART_TYPES)[number];

/** A validated chart spec and the rows it draws (`showChart`). No code, only data. */
export interface FacultyChart {
  readonly chartId: string;
  /** The result this chart was drawn from. */
  readonly queryId: string;
  readonly type: FacultyChartType;
  readonly x: string;
  readonly y: readonly string[];
  readonly takeaway: string;
  readonly rows: readonly FacultyRow[];
}

/** The most rows one `faculty.table` carries. */
export const MAX_FACULTY_RESULT_ROWS = 500;

export interface FacultyTableEvent extends StreamEventEnvelope, FacultyTable {
  readonly type: 'faculty.table';
}

/** On the stream `type` is the event's own name, so the chart's type rides as `chartType`. */
export interface FacultyChartEvent extends StreamEventEnvelope, Omit<FacultyChart, 'type'> {
  readonly type: 'faculty.chart';
  readonly chartType: FacultyChartType;
}

export const FACULTY_EXTENSION_EVENT_TYPES = ['faculty.table', 'faculty.chart'] as const;
export type FacultyExtensionEvent = FacultyTableEvent | FacultyChartEvent;

/** On a turn's last assistant transcript row: what its `faculty.*` events carried. */
export interface FacultyResults {
  readonly tables: readonly FacultyTable[];
  readonly charts: readonly FacultyChart[];
}

const isRow = (value: unknown): value is FacultyRow => isPlainObject(value);

const readRows = (value: unknown): FacultyRow[] | null =>
  Array.isArray(value) ? value.filter(isRow).slice(0, MAX_FACULTY_RESULT_ROWS) : null;

const readColumns = (value: unknown): FacultyColumn[] | null => {
  if (!Array.isArray(value)) return null;
  return value.flatMap((column) =>
    isPlainObject(column) && typeof column.name === 'string' && column.name
      ? [{ name: column.name, dataType: typeof column.dataType === 'string' ? column.dataType : '' }]
      : [],
  );
};

const readAsOf = (value: unknown): FacultyAsOf[] =>
  (Array.isArray(value) ? value : []).flatMap((entry) =>
    isPlainObject(entry) && typeof entry.kind === 'string' && typeof entry.computedAt === 'string'
      ? [{ kind: entry.kind, computedAt: entry.computedAt }]
      : [],
  );

const readCount = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

/** A `faculty.table` body (or a stored one), or `null` when it has no id, columns or rows. */
export const parseFacultyTable = (value: unknown): FacultyTable | null => {
  if (!isPlainObject(value) || typeof value.queryId !== 'string' || !value.queryId) return null;
  const columns = readColumns(value.columns);
  const rows = readRows(value.rows);
  if (columns === null || rows === null) return null;
  return {
    queryId: value.queryId,
    purpose: typeof value.purpose === 'string' ? value.purpose.trim() : '',
    sql: typeof value.sql === 'string' ? value.sql : '',
    columns,
    rows,
    rowCount: readCount(value.rowCount, rows.length),
    truncated: value.truncated === true,
    durationMs: readCount(value.durationMs, 0),
    asOf: readAsOf(value.asOf),
  };
};

/**
 * A `faculty.chart` body (or a stored one), or `null` when it cannot be drawn.
 * A stored chart says `type`; an event says `chartType`.
 */
export const parseFacultyChart = (value: unknown): FacultyChart | null => {
  if (!isPlainObject(value) || typeof value.chartId !== 'string' || !value.chartId) return null;
  const type = FACULTY_CHART_TYPES.find((known) => known === (value.chartType ?? value.type));
  const y = Array.isArray(value.y) ? value.y.filter((key): key is string => typeof key === 'string' && key !== '') : [];
  const rows = readRows(value.rows);
  if (!type || y.length === 0 || rows === null) return null;
  return {
    chartId: value.chartId,
    queryId: typeof value.queryId === 'string' ? value.queryId : '',
    type,
    x: typeof value.x === 'string' ? value.x : '',
    y,
    takeaway: typeof value.takeaway === 'string' ? value.takeaway.trim() : '',
    rows,
  };
};

/** What a stored assistant row's `facultyResults` holds, with anything unreadable dropped. */
export const parseFacultyResults = (value: unknown): FacultyResults => {
  const results = isPlainObject(value) ? value : {};
  return {
    tables: (Array.isArray(results.tables) ? results.tables : []).flatMap((table) => parseFacultyTable(table) ?? []),
    charts: (Array.isArray(results.charts) ? results.charts : []).flatMap((chart) => parseFacultyChart(chart) ?? []),
  };
};

// --- Feedback (`POST /v1/faculty/feedback`) --------------------------------

export type FacultyRating = 'up' | 'down';
export type FacultyFlag = 'useful' | 'not_useful' | 'incorrectly_flagged' | 'fixed';

/**
 * A dean's verdict on an answer (`rating`) or on one flagged student
 * (`learnerId` + `flag`). The server takes the dean and tenant from the token.
 */
export interface FacultyFeedbackBody {
  readonly operationId: string;
  readonly queryId?: string;
  readonly learnerId?: string;
  readonly rating?: FacultyRating;
  readonly flag?: FacultyFlag;
}

/** An event whose `type` this file does not know. Ignored, but its `seq` still counts. */
export interface UnknownStreamEvent extends StreamEventEnvelope {
  readonly type: string;
  readonly [field: string]: unknown;
}

/** What the stream reader hands on: a decoded event with a valid envelope. */
export type FacultyStreamEvent = AgentStreamEvent | FacultyExtensionEvent | UnknownStreamEvent;

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export type ActiveTurnStatus = 'queued' | 'running' | 'waiting_for_human' | 'waiting_for_job';

/** One conversation, as `GET /v1/threads` lists it. Every field is the caller's own view. */
export interface ListedThread {
  readonly threadId: string;
  /** The opening question, truncated. An older thread's may hold a context trailer: `threadTitleOf`. */
  readonly title: string | null;
  readonly turnCount: number;
  readonly createdAt: string;
  readonly lastTurnAt: string;
  /** A turn still running on this thread: pass it to `useFacultyChat` to re-attach. */
  readonly activeOperationId: string | null;
  readonly activeTurnStatus: ActiveTurnStatus | null;
  readonly lastReplyAt: string | null;
  readonly unread: boolean;
  readonly pinned: boolean;
  /** Set on migrated tutor threads only. Not the surface. */
  readonly mode: string | null;
  /** Expected from FAG-1 (`threads.surface`); absent on servers before it. */
  readonly surface?: string | null;
}

/** The `200` body of `GET /v1/threads`. */
export interface ListThreadsResponse {
  readonly threads: readonly ListedThread[];
  /** Opaque. `null` when the page was not full. */
  readonly nextCursor: string | null;
  /** Opaque; for the watch stream, which this dashboard does not open. */
  readonly watchCursor: string;
}

/** The largest page `GET /v1/threads` serves (`MAX_THREAD_LIST_LIMIT`). */
export const MAX_THREAD_LIST_LIMIT = 200;

/** One row of `GET /v1/threads/:threadId/messages`. `role` is `user`, `assistant`, `tool` or `system`. */
export interface TranscriptMessageView {
  readonly messageId: string;
  readonly role: string;
  readonly content: string;
  readonly operationId: string;
  readonly stepIndex: number | null;
  readonly ordinal: number;
  readonly finishReason: string | null;
  /** The provider's stored shape: in practice `[{ id, name, ... }]`. Read defensively. */
  readonly toolCalls: unknown;
  readonly toolCallId: string | null;
  readonly anchorMessageId: string | null;
  readonly createdAt: string;
  /** A faculty turn's last assistant row only: its tables and charts, once the stream is gone. */
  readonly facultyResults?: FacultyResults;
}

/** The `200` body of `GET /v1/threads/:threadId/messages`. */
export interface ThreadMessagesResponse {
  readonly threadId: string;
  readonly messages: readonly TranscriptMessageView[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** agent-v2's refusal envelope: `{ error: { code, message, ... } }`. */
export interface AgentProblem {
  readonly code: string;
  readonly message: string;
  readonly [detail: string]: unknown;
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The problem inside a refusal body, or null when the body is not agent-v2's envelope. */
export const problemOf = (body: unknown): AgentProblem | null => {
  if (!isPlainObject(body)) return null;
  const problem = body.error;
  if (!isPlainObject(problem) || typeof problem.code !== 'string') return null;
  return {
    ...problem,
    code: problem.code,
    message: typeof problem.message === 'string' ? problem.message : '',
  };
};
