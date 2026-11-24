import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';
const evidence = insideProject('delivery/experience');
await mkdir(evidence, { recursive: true });
const context = await createBrowserContext('workbench-regressions');
const page = await context.newPage();
page.setDefaultTimeout(5000);
const records = [];
async function check(name, action) {
  try { await action(); records.push({ name, pass: true }); }
  catch (error) { records.push({ name, pass: false, error: error.message }); }
}
async function start(width = 1440, motion = 'reduce') {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(testBase + '/experience/', { waitUntil: 'networkidle' });
}
async function generate() {
  await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
  await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
  await page.locator('[data-proposal]').waitFor();
}
try {
  await check('confirming an unchanged draft preserves an adoptable candidate', async () => {
    await start(); await generate();
    const snapshot = await page.locator('[data-timeline]').innerText();
    await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '采用这份候选', exact: true }).isDisabled(), false);
    assert.equal(await page.locator('[data-timeline]').innerText(), snapshot);
  });
  await check('editing an unresolved idea cannot bypass its clarification gate', async () => {
    await start(); await generate();
    await page.getByLabel('说说你的想法', { exact: true }).fill('全程无障碍');
    await page.getByRole('button', { name: '应用这段想法', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '采用这份候选', exact: true }).isDisabled(), true);
    await page.getByLabel('说说你的想法', { exact: true }).fill('全程无障碍！');
    assert.equal(await page.getByRole('button', { name: '采用这份候选', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '核对并确认条件', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '只按表单条件继续', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '采用这份候选', exact: true }).isDisabled(), false);
  });
  await check('a ready candidate can be discarded before undoing the current adoption', async () => {
    await start(); await generate();
    await page.getByRole('button', { name: '采用这份候选', exact: true }).click();
    const firstRoute = await page.locator('[data-active-route]').innerText();
    await page.getByLabel('可用时间', { exact: true }).selectOption('120'); await generate();
    await page.getByRole('button', { name: '采用这份候选', exact: true }).click();
    await generate();
    assert.equal(await page.getByRole('button', { name: '放弃这份候选', exact: true }).count(), 1);
    await page.getByRole('button', { name: '放弃这份候选', exact: true }).click();
    assert.equal(await page.locator('[data-proposal]').count(), 0);
    await page.getByRole('button', { name: /^撤销本次采用/ }).click();
    assert.equal(await page.locator('[data-active-route]').innerText(), firstRoute);
    assert.match(await page.locator('[data-active-plan]').innerText(), /V3/);
  });
  await check('mobile time conflicts display their detailed cause and focus the recovery panel', async () => {
    await start(390); await page.locator('[data-task="short"]').click();
    await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
    await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
    await page.locator('[data-conflict]').waitFor();
    assert.equal(await page.locator('[data-conditions-panel]').isVisible(), true);
    assert.match(await page.locator('[data-conflict]').innerText(), /超过 120 分钟上限/);
    assert.equal(await page.locator('[data-conflict]').evaluate(element => element === document.activeElement), true);
  });
  await check('returning from an empty mobile plan focuses the now visible idea input', async () => {
    await start(390); await page.getByRole('button', { name: '路线', exact: true }).click();
    await page.getByRole('button', { name: /^回到条件/ }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'experience-idea');
  });
  await check('manual map controls immediately pause timed playback', async () => {
    await start(1440, 'no-preference'); await generate();
    await page.getByRole('button', { name: '预演路线', exact: true }).click();
    await page.getByRole('button', { name: '放大二维地图', exact: true }).click();
    assert.match(await page.locator('[data-playback-status]').innerText(), /已暂停/);
    const paused = await page.locator('[data-playback-status]').innerText();
    await page.waitForTimeout(2700);
    assert.equal(await page.locator('[data-playback-status]').innerText(), paused);
  });
  await check('a Chinese half-hour expression remains editable as a custom form duration', async () => {
    await start();
    await page.getByLabel('说说你的想法', { exact: true }).fill('有一个半小时，想去日月贝');
    await page.getByRole('button', { name: '应用这段想法', exact: true }).click();
    assert.equal(await page.getByLabel('可用时间', { exact: true }).inputValue(), '90');
    await page.getByLabel('说说你的想法', { exact: true }).fill('75分钟，想去海滨公园');
    await page.getByRole('button', { name: '应用这段想法', exact: true }).click();
    assert.equal(await page.getByLabel('可用时间', { exact: true }).inputValue(), '75');
    assert.match(await page.getByLabel('可用时间', { exact: true }).innerText(), /自定义时长/);
  });
} finally { await context.close(); }
await writeFile(evidence + '/workbench-regressions.json', JSON.stringify({ records, passed: records.filter(item => item.pass).length, total: records.length }, null, 2));
console.log(JSON.stringify(records, null, 2));
process.exitCode = records.some(item => !item.pass) ? 1 : 0;
