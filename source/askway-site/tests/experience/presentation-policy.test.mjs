import test from 'node:test';
import assert from 'node:assert/strict';

const policy = await import('../../src/motion/presentationPolicy.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const required = name => {
  assert.equal(typeof policy[name], 'function', `${name} must implement the shared presentation policy`);
  return policy[name];
};
const running = { ready: true, paused: false, reducedMotion: false, documentVisible: true, saveData: false };
const stage = (id, priority, visible = true) => ({ id, priority, visible });

test('automatic presentation requires ready resources and every user and document permission', () => {
  const allowed = required('allowsPresentationMotion');
  assert.equal(allowed(running), true);
  for (const condition of ['ready', 'documentVisible']) {
    assert.equal(allowed({ ...running, [condition]: false }), false, condition);
  }
  for (const condition of ['paused', 'reducedMotion', 'saveData']) {
    assert.equal(allowed({ ...running, [condition]: true }), false, condition);
  }
});

test('the server and initial client state cannot start heavy presentation before preferences are known', () => {
  const allowed = required('allowsPresentationMotion');
  assert.equal(allowed({ ready: false, paused: false, reducedMotion: true, documentVisible: false, saveData: true }), false);
  assert.equal(allowed({ ...running, ready: false }), false);
});

test('a visible exploration surface takes continuous rendering ownership from the story', () => {
  const owner = required('selectPresentationSurface');
  assert.equal(owner([stage('city-story', 10), stage('city-showcase', 20)]), 'city-showcase');
  assert.equal(owner([stage('city-story', 10), stage('city-showcase', 20, false)]), 'city-story');
  assert.equal(owner([stage('city-story', 10, false), stage('city-showcase', 20, false)]), null);
  assert.equal(owner([]), null);
});

test('equal priorities have one deterministic owner independent of registration order', () => {
  const owner = required('selectPresentationSurface');
  const surfaces = [stage('showcase-b', 20), stage('showcase-a', 20), stage('city-story', 10)];
  const original = structuredClone(surfaces);
  assert.equal(owner(surfaces), 'showcase-a');
  assert.equal(owner([...surfaces].reverse()), 'showcase-a');
  assert.deepEqual(surfaces, original, 'Arbitration must not reorder the caller registry');
});

test('invalid priorities and unnamed surfaces cannot monopolize continuous rendering', () => {
  const owner = required('selectPresentationSurface');
  assert.equal(owner([stage('', 100), stage('bad-number', Infinity), stage('city-story', 10)]), 'city-story');
  assert.equal(owner([stage('bad-number', NaN), stage('city-story', 10)]), 'city-story');
});

test('unchanged surface registrations preserve registry identity instead of scheduling another render', () => {
  const update = required('updatePresentationSurface');
  const surfaces = [stage('city-story', 10)];
  assert.equal(update(surfaces, stage('city-story', 10)), surfaces);
  const withShowcase = update(surfaces, stage('city-showcase', 20));
  assert.equal(withShowcase.length, 2);
  assert.equal(required('selectPresentationSurface')(withShowcase), 'city-showcase');
  assert.equal(surfaces.length, 1, 'Registration must not mutate a previous React snapshot');
});

test('visibility changes and unmounts release the owner without changing other surfaces', () => {
  const update = required('updatePresentationSurface');
  const release = required('releasePresentationSurface');
  const owner = required('selectPresentationSurface');
  const surfaces = [stage('city-story', 10), stage('city-showcase', 20)];
  const hidden = update(surfaces, stage('city-showcase', 20, false));
  assert.equal(owner(hidden), 'city-story');
  assert.equal(owner(release(surfaces, 'city-showcase')), 'city-story');
  assert.equal(release(surfaces, 'absent'), surfaces);
  assert.equal(owner(surfaces), 'city-showcase', 'Releasing must not mutate the previous registry');
});

test('changing the local sea preference cannot bypass a suspended shared animation permission', () => {
  const animate = required('allowsSurfaceAnimation');
  for (const localPreference of [false, true, false, true]) assert.equal(animate(localPreference, false, false), false);
  assert.equal(animate(true, true, false), true);
  assert.equal(animate(false, true, false), false, 'Resuming must preserve the local pause preference');
  assert.equal(animate(true, true, true), false, 'A local toggle cannot bypass reduced motion either');
  assert.equal(animate(true), true, 'The existing workbench keeps its default animation permission');
});
