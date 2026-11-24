import { createWorldProjection } from '../map/projection.ts';
import type { LocalPoint, SceneLayout } from '../map/projection.ts';

export interface PaperTerrain {
  sea: LocalPoint[];
  land: LocalPoint[];
  coast: LocalPoint[];
  islands: LocalPoint[][];
}

const smooth = (value: number) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

/** Shared illustrative coastline, never a surveyed boundary or navigable surface. */
export function buildPaperTerrain(layout: SceneLayout): PaperTerrain {
  const { minX, maxX, minY, maxY } = layout.bounds;
  const span = Math.max(maxX - minX, maxY - minY);
  const islandPoints = layout.points.filter(point => /日月|大剧院|野狸/.test(point.place.name));
  const mainland = layout.points.filter(point => !islandPoints.includes(point));
  const mainlandEast = mainland.length ? Math.max(...mainland.map(point => point.local.x)) : minX + (maxX - minX) * 0.55;
  const anchors = mainland.filter(point => /沙滩|泳场|渔女|香炉湾/.test(point.place.name))
    .map(point => ({ x: point.local.x + span * (/渔女/.test(point.place.name) ? 0.006 : 0.014), y: point.local.y }))
    .sort((a, b) => b.y - a.y);
  const fallbackShore = Math.min(maxX - span * 0.1, mainlandEast + span * 0.025);
  const shoreAt = (y: number) => {
    if (!anchors.length) return fallbackShore;
    if (y >= anchors[0].y) return anchors[0].x + span * 0.012 * smooth((y - anchors[0].y) / span * 3);
    const last = anchors[anchors.length - 1];
    if (y <= last.y) return last.x + span * 0.006 * smooth((last.y - y) / span * 4);
    for (let index = 1; index < anchors.length; index += 1) {
      if (y < anchors[index].y) continue;
      const a = anchors[index - 1], b = anchors[index];
      return a.x + (b.x - a.x) * smooth((a.y - y) / Math.max(1, a.y - b.y));
    }
    return fallbackShore;
  };
  const coast = Array.from({ length: 41 }, (_, index) => {
    const y = maxY - (maxY - minY) * index / 40;
    return { x: shoreAt(y) + Math.sin(index * 0.48) * span * 0.0015, y };
  });
  // Nearby public references describe the same island. They must not create two overlapping discs.
  const clusters: typeof islandPoints[] = [];
  for (const point of islandPoints) {
    const cluster = clusters.find(items => items.some(item => Math.hypot(item.local.x - point.local.x, item.local.y - point.local.y) < span * 0.22));
    if (cluster) cluster.push(point);
    else clusters.push([point]);
  }
  const islands = clusters.map(points => {
    const centre = {
      x: points.reduce((sum, point) => sum + point.local.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.local.y, 0) / points.length,
    };
    const radiusX = Math.max(...points.map(point => Math.abs(point.local.x - centre.x)), 0) + span * 0.062;
    const radiusY = Math.max(...points.map(point => Math.abs(point.local.y - centre.y)), 0) + span * 0.078;
    return Array.from({ length: 48 }, (_, index) => {
      const angle = index / 48 * Math.PI * 2;
      const irregularity = 1 + Math.sin(angle * 3 + 0.8) * 0.045 + Math.cos(angle * 5) * 0.018;
      return { x: centre.x + Math.cos(angle) * radiusX * irregularity, y: centre.y + Math.sin(angle) * radiusY * irregularity };
    });
  });
  return {
    sea: [{ x: minX, y: minY }, { x: minX, y: maxY }, { x: maxX, y: maxY }, { x: maxX, y: minY }],
    land: [{ x: minX, y: minY }, { x: minX, y: maxY }, ...coast],
    coast,
    islands,
  };
}

export interface CoastalIsland {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  outline: { x: number; z: number }[];
}
export interface CoastalFrame {
  coast: { x: number; z: number }[];
  islands: CoastalIsland[];
  west: number;
  north: number;
  south: number;
  shoreXAt: (z: number) => number;
  heightAt: (x: number, z: number) => number;
}

/** Both models and annotations sample this surface without moving their projected x/z positions. */
export function createCoastalFrame(layout: SceneLayout): CoastalFrame {
  const project = createWorldProjection(layout.bounds);
  const terrain = buildPaperTerrain(layout);
  const coast = terrain.coast.map(project);
  const corner = project({ x: layout.bounds.minX, y: layout.bounds.maxY });
  const farCorner = project({ x: layout.bounds.maxX, y: layout.bounds.minY });
  const islands = terrain.islands.map(polygon => {
    const outline = polygon.map(project);
    const x = outline.reduce((sum, point) => sum + point.x, 0) / outline.length;
    const z = outline.reduce((sum, point) => sum + point.z, 0) / outline.length;
    return { x, z, radiusX: Math.max(...outline.map(point => Math.abs(point.x - x))), radiusZ: Math.max(...outline.map(point => Math.abs(point.z - z))), outline };
  });
  const shoreXAt = (z: number) => {
    if (z <= coast[0].z) return coast[0].x;
    if (z >= coast[coast.length - 1].z) return coast[coast.length - 1].x;
    for (let index = 1; index < coast.length; index += 1) {
      const a = coast[index - 1], b = coast[index];
      if (z > b.z) continue;
      const t = (z - a.z) / Math.max(0.0001, b.z - a.z);
      return a.x + (b.x - a.x) * t;
    }
    return coast[0].x;
  };
  const heightAt = (x: number, z: number) => {
    const inland = shoreXAt(z) - x;
    let height = inland >= 0 ? 0.08 + smooth(inland / 5) * 0.72 : -0.3;
    if (inland > 7) {
      height += (Math.sin(x * 0.074 + z * 0.023) * Math.cos(z * 0.086) + 1) * 0.22 * smooth((inland - 7) / 20);
      height += smooth((inland - 56) / 78) * (16 + Math.sin(z * 0.023) ** 2 * 13 + Math.cos(x * 0.018 + z * 0.013) * 7);
    }
    for (const island of islands) {
      const radius = Math.hypot((x - island.x) / island.radiusX, (z - island.z) / island.radiusZ);
      if (radius < 1.04) height = Math.max(height, 0.04 + smooth((1.04 - radius) / 0.27) * 0.86);
    }
    return height;
  };
  return { coast, islands, west: corner.x, north: corner.z, south: farCorner.z, shoreXAt, heightAt };
}
