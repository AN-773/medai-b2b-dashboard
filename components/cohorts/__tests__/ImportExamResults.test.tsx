// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { AuthProvider } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiClient';
import type { ExamResultRow, ExamResultsReport } from '@/services/examResultsService';

import { MAX_EXAM_FILE_BYTES, canSaveExamResults, examFileProblem, formatExamScore } from '../examResultsModel';
import { ImportExamResultsButton } from '../ImportExamResultsButton';
import ImportExamResultsDrawer from '../ImportExamResultsDrawer';

const ROLES = 'https://iam.weos.io/v1/roles';
const TENANT_ROLE = 'https://iam.weos.io/v1/tenant_role';

const base64url = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const signIn = (claims: Record<string, unknown>) =>
  localStorage.setItem('msai_educator_token', `${base64url({ alg: 'none' })}.${base64url(claims)}.sig`);

const CSV = 'email,exam_name,exam_date,score,passed\nsara@example.com,Renal final,2026-06-15,78,true\n';
const IMPORT_PATH = '/cohorts/year-2/exam-results/import';

const row = (fields: Partial<ExamResultRow> = {}): ExamResultRow => ({
  line: 2,
  email: 'sara@example.com',
  learnerId: '/users/sara',
  learnerName: 'Sara Haddad',
  examName: 'Renal final',
  examDate: '2026-06-15',
  score: 78,
  maxScore: 100,
  passed: true,
  error: null,
  ...fields,
});

const REJECTED = row({
  line: 3,
  email: 'nobody@example.com',
  learnerId: '',
  learnerName: '',
  score: 0,
  maxScore: null,
  passed: false,
  error: 'No learner with this email in this cohort.',
});

const report = (rows: ExamResultRow[], fields: Partial<ExamResultsReport> = {}): ExamResultsReport => ({
  dryRun: true,
  total: rows.length,
  valid: rows.filter((entry) => !entry.error).length,
  saved: 0,
  rows,
  ...fields,
});

const savedReport = (rows: ExamResultRow[]) => report(rows, { dryRun: false, saved: rows.length });

const refusal = (status: number, data: unknown = { error: 'pq: relation exam_results does not exist' }) =>
  Object.assign(new Error('The server said something technical'), { status, data });

const csvFile = (text = CSV, name = 'results.csv') => new File([text], name, { type: 'text/csv' });

const fileInput = () => screen.getByLabelText<HTMLInputElement>('Exam results CSV file');
const choose = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /^Save/ });

const renderDrawer = (onClose: () => void = () => undefined) =>
  render(<ImportExamResultsDrawer cohortId="/cohorts/year-2" cohortTitle="Year 2" onClose={onClose} />);

let post: MockInstance<typeof apiClient.post>;

const previewOf = async (rows: ExamResultRow[]) => {
  post.mockResolvedValueOnce(report(rows));
  renderDrawer();
  choose(csvFile());
  await screen.findByText('results.csv');
};

const callsWith = (dryRun: boolean) =>
  post.mock.calls.filter(([, endpoint]) => endpoint.endsWith(`dryRun=${String(dryRun)}`));

beforeEach(() => {
  localStorage.clear();
  post = vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('A call this test did not expect'));
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('who sees the import', () => {
  const renderButton = () =>
    render(
      <AuthProvider>
        <p>Cohort page</p>
        <ImportExamResultsButton cohortId="/cohorts/year-2" cohortTitle="Year 2" />
      </AuthProvider>,
    );

  it.each([
    ['a tenant admin', { [ROLES]: ['Administrator'], [TENANT_ROLE]: 'admin' }],
    ['a tenant owner', { [ROLES]: ['user'], [TENANT_ROLE]: 'owner' }],
    ['a superadmin who is also an owner', { [ROLES]: ['superadmin'], [TENANT_ROLE]: 'owner' }],
  ])('shows it to %s', async (_name, claims) => {
    signIn(claims);
    renderButton();
    expect(await screen.findByRole('button', { name: 'Import exam results' })).toBeTruthy();
  });

  it.each([
    ['a superadmin-only account', { [ROLES]: ['superadmin'] }],
    ['an Administrator with no tenant role', { [ROLES]: ['Administrator'] }],
    ['a tenant member', { [ROLES]: ['user'], [TENANT_ROLE]: 'member' }],
  ])('hides it from %s', async (_name, claims) => {
    signIn(claims);
    renderButton();
    await screen.findByText('Cohort page');
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });

  it('keeps it on a site with no agent: it goes to learning, not to Ask', async () => {
    vi.stubEnv('VITE_AGENT_V2_API_URL', '');
    signIn({ [ROLES]: ['Administrator'], [TENANT_ROLE]: 'admin' });
    renderButton();
    expect(await screen.findByRole('button', { name: 'Import exam results' })).toBeTruthy();
  });

  it('opens the drawer on this cohort', async () => {
    signIn({ [ROLES]: ['Administrator'], [TENANT_ROLE]: 'admin' });
    renderButton();
    fireEvent.click(await screen.findByRole('button', { name: 'Import exam results' }));

    const drawer = screen.getByRole('dialog', { name: 'Import exam results' });
    expect(within(drawer).getByText('Year 2')).toBeTruthy();
  });
});

describe('choosing a file', () => {
  it('lists the expected columns', () => {
    renderDrawer();
    for (const column of ['email', 'exam_name', 'exam_date', 'score', 'passed', 'max_score']) {
      expect(screen.getByText(column)).toBeTruthy();
    }
    expect(screen.getByText('The date, as YYYY-MM-DD')).toBeTruthy();
    expect(screen.getByText(/pass\/fail, yes\/no and 1\/0 also work/)).toBeTruthy();
    expect(screen.getByText(/in any order/)).toBeTruthy();
  });

  it('offers a template with exactly those columns', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:template');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    let downloaded = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      downloaded = this.download;
    });

    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Download template' }));

    expect(downloaded).toBe('exam-results-template.csv');
    const text = await createObjectURL.mock.calls[0][0].text();
    expect(text.split('\n')[0]).toBe('email,exam_name,exam_date,score,passed,max_score');
    expect(post).not.toHaveBeenCalled();
  });

  it('says a repeat import updates rows', () => {
    renderDrawer();
    expect(screen.getByText(/updates its rows and doesn't create duplicates/)).toBeTruthy();
  });

  it('refuses an oversized file before reading it', () => {
    const file = csvFile();
    Object.defineProperty(file, 'size', { value: MAX_EXAM_FILE_BYTES + 1 });
    const read = vi.spyOn(file, 'text');

    renderDrawer();
    choose(file);

    expect(screen.getByRole('alert').textContent).toContain('This file is too large');
    expect(read).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('takes a file at exactly the limit', () => {
    const file = csvFile();
    Object.defineProperty(file, 'size', { value: MAX_EXAM_FILE_BYTES });
    expect(examFileProblem(file)).toBeNull();
  });

  it('accepts a CSV the browser gives no type, as Windows can', () => {
    expect(examFileProblem(new File(['x'], 'RESULTS.CSV'))).toBeNull();
  });

  it.each([
    ['a spreadsheet', () => new File(['x'], 'results.xlsx', { type: 'application/vnd.ms-excel' }), "isn't a CSV file"],
    ['an empty file', () => new File([], 'results.csv', { type: 'text/csv' }), 'This file is empty'],
    ['a file of blank lines', () => csvFile('\n \n'), 'This file is empty'],
    ['a binary file named .csv', () => csvFile('PK\u0003\u0004\0\0'), "couldn't read this file"],
    ['a CSV that is not UTF-8', () => new File([new Uint8Array([0xe3, 0xc7])], 'results.csv'), 'CSV UTF-8'],
  ])('refuses %s without calling the server', async (_name, file, message) => {
    renderDrawer();
    choose(file());

    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('the preview', () => {
  it('dry-runs the file text under its name', async () => {
    await previewOf([row()]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('TESTS', `${IMPORT_PATH}?dryRun=true`, { csv: CSV, source: 'results.csv' });
  });

  it('shows how many rows are valid, and a table of them', async () => {
    await previewOf([row(), row({ line: 3, email: 'omar@example.com', learnerName: 'Omar Nabil', score: 41, maxScore: null, passed: false })]);

    expect(screen.getByText('2 of 2 rows valid')).toBeTruthy();
    const table = within(screen.getByRole('table'));
    expect(table.getByRole('row', { name: /Sara Haddad/ }).textContent).toContain('78 / 100');
    expect(table.getByRole('row', { name: /Sara Haddad/ }).textContent).toContain('Passed');
    expect(table.getByRole('row', { name: /Omar Nabil/ }).textContent).toContain('Not passed');
    expect(table.getByText('41')).toBeTruthy();
  });

  it('lists errors by line, and hides the placeholder score of a bad row', async () => {
    await previewOf([row(), REJECTED]);

    expect(screen.getByText('1 of 2 rows valid')).toBeTruthy();
    const problems = within(screen.getByRole('region', { name: 'Rows to fix' }));
    expect(problems.getByText('Line 3')).toBeTruthy();
    expect(problems.getByText('No learner with this email in this cohort.')).toBeTruthy();
    const badRow = within(screen.getByRole('table')).getByRole('row', { name: /nobody@example.com/ });
    expect(badRow.textContent).toContain('Needs fixing');
    expect(badRow.textContent).not.toContain('Not passed');
    expect(badRow.textContent).toContain('—');
  });

  it('caps a long file on the page, not in the count', async () => {
    const rows = Array.from({ length: 150 }, (_, index) => row({ line: index + 2 }));
    await previewOf(rows);

    expect(screen.getByText('150 of 150 rows valid')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(101);
    expect(screen.getByText('Showing the first 100 of 150 rows.')).toBeTruthy();
  });

  it('caps a long list of errors too', async () => {
    await previewOf(Array.from({ length: 150 }, (_, index) => row({ line: index + 2, error: `Bad ${String(index)}` })));

    expect(within(screen.getByRole('region', { name: 'Rows to fix' })).getAllByRole('listitem')).toHaveLength(100);
    expect(screen.getByText('Showing the first 100 of 150 rows to fix.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('renders hostile values as plain text', async () => {
    const hostile = '<img src=x onerror="alert(1)">';
    await previewOf([
      row({ learnerName: hostile, examName: '<script>alert(1)</script>', email: '<b>x</b>@example.com' }),
      row({ line: 3, error: '<a href="javascript:alert(1)">fix me</a>' }),
    ]);

    expect(screen.getByText(hostile)).toBeTruthy();
    expect(screen.getByText('<a href="javascript:alert(1)">fix me</a>')).toBeTruthy();
    expect(document.body.querySelector('img, script, b, a')).toBeNull();
  });
});

describe('all or nothing', () => {
  it('offers the save when every row is valid', async () => {
    await previewOf([row(), row({ line: 3 })]);

    expect(saveButton().textContent).toBe('Save 2 results');
    expect(saveButton().disabled).toBe(false);
  });

  it('keeps the save unavailable while any row has an error', async () => {
    await previewOf([row(), row({ line: 4 }), REJECTED]);

    expect(screen.getByText('Nothing can be saved until every row is valid. Fix these in your file, then choose it again.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(callsWith(false)).toHaveLength(0);
  });

  it('trusts the rows as well as the counts', () => {
    expect(canSaveExamResults(report([REJECTED], { valid: 1 }))).toBe(false);
    expect(canSaveExamResults(report([row()], { valid: 0 }))).toBe(false);
    expect(canSaveExamResults(report([row()]))).toBe(true);
  });

  it('has nothing to save from a file with no rows', async () => {
    post.mockResolvedValueOnce({ ...report([]), rows: null });
    renderDrawer();
    choose(csvFile('email,exam_name,exam_date,score,passed\n'));

    expect(await screen.findByText('No results in this file')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('opens the save once the fixed file is chosen again', async () => {
    const setValue = vi.spyOn(HTMLInputElement.prototype, 'value', 'set');
    await previewOf([row(), REJECTED]);
    // Without this the browser fires no change event for the same path.
    expect(setValue).toHaveBeenCalledWith('');

    const fixed = `${CSV}omar@example.com,Renal final,2026-06-15,41,false\n`;
    post.mockResolvedValueOnce(report([row(), row({ line: 3 })]));
    choose(csvFile(fixed));

    await screen.findByText('2 of 2 rows valid');
    expect(saveButton().disabled).toBe(false);

    post.mockResolvedValueOnce(savedReport([row(), row({ line: 3 })]));
    fireEvent.click(saveButton());
    await screen.findByText('Saved 2 exam results');
    expect(post).toHaveBeenLastCalledWith('TESTS', `${IMPORT_PATH}?dryRun=false`, { csv: fixed, source: 'results.csv' });
  });

  it('never saves a previous file after a new one is refused', async () => {
    await previewOf([row()]);
    post.mockRejectedValueOnce(refusal(413));
    choose(csvFile());

    expect((await screen.findByRole('alert')).textContent).toContain('too large');
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });
});

describe('saving', () => {
  const RESULTS = [row(), row({ line: 3, email: 'omar@example.com', learnerName: 'Omar Nabil' })];

  it('saves exactly what was previewed, and shows what was saved', async () => {
    await previewOf(RESULTS);
    post.mockResolvedValueOnce(savedReport(RESULTS));
    fireEvent.click(saveButton());

    expect(await screen.findByText('Saved 2 exam results')).toBeTruthy();
    expect(post).toHaveBeenLastCalledWith('TESTS', `${IMPORT_PATH}?dryRun=false`, { csv: CSV, source: 'results.csv' });
    expect(within(screen.getByRole('table')).getByRole('row', { name: /Omar Nabil/ })).toBeTruthy();
    expect(screen.getByText(/updates its rows and doesn't create duplicates/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });

  it('counts what the server saved, not what the file held', async () => {
    await previewOf(RESULTS);
    post.mockResolvedValueOnce(report(RESULTS, { dryRun: false, saved: 1 }));
    fireEvent.click(saveButton());

    expect(await screen.findByText('Saved 1 exam result')).toBeTruthy();
  });

  it('sends one save for a double click', async () => {
    await previewOf(RESULTS);
    post.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());

    await waitFor(() => expect(callsWith(false)).toHaveLength(1));
    expect(saveButton().disabled).toBe(true);
  });

  it('holds the drawer open while saving', async () => {
    const onClose = vi.fn();
    post.mockResolvedValueOnce(report(RESULTS));
    renderDrawer(onClose);
    choose(csvFile());
    await screen.findByText('2 of 2 rows valid');

    post.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.click(saveButton());
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Close' }).disabled).toBe(true);
  });

  it('shows the rows when a save finds errors the preview did not', async () => {
    await previewOf(RESULTS);
    post.mockRejectedValueOnce(refusal(422, report([row(), REJECTED], { dryRun: false })));
    fireEvent.click(saveButton());

    expect(await screen.findByText('1 of 2 rows valid')).toBeTruthy();
    expect(screen.getByText('No learner with this email in this cohort.')).toBeTruthy();
    expect(screen.queryByText(/^Saved/)).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('does not claim to know when the connection drops mid-save', async () => {
    await previewOf(RESULTS);
    post.mockRejectedValueOnce(new Error('API Error: No response received'));
    fireEvent.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("couldn't confirm");
    expect(alert.textContent).toContain("doesn't create duplicates");
    expect(alert.textContent).not.toMatch(/nothing was saved/i);
    expect(saveButton().disabled).toBe(false);
  });

  it('can import another file afterwards', async () => {
    await previewOf(RESULTS);
    post.mockResolvedValueOnce(savedReport(RESULTS));
    fireEvent.click(saveButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Import another file' }));

    expect(screen.getByRole('button', { name: 'Choose CSV file' })).toBeTruthy();
  });

  it('closes on Done', async () => {
    const onClose = vi.fn();
    post.mockResolvedValueOnce(report(RESULTS));
    renderDrawer(onClose);
    choose(csvFile());
    await screen.findByText('2 of 2 rows valid');
    post.mockResolvedValueOnce(savedReport(RESULTS));
    fireEvent.click(saveButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('refusals', () => {
  it.each([
    [403, 'Only admins and owners of its university can.'],
    [404, "We couldn't find this cohort."],
    [413, 'This file is too large.'],
    [400, 'at least one row of results'],
    [422, "We couldn't read this file."],
    [503, "We couldn't check this file just now."],
    [500, "We couldn't check this file just now."],
  ])('a %i gets a plain sentence, not the server text', async (status, message) => {
    post.mockRejectedValueOnce(refusal(status));
    renderDrawer();
    choose(csvFile());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).not.toMatch(/pq:|technical/);
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose CSV file' })).toBeTruthy();
  });

  it.each([
    [403, 'Only admins and owners of its university can.'],
    [404, "We couldn't find this cohort."],
  ])('a %i at save time keeps the preview', async (status, message) => {
    await previewOf([row()]);
    post.mockRejectedValueOnce(refusal(status));
    fireEvent.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('clears an old refusal when a new file works', async () => {
    post.mockRejectedValueOnce(refusal(403));
    renderDrawer();
    choose(csvFile());
    await screen.findByRole('alert');

    post.mockResolvedValueOnce(report([row()]));
    choose(csvFile());

    await screen.findByText('1 of 1 row valid');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('what stays out', () => {
  it('logs nothing from a file, even when it is refused', async () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map((method) => vi.spyOn(console, method));

    await previewOf([row(), REJECTED]);
    post.mockRejectedValueOnce(refusal(500));
    choose(csvFile());
    await screen.findByRole('alert');

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('never talks about prediction', async () => {
    const words = /predict|forecast|at risk|risk score/i;
    await previewOf([row()]);
    expect(document.body.textContent).not.toMatch(words);

    post.mockResolvedValueOnce(savedReport([row()]));
    fireEvent.click(saveButton());
    await screen.findByText('Saved 1 exam result');
    expect(document.body.textContent).not.toMatch(words);

    fireEvent.click(screen.getByRole('button', { name: 'Import another file' }));
    expect(document.body.textContent).not.toMatch(words);
  });
});

describe('formatExamScore', () => {
  it('shows the maximum only when there is one', () => {
    expect(formatExamScore({ score: 78, maxScore: 100 })).toBe('78 / 100');
    expect(formatExamScore({ score: 78, maxScore: null })).toBe('78');
    expect(formatExamScore({ score: 0, maxScore: 0 })).toBe('0 / 0');
  });
});
