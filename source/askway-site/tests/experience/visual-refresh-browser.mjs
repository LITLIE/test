import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';

const base = process.env.VISUAL_TEST_URL || testBase;
const out = insideProject('delivery/visual-refresh/motion');
await mkdir(out, { recursive: true });
const checks = [];
const check = async (name, run) => { try { await run(); checks.push({ name, pass: true }); } catch (error) { checks.push({ name, pass: false, error: error.message }); } };

await check('a failed decorative chunk retains the city heading, route and navigation', async () => {
  const context = await createBrowserContext('visual-decorative-failure', { viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    let blocked = 0;
    await page.route('**/*', route => {
      if (/SeaRouteParticles/.test(route.request().url())) { blocked++; return route.abort('failed'); }
      return route.continue();
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    assert.ok(blocked > 0, 'The requested decorative module was actually blocked');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('h1').count(), 1);
    assert.match(await page.locator('h1').innerText(), /让城市探索/);
    assert.deepEqual(await page.locator('.route-place h3').allTextContents(), ['海滨公园', '香炉湾', '日月贝']);
    await page.getByRole('button', { name: '打开导航' }).click();
    assert.equal(await page.getByRole('navigation', { name: '移动主导航' }).getByRole('link', { name: /旅程体验/ }).count(), 1);
  } finally { await context.close(); }
});

const context = await createBrowserContext('visual-motion-controls', { viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
try {
  const page = await context.newPage();
  const scrollToProgress = async progress => {
    await page.evaluate(progress => {
      const opening = document.querySelector('.coastal-opening');
      window.scrollTo({ top: opening.offsetTop + (opening.offsetHeight - Math.min(innerHeight * .68, 700)) * progress, behavior: 'instant' });
    }, progress);
    await page.waitForFunction(expected => Math.abs(Number(document.querySelector('.sea-route-particles')?.dataset.progress) - expected) < .015, progress);
  };
  await check('native scroll forms the route and reverse scroll restores the sea transition', async () => {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator('.sea-route-particles').waitFor({ state: 'attached' });
    await scrollToProgress(.45);
    await page.screenshot({ path: out + '/mobile-transition.png' });
    await scrollToProgress(.82);
    assert.equal(await page.locator('.sea-route-particles').getAttribute('data-drawing'), 'false');
    const settled = await page.locator('.sea-route-particles').evaluate(canvas => canvas.toDataURL());
    await scrollToProgress(.95);
    assert.equal(await page.locator('.sea-route-particles').evaluate(canvas => canvas.toDataURL()), settled);
    await scrollToProgress(.45);
    assert.equal(await page.locator('.sea-route-particles').getAttribute('data-drawing'), 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sea-route-particles')).pointerEvents), 'none');
  });
  await check('pausing remains in force through product navigation and returning home', async () => {
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    assert.equal(await page.locator('.sea-route-particles').count(), 0);
    await page.locator('.route-story .text-link').click();
    await page.waitForURL('**/product/');
    assert.equal(await page.getByRole('button', { name: '播放动态效果', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.diagram-current')).animationPlayState), 'paused');
    await page.locator('.brand').first().click();
    await page.waitForURL(base + '/');
    assert.equal(await page.locator('.sea-route-particles').count(), 0);
    await page.getByRole('button', { name: '播放动态效果', exact: true }).click();
    await page.locator('.sea-route-particles').waitFor({ state: 'attached' });
  });
  await check('reduced motion removes continuous drawing while retaining the full route', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.sea-route-particles'));
    assert.deepEqual(await page.locator('.route-place h3').allTextContents(), ['海滨公园', '香炉湾', '日月贝']);
    assert.equal(await page.getByRole('button', { name: '已减少动态效果', exact: true }).isDisabled(), true);
  });
  await check('the experience route contains no website decorative layer or motion control', async () => {
    await page.goto(base + '/experience/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.sea-route-particles,.presentation-toggle').count(), 0);
    assert.equal(await page.locator('[data-map-panel]').count(), 1);
  });
} finally { await context.close(); }

await writeFile(out + '/results.json', JSON.stringify({ checks, passed: checks.filter(check => check.pass).length, total: checks.length }, null, 2));
console.log(JSON.stringify(checks, null, 2));
process.exitCode = checks.some(check => !check.pass) ? 1 : 0;
