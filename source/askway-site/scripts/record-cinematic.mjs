/**
 * Local P5 evidence only. No encoder, browser download or production writes.
 * Default: desktop forward/reverse stills + four mobile reading sections.
 * --measure: a separate, screenshot-free 10 second desktop scheduling sample.
 * --measure --mobile: the same sample on the static mobile viewport simulation.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createBrowserContext, insideProject, projectRoot, testBase, storySampleProgress } from '../tests/helpers/browser-runtime.mjs';

const argumentsList = process.argv.slice(2);
const measure = argumentsList.includes('--measure');
const mobileMeasure = argumentsList.includes('--mobile');
if (argumentsList.includes('--help')) {
  console.log('node scripts/record-cinematic.mjs [--url http://127.0.0.1:4191]');
  console.log('node scripts/record-cinematic.mjs --measure [--mobile] [--url URL]');
  console.log('Default output: delivery/cinematic-refresh/final/story/{records.json,review.html,*.jpg}');
  console.log('Measurement: delivery/cinematic-refresh/performance/story-scheduling.json (or story-scheduling-mobile.json).');
  console.log('Run measurement alone, after other browser tasks finish. It does not take screenshots or encode video.');
  process.exit(0);
}
let url = testBase;
for (let i = 0; i < argumentsList.length; i++) {
  const argument = argumentsList[i];
  if (argument === '--url') {
    url = argumentsList[++i];
    if (!url) throw new Error('--url requires a value');
  } else if (!['--measure', '--mobile'].includes(argument)) throw new Error('Unknown argument: ' + argument);
}
if (mobileMeasure && !measure) throw new Error('--mobile only selects the viewport for --measure; default capture already includes mobile.');
const parsedUrl = new URL(url);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname) || !['http:', 'https:'].includes(parsedUrl.protocol)) {
  throw new Error('This evidence script only accepts a local preview URL.');
}
url = url.replace(/\/$/, '');

const storyOutput = insideProject(process.env.CINEMATIC_STORY_OUTDIR || 'delivery/cinematic-refresh/final/story');
const performanceOutput = insideProject(process.env.CINEMATIC_PERFORMANCE_OUTDIR || 'delivery/cinematic-refresh/performance');
const temporary = insideProject('.agent_tmp/cinematic-recording');
await mkdir(temporary, { recursive: true });
const lockPath = insideProject(temporary + '/active-run.lock');
const lock = await open(lockPath, 'wx');
await lock.writeFile(JSON.stringify({ pid: process.pid, mode: measure ? 'measure' : 'capture', startedAt: new Date().toISOString() }));
const phases = [{ phase: 'city', progress: .08 }, { phase: 'route', progress: storySampleProgress.route }, { phase: 'theatre', progress: storySampleProgress.theatre }, { phase: 'product', progress: storySampleProgress.product }];
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const visualProperties = ['--story-city-opacity', '--story-route-opacity', '--story-theatre-opacity', '--story-product-opacity', '--story-photo-scale', '--story-theatre-scale', '--story-card-top', '--story-card-right', '--story-card-bottom', '--story-card-left', '--story-route-reveal'];
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const runId = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '-');

async function buildIdentity() {
  const response = await fetch(url + '/');
  if (!response.ok) throw new Error('Preview document returned ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  const result = { previewUrl: url, servedHomepageSha256: sha256(bytes), servedDocumentBytes: bytes.length, projectRoot, capturedAt: new Date().toISOString(), localFiles: {} };
  for (const path of ['dist/build-info.json', 'public/assets/cinematic/manifest.json', 'src/features/cinematic/StoryStage.tsx', 'src/features/cinematic/progress.ts', 'src/features/cinematic/useStoryProgress.ts', 'src/features/cinematic/cinematic.css']) {
    try { result.localFiles[path] = sha256(await readFile(insideProject(path))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; result.localFiles[path] = null; }
  }
  try { result.buildInfo = JSON.parse(await readFile(insideProject('dist/build-info.json'), 'utf8')); }
  catch { result.buildInfo = null; }
  return result;
}

async function snapshot(page) {
  return page.evaluate(properties => {
    const root = document.querySelector('.cinematic-story');
    const viewport = root?.querySelector('.story-viewport');
    if (!root || !viewport) throw new Error('Missing cinematic story and viewport');
    const finiteMetric = attribute => {
      const raw = root.getAttribute(attribute);
      if (raw === null || !Number.isFinite(Number(raw))) throw new Error('Missing finite metric: ' + attribute);
      return Number(raw);
    };
    const bounds = root.getBoundingClientRect(), viewportBounds = viewport.getBoundingClientRect();
    const rectangle = element => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height };
    };
    const styles = getComputedStyle(root);
    return {
      capturedAt: new Date().toISOString(), browserTimeMs: performance.now(), scrollY,
      progress: finiteMetric('data-story-progress'), phase: root.dataset.storyPhase, layout: root.dataset.storyLayout,
      drawCount: finiteMetric('data-story-draw-count'), activeTime: finiteMetric('data-story-active-time'),
      geometry: { start: bounds.top + scrollY, height: bounds.height, viewportHeight: viewportBounds.height, travel: Math.max(bounds.height - viewportBounds.height, 1) },
      css: Object.fromEntries(properties.map(property => [property, styles.getPropertyValue(property).trim()])),
      panels: [...root.querySelectorAll('[data-story-panel]')].map(panel => ({ phase: panel.dataset.storyPanel, opacity: getComputedStyle(panel).opacity, inert: panel.inert, ariaHidden: panel.getAttribute('aria-hidden'), bounds: rectangle(panel) })),
      media: [...root.querySelectorAll('.hero-image-wrap img,.story-theatre-photo,.story-detail-photo')].map(image => ({ src: image.currentSrc || image.src || null, loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, transform: getComputedStyle(image).transform, bounds: rectangle(image) })),
      viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, userAgent: navigator.userAgent,
      visibilityState: document.visibilityState, presentationMotion: document.documentElement.dataset.presentationMotion,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  }, visualProperties);
}

async function settle(page, delay = 90) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (delay) await page.waitForTimeout(delay);
}

async function openStory(context, expectedLayout) {
  const page = await context.newPage();
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push({ at: new Date().toISOString(), message: error.message }));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
  await page.goto(url + '/', { waitUntil: 'networkidle', timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(layout => document.querySelector('.cinematic-story')?.dataset.storyLayout === layout, expectedLayout, { timeout: 10000 });
  // Keep wheel input over the reading margin, away from map controls.
  await page.mouse.move(expectedLayout === 'sticky' ? 120 : 20, 450);
  await settle(page);
  return { page, errors, failedRequests };
}

/** Every recorded desktop target is reached with browser wheel input, not scrollTo. */
async function wheelTo(page, targetScrollY, inputLog) {
  const started = performance.now();
  for (let attempt = 0; attempt < 70; attempt++) {
    const current = await page.evaluate(() => window.scrollY);
    const remaining = targetScrollY - current;
    if (Math.abs(remaining) <= .75) return;
    const delta = Math.max(-180, Math.min(180, remaining));
    inputLog.push({ at: new Date().toISOString(), elapsedMs: performance.now() - started, scrollYBefore: current, targetScrollY, deltaY: delta, source: 'Playwright page.mouse.wheel / browser protocol input' });
    await page.mouse.wheel(0, delta);
    await settle(page, 65);
    if (performance.now() - started > 10000) break;
  }
  throw new Error('Wheel input did not reach target ' + targetScrollY + '; actual ' + await page.evaluate(() => scrollY));
}

async function waitForPhaseImages(page, phase) {
  const inspectImages = ({ phase, mode = 'ready' }) => {
    const root = document.querySelector('.cinematic-story');
    const panel = root?.querySelector(`[data-story-panel="${phase}"]`);
    if (!panel) throw new Error('Missing story panel: ' + phase);
    const candidates = [...panel.querySelectorAll('img')];
    // In sticky layout the theatre photograph is a sibling of its text panel.
    if (phase === 'theatre' && root.dataset.storyLayout === 'sticky') {
      candidates.push(...root.querySelectorAll('[data-story-handoff-media="true"] img'));
    }
    const states = candidates.map(image => {
      const rect = image.getBoundingClientRect(), hiddenAncestors = [];
      for (let node = image; node; node = node.parentElement) {
        if (getComputedStyle(node).display === 'none') hiddenAncestors.push(node.className || node.tagName);
      }
      // Do not require viewport intersection: mobile also captures the whole section.
      const required = rect.width > 0 && rect.height > 0 && hiddenAncestors.length === 0;
      return { image, required, className: image.className, src: image.getAttribute('src'), currentSrc: image.currentSrc,
        complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        failed: image.dataset.failed ?? null, bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, hiddenAncestors };
    });
    if (mode === 'diagnose') return { phase, layout: root.dataset.storyLayout, images: states.map(({ image, ...state }) => state) };
    const required = states.filter(state => state.required);
    const failed = required.find(state => state.failed === 'true' || ((state.currentSrc || state.src) && state.complete && state.naturalWidth === 0));
    if (failed) throw new Error('Visible image failed to load: ' + (failed.currentSrc || failed.src || failed.className));
    const ready = required.every(state => Boolean(state.currentSrc || state.src) && state.complete && state.naturalWidth > 0);
    if (mode !== 'decode') return ready;
    if (!ready) throw new Error('Phase images changed before decoding');
    return Promise.all(required.map(async state => {
      try { await state.image.decode(); }
      catch (error) { throw new Error('Visible image failed to decode: ' + (state.currentSrc || state.src) + '; ' + error.message); }
    }));
  };
  try {
    await page.waitForFunction(inspectImages, { phase }, { timeout: 10000 });
    await page.evaluate(inspectImages, { phase, mode: 'decode' });
  } catch (error) {
    const diagnostic = await page.evaluate(inspectImages, { phase, mode: 'diagnose' }).catch(error => ({ diagnosticError: error.message }));
    throw new Error('Cannot record phase ' + phase + ': ' + error.message + '\n' + JSON.stringify(diagnostic, null, 2), { cause: error });
  }
  await settle(page, 50);
}

async function saveScreenshot(page, filename, options = {}) {
  const path = insideProject(storyOutput + '/' + filename);
  await page.screenshot({ path, type: 'jpeg', quality: 90, ...options });
  const bytes = await readFile(path);
  return { file: filename, bytes: bytes.length, sha256: sha256(bytes) };
}

function visualComparison(forward, reverse) {
  const differences = visualProperties.map(property => ({ property, forward: forward.css[property], reverse: reverse.css[property] })).filter(value => value.forward !== value.reverse);
  return {
    phase: forward.requestedPhase, forwardProgress: forward.progress, reverseProgress: reverse.progress,
    progressDifference: Math.abs(forward.progress - reverse.progress), exactCssMatch: differences.length === 0, differences,
    note: 'Compare geometry-derived CSS at the recorded positions. Particle activeTime and image pixels may differ with time; this is not a pixel-identical animation assertion.',
  };
}

function reviewHtml(records, identity, comparisons) {
  const cards = records.map(record => `<article><h3>${escapeHtml(record.viewportName + ' / ' + record.direction + ' / ' + record.requestedPhase)}</h3><a href="${escapeHtml(record.file)}"><img loading="lazy" src="${escapeHtml(record.file)}" alt="${escapeHtml(record.requestedPhase + ' recorded composition')}"/></a><p>${escapeHtml(record.capturedAt)}<br/>layout=${escapeHtml(record.layout)}, p=${record.progress.toFixed(4)}, requested=${record.requestedProgress ?? 'normal HTML reading'}</p>${record.sectionFile ? `<a href="${escapeHtml(record.sectionFile)}">完整静态章节截图</a>` : ''}</article>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>问途摄影转场 · 正倒滚记录</title><style>body{margin:0;padding:32px;background:#faf9f6;color:#173441;font:16px/1.8 system-ui,sans-serif}main{max-width:1400px;margin:auto}h1{font-weight:500}a{color:#0b6e99}p{overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}article{border-top:1px solid #ccd7d4;padding-top:15px;min-width:0}img{display:block;width:100%;height:auto}article p{font-size:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}@media(max-width:700px){body{padding:20px}.grid{grid-template-columns:1fr}}</style><main><h1>摄影转场 · 正滚与倒滚</h1><p>本地 Edge 桌面与手机视口模拟。桌面使用 Playwright 浏览器协议发送原生 wheel 输入；手机记录静态 HTML 阅读。以下是带时间戳截图序列与离线浏览页，不是视频。截图、等待图片解码及取样有额外开销，不用于帧性能结论。</p><p>首页文档 SHA-256：${escapeHtml(identity.servedHomepageSha256)}。<a href="records.json">完整元数据与输入记录</a></p><div class="grid">${cards}</div><h2>同进度构图参数</h2><pre>${escapeHtml(JSON.stringify(comparisons, null, 2))}</pre><p>未测真实触摸、真实手机 GPU、Safari 或真实 INP。拍攝记录与独立 --measure 数据分开。</p></main></html>`;
}

async function capture(identity) {
  await mkdir(storyOutput, { recursive: true });
  const records = [], sessions = [], inputLog = [];
  for (const viewportName of ['desktop', 'mobile']) {
    const context = await createBrowserContext('cinematic-record-' + viewportName + '-' + runId, { viewport: viewports[viewportName], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    try {
      const { page, errors, failedRequests } = await openStory(context, viewportName === 'desktop' ? 'sticky' : 'static');
      if (viewportName === 'desktop') {
        for (const direction of ['forward', 'reverse']) {
          for (const chapter of direction === 'forward' ? phases : [...phases].reverse()) {
            const before = await snapshot(page);
            const target = Math.round(before.geometry.start + before.geometry.travel * chapter.progress);
            await wheelTo(page, target, inputLog);
            await page.waitForFunction(progress => {
              const root = document.querySelector('.cinematic-story');
              return Math.abs(Number(root?.dataset.storyProgress) - progress) < .0003 && root?.dataset.storyProgress === root?.dataset.storyTargetProgress;
            }, chapter.progress, { timeout: 5000 });
            await waitForPhaseImages(page, chapter.phase);
            const record = await snapshot(page);
            if (record.phase !== chapter.phase) throw new Error('Requested ' + chapter.phase + ', displayed ' + record.phase);
            const screenshot = await saveScreenshot(page, `${viewportName}-${direction}-${chapter.phase}.jpg`);
            records.push({ viewportName, direction, requestedPhase: chapter.phase, requestedProgress: chapter.progress, targetScrollY: target, ...record, ...screenshot });
          }
        }
      } else {
        for (const chapter of phases) {
          const target = await page.locator(`[data-story-panel="${chapter.phase}"]`).evaluate(panel => Math.max(0, panel.getBoundingClientRect().top + scrollY - (panel.dataset.storyPanel === 'city' ? 0 : 88)));
          await wheelTo(page, target, inputLog);
          await waitForPhaseImages(page, chapter.phase);
          const record = await snapshot(page);
          const screenshot = await saveScreenshot(page, `mobile-reading-${chapter.phase}.jpg`);
          const sectionFile = `mobile-section-${chapter.phase}.jpg`;
          await page.locator(`[data-story-panel="${chapter.phase}"]`).screenshot({ path: insideProject(storyOutput + '/' + sectionFile), type: 'jpeg', quality: 90 });
          const sectionBytes = await readFile(insideProject(storyOutput + '/' + sectionFile));
          records.push({ viewportName, direction: 'reading', requestedPhase: chapter.phase, requestedProgress: null, targetScrollY: target, ...record, ...screenshot, sectionFile, sectionBytes: sectionBytes.length, sectionSha256: sha256(sectionBytes), note: 'Static mobile layout: requestedPhase identifies the visible HTML section, not the root normalized progress. Element screenshot can adjust capture scroll and is excluded from scheduling measurement.' });
        }
      }
      sessions.push({ viewportName, errors, failedRequests });
    } finally { await context.close(); }
  }
  const comparisons = phases.map(chapter => visualComparison(records.find(record => record.direction === 'forward' && record.requestedPhase === chapter.phase), records.find(record => record.direction === 'reverse' && record.requestedPhase === chapter.phase)));
  const result = { mode: 'timestamped-still-sequence', identity, records, comparisons, inputLog, sessions, limitations: ['Desktop Edge headless viewport simulation, not a real phone.', 'Wheel input is sent through Playwright browser protocol; no human touch or physical wheel was tested.', 'Screenshots/decoding waits add overhead; capture is not used for performance conclusions.', 'No video or animated file is generated. review.html uses the saved still images.', 'CSS comparison excludes time-dependent particles and does not prove pixel-identical output.'] };
  await writeFile(insideProject(storyOutput + '/records.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(insideProject(storyOutput + '/review.html'), reviewHtml(records, identity, comparisons));
  console.log(JSON.stringify({ mode: result.mode, output: storyOutput, records: records.length, comparisons, sessions }, null, 2));
}

async function measureScheduling(identity) {
  await mkdir(performanceOutput, { recursive: true });
  const viewportName = mobileMeasure ? 'mobile' : 'desktop';
  const context = await createBrowserContext('cinematic-measure-' + viewportName + '-' + runId, { viewport: viewports[viewportName], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  try {
    const { page, errors, failedRequests } = await openStory(context, mobileMeasure ? 'static' : 'sticky');
    const positioningInputs = [];
    const initial = await snapshot(page);
    const travel = Math.max(initial.geometry.height - viewports[viewportName].height, 1);
    const startScroll = Math.round(initial.geometry.start + travel * .08);
    await wheelTo(page, startScroll, positioningInputs);
    await settle(page, 100);
    const before = await snapshot(page);
    await page.evaluate(() => {
      const state = { start: performance.now(), frames: [], wheelEvents: [], longTasks: [], stopped: false, frameId: 0, observer: null };
      const number = (root, name) => { const value = Number(root?.getAttribute(name)); return Number.isFinite(value) ? value : null; };
      const tick = timestamp => {
        const root = document.querySelector('.cinematic-story');
        state.frames.push({ timestampMs: timestamp, elapsedMs: timestamp - state.start, scrollY, progress: number(root, 'data-story-progress'), drawCount: number(root, 'data-story-draw-count'), activeTime: number(root, 'data-story-active-time'), phase: root?.dataset.storyPhase, layout: root?.dataset.storyLayout });
        if (!state.stopped) state.frameId = requestAnimationFrame(tick);
      };
      state.wheelListener = event => state.wheelEvents.push({ timestampMs: performance.now(), deltaY: event.deltaY, isTrusted: event.isTrusted, deltaMode: event.deltaMode });
      window.addEventListener('wheel', state.wheelListener, { passive: true });
      state.longTaskSupported = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask');
      if (state.longTaskSupported) {
        state.observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) state.longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration, name: entry.name }); });
        state.observer.observe({ type: 'longtask' });
      }
      state.frameId = requestAnimationFrame(tick);
      window.__cinematicSchedulingSample = state;
    });
    const started = performance.now(), requestedInputs = [];
    let lastTarget = startScroll;
    while (performance.now() - started < 10000) {
      const elapsed = performance.now() - started;
      const normalized = Math.min(elapsed / 10000, 1);
      const sweep = normalized < .4 ? normalized / .4 : normalized <= .6 ? 1 : (1 - normalized) / .4;
      const progress = .08 + (storySampleProgress.product - .08) * sweep;
      const target = Math.round(initial.geometry.start + travel * progress);
      const deltaY = target - lastTarget;
      requestedInputs.push({ elapsedMs: elapsed, targetProgress: progress, targetScrollY: target, deltaY });
      if (deltaY) await page.mouse.wheel(0, deltaY);
      lastTarget = target;
      await page.waitForTimeout(60);
    }
    const sample = await page.evaluate(() => {
      const state = window.__cinematicSchedulingSample;
      state.stopped = true;
      cancelAnimationFrame(state.frameId);
      window.removeEventListener('wheel', state.wheelListener);
      if (state.observer) {
        for (const entry of state.observer.takeRecords()) state.longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration, name: entry.name });
        state.observer.disconnect();
      }
      return { startedAtBrowserMs: state.start, durationMs: performance.now() - state.start, frames: state.frames, wheelEvents: state.wheelEvents, longTasks: state.longTasks, longTaskSupported: state.longTaskSupported };
    });
    const after = await snapshot(page);
    const intervals = sample.frames.slice(1).map((frame, index) => frame.timestampMs - sample.frames[index].timestampMs);
    const sorted = [...intervals].sort((a, b) => a - b);
    const percentile = fraction => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
    const result = {
      mode: 'screenshot-free-browser-scheduling', identity, viewportName, before, after,
      sample, intervalsMs: intervals, requestedInputs, positioningInputs, errors, failedRequests,
      summary: { requestedDurationMs: 10000, observedDurationMs: sample.durationMs, intervalCount: intervals.length, p50Ms: percentile(.5), p95Ms: percentile(.95), maximumMs: sorted.at(-1) ?? null, over16_7Ms: intervals.filter(value => value > 16.7).length, over33Ms: intervals.filter(value => value > 33).length, over50Ms: intervals.filter(value => value > 50).length, longTasks: sample.longTasks.length, longTaskTotalMs: sample.longTasks.reduce((sum, task) => sum + task.durationMs, 0), drawCountDelta: after.drawCount - before.drawCount, activeTimeDelta: after.activeTime - before.activeTime, wheelEventsObserved: sample.wheelEvents.length },
      limitations: ['Run this mode separately after all other browser tasks end; this script cannot detect unrelated browser workloads.', 'Headless Edge desktop/mobile viewport simulation with browser-protocol wheel input, not physical touch or a real phone.', 'rAF intervals are browser scheduling observations, not GPU render durations, hardware FPS or real INP.', 'The measurement rAF and DOM metric sampling add instrumentation overhead and run even when the presentation controller is idle.', 'drawCount is the scene root Canvas counter, not every photograph/CSS paint or WebGL output.', 'No screenshot, screencast or encoding is performed in this mode. All samples and long tasks are retained.', 'Mobile mode reads static HTML and does not imply a mobile sequence or real phone performance test.'],
    };
    const filename = mobileMeasure ? 'story-scheduling-mobile.json' : 'story-scheduling.json';
    await writeFile(insideProject(performanceOutput + '/' + filename), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ mode: result.mode, file: performanceOutput + '/' + filename, summary: result.summary, errors, failedRequests }, null, 2));
  } finally { await context.close(); }
}

try {
  const identity = await buildIdentity();
  if (measure) await measureScheduling(identity);
  else await capture(identity);
} finally {
  await lock.close();
  await unlink(lockPath);
}
