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

export function shouldAnimatePresentation(state: {
  paused: boolean; reducedMotion: boolean; visible: boolean; documentVisible: boolean; sceneActive: boolean;
}) {
  return !state.paused && !state.reducedMotion && state.visible && state.documentVisible && !state.sceneActive;
}
