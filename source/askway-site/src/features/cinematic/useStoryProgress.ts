import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { advanceStoryFollow, advanceStoryTime, storyFrame, storyPanelReadable, storyProgress, type StoryPhase, type StoryTime, type StoryTargetRect, type StoryLandmarkOrigin } from './progress.ts';
import { routePoint } from '../../motion/seaRouteMath.ts';
import { storyChapters } from './storyConfig.ts';

export type StorySnapshot = ReturnType<typeof storyFrame> & { targetValue: number; activeTime: number; running: boolean; sticky: boolean };
export type StoryController = {
  getSnapshot(): StorySnapshot;
  subscribe(listener: (snapshot: StorySnapshot) => void, continuous?: boolean): () => void;
  setRunning(value: boolean): void;
  invalidate(): void;
  snapToScroll(): void;
};
export type StoryGeometry = { start: number; height: number; viewport: number; mediaFrame?: StoryTargetRect; landmarkOrigin?: StoryLandmarkOrigin };
type StoryEnvironment = {
  readScroll(): number;
  requestFrame(callback: (timestamp: number) => void): number;
  cancelFrame(id: number): void;
  commit(snapshot: StorySnapshot): void;
};

/** Geometry changes are not new navigation; only hydration gets one rebase. */
export function createStoryModePolicy(initialSticky: boolean) {
  let previous = initialSticky;
  let initialActivation = !initialSticky;
  return {
    cancelInitialFollow() { initialActivation = false; },
    changed(next: boolean) {
      const followInitialHash = !previous && next && initialActivation;
      previous = next;
      if (next) initialActivation = false;
      return followInitialHash;
    },
  };
}

export function storyAnchorCanFocus(anchor: StoryPhase | null, snapshot: ReturnType<typeof storyFrame> & { sticky: boolean }): boolean {
  return anchor !== null && storyPanelReadable(snapshot, anchor, snapshot.sticky);
}

export function storyHeadingFitsViewport(bounds: { top: number; bottom: number }, viewportHeight: number, safeTop = 16): boolean {
  return bounds.top >= safeTop && bounds.bottom <= viewportHeight - 16;
}

/** The browser adapter and tests share this actual scheduler, including its clock. */
export function createStoryController(environment: StoryEnvironment, initialSticky = false) {
  let geometry: StoryGeometry = { start: 0, height: 1, viewport: 1 };
  let snapshot: StorySnapshot = { ...storyFrame(0, 0), targetValue: 0, activeTime: 0, running: false, sticky: initialSticky };
  let clock: StoryTime = { activeTime: 0, lastTimestamp: null };
  let frame = 0, pendingInput = false, disposed = false, measured = false;
  let lastVisualTimestamp: number | null = null;
  let continuousSubscribers = 0;
  const listeners = new Set<{ listener: (snapshot: StorySnapshot) => void; continuous: boolean }>();
  const continuous = () => snapshot.running && continuousSubscribers > 0 && snapshot.value < .58;
  const following = () => snapshot.running && snapshot.sticky && snapshot.value !== snapshot.targetValue;
  const notify = () => {
    environment.commit(snapshot);
    for (const subscription of [...listeners]) subscription.listener(snapshot);
  };
  const cancel = () => {
    if (frame) environment.cancelFrame(frame);
    frame = 0;
    pendingInput = false;
    clock = { activeTime: clock.activeTime, lastTimestamp: null };
    lastVisualTimestamp = null;
  };
  const schedule = (input: boolean) => {
    if (disposed) return;
    pendingInput ||= input;
    if (!frame) frame = environment.requestFrame(tick);
  };
  function tick(timestamp: number) {
    frame = 0;
    pendingInput = false;
    if (disposed) return;
    clock = advanceStoryTime(clock, timestamp, snapshot.running);
    const target = storyProgress(environment.readScroll(), geometry.start, geometry.height, geometry.viewport);
    const elapsed = lastVisualTimestamp === null ? 1000 / 60 : timestamp - lastVisualTimestamp;
    const value = snapshot.running && snapshot.sticky ? advanceStoryFollow(snapshot.value, target, elapsed) : target;
    lastVisualTimestamp = Number.isFinite(timestamp) ? timestamp : null;
    snapshot = { ...storyFrame(value, snapshot.value, geometry.mediaFrame, geometry.landmarkOrigin), targetValue: target, activeTime: clock.activeTime, running: snapshot.running, sticky: snapshot.sticky };
    notify();
    if (continuous() || following()) schedule(false);
    else { clock = { activeTime: clock.activeTime, lastTimestamp: null }; lastVisualTimestamp = null; }
  }
  const controller: StoryController = {
    getSnapshot: () => snapshot,
    subscribe(listener, wantsContinuous = false) {
      if (disposed) return () => {};
      const subscription = { listener, continuous: wantsContinuous };
      listeners.add(subscription);
      if (wantsContinuous) continuousSubscribers++;
      listener(snapshot);
      if (continuous()) schedule(false);
      return () => {
        if (!listeners.delete(subscription)) return;
        if (wantsContinuous) continuousSubscribers--;
        if (!continuous() && !following() && !pendingInput) cancel();
      };
    },
    setRunning(value) {
      if (disposed || snapshot.running === value) return;
      cancel();
      const target = storyProgress(environment.readScroll(), geometry.start, geometry.height, geometry.viewport);
      snapshot = { ...snapshot, ...storyFrame(target, snapshot.value, geometry.mediaFrame, geometry.landmarkOrigin), targetValue: target, running: value };
      notify();
      if (value) schedule(true);
    },
    invalidate: () => schedule(true),
    snapToScroll() {
      if (disposed) return;
      cancel();
      const target = storyProgress(environment.readScroll(), geometry.start, geometry.height, geometry.viewport);
      snapshot = { ...snapshot, ...storyFrame(target, snapshot.value, geometry.mediaFrame, geometry.landmarkOrigin), targetValue: target };
      notify();
      if (continuous()) schedule(false);
    },
  };
  return {
    controller,
    suspend: cancel,
    setGeometry(next: StoryGeometry, sticky = snapshot.sticky) {
      const rebase = !measured || sticky !== snapshot.sticky;
      geometry = next;
      snapshot = { ...snapshot, sticky };
      measured = true;
      if (rebase) controller.snapToScroll();
      else controller.invalidate();
    },
    initializeTime(value: number) {
      if (clock.activeTime || !Number.isFinite(value) || value < 0) return;
      clock = { activeTime: value, lastTimestamp: null };
      snapshot = { ...snapshot, activeTime: value };
    },
    dispose() {
      cancel();
      disposed = true;
      listeners.clear();
      continuousSubscribers = 0;
    },
  };
}

const appliedValues = new WeakMap<HTMLElement, Record<string, string>>();
function applySnapshot(root: HTMLElement, snapshot: StorySnapshot) {
  const progress = snapshot.value.toFixed(4), target = snapshot.targetValue.toFixed(4);
  if (root.dataset.storyProgress !== progress) root.dataset.storyProgress = progress;
  if (root.dataset.storyTargetProgress !== target) root.dataset.storyTargetProgress = target;
  if (root.dataset.storyPhase !== snapshot.phase) root.dataset.storyPhase = snapshot.phase;
  root.dataset.storyActiveTime = snapshot.activeTime.toFixed(1);
  const values = {
    '--story-city-opacity': String(snapshot.cityOpacity),
    '--story-coast-media-opacity': String(snapshot.coastMediaOpacity),
    '--story-route-opacity': String(snapshot.routeOpacity),
    '--story-theatre-opacity': String(snapshot.theatreOpacity),
    '--story-product-opacity': String(snapshot.productOpacity),
    '--story-city-copy-opacity': String(snapshot.cityCopyOpacity),
    '--story-route-copy-opacity': String(snapshot.routeCopyOpacity),
    '--story-theatre-copy-opacity': String(snapshot.theatreCopyOpacity),
    '--story-product-copy-opacity': String(snapshot.productCopyOpacity),
    '--story-preview-opacity': String(snapshot.productPreviewOpacity),
    '--story-map-opacity': String(snapshot.productMapOpacity),
    '--story-camera-pan-x': snapshot.cameraPanX + '%',
    '--story-camera-pan-y': snapshot.cameraPanY + '%',
    '--story-camera-rotate-x': snapshot.cameraRotateX + 'deg',
    '--story-camera-rotate-y': snapshot.cameraRotateY + 'deg',
    '--story-coast-depth': snapshot.coastDepth + 'px',
    '--story-theatre-depth': snapshot.theatreDepth + 'px',
    '--story-detail-depth': snapshot.detailDepth + 'px',
    '--story-near-pan-x': snapshot.nearPanX + '%',
    '--story-near-arrival-scale': String(snapshot.nearArrivalScale),
    '--story-near-pan-y': snapshot.nearPanY + '%',
    '--story-near-rotate-x': snapshot.nearRotateX + 'deg',
    '--story-near-rotate-y': snapshot.nearRotateY + 'deg',
    '--story-coast-blur': snapshot.coastBlur + 'px',
    '--story-theatre-blur': snapshot.theatreBlur + 'px',
    '--story-theatre-shade-opacity': String(snapshot.theatreShadeOpacity),
    '--story-theatre-media-opacity': String(snapshot.theatreMediaOpacity),
    '--story-media-fit-scale': String(snapshot.mediaFitScale),
    '--story-media-shift-x': `${snapshot.mediaShiftX}%`,
    '--story-media-shift-y': `${snapshot.mediaShiftY}%`,
    '--story-photo-scale': String(snapshot.photoScale),
    '--story-theatre-scale': String(snapshot.theatreScale),
    '--story-card-top': `${snapshot.cardInsetTop}%`,
    '--story-card-right': `${snapshot.cardInsetRight}%`,
    '--story-card-bottom': `${snapshot.cardInsetBottom}%`,
    '--story-card-left': `${snapshot.cardInsetLeft}%`,
    '--story-route-reveal': String(snapshot.routeReveal),
  };
  const previous = appliedValues.get(root) ?? {};
  for (const [property, value] of Object.entries(values)) if (previous[property] !== value) root.style.setProperty(property, value);
  appliedValues.set(root, values);
}

export default function useStoryProgress(rootRef: RefObject<HTMLElement>, viewportRef: RefObject<HTMLElement>, sticky: boolean) {
  const [phase, setPhase] = useState<StoryPhase>('city');
  const phaseRef = useRef<StoryPhase>('city');
  const [visible, setVisible] = useState(false);
  const stickyRef = useRef(sticky);
  stickyRef.current = sticky;
  const measureRef = useRef<((followHash?: boolean, hash?: string) => void) | null>(null);
  const initialHashRef = useRef<string | null>(null);
  const modeRef = useRef(createStoryModePolicy(sticky));
  const focusRef = useRef<StoryPhase | null>(null);
  const focusTimer = useRef<number | null>(null);
  const focusRevision = useRef(0);
  const clearFocus = useCallback(() => {
    focusRevision.current++;
    focusRef.current = null;
    if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
    focusTimer.current = null;
  }, []);
  const requestFocus = useCallback((requested: StoryPhase) => { clearFocus(); focusRef.current = requested; }, [clearFocus]);
  const activeRef = useRef(false);
  const runtimeRef = useRef<ReturnType<typeof createStoryController> | null>(null);
  if (!runtimeRef.current) runtimeRef.current = createStoryController({
    readScroll: () => typeof window === 'undefined' ? 0 : window.scrollY,
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: id => window.cancelAnimationFrame(id),
    commit: snapshot => {
      const root = rootRef.current;
      if (!root || !activeRef.current) return;
      applySnapshot(root, snapshot);
      if (!storyAnchorCanFocus(focusRef.current, snapshot) || focusTimer.current !== null) return;
      const requested = focusRef.current;
      const revision = focusRevision.current;
      const focusHeading = (attempt = 0) => {
        focusTimer.current = window.setTimeout(() => {
          if (revision !== focusRevision.current) return;
          focusTimer.current = null;
          const latest = runtimeRef.current?.controller.getSnapshot();
          if (!activeRef.current || focusRef.current !== requested || !latest || !storyAnchorCanFocus(requested, latest)) return;
          const heading = root.querySelector<HTMLElement>(`[data-story-panel="${requested}"] [data-story-heading]`);
          if (heading?.closest('[inert],[aria-hidden="true"]') && attempt < 3) { focusHeading(attempt + 1); return; }
          if (heading && !heading.closest('[inert],[aria-hidden="true"]')) {
            if (!stickyRef.current) {
              const header = document.querySelector<HTMLElement>('.site-header');
              const safeTop = Math.max(16, (header?.getBoundingClientRect().bottom ?? 0) + 12);
              if (!storyHeadingFitsViewport(heading.getBoundingClientRect(), window.innerHeight, safeTop)) {
                heading.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
              }
            }
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
            clearFocus();
          }
        }, attempt ? 16 : 0);
      };
      focusHeading();
    },
  }, sticky);
  const runtime = runtimeRef.current;
  const controller = runtime.controller;

  useEffect(() => {
    const root = rootRef.current, viewport = viewportRef.current;
    if (!root || !viewport) return;
    let stopped = false;
    let geometry: StoryGeometry = { start: 0, height: 1, viewport: window.innerHeight };
    let initialAnchorScroll = window.scrollY;
    activeRef.current = true;
    if (initialHashRef.current === null) initialHashRef.current = window.location.hash;
    runtime.initializeTime(Number(root.dataset.storyActiveTime || 0));
    const unsubscribe = controller.subscribe(snapshot => {
      if (phaseRef.current !== snapshot.phase) { phaseRef.current = snapshot.phase; setPhase(snapshot.phase); }
    });
    const chapterForHash = (hash = window.location.hash) => {
      let id = hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* A malformed hash is not a story anchor. */ }
      return storyChapters.find(chapter => chapter.anchor === id);
    };
    const fallbackVisibility = () => {
      if (typeof IntersectionObserver === 'undefined') setVisible(window.scrollY + window.innerHeight > geometry.start && window.scrollY < geometry.start + geometry.height);
    };
    const measure = (followHash = false, hash = window.location.hash) => {
      if (stopped) return;
      const scrollPadding = Number.parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop);
      root.style.setProperty('--story-scroll-padding', `${Number.isFinite(scrollPadding) ? scrollPadding : 0}px`);
      const bounds = root.getBoundingClientRect();
      geometry = { start: bounds.top + window.scrollY, height: root.offsetHeight, viewport: stickyRef.current ? viewport.offsetHeight : window.innerHeight };
      const preview = root.querySelector<HTMLElement>('.story-product-preview');
      const media = preview?.querySelector<HTMLElement>('.journey-preview__map') ?? preview;
      if (stickyRef.current && media) {
        const frame = viewport.getBoundingClientRect(), target = media.getBoundingClientRect();
        if (frame.width > 0 && frame.height > 0) geometry.mediaFrame = {
          top: (target.top - frame.top) / frame.height * 100,
          right: (frame.right - target.right) / frame.width * 100,
          bottom: (frame.bottom - target.bottom) / frame.height * 100,
          left: (target.left - frame.left) / frame.width * 100,
        };
      }
      const routeDrawing = root.querySelector<SVGSVGElement>('.route-diagram-drawing');
      if (stickyRef.current && routeDrawing) {
        const frame = viewport.getBoundingClientRect(), route = routeDrawing.getBoundingClientRect();
        const landmark = routePoint(1);
        if (frame.width > 0 && frame.height > 0) geometry.landmarkOrigin = {
          x: (route.left - frame.left + route.width * landmark.x) / frame.width * 100,
          y: (route.top - frame.top + route.height * landmark.y) / frame.height * 100,
        };
      }
      const travel = Math.max(geometry.height - geometry.viewport, 1);
      for (const chapter of storyChapters) {
        const panel = root.querySelector<HTMLElement>(`[data-story-panel="${chapter.phase}"]`);
        const top = stickyRef.current ? travel * chapter.progress : panel?.offsetTop ?? 0;
        root.style.setProperty(`--story-anchor-${chapter.phase}`, `${top}px`);
      }
      runtime.setGeometry(geometry, stickyRef.current);
      fallbackVisibility();
      if (followHash) {
        const chapter = chapterForHash(hash);
        const anchor = chapter && root.querySelector<HTMLElement>(stickyRef.current ? `[data-story-anchor="${chapter.phase}"]` : `[data-story-panel="${chapter.phase}"]`);
        if (chapter && anchor) {
          requestFocus(chapter.phase);
          anchor.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
          controller.snapToScroll();
        }
      }
    };
    measureRef.current = measure;
    const cancelInitialFollow = () => modeRef.current.cancelInitialFollow();
    const onExplicitInput = () => { cancelInitialFollow(); clearFocus(); };
    const onScroll = () => {
      if (Math.abs(window.scrollY - initialAnchorScroll) > 1) cancelInitialFollow();
      fallbackVisibility(); controller.invalidate();
    };
    const onLayout = () => measure();
    const onResize = () => { cancelInitialFollow(); measure(); controller.snapToScroll(); };
    const onHash = () => { cancelInitialFollow(); measure(true); };
    const onChapterClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || !chapterForHash(destination.hash)) return;
      event.preventDefault();
      cancelInitialFollow();
      if (window.location.hash !== destination.hash) window.location.hash = destination.hash;
      measure(true, destination.hash);
    };
    const onAnchorFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches('[data-story-anchor],[data-story-panel]')) return;
      const chapter = storyChapters.find(item => item.phase === (target.dataset.storyAnchor ?? target.dataset.storyPanel));
      if (chapter) { requestFocus(chapter.phase); controller.invalidate(); }
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onLayout);
    observer?.observe(root);
    observer?.observe(viewport);
    const preview = root.querySelector<HTMLElement>('.story-product-preview');
    if (preview) observer?.observe(preview);
    const media = preview?.querySelector<HTMLElement>('.journey-preview__map');
    if (media) observer?.observe(media);
    const main = root.closest('main');
    if (main) observer?.observe(main);
    const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (!stopped) setVisible(entries.some(entry => entry.isIntersecting));
    }, { threshold: 0 });
    intersection?.observe(viewport);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('hashchange', onHash);
    window.addEventListener('pointerdown', onExplicitInput, { passive: true });
    window.addEventListener('keydown', onExplicitInput, { passive: true });
    window.addEventListener('wheel', onExplicitInput, { passive: true });
    root.addEventListener('load', onLayout, true);
    root.addEventListener('focusin', onAnchorFocus);
    root.addEventListener('click', onChapterClick);
    document.fonts?.ready.then(() => { if (!stopped) measure(); });
    measure(true);
    initialAnchorScroll = window.scrollY;
    return () => {
      stopped = true;
      activeRef.current = false;
      measureRef.current = null;
      unsubscribe();
      controller.setRunning(false);
      runtime.suspend();
      observer?.disconnect(); intersection?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('pointerdown', onExplicitInput);
      window.removeEventListener('keydown', onExplicitInput);
      window.removeEventListener('wheel', onExplicitInput);
      root.removeEventListener('load', onLayout, true);
      root.removeEventListener('focusin', onAnchorFocus);
      root.removeEventListener('click', onChapterClick);
      clearFocus();
    };
  }, [rootRef, viewportRef, runtime, controller, requestFocus, clearFocus]);

  useEffect(() => {
    const firstActivation = modeRef.current.changed(sticky);
    const initialHash = initialHashRef.current;
    measureRef.current?.(firstActivation && initialHash === window.location.hash, initialHash ?? undefined);
  }, [sticky]);
  return { controller, phase, visible };
}
