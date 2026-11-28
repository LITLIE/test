import test from 'node:test';
import assert from 'node:assert/strict';
import * as spatial from '../../src/motion/seaRouteMath.ts';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const geometry = { width: 1200, heroHeight: 900, waterline: 650, routeLeft: 100, routeTop: 200, routeWidth: 600, routeHeight: 300, mobile: false };
const seed = { x: .5, depth: .5, phase: 0, routeT: .5, warmth: .5 };
const project = (...args) => {
  assert.equal(typeof spatial.projectSpatialSeaRouteParticle, 'function', 'The spatial field must project actual depth onto the canvas');
  return spatial.projectSpatialSeaRouteParticle(...args);
};
const pose = value => {
  assert.equal(typeof spatial.presentationCameraPose, 'function', 'Photography and particles need one continuous presentation camera');
  return spatial.presentationCameraPose(value);
};

test('near particles project larger and farther from the optical centre than distant particles', () => {
  const near = project({ ...seed, depth: 1 }, 0, geometry, 0, 0);
  const far = project({ ...seed, depth: 0 }, 0, geometry, 0, 0);
  assert.ok(near.z > 0 && far.z < 0);
  assert.ok(near.perspectiveScale > 1 && far.perspectiveScale < 1);
  assert.ok(near.radius > far.radius && near.glowRadius > far.glowRadius);
  assert.ok(Math.abs(near.x - 600) > Math.abs(far.x - 600), 'Depth must affect position as well as particle size');
});

test('completed particles land on literal SVG endpoints and stop reacting to the clock or camera', () => {
  for (const [routeT, x, y] of [[0, 184, 434], [.5, 400, 332], [1, 616, 254]]) {
    const point = project({ ...seed, routeT }, 1, geometry, 0, .5);
    assert.ok(Math.abs(point.x - x) < 1e-10);
    assert.ok(Math.abs(point.y - y) < 1e-10);
    assert.equal(point.z, 0);
    assert.equal(point.perspectiveScale, 1);
    assert.equal(point.radius, 1.05);
    assert.deepEqual(project({ ...seed, routeT }, 1, geometry, 90000, .9), point);
    const legacy = spatial.projectSeaRouteParticle({ ...seed, routeT }, 1, geometry, 0);
    assert.equal(point.x, legacy.x);
    assert.equal(point.y, legacy.y);
  }
});

test('reverse scrolling reconstructs the same seeded spatial field without accumulated transforms', () => {
  const field = spatial.createSeaRouteField(8);
  const forward = field.map(item => project(item, .38, geometry, 1200, .31));
  const forwardCamera = pose(.31);
  field.forEach(item => project(item, .61, geometry, 2400, .47));
  pose(.47);
  const reverse = field.map(item => project(item, .38, geometry, 1200, .31));
  assert.deepEqual(reverse, forward);
  assert.deepEqual(pose(.31), forwardCamera);
});

test('holding active time freezes the sea while a later active clock moves the unfinished field', () => {
  const point = project(seed, .1, geometry, 1200, .2);
  assert.deepEqual(project(seed, .1, geometry, 1200, .2), point);
  assert.notEqual(project(seed, .1, geometry, 2200, .2).x, point.x);
});

test('the presentation camera travels continuously through every chapter boundary within gentle limits', () => {
  const neutral = pose(0);
  assert.deepEqual(neutral, { panX: 0, panY: 0, rotateX: 0, rotateY: 0, coastZ: 0, theatreZ: 0, detailZ: 0 });
  assert.ok(Object.values(pose(.42)).some(value => Math.abs(value) > .1), 'The shared camera must actually move through the spatial stage');
  for (let step = 0; step <= 1000; step++) {
    const camera = pose(step / 1000);
    for (const [key, value] of Object.entries(camera)) {
      assert.ok(Number.isFinite(value), key);
      const ceiling = key.startsWith('rotate') ? 2 : key.endsWith('Z') ? 120 : 4;
      assert.ok(Math.abs(value) <= ceiling, key);
    }
  }
  for (const boundary of [.18, .5, .8]) {
    const before = pose(boundary - 1e-7), after = pose(boundary + 1e-7);
    for (const key of Object.keys(before)) assert.ok(Math.abs(after[key] - before[key]) < .001, key + ' must not snap at a chapter boundary');
  }
});

test('particle colour converges smoothly into the route instead of switching at a story threshold', () => {
  const sea = project(seed, 0, geometry, 0, .1);
  const route = project(seed, 1, geometry, 0, .6);
  assert.ok(sea.colorR > route.colorR && sea.colorG > route.colorG && sea.colorB > route.colorB);
  const before = project(seed, .36 - 1e-7, geometry, 0, .3 - 1e-7);
  const after = project(seed, .36 + 1e-7, geometry, 0, .3 + 1e-7);
  for (const key of ['colorR', 'colorG', 'colorB']) assert.ok(Math.abs(after[key] - before[key]) < .001);
});

test('nonfinite inputs and invalid viewport dimensions stay finite with bounded perspective', () => {
  for (const invalid of [NaN, Infinity, -Infinity, -100, Number.MAX_VALUE]) {
    const point = project({ x: invalid, depth: invalid, phase: invalid, routeT: invalid, warmth: invalid }, invalid,
      { width: invalid, heroHeight: invalid, waterline: invalid, routeLeft: invalid, routeTop: invalid, routeWidth: invalid, routeHeight: invalid, mobile: true }, invalid, invalid);
    for (const [key, value] of Object.entries(point)) assert.ok(Number.isFinite(value), key);
    assert.ok(point.perspectiveScale >= .5 && point.perspectiveScale <= 2);
    assert.ok(point.radius > 0 && point.opacity >= 0 && point.opacity <= 1);
    for (const value of Object.values(pose(invalid))) assert.ok(Number.isFinite(value));
  }
});

// The native Canvas boundary records actual renderer output; maths and component code run unchanged.
function rendererHarness(mobile = false) {
  const drawing = [], gradients = [];
  const canvasContext = record => ({
    globalAlpha: 1,
    clearRect(...args) { if (record) drawing.push({ kind: 'clear', args }); },
    setTransform() {}, beginPath() {},
    ellipse(...args) { if (record) drawing.push({ kind: 'ellipse', args }); },
    fill() { if (record) drawing.push({ kind: 'fill', style: this.fillStyle }); },
    fillRect() {},
    drawImage(...args) { if (record) drawing.push({ kind: 'glow', args, alpha: this.globalAlpha }); },
    createRadialGradient() { const gradient = { addColorStop() {} }; gradients.push(gradient); return gradient; },
  });
  const context = canvasContext(true), canvas = { dataset: {}, width: 0, height: 0, getContext: () => context };
  const width = mobile ? 600 : 1200;
  const viewport = { getBoundingClientRect: () => ({ width, height: 900, left: 0, top: 0 }) };
  const opening = {
    dataset: {},
    querySelector(selector) { return selector === '.hero' ? { offsetHeight: 900 } : { getBoundingClientRect: () => ({ width: 600, height: 300, left: 100, top: 200 }) }; },
    querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  let listener, cleanup, invalidations = 0;
  const effects = [];
  const controller = {
    subscribe(next) { listener = next; return () => { listener = null; }; },
    invalidate() { invalidations++; },
  };
  const module = { exports: {} };
  const source = readFileSync(new URL('../../src/components/SeaRouteParticles.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'element', target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useRef: () => ({ current: canvas }), useEffect: fn => effects.push(fn) } : spatial,
    element: () => null,
    window: { devicePixelRatio: 3, addEventListener() {}, removeEventListener() {} },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext(false) }) },
  });
  module.exports.default({ openingRef: { current: opening }, viewportRef: { current: viewport }, controller });
  cleanup = effects[0]();
  return { drawing, gradients, canvas, emit: snapshot => listener?.(snapshot), dispose: () => cleanup(), invalidations: () => invalidations };
}
const snapshot = (value, activeTime, running = true) => ({ value, activeTime, running, phase: 'city', sticky: true, particleProgress: Math.max(0, Math.min(1, (value - .1) / .55)) });

test('the renderer paints cached soft glows without allocating gradients on successive frames', () => {
  const renderer = rendererHarness();
  renderer.emit(snapshot(.2, 0));
  assert.ok(renderer.drawing.some(command => command.kind === 'glow'), 'Particles need soft depth halos in addition to their cores');
  const cached = renderer.gradients.length;
  assert.ok(cached > 0 && cached <= 4, 'The field shares a small palette of sprites');
  renderer.emit(snapshot(.2, 20));
  assert.equal(renderer.gradients.length, cached);
  assert.equal(renderer.canvas.width, 1800, 'Desktop DPR stays capped at 1.5');
  renderer.dispose();
});

test('frame caps spare repeated clock frames while navigation and reverse scroll redraw immediately', () => {
  for (const mobile of [false, true]) {
    const renderer = rendererHarness(mobile);
    renderer.emit(snapshot(.2, 0));
    const initial = renderer.drawing.length;
    assert.equal(renderer.drawing.filter(command => command.kind === 'ellipse').length, mobile ? 100 : 280);
    renderer.emit(snapshot(.2, 4));
    assert.equal(renderer.drawing.length, initial, 'A clock-only callback inside the frame budget must not redraw');
    renderer.emit(snapshot(.21, 4));
    assert.ok(renderer.drawing.length > initial, 'Scroll navigation must not wait for the active clock');
    const navigated = renderer.drawing.length;
    renderer.emit(snapshot(.2, 4));
    assert.ok(renderer.drawing.length > navigated, 'Reverse navigation must redraw at the same active time');
    const reversed = renderer.drawing.length;
    renderer.emit(snapshot(.2, 24));
    if (mobile) assert.equal(renderer.drawing.length, reversed, 'Mobile clock frames wait for the 30Hz budget');
    else assert.ok(renderer.drawing.length > reversed, 'Desktop clock frames can draw within the 60Hz budget');
    assert.equal(renderer.canvas.width, mobile ? 600 : 1800);
    renderer.dispose();
  }
});

test('paused and disposed renderers draw nothing and clear the finished field once', () => {
  const renderer = rendererHarness();
  renderer.emit(snapshot(.2, 0));
  const count = renderer.drawing.length;
  renderer.emit(snapshot(.2, 2000, false));
  assert.equal(renderer.drawing.length, count);
  renderer.emit(snapshot(.6, 2000));
  const cleared = renderer.drawing.length;
  assert.equal(renderer.drawing.at(-1).kind, 'clear');
  renderer.emit(snapshot(.7, 3000));
  assert.equal(renderer.drawing.length, cleared);
  renderer.dispose();
  renderer.emit(snapshot(.2, 4000));
  assert.equal(renderer.drawing.length, cleared);
  assert.equal(renderer.canvas.width, 0);
});

test('continuously changing follower progress stays inside the desktop and mobile frame budgets', () => {
  for (const mobile of [false, true]) {
    const renderer = rendererHarness(mobile);
    renderer.emit({ ...snapshot(.2, 0), targetValue: .4 });
    const initial = renderer.drawing.length;
    renderer.emit({ ...snapshot(.21, 4), targetValue: .4 });
    assert.equal(renderer.drawing.length, initial, 'The follower must not bypass the frame budget when its visual value changes');
    renderer.emit({ ...snapshot(.22, 8), targetValue: .4 });
    assert.equal(renderer.drawing.length, initial);
    renderer.emit({ ...snapshot(.25, mobile ? 40 : 20), targetValue: .4 });
    assert.ok(renderer.drawing.length > initial, 'The latest follower composition is painted once the frame budget allows it');
    renderer.dispose();
  }
});

test('a settled target or explicit snap paints its endpoint without waiting for another clock frame', () => {
  const renderer = rendererHarness();
  renderer.emit({ ...snapshot(.2, 0), targetValue: .4 });
  const following = renderer.drawing.length;
  renderer.emit({ ...snapshot(.4, 4), targetValue: .4 });
  assert.ok(renderer.drawing.length > following, 'Settling must paint the exact endpoint even inside the frame budget');
  const settled = renderer.drawing.length;
  renderer.emit({ ...snapshot(.26, 4), targetValue: .26 });
  assert.ok(renderer.drawing.length > settled, 'An explicit same-time snap is immediate');
  renderer.dispose();
});
