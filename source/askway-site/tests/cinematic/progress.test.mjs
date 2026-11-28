import test from 'node:test';
import assert from 'node:assert/strict';
import { storyProgress, storyFrame, advanceStoryTime } from '../../src/features/cinematic/progress.ts';
import * as progressPolicy from '../../src/features/cinematic/progress.ts';

test('native progress measures the sticky travel distance and clamps overscroll', () => {
  assert.equal(storyProgress(1800, 1000, 2600, 1000), .5);
  assert.equal(storyProgress(0, 1000, 2600, 1000), 0);
  assert.equal(storyProgress(4000, 1000, 2600, 1000), 1);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(storyProgress(value, 0, 2600, 1000), 0);
  assert.equal(storyProgress(10, 0, 0, 1000), 1);
});

test('the four chapter boundaries are explicit and retain finite visual parameters', () => {
  assert.deepEqual([0, .239, .24, .559, .56, .899, .9, 1].map(p => storyFrame(p, 0).phase), ['city', 'city', 'route', 'route', 'theatre', 'theatre', 'product', 'product']);
  for (const progress of [-1, NaN, Infinity, 0, .36, .66, .985, 2]) {
    const frame = storyFrame(progress, 0);
    for (const [key, value] of Object.entries(frame)) if (typeof value === 'number') assert.ok(Number.isFinite(value), key);
    for (const key of ['cityOpacity', 'routeOpacity', 'theatreOpacity', 'productOpacity', 'coastMediaOpacity', 'productPreviewOpacity', 'productMapOpacity', 'particleProgress']) assert.ok(frame[key] >= 0 && frame[key] <= 1, key);
  }
});

test('returning to the same progress restores the exact composition in either direction', () => {
  const forward = storyFrame(.37, .21), reverse = storyFrame(.37, .9);
  assert.equal(forward.direction, 1);
  assert.equal(reverse.direction, -1);
  const { direction: _forward, ...first } = forward;
  const { direction: _reverse, ...second } = reverse;
  assert.deepEqual(first, second);
  assert.equal(storyFrame(.37, .37).direction, 0);
});

test('changing viewport geometry derives the current target instead of accumulating frames', () => {
  assert.equal(storyProgress(800, 0, 2600, 1000), .5);
  assert.equal(storyProgress(800, 0, 2080, 800), .625);
  assert.equal(storyProgress(800, 0, 2600, 1000), .5);
});

test('paused active time does not advance or catch up the hidden interval on resume', () => {
  let clock = { activeTime: 0, lastTimestamp: null };
  clock = advanceStoryTime(clock, 100, true);
  clock = advanceStoryTime(clock, 116, true);
  assert.equal(clock.activeTime, 16);
  clock = advanceStoryTime(clock, 3000, false);
  assert.equal(clock.activeTime, 16);
  clock = advanceStoryTime(clock, 9000, true);
  assert.equal(clock.activeTime, 16);
  clock = advanceStoryTime(clock, 9016, true);
  assert.equal(clock.activeTime, 32);
});

test('late and nonfinite clock samples cannot rewind active time or add a long catch-up', () => {
  const clock = { activeTime: 200, lastTimestamp: 1000 };
  assert.equal(advanceStoryTime(clock, 990, true).activeTime, 200);
  assert.equal(advanceStoryTime(clock, NaN, true).activeTime, 200);
  assert.ok(advanceStoryTime(clock, 8000, true).activeTime <= 250);
});

test('the theatre copy is gone before its media enters the paper handoff and product copy waits', () => {
  const frame = storyFrame(.84, .7);
  assert.equal(frame.theatreCopyOpacity, 0);
  assert.equal(frame.productCopyOpacity, 0);
  assert.ok(frame.theatreMediaOpacity > .9, 'The landmark image remains while its white copy exits');
  assert.equal(storyFrame(.96, .84).productCopyOpacity, 0, 'Product copy must wait for the map handoff');
  assert.ok(storyFrame(.985, .84).productCopyOpacity > .99);
});

test('the media reaches the measured product rectangle before the product heading starts to enter', () => {
  const target = { top: 24, right: 8, bottom: 20, left: 52 };
  const frame = storyFrame(.94, .86, target);
  assert.ok(Math.abs(frame.cardInsetTop - 24) < 1e-6);
  assert.ok(Math.abs(frame.cardInsetRight - 8) < 1e-6);
  assert.ok(Math.abs(frame.cardInsetBottom - 20) < 1e-6);
  assert.ok(Math.abs(frame.cardInsetLeft - 52) < 1e-6);
  assert.equal(frame.productCopyOpacity, 0);
});

test('measured media geometry and independent copy fades are identical on reverse scroll', () => {
  const target = { top: 18, right: 7, bottom: 23, left: 49 };
  for (const value of [.57, .76, .86, .94, .985]) {
    const { direction: _forward, ...forward } = storyFrame(value, 0, target);
    const { direction: _reverse, ...reverse } = storyFrame(value, 1, target);
    assert.equal(typeof forward.cardBlend, 'number');
    assert.deepEqual(forward, reverse);
  }
});

test('sticky panels keep invisible or partially hidden controls out of the readable surface', () => {
  assert.equal(typeof progressPolicy.storyPanelReadable, 'function');
  const readable = progressPolicy.storyPanelReadable;
  assert.equal(readable(storyFrame(.84, 0), 'product', true), false);
  assert.equal(readable(storyFrame(.66, 0), 'theatre', true), true);
  assert.equal(readable(storyFrame(.66, 0), 'route', true), false);
  assert.equal(readable(storyFrame(.985, 0), 'product', true), true);
  assert.equal(readable(storyFrame(.2, 0), 'city', true), false);
  assert.equal(readable(storyFrame(.66, 0), 'route', false), true);
});

test('the final media transform covers and centres on the measured card rectangle', () => {
  const target = { top: 24, right: 8, bottom: 20, left: 52 };
  const frame = storyFrame(.94, .86, target);
  assert.ok(Math.abs(frame.mediaFitScale - .56) < 1e-6);
  assert.ok(Math.abs(frame.mediaShiftX - 22) < 1e-6);
  assert.ok(Math.abs(frame.mediaShiftY - 2) < 1e-6);
});

test('media scale and translation recover the same intermediate composition on reverse scroll', () => {
  const target = { top: 24, right: 8, bottom: 20, left: 52 };
  const forward = storyFrame(.86, .7, target), reverse = storyFrame(.86, .985, target);
  assert.ok(Math.abs(forward.mediaFitScale - .78) < 1e-6);
  assert.ok(Math.abs(forward.mediaShiftX - 11) < 1e-6);
  assert.ok(Math.abs(forward.mediaShiftY - 1) < 1e-6);
  for (const property of ['mediaFitScale', 'mediaShiftX', 'mediaShiftY']) assert.equal(reverse[property], forward[property]);
});

test('the product entry anchor displays fully opaque copy after the card and map handoff', () => {
  assert.equal(storyFrame(.985, 0).productCopyOpacity, 1);
});
