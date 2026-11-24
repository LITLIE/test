import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject } from '../helpers/browser-runtime.mjs';

const directory = insideProject('.agent_tmp/coastal-runtime');
await mkdir(directory, { recursive: true });
const context = await createBrowserContext('cinematic-controlled-pause', {
  viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const records = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const check = async (name, action) => {
  try { await action(); records.push({ name, pass: true }); }
  catch (error) { records.push({ name, pass: false, error: error.message }); }
};
const data = () => page.locator('.immersive-live .city-sandbox__canvas').evaluate(host => ({ ...host.dataset }));
const ready = () => page.waitForFunction(() => document.querySelector('.immersive-live .city-sandbox__canvas')?.dataset.sceneResourcesReady === 'true');
try {
  await page.goto((process.env.RENDER_URL || 'http://127.0.0.1:5173') + '/product/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.immersive-stage').scrollIntoViewIfNeeded();
  await ready();
  await check('the real showcase sea-motion control updates the owning parent', async () => {
    await page.getByRole('button', { name: '暂停海面', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.immersive-live .city-sandbox__canvas')?.dataset.animationRequested === 'false');
    // Initial font/layout and IntersectionObserver updates may request one final demand frame.
    await page.waitForTimeout(1000);
    const before = await data();
    assert.equal(before.sceneAnimating, 'false');
    await page.waitForTimeout(450);
    assert.equal((await data()).renderCount, before.renderCount);
    assert.equal(await page.getByRole('button', { name: '开启海面动效', exact: true }).getAttribute('aria-pressed'), 'false');
  });
  await check('the paused sea remains paused when the showcase unmounts and remounts offscreen', async () => {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => !document.querySelector('.immersive-live canvas'));
    await page.locator('.immersive-stage').scrollIntoViewIfNeeded();
    await ready();
    await page.waitForTimeout(250);
    assert.equal((await data()).animationRequested, 'false');
    const before = (await data()).renderCount;
    await page.waitForTimeout(450);
    assert.equal((await data()).renderCount, before);
    assert.equal((await data()).sceneAnimating, 'false');
  });
  await check('changing the real showcase camera retains the user pause', async () => {
    await page.getByRole('group', { name: '选择城市展台视角' }).getByRole('button').nth(1).click();
    await page.waitForFunction(() => document.querySelector('.immersive-live .city-sandbox__canvas')?.dataset.scenePreset === 'theatre');
    await page.waitForTimeout(250);
    assert.equal((await data()).animationRequested, 'false');
    const before = (await data()).renderCount;
    await page.waitForTimeout(450);
    assert.equal((await data()).renderCount, before);
  });
  await check('no unhandled browser errors occurred', async () => assert.deepEqual(errors, []));
} finally { await context.close(); }
await writeFile(directory + '/controlled-pause-results.json', JSON.stringify({ environment: 'Real Product showcase in Edge SwiftShader, no reduced motion', records, errors }, null, 2));
console.log(JSON.stringify({ records, errors }, null, 2));
if (records.some(record => !record.pass)) process.exitCode = 1;
