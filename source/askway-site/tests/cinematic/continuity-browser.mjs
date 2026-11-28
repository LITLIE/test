import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { captureBrowserBuild, createBrowserContext, insideProject, testBase } from '../helpers/browser-runtime.mjs';

const base = (process.env.CINEMATIC_TEST_URL || testBase).replace(/\/$/, '');
const output = insideProject('delivery/motion-continuity/final/browser');
const checks = [], errors = [], records = {};
const input = 'Playwright mouse.wheel events delivered to a real browser page; these are not physical hardware input';
const check = async (name, action) => {
  try { await action(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, error: error.message }); }
};
const build = await captureBrowserBuild(base);
for (const path of ['src/motion/seaRouteMath.ts', 'src/features/cinematic/storyConfig.ts']) {
  build.hashes[path] = createHash('sha256').update(await readFile(insideProject(path))).digest('hex');
}

async function snapshot(page) {
  return page.locator('.cinematic-story').evaluate(root => {
    const view = root.querySelector('.story-viewport'), bounds = root.getBoundingClientRect();
    const travel = bounds.height - view.getBoundingClientRect().height;
    return { scroll: scrollY, height: bounds.height, travel, screens: travel / innerHeight,
      value: Number(root.dataset.storyProgress), target: Number(root.dataset.storyTargetProgress),
      activeTime: Number(root.dataset.storyActiveTime), draws: Number(root.dataset.storyDrawCount),
      phase: root.dataset.storyPhase, layout: root.dataset.storyLayout };
  });
}

// Deterministic inspection positions use native scrollTo; input-speed checks below use mouse.wheel.
async function point(page, progress) {
  await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyLayout === 'sticky');
  await page.evaluate(p => {
    const root = document.querySelector('.cinematic-story'), view = root.querySelector('.story-viewport');
    const rect = root.getBoundingClientRect();
    scrollTo({ top: rect.top + scrollY + (rect.height - view.getBoundingClientRect().height) * p, behavior: 'instant' });
  }, progress);
  await page.waitForFunction(p => {
    const root = document.querySelector('.cinematic-story');
    return Math.abs(Number(root.dataset.storyProgress) - p) <= .00015
      && Math.abs(Number(root.dataset.storyTargetProgress) - p) <= .00015;
  }, progress);
}

async function beginRecording(page, duration = 1600) {
  await page.evaluate(duration => {
    const root = document.querySelector('.cinematic-story'), view = root.querySelector('.story-viewport');
    const rect = root.getBoundingClientRect(), start = rect.top + scrollY;
    const travel = rect.height - view.getBoundingClientRect().height, began = performance.now();
    window.__motionContractRecording = new Promise(resolve => {
      const rows = [];
      const frame = at => {
        rows.push({ at, elapsed: at - began, scroll: scrollY,
          native: Math.max(0, Math.min(1, (scrollY - start) / travel)),
          target: Number(root.dataset.storyTargetProgress), value: Number(root.dataset.storyProgress),
          activeTime: Number(root.dataset.storyActiveTime), draws: Number(root.dataset.storyDrawCount) });
        if (at - began < duration) requestAnimationFrame(frame); else resolve(rows);
      };
      requestAnimationFrame(frame);
    });
  }, duration);
}
const finishRecording = page => page.evaluate(() => window.__motionContractRecording);
const converged = rows => assert.ok(Math.abs(rows.at(-1).value - rows.at(-1).native) <= .0002,
  'The rendered camera must settle on the final native position');

async function handoff(page) {
  return page.locator('.story-viewport').evaluate(view => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    const visible = selector => {
      const node = view.querySelector(selector); let opacity = 1;
      for (let item = node; item; item = item.parentElement) {
        const css = getComputedStyle(item); opacity *= Number(css.opacity);
        if (css.display === 'none' || css.visibility === 'hidden') opacity = 0;
      }
      return { opacity, inert: Boolean(node.closest('[inert]')) };
    };
    const media = view.querySelector('.story-theatre-media'), bounds = rect(media);
    const clip = getComputedStyle(media).clipPath;
    const match = clip.match(/^inset\((.*)\)$/);
    if (!match) throw new Error('The photograph must expose a resolved inset clip: ' + clip);
    let tokens = match[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
    if (tokens.length === 1) tokens = [tokens[0], tokens[0], tokens[0], tokens[0]];
    if (tokens.length === 2) tokens = [tokens[0], tokens[1], tokens[0], tokens[1]];
    if (tokens.length === 3) tokens.push(tokens[1]);
    if (tokens.length !== 4 || tokens.some(token => !/^-?[\d.]+(?:px|%)?$/.test(token))) throw new Error('Unresolved clip: ' + clip);
    const inset = tokens.map((token, i) => parseFloat(token) * (token.endsWith('%') ? (i % 2 ? bounds.width : bounds.height) / 100 : 1));
    return { progress: Number(view.closest('.cinematic-story').dataset.storyProgress), clip,
      clipRect: { top: bounds.top + inset[0], right: bounds.right - inset[1], bottom: bounds.bottom - inset[2], left: bounds.left + inset[3] },
      mapRect: rect(view.querySelector('.journey-preview__map')), near: visible('.story-theatre-copy'),
      map: visible('.journey-preview__map'), card: visible('.story-product-preview'), copy: visible('.story-product-copy') };
  });
}

const context = await createBrowserContext('motion-contract-main', { reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.removeItem('askway.presentation.paused'));
  await page.reload({ waitUntil: 'networkidle' });

  await check('desktop chapters have at least three and a half screens of camera travel', async () => {
    await point(page, .36);
    records.geometry = await snapshot(page);
    assert.ok(records.geometry.screens >= 3.5, 'The complete story needs enough scroll space to breathe');
  });

  await check('a single wheel event produces intermediate frames and settles without overshoot', async () => {
    await point(page, .36); const before = await snapshot(page);
    await page.mouse.move(720, 500); await beginRecording(page);
    await page.mouse.wheel(0, 120);
    const rows = records.wheel = await finishRecording(page);
    assert.ok(rows.some(row => row.native > before.value + .001 && row.value > before.value + .0001 && row.value < row.target - .0003),
      'Native scrolling must move first while the rendered camera follows through visible intermediate frames');
    let previous = before.value;
    for (const row of rows) {
      assert.ok(row.value >= previous - .00015 && row.value <= row.native + .00015, 'Forward tracking must be monotone and bounded');
      previous = row.value;
    }
    converged(rows);
  });

  await check('a rapid reverse wheel event follows the latest destination immediately', async () => {
    await point(page, .36); await beginRecording(page);
    await page.mouse.wheel(0, 720);
    await page.waitForFunction(() => {
      const root = document.querySelector('.cinematic-story'), value = Number(root.dataset.storyProgress);
      return value > .368 && value < Number(root.dataset.storyTargetProgress) - .003;
    });
    const issuedAt = await page.evaluate(() => performance.now());
    await page.mouse.wheel(0, -960);
    const rows = records.reverse = await finishRecording(page);
    const first = rows.findIndex(row => row.at >= issuedAt && row.target < row.value - .0003 && Math.abs(row.target - row.native) <= .00015);
    assert.ok(first >= 0, 'The reverse input must interrupt a genuine unfinished forward move');
    let previous = rows[first].value;
    for (const row of rows.slice(first + 1)) {
      assert.ok(row.value <= previous + .00015 && row.value >= row.native - .00015, 'Reverse tracking must not drift toward the obsolete target or overshoot');
      previous = row.value;
    }
    records.reverseIssuedAt = issuedAt; converged(rows);
  });

  await check('the chapter bar keeps a continuous background when the active chapter changes', async () => {
    records.navigation = [];
    for (const boundary of [.24, .56, .9]) {
      const pair = [];
      for (const p of [boundary - .0005, boundary + .0005]) {
        await point(page, p);
        pair.push(await page.locator('.story-chapter-nav').evaluate(nav => ({
          progress: Number(nav.closest('.cinematic-story').dataset.storyProgress),
          background: getComputedStyle(nav).backgroundColor, image: getComputedStyle(nav).backgroundImage,
        })));
      }
      records.navigation.push({ boundary, pair });
      const channels = pair.map(item => item.background.match(/[\d.]+/g).map(Number));
      assert.ok(channels[0].every((channel, i) => Math.abs(channel - channels[1][i]) <= (i === 3 ? .02 : 4)),
        'The bar background must not flip between dark and paper at a phase threshold');
      assert.equal(pair[0].image, pair[1].image, 'A chapter switch must not replace the background image');
    }
  });

  await check('photographs use real CSS depth and the spatial canvas paints within its clock budget', async () => {
    await point(page, .66);
    await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyNearReady === 'true');
    records.depth = await page.locator('.story-theatre-photo').evaluate(photo => ({
      perspective: getComputedStyle(photo.parentElement).perspective, transform: getComputedStyle(photo).transform,
      is2D: new DOMMatrixReadOnly(getComputedStyle(photo).transform).is2D,
    }));
    assert.ok(parseFloat(records.depth.perspective) > 0 && !records.depth.is2D, 'Visible photography needs an actual perspective and 3D transform');
    await point(page, .1);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
    records.canvas = await page.locator('.sea-route-particles').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonempty = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) nonempty++;
      return { space: canvas.dataset.particleSpace, nonempty, width: canvas.width, height: canvas.height };
    });
    assert.equal(records.canvas.space, 'perspective-3d'); assert.ok(records.canvas.nonempty > 40, 'Depth particles must paint real nontransparent pixels');
    await beginRecording(page, 900); const rows = records.clockBudget = await finishRecording(page);
    const draws = rows.at(-1).draws - rows[0].draws, active = rows.at(-1).activeTime - rows[0].activeTime;
    assert.ok(draws > 0 && active > 0, 'The active sea must visibly advance');
    assert.ok(draws <= Math.ceil(active * 60 / 1000) + 2, 'Clock-only particle drawing must stay at or below 60Hz');
  });

  await check('the photograph docks before the map and readable product controls enter', async () => {
    records.handoff = [];
    for (const p of [.78, .94, .955, .985]) { await point(page, p); records.handoff.push(await handoff(page)); }
    const [exit, docked, mapEntry, stable] = records.handoff;
    assert.ok(exit.near.opacity <= .001 && exit.near.inert, 'Near copy must exit before the photograph shrinks');
    for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(Math.abs(docked.clipRect[side] - docked.mapRect[side]) <= 2, `The docked ${side} photo edge must meet the real map frame within 2px`);
    assert.ok(mapEntry.map.opacity > .01 && mapEntry.copy.opacity <= .001 && mapEntry.copy.inert, 'The map must appear before product copy');
    assert.ok(stable.card.opacity >= .99 && stable.map.opacity >= .99 && stable.copy.opacity >= .99 && !stable.copy.inert, 'The product anchor must show the complete card, map and readable copy');
    const cta = page.locator('.story-product-actions').getByRole('link', { name: '开始旅程体验', exact: true });
    await cta.focus(); assert.equal(await cta.evaluate(node => document.activeElement === node && !node.closest('[inert]')), true);
  });

  await check('repeating the current chapter hash immediately aligns its camera and focus', async () => {
    const link = page.locator('.story-chapter-nav a[href="#city-detail"]');
    await link.click();
    await page.waitForFunction(() => document.activeElement?.id === 'story-theatre-title');
    await point(page, .36);
    assert.equal(new URL(page.url()).hash, '#city-detail');
    await link.click();
    const current = await page.locator('.cinematic-story').evaluate(root => ({
      progress: Number(root.dataset.storyProgress), target: Number(root.dataset.storyTargetProgress),
    }));
    records.repeatedHash = current;
    assert.ok(Math.abs(current.progress - .66) < .0001 && Math.abs(current.target - .66) < .0001,
      'The same hash must snap without waiting for native smooth scroll or visual following');
    await page.waitForFunction(() => document.activeElement?.id === 'story-theatre-title');
  });

  await check('pausing stops particles and active time while preserving page geometry and scroll', async () => {
    await point(page, .36); const before = await snapshot(page);
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyLayout === 'static');
    await page.waitForTimeout(100); const paused = await snapshot(page);
    await page.waitForTimeout(500); const after = await snapshot(page);
    records.pause = { before, paused, after };
    assert.equal(after.draws, paused.draws); assert.equal(after.activeTime, paused.activeTime);
    assert.ok(Math.abs(paused.height - before.height) <= 2 && Math.abs(paused.scroll - before.scroll) <= 2,
      'Changing presentation mode must preserve stage height and native scroll');
    await page.getByRole('button', { name: '播放动态效果', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyLayout === 'sticky');
    const resumed = await snapshot(page); records.pause.resumed = resumed;
    assert.ok(Math.abs(resumed.height - paused.height) <= 2 && Math.abs(resumed.scroll - paused.scroll) <= 2,
      'Resuming presentation must preserve the same stage height and native scroll');
  });
} finally { await context.close(); }

await check('direct product and theatre hashes focus visible readable headings', async () => {
  const anchors = await createBrowserContext('motion-contract-anchors', { reducedMotion: 'no-preference' });
  try {
    const page = await anchors.newPage(); page.on('pageerror', error => errors.push(error.message));
    records.anchors = [];
    for (const [hash, id] of [['product-intro', 'experience-preview-title'], ['city-detail', 'story-theatre-title']]) {
      await page.goto(base + '/#' + hash, { waitUntil: 'networkidle' });
      await page.waitForFunction(id => document.activeElement?.id === id, id);
      const record = await page.locator('#' + id).evaluate(heading => {
        const rect = heading.getBoundingClientRect(); let opacity = 1;
        for (let node = heading; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        return { focused: document.activeElement === heading, inert: Boolean(heading.closest('[inert]')), opacity,
          top: rect.top, bottom: rect.bottom, viewport: innerHeight, phase: heading.closest('.cinematic-story').dataset.storyPhase };
      });
      records.anchors.push({ hash, ...record });
      assert.ok(record.focused && !record.inert && record.opacity >= .95 && record.top >= 0 && record.bottom <= record.viewport,
        'A direct chapter destination must focus its visible readable heading');
    }
  } finally { await anchors.close(); }
});
await check('the tested page reports no uncaught application errors', async () => assert.deepEqual(errors, []));
await mkdir(output, { recursive: true });
await writeFile(insideProject(output + '/results.json'), JSON.stringify({ base, build, input, checks, errors, records,
  passed: checks.filter(check => check.pass).length, total: checks.length,
  environment: 'Local headless Edge at a simulated 1440x1000 CSS viewport; synthetic wheel input and real DOM/canvas measurements' }, null, 2));
console.log(JSON.stringify(checks, null, 2));
process.exitCode = checks.some(check => !check.pass) ? 1 : 0;
