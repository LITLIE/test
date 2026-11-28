import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { captureBrowserBuild, createBrowserContext, insideProject, scrollStoryToProgress as scrollNativeStoryToProgress, settlePresentation, storyRuntime, storySampleProgress, testBase } from '../helpers/browser-runtime.mjs';

const base = process.env.VISUAL_TEST_URL || testBase;
const out = insideProject(process.env.VISUAL_OUTDIR || 'delivery/cinematic-refresh/visual');
await mkdir(out, { recursive: true });
const build = await captureBrowserBuild(base);
const checks = [];
const check = async (name, run) => { try { await run(); checks.push({ name, pass: true }); } catch (error) { checks.push({ name, pass: false, error: error.message }); } };

async function scrollStoryToProgress(page, progress) {
  await scrollNativeStoryToProgress(page, progress);
  await page.waitForFunction(expected => {
    const root = document.querySelector('.cinematic-story');
    const value = root?.dataset.storyProgress, target = root?.dataset.storyTargetProgress;
    return value !== undefined && target !== undefined && value === target && Math.abs(Number(target) - expected) < .001;
  }, progress);
}

await check('a failed decorative chunk retains the city heading, route and navigation', async () => {
  const context = await createBrowserContext('visual-decorative-failure', { viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    let blocked = 0;
    await page.route('**/*', route => {
      if (/SeaRouteParticles/.test(route.request().url())) { blocked++; return route.abort('failed'); }
      return route.continue();
    });
    const failedRequest = page.waitForEvent('requestfailed', { predicate: request => /SeaRouteParticles/.test(request.url()), timeout: 10000 });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await failedRequest;
    assert.ok(blocked > 0, 'The requested decorative module was actually blocked');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('h1').count(), 1);
    assert.match(await page.locator('h1').innerText(), /让城市探索/);
    assert.deepEqual(await page.locator('.route-place h3').allTextContents(), ['海滨公园', '香炉湾', '日月贝']);
    assert.equal(await page.locator('[data-story-panel]').count(), 4);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '打开导航' }).click();
    assert.equal(await page.getByRole('navigation', { name: '移动主导航' }).getByRole('link', { name: /旅程体验/ }).count(), 1);
  } finally { await context.close(); }
});

const context = await createBrowserContext('visual-motion-controls', { viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
try {
  const page = await context.newPage();
  const stopped = async () => {
    await settlePresentation(page);
    const before = await storyRuntime(page);
    const canvasBefore = await page.locator('.sea-route-particles').evaluateAll(canvases => canvases.map(canvas => ({ drawCount: canvas.dataset.drawCount, activeTime: canvas.dataset.activeTime })));
    await page.waitForTimeout(350);
    const after = await storyRuntime(page);
    assert.equal(after.drawCount, before.drawCount, 'Paused story draw-count stays fixed');
    assert.equal(after.activeTime, before.activeTime, 'Paused story active time stays fixed');
    const canvasAfter = await page.locator('.sea-route-particles').evaluateAll(canvases => canvases.map(canvas => ({ drawCount: canvas.dataset.drawCount, activeTime: canvas.dataset.activeTime })));
    if (canvasBefore.length && canvasAfter.length) assert.deepEqual(canvasAfter, canvasBefore);
    for (const canvas of await page.locator('.sea-route-particles').all()) assert.equal(await canvas.getAttribute('data-drawing'), 'false');
  };
  await check('native scroll forms the route and reverse scroll restores the sea transition', async () => {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator('.sea-route-particles').waitFor({ state: 'attached' });
    await scrollStoryToProgress(page, storySampleProgress.route);
    assert.equal((await storyRuntime(page)).phase, 'route');
    await page.screenshot({ path: insideProject(out + '/desktop-transition.png') });
    await scrollStoryToProgress(page, storySampleProgress.product);
    assert.equal((await storyRuntime(page)).phase, 'product');
    await settlePresentation(page);
    const settled = await page.locator('.sea-route-particles').evaluate(canvas => ({ count: canvas.dataset.drawCount, image: canvas.toDataURL() }));
    await page.waitForTimeout(350);
    assert.deepEqual(await page.locator('.sea-route-particles').evaluate(canvas => ({ count: canvas.dataset.drawCount, image: canvas.toDataURL() })), settled, 'Completed route has no continuing Canvas work');
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sea-route-particles')).pointerEvents), 'none');
  });
  await check('pausing remains in force through product navigation and returning home', async () => {
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    await stopped();
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '产品体验' }).click();
    await page.waitForURL('**/product/');
    assert.equal(await page.getByRole('button', { name: '播放动态效果', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.diagram-current')).animationPlayState), 'paused');
    await page.locator('.brand').first().click();
    await page.waitForURL(base + '/');
    await stopped();
    await page.getByRole('button', { name: '播放动态效果', exact: true }).click();
    await page.locator('.sea-route-particles').waitFor({ state: 'attached' });
  });
  await check('reduced motion stops actual continuous drawing while retaining the full route', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopped();
    assert.deepEqual(await page.locator('.route-place h3').allTextContents(), ['海滨公园', '香炉湾', '日月贝']);
    assert.equal(await page.getByRole('button', { name: '已减少动态效果', exact: true }).isDisabled(), true);
  });
  await check('the experience route contains no website decorative layer or motion control', async () => {
    await page.goto(base + '/experience/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.sea-route-particles,.presentation-toggle').count(), 0);
    assert.equal(await page.locator('[data-map-panel]').count(), 1);
  });
} finally { await context.close(); }

await writeFile(insideProject(out + '/results.json'), JSON.stringify({ build, checks, passed: checks.filter(check => check.pass).length, total: checks.length }, null, 2));
console.log(JSON.stringify(checks, null, 2));
process.exitCode = checks.some(check => !check.pass) ? 1 : 0;
