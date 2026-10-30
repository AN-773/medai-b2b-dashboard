import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, type ApiRequestError } from '../apiClient';
import { examResultsService, type ExamResultsReport } from '../examResultsService';

const FILE = { csv: 'email\n', source: 'results.csv' };

const report = (fields: Partial<ExamResultsReport> = {}): ExamResultsReport => ({
  dryRun: true,
  total: 0,
  valid: 0,
  saved: 0,
  rows: [],
  ...fields,
});

const refusal = (status: number, data?: unknown): ApiRequestError =>
  Object.assign(new Error(`API Error: ${String(status)}`), { status, data });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('examResultsService.importResults', () => {
  it('posts the file to the last segment of the cohort id', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(report());

    await examResultsService.importResults('https://tests.example/cohorts/year-2', FILE, { dryRun: true });
    await examResultsService.importResults('/cohorts/year 2', FILE, { dryRun: false });

    expect(post).toHaveBeenNthCalledWith(1, 'TESTS', '/cohorts/year-2/exam-results/import?dryRun=true', FILE);
    expect(post).toHaveBeenNthCalledWith(2, 'TESTS', '/cohorts/year%202/exam-results/import?dryRun=false', FILE);
  });

  it('turns the null a Go empty list arrives as into an empty list', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ ...report(), rows: null });

    await expect(examResultsService.importResults('c', FILE, { dryRun: true })).resolves.toMatchObject({ rows: [] });
  });

  it('resolves a 422 that carries a report, so the rows can be shown', async () => {
    const body = report({ dryRun: false, total: 1 });
    vi.spyOn(apiClient, 'post').mockRejectedValue(refusal(422, body));

    await expect(examResultsService.importResults('c', FILE, { dryRun: false })).resolves.toEqual(body);
  });

  it.each([
    ['a 422 with no report', refusal(422, { error: 'bad header' })],
    ['a 413', refusal(413, { error: 'too large' })],
    ['a 403 that looks like a report', refusal(403, report())],
    ['a lost connection', new Error('API Error: No response received')],
  ])('rejects on %s', async (_name, failure) => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(failure);

    await expect(examResultsService.importResults('c', FILE, { dryRun: true })).rejects.toBe(failure);
  });
});
