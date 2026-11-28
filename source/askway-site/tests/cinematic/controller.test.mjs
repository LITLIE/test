import test from 'node:test';
import assert from 'node:assert/strict';
import { storyFrame } from '../../src/features/cinematic/progress.ts';

const runtime = await import('../../src/features/cinematic/useStoryProgress.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

function harness() {
  assert.equal(typeof runtime.createStoryController, 'function', 'The shared story controller must implement its scheduling contract');
  let scroll = 0, nextFrame = 0, lastTimestamp = 0;
  const pending = new Map(), commits = [];
  const scene = runtime.createStoryController({
    readScroll: () => scroll,
    requestFrame: callback => { const id = ++nextFrame; pending.set(id, callback); return id; },
    cancelFrame: id => pending.delete(id),
    commit: snapshot => commits.push(snapshot),
  }, true);
  const tick = timestamp => {
    assert.equal(pending.size, 1, 'The story may have only one pending animation frame');
    const [id, callback] = pending.entries().next().value;
    pending.delete(id);
    lastTimestamp = timestamp;
    callback(timestamp);
  };
  return { ...scene, pending, commits, scroll: value => { scroll = value; }, tick,
    settle(target) {
      let frames = 0;
      while (scene.controller.getSnapshot().value !== target || scene.controller.getSnapshot().targetValue !== target) {
        assert.ok(frames++ < 160, 'The finite camera follow must converge without an endless RAF');
        tick(lastTimestamp + 16);
      }
      assert.equal(scene.controller.getSnapshot().value, target);
      assert.equal(scene.controller.getSnapshot().targetValue, target);
    },
  };
}
const geometry = { start: 1000, height: 2600, viewport: 1000 };

test('scroll and geometry invalidations share one frame and do not create an idle loop', () => {
  const scene = harness();
  scene.setGeometry(geometry, true);
  scene.controller.setRunning(true);
  scene.scroll(1480);
  for (let i = 0; i < 8; i++) scene.controller.invalidate();
  assert.equal(scene.pending.size, 1);
  scene.tick(100);
  assert.equal(scene.controller.getSnapshot().targetValue, .3);
  assert.ok(scene.controller.getSnapshot().value > 0 && scene.controller.getSnapshot().value < .3,
    'A coalesced native update must start a finite follow instead of cutting to the target');
  assert.equal(scene.pending.size, 1, 'The finite follow continues without a canvas subscriber');
  scene.settle(.3);
  assert.equal(scene.controller.getSnapshot().value, .3);
  assert.equal(scene.pending.size, 0, 'Without a continuous subscriber, a still scene must rest');
});

test('pausing cancels continuous drawing immediately and resuming never catches up hidden time', () => {
  const scene = harness();
  const unsubscribe = scene.controller.subscribe(() => {}, true);
  scene.setGeometry(geometry, true);
  scene.scroll(1160);
  scene.controller.setRunning(true);
  scene.tick(100); scene.tick(116);
  assert.equal(scene.controller.getSnapshot().activeTime, 16);
  scene.controller.setRunning(false);
  assert.equal(scene.pending.size, 0);
  assert.equal(scene.commits.at(-1).running, false);
  assert.equal(scene.controller.getSnapshot().activeTime, 16);
  scene.controller.setRunning(true);
  scene.tick(9000); scene.tick(9016);
  assert.equal(scene.controller.getSnapshot().activeTime, 32);
  unsubscribe();
  assert.equal(scene.pending.size, 0, 'Removing the last canvas subscriber must stop the loop');
});

test('the formed route stops continuous frames and reverse scrolling restarts only when needed', () => {
  const scene = harness();
  scene.controller.subscribe(() => {}, true);
  scene.setGeometry(geometry, true);
  scene.controller.setRunning(true);
  scene.scroll(1928); scene.controller.invalidate(); scene.tick(100);
  assert.equal(scene.controller.getSnapshot().targetValue, .58);
  scene.settle(.58);
  assert.equal(scene.controller.getSnapshot().value, .58);
  assert.equal(scene.pending.size, 0);
  const beforeRest = scene.controller.getSnapshot().activeTime;
  scene.scroll(1576); scene.controller.invalidate(); scene.tick(9000);
  assert.equal(scene.controller.getSnapshot().targetValue, .36);
  assert.ok(scene.controller.getSnapshot().value < .58 && scene.controller.getSnapshot().value > .36,
    'Reverse scrolling must restart the finite camera follow');
  assert.equal(scene.controller.getSnapshot().activeTime, beforeRest, 'A resting interval must not become active time');
  scene.settle(.36);
  assert.equal(scene.controller.getSnapshot().value, .36);
  assert.equal(scene.pending.size, 1);
  scene.dispose();
  assert.equal(scene.pending.size, 0);
});

test('paused native scrolling still updates the target and phase without advancing the clock', () => {
  const scene = harness();
  scene.setGeometry(geometry, true);
  scene.scroll(2576); scene.controller.invalidate(); scene.tick(3000);
  const snapshot = scene.controller.getSnapshot();
  assert.equal(snapshot.value, .985);
  assert.equal(snapshot.targetValue, .985);
  assert.equal(snapshot.phase, 'product');
  assert.equal(snapshot.running, false);
  assert.equal(snapshot.activeTime, 0);
  assert.equal(scene.pending.size, 0);
});

test('remeasuring and reversing restores the same composition without accumulating state', () => {
  const scene = harness();
  scene.setGeometry(geometry, true);
  scene.scroll(1592); scene.controller.invalidate(); scene.tick(100);
  const first = scene.controller.getSnapshot();
  scene.setGeometry({ ...geometry, height: 2080, viewport: 800 }, true); scene.tick(200);
  assert.notEqual(scene.controller.getSnapshot().value, first.value);
  scene.setGeometry(geometry, true); scene.tick(300);
  const { direction: _one, ...original } = first;
  const { direction: _two, ...restored } = scene.controller.getSnapshot();
  assert.deepEqual(restored, original);
});

test('removing a canvas does not discard a separately queued native scroll update', () => {
  const scene = harness();
  const unsubscribe = scene.controller.subscribe(() => {}, true);
  scene.setGeometry(geometry, true);
  scene.scroll(1480);
  scene.controller.invalidate(); unsubscribe();
  assert.equal(scene.pending.size, 1);
  scene.tick(100);
  assert.equal(scene.controller.getSnapshot().value, .3);
  assert.equal(scene.pending.size, 0);
});

test('effect cleanup cancels pending layout work while allowing a strict-mode reattachment', () => {
  const scene = harness();
  scene.setGeometry(geometry, true);
  assert.equal(scene.pending.size, 0, 'The first measurement rebases synchronously');
  scene.setGeometry(geometry, true);
  assert.equal(scene.pending.size, 1);
  assert.equal(typeof scene.suspend, 'function');
  scene.suspend();
  assert.equal(scene.pending.size, 0);
  scene.scroll(1480); scene.controller.invalidate(); scene.tick(100);
  assert.equal(scene.controller.getSnapshot().value, .3);
});

test('enabling at an existing scroll target never publishes a temporary opening composition', () => {
  const scene = harness();
  scene.setGeometry(geometry, true);
  scene.scroll(2576);
  scene.controller.setRunning(true);
  assert.equal(scene.commits.at(-1).value, .985);
  assert.equal(scene.commits.at(-1).phase, 'product');
  assert.equal(scene.commits.at(-1).activeTime, 0);
});

test('only the first hydrated sticky activation may rebase an initial hash', () => {
  assert.equal(typeof runtime.createStoryModePolicy, 'function');
  const mode = runtime.createStoryModePolicy(false);
  assert.equal(mode.changed(false), false, 'The mount measurement already handles the direct hash');
  assert.equal(mode.changed(true), true, 'The first desktop activation must rebase its initial static anchor');
  assert.equal(mode.changed(false), false, 'Pausing must not return to an earlier hash after native scrolling');
  assert.equal(mode.changed(true), false, 'Resuming must preserve the current native scroll position');
  assert.equal(mode.changed(true), false, 'A repeated layout measurement must never replay hash navigation');
  const initiallySticky = runtime.createStoryModePolicy(true);
  assert.equal(initiallySticky.changed(true), false);
  assert.equal(initiallySticky.changed(false), false);
  assert.equal(initiallySticky.changed(true), false);
});

test('a readable static anchor receives focus even when normalized animation progress names another phase', () => {
  assert.equal(typeof runtime.storyAnchorCanFocus, 'function');
  const staticTheatre = { ...storyFrame(.66, 0), sticky: false };
  assert.equal(runtime.storyAnchorCanFocus('route', staticTheatre), true);
  assert.equal(runtime.storyAnchorCanFocus('route', { ...staticTheatre, sticky: true }), false);
  assert.equal(runtime.storyAnchorCanFocus('theatre', { ...staticTheatre, sticky: true }), true);
  assert.equal(runtime.storyAnchorCanFocus(null, staticTheatre), false);
});

test('native interaction or a resize before first activation cancels hydration navigation', () => {
  const mode = runtime.createStoryModePolicy(false);
  assert.equal(typeof mode.cancelInitialFollow, 'function');
  mode.cancelInitialFollow();
  assert.equal(mode.changed(true), false, 'A delayed desktop resize or user resume is not hydration');
  assert.equal(mode.changed(false), false);
  assert.equal(mode.changed(true), false);
});

test('a geometry update retargets the shared media card without changing the active clock', () => {
  const scene = harness();
  scene.scroll(2504);
  scene.setGeometry({ ...geometry, mediaFrame: { top: 24, right: 8, bottom: 20, left: 52 } }, true);
  assert.equal(scene.pending.size, 0, 'Initial geometry must immediately dock the measured media');
  assert.ok(Math.abs(scene.controller.getSnapshot().cardInsetLeft - 52) < 1e-6);
  scene.setGeometry({ ...geometry, mediaFrame: { top: 12, right: 10, bottom: 25, left: 46 } }, true);
  scene.tick(200);
  assert.ok(Math.abs(scene.controller.getSnapshot().cardInsetLeft - 46) < 1e-6);
  assert.equal(scene.controller.getSnapshot().activeTime, 0);
});

test('a navigation heading must fit between the fixed header and the viewport bottom', () => {
  assert.equal(typeof runtime.storyHeadingFitsViewport, 'function');
  const fits = runtime.storyHeadingFitsViewport;
  assert.equal(fits({ top: 750, bottom: 886 }, 844, 96), false);
  assert.equal(fits({ top: 100, bottom: 236 }, 844, 96), true);
  assert.equal(fits({ top: 60, bottom: 196 }, 844, 96), false);
});

test('a smooth-scroll focus request survives the product phase until its copy is actually readable', () => {
  const scene = harness();
  let requested = 'product';
  let delivered = 0;
  scene.controller.subscribe(snapshot => {
    if (runtime.storyAnchorCanFocus(requested, snapshot)) { delivered++; requested = null; }
  });
  scene.setGeometry(geometry, true);
  scene.controller.setRunning(true);
  scene.scroll(2504); scene.controller.invalidate(); scene.tick(100);
  scene.settle(.94);
  assert.equal(scene.controller.getSnapshot().phase, 'product');
  assert.equal(requested, 'product', 'An inert intermediate product phase must not consume navigation');
  assert.equal(delivered, 0);
  scene.scroll(2576); scene.controller.invalidate(); scene.settle(.985);
  assert.equal(requested, null);
  assert.equal(delivered, 1);
});
