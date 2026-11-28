import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { captureBrowserBuild, createBrowserContext, insideProject, scrollStoryToProgress as scrollNativeStoryToProgress, settlePresentation, storyRuntime, storySampleProgress, testBase } from '../helpers/browser-runtime.mjs';

const base = (process.env.CINEMATIC_TEST_URL || testBase).replace(/\/$/, '');
const output = insideProject(process.env.CINEMATIC_OUTDIR || 'delivery/cinematic-refresh/browser');
await mkdir(output, { recursive: true });
const build = await captureBrowserBuild(base);
const checks = [], errors = [], previewLayouts = [], photoCoverage = [], handoffMeasurements = [], headerContrasts = [];
const check = async (name, action) => {
  try { await action(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, error: error.message }); }
};
const names = ['city', 'route', 'theatre', 'product'];
const routeNames = ['海滨公园', '香炉湾', '日月贝'];

async function waitForStoryTarget(page, expected) {
  await page.waitForFunction(expected => {
    const root = document.querySelector('.cinematic-story');
    const value = root?.dataset.storyProgress, target = root?.dataset.storyTargetProgress;
    return value !== undefined && target !== undefined && value === target && Math.abs(Number(target) - expected) < .001;
  }, expected);
}
async function scrollStoryToProgress(page, progress) {
  await scrollNativeStoryToProgress(page, progress);
  await waitForStoryTarget(page, progress);
}

async function assertHtmlStory(page, visible = false) {
  assert.equal(await page.locator('h1').count(), 1);
  assert.deepEqual(await page.locator('[data-story-panel]').evaluateAll(panels => panels.map(panel => panel.dataset.storyPanel)), names);
  for (const panel of await page.locator('[data-story-panel]').all()) {
    assert.ok((await panel.textContent()).trim().length > 15, 'Every panel retains meaningful HTML text');
    assert.ok(await panel.locator('h1,h2,h3').count(), 'Each panel has an HTML heading');
    if (visible) assert.equal(await panel.isVisible(), true);
  }
  assert.deepEqual(await page.locator('.route-place h3').allTextContents(), routeNames);
}

async function assertStopped(page, delay = 400) {
  await settlePresentation(page);
  const before = await storyRuntime(page);
  const canvasBefore = await page.locator('.sea-route-particles').evaluateAll(canvases => canvases.map(canvas => ({ count: canvas.dataset.drawCount, time: canvas.dataset.activeTime })));
  await page.waitForTimeout(delay);
  const after = await storyRuntime(page);
  assert.equal(after.drawCount, before.drawCount, 'No new story draws while suspended');
  assert.equal(after.activeTime, before.activeTime, 'No active time accrues while suspended');
  const canvasAfter = await page.locator('.sea-route-particles').evaluateAll(canvases => canvases.map(canvas => ({ count: canvas.dataset.drawCount, time: canvas.dataset.activeTime })));
  if (canvasBefore.length && canvasAfter.length) assert.deepEqual(canvasAfter, canvasBefore, 'Canvas metrics also stop');
  for (const canvas of await page.locator('.sea-route-particles').all()) assert.equal(await canvas.getAttribute('data-drawing'), 'false');
  return after;
}

async function composition(page) {
  await page.waitForTimeout(500);
  return page.locator('.story-viewport').evaluate(viewport => {
    const round = value => Math.round(value * 100) / 100;
    const origin = viewport.getBoundingClientRect();
    return [...viewport.querySelectorAll('img,[data-story-panel],.route-diagram')].map(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return { panel: node.getAttribute('data-story-panel'), source: node.getAttribute('src'), transform: style.transform, opacity: style.opacity, clipPath: style.clipPath, visibility: style.visibility, x: round(rect.left - origin.left), y: round(rect.top - origin.top), width: round(rect.width), height: round(rect.height) };
    });
  });
}

async function handoffSnapshot(page) {
  await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyNearReady === 'true');
  await page.waitForTimeout(400);
  return page.locator('.story-viewport').evaluate(viewport => {
    const rectangle = node => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
    };
    const copy = selector => {
      const node = viewport.querySelector(selector);
      if (!node) throw new Error('Missing handoff copy: ' + selector);
      let effectiveOpacity = 1;
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        effectiveOpacity *= Number(style.opacity);
        if (style.visibility === 'hidden' || style.display === 'none') effectiveOpacity = 0;
      }
      const controls = [...node.querySelectorAll('a,button,input,select,textarea')];
      return { opacity: Number(getComputedStyle(node).opacity), effectiveOpacity, controls: controls.length, allInert: controls.every(control => Boolean(control.closest('[inert]'))) };
    };
    const media = viewport.querySelector('[data-story-handoff-media]') || viewport.querySelector('.story-theatre-media');
    const preview = viewport.querySelector('.story-product-preview');
    const map = preview.querySelector('.journey-preview__map');
    const targetRect = rectangle(map || preview);
    const previewRect = rectangle(preview);
    const copyrightRects = [...preview.querySelectorAll('a[href*="openstreetmap.org/copyright"]')].map(rectangle);
    let clipRect = null, clip = null;
    if (media) {
      const bounds = rectangle(media);
      clip = getComputedStyle(media).clipPath;
      let values = [0, 0, 0, 0];
      if (clip !== 'none') {
        const match = clip.match(/^inset\((.*)\)$/);
        if (!match) throw new Error('The handoff must expose its actual rectangular inset clip: ' + clip);
        const tokens = match[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
        if (tokens.some(token => !/^-?[\d.]+(?:px|%)?$/.test(token))) throw new Error('Unresolved handoff inset: ' + clip);
        if (tokens.length === 1) tokens.push(tokens[0], tokens[0], tokens[0]);
        else if (tokens.length === 2) tokens.push(tokens[0], tokens[1]);
        else if (tokens.length === 3) tokens.push(tokens[1]);
        if (tokens.length !== 4) throw new Error('Expected four handoff inset sides: ' + clip);
        values = tokens.map((token, index) => parseFloat(token) * (token.endsWith('%') ? (index % 2 ? bounds.width : bounds.height) / 100 : 1));
      }
      clipRect = { top: bounds.top + values[0], right: bounds.right - values[1], bottom: bounds.bottom - values[2], left: bounds.left + values[3] };
    }
    const photograph = media?.querySelector('img[src]');
    return { viewport: { width: innerWidth, height: innerHeight }, progress: Number(document.querySelector('.cinematic-story').dataset.storyProgress), near: copy('.story-theatre-copy'), product: copy('.story-product-copy'), map: copy('.journey-preview__map'), preview: copy('.story-product-preview'), mediaOpacity: media ? Number(getComputedStyle(media).opacity) : 0, photograph: photograph && { source: photograph.getAttribute('src'), complete: photograph.complete, width: photograph.naturalWidth }, clip, clipRect, targetRect, previewRect, copyrightRects };
  });
}

const context = await createBrowserContext('cinematic-main', { reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.removeItem('askway.presentation.paused'));
  await page.reload({ waitUntil: 'networkidle' });

  await check('one native desktop stage presents all four HTML phases in both directions', async () => {
    assert.equal(await page.locator('.cinematic-story').count(), 1);
    await assertHtmlStory(page);
    assert.equal((await storyRuntime(page)).layout, 'sticky');
    for (const phase of ['city', 'route', 'theatre', 'product', 'theatre', 'route', 'city']) {
      await scrollStoryToProgress(page, storySampleProgress[phase]);
      assert.equal((await storyRuntime(page)).phase, phase);
    }
    assert.equal(await page.locator('.story-viewport').evaluate(node => getComputedStyle(node).position), 'sticky');
    assert.equal(await page.locator('#journey').evaluate(node => node.classList.contains('journey-compact')), true);
    assert.notEqual(await page.locator('#journey .journey-sticky').evaluate(node => getComputedStyle(node).position), 'sticky');
  });

  await check('latest reverse scroll returns to the same deterministic composition', async () => {
    await scrollStoryToProgress(page, storySampleProgress.theatre);
    const forward = await composition(page);
    await scrollStoryToProgress(page, storySampleProgress.product);
    await scrollStoryToProgress(page, storySampleProgress.city);
    await scrollStoryToProgress(page, storySampleProgress.theatre);
    assert.equal((await storyRuntime(page)).phase, 'theatre');
    assert.deepEqual(await composition(page), forward);
    // The last target wins even when several native scroll events arrive before
    // the next animation frame; stale forward work must not replace it later.
    await page.evaluate(progresses => {
      const root = document.querySelector('.cinematic-story'), view = root.querySelector('.story-viewport');
      const rect = root.getBoundingClientRect(), start = rect.top + scrollY, distance = rect.height - view.getBoundingClientRect().height;
      for (const progress of progresses) window.scrollTo({ top: start + distance * progress, behavior: 'instant' });
    }, [storySampleProgress.product, storySampleProgress.route, .85, storySampleProgress.theatre]);
    await waitForStoryTarget(page, storySampleProgress.theatre);
    assert.deepEqual(await composition(page), forward);
  });

  await check('pause freezes actual work without changing stage height or scroll position', async () => {
    await page.goto(base + '/#story', { waitUntil: 'networkidle' });
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
    const geometry = await page.locator('.cinematic-story').evaluate(root => ({ height: root.getBoundingClientRect().height, scroll: scrollY }));
    const running = await storyRuntime(page);
    await page.waitForTimeout(150);
    assert.ok((await storyRuntime(page)).drawCount > running.drawCount, 'The layer was doing real work before pausing');
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    await assertStopped(page);
    const pausedGeometry = await page.locator('.cinematic-story').evaluate(root => ({ height: root.getBoundingClientRect().height, scroll: scrollY }));
    assert.ok(Math.abs(pausedGeometry.height - geometry.height) <= 1, 'Pause does not collapse the desktop stage');
    assert.ok(Math.abs(pausedGeometry.scroll - geometry.scroll) <= 1, 'Pause does not jump native scroll');
    await assertHtmlStory(page);
    await page.getByRole('button', { name: '播放动态效果', exact: true }).click();
    await scrollStoryToProgress(page, storySampleProgress.theatre);
    const laterScroll = await page.evaluate(() => scrollY);
    assert.equal(await page.evaluate(() => location.hash), '#story');
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    await settlePresentation(page);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - laterScroll) <= 1, 'Pausing after later native scrolling does not follow the old hash');
    await page.getByRole('button', { name: '播放动态效果', exact: true }).click();
    await settlePresentation(page);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - laterScroll) <= 1, 'Resuming does not return to the old #story anchor');
    assert.ok(Math.abs((await storyRuntime(page)).progress - storySampleProgress.theatre) < .015);
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    await assertStopped(page);
  });

  await check('the pause preference survives route navigation, home return and reduced-motion changes', async () => {
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '产品体验' }).click();
    await page.waitForURL('**/product/');
    assert.equal(await page.getByRole('button', { name: '播放动态效果', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('askway.presentation.paused')), 'true');
    await page.locator('.brand').first().click();
    await page.waitForURL(base + '/');
    await assertStopped(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await assertStopped(page);
    assert.equal(await page.getByRole('button', { name: '已减少动态效果', exact: true }).isDisabled(), true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.getByRole('button', { name: '播放动态效果', exact: true }).getAttribute('aria-pressed'), 'true');
    await assertStopped(page);
    await page.getByRole('button', { name: '播放动态效果', exact: true }).click();
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
  });

  await check('live reduced motion stops drawing while all four phases and manual tabs remain usable', async () => {
    const geometry = await page.locator('.cinematic-story').evaluate(root => ({ height: root.getBoundingClientRect().height, scroll: scrollY }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await assertStopped(page);
    const reducedGeometry = await page.locator('.cinematic-story').evaluate(root => ({ height: root.getBoundingClientRect().height, scroll: scrollY }));
    assert.ok(Math.abs(reducedGeometry.height - geometry.height) <= 1, 'Reduced motion does not collapse the desktop stage');
    assert.ok(Math.abs(reducedGeometry.scroll - geometry.scroll) <= 1, 'Reduced motion does not jump native scroll');
    await page.getByRole('tab', { name: /看懂每次调整/ }).click();
    assert.equal(await page.getByRole('tab', { name: /看懂每次调整/ }).getAttribute('aria-selected'), 'true');
    await assertHtmlStory(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
  });

  await check('leaving the stage stops work and returning resumes without replaying the elapsed pause', async () => {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const stopped = await assertStopped(page, 600);
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
    await settlePresentation(page);
    const resumed = await storyRuntime(page);
    assert.ok(resumed.activeTime >= stopped.activeTime);
    assert.ok(resumed.activeTime - stopped.activeTime < 500, 'Inactive wall time is not added on resume (activeTime is milliseconds)');
  });

  await check('document visibility suspension stops actual work and resumes at the current target', async () => {
    // Headless tab activation does not reliably hide pages. Model the actual
    // browser visibility API and event consumed by the production provider.
    const targetScroll = await page.locator('.cinematic-story').evaluate((root, progress) => {
      const rect = root.getBoundingClientRect();
      return rect.top + scrollY + (rect.height - root.querySelector('.story-viewport').getBoundingClientRect().height) * progress;
    }, storySampleProgress.route);
    await page.evaluate(() => {
      window.cinematicVisibility = 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.cinematicVisibility });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.cinematicVisibility !== 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    try {
      const stopped = await assertStopped(page, 600);
      await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), targetScroll);
      await page.evaluate(() => { window.cinematicVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
      await waitForStoryTarget(page, storySampleProgress.route);
      await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
      await settlePresentation(page);
      const resumed = await storyRuntime(page);
      assert.equal(resumed.phase, 'route');
      assert.ok(resumed.activeTime - stopped.activeTime < 500, 'Background time is not replayed (activeTime is milliseconds)');
    } finally {
      await page.evaluate(() => { delete document.visibilityState; delete document.hidden; delete window.cinematicVisibility; document.dispatchEvent(new Event('visibilitychange')); });
    }
  });

  await check('mobile reading and repeated resizes keep the native geometry correct', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyLayout === 'static');
    await assertHtmlStory(page, true);
    for (const size of [{ width: 1440, height: 1000 }, { width: 1080, height: 760 }]) {
      await page.setViewportSize(size);
      await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyLayout === 'sticky');
      await scrollStoryToProgress(page, storySampleProgress.theatre);
      assert.equal((await storyRuntime(page)).phase, 'theatre');
    }
    await page.setViewportSize({ width: 320, height: 720 });
    await assertHtmlStory(page, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  });

  await check('direct story, city-detail and product-intro anchors focus a visible HTML heading', async () => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const [anchor, phase] of [['story', 'route'], ['city-detail', 'theatre'], ['product-intro', 'product']]) {
        await page.goto(base + '/#' + anchor, { waitUntil: 'networkidle' });
        await page.waitForFunction(({ anchor, phase }) => {
          const target = document.getElementById(anchor), panel = document.querySelector(`[data-story-panel="${phase}"]`), active = document.activeElement;
          if (!target || !panel || !active || !active.matches('h1,h2,h3') || !panel.contains(active)) return false;
          const rect = active.getBoundingClientRect();
          for (let node = active; node instanceof Element; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          }
          return rect.top >= 0 && rect.bottom <= innerHeight;
        }, { anchor, phase }).catch(error => { throw new Error(`${width}px #${anchor} focused heading: ${error.message}`); });
        if (width >= 900 && anchor === 'product-intro') {
          await waitForStoryTarget(page, storySampleProgress.product);
          assert.ok(Math.abs((await storyRuntime(page)).progress - storySampleProgress.product) < .015, 'Native product anchor reaches its readable keyframe');
          assert.ok(Number(await page.locator('.story-product-copy').evaluate(node => getComputedStyle(node).opacity)) >= .99);
          await scrollStoryToProgress(page, storySampleProgress.theatre);
          assert.equal(await page.evaluate(() => location.hash), '#product-intro');
          await page.locator('.story-chapter-nav a[href="#product-intro"]').click();
          await page.waitForFunction(progress => {
            const root = document.querySelector('.cinematic-story'), title = document.getElementById('experience-preview-title');
            if (root?.dataset.storyProgress !== root?.dataset.storyTargetProgress || Math.abs(Number(root?.dataset.storyProgress) - progress) >= .001 || title !== document.activeElement) return false;
            const rect = title.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= innerHeight && Number(getComputedStyle(title.closest('.story-product-copy')).opacity) >= .99;
          }, storySampleProgress.product).catch(error => { throw new Error(`Same-hash native product click: ${error.message}`); });
        }
      }
    }
  });

  await check('the experience route releases website decoration and retains its working map', async () => {
    await page.goto(base + '/experience/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.cinematic-story,.sea-route-particles,.presentation-toggle,.immersive-showcase').count(), 0);
    assert.equal(await page.locator('[data-map-panel]').count(), 1);
    assert.equal(await page.locator('h1').count(), 1);
  });
  await check('normal story navigation produces no unhandled browser errors', async () => assert.deepEqual(errors, []));
} finally { await context.close(); }

await check('the near-scene handoff suppresses competing copy and aligns its actual clip with the final card', async () => {
  const context = await createBrowserContext('cinematic-handoff-bounds', { reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 900, height: 700 }]) {
      await page.setViewportSize(viewport);
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      for (const progress of [.78, .84]) {
        await scrollStoryToProgress(page, progress);
        const snapshot = await handoffSnapshot(page);
        handoffMeasurements.push(snapshot);
        assert.ok(snapshot.near.opacity <= .01 && snapshot.near.effectiveOpacity <= .01, 'Near-scene copy has disappeared before media begins shrinking');
        assert.ok(snapshot.near.controls > 0 && snapshot.near.allInert, 'Invisible near-scene controls cannot receive focus');
        assert.ok(snapshot.product.effectiveOpacity <= .01, 'Product copy waits until the media has reached its card');
        assert.ok(snapshot.product.controls > 0 && snapshot.product.allInert, 'Product controls remain inert during the handoff');
        assert.ok(snapshot.photograph?.complete && snapshot.photograph.width > 0 && snapshot.mediaOpacity > .99, 'The decoded landmark photograph remains visible during the handoff');
      }
      await scrollStoryToProgress(page, .94);
      const forward = await handoffSnapshot(page);
      handoffMeasurements.push(forward);
      assert.ok(forward.clipRect, 'The shared media is still available at the final handoff');
      assert.ok(forward.product.effectiveOpacity <= .01 && forward.product.allInert, 'Product copy waits until after the card docks to become readable and interactive');
      assert.ok(forward.map.effectiveOpacity <= .01 && forward.mediaOpacity > .99, 'At p=.94 the photograph is docked while the map still waits');
      for (const side of ['top', 'right', 'bottom', 'left']) {
        assert.ok(Math.abs(forward.clipRect[side] - forward.targetRect[side]) <= 2, `At p=.94 the ${side} photo edge matches the actual preview map area within 2px`);
      }
      assert.ok(forward.copyrightRects.length > 0, 'The HTML copyright source remains outside the photograph');
      for (const source of forward.copyrightRects) {
        const overlap = Math.max(0, Math.min(source.right, forward.clipRect.right) - Math.max(source.left, forward.clipRect.left))
          * Math.max(0, Math.min(source.bottom, forward.clipRect.bottom) - Math.max(source.top, forward.clipRect.top));
        assert.ok(overlap <= .5, 'The photo clip does not cover the HTML copyright link');
      }
      await scrollStoryToProgress(page, storySampleProgress.product);
      const readable = await handoffSnapshot(page);
      handoffMeasurements.push(readable);
      assert.ok(readable.product.effectiveOpacity > .01, 'Product copy becomes readable after the handoff');
      assert.equal(readable.product.allInert, false, 'Visible product controls become available');
      assert.ok(readable.preview.effectiveOpacity > .99 && readable.map.effectiveOpacity > .99 && readable.product.effectiveOpacity > .99, 'The stable product destination exposes the complete card, map and copy');
      await page.evaluate(progresses => {
        const root = document.querySelector('.cinematic-story'), view = root.querySelector('.story-viewport');
        const rect = root.getBoundingClientRect(), start = rect.top + scrollY, travel = rect.height - view.getBoundingClientRect().height;
        for (const progress of progresses) scrollTo({ top: start + travel * progress, behavior: 'instant' });
      }, [.84, .94, .78, storySampleProgress.product]);
      await waitForStoryTarget(page, storySampleProgress.product);
      const reverse = await handoffSnapshot(page);
      handoffMeasurements.push(reverse);
      assert.deepEqual({ clip: reverse.clipRect, target: reverse.targetRect, card: reverse.previewRect, near: reverse.near, product: reverse.product },
        { clip: readable.clipRect, target: readable.targetRect, card: readable.previewRect, near: readable.near, product: readable.product }, 'Latest reverse input restores the same geometry and copy policy');
      await scrollStoryToProgress(page, .94);
      const reverseDock = await handoffSnapshot(page);
      handoffMeasurements.push(reverseDock);
      assert.deepEqual({ clip: reverseDock.clipRect, target: reverseDock.targetRect, card: reverseDock.previewRect, near: reverseDock.near, product: reverseDock.product, map: reverseDock.map },
        { clip: forward.clipRect, target: forward.targetRect, card: forward.previewRect, near: forward.near, product: forward.product, map: forward.map }, 'Reverse scrolling also restores the docked photograph before map and copy entry');
    }
  } finally { await context.close(); }
});

await check('a genuine readonly candidate, its map and focused CTAs fit the product panel at desktop limits', async () => {
  const context = await createBrowserContext('cinematic-product-bounds', { reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    for (const mode of ['static', 'sticky']) {
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 900, height: 700 }]) {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: mode === 'static' ? 'reduce' : 'no-preference' });
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        if (mode === 'sticky') await scrollStoryToProgress(page, storySampleProgress.product);
        else await page.locator('[data-story-panel="product"]').scrollIntoViewIfNeeded();
        await settlePresentation(page);
        const measured = await page.locator('[data-story-panel="product"]').evaluate(panel => {
          const rectangle = node => {
            const rect = node.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
          };
          const card = panel.querySelector('.story-product-preview');
          const candidate = card.querySelector('[data-preview-status]');
          const maps = [...card.querySelectorAll('svg')].sort((a, b) => {
            const left = a.getBoundingClientRect(), right = b.getBoundingClientRect();
            return right.width * right.height - left.width * left.height;
          });
          return {
            mode: document.querySelector('.cinematic-story').dataset.storyLayout,
            viewport: { width: innerWidth, height: innerHeight }, panel: rectangle(panel),
            card: rectangle(card), candidate: candidate && rectangle(candidate), map: maps[0] && rectangle(maps[0]),
            ctas: [...panel.querySelectorAll('.story-product-actions a')].map(rectangle),
            status: candidate?.dataset.previewStatus ?? null,
            placeIds: [...new Set(candidate?.dataset.previewPlaceIds?.match(/ZS-\d+/g) || [])],
            mapIds: [...card.querySelectorAll('svg [data-preview-map-place-id]')].map(node => node.dataset.previewMapPlaceId),
            mapNodes: [...card.querySelectorAll('svg [data-preview-map-place-id]')].map(node => ({ id: node.dataset.previewMapPlaceId, rect: rectangle(node) })),
            htmlIds: [...card.querySelectorAll('[data-preview-place-id]')].map(node => node.dataset.previewPlaceId),
            focus: [],
          };
        });
        previewLayouts.push(measured);
        assert.equal(measured.mode, mode);
        const contained = (rect, outer, label) => {
          assert.ok(rect && rect.width > 0 && rect.height > 0, label + ' has a real positive rectangle');
          assert.ok(rect.top >= outer.top - .5 && rect.bottom <= outer.bottom + .5 && rect.left >= outer.left - .5 && rect.right <= outer.right + .5,
            `${mode} ${viewport.width}×${viewport.height} ${label} fits its panel: ${JSON.stringify({ rect, outer })}`);
        };
        contained(measured.card, measured.panel, 'preview card');
        contained(measured.candidate, measured.card, 'candidate content');
        contained(measured.map, measured.candidate, 'candidate SVG');
        for (const cta of measured.ctas) contained(cta, measured.panel, 'journey CTA');
        assert.ok(measured.ctas.length >= 1);
        assert.equal(measured.status, 'proposal', 'The preview is an accepted same-rule proposal');
        assert.ok(measured.placeIds.includes('ZS-004'), 'The generated candidate retains the required 日月贝');
        assert.ok(measured.placeIds.length > 0);
        assert.equal(measured.mapIds.length, measured.placeIds.length, 'There is one drawn map node per candidate stop');
        assert.equal(measured.htmlIds.length, measured.placeIds.length, 'There is one HTML itinerary item per candidate stop');
        assert.deepEqual([...new Set(measured.mapIds)].sort(), [...measured.placeIds].sort(), 'SVG points describe the actual generated itinerary');
        assert.deepEqual([...new Set(measured.htmlIds)].sort(), [...measured.placeIds].sort(), 'HTML stop list describes the same generated itinerary');
        for (const node of measured.mapNodes) contained(node.rect, measured.map, 'drawn candidate stop ' + node.id);
        assert.match(await page.locator('.story-product-preview [data-preview-place-id="ZS-004"]').innerText(), /日月贝/);
        for (const link of await page.locator('.story-product-actions a').all()) {
          await link.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await link.evaluate(node => node === document.activeElement), true, 'Keyboard focus returns to the journey link');
          const focus = await link.evaluate(node => {
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            const padding = Math.max(0, (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0));
            const box = { top: rect.top - padding, bottom: rect.bottom + padding, left: rect.left - padding, right: rect.right + padding, width: rect.width + 2 * padding, height: rect.height + 2 * padding };
            const clipping = [];
            for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
              const css = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
              const clipsX = /^(hidden|clip|auto|scroll)$/.test(css.overflowX), clipsY = /^(hidden|clip|auto|scroll)$/.test(css.overflowY);
              if (clipsX || clipsY) clipping.push({ name: ancestor.className, clipsX, clipsY, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right });
            }
            const panel = node.closest('[data-story-panel]').getBoundingClientRect();
            return { box, outline: style.outlineStyle, panel: { top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right, width: panel.width, height: panel.height }, clipping };
          });
          measured.focus.push(focus);
          assert.notEqual(focus.outline, 'none', 'Keyboard focus has a visible outline');
          contained(focus.box, focus.panel, 'CTA focus outline');
          contained(focus.box, { top: 0, bottom: viewport.height, left: 0, right: viewport.width }, 'visible CTA focus outline');
          for (const ancestor of focus.clipping) {
            if (ancestor.clipsY) assert.ok(focus.box.top >= ancestor.top - .5 && focus.box.bottom <= ancestor.bottom + .5, 'Focus is not vertically clipped by ' + ancestor.name);
            if (ancestor.clipsX) assert.ok(focus.box.left >= ancestor.left - .5 && focus.box.right <= ancestor.right + .5, 'Focus is not horizontally clipped by ' + ancestor.name);
          }
        }
      }
    }
  } finally { await context.close(); }
});

await check('save-data disables automatic presentation and keeps semantic story content', async () => {
  const context = await createBrowserContext('cinematic-save-data', { reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const connection = new EventTarget();
      connection.saveData = true;
      Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => navigator.connection.saveData), true);
    await assertStopped(page);
    await assertHtmlStory(page);
    await page.getByRole('tab', { name: /带上这段旅程/ }).click();
    assert.equal(await page.getByRole('tab', { name: /带上这段旅程/ }).getAttribute('aria-selected'), 'true');
    await page.evaluate(() => { navigator.connection.saveData = false; navigator.connection.dispatchEvent(new Event('change')); });
    await scrollStoryToProgress(page, storySampleProgress.route);
    await page.waitForFunction(() => document.querySelector('.sea-route-particles')?.dataset.drawing === 'true');
    await page.evaluate(() => { navigator.connection.saveData = true; navigator.connection.dispatchEvent(new Event('change')); });
    await assertStopped(page);
  } finally { await context.close(); }
});

await check('an actually failed decorative chunk leaves four HTML panels and usable navigation', async () => {
  const context = await createBrowserContext('cinematic-chunk-failure', { reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    let blocked = 0;
    await page.route('**/*', route => {
      if (/SeaRouteParticles/.test(route.request().url())) { blocked++; return route.abort('failed'); }
      return route.continue();
    });
    const failedRequest = page.waitForEvent('requestfailed', { predicate: request => /SeaRouteParticles/.test(request.url()), timeout: 10000 });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await failedRequest;
    assert.ok(blocked > 0, 'The decorative request was blocked, rather than merely unused');
    await assertHtmlStory(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertHtmlStory(page, true);
    await page.getByRole('button', { name: '打开导航' }).click();
    await page.getByRole('navigation', { name: '移动主导航' }).getByRole('link', { name: /关于问途/ }).click();
    await page.waitForURL('**/about/');
    assert.equal(await page.locator('h1').count(), 1);
  } finally { await context.close(); }
});

await check('the local sea switch and camera selection cannot bypass a global presentation pause', async () => {
  const context = await createBrowserContext('cinematic-showcase-pause', {
    reducedMotion: 'no-preference',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await context.newPage();
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator('.immersive-stage').scrollIntoViewIfNeeded();
    const host = page.locator('.immersive-stage .city-sandbox__canvas');
    await page.waitForFunction(() => document.querySelector('.immersive-stage .city-sandbox__canvas')?.dataset.sceneResourcesReady === 'true');
    await page.waitForFunction(() => document.querySelector('.immersive-stage .city-sandbox__canvas')?.dataset.sceneAnimating === 'true');
    await page.getByRole('button', { name: '暂停动态效果', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.immersive-stage .city-sandbox__canvas')?.dataset.animationRequested === 'false');
    const localSwitch = page.locator('.immersive-stage .city-sandbox__motion');
    if (await localSwitch.getAttribute('aria-pressed') === 'true') await localSwitch.click();
    await localSwitch.click();
    assert.equal(await localSwitch.getAttribute('aria-pressed'), 'true', 'The user may retain a local request while the global gate suspends it');
    await page.getByRole('group', { name: '选择城市展台视角' }).getByRole('button', { name: /沿海岸/ }).click();
    await page.waitForFunction(() => document.querySelector('.immersive-stage .city-sandbox__canvas')?.dataset.scenePreset === 'route');
    await settlePresentation(page);
    await page.waitForTimeout(300);
    const before = await host.evaluate(node => ({ count: node.dataset.renderCount, requested: node.dataset.animationRequested, animating: node.dataset.sceneAnimating }));
    assert.equal(before.requested, 'false');
    assert.equal(before.animating, 'false');
    await page.waitForTimeout(600);
    assert.deepEqual(await host.evaluate(node => ({ count: node.dataset.renderCount, requested: node.dataset.animationRequested, animating: node.dataset.sceneAnimating })), before);
    assert.equal(await page.getByRole('button', { name: '播放动态效果', exact: true }).getAttribute('aria-pressed'), 'true');
  } finally { await context.close(); }
});

await check('a failed city-showcase chunk preserves its photograph, view choices and the HTML story', async () => {
  const context = await createBrowserContext('cinematic-showcase-failure', { reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    let blocked = 0;
    await page.route('**/*', route => {
      if (/CinematicCity/.test(route.request().url())) { blocked++; return route.abort('failed'); }
      return route.continue();
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator('.immersive-stage').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.immersive-motion-note')?.textContent.includes('资源未能载入'));
    assert.ok(blocked > 0, 'The city-showcase lazy chunk was actually requested and blocked');
    await assertHtmlStory(page);
    assert.equal(await page.locator('.immersive-poster img').first().isVisible(), true);
    await page.getByRole('group', { name: '选择城市展台视角' }).getByRole('button', { name: /沿海岸/ }).click();
    assert.match(await page.locator('.immersive-view-copy h3').innerText(), /沿海岸/);
    assert.equal(await page.getByRole('button', { name: '刷新再开启', exact: true }).count(), 1);
  } finally { await context.close(); }
});

await check('without JavaScript all four panels, stops and native destination anchors remain readable', async () => {
  const context = await createBrowserContext('cinematic-nojs', { javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto(base + '/');
      await assertHtmlStory(page, true);
      for (const id of ['story', 'city-detail', 'product-intro']) assert.equal(await page.locator('#' + id).count(), 1);
      assert.ok(await page.locator('a[href*="/experience/"]').count());
      await page.locator('details.journey-notes summary').click();
      assert.equal(await page.locator('.journey-chapter').count(), 4);
      for (const chapter of await page.locator('.journey-chapter').all()) assert.equal(await chapter.isVisible(), true);
      for (const [anchor, phase] of [['story', 'route'], ['city-detail', 'theatre'], ['product-intro', 'product']]) {
        await page.goto(base + '/#' + anchor);
        assert.equal(await page.locator('#' + anchor).getAttribute('data-story-panel'), phase, 'Without JavaScript the fragment belongs to the actual readable panel');
        await page.waitForFunction(phase => {
          const panel = document.querySelector(`[data-story-panel="${phase}"]`);
          const heading = panel?.querySelector('[data-story-heading]');
          if (!panel || !heading) return false;
          const bounds = panel.getBoundingClientRect(), style = getComputedStyle(heading);
          const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
          const scrollMargin = parseFloat(getComputedStyle(panel).scrollMarginTop) || 0;
          const nearTop = Math.min(innerHeight * .4, Math.max(120, scrollPadding + scrollMargin + 24));
          const visibleHeight = Math.max(0, Math.min(innerHeight, bounds.bottom) - Math.max(0, bounds.top));
          return bounds.top >= -Math.min(120, bounds.height * .15) && bounds.top <= nearTop
            && visibleHeight >= Math.min(bounds.height, innerHeight) * .5
            && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
        }, phase).catch(error => { throw new Error(`Without JavaScript ${width}px #${anchor} readable panel: ${error.message}`); });
      }
      await page.locator('[data-story-panel="product"]').evaluate(panel => scrollTo({ top: panel.getBoundingClientRect().top + scrollY + 150, behavior: 'instant' }));
      const contrast = await page.locator('.site-header').evaluate(header => {
        const color = value => {
          const channels = value.match(/[\d.]+/g)?.map(Number);
          if (!/^rgba?\(/.test(value) || !channels || channels.length < 3) throw new Error('Expected resolved RGB header color: ' + value);
          return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
        };
        const composite = (foreground, background) => foreground.rgb.map((channel, index) => channel * foreground.alpha + background[index] * (1 - foreground.alpha));
        const luminance = rgb => {
          const linear = rgb.map(channel => { const srgb = channel / 255; return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4; });
          return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
        };
        const paperCss = getComputedStyle(document.querySelector('[data-story-panel="product"]')).backgroundColor;
        const paper = color(paperCss).rgb;
        const headerCss = getComputedStyle(header).backgroundColor;
        const headerColor = color(headerCss);
        const background = composite(headerColor, paper);
        const bounds = header.getBoundingClientRect();
        const text = [...header.querySelectorAll('.brand-name,.brand-name>span,.desktop-nav a,.header-cta')].flatMap(node => {
          const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
          if (rect.width <= 0 || rect.height <= 0 || rect.top >= bounds.bottom || rect.bottom <= bounds.top || style.visibility === 'hidden') return [];
          const ownBackground = composite(color(style.backgroundColor), background);
          const foreground = composite(color(style.color), ownBackground);
          const light = luminance(foreground), dark = luminance(ownBackground);
          return [{ text: node.textContent.trim(), color: style.color, background: ownBackground, contrast: (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05) }];
        });
        return { viewport: { width: innerWidth, height: innerHeight }, scroll: scrollY, headerBackground: headerCss, headerAlpha: headerColor.alpha, paperBackground: paperCss, text };
      });
      headerContrasts.push(contrast);
      assert.ok(contrast.text.length > 0, 'The native header has actual visible text over paper');
      for (const text of contrast.text) assert.ok(text.contrast >= 4.5, `Without JavaScript ${width}px header text remains readable over paper: ${JSON.stringify(text)}`);
    }
  } finally { await context.close(); }
});

await check('without JavaScript real decoded photographs fill their visible media frames', async () => {
  const context = await createBrowserContext('cinematic-nojs-photographs', { javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(base + '/#city-detail');
      await page.locator('.story-detail-frame>div').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('.story-detail-frame>div,.story-theatre-media')].filter(frame => {
        const rect = frame.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).every(frame => { const image = frame.querySelector('img[src]'); return image?.complete && image.naturalWidth > 0; }));
      const frames = await page.evaluate(() => [...document.querySelectorAll('.story-detail-frame>div,.story-theatre-media')].flatMap(frame => {
        const f = frame.getBoundingClientRect();
        if (f.width <= 0 || f.height <= 0) return [];
        const image = frame.querySelector('img[src]');
        if (!image) throw new Error('A readable photographic slot has no real src image');
        const r = image.getBoundingClientRect();
        const intersection = Math.max(0, Math.min(f.right, r.right) - Math.max(f.left, r.left)) * Math.max(0, Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top));
        return [{ viewport: { width: innerWidth, height: innerHeight }, frame: { top: f.top, bottom: f.bottom, width: f.width, height: f.height }, image: { top: r.top, bottom: r.bottom, width: r.width, height: r.height, src: image.getAttribute('src'), naturalWidth: image.naturalWidth }, coverage: intersection / (f.width * f.height) }];
      }));
      photoCoverage.push(...frames);
      assert.ok(frames.length > 0, 'There is a genuine visible photographic slot');
      for (const frame of frames) {
        assert.ok(frame.image.naturalWidth > 0, 'The real photograph is decoded');
        assert.ok(frame.coverage >= .95, `${viewport.width}px real src photograph fills at least 95% of its slot: ${JSON.stringify(frame)}`);
      }
    }
  } finally { await context.close(); }
});

await writeFile(insideProject(output + '/results.json'), JSON.stringify({ base, build, checks, errors, previewLayouts, photoCoverage, handoffMeasurements, headerContrasts, passed: checks.filter(item => item.pass).length, total: checks.length, environment: 'Local headless Edge; simulated CSS viewports, media and visibility APIs' }, null, 2));
console.log(JSON.stringify(checks, null, 2));
process.exitCode = checks.some(item => !item.pass) ? 1 : 0;
