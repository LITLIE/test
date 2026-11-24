import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, InstancedMesh, Texture } from 'three';
import { catalog } from '../../src/features/experience/data/catalog.ts';
import { buildSceneLayout } from '../../src/features/experience/map/projection.ts';
import { buildPaperTerrain } from '../../src/features/experience/scene/paperTerrain.ts';
import { buildPaperCity, buildRouteOverlay, disposeObject, objectBudget } from '../../src/features/experience/scene/paperCityModel.ts';

const inside = (point, polygon) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
};

test('the opera and Yeli Island references sit on one connected island', () => {
  const layout = buildSceneLayout(catalog, null);
  const terrain = buildPaperTerrain(layout);
  const opera = layout.points.find(point => point.place.id === 'ZS-004').local;
  const island = layout.points.find(point => point.place.id === 'ZS-005').local;
  assert.ok(terrain.islands.some(polygon => inside(opera, polygon) && inside(island, polygon)),
    'The two references must share land instead of producing separate overlapping island discs');
});

test('the coastal model stays within the mobile geometry and draw budget', () => {
  const layout = buildSceneLayout(catalog, null);
  const city = buildPaperCity(layout);
  const overlay = buildRouteOverlay(layout, layout.points, 'ZS-004', null);
  city.add(overlay.group);
  const budget = objectBudget(city);
  assert.ok(budget.triangles <= 100000, `desktop triangle budget: ${budget.triangles}`);
  assert.ok(budget.drawCalls <= 80, `draw budget: ${budget.drawCalls}`);
  city.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (const number of positions.array) assert.equal(Number.isFinite(number), true);
    if (object instanceof InstancedMesh) for (const number of object.instanceMatrix.array) assert.equal(Number.isFinite(number), true);
  });
  disposeObject(city);
  const mobile = buildPaperCity(layout, undefined, 'low');
  const mobileBudget = objectBudget(mobile);
  assert.ok(mobileBudget.triangles <= 50000, `mobile triangle budget: ${mobileBudget.triangles}`);
  assert.ok(mobileBudget.drawCalls <= 80, `mobile draw budget: ${mobileBudget.drawCalls}`);
  disposeObject(mobile);
});

test('all textures owned by a mounted model are released exactly once', () => {
  const city = buildPaperCity(buildSceneLayout(catalog, null));
  const textures = new Set();
  city.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  const released = new Map();
  for (const texture of textures) texture.addEventListener('dispose', () => released.set(texture, (released.get(texture) || 0) + 1));
  disposeObject(city);
  for (const texture of textures) assert.equal(released.get(texture), 1);
  assert.equal(city.children.length, 0);
});

test('every vertex-colour surface provides the colour data required by its shader', () => {
  const city = buildPaperCity(buildSceneLayout(catalog, null));
  city.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.vertexColors) continue;
      assert.ok(object.geometry.getAttribute('color'), `${object.name || object.type} would render black without its colour attribute`);
    }
  });
  disposeObject(city);
});
