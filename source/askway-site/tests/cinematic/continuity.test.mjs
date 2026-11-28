import test from 'node:test';
import assert from 'node:assert/strict';
import { storyFrame, storyPanelReadable } from '../../src/features/cinematic/progress.ts';
import { createStoryController } from '../../src/features/cinematic/useStoryProgress.ts';
import { storyChapters } from '../../src/features/cinematic/storyConfig.ts';

const geometry = { start: 1000, height: 6000, viewport: 1000 };
const close = (actual, expected, message) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-4,
  `${message}: expected ${expected}, received ${actual}`,
);

// Only the browser's scroll position and RAF clock are controlled. All tracking,
// cancellation, composition and subscriber delivery use the production runtime.
function harness(initialProgress = .08) {
  let scroll = geometry.start + initialProgress * 5000;
  let nextFrame = 0, timestamp = 0;
  const pending = new Map(), commits = [];
  const scene = createStoryController({
    readScroll: () => scroll,
    requestFrame: callback => {
      const id = ++nextFrame;
      pending.set(id, callback);
      return id;
    },
    cancelFrame: id => pending.delete(id),
    commit: snapshot => commits.push(snapshot),
  }, true);
  return {
    ...scene, pending, commits,
    scrollTo(progress) { scroll = geometry.start + progress * 5000; },
    wheelTo(progress) {
      scroll = geometry.start + progress * 5000;
      scene.controller.invalidate();
    },
    step(milliseconds = 16) {
      timestamp += milliseconds;
      assert.equal(pending.size, 1, 'There must be exactly one scheduled production frame');
      const [id, callback] = pending.entries().next().value;
      pending.delete(id);
      callback(timestamp);
      return scene.controller.getSnapshot();
    },
    start() {
      scene.setGeometry(geometry, true);
      if (pending.size) this.step();
      scene.controller.setRunning(true);
      if (pending.size) this.step();
      return this;
    },
  };
}

function settle(scene, target, direction) {
  let previous = scene.controller.getSnapshot().value;
  let frames = 0;
  while (scene.pending.size && frames++ < 200) {
    const snapshot = scene.step();
    close(snapshot.targetValue, target, 'Tracking must retain the latest native target');
    assert.ok(direction > 0 ? snapshot.value >= previous : snapshot.value <= previous,
      'A fixed target must never reverse the rendered camera');
    assert.ok(direction > 0 ? snapshot.value <= target : snapshot.value >= target,
      'The rendered camera must never overshoot its target');
    previous = snapshot.value;
  }
  assert.ok(frames < 200, 'Tracking must settle within a finite number of frames');
  close(scene.controller.getSnapshot().value, target, 'The final composition must reach the target');
  assert.equal(scene.pending.size, 0, 'A settled scene without particle subscribers must stop RAF');
}

test('one ordinary wheel event moves toward its target instead of cutting to it', t => {
  const scene = harness().start();
  t.after(() => scene.dispose());
  const before = scene.controller.getSnapshot().value;
  scene.wheelTo(.68);
  for (let i = 0; i < 8; i++) scene.controller.invalidate();
  const snapshot = scene.step();
  assert.ok(snapshot.value > before && snapshot.value < .68,
    'A wheel event must produce an intermediate composition, not an immediate scene cut');
  close(snapshot.targetValue, .68, 'The native target must remain separately observable');
  assert.equal(scene.pending.size, 1, 'Tracking must continue without a continuous particle subscriber');
});

test('tracking reaches a late product target monotonically and releases its RAF', t => {
  const scene = harness().start();
  t.after(() => scene.dispose());
  scene.wheelTo(.985);
  const first = scene.step();
  assert.ok(first.value < .985, 'Product entry must not skip the camera approach');
  settle(scene, .985, 1);
  assert.equal(scene.controller.getSnapshot().phase, 'product');
  assert.equal(storyPanelReadable(scene.controller.getSnapshot(), 'product', true), true);
});

test('rapid reverse input follows the latest target without drifting toward an obsolete one', t => {
  const scene = harness().start();
  t.after(() => scene.dispose());
  scene.wheelTo(.92);
  for (let i = 0; i < 9; i++) scene.step();
  const beforeReverse = scene.controller.getSnapshot().value;
  assert.ok(beforeReverse > .12 && beforeReverse < .92,
    'The reversal fixture must interrupt an actual unfinished camera move');
  scene.wheelTo(.28);
  scene.wheelTo(.12);
  const reversed = scene.step();
  close(reversed.targetValue, .12, 'Coalesced input must use the newest target');
  assert.ok(reversed.value < beforeReverse && reversed.value >= .12,
    'The very next rendered frame must move toward the reverse target without overshoot');
  settle(scene, .12, -1);
});

test('pausing or leaving the surface cancels tracking and discards the hidden interval', t => {
  const scene = harness().start();
  t.after(() => scene.dispose());
  scene.wheelTo(.86);
  for (let i = 0; i < 3; i++) scene.step();
  assert.ok(scene.controller.getSnapshot().value < .86, 'Pause must interrupt unfinished tracking');
  const activeTime = scene.controller.getSnapshot().activeTime;
  scene.scrollTo(.42);
  scene.controller.setRunning(false);
  close(scene.controller.getSnapshot().value, .42, 'Pause must immediately align with the current native scroll');
  close(scene.controller.getSnapshot().targetValue, .42, 'Paused target must align with native scroll');
  assert.equal(scene.pending.size, 0, 'Pause must cancel the pending tracking frame');
  assert.equal(scene.controller.getSnapshot().activeTime, activeTime);
  scene.wheelTo(.985);
  scene.step(30000);
  close(scene.controller.getSnapshot().value, .985, 'Paused scrolling must still update the native composition');
  assert.equal(scene.controller.getSnapshot().activeTime, activeTime);
  assert.equal(scene.pending.size, 0);
  scene.controller.setRunning(true);
  close(scene.controller.getSnapshot().value, .985, 'Resume must not replay a previous camera path');
  if (scene.pending.size) scene.step(60000);
  assert.equal(scene.controller.getSnapshot().activeTime, activeTime,
    'The first resumed frame must discard the entire inactive timestamp gap');
  scene.wheelTo(.62);
  const resumed = scene.step();
  assert.ok(resumed.value < .985 && resumed.value > .62,
    'Fresh scrolling after resume must use a fresh intermediate camera move');
});

test('explicit anchor navigation snaps immediately and cancels an unfinished follow', t => {
  const scene = harness().start();
  t.after(() => scene.dispose());
  scene.wheelTo(.92);
  scene.step();
  scene.scrollTo(.66);
  assert.equal(typeof scene.controller.snapToScroll, 'function',
    'Explicit anchors require a synchronous snap API');
  scene.controller.snapToScroll();
  const snapshot = scene.controller.getSnapshot();
  close(snapshot.value, .66, 'The anchor composition must appear synchronously');
  close(snapshot.targetValue, .66, 'Anchor snap must replace the previous target');
  assert.equal(snapshot.phase, 'theatre');
  assert.equal(storyPanelReadable(snapshot, 'theatre', true), true);
  assert.equal(scene.pending.size, 0, 'The obsolete follow must not run after an explicit snap');
  assert.equal(scene.commits.at(-1).value, snapshot.value, 'Subscribers must receive the snapped composition');
});

test('initial geometry and mode changes never publish an unrelated opening composition', t => {
  const scene = harness(.985);
  t.after(() => scene.dispose());
  scene.setGeometry(geometry, true);
  close(scene.controller.getSnapshot().value, .985, 'Initial measurement must align before the next frame');
  close(scene.controller.getSnapshot().targetValue, .985, 'Initial measurement must retain its native target');
  assert.ok(scene.commits.every(snapshot => snapshot.phase === 'product'),
    'Measuring a deep link must not briefly publish city phase');
  scene.scrollTo(.36);
  scene.setGeometry(geometry, false);
  close(scene.controller.getSnapshot().value, .36, 'Static mode must align with current native scroll');
  assert.equal(scene.controller.getSnapshot().sticky, false);
  scene.scrollTo(.66);
  scene.setGeometry(geometry, true);
  close(scene.controller.getSnapshot().value, .66, 'Sticky reactivation must not animate from the old mode');
  assert.equal(scene.controller.getSnapshot().phase, 'theatre');
});

test('the coastal photograph remains opaque while the near scene enters', () => {
  for (const p of [.45, .48, .5, .53, .56, .6, .65]) {
    const frame = storyFrame(p, 0);
    assert.equal(frame.coastMediaOpacity, 1, `The shared environment must cover progress ${p}`);
    const coverage = 1 - (1 - frame.coastMediaOpacity) * (1 - frame.theatreMediaOpacity);
    assert.ok(coverage >= .999, `Layer composition must not expose a brightness gap at ${p}`);
  }
});

test('the near photograph opens from the route landmark before becoming a full scene', () => {
  const target = { top: 24, right: 8, bottom: 20, left: 52 };
  const origin = { x: 80, y: 34 };
  const start = storyFrame(.45, 0, target, origin);
  close(start.nearArrivalScale, 0, 'The incoming photograph begins as a point-sized plane');
  close(start.cardInsetLeft, 80, 'The new scene begins at the chosen landmark');
  close(start.cardInsetRight, 20, 'The initial window has zero width');
  close(start.cardInsetTop, 34, 'The window is vertically anchored to the landmark');
  close(start.cardInsetBottom, 66, 'The initial window has zero height');
  const middle = storyFrame(.55, 0, target, origin);
  close(middle.nearArrivalScale, .5, 'The growing plane shows the whole photograph rather than a magnified crop');
  assert.ok(middle.cardInsetLeft > 0 && middle.cardInsetLeft < 80);
  assert.ok(middle.theatreMediaOpacity > .99, 'The growing photograph is opaque instead of ghosting the coast');
  const full = storyFrame(.65, 0, target, origin);
  for (const field of ['cardInsetLeft', 'cardInsetRight', 'cardInsetTop', 'cardInsetBottom']) close(full[field], 0, 'The near photograph fills its scene');
  close(storyFrame(.94, 0, target, origin).cardInsetLeft, 52, 'Retreat still ends at the measured product card');
});

test('the near copy exits before shrinking and the settled card precedes map and text', () => {
  const exit = storyFrame(.78, 0), moving = storyFrame(.9, 0), docked = storyFrame(.94, 0);
  assert.equal(exit.theatreCopyOpacity, 0, 'Near copy must be gone before the retreat begins');
  assert.equal(exit.cardBlend, 0, 'The photograph must still be full size at copy exit');
  assert.ok(moving.cardBlend > 0 && moving.cardBlend < 1,
    'The camera retreat must still be moving instead of completing by ninety percent');
  close(docked.cardBlend, 1, 'The shared photograph must reach the final card frame');
  assert.equal(docked.productMapOpacity, 0, 'The map must wait until its card is docked');
  assert.equal(docked.productCopyOpacity, 0, 'Product copy must wait for the card and map handoff');
  const mapEntry = storyFrame(.955, 0);
  assert.ok(mapEntry.productPreviewOpacity > 0 && mapEntry.productMapOpacity > 0,
    'The preview and map must be able to appear independently of product copy');
  assert.equal(mapEntry.productCopyOpacity, 0, 'Map entry must not introduce competing copy');
  assert.equal(storyFrame(.96, 0).productCopyOpacity, 0, 'Copy must begin after the map entry');
  const stable = storyFrame(.985, 0);
  close(stable.productPreviewOpacity, 1, 'The stable product anchor must expose the complete card');
  close(stable.productMapOpacity, 1, 'The stable product anchor must expose the complete map');
  close(stable.productCopyOpacity, 1, 'The stable product anchor must expose readable copy');
});

test('chapter phases and destination anchors agree with their readable compositions', () => {
  const samples = [
    [0, 'city'], [.2399, 'city'], [.24, 'route'], [.5599, 'route'],
    [.56, 'theatre'], [.8999, 'theatre'], [.9, 'product'], [1, 'product'],
  ];
  for (const [p, phase] of samples) assert.equal(storyFrame(p, 0).phase, phase, `phase at ${p}`);
  for (const [phase, progress] of [['route', .36], ['theatre', .66], ['product', .985]]) {
    const chapter = storyChapters.find(chapter => chapter.phase === phase);
    close(chapter?.progress, progress, `${phase} destination must reach its stable composition`);
    assert.equal(storyPanelReadable(storyFrame(chapter.progress, 0), phase, true), true,
      `${phase} destination must expose its actual readable controls`);
  }
});

test('all opacity and camera poses remain finite and reversible across the full story', () => {
  const target = { top: 24, right: 8, bottom: 20, left: 52 };
  for (let i = 0; i <= 200; i++) {
    const p = i / 200;
    const forward = storyFrame(p, 0, target), reverse = storyFrame(p, 1, target);
    for (const property of ['coastMediaOpacity', 'productPreviewOpacity', 'productMapOpacity']) {
      assert.ok(Number.isFinite(forward[property]), `${property} must exist and be finite at ${p}`);
    }
    for (const [property, value] of Object.entries(forward)) {
      if (typeof value !== 'number') continue;
      assert.ok(Number.isFinite(value), `${property} must stay finite at ${p}`);
      if (/opacity/i.test(property)) assert.ok(value >= 0 && value <= 1, `${property} must stay bounded at ${p}`);
      if (property !== 'direction') assert.equal(reverse[property], value,
        `Reverse scrolling must recover ${property} at ${p}`);
    }
    assert.equal(reverse.phase, forward.phase, `Reverse scrolling must recover phase at ${p}`);
  }
});
