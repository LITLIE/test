import { presentationCameraPose } from '../../motion/seaRouteMath.ts';

export type StoryPhase = 'city' | 'route' | 'theatre' | 'product';
export type StoryTargetRect = { top: number; right: number; bottom: number; left: number };
export type StoryLandmarkOrigin = { x: number; y: number };
export const clampStory = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const ease = (value: number) => {
  const p = clampStory(value);
  return clampStory(p * p * p * (p * (p * 6 - 15) + 10));
};

/** A finite, monotone camera follow; native scrolling is never delayed or intercepted. */
export function advanceStoryFollow(value: number, target: number, deltaMs: number): number {
  const current = clampStory(value), destination = clampStory(target);
  const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(50, deltaMs)) : 0;
  const next = current + (destination - current) * (1 - Math.exp(-delta / 160));
  return Math.abs(destination - next) <= .0001 ? destination : clampStory(next);
}

export function storyProgress(scroll: number, start: number, height: number, viewport: number): number {
  if (![scroll, start, height, viewport].every(Number.isFinite)) return 0;
  return clampStory((scroll - start) / Math.max(height - viewport, 1));
}

/** Every visual value derives from the current position, never an accumulated frame. */
export function storyFrame(value: number, previous: number, targetRect: StoryTargetRect = { top: 16, right: 5.55, bottom: 16, left: 53.5 }, landmarkOrigin: StoryLandmarkOrigin = { x: 86, y: 36 }) {
  const p = clampStory(value), old = clampStory(previous);
  const phase: StoryPhase = p < .24 ? 'city' : p < .56 ? 'route' : p < .9 ? 'theatre' : 'product';
  const card = ease((p - .78) / .16);
  const arrival = ease((p - .45) / .2);
  const camera = presentationCameraPose(p);
  const origin = { x: clampStory(landmarkOrigin.x / 100) * 100, y: clampStory(landmarkOrigin.y / 100) * 100 };
  const desiredScale = Math.max((100 - targetRect.left - targetRect.right) / 100, (100 - targetRect.top - targetRect.bottom) / 100);
  return {
    value: p, direction: Math.sign(p - old) as -1 | 0 | 1, phase,
    coastMediaOpacity: 1 - ease((p - .65) / .09),
    cityOpacity: 1 - ease((p - .16) / .14),
    routeOpacity: ease((p - .16) / .15) * (1 - ease((p - .44) / .2)),
    theatreOpacity: arrival * (1 - ease((p - .8) / .14)),
    productOpacity: ease((p - .76) / .18),
    cityCopyOpacity: 1 - ease((p - .1) / .13),
    routeCopyOpacity: ease((p - .22) / .12) * (1 - ease((p - .43) / .1)),
    theatreCopyOpacity: ease((p - .56) / .1) * (1 - ease((p - .7) / .08)),
    productCopyOpacity: ease((p - .96) / .025),
    productPreviewOpacity: ease((p - .89) / .05),
    productMapOpacity: ease((p - .94) / .035),
    theatreMediaOpacity: ease((p - .45) / .02) * (1 - ease((p - .945) / .035)),
    nearArrivalScale: arrival,
    cameraPanX: camera.panX,
    cameraPanY: camera.panY,
    cameraRotateX: camera.rotateX,
    cameraRotateY: camera.rotateY,
    coastDepth: camera.coastZ,
    theatreDepth: camera.theatreZ * (1 - card),
    detailDepth: camera.detailZ,
    nearPanX: (camera.panX * arrival + (1 - arrival) * (origin.x - 50)) * (1 - card),
    nearPanY: (camera.panY * arrival + (1 - arrival) * (origin.y - 50)) * (1 - card),
    nearRotateX: camera.rotateX * (1 - card),
    nearRotateY: camera.rotateY * (1 - card),
    coastBlur: .7 * arrival,
    theatreBlur: (.7 * (1 - arrival) + .25) * (1 - card),
    theatreShadeOpacity: 1 - card * .8,
    cardBlend: card,
    mediaFitScale: 1 + (desiredScale - 1) * card,
    mediaShiftX: (targetRect.left - targetRect.right) / 2 * card,
    mediaShiftY: (targetRect.top - targetRect.bottom) / 2 * card,
    particleProgress: clampStory((p - .1) / .55),
    photoScale: 1 + .018 * ease(p / .65),
    theatreScale: 1.05 - .05 * ease((p - .5) / .28),
    cardInsetTop: origin.y * (1 - arrival) + targetRect.top * card,
    cardInsetRight: (100 - origin.x) * (1 - arrival) + targetRect.right * card,
    cardInsetBottom: (100 - origin.y) * (1 - arrival) + targetRect.bottom * card,
    cardInsetLeft: origin.x * (1 - arrival) + targetRect.left * card,
    routeReveal: ease((p - .18) / .36),
  };
}

export function storyPanelReadable(snapshot: ReturnType<typeof storyFrame>, phase: StoryPhase, sticky: boolean): boolean {
  if (!sticky) return true;
  const opacity = {
    city: snapshot.cityOpacity * snapshot.cityCopyOpacity,
    route: snapshot.routeOpacity * snapshot.routeCopyOpacity,
    theatre: snapshot.theatreOpacity * snapshot.theatreCopyOpacity,
    product: snapshot.productOpacity * snapshot.productCopyOpacity,
  };
  return snapshot.phase === phase && opacity[phase] >= .6;
}

export type StoryTime = { activeTime: number; lastTimestamp: number | null };
/** Hidden or paused time is discarded; a late frame cannot produce catch-up motion. */
export function advanceStoryTime(clock: StoryTime, timestamp: number, running: boolean): StoryTime {
  if (!running || !Number.isFinite(timestamp)) return { activeTime: clock.activeTime, lastTimestamp: null };
  const delta = clock.lastTimestamp === null ? 0 : Math.min(50, Math.max(0, timestamp - clock.lastTimestamp));
  return { activeTime: clock.activeTime + delta, lastTimestamp: timestamp };
}
