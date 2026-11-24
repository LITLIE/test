import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject } from '../helpers/browser-runtime.mjs';

const output = insideProject('.agent_tmp/coastal-runtime');
await mkdir(output, { recursive: true });
const base = process.env.RENDER_URL || 'http://127.0.0.1:5173';
const context = await createBrowserContext('coastal-runtime', {
  viewport: { width: 1080, height: 760 }, reducedMotion: 'no-preference',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [], records = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const state = () => page.locator('#coastal-runtime-audit').evaluate(host => ({ ...host.dataset }));
const rest = async () => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(200);
};
const check = async (name, action) => {
  try { await action(); records.push({ name, pass: true }); }
  catch (error) { records.push({ name, pass: false, error: error.message }); }
};
let stats;
try {
  await page.goto(base + '/experience/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [{ catalog }, { buildSceneLayout }, { createCityRuntime }] = await Promise.all([
      import('/src/features/experience/data/catalog.ts'), import('/src/features/experience/map/projection.ts'),
      import('/src/features/experience/scene/cityRuntime.ts'),
    ]);
    const layout = buildSceneLayout(catalog, null);
    const host = document.createElement('div');
    host.id = 'coastal-runtime-audit';
    host.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:600px;z-index:100000';
    document.body.append(host);
    window.coastalAuditSnapshot = { layout, visiblePoints: layout.points, selectedPlaceId: 'ZS-004', playbackPlaceId: null,
      reducedMotion: false, preset: 'theatre', lighting: 'day', presentation: 'cinematic' };
    window.coastalAuditRuntime = createCityRuntime(host, window.coastalAuditSnapshot,
      { onPick() {}, onFailure(message) { host.dataset.failure = message; }, onReady() {}, onViewChange() {} });
  });
  await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.sceneResourcesReady === 'true');
  await check('local PBR textures and HDR finish without shader or resource errors', async () => {
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.sceneReady === 'true');
    stats = await state();
    assert.equal(stats.sceneResourceFallbacks, '0');
    assert.equal(stats.sceneCamera, 'perspective');
    assert.ok(Number(stats.sceneDrawCalls) <= 80, stats.sceneDrawCalls);
    assert.ok(Number(stats.sceneDpr) <= 1.5);
    assert.deepEqual(errors, []);
  });
  await check('an explicit sea-motion pause stops the demand renderer', async () => {
    await page.evaluate(() => window.coastalAuditRuntime.setAnimation(false));
    await rest();
    const before = (await state()).renderCount;
    await page.waitForTimeout(500);
    assert.equal((await state()).renderCount, before);
    assert.equal((await state()).animationRequested, 'false');
    await page.locator('#coastal-runtime-audit canvas').screenshot({ path: output + '/theatre-day.png' });
  });
  await check('camera and lighting changes retain the deliberate pause', async () => {
    await page.evaluate(() => { window.coastalAuditRuntime.setLighting('dusk'); window.coastalAuditRuntime.setPreset('route'); });
    await rest();
    const before = await state();
    assert.equal(before.scenePreset, 'route');
    assert.equal(before.sceneLighting, 'dusk');
    assert.equal(before.animationRequested, 'false');
    await page.waitForTimeout(400);
    assert.equal((await state()).renderCount, before.renderCount);
    await page.locator('#coastal-runtime-audit canvas').screenshot({ path: output + '/route-dusk.png' });
  });
  await check('enabled sea motion suspends when its view leaves the viewport', async () => {
    await page.evaluate(() => window.coastalAuditRuntime.setAnimation(true));
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.sceneAnimating === 'true');
    await page.evaluate(() => { document.querySelector('#coastal-runtime-audit').style.top = '-2000px'; });
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.scenePaused === 'true');
    const before = (await state()).renderCount;
    await page.waitForTimeout(350);
    assert.equal((await state()).renderCount, before);
    await page.evaluate(() => { document.querySelector('#coastal-runtime-audit').style.top = '0'; });
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.sceneAnimating === 'true');
  });
  await check('a paused view does not restart animation after returning to the viewport', async () => {
    await page.evaluate(() => window.coastalAuditRuntime.setAnimation(false));
    await rest();
    await page.evaluate(() => { document.querySelector('#coastal-runtime-audit').style.top = '-2000px'; });
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.scenePaused === 'true');
    await page.evaluate(() => { document.querySelector('#coastal-runtime-audit').style.top = '0'; });
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.scenePaused === 'false');
    await rest();
    const before = (await state()).renderCount;
    await page.waitForTimeout(350);
    assert.equal((await state()).sceneAnimating, 'false');
    assert.equal((await state()).renderCount, before);
  });
  await check('reduced motion stops the sea and preserves manual pause on preference changes', async () => {
    await page.evaluate(() => {
      window.coastalAuditRuntime.setAnimation(true);
      window.coastalAuditRuntime.update({ ...window.coastalAuditSnapshot, reducedMotion: true });
    });
    await rest();
    const before = (await state()).renderCount;
    await page.waitForTimeout(400);
    assert.equal((await state()).sceneAnimating, 'false');
    assert.equal((await state()).renderCount, before);
    await page.evaluate(() => { window.coastalAuditRuntime.setAnimation(false); window.coastalAuditRuntime.update(window.coastalAuditSnapshot); });
    await rest();
    assert.equal((await state()).sceneAnimating, 'false');
  });
  await check('context loss releases the owned canvas and reports the existing fallback', async () => {
    await page.locator('#coastal-runtime-audit canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await page.waitForFunction(() => document.querySelector('#coastal-runtime-audit')?.dataset.activeRenderer === '0');
    assert.equal(await page.locator('#coastal-runtime-audit canvas').count(), 0);
    assert.match((await state()).failure, /二维地图/);
    await page.evaluate(() => window.coastalAuditRuntime.dispose());
  });
  await check('no unhandled or shader errors occurred', async () => assert.deepEqual(errors, []));
} finally {
  await page.evaluate(() => window.coastalAuditRuntime?.dispose()).catch(() => {});
  await context.close();
}
await writeFile(output + '/results.json', JSON.stringify({ environment: 'Edge SwiftShader, local Vite scene modules', stats, records, errors }, null, 2));
console.log(JSON.stringify({ stats, records, errors }, null, 2));
if (records.some(record => !record.pass)) process.exitCode = 1;
