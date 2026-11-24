import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSceneLayout,
  createSvgProjection,
  createWorldProjection,
  isWgs84Coordinate,
  projectWgs84,
} from '../../src/features/experience/map/projection.ts';
import * as projection from '../../src/features/experience/map/projection.ts';

const fact = value => ({ value, status: 'reference', sourceId: 'manual-control', checkedAt: null });
const point = (id, coordinates, category = 'coast') => ({
  id, name: id, category, description: '手工测试点', coordinates: fact(coordinates),
  coordinateSystem: 'WGS84', pointKind: 'reference', entranceVerified: false,
  visitMode: 'exterior', stayMinutes: fact(10), opening: fact(null), fee: fact(null),
  accessibility: fact(null), sourceIds: ['manual-control'],
});
const catalog = {
  version: 'manual-v1', asOf: '2026-11-24', city: '控制点城市', timeZone: 'Asia/Hong_Kong',
  originPlaceId: 'origin', places: [
    point('origin', [113, 22]),
    point('east', [113.001, 22]),
    point('north', [113, 22.001], 'park'),
  ], sources: [], policy: {},
};
const leg = (id, fromPlaceId, toPlaceId, coordinates) => ({
  id, fromPlaceId, toPlaceId, transport: 'walk', geometry: { kind: 'schematic', coordinates },
  distanceKm: fact(0.1), durationMinutes: fact(2), walkingKm: 0.1,
});
const makePlan = (orderedPlaceIds, legs) => ({ id: 'manual-plan', versionNo: 1, orderedPlaceIds, legs });
const near = (actual, expected, tolerance = 0.001) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);

test('WGS84 control points use longitude first and preserve east/north in metres', () => {
  assert.deepEqual(projectWgs84([113, 22], [113, 22]), { x: 0, y: 0 });
  const east = projectWgs84([113.001, 22], [113, 22]);
  const north = projectWgs84([113, 22.001], [113, 22]);
  // Independent small-distance controls: mean Earth radius 6371008.8 m;
  // one degree latitude = 111195.0802 m, at 22° one degree longitude = 103098.2831 m.
  near(east.x, 103.0982831);
  near(east.y, 0);
  near(north.x, 0);
  near(north.y, 111.1950802);
});

test('the SVG and Three world adapters share one projected frame and preserve aspect', () => {
  const layout = buildSceneLayout(catalog, null);
  const svg = createSvgProjection(layout.bounds, 720, 520, 32);
  const world = createWorldProjection(layout.bounds, 120);
  const [origin, east, north] = ['origin', 'east', 'north'].map(id => layout.points.find(p => p.place.id === id).local);
  const so = svg(origin), se = svg(east), sn = svg(north);
  const wo = world(origin), we = world(east), wn = world(north);
  assert.ok(se.x > so.x && we.x > wo.x);
  assert.ok(sn.y < so.y && wn.z < wo.z);
  near((se.x - so.x) / (so.y - sn.y), (we.x - wo.x) / (wo.z - wn.z), 1e-10);
});

test('route legs are drawn in orderedPlaceIds order even when the legs array is shuffled', () => {
  const plan = makePlan(['origin', 'east', 'north'], [
    leg('second', 'east', 'north', [[113.001, 22], [113, 22.001]]),
    leg('first', 'origin', 'east', [[113, 22], [113.0005, 22.0002], [113.001, 22]]),
    leg('unrelated', 'north', 'origin', [[113, 22.001], [113, 22]]),
  ]);
  const layout = buildSceneLayout(catalog, plan);
  assert.deepEqual(layout.currentLegs.map(item => item.id), ['first', 'second']);
  assert.deepEqual(layout.routePlaceIds, ['origin', 'east', 'north']);
  assert.equal(layout.currentLegs[0].points.length, 3);
  const byId = new Map(layout.points.map(item => [item.place.id, item.local]));
  for (const routeLeg of layout.currentLegs) {
    assert.deepEqual(routeLeg.points[0], byId.get(routeLeg.fromPlaceId));
    assert.deepEqual(routeLeg.points.at(-1), byId.get(routeLeg.toPlaceId));
  }
  assert.deepEqual(layout.points.map(item => [item.place.id, item.order]), [['origin', 1], ['east', 2], ['north', 3]]);
});

test('previous routes remain separate and share the current coordinate frame', () => {
  const previous = makePlan(['origin', 'north'], [leg('old', 'origin', 'north', [[113, 22], [113, 22.001]])]);
  const current = makePlan(['origin', 'east'], [leg('new', 'origin', 'east', [[113, 22], [113.001, 22]])]);
  const layout = buildSceneLayout(catalog, current, previous);
  assert.deepEqual(layout.currentLegs.map(item => item.id), ['new']);
  assert.deepEqual(layout.previousLegs.map(item => item.id), ['old']);
  assert.deepEqual(layout.currentLegs[0].points[0], layout.previousLegs[0].points[0]);
  assert.equal(layout.points.find(item => item.place.id === 'north').previousOrder, 2);
  assert.equal(layout.points.find(item => item.place.id === 'north').order, null);
});

test('invalid and non-WGS84 catalogue points are excluded without drawing a false zero coordinate', () => {
  const invalidCatalog = { ...catalog, places: [
    ...catalog.places,
    point('missing', null), point('nonfinite', [NaN, 22]), point('range', [113, 100]),
    { ...point('other-crs', [113, 22]), coordinateSystem: 'GCJ02' },
  ] };
  const layout = buildSceneLayout(invalidCatalog, null);
  assert.deepEqual(layout.points.map(item => item.place.id), ['origin', 'east', 'north']);
  assert.deepEqual(layout.rejectedPlaceIds, ['missing', 'nonfinite', 'range', 'other-crs']);
  assert.equal(layout.currentLegs.length, 0);
});

test('invalid route geometry and absent legs are reported rather than replaced with invented routes', () => {
  const plan = makePlan(['origin', 'east', 'north'], [
    leg('invalid', 'origin', 'east', [[113, 22], [Infinity, 22], [113.001, 22]]),
  ]);
  const layout = buildSceneLayout(catalog, plan);
  assert.equal(layout.currentLegs.length, 0);
  assert.deepEqual(layout.rejectedLegIds, ['invalid', 'east→north']);
});

test('coordinate validation rejects missing, swapped out-of-range and nonfinite controls', () => {
  for (const invalid of [null, [], [113], [113, NaN], [Infinity, 22], [22, 113], [181, 22], [113, -91]]) {
    assert.equal(isWgs84Coordinate(invalid), false);
    assert.throws(() => projectWgs84(invalid, [113, 22]), RangeError);
  }
  assert.equal(isWgs84Coordinate([113, 22]), true);
  assert.throws(() => projectWgs84([113, 22], [113, 90]), RangeError);
});

test('empty catalogues still provide finite shared map and scene bounds', () => {
  const layout = buildSceneLayout({ ...catalog, places: [] }, null);
  assert.equal(layout.points.length, 0);
  for (const value of Object.values(layout.bounds)) assert.equal(Number.isFinite(value), true);
  assert.ok(layout.bounds.maxX > layout.bounds.minX && layout.bounds.maxY > layout.bounds.minY);
  assert.deepEqual(createSvgProjection(layout.bounds, 720, 520, 32)({ x: 0, y: 0 }), { x: 360, y: 260 });
});

test('route fitting includes every supplied reference and intermediate vertex on a narrow map', () => {
  const references = [{ x: -120, y: -1500 }, { x: 350, y: 1100 }, { x: 950, y: 2800 }];
  const fitted = projection.fitMapBounds(references, { minX: -100, maxX: 100, minY: -100, maxY: 100 });
  const project = createSvgProjection(fitted, 320, 550, 32);
  for (const reference of references) {
    const position = project(reference);
    assert.ok(position.x >= 32 && position.x <= 288);
    assert.ok(position.y >= 32 && position.y <= 518);
  }
  assert.deepEqual(projection.fitMapBounds([], { minX: -100, maxX: 100, minY: -200, maxY: 200 }),
    { minX: -100, maxX: 100, minY: -200, maxY: 200 });
});

test('zooming preserves metre scale while pan can reach and stops at catalogue edges', () => {
  const frame = { minX: 0, maxX: 1000, minY: 0, maxY: 2000 };
  assert.deepEqual(projection.createMapViewportBounds(frame, 2, { x: 50, y: -50 }, frame),
    { minX: 300, maxX: 800, minY: 450, maxY: 1450 });
  assert.deepEqual(projection.createMapViewportBounds(frame, 2, { x: 9000, y: 9000 }, frame),
    { minX: 500, maxX: 1000, minY: 1000, maxY: 2000 });
  near(projection.svgMetresPerPixel(frame, 320, 550, 32), 2000 / 486);
  assert.throws(() => projection.createMapViewportBounds(frame, 0), RangeError);
  assert.throws(() => projection.svgMetresPerPixel(frame, NaN, 550, 32), RangeError);
});

test('dense map names remain inside a phone-sized frame without overlapping each other', () => {
  const inputs = Array.from({ length: 10 }, (_, index) => ({
    id: `dense-${index}`, anchor: { x: 140 + index % 3 * 6, y: 170 + index * 4 },
    lines: [index % 2 ? '珠海规划展览馆' : '香炉湾沙滩'], preferredSide: index % 2 ? 'left' : 'right',
  }));
  const labels = projection.layoutMapLabels(inputs, 320, 550);
  assert.equal(labels.length, 10);
  for (const item of labels) {
    assert.ok(item.label.x >= 10 && item.label.y >= 10);
    assert.ok(item.label.x + item.label.width <= 310);
    assert.ok(item.label.y + item.label.height <= 540);
  }
  for (let first = 0; first < labels.length; first += 1) {
    for (let second = first + 1; second < labels.length; second += 1) {
      const a = labels[first].label, b = labels[second].label;
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
        `${labels[first].id} overlaps ${labels[second].id}`);
    }
  }
});
