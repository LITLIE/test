import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, Mesh,
  Object3D, PlaneGeometry,
} from 'three';
import type { Material } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createWorldProjection } from '../map/projection.ts';
import type { SceneLayout, ScenePlacePoint } from '../map/projection.ts';
import { buildOcean } from './coastalEnvironment.ts';
import { createCoastalFrame } from './paperTerrain.ts';
import type { CoastalFrame } from './paperTerrain.ts';
import { createCoastalMaterials, foliageColor } from './realisticMaterials.ts';
import type { CoastalMaterials } from './realisticMaterials.ts';
import { buildOperaArchitecture } from './operaArchitecture.ts';

type WorldPoint = { x: number; z: number };
interface Tree { x: number; z: number; height: number; radius: number }

function mesh(geometry: BufferGeometry, material: Material, shadows = true) {
  const result = new Mesh(geometry, material);
  result.castShadow = shadows;
  result.receiveShadow = true;
  return result;
}

function transformedBox(size: [number, number, number], position: [number, number, number], rotationY = 0) {
  const geometry = new BoxGeometry(...size);
  geometry.applyMatrix4(new Matrix4().makeRotationY(rotationY));
  geometry.translate(...position);
  return geometry;
}

function batchBoxes(group: Group, boxes: { size: [number, number, number]; at: [number, number, number]; rotation?: number }[], material: Material) {
  const parts = boxes.map(box => transformedBox(box.size, box.at, box.rotation));
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (merged) group.add(mesh(merged, material));
}

function surface(
  rows: number, columns: number, pointAt: (u: number, v: number) => [number, number, number], material: Material,
) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
    const point = pointAt(column / columns, row / rows);
    positions.push(...point);
    uvs.push(point[0] / 9, -point[2] / 9);
  }
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if ('vertexColors' in material && material.vertexColors) {
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(positions.length).fill(1), 3));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(geometry, material, false);
}

function strip(frame: CoastalFrame, near: number, far: number, material: Material, lift = 0.015, extend = 0) {
  return surface(90, 2, (u, v) => {
    const z = frame.north - extend + v * (frame.south - frame.north + extend * 2);
    const x = frame.shoreXAt(z) - near - (far - near) * u;
    return [x, frame.heightAt(Math.min(x, frame.shoreXAt(z)), z) + lift, z];
  }, material);
}

function buildGround(group: Group, frame: CoastalFrame, materials: CoastalMaterials, quality: 'high' | 'low') {
  const land = surface(quality === 'high' ? 64 : 46, quality === 'high' ? 34 : 28, (u, v) => {
    const z = frame.north - 240 + v * (frame.south - frame.north + 480);
    const shore = frame.shoreXAt(z);
    const x = shore - 4.4 - Math.pow(u, 1.55) * 490;
    return [x, frame.heightAt(x, z), z];
  }, materials.grass);
  const landPosition = land.geometry.getAttribute('position');
  const colors: number[] = [];
  for (let index = 0; index < landPosition.count; index += 1) {
    const x = landPosition.getX(index), z = landPosition.getZ(index);
    const patch = 0.81 + Math.sin(x * 0.083 + Math.sin(z * 0.075)) * Math.cos(z * 0.041) * 0.19;
    colors.push(patch, 0.87 + patch * 0.13, patch * 0.92);
  }
  land.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  land.name = 'continuous-mainland';
  group.add(land);
  group.add(strip(frame, 0.35, 4.5, materials.sand, -0.012, 230));
  group.add(strip(frame, -0.75, 0.55, materials.wetSand, -0.065, 230));
  // Mainland's promenade and coast road follow the same outline, rather than cutting over the sea.
  group.add(strip(frame, 4.45, 6.05, materials.paving, 0.022, 170));
  group.add(strip(frame, 6.15, 8.65, materials.asphalt, 0.025, 150));
  for (const island of frame.islands) {
    const polar = (inner: number, outer: number, material: Material, lift = 0) => surface(48, 8, (u, v) => {
      const angle = v * Math.PI * 2;
      const radius = inner + (outer - inner) * u;
      const index = Math.floor(v * 48) % 48;
      const next = (index + 1) % 48;
      const fraction = v * 48 - Math.floor(v * 48);
      const edgeX = island.outline[index].x * (1 - fraction) + island.outline[next].x * fraction;
      const edgeZ = island.outline[index].z * (1 - fraction) + island.outline[next].z * fraction;
      const x = island.x + (edgeX - island.x) * radius;
      const z = island.z + (edgeZ - island.z) * radius;
      return [x, radius > 1 ? 0.015 + lift : frame.heightAt(x, z) + lift + Math.sin(angle * 4) * 0.018 * radius, z];
    }, material);
    group.add(polar(0, 0.83, materials.grass));
    group.add(polar(0.82, 1.015, materials.rock, -0.04));
    group.add(polar(0.99, 1.045, materials.wetSand, -0.07));
  }
  group.add(buildOcean(frame, materials, quality));
}

function buildOperaSeawall(group: Group, frame: CoastalFrame, materials: CoastalMaterials, opera: WorldPoint | null) {
  if (!opera) return;
  const island = frame.islands.find(item => Math.hypot((opera.x - item.x) / item.radiusX, (opera.z - item.z) / item.radiusZ) < 1);
  if (!island) return;
  const band = (bottom: number, top: number, radius: number, material: Material, name: string) => {
    const wall = surface(48, 1, (u, v) => {
      const progress = v * 48, index = Math.floor(progress) % 48, next = (index + 1) % 48, fraction = progress - Math.floor(progress);
      const a = island.outline[index], b = island.outline[next];
      const x = a.x + (b.x - a.x) * fraction, z = a.z + (b.z - a.z) * fraction;
      return [island.x + (x - island.x) * radius, bottom + (top - bottom) * u, island.z + (z - island.z) * radius];
    }, material);
    // Projection reverses the island winding; these upright faces must point out toward the sea.
    const indices = wall.geometry.index!;
    for (let index = 0; index < indices.count; index += 3) {
      const second = indices.getX(index + 1);
      indices.setX(index + 1, indices.getX(index + 2));
      indices.setX(index + 2, second);
    }
    wall.geometry.computeVertexNormals();
    const uv = wall.geometry.getAttribute('uv');
    let distance = 0;
    for (let row = 0; row <= 48; row += 1) {
      if (row > 0) {
        const previous = island.outline[(row - 1) % 48], current = island.outline[row % 48];
        distance += Math.hypot(current.x - previous.x, current.z - previous.z);
      }
      for (let column = 0; column <= 1; column += 1) uv.setXY(row * 2 + column, distance / 4, column * (top - bottom) / 4);
    }
    wall.name = name;
    group.add(wall);
  };
  band(-0.39, 0.18, 1.045, materials.rock, 'opera-seawall');
  // A lower roughness, dark belt hugs the physical ocean level (-0.17); no animated foam layer.
  band(-0.3, -0.075, 1.046, materials.wetRock, 'opera-wet-waterline');
}

function roadGeometry(frame: CoastalFrame, paths: { points: WorldPoint[]; width: number; dashed?: boolean }[]) {
  const positions: number[] = [], uvs: number[] = [];
  const segment = (a: WorldPoint, b: WorldPoint, width: number) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return;
    const ox = -dz / length * width / 2, oz = dx / length * width / 2;
    const vertices = [
      [a.x + ox, frame.heightAt(a.x + ox, a.z + oz) + 0.055, a.z + oz],
      [a.x - ox, frame.heightAt(a.x - ox, a.z - oz) + 0.055, a.z - oz],
      [b.x + ox, frame.heightAt(b.x + ox, b.z + oz) + 0.055, b.z + oz],
      [b.x - ox, frame.heightAt(b.x - ox, b.z - oz) + 0.055, b.z - oz],
    ];
    for (const index of [0, 2, 1, 1, 2, 3]) { positions.push(...vertices[index]); uvs.push(vertices[index][0] / 8, vertices[index][2] / 8); }
  };
  for (const path of paths) for (let index = 1; index < path.points.length; index += 1) {
    const a = path.points[index - 1], b = path.points[index];
    if (!path.dashed) { segment(a, b, path.width); continue; }
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    for (let offset = 0; offset < length; offset += 3) {
      const start = offset / length, end = Math.min(offset + 1.3, length) / length;
      segment({ x: a.x + (b.x - a.x) * start, z: a.z + (b.z - a.z) * start }, { x: a.x + (b.x - a.x) * end, z: a.z + (b.z - a.z) * end }, path.width);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function buildUrbanContext(group: Group, frame: CoastalFrame, layout: SceneLayout, materials: CoastalMaterials, trees: Tree[]) {
  const project = createWorldProjection(layout.bounds);
  const references = layout.points.map(point => ({ ...project(point.local), category: point.place.category, name: point.place.name }));
  const buildings: { x: number; z: number; width: number; depth: number; height: number; ground: number; angle: number; style: number }[] = [];
  const paths: { points: WorldPoint[]; width: number }[] = [];
  const west = frame.west - 3;
  for (let z = frame.north + 1.5; z < frame.south - 2; z += 10.5) {
    const shore = frame.shoreXAt(z);
    paths.push({ points: [{ x: west - 10, z: z - 4.75 }, { x: shore - 8.5, z: z - 4.75 }], width: 1.35 });
    for (let x = west; x < shore - 12; x += 9.5) {
      const index = buildings.length;
      if (references.some(point => Math.hypot(point.x - x, point.z - z) < (/日月|大剧院|馆/.test(point.name) ? 8 : point.category === 'park' ? 6 : 3.5))) continue;
      if (index >= 72) break;
      const variation = (Math.sin(x * 2.1 + z * 3.7) + 1) / 2;
      const style = (index * 7 + Math.floor(Math.abs(z))) % 5;
      const height = style === 2 ? 10.5 + variation * 6.4 : style === 1 ? 6.4 + variation * 4.1 : 2.8 + variation * 2.7;
      buildings.push({ x: x + Math.sin(index * 4.1) * 0.9, z: z + Math.sin(index * 3.31) * 1.1,
        width: style === 2 ? 2.7 : style === 3 ? 6.3 : 3.3 + index % 3 * 0.6,
        depth: style === 2 ? 2.8 : style === 4 ? 7.0 : 3.5 + index % 2 * 1.2,
        height, ground: frame.heightAt(x, z), angle: [0, 0.045, -0.11, 0.09][index % 4], style });
      if (index % 4 === 0) trees.push({ x: x + 3.3, z: z + 2.7, height: 2.35, radius: 1.1 });
    }
  }
  for (let x = west + 4.6; x < Math.max(...frame.coast.map(point => point.x)) - 9; x += 9.5) {
    const points = Array.from({ length: 25 }, (_, index) => ({ x, z: frame.north + (frame.south - frame.north) * index / 24 }))
      .filter(point => point.x < frame.shoreXAt(point.z) - 8);
    if (points.length > 1) paths.push({ points, width: 1.1 });
  }
  const road = mesh(roadGeometry(frame, paths), materials.asphalt, false);
  road.name = 'illustrative-city-streets';
  group.add(road);
  const linePath = frame.coast.map(point => ({ x: point.x - 7.4, z: point.z }));
  const roadLines = mesh(roadGeometry(frame, [{ points: linePath, width: 0.06, dashed: true }]), materials.paving, false);
  roadLines.position.y = 0.006;
  group.add(roadLines);
  if (!buildings.length) return;
  const dummy = new Object3D();
  const blocks = new InstancedMesh(new BoxGeometry(1, 1, 1), materials.facade, buildings.length);
  const roofs = new InstancedMesh(new BoxGeometry(1, 1, 1), materials.roof, buildings.length);
  const groundPads = new InstancedMesh(new BoxGeometry(1, 1, 1), materials.urbanGround, buildings.length);
  groundPads.receiveShadow = true;
  const towers = buildings.filter(building => building.style === 2);
  const glassTowers = towers.length ? new InstancedMesh(new BoxGeometry(1, 1, 1), materials.glass, towers.length) : null;
  if (glassTowers) glassTowers.castShadow = glassTowers.receiveShadow = true;
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  roofs.castShadow = true;
  roofs.receiveShadow = true;
  const windows: { x: number; y: number; z: number; angle: number; width: number }[] = [];
  buildings.forEach((building, index) => {
    dummy.rotation.set(0, building.angle, 0);
    dummy.position.set(building.x, building.ground + building.height / 2, building.z);
    dummy.scale.set(building.width, building.height, building.depth);
    dummy.updateMatrix();
    blocks.setMatrixAt(index, dummy.matrix);
    blocks.setColorAt(index, new Color(['#c8c5b6', '#aeb7b3', '#b8b7ad', '#d0c7b4', '#c6c9c4'][index % 5]));
    dummy.position.y = building.ground + building.height + 0.08;
    dummy.scale.set(building.width + 0.12, 0.16, building.depth + 0.12);
    dummy.updateMatrix();
    roofs.setMatrixAt(index, dummy.matrix);
    dummy.position.y = building.ground + 0.028;
    dummy.scale.set(Math.min(8.6, building.width + 2.6), 0.055, Math.min(9.0, building.depth + 2.5));
    dummy.updateMatrix();
    groundPads.setMatrixAt(index, dummy.matrix);
    const floors = Math.max(2, Math.floor(building.height / 0.95));
    for (let row = 0; row < floors; row += 1) for (let column = 0; column < 3; column += 1) {
      const y = building.ground + 0.52 + row * 0.93;
      const placeWindow = (localX: number, localZ: number, angle: number, width: number) => {
        windows.push({ x: building.x + localX * Math.cos(building.angle) + localZ * Math.sin(building.angle),
          y, z: building.z - localX * Math.sin(building.angle) + localZ * Math.cos(building.angle), angle: angle + building.angle, width });
      };
      placeWindow(-building.width * 0.32 + column * building.width * 0.32, building.depth / 2 + 0.013, 0, building.width * 0.23);
      placeWindow(building.width / 2 + 0.013, building.depth * 0.32 - column * building.depth * 0.32, Math.PI / 2, building.depth * 0.23);
    }
  });
  towers.forEach((building, index) => {
    dummy.rotation.set(0, building.angle, 0);
    dummy.position.set(building.x, building.ground + building.height / 2, building.z);
    dummy.scale.set(building.width + 0.018, building.height - 0.22, building.depth + 0.018);
    dummy.updateMatrix();
    glassTowers!.setMatrixAt(index, dummy.matrix);
  });
  const glazing = new InstancedMesh(new PlaneGeometry(1, 1), materials.glass, windows.length);
  windows.forEach((window, index) => {
    dummy.position.set(window.x, window.y, window.z);
    dummy.scale.set(window.width, 0.5, 1);
    dummy.rotation.set(0, window.angle, 0);
    dummy.updateMatrix();
    glazing.setMatrixAt(index, dummy.matrix);
  });
  group.add(groundPads, blocks, roofs, glazing);
  if (glassTowers) group.add(glassTowers);
}

function museum(materials: CoastalMaterials) {
  const group = new Group();
  group.name = 'museum-reference';
  batchBoxes(group, [
    { size: [9.4, 0.35, 6.8], at: [0, 0.17, 0] },
    { size: [8.7, 3.25, 4.8], at: [0, 1.94, -0.4] },
    { size: [1.3, 2.9, 5.2], at: [-4.0, 1.83, 0] },
    { size: [1.3, 2.9, 5.2], at: [4.0, 1.83, 0] },
  ], materials.paving);
  const front = mesh(new BoxGeometry(6.9, 2.7, 0.13), materials.glass);
  front.position.set(0, 1.92, 2.17);
  group.add(front);
  batchBoxes(group, [
    { size: [9.6, 0.3, 6.0], at: [0, 3.72, -0.25] },
    { size: [0.085, 2.7, 0.18], at: [-2.7, 1.92, 2.25] },
    { size: [0.085, 2.7, 0.18], at: [-0.9, 1.92, 2.25] },
    { size: [0.085, 2.7, 0.18], at: [0.9, 1.92, 2.25] },
    { size: [0.085, 2.7, 0.18], at: [2.7, 1.92, 2.25] },
  ], materials.metal);
  return group;
}

function waterfrontPavilion(materials: CoastalMaterials) {
  const group = new Group();
  batchBoxes(group, [
    { size: [3.2, 0.2, 2.6], at: [0, 0.12, 0] },
    { size: [0.14, 2.0, 0.14], at: [-1.2, 1.15, -0.95] },
    { size: [0.14, 2.0, 0.14], at: [1.2, 1.15, -0.95] },
    { size: [0.14, 2.0, 0.14], at: [-1.2, 1.15, 0.95] },
    { size: [0.14, 2.0, 0.14], at: [1.2, 1.15, 0.95] },
  ], materials.paving);
  const roof = mesh(new BoxGeometry(3.5, 0.18, 2.8), materials.roof);
  roof.position.y = 2.24;
  group.add(roof);
  return group;
}

function buildTrees(group: Group, frame: CoastalFrame, trees: Tree[], materials: CoastalMaterials, quality: 'high' | 'low') {
  const count = Math.min(trees.length, quality === 'high' ? 68 : 52);
  if (!count) return;
  const trunks = new InstancedMesh(new CylinderGeometry(0.12, 0.18, 1, 6), materials.bark, count);
  const sourceGeometry = new IcosahedronGeometry(1, quality === 'high' ? 2 : 1);
  const crownGeometry = mergeVertices(sourceGeometry);
  sourceGeometry.dispose();
  const position = crownGeometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    const scale = 1 + Math.sin(position.getX(index) * 9 + position.getZ(index) * 11) * 0.065;
    position.setXYZ(index, position.getX(index) * scale, position.getY(index) * scale, position.getZ(index) * scale);
  }
  crownGeometry.computeVertexNormals();
  const crowns = new InstancedMesh(crownGeometry, materials.foliage, count * 2);
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = true;
  const dummy = new Object3D();
  for (let index = 0; index < count; index += 1) {
    const tree = trees[index];
    const ground = frame.heightAt(tree.x, tree.z);
    dummy.position.set(tree.x, ground + tree.height * 0.39, tree.z);
    dummy.scale.set(1, tree.height * 0.78, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    for (let crown = 0; crown < 2; crown += 1) {
      dummy.position.set(tree.x + (crown ? 0.38 : -0.21) * tree.radius, ground + tree.height * (crown ? 0.93 : 0.74), tree.z + (crown ? -0.26 : 0.22) * tree.radius);
      dummy.scale.set(tree.radius * (crown ? 0.83 : 1), tree.radius * (crown ? 0.78 : 0.84), tree.radius * 0.88);
      dummy.rotation.set(0.1, index * 1.73, 0.05);
      dummy.updateMatrix();
      crowns.setMatrixAt(index * 2 + crown, dummy.matrix);
      crowns.setColorAt(index * 2 + crown, foliageColor(index + crown));
    }
  }
  group.add(trunks, crowns);
}

/** PBR coastal volume and architecture are authored references, not building/coastline survey data. */
export function buildCoastalCity(layout: SceneLayout, materials = createCoastalMaterials(), quality: 'high' | 'low' = 'high') {
  const group = new Group();
  group.name = 'askway-realistic-coastal-city';
  const frame = createCoastalFrame(layout);
  const project = createWorldProjection(layout.bounds);
  const trees: Tree[] = [];
  buildGround(group, frame, materials, quality);
  const landmarks: string[] = [];
  const addLandmark = (point: ScenePlacePoint | undefined, model: () => Group) => {
    if (!point) return;
    const position = project(point.local);
    const landmark = model();
    landmark.position.set(position.x, Math.max(0.13, frame.heightAt(position.x, position.z)), position.z);
    landmark.userData.referencePlaceId = point.place.id;
    group.add(landmark);
    landmarks.push(point.place.name);
  };
  addLandmark(layout.points.find(point => /日月|大剧院/.test(point.place.name)), () => buildOperaArchitecture(materials, quality));
  addLandmark(layout.points.find(point => /博物馆/.test(point.place.name)) ?? layout.points.find(point => /展览馆/.test(point.place.name)), () => museum(materials));
  const parks = layout.points.filter(point => point.place.category === 'park' && !/野狸/.test(point.place.name));
  addLandmark(parks.find(point => /海滨公园/.test(point.place.name)) ?? parks[0], () => waterfrontPavilion(materials));
  // Park trees are placed before the quieter city context, preserving landmark detail within a fixed budget.
  for (const park of parks) {
    const position = project(park.local);
    for (let index = 0; index < 12; index += 1) {
      const angle = index * 2.399963;
      const radius = 2.2 + index % 4 * 0.76;
      const x = position.x + Math.cos(angle) * radius, z = position.z + Math.sin(angle) * radius;
      if (x < frame.shoreXAt(z) - 2) trees.push({ x, z, height: 2.7 + index % 3 * 0.35, radius: 1.07 + index % 2 * 0.21 });
    }
  }
  const operaPoint = layout.points.find(point => /日月|大剧院/.test(point.place.name));
  const operaPosition = operaPoint ? project(operaPoint.local) : null;
  buildOperaSeawall(group, frame, materials, operaPosition);
  for (const island of frame.islands) for (let index = 0; index < 27; index += 1) {
    const angle = index * 2.399963;
    const radius = 0.24 + index % 6 * 0.105;
    const x = island.x + Math.cos(angle) * island.radiusX * radius;
    const z = island.z + Math.sin(angle) * island.radiusZ * radius;
    if (operaPosition && Math.abs(x - operaPosition.x) < 14.0 && Math.abs(z - operaPosition.z) < 14.0) continue;
    trees.push({ x, z, height: 2.0 + index % 4 * 0.29, radius: 0.86 + index % 3 * 0.14 });
  }
  for (let index = 0; index < 30; index += 1) {
    const z = frame.north + 2 + (frame.south - frame.north - 4) * index / 29;
    const x = frame.shoreXAt(z) - 5.35;
    trees.push({ x, z, height: 2.3 + index % 3 * 0.16, radius: 0.83 });
  }
  const urban = new Group();
  urban.name = 'illustrative-city-context';
  buildUrbanContext(urban, frame, layout, materials, trees);
  group.add(urban);
  buildTrees(group, frame, trees, materials, quality);
  group.userData.landmarks = landmarks;
  group.userData.coastalFrame = frame;
  group.userData.materials = materials;
  group.userData.ownedTextures = materials.ownedTextures;
  group.userData.cancelLoads = materials.cancelLoads;
  group.userData.referenceGeometry = true;
  group.userData.quality = quality;
  return group;
}
