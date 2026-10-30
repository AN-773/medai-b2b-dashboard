import { describe, expect, it } from 'vitest';

import { ev, helloTurn, OP, THREAD } from './facultyChatFakes';

import type { FacultyStreamItem } from '../facultyChatClient';
import type { FacultyChatErrorInfo } from '../facultyChatErrors';
import {
  answerTextOf,
  canSend,
  facultyChatReducer,
  initialFacultyChatState,
  isAnswerTruncated,
  reduceStreamEvent,
  stepLabelFor,
  turnsFromTranscript,
  type FacultyChatAction,
  type FacultyChatState,
} from '../facultyChatReducer';
import type { FacultyStreamEvent, TranscriptMessageView } from '../facultyChatWire';

const run = (actions: FacultyChatAction[], from: FacultyChatState = initialFacultyChatState()) =>
  actions.reduce(facultyChatReducer, from);

const item = (event: FacultyStreamEvent): FacultyChatAction => ({
  type: 'stream.item',
  operationId: OP,
  item: { kind: 'event', event, id: String(event.seq) },
});
const meta = (streamItem: FacultyStreamItem): FacultyChatAction => ({ type: 'stream.item', operationId: OP, item: streamItem });

const submitted: FacultyChatAction = {
  type: 'turn.submitted',
  key: OP,
  operationId: OP,
  text: 'Who needs attention?',
  context: { cohortId: 'c_1' },
  at: '2026-10-30T00:00:00.000Z',
};
const accepted: FacultyChatAction = { type: 'turn.accepted', key: OP, operationId: OP, threadId: THREAD };

const lostError: FacultyChatErrorInfo = {
  kind: 'stream_lost',
  status: null,
  code: null,
  message: 'lost',
  retryable: true,
};

describe('a full turn', () => {
  it('goes submitting → streaming → done, with the answer text and the new thread id', () => {
    const afterSubmit = run([submitted]);
    expect(afterSubmit.turns[0]).toMatchObject({ phase: 'submitting', question: { text: 'Who needs attention?' } });
    expect(canSend(afterSubmit)).toBe(false);

    const afterAccept = run([accepted], afterSubmit);
    expect(afterAccept.threadId).toBe(THREAD);
    expect(afterAccept.turns[0].phase).toBe('streaming');

    const midway = run(helloTurn().slice(0, 3).map(item), afterAccept);
    expect(midway.turns[0].messages).toEqual([{ messageId: 'm1', text: 'Hel', finishReason: null, streaming: true }]);

    const done = run(helloTurn().slice(3).map(item), midway);
    const [turn] = done.turns;
    expect(turn).toMatchObject({ phase: 'done', outcome: 'completed', error: null, lastEventId: '5', lastSeq: 5 });
    expect(answerTextOf(turn)).toBe('Hello');
    expect(isAnswerTruncated(turn)).toBe(false);
    expect(canSend(done)).toBe(true);
  });

  it('takes the thread id from turn.started when the state has none (attaching)', () => {
    const state = run([{ type: 'turn.attached', operationId: OP }, item(ev(0, 'turn.started', { threadId: 'from-stream' }))]);
    expect(state.threadId).toBe('from-stream');
  });

  it('joins a multi-message answer and skips the empty tool-calling message', () => {
    const state = run([
      submitted,
      accepted,
      item(ev(0, 'message.started', { messageId: 'm1' })),
      item(ev(1, 'message.completed', { messageId: 'm1', reason: 'tool_calls' })),
      item(ev(2, 'message.started', { messageId: 'm2' })),
      item(ev(3, 'text.delta', { messageId: 'm2', text: 'Three students.' })),
      item(ev(4, 'message.completed', { messageId: 'm2', reason: 'complete' })),
      item(ev(5, 'turn.completed', { reason: 'completed' })),
    ]);
    expect(state.turns[0].messages.map((message) => message.finishReason)).toEqual(['tool_calls', 'complete']);
    expect(answerTextOf(state.turns[0])).toBe('Three students.');
  });
});

describe('tool steps', () => {
  it('shows each call with a label and settles it in place', () => {
    const state = run([
      submitted,
      accepted,
      item(ev(0, 'message.started', { messageId: 'm1' })),
      item(ev(1, 'tool.started', { messageId: 'm1', toolCallId: 'c1', toolName: 'describeFacultyViews' })),
      item(ev(2, 'tool.started', { messageId: 'm1', toolCallId: 'c2', toolName: 'runFacultyQuery' })),
      item(ev(3, 'tool.settled', { toolCallId: 'c1', ok: true })),
      item(ev(4, 'tool.settled', { toolCallId: 'c2', ok: false })),
      item(ev(5, 'tool.started', { messageId: 'm1', toolCallId: 'c3', toolName: 'someNewTool' })),
    ]);
    expect(state.turns[0].steps.map(({ toolCallId, label, status }) => ({ toolCallId, label, status }))).toEqual([
      { toolCallId: 'c1', label: 'Reading what data is available', status: 'succeeded' },
      { toolCallId: 'c2', label: 'Querying your institution’s data', status: 'failed' },
      { toolCallId: 'c3', label: 'Some new tool', status: 'running' },
    ]);
    expect(state.turns[0].steps[0]).toMatchObject({ startedAt: ev(1, 'x').at, settledAt: ev(3, 'x').at, messageId: 'm1' });

    const ended = run([item(ev(6, 'turn.completed', { reason: 'completed' }))], state);
    expect(ended.turns[0].steps[2].status).toBe('stopped');
  });

  it('ignores a repeated tool.started and a settle for a call it never saw', () => {
    const state = run([
      submitted,
      accepted,
      item(ev(0, 'tool.started', { messageId: 'm1', toolCallId: 'c1', toolName: 'lookupValues' })),
      item(ev(1, 'tool.started', { messageId: 'm1', toolCallId: 'c1', toolName: 'lookupValues' })),
      item(ev(2, 'tool.settled', { toolCallId: 'ghost', ok: true })),
    ]);
    expect(state.turns[0].steps).toHaveLength(1);
  });

  it('labels unknown tool names readably', () => {
    expect(stepLabelFor('loadSkill')).toBe('Reading the guidance for this question');
    expect(stepLabelFor('fetch_cohort-stats')).toBe('Fetch cohort stats');
    expect(stepLabelFor('')).toBe('Working');
  });
});

describe('protocol rules', () => {
  it('a repeated message.started discards that message and its steps, then begins again', () => {
    const state = run([
      submitted,
      accepted,
      item(ev(0, 'message.started', { messageId: 'm1' })),
      item(ev(1, 'text.delta', { messageId: 'm1', text: 'First attempt, abandoned' })),
      item(ev(2, 'tool.started', { messageId: 'm1', toolCallId: 'c1', toolName: 'runFacultyQuery' })),
      item(ev(3, 'message.started', { messageId: 'm1' })),
      item(ev(4, 'text.delta', { messageId: 'm1', text: 'Second' })),
    ]);
    expect(state.turns[0].messages).toEqual([{ messageId: 'm1', text: 'Second', finishReason: null, streaming: true }]);
    expect(state.turns[0].steps).toEqual([]);
  });

  it('ignores an event at or below the last seq (a replayed duplicate)', () => {
    const before = run([submitted, accepted, ...helloTurn().slice(0, 3).map(item)]);
    const after = run([item(ev(2, 'text.delta', { messageId: 'm1', text: 'Hel' }))], before);
    expect(after).toBe(before);
  });

  it('only moves the cursor for unknown events, silent events and faculty events it cannot read', () => {
    const before = run([submitted, accepted]);
    const after = run(
      [
        item(ev(0, 'brand.new.event', { anything: true })),
        item(ev(1, 'stream.heartbeat')),
        item(ev(2, 'usage.updated', { inputTokens: 1, outputTokens: 1, costUsd: 0, costLimitUsd: 1 })),
        item(ev(3, 'reasoning.delta', { messageId: 'm1', text: 'thinking' })),
        item(ev(4, 'faculty.table', { queryId: 'q1', columns: 'not a list', rows: [] })),
        item(ev(5, 'faculty.chart', { chartId: 'c1', queryId: 'q1', chartType: 'sankey', x: 'a', y: ['b'], rows: [] })),
      ],
      before,
    );
    const [turn] = after.turns;
    expect(turn).toEqual({ ...before.turns[0], lastSeq: 5, lastEventId: '5' });
    expect(turn.tables).toEqual([]);
    expect(turn.charts).toEqual([]);
  });

  describe('faculty results', () => {
    const table = {
      queryId: 'q1',
      purpose: 'Checking readiness snapshot',
      sql: 'SELECT 1',
      columns: [{ name: 'name', dataType: 'text' }],
      rows: [{ name: 'Sara' }],
      rowCount: 1,
      truncated: false,
      durationMs: 12,
      asOf: [{ kind: 'readiness', computedAt: '2026-10-29T02:00:00.000Z' }],
    };
    const chart = { chartId: 'c1', queryId: 'q1', x: 'name', y: ['n'], takeaway: 'Few', rows: [{ name: 'Sara', n: 3 }] };
    const querying = ev(0, 'tool.started', { messageId: 'm1', toolCallId: 'call-1', toolName: 'runFacultyQuery' });

    it('folds a table onto its turn, and a query step takes the result’s own words', () => {
      const state = run([submitted, accepted, item(querying), item(ev(1, 'faculty.table', table))]);
      const [turn] = state.turns;
      expect(turn.tables).toEqual([table]);
      expect(turn.steps[0]).toMatchObject({ label: 'Checking readiness snapshot', status: 'running' });
    });

    it('replaces a table re-sent under the same queryId rather than showing it twice', () => {
      const state = run([
        submitted,
        accepted,
        item(ev(0, 'faculty.table', table)),
        item(ev(1, 'faculty.table', { ...table, rows: [{ name: 'Omar' }] })),
      ]);
      expect(state.turns[0].tables.map((entry) => entry.rows)).toEqual([[{ name: 'Omar' }]]);
    });

    it('reads a chart’s type from chartType, since `type` is the event’s own name', () => {
      const state = run([submitted, accepted, item(ev(0, 'faculty.chart', { ...chart, chartType: 'kpi' }))]);
      expect(state.turns[0].charts).toEqual([{ ...chart, type: 'kpi' }]);
    });

    it('keeps the rows on a replay without double-appending', () => {
      const once = run([submitted, accepted, item(ev(0, 'faculty.table', table))]);
      expect(run([item(ev(0, 'faculty.table', table))], once)).toBe(once);
    });
  });

  it('counts malformed frames and keeps their id as the cursor', () => {
    const state = run([
      submitted,
      accepted,
      meta({ kind: 'malformed', id: '7', eventName: 'text.delta', reason: 'invalid_json' }),
    ]);
    expect(state.turns[0]).toMatchObject({ malformedFrames: 1, lastEventId: '7', phase: 'streaming' });
  });

  it('a done turn takes nothing more', () => {
    const done = run([submitted, accepted, ...helloTurn().map(item)]);
    expect(run([item(ev(9, 'text.delta', { messageId: 'm1', text: '!' }))], done)).toBe(done);
  });
});

describe('errors', () => {
  it('turn.failed ends the turn failed, keeps the code, and marks an open message interrupted', () => {
    const state = run([
      submitted,
      accepted,
      item(ev(0, 'message.started', { messageId: 'm1' })),
      item(ev(1, 'text.delta', { messageId: 'm1', text: 'Partial' })),
      item(ev(2, 'turn.failed', { error: { code: 'model_unavailable', message: 'The model is down.', retryable: true } })),
    ]);
    const [turn] = state.turns;
    expect(turn).toMatchObject({
      phase: 'done',
      outcome: 'failed',
      error: { kind: 'turn_failed', code: 'model_unavailable', message: 'The model is down.', retryable: true },
    });
    expect(turn.messages[0]).toMatchObject({ streaming: false, finishReason: 'interrupted' });
    expect(isAnswerTruncated(turn)).toBe(true);
  });

  it('a refused POST ends the turn rejected with the typed error, and the composer frees up', () => {
    const error: FacultyChatErrorInfo = { kind: 'daily_cap', status: 429, code: 'cap', message: 'cap', retryable: false };
    const state = run([submitted, { type: 'turn.rejected', key: OP, error }]);
    expect(state.turns[0]).toMatchObject({ phase: 'done', outcome: 'rejected', error });
    expect(canSend(state)).toBe(true);
  });

  it('reconnecting, reopened, lost and re-attached move the phase and keep the cursor', () => {
    let state = run([submitted, accepted, ...helloTurn().slice(0, 3).map(item)]);

    state = run([meta({ kind: 'reconnecting', attempt: 2, delayMs: 1000, lastEventId: '2', cause: lostError })], state);
    expect(state.turns[0]).toMatchObject({ phase: 'reconnecting', reconnectAttempt: 2, lastEventId: '2' });

    state = run([meta({ kind: 'open', attempt: 1, lastEventId: '2' })], state);
    expect(state.turns[0]).toMatchObject({ phase: 'streaming', reconnectAttempt: 0 });

    state = run([{ type: 'stream.lost', operationId: OP, error: lostError }], state);
    expect(state.turns[0]).toMatchObject({ phase: 'disconnected', error: lostError, lastEventId: '2' });
    expect(canSend(state)).toBe(true);

    state = run([{ type: 'turn.attached', operationId: OP }], state);
    expect(state.turns[0]).toMatchObject({ phase: 'streaming', error: null });

    state = run(helloTurn().slice(3).map(item), state);
    expect(answerTextOf(state.turns[0])).toBe('Hello');
  });

  it('transcript.failed and a failed cancel land on state.error, and can be dismissed', () => {
    const error: FacultyChatErrorInfo = { kind: 'network', status: null, code: null, message: 'x', retryable: true };
    let state = run([{ type: 'thread.opened', threadId: THREAD }, { type: 'transcript.loading' }, { type: 'transcript.failed', error }]);
    expect(state).toMatchObject({ transcript: 'failed', error });
    state = run([{ type: 'error.dismissed' }], state);
    expect(state.error).toBeNull();
  });
});

describe('cancel', () => {
  it('cancelling, then the stream says cancelled: done, and the partial answer is marked', () => {
    const state = run([
      submitted,
      accepted,
      item(ev(0, 'message.started', { messageId: 'm1' })),
      item(ev(1, 'text.delta', { messageId: 'm1', text: 'Part' })),
      { type: 'turn.cancel_requested', key: OP },
    ]);
    expect(state.turns[0].phase).toBe('cancelling');

    const done = run(
      [
        item(ev(2, 'message.completed', { messageId: 'm1', reason: 'interrupted' })),
        item(ev(3, 'turn.completed', { reason: 'cancelled' })),
      ],
      state,
    );
    expect(done.turns[0]).toMatchObject({ phase: 'done', outcome: 'cancelled' });
    expect(isAnswerTruncated(done.turns[0])).toBe(true);
  });

  it('a stop pressed while the POST is in flight survives the accept', () => {
    const state = run([submitted, { type: 'turn.cancel_requested', key: OP }, accepted]);
    expect(state.turns[0].phase).toBe('cancelling');
  });

  it('cancel_settled ends a turn whose stream is not open', () => {
    const state = run([
      submitted,
      accepted,
      { type: 'stream.lost', operationId: OP, error: lostError },
      { type: 'turn.cancel_requested', key: OP },
      {
        type: 'turn.cancel_settled',
        operationId: OP,
        result: { operationId: OP, cancelled: true, status: 'completed', completionReason: 'cancelled' },
      },
    ]);
    expect(state.turns[0]).toMatchObject({ phase: 'done', outcome: 'cancelled' });
  });

  it('a cancel that failed goes back to streaming and reports the error', () => {
    const error: FacultyChatErrorInfo = { kind: 'network', status: null, code: null, message: 'x', retryable: true };
    const state = run([
      submitted,
      accepted,
      { type: 'turn.cancel_requested', key: OP },
      { type: 'turn.cancel_failed', operationId: OP, error },
    ]);
    expect(state.turns[0].phase).toBe('streaming');
    expect(state.error).toEqual(error);
  });
});

describe('transcripts', () => {
  const row = (fields: Partial<TranscriptMessageView> & Pick<TranscriptMessageView, 'messageId' | 'role' | 'operationId'>): TranscriptMessageView => ({
    content: '',
    stepIndex: null,
    ordinal: 0,
    finishReason: null,
    toolCalls: null,
    toolCallId: null,
    anchorMessageId: null,
    createdAt: '2026-10-29T10:00:00.000Z',
    ...fields,
  });

  const OLD = 'op-old';
  const transcript: TranscriptMessageView[] = [
    row({
      messageId: 'u1',
      role: 'user',
      operationId: OLD,
      content: 'Which topics are hardest?\n\n<dashboard_context>{"cohortId":"c_9","page":"mastery"}</dashboard_context>',
    }),
    row({
      messageId: 'a1',
      role: 'assistant',
      operationId: OLD,
      finishReason: 'tool_calls',
      toolCalls: [
        { id: 'c1', name: 'runFacultyQuery', args: { sql: 'select 1' } },
        { id: 'c2', name: 'showChart' },
      ],
    }),
    row({ messageId: 't1', role: 'tool', operationId: OLD, toolCallId: 'c1', content: '{"rows":3}' }),
    row({ messageId: 's1', role: 'system', operationId: OLD, content: 'hidden' }),
    row({ messageId: 'a2', role: 'assistant', operationId: OLD, content: 'Renal and cardio.', finishReason: 'complete' }),
    row({ messageId: 'u2', role: 'user', operationId: OP, content: 'And why?' }),
    row({ messageId: 'a3', role: 'assistant', operationId: OP, content: 'Because', finishReason: 'tool_calls' }),
  ];

  it('rebuilds one done turn per operation, with the context split back off the question', () => {
    const [old, running] = turnsFromTranscript(transcript);
    expect(old).toMatchObject({
      key: OLD,
      operationId: OLD,
      phase: 'done',
      outcome: 'completed',
      question: { text: 'Which topics are hardest?', context: { cohortId: 'c_9', page: 'mastery' } },
    });
    expect(answerTextOf(old)).toBe('Renal and cardio.');
    expect(old.steps.map(({ toolCallId, label, status }) => ({ toolCallId, label, status }))).toEqual([
      { toolCallId: 'c1', label: 'Querying your institution’s data', status: 'succeeded' },
      { toolCallId: 'c2', label: 'Drawing a chart', status: 'stopped' },
    ]);
    expect(running).toMatchObject({ phase: 'done', outcome: 'unknown', question: { text: 'And why?', context: null } });
  });

  it('keeps only the question of a turn still running, so the stream replay is not shown twice', () => {
    let state = run([
      { type: 'thread.opened', threadId: THREAD },
      { type: 'transcript.loading' },
      { type: 'transcript.loaded', threadId: THREAD, messages: transcript, activeOperationId: OP },
    ]);
    expect(state.transcript).toBe('loaded');
    expect(state.turns[1]).toMatchObject({ operationId: OP, phase: 'streaming', messages: [], lastSeq: -1 });

    state = run([{ type: 'turn.attached', operationId: OP }, ...helloTurn().map(item)], state);
    expect(state.turns).toHaveLength(2);
    expect(state.turns[1]).toMatchObject({ phase: 'done', outcome: 'completed', question: { text: 'And why?' } });
    expect(answerTextOf(state.turns[1])).toBe('Hello');
  });

  it('rebuilds a turn’s tables and charts from its assistant rows, dropping what it cannot read', () => {
    const table = {
      queryId: 'q1',
      purpose: 'Topics',
      sql: 'SELECT 1',
      columns: [{ name: 'topic', dataType: 'text' }],
      rows: [{ topic: 'Renal' }],
      rowCount: 1,
      truncated: false,
      durationMs: 3,
      asOf: [],
    };
    const chart = { chartId: 'c1', queryId: 'q1', type: 'bar', x: 'topic', y: ['n'], takeaway: 'Renal', rows: [{ topic: 'Renal', n: 2 }] };
    const stored = {
      tables: [table, { queryId: 'broken' }],
      charts: [chart, { chartId: 'c2', type: 'sankey', x: 'a', y: ['b'], rows: [] }],
    };
    const [turn] = turnsFromTranscript([
      row({ messageId: 'u1', role: 'user', operationId: OLD, content: 'Hardest topics?' }),
      row({
        messageId: 'a1',
        role: 'assistant',
        operationId: OLD,
        content: 'Renal.',
        finishReason: 'complete',
        facultyResults: stored as unknown as TranscriptMessageView['facultyResults'],
      }),
    ]);
    expect(turn.tables).toEqual([table]);
    expect(turn.charts).toEqual([chart]);
  });

  it('turn.attached for a turn it has never seen creates one to fold into', () => {
    const state = run([{ type: 'turn.attached', operationId: OP }, ...helloTurn().map(item)]);
    expect(state.turns).toHaveLength(1);
    expect(answerTextOf(state.turns[0])).toBe('Hello');
  });

  it('ignores a transcript for a thread it is not showing', () => {
    const state = run([{ type: 'thread.opened', threadId: 'other' }]);
    expect(run([{ type: 'transcript.loaded', threadId: THREAD, messages: transcript }], state)).toBe(state);
  });
});

describe('reduceStreamEvent', () => {
  it('returns the same turn object when nothing changes', () => {
    const [turn] = run([submitted, accepted, ...helloTurn().map(item)]).turns;
    expect(reduceStreamEvent(turn, ev(99, 'text.delta', { messageId: 'm1', text: 'x' }))).toBe(turn);
  });
});
