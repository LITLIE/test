import { useEffect, useRef, type RefObject } from 'react';
import { createSeaRouteField, projectSpatialSeaRouteParticle, type SeaRouteGeometry } from '../motion/seaRouteMath';
import type { StoryController, StorySnapshot } from '../features/cinematic/useStoryProgress';

type Mask = { left: number; right: number; top: number; bottom: number };
export default function SeaRouteParticles({ openingRef, viewportRef, controller }: {
  openingRef: RefObject<HTMLElement>; viewportRef: RefObject<HTMLElement>; controller: StoryController;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const opening = openingRef.current, viewport = viewportRef.current, canvas = canvasRef.current;
    if (!opening || !viewport || !canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    let geometry: SeaRouteGeometry | null = null, width = 0, height = 0, disposed = false, hasPixels = false;
    let seeds = createSeaRouteField(0);
    let drawCount = Number(opening.dataset.storyDrawCount || 0);
    let lastDrawTime = -1, lastDrawValue = -1;
    // Three memory-only radial sprites are reused across every depth layer and frame.
    const sprites = ['255,244,216', '243,201,119', '173,117,37'].map(colour => {
      const sprite = document.createElement('canvas');
      sprite.width = 64; sprite.height = 64;
      const spriteContext = sprite.getContext('2d');
      if (spriteContext) {
        const glow = spriteContext.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, `rgba(${colour},.8)`);
        glow.addColorStop(.2, `rgba(${colour},.3)`);
        glow.addColorStop(.65, `rgba(${colour},.06)`);
        glow.addColorStop(1, `rgba(${colour},0)`);
        spriteContext.fillStyle = glow;
        spriteContext.fillRect(0, 0, 64, 64);
      }
      return sprite;
    });
    const masks = new Map<string, Mask[]>();
    const recordDraw = () => {
      drawCount++;
      canvas.dataset.drawCount = String(drawCount);
      opening.dataset.storyDrawCount = String(drawCount);
    };
    const draw = (snapshot: StorySnapshot) => {
      canvas.dataset.progress = snapshot.value.toFixed(4);
      canvas.dataset.activeTime = snapshot.activeTime.toFixed(1);
      if (disposed || !geometry || !snapshot.running) { canvas.dataset.drawing = 'false'; lastDrawTime = -1; return; }
      if (snapshot.value >= .60) {
        if (hasPixels) { context.clearRect(0, 0, width, height); hasPixels = false; recordDraw(); }
        canvas.dataset.drawing = 'false'; return;
      }
      const elapsed = snapshot.activeTime - lastDrawTime;
      const targetValue = Number.isFinite(snapshot.targetValue) ? snapshot.targetValue : snapshot.value;
      const following = typeof targetValue === 'number' && Number.isFinite(targetValue) && targetValue !== snapshot.value;
      if (lastDrawTime >= 0 && (following || snapshot.value === lastDrawValue) && elapsed >= 0 && elapsed < 1000 / (geometry.mobile ? 30 : 60)) return;
      lastDrawTime = snapshot.activeTime; lastDrawValue = snapshot.value;
      context.clearRect(0, 0, width, height);
      const textMasks = snapshot.sticky ? masks.get(snapshot.phase) || [] : masks.get('all') || [];
      const exit = Math.max(0, Math.min(1, (snapshot.value - .48) / .12));
      const fade = 1 - exit * exit * (3 - 2 * exit);
      for (const seed of seeds) {
        const point = projectSpatialSeaRouteParticle(seed, snapshot.particleProgress, geometry, snapshot.activeTime, snapshot.value);
        const halo = point.glowRadius;
        if (textMasks.some(mask => point.x + halo >= mask.left && point.x - halo <= mask.right && point.y + halo >= mask.top && point.y - halo <= mask.bottom)) continue;
        const opacity = point.opacity * fade;
        const sea = 1 - point.routeBlend;
        const glowWeights = [sea * (1 - seed.warmth), sea * seed.warmth, point.routeBlend];
        for (let index = 0; index < sprites.length; index++) {
          const weight = glowWeights[index];
          if (weight < .01) continue;
          context.globalAlpha = opacity * weight * .3;
          context.drawImage(sprites[index], point.x - halo * point.stretch, point.y - halo,
            halo * 2 * point.stretch, halo * 2);
        }
        context.globalAlpha = 1;
        context.fillStyle = `rgba(${point.colorR},${point.colorG},${point.colorB},${opacity})`;
        context.beginPath();
        context.ellipse(point.x, point.y, point.radius * point.stretch, point.radius, 0, 0, Math.PI * 2);
        context.fill();
      }
      hasPixels = true;
      recordDraw();
      canvas.dataset.drawing = snapshot.value < .58 ? 'true' : 'false';
    };
    const measure = () => {
      if (disposed) return;
      const rect = viewport.getBoundingClientRect();
      const hero = opening.querySelector<HTMLElement>('.hero');
      const route = opening.querySelector<SVGSVGElement>('.route-diagram-drawing');
      if (!hero || !route) return;
      width = rect.width; height = rect.height;
      const mobile = width < 900;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      hasPixels = false;
      lastDrawTime = -1; lastDrawValue = -1;
      seeds = createSeaRouteField(mobile ? 100 : 280);
      const routeRect = route.getBoundingClientRect();
      geometry = {
        width, heroHeight: hero.offsetHeight, waterline: hero.offsetHeight * (mobile ? .58 : .73),
        routeLeft: routeRect.left - rect.left, routeTop: routeRect.top - rect.top,
        routeWidth: routeRect.width, routeHeight: routeRect.height, mobile,
      };
      masks.clear();
      const all: Mask[] = [];
      opening.querySelectorAll<HTMLElement>('[data-story-panel]').forEach(panel => {
        const panelMasks = Array.from(panel.querySelectorAll('h1,h2,.hero-description,.hero-kicker,.story-city-link,.hero-bottom,.hero-coordinates,.story-section-heading,.route-story-copy,.route-story-foot,.route-place,.story-theatre-copy,.story-product-copy,.story-product-scope')).map(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left - rect.left - 8, right: box.right - rect.left + 8, top: box.top - rect.top - 8, bottom: box.bottom - rect.top + 8 };
        });
        masks.set(panel.dataset.storyPanel || '', panelMasks);
        all.push(...panelMasks);
      });
      masks.set('all', all);
      controller.invalidate();
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(viewport); resize?.observe(opening);
    window.addEventListener('resize', measure, { passive: true });
    opening.addEventListener('load', measure, true);
    const unsubscribe = controller.subscribe(draw, true);
    opening.dataset.particleActive = 'true';
    measure();
    return () => {
      disposed = true; unsubscribe(); resize?.disconnect();
      window.removeEventListener('resize', measure); opening.removeEventListener('load', measure, true);
      delete opening.dataset.particleActive;
      canvas.width = 0; canvas.height = 0;
      sprites.forEach(sprite => { sprite.width = 0; sprite.height = 0; });
    };
  }, [openingRef, viewportRef, controller]);
  return <canvas ref={canvasRef} className="sea-route-particles" aria-hidden="true" data-particle-space="perspective-3d" data-drawing="false" data-draw-count="0" data-active-time="0"/>;
}
