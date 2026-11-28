import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pause, Play, Waves } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { allowsPresentationMotion, releasePresentationSurface, selectPresentationSurface, updatePresentationSurface, type PresentationSurface } from './presentationPolicy';

type PresentationMotion = {
  ready: boolean; paused: boolean; reducedMotion: boolean; documentVisible: boolean; saveData: boolean; motionAllowed: boolean; togglePaused: () => void;
};
const MotionContext = createContext<PresentationMotion>({ ready: false, paused: false, reducedMotion: true, documentVisible: false, saveData: true, motionAllowed: false, togglePaused() {} });
type SurfaceRegistry = { owner: string | null; register: (surface: PresentationSurface) => void; release: (id: string) => void };
const SurfaceContext = createContext<SurfaceRegistry>({ owner: null, register() {}, release() {} });
const preferenceKey = 'askway.presentation.paused';

export function PresentationMotionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(false);
  const [saveData, setSaveData] = useState(true);
  const [surfaces, setSurfaces] = useState<readonly PresentationSurface[]>([]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMedia = () => setReducedMotion(media.matches);
    const updateVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection;
    const updateConnection = () => setSaveData(Boolean(connection?.saveData));
    try { setPaused(sessionStorage.getItem(preferenceKey) === 'true'); } catch { /* A memory-only preference remains usable. */ }
    updateMedia(); updateVisibility(); updateConnection(); setReady(true);
    media.addEventListener('change', updateMedia);
    document.addEventListener('visibilitychange', updateVisibility);
    connection?.addEventListener?.('change', updateConnection);
    return () => { media.removeEventListener('change', updateMedia); document.removeEventListener('visibilitychange', updateVisibility); connection?.removeEventListener?.('change', updateConnection); };
  }, []);

  const motionAllowed = allowsPresentationMotion({ ready, paused, reducedMotion, documentVisible, saveData });
  useEffect(() => {
    document.documentElement.dataset.presentationMotion = motionAllowed ? 'running' : 'paused';
    return () => { delete document.documentElement.dataset.presentationMotion; };
  }, [motionAllowed]);

  const togglePaused = useCallback(() => {
    setPaused(previous => {
      const next = !previous;
      try { sessionStorage.setItem(preferenceKey, String(next)); } catch { /* Do not make storage a prerequisite for a pause. */ }
      return next;
    });
  }, []);
  const register = useCallback((surface: PresentationSurface) => setSurfaces(previous => updatePresentationSurface(previous, surface)), []);
  const release = useCallback((id: string) => setSurfaces(previous => releasePresentationSurface(previous, id)), []);
  const owner = motionAllowed ? selectPresentationSurface(surfaces) : null;
  const registry = useMemo(() => ({ owner, register, release }), [owner, register, release]);
  const value = useMemo(() => ({ ready, paused, reducedMotion, documentVisible, saveData, motionAllowed, togglePaused }), [ready, paused, reducedMotion, documentVisible, saveData, motionAllowed, togglePaused]);
  return <MotionContext.Provider value={value}><SurfaceContext.Provider value={registry}>{children}</SurfaceContext.Provider></MotionContext.Provider>;
}

export const usePresentationMotion = () => useContext(MotionContext);

export function usePresentationSurface(id: string, visible: boolean, priority: number): boolean {
  const { motionAllowed } = usePresentationMotion();
  const { owner, register, release } = useContext(SurfaceContext);
  useEffect(() => { register({ id, visible: visible && motionAllowed, priority }); }, [id, visible, priority, motionAllowed, register]);
  useEffect(() => () => release(id), [id, release]);
  return motionAllowed && visible && owner === id;
}

export function PresentationMotionControl() {
  const { pathname } = useLocation();
  const { ready, paused, reducedMotion, togglePaused } = usePresentationMotion();
  if (pathname.startsWith('/experience')) return null;
  const label = reducedMotion ? '已减少动态效果' : paused ? '播放动态效果' : '暂停动态效果';
  return <button className="presentation-toggle" type="button" onClick={togglePaused}
    aria-label={label} aria-pressed={paused} disabled={!ready || reducedMotion}
    title={reducedMotion ? '已遵循系统的减少动态效果设置' : label}>
    {reducedMotion ? <Waves size={16} aria-hidden="true"/> : paused ? <Play size={15} aria-hidden="true"/> : <Pause size={15} aria-hidden="true"/>}
    <span>{label}</span>
  </button>;
}
