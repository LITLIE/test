import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';
import { siteConfig } from '../../site.config.mjs';
const records = [];
const paths = ['/', '/product/', '/experience/', '/cooperation/', '/about/'];
async function check(name, run) {
  try { await run(); records.push({ name, pass: true }); }
  catch (error) { records.push({ name, pass: false, error: error.message }); }
}
await check('all five routes have their own pre-rendered body and canonical', async () => {
  for (const route of paths) {
    const html = await readFile(insideProject('dist/' + (route === '/' ? '' : route.slice(1)) + 'index.html'), 'utf8');
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, route);
    assert.ok(html.includes('<main'), route);
    assert.ok(html.includes('rel="canonical"'), route);
    const response = await fetch(testBase + route);
    assert.equal(response.status, 200, route);
  }
});
await check('public catalog has only attributed reference points and unknown operational facts', async () => {
  const response = await fetch(testBase + '/data/catalog.json');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.places.length, 10);
  for (const place of data.places) {
    assert.equal(place.coordinateSystem, 'WGS84');
    assert.equal(place.entranceVerified, false);
    for (const field of ['fee', 'opening', 'accessibility']) assert.equal(place[field].value, null);
    assert.ok(data.sources.some(source => source.id === place.coordinates.sourceId && source.url.startsWith('https://www.openstreetmap.org/')));
  }
});
await check('404 is a real missing-route response with noindex', async () => {
  const response = await fetch(testBase + '/a-route-that-does-not-exist/');
  assert.equal(response.status, 404);
  assert.match(await response.text(), /name="robots" content="noindex"/);
});
await check('sitemap includes the independent experience route and correct base', async () => {
  const xml = await readFile(insideProject('dist/sitemap.xml'), 'utf8');
  assert.match(xml, /\/experience\//);
  const url = new URL(siteConfig.url);
  assert.ok(xml.includes(url.host));
});
const nojs = await createBrowserContext('static-nojs-v2', { javaScriptEnabled: false });
try {
  const page = await nojs.newPage();
  await check('all five pages remain readable and navigable without JavaScript', async () => {
    for (const route of paths) {
      await page.goto(testBase + route);
      assert.equal(await page.locator('h1').count(), 1, route);
      assert.ok((await page.locator('main').innerText()).length > 300, route);
      assert.ok(await page.locator('.site-footer a').count() >= 5, route);
      assert.equal(await page.locator('canvas').count(), 0, route);
    }
  });
} finally { await nojs.close(); }
await mkdir(insideProject('delivery/experience'), { recursive: true });
await writeFile(insideProject('delivery/experience/static-results.json'), JSON.stringify({ records, passed: records.filter(item => item.pass).length, total: records.length }, null, 2));
console.log(JSON.stringify(records, null, 2));
process.exitCode = records.some(item => !item.pass) ? 1 : 0;
