// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FacultyTurn } from '@/services/facultyChatReducer';
import type { FacultyChart, FacultyFeedbackBody, FacultyTable } from '@/services/facultyChatWire';

import { AskAnswerCard } from '../AskAnswerCard';
import { AskResultChart } from '../AskResultChart';

import { attentionTable, OPERATION, topicChart, turnWith } from './askFixtures';

const feedback: FacultyFeedbackBody[] = [];
const onFeedback = async (body: FacultyFeedbackBody) => {
  feedback.push(body);
};

const renderCard = (turn: FacultyTurn, props: Partial<React.ComponentProps<typeof AskAnswerCard>> = {}) =>
  render(
    <AskAnswerCard
      turn={turn}
      onFeedback={onFeedback}
      onReconnect={() => undefined}
      onNewConversation={() => undefined}
      {...props}
    />,
  );

const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

beforeEach(() => {
  feedback.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('while it is being answered', () => {
  const steps: FacultyTurn['steps'] = [
    { toolCallId: 'a', toolName: 'loadSkill', label: 'Reading the guidance for this question', status: 'succeeded', messageId: 'm1', startedAt: null, settledAt: null },
    { toolCallId: 'b', toolName: 'runFacultyQuery', label: 'Checking readiness snapshot', status: 'running', messageId: 'm1', startedAt: null, settledAt: null },
  ];

  it('shows the steps, the running one trailing off', () => {
    renderCard(turnWith({ phase: 'streaming', outcome: null, messages: [], steps }));
    const list = screen.getByRole('list', { name: 'What the assistant is doing' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Reading the guidance for this question',
      'Checking readiness snapshot…',
    ]);
  });

  it('offers no rating, no provenance and no as-of line until the answer is finished', () => {
    renderCard(
      turnWith({
        phase: 'streaming',
        outcome: null,
        messages: [{ messageId: 'm1', text: 'Sara', finishReason: null, streaming: true }],
        tables: [attentionTable],
      }),
    );
    expect(screen.queryByRole('button', { name: 'Useful answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'How this was computed' })).toBeNull();
    expect(screen.queryByText(/Data as of/)).toBeNull();
  });

  it('drops the steps once it is done', () => {
    renderCard(turnWith({ steps: steps.map((step) => ({ ...step, status: 'succeeded' })) }));
    expect(screen.queryByRole('list', { name: 'What the assistant is doing' })).toBeNull();
  });

  it('says it is reconnecting even with a step running', () => {
    renderCard(turnWith({ phase: 'reconnecting', outcome: null, messages: [], steps }));
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
  });
});

describe('the answer', () => {
  it('renders the markdown, the table, the chart and the as-of line', () => {
    renderCard(turnWith({ tables: [attentionTable], charts: [topicChart], messages: [{ messageId: 'm1', text: '**Sara** needs attention.', finishReason: 'complete', streaming: false }] }));

    expect(screen.getByText('Sara', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Sara is furthest behind' })).toBeTruthy();
    expect(screen.getByText('Data as of 29 Oct, 02:00 UTC')).toBeTruthy();
  });

  it('says "Live data" when every source is live, and nothing when no data was read', () => {
    const { unmount } = renderCard(turnWith({ tables: [{ ...attentionTable, asOf: [] }] }));
    expect(screen.getByText('Live data')).toBeTruthy();
    unmount();

    renderCard(turnWith());
    expect(screen.queryByText('Live data')).toBeNull();
  });

  it('says "as of unknown", never "Live data", for a snapshot it cannot date', () => {
    const { container } = renderCard(turnWith({ tables: [{ ...attentionTable, asOf: [], asOfUnknown: true }] }));
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));

    expect(screen.getByText('Data as of unknown')).toBeTruthy();
    expect(screen.getByText('As of unknown')).toBeTruthy();
    expect(container.textContent).not.toContain('Live data');
  });

  it('says so when a prefix is all there is', () => {
    renderCard(turnWith({ outcome: 'unknown', messages: [{ messageId: 'm1', text: 'Sara', finishReason: 'interrupted', streaming: false }] }));
    expect(screen.getByText('This answer was cut off before it finished.')).toBeTruthy();
  });

  it('keeps every query and folds the ones that are not the answer', () => {
    const first: FacultyTable = { ...attentionTable, queryId: 'q-look', purpose: 'A first look at the data' };
    renderCard(turnWith({ tables: [first, attentionTable] }));

    expect(screen.queryByText('A first look at the data')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 other result' }));
    expect(screen.getByText('A first look at the data')).toBeTruthy();
  });

  it('keeps a query in view when a chart draws it', () => {
    const charted: FacultyTable = { ...attentionTable, queryId: 'q-chart', purpose: 'The charted one' };
    renderCard(turnWith({ tables: [charted, attentionTable], charts: [{ ...topicChart, queryId: 'q-chart' }] }));
    expect(screen.getByText('The charted one')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /other result/ })).toBeNull();
  });
});

describe('the table', () => {
  it('leaves ids off the screen, and marks a flagged student', () => {
    renderCard(turnWith({ tables: [attentionTable] }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Name',
      'Readiness',
      'Items answered',
      'Needs attention',
      'Your feedback',
    ]);
    expect(within(table).getByText('Needs attention', { selector: 'span' })).toBeTruthy();
    expect(table.textContent).not.toContain('u-sara');
  });

  it('sorts on a header, then the other way, and says so', () => {
    renderCard(turnWith({ tables: [attentionTable] }));
    const table = screen.getByRole('table');
    const header = within(table).getByRole('columnheader', { name: 'Readiness' });
    expect(header.getAttribute('aria-sort')).toBe('none');

    fireEvent.click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(rowsOf(table)).toEqual(['Sara', 'Omar']);

    fireEvent.click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('descending');
    expect(rowsOf(table)).toEqual(['Omar', 'Sara']);
  });

  it('says when it holds only the first rows', () => {
    renderCard(turnWith({ tables: [{ ...attentionTable, truncated: true }] }));
    expect(screen.getByText('Showing the first 2 rows. There are more.')).toBeTruthy();
  });

  it('says when no row matched, and offers nothing to download', () => {
    renderCard(turnWith({ tables: [{ ...attentionTable, rows: [], rowCount: 0 }] }));
    expect(screen.getByText('No rows matched this question.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull();
  });

  it('shows hostile values as the text they are', () => {
    const hostile: FacultyTable = {
      ...attentionTable,
      purpose: '<img src=x onerror=alert(1)>',
      sql: '<script>alert(1)</script>',
      columns: [{ name: 'name', dataType: 'text' }],
      rows: [{ name: '<img src=x onerror=alert(1)>' }, { name: '<script>alert(1)</script>' }],
    };
    const { container } = renderCard(
      turnWith({
        tables: [hostile],
        messages: [{ messageId: 'm1', text: '<b>bold</b> <script>alert(1)</script>', finishReason: 'complete', streaming: false }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getAllByText('<script>alert(1)</script>').length).toBeGreaterThan(0);
  });
});

describe('the CSV download', () => {
  let saved: Blob[];
  let clicked: { download: string; href: string }[];

  beforeEach(() => {
    saved = [];
    clicked = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          saved.push(blob);
          return 'blob:mock';
        },
        revokeObjectURL: () => undefined,
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
  });

  const readBlob = (blob: Blob) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });

  it('downloads every column and row, with formula cells neutralised', async () => {
    const table: FacultyTable = {
      ...attentionTable,
      columns: [
        { name: 'learner_id', dataType: 'text' },
        { name: 'name', dataType: 'text' },
        { name: 'score', dataType: 'numeric' },
      ],
      rows: [
        { learner_id: 'u-1', name: '=HYPERLINK("http://evil.example")', score: -0.25 },
        { learner_id: 'u-2', name: '@SUM(1,1)', score: 1 },
        { learner_id: 'u-3', name: '+1+1', score: 2 },
        { learner_id: 'u-4', name: '-1+1', score: 3 },
      ],
    };
    renderCard(turnWith({ tables: [table] }));
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(/^ask-checking-readiness-snapshot-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (await readBlob(saved[0])).replace(/^﻿/, '').split('\r\n');
    expect(lines.slice(0, 5)).toEqual([
      'Learner ID,Name,Score',
      `u-1,"'=HYPERLINK(""http://evil.example"")",-0.25`,
      `u-2,"'@SUM(1,1)",1`,
      `u-3,'+1+1,2`,
      `u-4,'-1+1,3`,
    ]);
  });
});

describe('how this was computed', () => {
  it('is collapsed, and opens to the question, the SQL, the rows, the as-of and the sample sizes', () => {
    renderCard(turnWith({ tables: [{ ...attentionTable, truncated: true }] }));
    const toggle = screen.getByRole('button', { name: 'How this was computed' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('The question as understood')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const fact = (label: string) => screen.getByText(label).parentElement?.textContent;
    expect(fact('The question as understood')).toContain('Checking readiness snapshot');
    expect(fact('The query')).toContain('SELECT name, readiness FROM faculty.student_readiness');
    expect(fact('Rows')).toContain('Showing the first 2 rows. There are more.');
    expect(fact('Data as of')).toContain('Readiness: 29 Oct, 02:00 UTC');
    expect(fact('Sample sizes')).toContain('Items answered: 41 to 120');
  });

  it('puts the model’s plain words above the SQL', () => {
    renderCard(turnWith({ tables: [attentionTable] }));
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));

    const words = screen.getByText('In plain words');
    expect(words.parentElement?.textContent).toContain(attentionTable.explanation);
    const query = screen.getByText('The query');
    expect(words.compareDocumentPosition(query) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the explanation as text, and leaves its place out when there is none', () => {
    const { container, unmount } = renderCard(
      turnWith({ tables: [{ ...attentionTable, explanation: '<img src=x onerror=alert(1)> **not bold**' }] }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)> **not bold**')).toBeTruthy();
    unmount();

    renderCard(turnWith({ tables: [{ ...attentionTable, explanation: '' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));
    expect(screen.queryByText('In plain words')).toBeNull();
  });

  it('has a block per query', () => {
    const other: FacultyTable = { ...attentionTable, queryId: 'q-2', purpose: 'A second query', asOf: [] };
    renderCard(turnWith({ tables: [other, attentionTable] }));
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));
    expect(screen.getAllByText('The question as understood')).toHaveLength(2);
    expect(screen.getByText('A second query')).toBeTruthy();
    expect(screen.getByText('Live data', { selector: 'dd span' })).toBeTruthy();
  });
});

describe('feedback', () => {
  it('rates the answer as a whole', async () => {
    renderCard(turnWith());
    fireEvent.click(screen.getByRole('button', { name: 'Useful answer' }));

    expect(await screen.findByText('Thanks for your feedback.')).toBeTruthy();
    expect(feedback).toEqual([{ operationId: OPERATION, rating: 'up' }]);
    expect(screen.getByRole('button', { name: 'Useful answer' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('says so when a rating does not save', async () => {
    renderCard(turnWith(), { onFeedback: () => Promise.reject(new Error('no')) });
    fireEvent.click(screen.getByRole('button', { name: 'Not a useful answer' }));
    expect(await screen.findByText('Couldn’t save that. Please try again.')).toBeTruthy();
  });

  it('does not offer a rating on an answer that failed', () => {
    renderCard(turnWith({ outcome: 'failed', error: { kind: 'turn_failed', status: null, code: null, message: '', retryable: false } }));
    expect(screen.queryByRole('button', { name: 'Useful answer' })).toBeNull();
  });

  it('asks about a flagged student only, with the three verdicts', async () => {
    renderCard(turnWith({ tables: [attentionTable] }));
    const buttons = screen.getAllByRole('button', { name: 'Feedback on this flag' });
    expect(buttons).toHaveLength(1);

    fireEvent.click(buttons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Useful',
      'Not useful',
      'Incorrectly flagged',
    ]);

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Incorrectly flagged' }));
    await waitFor(() => expect(feedback).toHaveLength(1));
    expect(feedback[0]).toEqual({
      operationId: OPERATION,
      queryId: attentionTable.queryId,
      learnerId: 'u-sara',
      flag: 'incorrectly_flagged',
    });
  });

  it('keeps a verdict on its student through a sort', async () => {
    renderCard(turnWith({ tables: [attentionTable] }));
    fireEvent.click(screen.getByRole('button', { name: 'Feedback on this flag' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Not useful' }));
    await screen.findByRole('button', { name: 'Feedback on this flag: Not useful' });

    const table = screen.getByRole('table');
    const header = within(table).getByRole('columnheader', { name: 'Readiness' });
    fireEvent.click(within(header).getByRole('button'));
    fireEvent.click(within(header).getByRole('button'));

    expect(rowsOf(table)).toEqual(['Omar', 'Sara']);
    const sara = within(table).getAllByRole('row')[2];
    expect(within(sara).getByRole('button', { name: 'Feedback on this flag: Not useful' })).toBeTruthy();
  });

  it('falls back to the dashboard’s threshold when the query did not select the flag', () => {
    const table: FacultyTable = {
      ...attentionTable,
      columns: attentionTable.columns.filter((column) => column.name !== 'needs_attention'),
    };
    renderCard(turnWith({ tables: [table] }));
    expect(screen.getAllByRole('button', { name: 'Feedback on this flag' })).toHaveLength(1);
  });
});

describe('when there is no full answer', () => {
  const refused = (kind: Parameters<typeof turnWith>[0] extends never ? never : NonNullable<FacultyTurn['error']>['kind']) =>
    turnWith({ outcome: 'rejected', messages: [], error: { kind, status: null, code: null, message: 'raw server text', retryable: false } });

  it.each([
    ['forbidden', /only available to institution admins and owners/],
    ['daily_cap', /reached today’s limit/],
    ['surface_mismatch', /cannot be continued here/],
    ['tenant_mismatch', /belongs to a different institution/],
    ['not_configured', /not available on this site/],
    ['invalid_request', /can’t be sent as it is/],
  ] as const)('explains a %s refusal in plain words, never the server’s', (kind, copy) => {
    renderCard(refused(kind));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(copy);
    expect(alert.textContent).not.toContain('raw server text');
  });

  it('points a thread it cannot continue at a new question', () => {
    const onNewConversation = vi.fn();
    renderCard(refused('surface_mismatch'), { onNewConversation });
    fireEvent.click(screen.getByRole('button', { name: 'New question' }));
    expect(onNewConversation).toHaveBeenCalledOnce();
  });

  it('offers to ask again when that could work', () => {
    const onAskAgain = vi.fn();
    const turn = turnWith({
      outcome: 'failed',
      messages: [],
      error: { kind: 'turn_failed', status: null, code: 'internal', message: '', retryable: true },
    });
    renderCard(turn, { onAskAgain });
    fireEvent.click(screen.getByRole('button', { name: 'Ask again' }));
    expect(onAskAgain).toHaveBeenCalledWith(turn);
  });

  it('offers to reconnect a dropped answer', () => {
    const onReconnect = vi.fn();
    renderCard(
      turnWith({
        phase: 'disconnected',
        outcome: null,
        error: { kind: 'stream_lost', status: null, code: null, message: '', retryable: true },
      }),
      { onReconnect },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it.each([
    ['cancelled', 'You stopped this answer.'],
    ['budget_exceeded', 'This question needed more work than one answer allows. Try narrowing it down.'],
    ['step_limit_exceeded', 'This question needed more work than one answer allows. Try narrowing it down.'],
  ] as const)('says why a %s turn stopped', (outcome, copy) => {
    renderCard(turnWith({ outcome }));
    expect(screen.getByRole('status').textContent).toContain(copy);
  });

  it('says so when a stored question has no answer', () => {
    renderCard(turnWith({ outcome: 'unknown', messages: [] }));
    expect(screen.getByText('There is no saved answer for this question.')).toBeTruthy();
  });
});

describe('AskResultChart', () => {
  const chart = (fields: Partial<FacultyChart>): FacultyChart => ({ ...topicChart, ...fields });

  it.each(['bar', 'line', 'area', 'pie'] as const)('frames a %s chart with its takeaway', (type) => {
    render(<AskResultChart chart={chart({ type })} />);
    expect(screen.getByRole('img', { name: 'Sara is furthest behind' })).toBeTruthy();
  });

  it('shows a KPI as a figure, with no plot', () => {
    render(<AskResultChart chart={chart({ type: 'kpi', y: ['active_learners'], rows: [{ active_learners: '1842' }] })} />);
    expect(screen.getByText('Active learners')).toBeTruthy();
    expect(screen.getByText('1,842')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('never draws from nothing', () => {
    const { container } = render(<AskResultChart chart={chart({ rows: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it('says when it leaves measures out, rather than inventing a fifth colour', () => {
    render(<AskResultChart chart={chart({ y: ['a', 'b', 'c', 'd', 'e'] })} />);
    expect(screen.getByText('Showing the first 4 measures. The table has them all.')).toBeTruthy();
  });
});

describe('copy', () => {
  it('says "needs attention", never that a student will fail', () => {
    const { container } = renderCard(turnWith({ tables: [attentionTable] }));
    fireEvent.click(screen.getByRole('button', { name: 'How this was computed' }));
    expect(container.textContent).toMatch(/needs attention/i);
    expect(container.textContent).not.toMatch(/will fail|predicted to fail|at risk of failing/i);
  });
});
