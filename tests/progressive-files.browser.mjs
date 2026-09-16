// Playwright harness function. Run with the OpenCode browser run-code tool.
// Dev server: VITE_TEST_API_URL=http://127.0.0.1:5178/local
// VITE_AGENT_V2_API_URL=http://127.0.0.1:5178/agent pnpm run dev -- --port 5178
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
  let rows = [
    makeRow('pending', { availability: 'unavailable', stage: 'indexing_text' }),
    makeRow('active', {}),
    makeRow('usable', { state: 'failed', error: { code: 'timeout', message: 'Image extraction timed out.', retryable: true } }),
    makeRow('failed', { availability: 'unavailable', state: 'failed' }),
    makeRow('cancelled', { availability: 'unavailable', state: 'cancelled' }),
    { ...makeRow('legacy'), knowledgeBase: { status: 'processing' } },
    { ...makeRow('ordinary'), knowledgeBase: undefined },
  ];
  let failList = false;
  const posts = [];
  let gets = 0;
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
      return route.fulfill({ json: { resources: rows, total: rows.length, page: 1 } });
    }
    if (path.includes('/knowledge-base/') && request.method() === 'POST') {
      posts.push({ path, authorization: request.headers().authorization, body: request.postData() });
      if (path.endsWith('/sync')) return route.fulfill({ status: 202, json: { courseId: 'course', queuedResources: 1, queuedLinks: 0 } });
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
  const status = (id) => page.getByRole('status', { name: `Processing status for ${id}.pdf` });
  const struck = (id) => page.getByText(`${id}.pdf`, { exact: true }).evaluate((el) => getComputedStyle(el).textDecorationLine.includes('line-through'));
  await status('pending').getByText('Processing', { exact: true }).waitFor();
  await status('active').getByText('Still processing images and layout', { exact: true }).waitFor();
  await status('usable').getByText('Ready', { exact: true }).waitFor();
  await status('failed').getByText('Couldn’t process this file', { exact: true }).waitFor();
  await status('cancelled').getByText('Processing stopped', { exact: true }).waitFor();
  await status('legacy').getByText('Processing', { exact: true }).waitFor();
  for (const id of ['pending', 'failed', 'cancelled', 'legacy']) {
    if (!await struck(id)) throw new Error(`${id} should look disabled`);
  }
  for (const id of ['active', 'usable', 'ordinary']) {
    if (await struck(id)) throw new Error(`${id} should look available`);
  }
  if (await page.getByRole('progressbar').count()) throw new Error('Technical progress remains');
  if (await page.getByText(/enrichment|OCR|indexing|worker|Image extraction timed out/i).count()) throw new Error('Technical details remain');
  if (await page.getByRole('button', { name: /Cancel.*processing|Retry processing for/ }).count()) throw new Error('Per-stage controls remain');
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
  rows[0] = makeRow('pending', { sequence: 6 });
  await page.clock.runFor(15_000);
  await status('pending').getByText('Still processing images and layout', { exact: true }).waitFor();
  if (await struck('pending')) throw new Error('Text-ready file still looks disabled');
  rows[0] = makeRow('pending', { sequence: 7, state: 'completed' });
  await page.clock.runFor(15_000);
  await status('pending').getByText('Ready', { exact: true }).waitFor();
  failList = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Reconnecting to check progress…', { exact: true }).waitFor();
  await status('pending').getByText('Ready', { exact: true }).waitFor();
  failList = false;
  const beforeResume = gets;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText('Reconnecting to check progress…', { exact: true }).waitFor({ state: 'hidden' });
  if (gets <= beforeResume) throw new Error('Visibility did not refresh');
  await page.getByRole('button', { name: 'Process files' }).click();
  await page.getByText('Processing requested. Files will update automatically.', { exact: true }).waitFor();
  if (posts.length !== 1 || posts[0].authorization !== 'Bearer progressive-test-token' || posts[0].body) throw new Error('Invalid processing request');
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
  return { passed: ['plain status copy', 'disabled filenames until text ready', 'automatic readiness transitions', 'legacy and optional processing', '390px and 1440px layouts + narrow desktop panel', 'connection recovery', 'course processing request', 'unmount'], posts, gets, pageErrors: errors };
}
