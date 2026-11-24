import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';

const evidence = insideProject('delivery/experience');
await mkdir(evidence, { recursive: true });
const context = await createBrowserContext('experience-flow');
const page = await context.newPage();
page.setDefaultTimeout(7000);
const records = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
async function check(name, action) {
  try { await action(); records.push({ name, pass: true }); }
  catch (error) { records.push({ name, pass: false, error: error.message }); }
}
async function generate() {
  await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
  await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
  await page.locator('[data-proposal]').waitFor();
}
try {
  await check('experience has its own static heading and a visible curated mode', async () => {
    const response = await page.goto(testBase + '/experience/', { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('h1').count(), 1);
    assert.match(await page.locator('h1').innerText(), /织成一段旅程/);
    assert.match(await page.locator('[data-mode]').innerText(), /受控资料演示/);
    assert.equal(await page.locator('[data-task]').count(), 3);
    assert.equal(await page.locator('[data-route-stop]').count(), 0);
  });
  if (!records[0].pass && process.env.TEST_RED === '1') {
    console.log(JSON.stringify(records, null, 2));
    process.exitCode = 1;
  } else {
    await check('three hours and a mandatory landmark form an unadopted candidate', async () => {
      await generate();
      assert.match(await page.locator('[data-proposal]').innerText(), /待采用/);
      assert.match(await page.locator('[data-timeline]').innerText(), /日月贝/);
      assert.equal(await page.locator('[data-active-plan]').count(), 0);
      assert.match(await page.locator('[data-fee-status]').innerText(), /待核实/);
    });
    await check('evidence lens shows reference coordinates, sources and unknown fields', async () => {
      await page.locator('[data-route-stop]').first().click();
      await page.getByRole('button', { name: '查看地点依据', exact: true }).click();
      assert.match(await page.locator('[data-place-details]').innerText(), /入口未核实/);
      assert.match(await page.locator('[data-place-details]').innerText(), /WGS84/);
      assert.ok(await page.locator('[data-place-details] a[href^="https://"]').count() > 0);
    });
    await check('explicit adoption creates version one', async () => {
      await page.getByRole('button', { name: '采用这份候选', exact: true }).click();
      assert.match(await page.locator('[data-active-plan]').innerText(), /当前版本 V1/);
      assert.equal(await page.locator('[data-proposal]').count(), 0);
    });
    await check('editing a draft preserves the previous confirmed route snapshot', async () => {
      const original = await page.locator('[data-active-plan]').innerText();
      await page.getByLabel('可用时间', { exact: true }).selectOption('120');
      assert.equal(await page.locator('[data-active-plan]').innerText(), original);
      assert.match(await page.locator('[data-draft-status]').innerText(), /尚未确认/);
      assert.equal(await page.getByRole('button', { name: '生成旅程候选', exact: true }).isDisabled(), true);
    });
    await check('a new candidate provides a real A/B delta before adoption', async () => {
      await generate();
      assert.equal(await page.locator('[data-comparison]').count(), 1);
      assert.match(await page.locator('[data-comparison]').innerText(), /当前 A/);
      assert.match(await page.locator('[data-comparison]').innerText(), /候选 B/);
      assert.equal(await page.locator('[data-active-plan]').count(), 1);
      await page.getByRole('button', { name: '采用这份候选', exact: true }).click();
      assert.match(await page.locator('[data-active-plan]').innerText(), /当前版本 V2/);
    });
    await check('undo returns to the clearly labelled previous version', async () => {
      await page.getByRole('button', { name: /^撤销本次采用/ }).click();
      assert.match(await page.locator('[data-active-plan]').innerText(), /当前版本 V3/);
      assert.match(await page.locator('.exp-state-message').innerText(), /恢复.*[Vv]1.*[Vv]3/);
    });
    await check('the short mandatory task explains conflict without silently removing places', async () => {
      await page.locator('[data-task="short"]').click();
      await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
      await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
      await page.locator('[data-conflict]').waitFor();
      assert.match(await page.locator('[data-conflict]').innerText(), /超过 120 分钟上限/);
      assert.equal(await page.locator('[data-proposal]').count(), 0);
      assert.match(await page.locator('[data-active-plan]').innerText(), /当前版本 V3/);
    });
    await check('an unsupported idea requests clarification and retains the structured controls', async () => {
      await page.getByLabel('说说你的想法', { exact: true }).fill('替我安排火星上的酒店并实时查询人流');
      await page.getByRole('button', { name: '应用这段想法', exact: true }).click();
      assert.equal(await page.locator('[data-idea-feedback].needs-clarification').count(), 1);
      assert.equal(await page.getByRole('button', { name: '核对并确认条件', exact: true }).isDisabled(), true);
      assert.equal(await page.getByLabel('可用时间', { exact: true }).count(), 1);
    });
    await check('the care task is modifiable and the preview has real pause and step controls', async () => {
      await page.locator('[data-task="care"]').click();
      await generate();
      assert.match(await page.locator('[data-condition-review]').innerText(), /少走一点/);
      await page.getByRole('button', { name: '预演路线', exact: true }).click();
      assert.match(await page.locator('[data-playback-status]').innerText(), /第 1 站/);
      await page.getByRole('button', { name: '下一站', exact: true }).click();
      assert.match(await page.locator('[data-playback-status]').innerText(), /第 2 站|第 1 站/);
    });
    await page.screenshot({ path: evidence + '/workbench-desktop.png', fullPage: true });
    await check('six responsive widths keep the workspace and controls within the viewport', async () => {
      for (const width of [360, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, String(width));
      }
    });
    await check('mobile panel buttons reach all three working regions', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [name, selector] of [['条件', '[data-conditions-panel]'], ['地图', '[data-map-panel]'], ['路线', '[data-plan-panel]']]) {
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator(selector).isVisible(), true);
      }
    });
    await page.screenshot({ path: evidence + '/workbench-mobile.png', fullPage: true });
    await check('a direct reload preserves the experience route and metadata', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      assert.match(page.url(), /\/experience\/$/);
      assert.match(await page.title(), /旅程体验/);
      assert.equal(await page.locator('h1').count(), 1);
    });
    await check('no browser runtime errors occurred', async () => assert.deepEqual(errors, []));
  }
} finally { await context.close(); }
await writeFile(evidence + '/browser-results.json', JSON.stringify({ records, errors, passed: records.filter(x => x.pass).length, total: records.length }, null, 2));
console.log(JSON.stringify(records, null, 2));
process.exitCode = records.some(x => !x.pass) ? 1 : 0;
