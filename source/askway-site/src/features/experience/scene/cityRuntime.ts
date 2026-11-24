import {
  Group, PCFSoftShadowMap, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { InstancedMesh } from 'three';
import { createWorldProjection } from '../map/projection';
import type { SceneLayout, ScenePlacePoint } from '../map/projection';
import { buildPaperCity, buildRouteOverlay, disposeObject } from './paperCityModel';
import { createCoastalEnvironment } from './coastalEnvironment';
import type { CoastalEnvironment, CoastalLighting } from './coastalEnvironment';
import { createCoastalMaterials } from './realisticMaterials';
import type { CoastalMaterials } from './realisticMaterials';
import { createCoastalFrame } from './paperTerrain';

export type CityPreset = 'overview' | 'theatre' | 'route';
export type CityPresentation = 'workbench' | 'cinematic';

export interface CitySnapshot {
  layout: SceneLayout;
  visiblePoints: ScenePlacePoint[];
  selectedPlaceId: string | null;
  playbackPlaceId: string | null;
  reducedMotion: boolean;
  preset?: CityPreset;
  lighting?: CoastalLighting;
  presentation?: CityPresentation;
}
export interface CityStats { triangles: number; drawCalls: number; pixelRatio: number }
export interface CityRuntime {
  update: (snapshot: CitySnapshot) => void;
  rotate: (direction: number) => void;
  zoom: (direction: number) => void;
  overview: () => void;
  reset: () => void;
  focusSelected: () => void;
  setPreset: (preset: CityPreset) => void;
  setLighting: (lighting: CoastalLighting) => void;
  setAnimation: (enabled: boolean) => void;
  dispose: () => void;
}
interface RuntimeCallbacks {
  onPick: (id: string) => void;
  onFailure: (message: string) => void;
  onReady: (stats: CityStats) => void;
  onViewChange: (description: string) => void;
}
interface CameraTransition {
  from: Vector3;
  to: Vector3;
  fromZoom: number;
  toZoom: number;
  startedAt: number;
  fromRadius: number;
  toRadius: number;
  fromElevation: number;
  toElevation: number;
}

/** Owned perspective view: demand rendering by default, with a deliberate, visibility-bound sea-motion switch. */
export function createCityRuntime(host: HTMLDivElement, initial: CitySnapshot, callbacks: RuntimeCallbacks): CityRuntime {
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.3, 2200);
  const target = new Vector3(0, 0.8, 0);
  const defaultAzimuth = 0.66;
  let azimuth = defaultAzimuth;
  let zoom = 1;
  let radius = 132;
  let elevation = 78;
  let preset: CityPreset = initial.preset ?? 'overview';
  let lighting: CoastalLighting = initial.lighting ?? 'day';
  let animationRequested = initial.presentation === 'cinematic';
  let lastAnimationFrame = 0;
  let waterElapsed = 0;
  let cameraAspectScale = 1;
  let snapshot = initial;
  let lastSelected = initial.selectedPlaceId;
  let lastPlayback = initial.playbackPlaceId;
  let manualCamera = false;
  let transition: CameraTransition | null = null;
  let renderer: WebGLRenderer | null = null;
  let paperCity: Group | null = null;
  let environment: CoastalEnvironment | null = null;
  let materials: CoastalMaterials | null = null;
  let overlay: Group | null = null;
  let pickables: InstancedMesh[] = [];
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let frameId = 0;
  let renderCount = 0;
  let ready = false;
  let disposed = false;
  let failed = false;
  let pointerStart: { x: number; y: number } | null = null;
  const rectangle = host.getBoundingClientRect();
  let inViewport = rectangle.bottom > 0 && rectangle.top < window.innerHeight;
  const canRender = () => !disposed && !failed && inViewport && document.visibilityState !== 'hidden';
  const canAnimate = () => canRender() && animationRequested && !snapshot.reducedMotion;
  const applyCamera = () => {
    camera.zoom = zoom;
    camera.position.set(target.x + Math.sin(azimuth) * radius * cameraAspectScale, target.y + elevation * cameraAspectScale,
      target.z + Math.cos(azimuth) * radius * cameraAspectScale);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  const cancelFrame = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  };
  const stopTransition = () => { transition = null; };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    fail('三维画面已中断。请重试沙盘，或返回二维地图继续查看当前方案。');
  };
  const onPointerDown = (event: PointerEvent) => {
    pointerStart = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerCancel = () => { pointerStart = null; };
  const onPointerUp = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = null;
    if (!start || !renderer || disposed || failed || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const id = hit?.instanceId != null ? hit.object.userData.placeIds?.[hit.instanceId] : null;
    if (typeof id === 'string') {
      manualCamera = true;
      stopTransition();
      callbacks.onPick(id);
    }
  };

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelFrame();
    stopTransition();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', onFallbackScroll);
    if (renderer) {
      const canvas = renderer.domElement;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    }
    if (overlay) { scene.remove(overlay); disposeObject(overlay); overlay = null; }
    if (paperCity) { scene.remove(paperCity); disposeObject(paperCity); paperCity = null; }
    environment?.dispose();
    environment = null;
    materials = null;
    pickables = [];
    scene.clear();
    if (renderer) {
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      renderer = null;
    }
    host.dataset.activeRenderer = '0';
    host.dataset.scenePaused = 'true';
  }

  function fail(message: string) {
    if (disposed || failed) return;
    failed = true;
    dispose();
    callbacks.onFailure(message);
  }

  function renderFrame(timestamp: number) {
    frameId = 0;
    if (!canRender() || !renderer) return;
    if (transition) {
      const fraction = Math.min(1, Math.max(0, (timestamp - transition.startedAt) / 650));
      const eased = 1 - (1 - fraction) ** 3;
      target.copy(transition.from).lerp(transition.to, eased);
      zoom = transition.fromZoom + (transition.toZoom - transition.fromZoom) * eased;
      radius = transition.fromRadius + (transition.toRadius - transition.fromRadius) * eased;
      elevation = transition.fromElevation + (transition.toElevation - transition.fromElevation) * eased;
      if (fraction >= 1) transition = null;
      applyCamera();
    }
    if (canAnimate() && !transition && lastAnimationFrame && timestamp - lastAnimationFrame < 1000 / 30) {
      invalidate();
      return;
    }
    if (canAnimate()) {
      if (lastAnimationFrame) waterElapsed += Math.min(0.06, (timestamp - lastAnimationFrame) / 1000);
      lastAnimationFrame = timestamp;
      if (materials) materials.waterTime.value = waterElapsed;
    } else lastAnimationFrame = 0;
    host.dataset.sceneAnimating = String(canAnimate());
    try {
      renderer.render(scene, camera);
      renderCount += 1;
      host.dataset.renderCount = String(renderCount);
      host.dataset.sceneTriangles = String(renderer.info.render.triangles);
      host.dataset.sceneDrawCalls = String(renderer.info.render.calls);
      host.dataset.sceneDpr = String(renderer.getPixelRatio());
      if (!ready) {
        ready = true;
        host.dataset.sceneReady = 'true';
        callbacks.onReady({ triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio() });
      }
    } catch {
      fail('三维沙盘暂时无法绘制。请重试，或返回二维地图继续查看当前方案。');
      return;
    }
    // No loop exists while motion is disabled, the scene is outside the viewport, or the document is hidden.
    if (transition || canAnimate()) invalidate();
  }

  function invalidate() {
    if (canRender() && frameId === 0) frameId = window.requestAnimationFrame(renderFrame);
  }

  function pauseOrResume() {
    const active = canRender();
    host.dataset.scenePaused = String(!active);
    if (!active) {
      cancelFrame();
      lastAnimationFrame = 0;
      host.dataset.sceneAnimating = 'false';
      if (transition) {
        target.copy(transition.to);
        zoom = transition.toZoom;
        radius = transition.toRadius;
        elevation = transition.toElevation;
        stopTransition();
        applyCamera();
      }
    } else invalidate();
  }
  function onVisibilityChange() { pauseOrResume(); }
  function onFallbackScroll() {
    const bounds = host.getBoundingClientRect();
    const next = bounds.bottom > 0 && bounds.top < window.innerHeight;
    if (next !== inViewport) { inViewport = next; pauseOrResume(); }
  }

  function resize() {
    if (!renderer || disposed) return;
    const width = Math.max(1, host.clientWidth || 640);
    const height = Math.max(1, host.clientHeight || 440);
    const aspect = width / height;
    camera.aspect = aspect;
    cameraAspectScale = Math.max(1, 0.95 / aspect);
    const ceiling = window.matchMedia('(max-width: 700px)').matches ? 1 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ceiling));
    renderer.setSize(width, height, false);
    applyCamera();
    invalidate();
  }

  function focusPlace(id: string, explicit = false) {
    const point = snapshot.layout.points.find(item => item.place.id === id);
    if (!point || (!explicit && snapshot.reducedMotion)) return;
    const position = createWorldProjection(snapshot.layout.bounds)(point.local);
    const frame = createCoastalFrame(snapshot.layout);
    const isOpera = /日月|大剧院/.test(point.place.name);
    const nextTarget = new Vector3(position.x, Math.max(0.12, frame.heightAt(position.x, position.z)) + (isOpera ? 4.1 : 1.4), position.z);
    const nextZoom = 1;
    const nextRadius = isOpera ? 32 : 45;
    const nextElevation = isOpera ? 20 : 32;
    stopTransition();
    if (snapshot.reducedMotion || !canRender()) {
      target.copy(nextTarget);
      zoom = nextZoom;
      radius = nextRadius;
      elevation = nextElevation;
      applyCamera();
    } else transition = { from: target.clone(), to: nextTarget, fromZoom: zoom, toZoom: nextZoom, fromRadius: radius,
      toRadius: nextRadius, fromElevation: elevation, toElevation: nextElevation, startedAt: performance.now() };
    callbacks.onViewChange(`聚焦 ${point.place.name}`);
    invalidate();
  }

  function update(next: CitySnapshot) {
    if (disposed || failed) return;
    const selectionChanged = next.selectedPlaceId !== lastSelected;
    const playbackChanged = next.playbackPlaceId !== lastPlayback;
    lastSelected = next.selectedPlaceId;
    lastPlayback = next.playbackPlaceId;
    snapshot = next;
    if (overlay) { scene.remove(overlay); disposeObject(overlay); }
    const cinematic = next.presentation === 'cinematic';
    const showRoute = !cinematic || preset === 'route';
    const nextOverlay = buildRouteOverlay(showRoute ? next.layout : { ...next.layout, currentLegs: [], previousLegs: [] },
      cinematic ? [] : next.visiblePoints, cinematic ? null : next.selectedPlaceId, cinematic ? null : next.playbackPlaceId);
    overlay = nextOverlay.group;
    pickables = nextOverlay.pickables;
    scene.add(overlay);
    if (next.reducedMotion) stopTransition();
    if (!cinematic && selectionChanged && next.selectedPlaceId) {
      manualCamera = false;
      focusPlace(next.selectedPlaceId);
    } else if (!cinematic && playbackChanged && next.playbackPlaceId && !manualCamera) focusPlace(next.playbackPlaceId);
    invalidate();
  }

  function setPreset(nextPreset: CityPreset) {
    if (disposed || failed) return;
    preset = nextPreset;
    manualCamera = true;
    stopTransition();
    zoom = 1;
    azimuth = defaultAzimuth;
    const project = createWorldProjection(snapshot.layout.bounds);
    if (nextPreset === 'theatre') {
      const opera = snapshot.layout.points.find(point => /日月|大剧院/.test(point.place.name));
      if (opera) {
        const position = project(opera.local);
        target.set(position.x - 0.6, 3.9, position.z + 1.2);
        radius = 35;
        elevation = 6.8;
        azimuth = 0.75;
      } else { target.set(0, 0.8, 0); radius = 132; elevation = 78; }
    } else if (nextPreset === 'route') {
      const points = snapshot.layout.points.filter(point => snapshot.layout.routePlaceIds.includes(point.place.id)).map(point => project(point.local));
      const focus = points.length ? points : snapshot.layout.points.filter(point => /日月|大剧院|香炉湾|海滨公园/.test(point.place.name)).map(point => project(point.local));
      if (focus.length) {
        const minX = Math.min(...focus.map(point => point.x)), maxX = Math.max(...focus.map(point => point.x));
        const minZ = Math.min(...focus.map(point => point.z)), maxZ = Math.max(...focus.map(point => point.z));
        target.set((minX + maxX) / 2 - 3, 1.8, (minZ + maxZ) / 2);
        radius = Math.max(76, Math.hypot(maxX - minX, maxZ - minZ) * 1.35);
        elevation = radius * (snapshot.presentation === 'cinematic' ? 0.34 : 0.6);
        azimuth = 0.84;
      } else { target.set(0, 0.8, 0); radius = 132; elevation = 78; }
    } else { target.set(-3, 0.8, 0); radius = 132; elevation = snapshot.presentation === 'cinematic' ? 45 : 78; }
    host.dataset.scenePreset = preset;
    const context = paperCity?.getObjectByName('illustrative-city-context');
    if (context) context.visible = !(snapshot.presentation === 'cinematic' && preset === 'theatre');
    if (renderer) renderer.shadowMap.needsUpdate = true;
    applyCamera();
    update(snapshot);
    callbacks.onViewChange(nextPreset === 'theatre' ? '日月贝建筑近景' : nextPreset === 'route' ? '沿海岸查看方案' : '全览当前方案');
  }

  function setLighting(nextLighting: CoastalLighting) {
    if (disposed || failed) return;
    lighting = nextLighting;
    environment?.setLighting(lighting);
    if (renderer) renderer.shadowMap.needsUpdate = true;
    host.dataset.sceneLighting = lighting;
    invalidate();
  }

  function setAnimation(enabled: boolean) {
    if (disposed || failed) return;
    animationRequested = enabled;
    host.dataset.animationRequested = String(enabled);
    lastAnimationFrame = 0;
    if (!enabled && !transition) cancelFrame();
    invalidate();
  }

  try {
    renderer = new WebGLRenderer({ antialias: !window.matchMedia('(max-width: 700px)').matches, alpha: false, powerPreference: 'low-power' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'pan-y pinch-zoom';
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
    renderer.domElement.addEventListener('pointerup', onPointerUp, { passive: true });
    renderer.domElement.addEventListener('pointercancel', onPointerCancel, { passive: true });
    host.appendChild(renderer.domElement);
    host.dataset.activeRenderer = '1';
    host.dataset.renderCount = '0';
    host.dataset.sceneReady = 'false';
    host.dataset.sceneResourcesReady = 'false';
    host.dataset.sceneResourceFallbacks = '0';
    host.dataset.sceneCamera = 'perspective';
    host.dataset.animationRequested = String(animationRequested);
    environment = createCoastalEnvironment(scene, renderer, invalidate);
    materials = createCoastalMaterials();
    const quality = window.matchMedia('(max-width: 700px)').matches ? 'low' : 'high';
    host.dataset.sceneQuality = quality;
    paperCity = buildPaperCity(initial.layout, materials, quality);
    scene.add(paperCity);
    setPreset(preset);
    setLighting(lighting);
    resize();
    Promise.allSettled([materials.load(invalidate), environment.load()]).then(results => {
      if (disposed || failed) return;
      const fallbacks = results.reduce((count, result) => count + (result.status === 'fulfilled' ? result.value : 1), 0);
      host.dataset.sceneResourceFallbacks = String(fallbacks);
      host.dataset.sceneResourcesReady = 'true';
      invalidate();
    });
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
    } else window.addEventListener('resize', resize, { passive: true });
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(entries => {
        const next = entries[0]?.isIntersecting ?? false;
        if (next !== inViewport) { inViewport = next; pauseOrResume(); }
      }, { threshold: 0.01 });
      intersectionObserver.observe(host);
    } else window.addEventListener('scroll', onFallbackScroll, { passive: true });
    pauseOrResume();
  } catch (error) {
    dispose();
    throw error;
  }

  const manual = (action: () => void, message: string) => {
    if (disposed || failed) return;
    manualCamera = true;
    stopTransition();
    action();
    applyCamera();
    callbacks.onViewChange(message);
    invalidate();
  };
  return {
    update,
    rotate: direction => manual(() => { azimuth = Math.min(Math.PI * 0.75, Math.max(-Math.PI * 0.75, azimuth + direction * Math.PI / 12)); }, direction < 0 ? '已向左旋转沙盘' : '已向右旋转沙盘'),
    zoom: direction => manual(() => { zoom = Math.min(1.85, Math.max(0.75, Math.round((zoom + direction * 0.15) * 100) / 100)); }, direction > 0 ? '已放大沙盘' : '已缩小沙盘'),
    overview: () => setPreset('overview'),
    reset: () => { setPreset('overview'); callbacks.onViewChange('已复位沙盘视角'); },
    focusSelected: () => {
      manualCamera = true;
      if (snapshot.selectedPlaceId) focusPlace(snapshot.selectedPlaceId, true);
    },
    setPreset,
    setLighting,
    setAnimation,
    dispose,
  };
}
