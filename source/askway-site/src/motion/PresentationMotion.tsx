import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pause, Play, Waves } from 'lucide-react';
import { useLocation } from 'react-router-dom';

type PresentationMotion = {
  ready: boolean; paused: boolean; reducedMotion: boolean; motionAllowed: boolean; togglePaused: () => void;
};
const MotionContext = createContext<PresentationMotion>({ ready: false, paused: false, reducedMotion: true, motionAllowed: false, togglePaused() {} });
const preferenceKey = 'askway.presentation.paused';

export function PresentationMotionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMedia = () => setReducedMotion(media.matches);
    const updateVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    try { setPaused(sessionStorage.getItem(preferenceKey) === 'true'); } catch { /* A memory-only preference remains usable. */ }
    updateMedia(); updateVisibility(); setReady(true);
    media.addEventListener('change', updateMedia);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => { media.removeEventListener('change', updateMedia); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);

  const motionAllowed = ready && !paused && !reducedMotion;
  useEffect(() => {
    document.documentElement.dataset.presentationMotion = motionAllowed && documentVisible ? 'running' : 'paused';
    return () => { delete document.documentElement.dataset.presentationMotion; };
  }, [motionAllowed, documentVisible]);

  const value = useMemo(() => ({ ready, paused, reducedMotion, motionAllowed, togglePaused: () => {
    setPaused(previous => {
      const next = !previous;
      try { sessionStorage.setItem(preferenceKey, String(next)); } catch { /* Do not make storage a prerequisite for a pause. */ }
      return next;
    });
  } }), [ready, paused, reducedMotion, motionAllowed]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export const usePresentationMotion = () => useContext(MotionContext);

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
