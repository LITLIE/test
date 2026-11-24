import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';
const evidence = insideProject('delivery/experience');
await mkdir(evidence, { recursive: true });
const records = [], errors = [], metrics = [];
const context = await createBrowserContext('city-scene', { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', error => errors.push(error.message));
const requests = [];
page.on('request', request => requests.push(request.url()));
async function check(name, action) {
  try { await action(); records.push({ name, pass: true }); }
  catch (error) { records.push({ name, pass: false, error: error.message }); }
}
async function activate() {
  await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
  await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
  await page.getByRole('button', { name: '采用这份候选', exact: true }).click();
}
async function openScene() {
  await page.getByRole('button', { name: '三维沙盘', exact: true }).click();
  await page.locator('.city-sandbox__canvas').scrollIntoViewIfNeeded();
  await page.locator('[data-scene-ready="true"]').waitFor();
  await page.locator('[data-scene-resources-ready="true"]').waitFor();
}
try {
  await check('home and the initial experience do not load the Three runtime', async () => {
    await page.goto(testBase, { waitUntil: 'networkidle' });
    await page.goto(testBase + '/experience/', { waitUntil: 'networkidle' });
    assert.equal(requests.some(url => /CitySandbox-|city-runtime-/.test(url)), false);
    assert.equal(await page.locator('canvas').count(), 0);
  });
  await activate();
  const confirmed = await page.locator('[data-active-plan]').innerText();
  await check('enabling 3D creates one on-demand renderer and retains the same plan', async () => {
    await openScene();
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('[data-active-plan]').innerText(), confirmed);
    const stats = await page.locator('.city-sandbox__canvas').evaluate(element => ({ ...element.dataset }));
    metrics.push({ name: 'desktop software WebGL', ...stats });
    assert.equal(Number(stats.activeRenderer), 1);
    assert.ok(Number(stats.sceneTriangles) <= 120000);
    assert.ok(Number(stats.sceneDrawCalls) <= 80);
    assert.ok(Number(stats.sceneDpr) <= 1.5);
  });
  await check('DOM selection and visible camera controls work without changing the plan', async () => {
    const points = page.getByRole('list', { name: '按方案顺序选择三维地点' });
    await points.getByRole('button').last().click();
    assert.equal(await points.getByRole('button').last().getAttribute('aria-pressed'), 'true');
    for (const name of ['向左旋转三维沙盘', '向右旋转三维沙盘', '放大三维沙盘', '缩小三维沙盘']) await page.getByRole('button', { name, exact: true }).click();
    await page.locator('.city-sandbox').getByRole('button', { name: '复位', exact: true }).click();
    assert.equal(await page.locator('[data-active-plan]').innerText(), confirmed);
  });
  await check('a resting demand renderer stops drawing frames', async () => {
    await page.locator('.city-sandbox__canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const before = await page.locator('.city-sandbox__canvas').getAttribute('data-render-count');
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.city-sandbox__canvas').getAttribute('data-render-count'), before);
  });
  await check('moving the scene outside the viewport pauses rendering', async () => {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    assert.equal(await page.locator('.city-sandbox__canvas').evaluate(element => { const rect = element.getBoundingClientRect(); return rect.bottom < 0 || rect.top > innerHeight; }), true);
    await page.waitForFunction(() => document.querySelector('.city-sandbox__canvas')?.dataset.scenePaused === 'true');
    const before = await page.locator('.city-sandbox__canvas').getAttribute('data-render-count');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.city-sandbox__canvas').getAttribute('data-render-count'), before);
    await page.locator('.city-sandbox__canvas').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.city-sandbox__canvas')?.dataset.scenePaused === 'false');
  });
  await check('a simulated document visibility event suspends and restores the renderer', async () => {
    try {
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => document.querySelector('.city-sandbox__canvas')?.dataset.scenePaused === 'true');
    } finally {
      await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    }
    await page.waitForFunction(() => document.querySelector('.city-sandbox__canvas')?.dataset.scenePaused === 'false');
  });
  await check('manual 3D rotation interrupts preview and retains camera ownership', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: '预演路线', exact: true }).click();
    await page.getByRole('button', { name: '向右旋转三维沙盘', exact: true }).click();
    assert.match(await page.locator('[data-playback-status]').innerText(), /已暂停/);
    const paused = await page.locator('[data-playback-status]').innerText();
    await page.waitForTimeout(2700);
    assert.equal(await page.locator('[data-playback-status]').innerText(), paused);
    assert.match(await page.locator('.city-sandbox__status').innerText(), /向右旋转/);
  });
  await check('live reduced motion stops timed preview and automatic cameras', async () => {
    await page.getByRole('button', { name: '预演路线', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.exp-playback button')?.textContent.includes('暂停') && document.querySelector('[data-playback-status]')?.textContent.includes('已暂停'));
    assert.match(await page.locator('.city-sandbox__hint').innerText(), /减弱动画/);
  });
  await page.locator('.city-sandbox__canvas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence + '/city-sandbox-desktop.png' });
  await check('context loss keeps the active version and a working 2D fallback', async () => {
    await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_lose_context');
      if (extension) extension.loseContext();
      else canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await page.locator('.scene-fallback').waitFor();
    assert.match(await page.locator('.scene-fallback').innerText(), /当前方案与选中地点已保留/);
    assert.equal(await page.locator('[data-active-plan]').innerText(), confirmed);
    assert.equal(await page.locator('.route-map').count(), 1);
    await page.getByRole('button', { name: '返回二维', exact: true }).click();
    assert.equal(await page.locator('canvas').count(), 0);
  });
  await check('three successive 2D/3D cycles retain exactly one owned canvas', async () => {
    for (let i = 0; i < 3; i++) {
      await openScene(); assert.equal(await page.locator('canvas').count(), 1);
      await page.getByRole('button', { name: '二维地图', exact: true }).click();
      assert.equal(await page.locator('canvas').count(), 0);
    }
    assert.equal(await page.locator('[data-active-plan]').innerText(), confirmed);
  });
  await check('mobile starts in 2D and explicitly enables a smaller-DPR scene', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('canvas').count(), 0);
    await activate();
    await page.getByRole('button', { name: '地图', exact: true }).click();
    await openScene();
    const stats = await page.locator('.city-sandbox__canvas').evaluate(element => ({ ...element.dataset }));
    metrics.push({ name: '390px mobile simulation, software WebGL', ...stats });
    assert.ok(Number(stats.sceneDpr) <= 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: evidence + '/city-sandbox-mobile.png' });
  });
  await check('unavailable scene chunks retain a complete working 2D view', async () => {
    const failurePage = await context.newPage();
    await failurePage.route(/\/assets\/(CitySandbox-|city-runtime-).*\.js/, route => route.abort());
    await failurePage.goto(testBase + '/experience/', { waitUntil: 'networkidle' });
    await failurePage.getByRole('button', { name: '三维沙盘', exact: true }).click();
    await failurePage.locator('.scene-fallback').waitFor();
    assert.equal(await failurePage.locator('.route-map').count(), 1);
    assert.equal(await failurePage.locator('.scene-places button').count(), 10);
    await failurePage.getByRole('button', { name: '返回二维', exact: true }).click();
    assert.equal(await failurePage.locator('[data-scene-status]').count(), 0);
    await failurePage.close();
  });
  await check('no unhandled browser runtime errors occurred', async () => assert.deepEqual(errors, []));
} finally { await context.close(); }
await writeFile(evidence + '/scene-results.json', JSON.stringify({ environment: 'Edge headless, SwiftShader software WebGL; desktop and mobile viewport simulations', records, metrics, errors, passed: records.filter(item => item.pass).length, total: records.length }, null, 2));
console.log(JSON.stringify({ records, metrics, errors }, null, 2));
process.exitCode = records.some(item => !item.pass) ? 1 : 0;
