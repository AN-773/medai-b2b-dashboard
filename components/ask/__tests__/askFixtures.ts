/** Faculty results and turns for the Ask component tests. */
import { facultyChatReducer, initialFacultyChatState, type FacultyTurn } from '@/services/facultyChatReducer';
import type { FacultyChart, FacultyTable } from '@/services/facultyChatWire';

export const OPERATION = 'op-1';

export const attentionTable: FacultyTable = {
  queryId: 'q-attention',
  purpose: 'Checking readiness snapshot',
  explanation: 'Readiness is mastery times coverage times pacing. This lists each student’s latest score.',
  sql: 'SELECT name, readiness FROM faculty.student_readiness',
  columns: [
    { name: 'learner_id', dataType: 'text' },
    { name: 'name', dataType: 'text' },
    { name: 'readiness', dataType: 'numeric' },
    { name: 'items_answered', dataType: 'int4' },
    { name: 'needs_attention', dataType: 'bool' },
  ],
  rows: [
    { learner_id: 'u-sara', name: 'Sara', readiness: '0.22', items_answered: 41, needs_attention: true },
    { learner_id: 'u-omar', name: 'Omar', readiness: '0.74', items_answered: 120, needs_attention: false },
  ],
  rowCount: 2,
  truncated: false,
  durationMs: 12,
  asOf: [{ kind: 'readiness', computedAt: '2026-10-29T02:00:00Z' }],
  asOfUnknown: false,
};

export const topicChart: FacultyChart = {
  chartId: 'c-1',
  queryId: 'q-attention',
  type: 'bar',
  x: 'name',
  y: ['readiness'],
  takeaway: 'Sara is furthest behind',
  rows: [{ name: 'Sara', readiness: 0.22 }],
};

const blank = facultyChatReducer(initialFacultyChatState(), { type: 'turn.attached', operationId: OPERATION }).turns[0];

export const turnWith = (fields: Partial<FacultyTurn> = {}): FacultyTurn => ({
  ...blank,
  question: { text: 'Who needs attention?', context: null, askedAt: '2026-10-30T10:00:00Z' },
  phase: 'done',
  outcome: 'completed',
  messages: [{ messageId: 'm1', text: 'Sara needs attention.', finishReason: 'complete', streaming: false }],
  ...fields,
});
