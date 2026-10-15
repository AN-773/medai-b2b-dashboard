import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CourseResource } from '../types/CourseResourceTypes';
import { readCourseResourceKnowledgeBase } from '../types/CourseResourceTypes';
import type { DocumentProcessing } from '../types/DocumentProcessing';
import {
  canCancelProcessing, canRetryProcessing, hasStaleHeartbeat, isProcessingTerminal,
  isTextReady, needsCourseSync, processingUnitsLabel, readProcessing,
  ResourceProgressTracker, resourceFromProcessingResponse, shouldPollResource,
} from '../utils/documentProcessing';
import { ProgressivePoller, type PollingClock, PROGRESS_POLL_INTERVAL_MS } from '../utils/progressivePolling';

const processing = (patch: Partial<DocumentProcessing> = {}): DocumentProcessing => ({
  runId: 'run-a', sequence: 1, availability: 'text_ready', state: 'running',
  stage: 'extracting_images', completedUnits: 12, totalUnits: 40, unit: 'figures',
  updatedAt: '2026-09-16T12:00:00Z', lastProgressAt: '2026-09-16T12:00:00Z',
  heartbeatAt: '2026-09-16T12:00:00Z', nextRetryAt: null,
  capabilities: { text: true, structure: true, images: false, ocr: false },
  warnings: [], error: null, ...patch,
});
const resource = (p: DocumentProcessing | undefined = processing()): CourseResource => ({
  id: '/local/courses/course/resources/file', identifier: 'file', courseId: 'course',
  fileId: 'file', fileName: 'Reading.pdf', fileType: 'application/pdf', fileSize: 1000,
  createdAt: '2026-09-16T12:00:00Z', updatedAt: '2026-09-16T12:00:00Z',
  knowledgeBase: { status: 'ready', reason: null, errorCode: null, updatedAt: null, processing: p },
});
const legacy = (): CourseResource => {
  const row = resource();
  delete row.knowledgeBase!.processing;
  return row;
};

test('text readiness is independent of enrichment, including failures and cancellation', () => {
  for (const state of ['queued', 'running', 'retrying', 'completed', 'completed_with_warnings', 'failed', 'cancelled'] as const) {
    const row = resource(processing({ state }));
    assert.equal(isTextReady(row.knowledgeBase), true, state);
    assert.equal(shouldPollResource(row), ['queued', 'running', 'retrying'].includes(state), state);
    assert.equal(isProcessingTerminal(readProcessing(row.knowledgeBase!.processing)), !shouldPollResource(row));
  }
  assert.equal(isTextReady(resource(processing({ availability: 'unavailable', stage: 'ocr' })).knowledgeBase), false);
});

test('legacy optional knowledge base and statuses retain their semantics', () => {
  const row = legacy();
  assert.equal(isTextReady(row.knowledgeBase), true);
  assert.equal(shouldPollResource(row), false);
  for (const status of ['not_synced', 'ineligible', 'processing', 'failed'] as const) {
    row.knowledgeBase!.status = status;
    assert.equal(isTextReady(row.knowledgeBase), false);
    assert.equal(shouldPollResource(row), status === 'processing' || status === 'not_synced');
  }
  delete row.knowledgeBase;
  assert.equal(readCourseResourceKnowledgeBase(row), null);
  assert.equal(shouldPollResource(row), false);
});

test('future and malformed progress degrades without false completion or unsafe actions', () => {
  for (const raw of [{ future: true }, { ...processing(), state: 'future_state', stage: 'future_stage' }, []]) {
    const row = resource(raw as DocumentProcessing);
    const p = readProcessing(raw);
    assert.equal(shouldPollResource(row), true);
    assert.equal(isProcessingTerminal(p), false);
    assert.equal(canCancelProcessing(p), false);
    assert.equal(canRetryProcessing(p), false);
  }
  const p = readProcessing({ ...processing(), warnings: [null, 'OCR pending'], capabilities: null, error: 'oops' });
  assert.deepEqual(p!.warnings, ['OCR pending']);
  assert.equal(p!.capabilities.images, false);
  assert.equal(p!.error, null);
});

test('wire readers preserve unknown optional fields without mutating the DTO', () => {
  const row = resource({ ...processing(), futureData: { version: 2 } } as DocumentProcessing);
  row.knowledgeBase!.futureFeature = 'kept';
  const kb = readCourseResourceKnowledgeBase(row)!;
  assert.equal(kb.futureFeature, 'kept');
  assert.deepEqual((readProcessing(kb.processing) as unknown as Record<string, unknown>).futureData, { version: 2 });
  assert.equal(kb.processing, row.knowledgeBase!.processing);
});

test('out-of-order and duplicate same-run sequences cannot regress text or terminal state', () => {
  const tracker = new ResourceProgressTracker();
  const done = resource(processing({ sequence: 10, state: 'completed' }));
  tracker.merge([done]);
  for (const sequence of [9, 1, 10]) {
    const stale = resource(processing({ sequence, availability: 'unavailable' }));
    stale.knowledgeBase!.status = 'processing';
    const [merged] = tracker.merge([stale]);
    assert.equal(merged.knowledgeBase!.processing!.state, 'completed');
    assert.equal(isTextReady(merged.knowledgeBase), true);
  }
  const absent = legacy();
  assert.equal(tracker.merge([absent])[0].knowledgeBase!.processing!.sequence, 10);
});

test('a new run may restart its sequence; retired runs and older unseen snapshots stay fenced', () => {
  const tracker = new ResourceProgressTracker();
  tracker.merge([resource(processing({ sequence: 100 }))]);
  const [newRun] = tracker.merge([resource(processing({ runId: 'run-b', sequence: 0, updatedAt: '2026-09-16T12:01:00Z' }))]);
  assert.equal(newRun.knowledgeBase!.processing!.runId, 'run-b');
  for (const stale of [
    processing({ sequence: 101, updatedAt: '2026-09-16T12:02:00Z' }),
    processing({ runId: 'unseen-old-run', sequence: 999 }),
  ]) assert.equal(tracker.merge([resource(stale)])[0].knowledgeBase!.processing!.runId, 'run-b');
});

test('progress counters can reset between stages and are not global completion percentages', () => {
  const tracker = new ResourceProgressTracker();
  tracker.merge([resource(processing({ completedUnits: 40 }))]);
  const [row] = tracker.merge([resource(processing({ sequence: 2, stage: 'indexing_enrichment', completedUnits: 0, totalUnits: null, unit: 'batches' }))]);
  assert.equal(row.knowledgeBase!.processing!.completedUnits, 0);
  assert.equal(processingUnitsLabel(readProcessing(row.knowledgeBase!.processing)!), '0 batches processed in this stage · total unknown');
  assert.equal(processingUnitsLabel(readProcessing(processing({ unit: null }))!), null);
  assert.equal(processingUnitsLabel(readProcessing(processing({ completedUnits: -1 }))!), null);
  assert.equal(processingUnitsLabel(readProcessing(processing({ totalUnits: 2 }))!), '12 figures processed in this stage · total unknown');
  assert.equal(shouldPollResource(resource(processing({ completedUnits: 40 }))), true);
});

test('course Sync retries eligible enrichment failures without resuming cancelled work', () => {
  const retryable = { code: 'retry', message: 'retry', retryable: true };
  assert.equal(shouldPollResource(resource()), true);
  assert.equal(needsCourseSync(resource()), false);
  assert.equal(needsCourseSync(resource(processing({ state: 'failed' }))), false);
  assert.equal(needsCourseSync(resource(processing({ state: 'failed', error: retryable }))), true);
  assert.equal(needsCourseSync(resource(processing({ state: 'completed_with_warnings', error: retryable }))), true);
  assert.equal(needsCourseSync(resource(processing({ state: 'cancelled', error: retryable }))), false);
  assert.equal(canRetryProcessing(readProcessing(processing({ state: 'cancelled' }))), true);
  assert.equal(needsCourseSync(resource(processing({ state: 'completed' }))), false);
  assert.equal(needsCourseSync(legacy()), false);
  assert.equal(canRetryProcessing(readProcessing(processing({ state: 'failed', error: { code: 'retry', message: 'retry', retryable: true } }))), true);
  assert.equal(canRetryProcessing(readProcessing(processing({ state: 'failed', error: { code: 'invalid', message: 'invalid', retryable: false } }))), false);
});

test('stale heartbeat signals delayed reporting, never converts work to failure', () => {
  const p = readProcessing(processing())!;
  assert.equal(hasStaleHeartbeat(p, Date.parse(p.heartbeatAt!) + 121_000), true);
  assert.equal(p.state, 'running');
  assert.equal(isTextReady(resource().knowledgeBase), true);
  assert.equal(hasStaleHeartbeat(readProcessing(processing({ state: 'completed' }))!, Date.parse(p.heartbeatAt!) + 121_000), false);
});

test('an accepted retry keeps polling an unchanged terminal snapshot without inventing a run', () => {
  const tracker = new ResourceProgressTracker();
  const failed = resource(processing({ state: 'failed' }));
  tracker.merge([failed]);
  tracker.expectUpdate(failed);
  const unchanged = tracker.merge([failed]);
  assert.equal(tracker.hasExpectedUpdates(unchanged), true);
  assert.equal(unchanged[0].knowledgeBase!.processing!.state, 'failed');
  const retried = tracker.merge([resource(processing({ runId: 'retry-run', sequence: 0 }))]);
  assert.equal(tracker.hasExpectedUpdates(retried), false);
});

test('teacher action snapshots are resource-scoped and fence lagging list projections', () => {
  const tracker = new ResourceProgressTracker();
  const before = resource(processing({ state: 'failed', sequence: 10 }));
  tracker.merge([before]);
  const response = { courseId: 'https://tests.example/local/courses/course',
    resourceId: 'https://tests.example/local/course-resources/file',
    knowledgeBase: resource(processing({ runId: 'retry', sequence: 0 })).knowledgeBase! };
  assert.equal(resourceFromProcessingResponse(before, { ...response, resourceId: 'another-file' }, 'course'), null);
  assert.equal(resourceFromProcessingResponse(before, response, 'another-course'), null);
  // The current backend retries within the same run; future runs may reset too.
  const sameRun = resourceFromProcessingResponse(before, { ...response,
    knowledgeBase: resource(processing({ sequence: 11, state: 'retrying' })).knowledgeBase!,
  }, 'course')!;
  tracker.merge([sameRun]);
  assert.equal(tracker.merge([before])[0].knowledgeBase!.processing!.sequence, 11);
  const snapshot = resourceFromProcessingResponse(before, response, 'course')!;
  tracker.merge([snapshot]);
  assert.equal(tracker.merge([before])[0].knowledgeBase!.processing!.runId, 'retry');
});

test('default browser timer adapters do not call native functions with a clock object receiver', async () => {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const receiverCheck = function (this: unknown) {
    assert.equal(this, undefined, 'timer adapter changed native receiver');
    return 1 as unknown as ReturnType<typeof setTimeout>;
  };
  try {
    globalThis.setTimeout = receiverCheck as unknown as typeof setTimeout;
    globalThis.clearTimeout = receiverCheck as typeof clearTimeout;
    const poller = new ProgressivePoller({ fetch: async () => 1, accept: () => true, onError: () => assert.fail('unexpected error') });
    await poller.refresh();
    poller.dispose();
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});

class FakeClock implements PollingClock {
  now = 0;
  next = 0;
  tasks = new Map<number, { at: number; run: () => void }>();
  setTimeout = (run: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const id = ++this.next;
    this.tasks.set(id, { at: this.now + delay, run });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  clearTimeout = (id: ReturnType<typeof setTimeout>) => { this.tasks.delete(id as unknown as number); };
  async advance(ms: number) {
    const end = this.now + ms;
    while (true) {
      const next = [...this.tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      this.now = next[1].at;
      this.tasks.delete(next[0]);
      next[1].run();
      await Promise.resolve();
      await Promise.resolve();
    }
    this.now = end;
  }
}
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

test('simulated 90-minute ready+nonterminal workflow polls beyond 20/70 minutes, stopping only on backend terminal', async () => {
  const clock = new FakeClock();
  let calls = 0;
  let done = false;
  const poller = new ProgressivePoller({ clock,
    fetch: async () => { calls++; return resource(processing({ state: done ? 'completed' : 'running' })); },
    accept: shouldPollResource,
    onError: () => assert.fail('unexpected error'),
  });
  await poller.refresh();
  await clock.advance(90 * 60_000);
  assert.equal(calls, 361);
  assert.equal(clock.tasks.size, 1);
  done = true;
  await clock.advance(PROGRESS_POLL_INTERVAL_MS);
  assert.equal(calls, 362);
  assert.equal(clock.tasks.size, 0);
  await clock.advance(60 * 60_000);
  assert.equal(calls, 362);
  poller.dispose();
});

test('connection failures retain snapshots and retry repeatedly instead of exhausting a timer', async () => {
  const clock = new FakeClock();
  let attempts = 0;
  let errors = 0;
  let accepted = 0;
  const poller = new ProgressivePoller({ clock,
    fetch: async () => { if (++attempts < 5) throw new Error('offline'); return resource(); },
    accept: (row) => { accepted++; return shouldPollResource(row); }, onError: () => { errors++; },
  });
  await poller.refresh();
  await clock.advance(4 * PROGRESS_POLL_INTERVAL_MS);
  assert.equal(errors, 4);
  assert.equal(accepted, 1);
  assert.equal(clock.tasks.size, 1);
  poller.dispose();
});

test('refresh cancels and fences an out-of-order response even when transport ignores abort', async () => {
  const clock = new FakeClock();
  const first = deferred<number>();
  const second = deferred<number>();
  const signals: AbortSignal[] = [];
  const accepted: number[] = [];
  const poller = new ProgressivePoller({ clock,
    fetch: (signal) => { signals.push(signal); return signals.length === 1 ? first.promise : second.promise; },
    accept: (value) => { accepted.push(value); return true; }, onError: () => assert.fail('unexpected error'),
  });
  const old = poller.refresh();
  const latest = poller.refresh();
  assert.equal(signals[0].aborted, true);
  second.resolve(2); await latest;
  first.resolve(1); await old;
  assert.deepEqual(accepted, [2]);
  assert.equal(clock.tasks.size, 1);
  poller.dispose();
  assert.equal(clock.tasks.size, 0);
});

test('pause aborts reads; resume refreshes immediately, even after terminal; dispose prevents stale writes', async () => {
  const clock = new FakeClock();
  const first = deferred<number>();
  const signals: AbortSignal[] = [];
  const accepted: number[] = [];
  const poller = new ProgressivePoller({ clock,
    fetch: (signal) => { signals.push(signal); return signals.length === 1 ? first.promise : Promise.resolve(signals.length); },
    accept: (value) => { accepted.push(value); return false; }, onError: () => assert.fail('unexpected error'),
  });
  const initial = poller.refresh();
  poller.pause();
  assert.equal(signals[0].aborted, true);
  first.resolve(1); await initial;
  await clock.advance(90 * 60_000);
  assert.deepEqual(accepted, []);
  poller.resume(); await Promise.resolve();
  assert.deepEqual(accepted, [2]);
  assert.equal(clock.tasks.size, 0);
  poller.resume(); await Promise.resolve();
  assert.deepEqual(accepted, [2, 3]);
  poller.dispose();
  poller.resume(); await poller.refresh();
  assert.equal(signals.length, 3);
});

test('disposing an in-flight page/course request prevents updates and future timers', async () => {
  const clock = new FakeClock();
  const result = deferred<number>();
  let signal!: AbortSignal;
  const poller = new ProgressivePoller({ clock,
    fetch: (current) => { signal = current; return result.promise; },
    accept: () => assert.fail('disposed request wrote rows'), onError: () => assert.fail('disposed request wrote errors'),
  });
  const request = poller.refresh();
  poller.dispose();
  assert.equal(signal.aborted, true);
  result.resolve(1); await request;
  assert.equal(clock.tasks.size, 0);
});
