import { Component, useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { SceneProps } from '../contracts';
import type { CitySandboxProps } from './CitySandbox';
import RouteMap2D from '../map/RouteMap2D';

class SceneBoundary extends Component<{ children: ReactNode; onFailure: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure('三维沙盘暂时无法显示。请重试，或返回二维地图继续查看当前方案。'); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Mount only after the user enables 3D; the first SSR/client render remains an SVG placeholder. */
export default function ClientScene(props: SceneProps & { onFallback: () => void }) {
  const [SceneComponent, setSceneComponent] = useState<ComponentType<CitySandboxProps> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    import('./CitySandbox').then(module => {
      if (!cancelled) setSceneComponent(() => module.default);
    }).catch(() => {
      if (!cancelled) setFailure('三维资源暂时未能加载。请重试，或返回二维地图继续查看当前方案。');
    });
    return () => { cancelled = true; };
  }, [attempt]);
  const retry = () => {
    setFailure(null);
    setSceneComponent(null);
    setAttempt(value => value + 1);
  };

  return <div className="client-scene" data-scene-status={failure ? 'error' : SceneComponent ? 'loaded' : 'loading'}>
    {failure ? <>
      <div className="scene-fallback">
        <p role="alert">{failure}</p>
        <p>当前方案与选中地点已保留。</p>
        <div className="scene-fallback__actions map-controls">
          <button type="button" className="map-control" onClick={retry}>重试三维</button>
          <button type="button" className="map-control" onClick={props.onFallback}>返回二维</button>
        </div>
      </div>
      <RouteMap2D {...props} />
    </> : SceneComponent ? <SceneBoundary key={attempt} onFailure={setFailure}>
      <SceneComponent {...props} onFailure={setFailure} />
    </SceneBoundary> : <>
      <div className="scene-loading">
        <p role="status">正在加载城市纸艺沙盘，地点与路线可先在二维地图查看。</p>
        <button type="button" className="map-control" onClick={props.onFallback}>返回二维</button>
      </div>
      <RouteMap2D {...props} />
    </>}
  </div>;
}
