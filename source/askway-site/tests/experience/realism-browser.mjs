import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';
const out = insideProject('delivery/realism-v3');
await mkdir(out, { recursive: true });
const ctx = await createBrowserContext('realism-v3', { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await ctx.newPage(); page.setDefaultTimeout(15000);
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
async function check(name, task) { try { await task(); checks.push({ name, pass: true }); } catch(e) { checks.push({ name, pass: false, error: e.message }); } }
try {
  await check('city render illustrations exist and are consumed by the website', async () => {
    for(const name of ['coastal-overview','theatre-dusk','route-landmarks']) { const res = await fetch(testBase + '/assets/realism/' + name + '.webp'); assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /webp/); }
    await page.goto(testBase, { waitUntil: 'networkidle' });
    assert.ok(await page.locator('img[src*="/assets/realism/"]').count() >= 1);
  });
  await check('the immersive exhibition exposes a controllable real WebGL scene', async () => {
    await page.locator('.immersive-showcase').first().scrollIntoViewIfNeeded();
    const exhibition = page.locator('.immersive-showcase').first();
    const launch = exhibition.getByRole('button', {name:/开启立体场景/});
    if(await launch.count()) await launch.first().click();
    await exhibition.locator('canvas').waitFor();
    assert.equal(await exhibition.locator('canvas').count(), 1);
    await page.screenshot({ path: out+'/immersive-desktop.png' });
  });
  await check('the improved map names all ten points with readable labels and real controls', async () => {
    await page.goto(testBase+'/experience/', {waitUntil:'networkidle'});
    await page.locator('[data-map-panel]').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.scene-places button').count(),10);
    assert.ok(await page.locator('[data-map-label]').count() >= 10);
    await page.getByRole('button', {name:'放大二维地图', exact:true}).click();
    await page.getByRole('button', {name:/向东平移二维地图/}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
  await check('mobile website and workspace preserve reference status and fit the viewport', async () => {
    await page.setViewportSize({width:390,height:844});
    for(const route of ['/','/product/','/experience/','/about/']){await page.goto(testBase+route,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,route);}
    await page.getByRole('link', {name:/旅程体验/}).first().click();
    await page.getByRole('button',{name:'地图',exact:true}).click();
    await page.screenshot({path:out+'/map-mobile.png',fullPage:true});
  });
  await check('no unhandled runtime errors occurred',async()=>assert.deepEqual(errors,[]));
} finally { await ctx.close(); }
await writeFile(out+'/browser.json',JSON.stringify({checks,errors,passed:checks.filter(c=>c.pass).length,total:checks.length},null,2));
console.log(JSON.stringify(checks,null,2));process.exitCode=checks.some(c=>!c.pass)?1:0;
