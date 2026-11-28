export type SeaRouteSeed = { x: number; depth: number; phase: number; routeT: number; warmth: number };
export type SeaRouteGeometry = {
  width: number; heroHeight: number; waterline: number;
  routeLeft: number; routeTop: number; routeWidth: number; routeHeight: number; mobile: boolean;
};

const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function createSeaRouteField(count: number): SeaRouteSeed[] {
  let state = 271828;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const size = Math.max(0, Math.min(1200, Math.floor(Number.isFinite(count) ? count : 0)));
  return Array.from({ length: size }, (_, index) => ({
    x: random(), depth: Math.pow(random(), 1.7), phase: random() * Math.PI * 2,
    routeT: size > 1 ? index / (size - 1) : .5, warmth: random(),
  }));
}

/** Normalized coordinates shared by the static SVG and the particle endpoints. */
export function routePoint(progress: number): { x: number; y: number } {
  const t = clamp(progress);
  const second = t > .5;
  const local = second ? (t - .5) * 2 : t * 2;
  const points = second
    ? [[.5, .44], [.6, .48], [.75, .26], [.86, .18]]
    : [[.14, .78], [.23, .76], [.38, .38], [.5, .44]];
  const inverse = 1 - local;
  const weights = [inverse ** 3, 3 * inverse ** 2 * local, 3 * inverse * local ** 2, local ** 3];
  return {
    x: points.reduce((sum, point, index) => sum + point[0] * weights[index], 0),
    y: points.reduce((sum, point, index) => sum + point[1] * weights[index], 0),
  };
}

export function projectSeaRouteParticle(seed: SeaRouteSeed, progress: number, geometry: SeaRouteGeometry, time: number) {
  const p = clamp(progress);
  const morph = smooth((p - .25) / .45);
  const depth = .18 + seed.depth * .82;
  const timeSeconds = Number.isFinite(time) ? time / 1000 : 0;
  const wave = Math.sin(seed.phase + timeSeconds * .36) * depth;
  // Perspective packs the distant reflections; near reflections are larger and further apart.
  const seaX = geometry.width * (geometry.mobile ? .08 + seed.x * .87 : .43 + seed.x * .61);
  const seaY = geometry.waterline + seed.depth * geometry.heroHeight * (geometry.mobile ? .14 : .19);
  const end = routePoint(seed.routeT);
  const endX = geometry.routeLeft + end.x * geometry.routeWidth;
  const endY = geometry.routeTop + end.y * geometry.routeHeight;
  return {
    x: (seaX + wave * 7 * (1 - morph)) * (1 - morph) + endX * morph,
    y: (seaY + wave * 2 * (1 - morph)) * (1 - morph) + endY * morph,
    radius: (.45 + depth * 1.3) * (1 - morph) + 1.05 * morph,
    opacity: (.28 + seed.warmth * .52) * (1 - morph) + .54 * morph,
    warmth: seed.warmth,
  };
}

export type PresentationCameraPose = {
  panX: number; panY: number; rotateX: number; rotateY: number;
  coastZ: number; theatreZ: number; detailZ: number;
};

/** One eased camera arc for the entire story; percentages, degrees and CSS pixels. */
export function presentationCameraPose(storyProgress: number): PresentationCameraPose {
  const p = clamp(storyProgress);
  if (p === 0 || p === 1) return { panX: 0, panY: 0, rotateX: 0, rotateY: 0, coastZ: 0, theatreZ: 0, detailZ: 0 };
  const travel = smooth(p);
  const arc = Math.sin(Math.PI * travel);
  return {
    panX: -2.3 * arc * Math.sin(Math.PI * travel * 1.25),
    panY: -.8 * arc * Math.sin(Math.PI * travel),
    rotateX: .6 * arc * Math.sin(Math.PI * travel),
    rotateY: -1.6 * arc * Math.cos(Math.PI * travel * .65),
    coastZ: 110 * arc,
    theatreZ: 85 * arc * (.35 + .65 * travel),
    detailZ: 120 * arc * (.25 + .75 * travel),
  };
}

/** XYZ particles share the photograph camera, then settle exactly onto the original SVG. */
export function projectSpatialSeaRouteParticle(seed: SeaRouteSeed, particleProgress: number, geometry: SeaRouteGeometry,
  activeTime: number, storyProgress = .1 + clamp(particleProgress) * .55) {
  const finite = (value: number, minimum = -40000, maximum = 40000) => Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value)) : 0;
  const safeSeed: SeaRouteSeed = {
    x: clamp(seed.x), depth: clamp(seed.depth), phase: finite(seed.phase, -Math.PI * 2, Math.PI * 2),
    routeT: clamp(seed.routeT), warmth: clamp(seed.warmth),
  };
  const safeGeometry: SeaRouteGeometry = {
    width: finite(geometry.width, 0), heroHeight: finite(geometry.heroHeight, 0), waterline: finite(geometry.waterline),
    routeLeft: finite(geometry.routeLeft), routeTop: finite(geometry.routeTop),
    routeWidth: finite(geometry.routeWidth, 0), routeHeight: finite(geometry.routeHeight, 0), mobile: Boolean(geometry.mobile),
  };
  const p = clamp(particleProgress), morph = smooth((p - .25) / .45), remaining = 1 - morph;
  const base = projectSeaRouteParticle(safeSeed, p, safeGeometry, finite(activeTime, 0, 1e12));
  const colour = {
    routeBlend: morph,
    colorR: (255 - 12 * safeSeed.warmth) * remaining + 173 * morph,
    colorG: (244 - 43 * safeSeed.warmth) * remaining + 117 * morph,
    colorB: (216 - 97 * safeSeed.warmth) * remaining + 37 * morph,
  };
  if (remaining === 0) return { ...base, z: 0, perspectiveScale: 1, glowRadius: 3.15, stretch: 1, ...colour };
  const camera = presentationCameraPose(storyProgress);
  const centreX = safeGeometry.width / 2, centreY = safeGeometry.heroHeight / 2;
  const worldX = base.x - centreX + camera.panX * safeGeometry.width / 100 * remaining;
  const worldY = base.y - centreY + camera.panY * safeGeometry.heroHeight / 100 * remaining;
  const worldZ = (safeSeed.depth - .5) * 320 * remaining + camera.coastZ * .1 * remaining;
  const yaw = camera.rotateY * Math.PI / 180 * remaining, pitch = camera.rotateX * Math.PI / 180 * remaining;
  const rotatedX = worldX * Math.cos(yaw) + worldZ * Math.sin(yaw);
  const yawZ = worldZ * Math.cos(yaw) - worldX * Math.sin(yaw);
  const rotatedY = worldY * Math.cos(pitch) - yawZ * Math.sin(pitch);
  const focalLength = Math.max(720, Math.min(1600, safeGeometry.width * .8));
  const z = finite(yawZ * Math.cos(pitch) + worldY * Math.sin(pitch), -focalLength * .7, focalLength * .45);
  const perspectiveScale = focalLength / (focalLength - z);
  const radius = base.radius * perspectiveScale;
  return {
    ...base, x: centreX + rotatedX * perspectiveScale, y: centreY + rotatedY * perspectiveScale,
    radius, z, perspectiveScale, glowRadius: radius * (3 + 2.2 * safeSeed.depth * remaining),
    stretch: 1 + .8 * remaining, ...colour,
  };
}

export function shouldAnimatePresentation(state: {
  paused: boolean; reducedMotion: boolean; visible: boolean; documentVisible: boolean; sceneActive: boolean;
}) {
  return !state.paused && !state.reducedMotion && state.visible && state.documentVisible && !state.sceneActive;
}
