import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, InstancedMesh, Texture, NoColorSpace, Matrix4, Vector3 } from 'three';
import { catalog } from '../../src/features/experience/data/catalog.ts';
import { makeDefaultDraft } from '../../src/features/experience/config.ts';
import { proposeCuratedPlan } from '../../src/features/experience/domain/curated-planner.ts';
import { buildSceneLayout } from '../../src/features/experience/map/projection.ts';
import { buildPaperTerrain } from '../../src/features/experience/scene/paperTerrain.ts';
import { buildPaperCity, buildRouteOverlay, disposeObject, objectBudget } from '../../src/features/experience/scene/paperCityModel.ts';
import * as coastalEnvironment from '../../src/features/experience/scene/coastalEnvironment.ts';

const inside = (point, polygon) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
};

test('panorama rotation samples the HDR sun in the direction of the direct light', () => {
  assert.equal(typeof coastalEnvironment.panoramaRotationForSun, 'function', 'The HDR and sun need a shared azimuth alignment');
  const sun = new Vector3(0, 0.3, 1);
  const angle = coastalEnvironment.panoramaRotationForSun(0.2, sun);
  // Three r170 negates the scene Euler before its PBR environment sampling matrix.
  const sample = sun.clone().applyMatrix4(new Matrix4().makeRotationY(-angle));
  assert.ok(Math.abs(Math.atan2(sample.z, sample.x) - 0.2) < 0.00001);
});

test('the opera and Yeli Island references sit on one connected island', () => {
  const layout = buildSceneLayout(catalog, null);
  const terrain = buildPaperTerrain(layout);
  const opera = layout.points.find(point => point.place.id === 'ZS-004').local;
  const island = layout.points.find(point => point.place.id === 'ZS-005').local;
  assert.ok(terrain.islands.some(polygon => inside(opera, polygon) && inside(island, polygon)),
    'The two references must share land instead of producing separate overlapping island discs');
});

test('the coastal model stays within the mobile geometry and draw budget', () => {
  const result = proposeCuratedPlan(catalog, makeDefaultDraft(), null, { requestId: 'geometry-budget', sessionEpoch: 1, draftRevision: 1, nowMs: 0 });
  assert.equal(result.kind, 'proposal');
  const layout = buildSceneLayout(catalog, result.proposal.candidate, null);
  const city = buildPaperCity(layout);
  const overlay = buildRouteOverlay(layout, layout.points, 'ZS-004', 'ZS-001');
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
  mobile.add(buildRouteOverlay(layout, layout.points, 'ZS-004', 'ZS-001').group);
  const mobileBudget = objectBudget(mobile);
  assert.ok(mobileBudget.triangles <= 50000, `mobile triangle budget: ${mobileBudget.triangles}`);
  assert.ok(mobileBudget.drawCalls <= 80, `mobile draw budget: ${mobileBudget.drawCalls}`);
  disposeObject(mobile);
});

test('all textures owned by a mounted model are released exactly once', () => {
  const city = buildPaperCity(buildSceneLayout(catalog, null));
  const textures = new Set();
  for (const texture of city.userData.ownedTextures) textures.add(texture);
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

test('shell, paving and asphalt keep distinct normal and roughness details in non-colour space', () => {
  const city = buildPaperCity(buildSceneLayout(catalog, null));
  const { shell, paving, asphalt, rock } = city.userData.materials;
  for (const slot of ['normalMap', 'roughnessMap']) {
    const maps = [shell[slot], paving[slot], asphalt[slot]];
    assert.ok(maps.every(texture => texture instanceof Texture), `Each architectural surface needs a ${slot}`);
    assert.equal(new Set(maps).size, 3, `Architectural ${slot} must not share one rock texture`);
    for (const texture of maps) {
      assert.notEqual(texture, rock[slot]);
      assert.equal(texture.colorSpace, NoColorSpace);
    }
  }
  disposeObject(city);
});

test('the theatre promenade has human-scale rails and a seawall spanning the water line', () => {
  const city = buildPaperCity(buildSceneLayout(catalog, null), undefined, 'low');
  const rails = city.getObjectByName('opera-promenade-rails');
  const seawall = city.getObjectByName('opera-seawall');
  const wetline = city.getObjectByName('opera-wet-waterline');
  assert.ok(rails && seawall && wetline, 'Near-view public edges need scale and a continuous wet waterline');
  const railBounds = new Box3().setFromObject(rails);
  assert.ok(railBounds.max.y - railBounds.min.y >= 0.7 && railBounds.max.y - railBounds.min.y <= 1.3);
  const wallBounds = new Box3().setFromObject(seawall);
  assert.ok(wallBounds.min.y < -0.17 && wallBounds.max.y > 0.08, 'The seawall must reach below and above the ocean');
  const wetBounds = new Box3().setFromObject(wetline);
  assert.ok(wetBounds.min.y < -0.17 && wetBounds.max.y > -0.17);
  for (const band of [seawall, wetline]) {
    const uv = band.geometry.getAttribute('uv'), indices = band.geometry.index.array;
    const [a, b, c] = indices;
    const area = (uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) - (uv.getX(c) - uv.getX(a)) * (uv.getY(b) - uv.getY(a));
    assert.ok(Math.abs(area) > 0.00001, 'Vertical wet stone needs a non-collapsed UV triangle for tangent-space normals');
    const position = band.geometry.getAttribute('position'), normal = band.geometry.getAttribute('normal');
    const center = new Box3().setFromObject(band).getCenter(new Vector3());
    let outward = 0;
    for (let index = 0; index < position.count; index += 1) outward += normal.getX(index) * (position.getX(index) - center.x) + normal.getZ(index) * (position.getZ(index) - center.z);
    assert.ok(outward > 0, 'The exterior waterline must face the sea so front-face culling does not hide it');
  }
  disposeObject(city);
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
