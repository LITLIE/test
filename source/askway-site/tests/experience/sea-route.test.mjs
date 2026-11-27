import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeaRouteField, projectSeaRouteParticle, routePoint, shouldAnimatePresentation } from '../../src/motion/seaRouteMath.ts';

const geometry = { width: 1440, heroHeight: 1000, waterline: 720, routeLeft: 740, routeTop: 1150, routeWidth: 580, routeHeight: 330, mobile: false };

test('sea particles keep the same starting coordinates on revisiting a page', () => {
  assert.deepEqual(createSeaRouteField(180), createSeaRouteField(180));
  assert.equal(createSeaRouteField(180).length, 180);
  assert.ok(createSeaRouteField(180).every(point => point.depth >= 0 && point.depth <= 1));
});

test('a formed route lands exactly on its curve and stays still while time passes', () => {
  for (const seed of createSeaRouteField(36)) {
    const expected = routePoint(seed.routeT);
    const point = projectSeaRouteParticle(seed, 1, geometry, 0);
    assert.ok(Math.abs(point.x - (geometry.routeLeft + expected.x * geometry.routeWidth)) < 1e-6);
    assert.ok(Math.abs(point.y - (geometry.routeTop + expected.y * geometry.routeHeight)) < 1e-6);
    assert.deepEqual(point, projectSeaRouteParticle(seed, 1, geometry, 100000));
  }
});

test('reverse scroll recovers the same intermediate shape without accumulated state', () => {
  const seed = createSeaRouteField(72)[31];
  const forward = [.05, .25, .4, .7, 1].map(progress => projectSeaRouteParticle(seed, progress, geometry, 2500));
  const backward = [1, .7, .4, .25, .05].map(progress => projectSeaRouteParticle(seed, progress, geometry, 2500)).reverse();
  assert.deepEqual(forward, backward);
  assert.notDeepEqual(forward[0], forward[4]);
});

test('overscroll and nonfinite progress retain finite positions in a narrow mobile frame', () => {
  const mobile = { ...geometry, width: 320, heroHeight: 760, waterline: 425, routeLeft: 24, routeTop: 1100, routeWidth: 272, routeHeight: 310, mobile: true };
  for (const progress of [-5, 0, .4, .7, 1, 4, NaN, Infinity]) {
    for (const seed of createSeaRouteField(80)) {
      const point = projectSeaRouteParticle(seed, progress, mobile, 0);
      assert.ok(Object.values(point).every(Number.isFinite));
    }
  }
  const seed = createSeaRouteField(80)[0];
  assert.deepEqual(projectSeaRouteParticle(seed, -5, mobile, 0), projectSeaRouteParticle(seed, 0, mobile, 0));
  assert.deepEqual(projectSeaRouteParticle(seed, 4, mobile, 0), projectSeaRouteParticle(seed, 1, mobile, 0));
});

test('continuous drawing stops for every presentation suspension condition', () => {
  const active = { paused: false, reducedMotion: false, visible: true, documentVisible: true, sceneActive: false };
  assert.equal(shouldAnimatePresentation(active), true);
  for (const condition of ['paused', 'reducedMotion', 'sceneActive']) assert.equal(shouldAnimatePresentation({ ...active, [condition]: true }), false);
  for (const condition of ['visible', 'documentVisible']) assert.equal(shouldAnimatePresentation({ ...active, [condition]: false }), false);
});
