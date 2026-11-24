import {
  BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh,
  LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Texture, TorusGeometry,
} from 'three';
import type { Material } from 'three';
import { createWorldProjection } from '../map/projection.ts';
import type { SceneLayout, SceneLeg, ScenePlacePoint } from '../map/projection.ts';
import { createCoastalFrame } from './paperTerrain.ts';
import { buildCoastalCity } from './coastalCityModel.ts';
import type { CoastalMaterials } from './realisticMaterials.ts';

const markerMaterial = (color: string) => new MeshStandardMaterial({ color, roughness: 0.47, metalness: 0.18 });

/** Kept for the existing lazy scene API; the implementation is a physical coastal model. */
export function buildPaperCity(layout: SceneLayout, materials?: CoastalMaterials, quality: 'high' | 'low' = 'high'): Group {
  return buildCoastalCity(layout, materials, quality);
}
type WorldPoint = { x: number; z: number };

function routeRibbon(legs: SceneLeg[], layout: SceneLayout, width: number, height: number, dashed: boolean) {
  const positions: number[] = [];
  const project = createWorldProjection(layout.bounds);
  const frame = createCoastalFrame(layout);
  const addStrip = (a: WorldPoint, b: WorldPoint) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return;
    const offsetX = -dz / length * width / 2;
    const offsetZ = dx / length * width / 2;
    const surfaceY = (x: number, z: number) => Math.max(0.12, frame.heightAt(x, z)) + height;
    const first = [a.x + offsetX, surfaceY(a.x + offsetX, a.z + offsetZ), a.z + offsetZ];
    const second = [a.x - offsetX, surfaceY(a.x - offsetX, a.z - offsetZ), a.z - offsetZ];
    const third = [b.x + offsetX, surfaceY(b.x + offsetX, b.z + offsetZ), b.z + offsetZ];
    const fourth = [b.x - offsetX, surfaceY(b.x - offsetX, b.z - offsetZ), b.z - offsetZ];
    positions.push(...first, ...second, ...third, ...third, ...second, ...fourth);
  };
  for (const leg of legs) {
    const points = leg.points.map(project);
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      if (!dashed) { addStrip(a, b); continue; }
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      for (let offset = 0; offset < length; offset += 3.6) {
        const start = offset / length;
        const end = Math.min(length, offset + 2.05) / length;
        addStrip({ x: a.x + (b.x - a.x) * start, z: a.z + (b.z - a.z) * start },
          { x: a.x + (b.x - a.x) * end, z: a.z + (b.z - a.z) * end });
      }
    }
  }
  if (!positions.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const ribbon = new Mesh(geometry, new MeshBasicMaterial({ color: dashed ? '#7998a1' : '#be6b36', side: DoubleSide, depthTest: false, toneMapped: false }));
  ribbon.renderOrder = 3;
  return ribbon;
}

export function buildRouteOverlay(layout: SceneLayout, visible: ScenePlacePoint[], selectedPlaceId: string | null, playbackPlaceId: string | null) {
  const group = new Group();
  group.name = 'askway-route-overlay';
  const project = createWorldProjection(layout.bounds);
  const frame = createCoastalFrame(layout);
  const previous = routeRibbon(layout.previousLegs, layout, 0.65, 0.14, true);
  const current = routeRibbon(layout.currentLegs, layout, 0.33, 0.18, false);
  if (previous) group.add(previous);
  if (current) group.add(current);
  const pickables: InstancedMesh[] = [];
  if (visible.length === 0) return { group, pickables };
  const dummy = new Object3D();
  const groundAt = (point: ScenePlacePoint) => { const position = project(point.local); return Math.max(0.12, frame.heightAt(position.x, position.z)); };
  const pinHeight = (point: ScenePlacePoint) => groundAt(point) + (/日月|大剧院/.test(point.place.name) ? 14.5 : /馆/.test(point.place.name) ? 5.65 : 4.05);
  const stems = new InstancedMesh(new CylinderGeometry(0.065, 0.065, 1, 6), markerMaterial('#627f83'), visible.length);
  visible.forEach((point, index) => {
    const position = project(point.local);
    const ground = groundAt(point);
    const height = pinHeight(point) - ground;
    dummy.position.set(position.x, ground + height / 2, position.z);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(index, dummy.matrix);
  });
  group.add(stems);
  const capGeometry = new CylinderGeometry(0.82, 0.82, 0.26, 24);
  const styles = [
    { color: '#193b4c', points: visible.filter(point => point.place.id === selectedPlaceId) },
    { color: '#b25a27', points: visible.filter(point => point.place.id !== selectedPlaceId && point.order !== null) },
    { color: '#f9f4e5', points: visible.filter(point => point.place.id !== selectedPlaceId && point.order === null && point.previousOrder === null) },
    { color: '#92a3a1', points: visible.filter(point => point.place.id !== selectedPlaceId && point.order === null && point.previousOrder !== null) },
  ];
  for (const style of styles) {
    if (style.points.length === 0) continue;
    const caps = new InstancedMesh(capGeometry, markerMaterial(style.color), style.points.length);
    caps.userData.placeIds = style.points.map(point => point.place.id);
    style.points.forEach((point, index) => {
      const position = project(point.local);
      dummy.position.set(position.x, pinHeight(point), position.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      caps.setMatrixAt(index, dummy.matrix);
    });
    group.add(caps);
    pickables.push(caps);
  }
  for (const [id, radius, color] of [[selectedPlaceId, 1.2, '#193b4c'], [playbackPlaceId, 1.6, '#b25a27']] as const) {
    const point = visible.find(item => item.place.id === id);
    if (!point) continue;
    const position = project(point.local);
    const ring = new Mesh(new TorusGeometry(radius, 0.07, 4, 32), new MeshBasicMaterial({ color, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(position.x, pinHeight(point) + 0.24, position.z);
    group.add(ring);
  }
  return { group, pickables };
}

export function objectBudget(root: Object3D) {
  let triangles = 0;
  let drawCalls = 0;
  root.traverse(object => {
    if (object instanceof Mesh) {
      const vertices = object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0;
      const instances = object instanceof InstancedMesh ? object.count : 1;
      triangles += vertices / 3 * instances;
      if (instances > 0) drawCalls += Array.isArray(object.material) ? object.geometry.groups.length || 1 : 1;
    } else if (object instanceof LineSegments) drawCalls += 1;
  });
  return { triangles, drawCalls };
}

/** The supplied subtree exclusively owns these resources; shared instances are disposed once. */
export function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    if (typeof object.userData.cancelLoads === 'function') object.userData.cancelLoads();
    if (object.userData.ownedTextures instanceof Set) {
      for (const texture of object.userData.ownedTextures) if (texture instanceof Texture) textures.add(texture);
      object.userData.ownedTextures.clear();
    }
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
    if (object instanceof InstancedMesh) object.dispose();
  });
  for (const texture of textures) {
    texture.dispose();
    const source = texture.source?.data;
    if (source && typeof source.close === 'function') source.close();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.clear();
}
