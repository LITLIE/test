import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject } from '../tests/helpers/browser-runtime.mjs';

const base = process.env.RENDER_URL || 'http://127.0.0.1:5173';
const output = insideProject('.agent_tmp/realism-renders');
await mkdir(output, { recursive: true });
const context = await createBrowserContext('realism-illustrations', { viewport: { width: 1920, height: 1080 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await context.newPage();
const records = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 2500)); });
try {
  await page.goto(base + '/experience/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [{ catalog }, { makeDefaultDraft }, { proposeCuratedPlan }, { buildSceneLayout }, { visibleScenePoints }, { createCityRuntime }] = await Promise.all([
      import('/src/features/experience/data/catalog.ts'), import('/src/features/experience/config.ts'),
      import('/src/features/experience/domain/curated-planner.ts'), import('/src/features/experience/map/projection.ts'),
      import('/src/features/experience/scene/SceneText.tsx'), import('/src/features/experience/scene/cityRuntime.ts'),
    ]);
    const result = proposeCuratedPlan(catalog, makeDefaultDraft(), null, { requestId: 'illustration', sessionEpoch: 0, draftRevision: 0, nowMs: 0 });
    const plan = result.kind === 'proposal' ? result.proposal.candidate : null;
    const layout = buildSceneLayout(catalog, plan, null);
    const host = document.createElement('div');
    host.id = 'render-studio'; host.style.cssText = 'position:fixed;inset:0;z-index:999999;width:100vw;height:100vh;overflow:hidden';
    document.body.append(host);
    window.cityIllustrationRuntime = createCityRuntime(host, { layout, visiblePoints: visibleScenePoints(layout, true, 'ZS-004'), selectedPlaceId: 'ZS-004', playbackPlaceId: null, reducedMotion: true, preset: 'overview', lighting: 'day', presentation: 'cinematic' }, { onPick() {}, onFailure(message) { host.dataset.captureError = message; }, onReady() {}, onViewChange() {} });
  });
  await page.waitForFunction(() => document.querySelector('#render-studio')?.dataset.sceneReady === 'true' || document.querySelector('#render-studio')?.dataset.captureError, null, { timeout: 20000 }).catch(async error => { console.log(JSON.stringify({error:error.message,errors,host:await page.locator('#render-studio').evaluate(element=>({...element.dataset,rect:element.getBoundingClientRect().toJSON(),visibility:document.visibilityState}))}));throw error; });
  const captureError = await page.locator('#render-studio').getAttribute('data-capture-error');
  if (captureError) { console.log(JSON.stringify({captureError,errors})); throw new Error(captureError); }
  await page.waitForFunction(() => document.querySelector('#render-studio')?.dataset.sceneResourcesReady === 'true', null, { timeout: 60000 });
  const shots = [
    { name: 'coastal-overview', preset: 'overview', mood: 'day' },
    { name: 'theatre-dusk', preset: 'theatre', mood: 'dusk' },
    { name: 'route-landmarks', preset: 'route', mood: 'day' },
  ];
  for (const shot of shots) {
    await page.evaluate(shot => {
      window.cityIllustrationRuntime.setAnimation(false);
      window.cityIllustrationRuntime.setLighting(shot.mood);
      window.cityIllustrationRuntime.setPreset(shot.preset);
    }, shot);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator('#render-studio canvas').screenshot({ path: output + '/' + shot.name + '.png' });
    records.push({ ...shot, width: 1920, height: 1080, source: 'Original Three.js render, same public reference catalogue; not a location photograph.', stats: await page.locator('#render-studio').evaluate(element => ({ ...element.dataset })) });
  }
} finally {
  await page.evaluate(() => window.cityIllustrationRuntime?.dispose()).catch(() => {});
  await context.close();
}
await writeFile(output + '/renders.json', JSON.stringify({ records, errors }, null, 2));
console.log(JSON.stringify({ records, errors }, null, 2));
if (errors.length) process.exitCode = 1;
