import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject } from '../helpers/browser-runtime.mjs';
import { siteConfig } from '../../site.config.mjs';
const base = (process.env.SUBPATH_TEST_URL || 'http://127.0.0.1:4175/askway').replace(/\/$/, '');
const records = [], errors = [], requests = [];
const context = await createBrowserContext('subpath-v2', { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure()?.errorText));
page.on('request', request => requests.push(request.url()));
async function check(name, run) { try { await run(); records.push({ name, pass: true }); } catch (error) { records.push({ name, pass: false, error: error.message }); } }
try {
  await check('preview root redirects to the configured subpath', async () => {
    const result = await fetch(new URL(base).origin + '/', { redirect: 'manual' });
    assert.equal(result.status, 302); assert.equal(result.headers.get('location'), '/askway/');
  });
  await check('five subpath routes have correct canonical and static status', async () => {
    for (const route of ['/', '/product/', '/experience/', '/cooperation/', '/about/']) {
      const result = await page.goto(base + route, { waitUntil: 'networkidle' }); assert.equal(result.status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), new URL(siteConfig.url).origin + '/askway' + route);
    }
  });
  await check('static assets load exclusively under the subpath', async () => {
    assert.ok(requests.filter(url => url.includes('/assets/')).length > 5);
    assert.ok(requests.filter(url => url.includes('/assets/')).every(url => new URL(url).pathname.startsWith('/askway/assets/')));
    assert.deepEqual(errors, []);
  });
  await check('experience reload hydrates the independent subpath page', async () => {
    await page.goto(base + '/experience/', { waitUntil: 'networkidle' });
    assert.equal((await page.reload({ waitUntil: 'networkidle' })).status(), 200);
    assert.equal(await page.locator('[data-task]').count(), 3);
  });
  await check('the curated proposal and adoption work at a non-root base', async () => {
    await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
    await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
    await page.getByRole('button', { name: '采用这份候选', exact: true }).click();
    assert.match(await page.locator('[data-active-plan]').innerText(), /当前版本 V1/);
  });
  await check('the lazy 3D runtime uses the correct subpath and renders', async () => {
    await page.getByRole('button', { name: '三维沙盘', exact: true }).click();
    await page.locator('.city-sandbox__canvas').scrollIntoViewIfNeeded();
    await page.locator('[data-scene-ready="true"]').waitFor();
    assert.equal(await page.locator('canvas').count(), 1); assert.deepEqual(errors, []);
  });
  await check('a 720px CSS viewport equivalent to 1440px at 200 percent fits its controls', async () => {
    await page.setViewportSize({ width: 720, height: 500 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  });
  await check('subpath information and navigation remain available without JavaScript', async () => {
    const nojs = await createBrowserContext('subpath-nojs', { javaScriptEnabled: false });
    try {
      const staticPage = await nojs.newPage(); await staticPage.goto(base + '/experience/');
      assert.equal(await staticPage.locator('h1').count(), 1);
      assert.ok((await staticPage.locator('main').innerText()).length > 1000);
      assert.ok(await staticPage.locator('a[href="/askway/product/#download"]').count() > 0);
    } finally { await nojs.close(); }
  });
} finally { await context.close(); }
await mkdir(insideProject('delivery/experience'), { recursive: true });
await writeFile(insideProject('delivery/experience/subpath-results.json'), JSON.stringify({ base, records, errors, passed: records.filter(item => item.pass).length, total: records.length }, null, 2));
console.log(JSON.stringify(records, null, 2)); process.exitCode = records.some(item => !item.pass) ? 1 : 0;
