import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { catalog } from '../data/catalog.ts';
import { makeDefaultDraft } from '../config';
import { proposeCuratedPlan } from '../domain/curated-planner.ts';
import type { CitySandboxProps } from './CitySandbox';
import './cinematic-city.css';

const example = proposeCuratedPlan(catalog, makeDefaultDraft(), null, { requestId: 'cinematic-showcase', sessionEpoch: 0, draftRevision: 0, nowMs: 0 });
const plan = example.kind === 'proposal' ? example.proposal.candidate : null;
class ViewBoundary extends Component<{ children: ReactNode; fail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.fail(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export interface CinematicCityProps {
  view: 'coast' | 'theatre' | 'overview';
  lighting: 'day' | 'dusk';
  reducedMotion: boolean;
  onFailure?: () => void;
  animationEnabled?: boolean;
  onAnimationChange?: (enabled: boolean) => void;
}
export default function CinematicCity({ view, lighting, reducedMotion, onFailure, animationEnabled, onAnimationChange }: CinematicCityProps) {
  const [Scene, setScene] = useState<ComponentType<CitySandboxProps> | null>(null);
  const [selected, setSelected] = useState<string | null>('ZS-004');
  const [failed, setFailed] = useState(false);
  const callback = useRef(onFailure); callback.current = onFailure;
  const fail = () => { setFailed(true); callback.current?.(); };
  useEffect(() => {
    let cancelled = false;
    import('./CitySandbox').then(module => { if (!cancelled) setScene(() => module.default); }).catch(() => { if (!cancelled) { setFailed(true); callback.current?.(); } });
    return () => { cancelled = true; };
  }, []);
  return <div className="cinematic-city" data-cinematic-state={failed ? 'fallback' : Scene ? 'mounted' : 'loading'}>
    {failed ? <p className="cinematic-city__status" role="status">当前设备暂未能显示实时场景，已保留场景插图。</p>
      : Scene ? <ViewBoundary fail={fail}><Scene catalog={catalog} plan={plan} selectedPlaceId={selected} onSelectPlace={setSelected} reducedMotion={reducedMotion} scenePreset={view === 'theatre' ? 'theatre' : view === 'coast' ? 'route' : 'overview'} lighting={lighting} presentation="cinematic" animationEnabled={animationEnabled} onAnimationChange={onAnimationChange} onFailure={fail}/></ViewBoundary>
      : <p className="cinematic-city__status" role="status">正在加载海岸光影，场景插图可先查看。</p>}
  </div>;
}
