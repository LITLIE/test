import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createBrowserContext, insideProject, testBase } from '../tests/helpers/browser-runtime.mjs';

const baseline = process.argv.includes('--baseline');
const output = insideProject(process.env.CINEMATIC_CAPTURE_OUTDIR || `delivery/cinematic-refresh/${baseline ? 'baseline' : 'final'}/layouts`);
await mkdir(output, { recursive: true });
const records = [];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow', width: 320, height: 740 },
  { name: 'zoom-css-equivalent', width: 720, height: 500 },
  { name: 'landscape', width: 844, height: 390 },
];
for (const viewport of viewports) {
  const context = await createBrowserContext(`cinematic-${baseline ? 'baseline' : 'final'}-${viewport.name}`, { viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(testBase + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output + `/${viewport.name}-city.png` });
    for (const [name, selector] of [['route', '[data-story-panel="route"],.route-story'], ['theatre', '[data-story-panel="theatre"]'], ['product', '[data-story-panel="product"],.experience-preview'], ['journey', '#journey']]) {
      const section = page.locator(selector).first();
      if (!await section.count()) continue;
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + `/${viewport.name}-${name}.png` });
      if (!baseline && name !== 'journey') await section.screenshot({ path: output + `/${viewport.name}-${name}-composition.png` });
    }
    await page.goto(testBase + '/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: output + `/${viewport.name}-home-full.png`, fullPage: true });
    const layout = await page.evaluate(() => ({ viewportWidth: innerWidth, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, h1Count: document.querySelectorAll('h1').length, userAgent: navigator.userAgent, dpr: devicePixelRatio }));
    records.push({ name: viewport.name, viewport: { width: viewport.width, height: viewport.height }, ...layout, actualBrowserZoom: false, note: viewport.name === 'zoom-css-equivalent' ? 'Equivalent CSS viewport only; not an actual browser 200% zoom test.' : 'Desktop Edge viewport simulation; not a real phone.' });
    if (!baseline && ['desktop', 'mobile'].includes(viewport.name)) {
      for (const route of ['product', 'about', 'cooperation', 'experience']) {
        await page.goto(testBase + `/${route}/`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: output + `/${viewport.name}-${route}-page.png`, fullPage: true });
      }
    }
  } finally { await context.close(); }
}
const html = await readFile(insideProject('dist/index.html'));
await writeFile(output + '/records.json', JSON.stringify({ capturedAt: new Date().toISOString(), mode: baseline ? 'baseline' : 'final', homeDocumentSha256: createHash('sha256').update(html).digest('hex'), records }, null, 2));
console.log(JSON.stringify(records, null, 2));
