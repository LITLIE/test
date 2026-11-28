/** Independent, screenshot-free observation of actual showcase render-count changes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createBrowserContext, insideProject, testBase } from '../tests/helpers/browser-runtime.mjs';

const argumentsList = process.argv.slice(2);
if (argumentsList.includes('--help')) {
  console.log('node scripts/measure-presentation-scene.mjs [--url http://127.0.0.1:4173]');
  console.log('Runs one independent 10 second showcase observation with forced SwiftShader, without screenshots or recording.');
  console.log('Output: delivery/cinematic-refresh/performance/showcase-scheduling.json');
  console.log('Run only after all other browser tasks finish. Real phone/hardware FPS and INP are not measured.');
  process.exit(0);
}
let url = testBase;
for (let index = 0; index < argumentsList.length; index++) {
  if (argumentsList[index] !== '--url' || !argumentsList[index + 1]) throw new Error('Expected only --url URL');
  url = argumentsList[++index];
}
url = url.replace(/\/$/, '');
const parsedUrl = new URL(url);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname) || !['http:', 'https:'].includes(parsedUrl.protocol)) {
  throw new Error('Only a local preview URL is supported.');
}
const performanceOutput = process.env.CINEMATIC_PERFORMANCE_OUTDIR || 'delivery/cinematic-refresh/performance';
const output = insideProject(performanceOutput + '/showcase-scheduling.json');
await mkdir(insideProject(performanceOutput), { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const viewport = { width: 1440, height: 1000 };
const softwareArguments = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const hostSelector = '.immersive-live .city-sandbox__canvas';
const profileId = 'showcase-measure-' + new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '-');
const report = {
  mode: 'actual-render-count-mutation-observation', status: 'initializing', previewUrl: url,
  recordedAt: new Date().toISOString(), viewport, requestedDpr: 1, headless: true,
  reducedMotion: 'no-preference', forcedBrowserArguments: softwareArguments,
  sourceHashes: {}, errors: [], failedRequests: [], limitations: [
    'Run independently after other browser tasks finish; this script cannot detect unrelated browser workloads.',
    'Headless desktop Edge with forced SwiftShader. Software rendering observations do not establish phone GPU or hardware FPS.',
    'MutationObserver timestamps are delivery times after render-count updates, not GPU timings. Coalesced updates are reported explicitly.',
    'Render-count counts completed renderer.render calls. It is not proof that every frame was displayed by a hardware compositor.',
    'renderer.info triangles/draw calls are counts, not GPU memory bytes.',
    'No screenshots, screencast, video encoding, synthetic rAF loop or performance benchmark runs in parallel within this script.',
    'The runtime waterElapsed is currently private. Scene activeTime is null when no dataset exposes it; homepage story activeTime is recorded separately.',
    'This does not measure real user INP, Safari, physical input or real mobile devices.',
  ],
};

async function bounded(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}

async function servedIdentity() {
  const response = await fetch(url + '/', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Preview homepage returned ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { homepageSha256: hash(bytes), homepageBytes: bytes.length };
}

async function readState(page, includeRenderer = false) {
  return page.evaluate(({ selector, includeRenderer }) => {
    const host = document.querySelector(selector);
    const stage = host?.closest('.immersive-stage');
    const canvas = host?.querySelector('canvas');
    const story = document.querySelector('.cinematic-story');
    if (!host || !stage || !canvas) throw new Error('The real showcase canvas host is missing');
    const finite = value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const dataset = { ...host.dataset };
    const bounds = stage.getBoundingClientRect();
    let pauseChoice = null;
    try { pauseChoice = sessionStorage.getItem('askway.presentation.paused') === 'true'; } catch { /* unavailable storage is recorded */ }
    const state = {
      browserTimestampMs: performance.now(), dataset,
      renderCount: finite(dataset.renderCount), triangles: finite(dataset.sceneTriangles), drawCalls: finite(dataset.sceneDrawCalls), rendererDpr: finite(dataset.sceneDpr),
      sceneActiveTime: finite(dataset.sceneActiveTime ?? dataset.activeTime), sceneActiveTimeSource: dataset.sceneActiveTime !== undefined ? 'data-scene-active-time' : dataset.activeTime !== undefined ? 'data-active-time' : 'not exposed by cityRuntime',
      homepageStory: story ? { progress: finite(story.dataset.storyProgress), phase: story.dataset.storyPhase, activeTime: finite(story.dataset.storyActiveTime), drawCount: finite(story.dataset.storyDrawCount), owner: story.dataset.presentationOwner ?? null } : null,
      policy: { presentationMotion: document.documentElement.dataset.presentationMotion ?? null, userPaused: pauseChoice, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, saveData: Boolean(navigator.connection?.saveData), documentVisible: document.visibilityState === 'visible', showcaseLive: stage.dataset.live, showcaseOwner: stage.dataset.presentationOwner ?? null, owners: [...document.querySelectorAll('[data-presentation-owner]')].map(element => ({ tag: element.tagName, className: element.className, owner: element.getAttribute('data-presentation-owner') })) },
      userAgent: navigator.userAgent, browserDpr: devicePixelRatio, viewport: { width: innerWidth, height: innerHeight },
      stageBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, canvasPixels: { width: canvas.width, height: canvas.height },
    };
    if (includeRenderer) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) state.webgl = { available: false };
      else {
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        const unmaskedRenderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null;
        state.webgl = { available: true, debugRendererInfoAvailable: Boolean(extension), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION), unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null, unmaskedRenderer, actualRendererMentionsSwiftShader: typeof unmaskedRenderer === 'string' ? /swiftshader/i.test(unmaskedRenderer) : null };
      }
    }
    return state;
  }, { selector: hostSelector, includeRenderer });
}

let context;
try {
  report.servedBefore = await servedIdentity();
  for (const path of ['dist/index.html', 'dist/build-info.json', 'scripts/measure-presentation-scene.mjs', 'tests/helpers/browser-runtime.mjs', 'src/components/ImmersiveShowcase.tsx', 'src/features/experience/scene/CinematicCity.tsx', 'src/features/experience/scene/CitySandbox.tsx', 'src/features/experience/scene/cityRuntime.ts', 'src/motion/PresentationMotion.tsx', 'src/motion/presentationPolicy.ts', 'public/assets/realism/sources.json', 'public/assets/cinematic/manifest.json']) {
    try { report.sourceHashes[path] = hash(await readFile(insideProject(path))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; report.sourceHashes[path] = null; }
  }
  report.buildInfo = JSON.parse(await readFile(insideProject('dist/build-info.json'), 'utf8'));
  context = await createBrowserContext(profileId, { viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference', args: softwareArguments, timeout: 25000 });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push({ at: new Date().toISOString(), message: error.message }));
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
  await page.goto(url + '/', { waitUntil: 'networkidle', timeout: 25000 });
  await bounded(page.evaluate(() => document.fonts.ready), 15000, 'Font readiness exceeded the 15 second setup limit');
  const stage = page.locator('.immersive-stage').first();
  await stage.scrollIntoViewIfNeeded({ timeout: 10000 });
  await page.waitForTimeout(250);
  const toggle = stage.locator('.immersive-toggle');
  report.activation = 'automatic visible desktop showcase';
  if (await stage.getAttribute('data-live') !== 'true' && await toggle.getAttribute('aria-pressed') === 'false') {
    if (!(await toggle.innerText()).includes('开启立体场景')) throw new Error('The showcase is in a fallback state instead of a normal enable state');
    await toggle.click();
    report.activation = 'explicit existing showcase enable button';
  }
  await page.waitForFunction(selector => {
    const host = document.querySelector(selector);
    return host?.dataset.sceneResourcesReady === 'true' && host.dataset.sceneReady === 'true' && host.dataset.sceneAnimating === 'true' && host.dataset.activeRenderer === '1';
  }, hostSelector, { timeout: 25000 });
  const warmed = await readState(page, true);
  if (warmed.renderCount === null) throw new Error('Missing actual renderCount');
  if (Number(warmed.dataset.sceneResourceFallbacks) !== 0) throw new Error('Showcase resources used a fallback; refusing to label a full-resource measurement');
  report.initialRenderer = warmed.webgl;
  await page.waitForFunction(({ selector, count }) => Number(document.querySelector(selector)?.dataset.renderCount) >= count + 2, { selector: hostSelector, count: warmed.renderCount }, { timeout: 15000 });
  report.before = await readState(page);
  if (!report.before.policy.showcaseOwner || report.before.policy.presentationMotion !== 'running') throw new Error('The continuous showcase does not own an allowed presentation surface');
  report.status = 'sampling';
  report.sample = await bounded(page.evaluate(({ selector, durationMs }) => new Promise(resolve => {
    const host = document.querySelector(selector);
    if (!host) throw new Error('The showcase host disappeared before sampling');
    const startedAtBrowserMs = performance.now(), initialRenderCount = Number(host.dataset.renderCount);
    const frames = [], longTasks = [];
    let lastCount = initialRenderCount;
    const finite = value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const observe = mutations => {
      const count = Number(host.dataset.renderCount);
      if (!Number.isFinite(count) || count <= lastCount) return;
      const now = performance.now(), stage = host.closest('.immersive-stage'), story = document.querySelector('.cinematic-story');
      frames.push({ timestampMs: now, elapsedMs: now - startedAtBrowserMs, renderCount: count, renderCountDelta: count - lastCount, renderCountMutationsInBatch: mutations.filter(item => item.attributeName === 'data-render-count').length, triangles: finite(host.dataset.sceneTriangles), drawCalls: finite(host.dataset.sceneDrawCalls), dpr: finite(host.dataset.sceneDpr), sceneActiveTime: finite(host.dataset.sceneActiveTime ?? host.dataset.activeTime), homepageStoryActiveTime: finite(story?.dataset.storyActiveTime), homepageStoryDrawCount: finite(story?.dataset.storyDrawCount), sceneAnimating: host.dataset.sceneAnimating, scenePaused: host.dataset.scenePaused, animationRequested: host.dataset.animationRequested, owner: stage?.dataset.presentationOwner ?? null, presentationMotion: document.documentElement.dataset.presentationMotion, documentVisibility: document.visibilityState });
      lastCount = count;
    };
    const observer = new MutationObserver(observe);
    observer.observe(host, { attributes: true, attributeFilter: ['data-render-count'], attributeOldValue: true });
    const longTaskSupported = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask');
    let longTaskObserver = null;
    if (longTaskSupported) {
      longTaskObserver = new PerformanceObserver(list => { for (const entry of list.getEntries()) longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration, name: entry.name }); });
      longTaskObserver.observe({ type: 'longtask' });
    }
    setTimeout(() => {
      const pending = observer.takeRecords();
      if (pending.length) observe(pending);
      observer.disconnect();
      if (longTaskObserver) {
        for (const entry of longTaskObserver.takeRecords()) longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration, name: entry.name });
        longTaskObserver.disconnect();
      }
      resolve({ requestedDurationMs: durationMs, actualDurationMs: performance.now() - startedAtBrowserMs, startedAtBrowserMs, initialRenderCount, finalRenderCount: Number(host.dataset.renderCount), hostStillConnected: host.isConnected, frames, longTasks, longTaskSupported });
    }, durationMs);
  }), { selector: hostSelector, durationMs: 10000 }), 30000, 'Showcase sampling exceeded its 30 second deadline');
  report.after = await readState(page);
  const intervals = report.sample.frames.slice(1).map((frame, index) => frame.timestampMs - report.sample.frames[index].timestampMs);
  const sorted = [...intervals].sort((a, b) => a - b);
  const percentile = fraction => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
  const outputDelta = report.sample.finalRenderCount - report.sample.initialRenderCount;
  report.intervalsMs = intervals;
  report.summary = {
    durationMs: report.sample.actualDurationMs, renderCountDelta: outputDelta, observedRenderCallsPerSecond: outputDelta / (report.sample.actualDurationMs / 1000),
    observerSamples: report.sample.frames.length, intervalCount: intervals.length, p50Ms: percentile(.5), p95Ms: percentile(.95), maximumMs: sorted.at(-1) ?? null,
    over16_7Ms: intervals.filter(value => value > 16.7).length, over33Ms: intervals.filter(value => value > 33).length, over50Ms: intervals.filter(value => value > 50).length,
    coalescedUpdates: report.sample.frames.filter(frame => frame.renderCountDelta > 1).length,
    longTasks: report.sample.longTasks.length, longTaskTotalMs: report.sample.longTasks.reduce((sum, entry) => sum + entry.durationMs, 0),
    sceneActiveTimeDelta: report.before.sceneActiveTime !== null && report.after.sceneActiveTime !== null ? report.after.sceneActiveTime - report.before.sceneActiveTime : null,
    sceneActiveTimeAvailability: report.after.sceneActiveTimeSource,
    homepageStoryActiveTimeDelta: report.before.homepageStory?.activeTime != null && report.after.homepageStory?.activeTime != null ? report.after.homepageStory.activeTime - report.before.homepageStory.activeTime : null,
    homepageStoryDrawCountDelta: report.before.homepageStory?.drawCount != null && report.after.homepageStory?.drawCount != null ? report.after.homepageStory.drawCount - report.before.homepageStory.drawCount : null,
    ownerRemainedAllowed: report.sample.frames.every(frame => frame.owner && frame.presentationMotion === 'running' && frame.sceneAnimating === 'true' && frame.documentVisibility === 'visible'),
  };
  report.servedAfter = await servedIdentity();
  report.servedDocumentUnchanged = report.servedBefore.homepageSha256 === report.servedAfter.homepageSha256;
  report.status = 'completed';
  if (!report.sample.hostStillConnected || outputDelta <= 0 || !report.summary.ownerRemainedAllowed || report.errors.length || report.failedRequests.length || !report.servedDocumentUnchanged) {
    report.status = 'completed-with-observation-failure';
    process.exitCode = 1;
  }
} catch (error) {
  report.status = 'failed';
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (context) {
    try { await context.close(); report.contextClosed = true; }
    catch (error) { report.contextClosed = false; report.closeError = error.message; process.exitCode = 1; }
  }
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ file: output, status: report.status, activation: report.activation, renderer: report.initialRenderer, summary: report.summary, failure: report.failure, contextClosed: report.contextClosed }, null, 2));
