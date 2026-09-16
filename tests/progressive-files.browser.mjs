// Playwright harness function. Run with the OpenCode browser run-code tool.
// Dev server: VITE_TEST_API_URL=http://127.0.0.1:5178/local
// VITE_AGENT_V2_API_URL=http://127.0.0.1:5178/agent npm run dev -- --port 5178
// Every API request is intercepted; no live backend or real credentials are used.
async (page) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.clock.install();
  const base = 'http://127.0.0.1:5178';
  const now = new Date().toISOString();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const p = { runId: 'a', sequence: 5, availability: 'text_ready', state: 'running',
    stage: 'extracting_images', completedUnits: 12, totalUnits: 40, unit: 'figures',
    updatedAt: now, lastProgressAt: now, heartbeatAt: now, nextRetryAt: null,
    capabilities: { text: true, structure: true, images: false, ocr: false },
    warnings: ['Visual-only pages may still need OCR.'], error: null };
  const makeRow = (id, patch) => ({ id: `/local/course-resources/${id}`, identifier: id,
    courseId: 'course', fileId: id, fileName: `${id}.pdf`, fileType: 'application/pdf',
    fileSize: 1500000, createdAt: now, updatedAt: now,
    knowledgeBase: { status: 'ready', reason: null, errorCode: null, updatedAt: now,
      processing: { ...p, ...patch } } });
  let rows = [makeRow('active', {}), makeRow('failed', {
    state: 'failed', error: { code: 'timeout', message: 'Image extraction timed out.', retryable: true },
  })];
  let failList = false;
  const posts = [];
  let gets = 0;
  let retrySnapshot;
  let recoveringLostAction = false;
  let recoveryReads = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const path = url.replace(base, '').split('?')[0];
    if (!url.startsWith(`${base}/`)) return route.abort();
    if (path === '/__progressive') return route.fulfill({ contentType: 'text/html',
      body: '<html><head><link rel="stylesheet" href="/index.css"></head><body><div id="root" style="max-width:1280px;margin:24px auto;padding:16px"></div></body></html>' });
    if (path === '/local/courses/course/resources') {
      gets++;
      if (failList) return route.fulfill({ status: 503, json: { error: 'Simulated connection failure' } });
      if (recoveringLostAction && ++recoveryReads >= 2) rows[0] = makeRow('active', { sequence: 7, state: 'retrying' });
      return route.fulfill({ json: { resources: rows, total: rows.length, page: 1 } });
    }
    if (path.includes('/knowledge-base/') && request.method() === 'POST') {
      posts.push({ path, authorization: request.headers().authorization, body: request.postData() });
      if (path.endsWith('/sync')) return route.fulfill({ status: 202, json: { courseId: 'course', queuedResources: 1, queuedLinks: 0 } });
      if (path === '/local/courses/course/resources/failed/knowledge-base/retry') {
        retrySnapshot = makeRow('failed', { runId: 'b', sequence: 0, state: 'retrying', error: null });
        // The list deliberately lags the action snapshot, exercising run fencing.
        return route.fulfill({ status: 202, json: { courseId: `${base}/local/courses/course`, resourceId: `${base}/local/course-resources/failed`, knowledgeBase: retrySnapshot.knowledgeBase } });
      }
      if (path === '/local/courses/course/resources/active/knowledge-base/cancel') {
        rows[0] = makeRow('active', { sequence: 6, state: 'cancelled' });
        return route.fulfill({ status: 202, json: { courseId: `${base}/local/courses/course`, resourceId: `${base}/local/course-resources/active`, knowledgeBase: rows[0].knowledgeBase } });
      }
      if (path === '/local/courses/course/resources/active/knowledge-base/retry') {
        recoveringLostAction = true;
        return route.fulfill({ status: 503, json: { error: 'Simulated lost action response' } });
      }
      throw new Error(`Unexpected action URL: ${path}`);
    }
    if (path.startsWith('/local/')) throw new Error(`Unexpected Tests URL: ${path}`);
    if (path.startsWith('/agent/')) return route.fulfill({ json: { formats: [] } });
    return route.continue();
  });
  await page.goto(`${base}/__progressive`);
  await page.evaluate(async () => {
    localStorage.setItem('msai_educator_token', 'progressive-test-token');
    const runtime = (await import('/@react-refresh')).default;
    runtime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const client = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Panel } = await import('/components/academy/course-workbench/CourseResourcesPanel.tsx');
    window.testRoot = (client.createRoot || client.default.createRoot)(document.getElementById('root'));
    window.testRoot.render(React.createElement(Panel, { course: { id: 'course', backendIdentifier: 'course' } }));
  });
  await page.getByRole('button', { name: 'Cancel remaining enrichment for active.pdf' }).waitFor();
  if (await page.getByText('Text ready to chat', { exact: true }).count() !== 2) throw new Error('Ready text hidden during enrichment');
  await page.getByRole('progressbar', { name: 'Extracting images for active.pdf' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
  await page.getByRole('button', { name: 'Retry processing for failed.pdf' }).click();
  await page.getByText('Retry scheduled', { exact: true }).waitFor();
  if (await page.getByText('Enrichment failed', { exact: true }).count()) throw new Error('Lagging list restored failed run');
  rows[1] = retrySnapshot;
  await page.getByRole('button', { name: 'Cancel remaining enrichment for active.pdf' }).click();
  await page.getByText('Remaining enrichment cancelled', { exact: true }).waitFor();
  if (await page.getByText('Text ready to chat', { exact: true }).count() !== 2) throw new Error('Cancel destroyed ready text');
  failList = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText(/Connection stale —/).waitFor();
  await page.getByText('Retry scheduled', { exact: true }).waitFor();
  failList = false;
  const beforeResume = gets;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText(/Connection stale —/).waitFor({ state: 'hidden' });
  if (gets <= beforeResume) throw new Error('Visibility did not refresh');
  await page.getByRole('button', { name: 'Sync to tutor' }).click();
  await page.getByText(/Sync requested for this course/).waitFor();
  // The backend may accept a POST whose response is lost, even for a terminal row.
  await page.getByRole('button', { name: 'Retry processing for active.pdf' }).click();
  await page.getByRole('alert').filter({ hasText: 'Could not confirm' }).waitFor();
  await page.clock.runFor(15_000);
  await page.locator('[aria-label="Tutor processing for active.pdf"]').getByText('Retry scheduled', { exact: true }).waitFor();
  if (recoveryReads < 2) throw new Error('Uncertain action did not keep polling terminal snapshot');
  for (const post of posts) {
    if (post.authorization !== 'Bearer progressive-test-token') throw new Error('Teacher auth missing');
    if (post.body) throw new Error('Action unexpectedly sent a request body');
  }
  if (posts.length !== 4) throw new Error(`Expected retry, cancel, sync, uncertain retry; got ${posts.length}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Desktop overflow');
  await page.evaluate(() => { document.getElementById('root').style.maxWidth = '760px'; });
  if (await page.locator('.course-resources-header').isVisible()) throw new Error('Narrow desktop panel should use cards');
  if (await page.evaluate(() => {
    const panel = document.querySelector('.course-resources-panel').getBoundingClientRect();
    return [...document.querySelectorAll('.course-resources-panel button')].some(button => button.getBoundingClientRect().right > panel.right);
  })) throw new Error('Actions clipped beside sidebar');
  await page.evaluate(() => { window.testRoot.unmount(); localStorage.removeItem('msai_educator_token'); });
  if (errors.length) throw new Error(errors.join('\n'));
  return { passed: ['ready+enrichment', 'stage units', '390px and 1440px layouts + narrow desktop panel', 'retry + run fencing', 'cancel preserves text', 'connection stale + visibility recovery', 'course Sync', 'uncertain action recovery from terminal snapshot', '/local paths + teacher bearer auth + empty bodies', 'unmount'], posts, gets, pageErrors: errors };
}
