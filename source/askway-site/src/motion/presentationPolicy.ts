export type PresentationPolicy = {
  ready: boolean;
  paused: boolean;
  reducedMotion: boolean;
  documentVisible: boolean;
  saveData: boolean;
};

export type PresentationSurface = { id: string; visible: boolean; priority: number };

export function allowsPresentationMotion(state: PresentationPolicy): boolean {
  return state.ready && !state.paused && !state.reducedMotion && !state.saveData && state.documentVisible;
}

export function allowsSurfaceAnimation(localPreference: boolean, animationAllowed = true, reducedMotion = false): boolean {
  return localPreference && animationAllowed && !reducedMotion;
}

export function selectPresentationSurface(surfaces: readonly PresentationSurface[]): string | null {
  let owner: PresentationSurface | null = null;
  for (const surface of surfaces) {
    if (!surface.visible || !surface.id || !Number.isFinite(surface.priority)) continue;
    if (!owner || surface.priority > owner.priority || (surface.priority === owner.priority && surface.id < owner.id)) owner = surface;
  }
  return owner?.id ?? null;
}

export function updatePresentationSurface(surfaces: readonly PresentationSurface[], next: PresentationSurface): readonly PresentationSurface[] {
  const index = surfaces.findIndex(surface => surface.id === next.id);
  if (index < 0) return [...surfaces, next];
  const previous = surfaces[index];
  if (previous.visible === next.visible && previous.priority === next.priority) return surfaces;
  return surfaces.map((surface, position) => position === index ? next : surface);
}

export function releasePresentationSurface(surfaces: readonly PresentationSurface[], id: string): readonly PresentationSurface[] {
  return surfaces.some(surface => surface.id === id) ? surfaces.filter(surface => surface.id !== id) : surfaces;
}
