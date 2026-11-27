import { useEffect, useRef, type RefObject } from 'react';
import { createSeaRouteField, projectSeaRouteParticle, shouldAnimatePresentation, type SeaRouteGeometry } from '../motion/seaRouteMath';

export default function SeaRouteParticles({ openingRef }: { openingRef: RefObject<HTMLElement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const opening = openingRef.current, canvas = canvasRef.current;
    if (!opening || !canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, visible = false, documentVisible = document.visibilityState === 'visible', sceneActive = false;
    let geometry: SeaRouteGeometry, seeds = createSeaRouteField(240);
    let height = 0, width = 0, dpr = 1, disposed = false;
    let textMasks: { left: number; right: number; top: number; bottom: number }[] = [];
    const sceneVisibility = new Map<Element, boolean>();
    const canRun = () => shouldAnimatePresentation({ paused: false, reducedMotion: media.matches, visible, documentVisible, sceneActive });
    const progress = () => {
      const distance = Math.max(1, height - Math.min(window.innerHeight * .68, 700));
      return Math.max(0, Math.min(1, -opening.getBoundingClientRect().top / distance));
    };
    const draw = (time: number) => {
      frame = 0;
      if (disposed || !canRun() || !geometry) return;
      const p = progress();
      context.clearRect(0, 0, width, height);
      canvas.dataset.progress = p.toFixed(3);
      opening.style.setProperty('--route-progress', String(p));
      for (const seed of seeds) {
        const point = projectSeaRouteParticle(seed, p, geometry, time);
        if (textMasks.some(mask => point.x >= mask.left && point.x <= mask.right && point.y >= mask.top && point.y <= mask.bottom)) continue;
        context.fillStyle = seed.warmth > .5 ? `rgba(243,201,119,${point.opacity})` : `rgba(255,244,216,${point.opacity})`;
        // Darker gold maintains a readable direction against the paper section.
        if (p > .6) context.fillStyle = `rgba(173,117,37,${point.opacity})`;
        context.beginPath();
        context.ellipse(point.x, point.y, point.radius * (p < .25 ? 1.8 : 1), point.radius, 0, 0, Math.PI * 2);
        context.fill();
      }
      canvas.dataset.drawing = p < .7 ? 'true' : 'false';
      if (p < .7) frame = requestAnimationFrame(draw);
    };
    const schedule = () => {
      if (!frame && canRun() && !disposed) frame = requestAnimationFrame(draw);
      if (!canRun()) { cancelAnimationFrame(frame); frame = 0; canvas.dataset.drawing = 'false'; }
    };
    const measure = () => {
      const rect = opening.getBoundingClientRect();
      const hero = opening.querySelector<HTMLElement>('.hero');
      const route = opening.querySelector<SVGSVGElement>('.route-diagram-drawing');
      if (!hero || !route) return;
      width = rect.width; height = rect.height;
      const mobile = width < 700;
      const routeRect = route.getBoundingClientRect();
      textMasks = Array.from(opening.querySelectorAll('.hero h1,.hero-description,.hero-kicker,.route-story-heading,.route-story-copy,.route-story-foot,.route-place')).map(element => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left - rect.left - 8, right: bounds.right - rect.left + 8, top: bounds.top - rect.top - 8, bottom: bounds.bottom - rect.top + 8 };
      });
      dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      seeds = createSeaRouteField(mobile ? 100 : 280);
      geometry = {
        width, heroHeight: hero.offsetHeight, waterline: hero.offsetHeight * (mobile ? .58 : .73),
        routeLeft: routeRect.left - rect.left, routeTop: routeRect.top - rect.top,
        routeWidth: routeRect.width, routeHeight: routeRect.height, mobile,
      };
      schedule();
    };
    const visibilityObserver = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); schedule(); }, { threshold: 0 });
    visibilityObserver.observe(opening);
    const sceneObserver = new IntersectionObserver(entries => {
      for (const entry of entries) sceneVisibility.set(entry.target, entry.isIntersecting);
      updateScene();
    }, { threshold: 0 });
    const updateScene = () => {
      sceneActive = Array.from(sceneVisibility).some(([element, isVisible]) => isVisible && element.getAttribute('data-live') === 'true');
      if (sceneActive) context.clearRect(0, 0, width, height);
      schedule();
    };
    const sceneMutation = new MutationObserver(updateScene);
    document.querySelectorAll('.immersive-stage').forEach(stage => {
      sceneVisibility.set(stage, false); sceneObserver.observe(stage); sceneMutation.observe(stage, { attributes: true, attributeFilter: ['data-live'] });
    });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(opening);
    const onVisibility = () => { documentVisible = document.visibilityState === 'visible'; schedule(); };
    const onMedia = () => { if (media.matches) context.clearRect(0, 0, width, height); schedule(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    media.addEventListener('change', onMedia);
    opening.dataset.particleActive = 'true';
    measure();
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      visibilityObserver.disconnect(); sceneObserver.disconnect(); sceneMutation.disconnect(); resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure); media.removeEventListener('change', onMedia);
      delete opening.dataset.particleActive; opening.style.removeProperty('--route-progress');
      canvas.width = 0; canvas.height = 0;
    };
  }, [openingRef]);
  return <canvas ref={canvasRef} className="sea-route-particles" aria-hidden="true" data-drawing="false"/>;
}
