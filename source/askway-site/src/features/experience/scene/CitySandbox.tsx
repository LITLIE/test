import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneProps } from '../contracts';
import { buildSceneLayout } from '../map/projection';
import { createCityRuntime } from './cityRuntime';
import type { CityRuntime, CitySnapshot, CityStats } from './cityRuntime';
import { orderedScenePoints, visibleScenePoints, SceneComparison, SceneLegend, ScenePlaceList, SceneReferenceNote } from './SceneText';
import { allowsSurfaceAnimation } from '../../../motion/presentationPolicy';

export interface CitySandboxProps extends SceneProps {
  onFailure: (message: string) => void;
  animationAllowed?: boolean;
}

export default function CitySandbox(props: CitySandboxProps) {
  const { catalog, plan, previousPlan, selectedPlaceId, onSelectPlace, reducedMotion, playbackIndex, onFailure } = props;
  const cinematic = props.presentation === 'cinematic';
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<CityRuntime | null>(null);
  const callbacksRef = useRef({ onSelectPlace, onFailure });
  callbacksRef.current = { onSelectPlace, onFailure };
  const [stats, setStats] = useState<CityStats | null>(null);
  const [viewDescription, setViewDescription] = useState('全览当前方案');
  const [animationEnabled, setAnimationEnabled] = useState(props.animationEnabled ?? cinematic);
  const animationAllowed = props.animationAllowed ?? true;
  const effectiveAnimation = allowsSurfaceAnimation(animationEnabled, animationAllowed, reducedMotion);
  const [lighting, setLighting] = useState(props.lighting ?? 'day');
  const layout = useMemo(() => buildSceneLayout(catalog, plan, previousPlan), [catalog, plan, previousPlan]);
  const playbackPlaceId = plan && playbackIndex != null ? plan.orderedPlaceIds[playbackIndex] ?? null : null;
  const snapshot = useMemo<CitySnapshot>(() => ({
    layout,
    visiblePoints: visibleScenePoints(layout, Boolean(plan), selectedPlaceId),
    selectedPlaceId, playbackPlaceId, reducedMotion,
    preset: props.scenePreset ?? 'overview', lighting, presentation: props.presentation ?? 'workbench',
  }), [layout, plan, selectedPlaceId, playbackPlaceId, reducedMotion, props.scenePreset, lighting, props.presentation]);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let active = true;
    let ownedRuntime: CityRuntime | null = null;
    setStats(null);
    try {
      ownedRuntime = createCityRuntime(host, snapshotRef.current, {
        onPick: id => { if (active) callbacksRef.current.onSelectPlace(id); },
        onFailure: message => { if (active) callbacksRef.current.onFailure(message); },
        onReady: nextStats => { if (active) setStats(nextStats); },
        onViewChange: description => { if (active) setViewDescription(description); },
      });
      runtimeRef.current = ownedRuntime;
      ownedRuntime.setAnimation(effectiveAnimation);
    } catch {
      callbacksRef.current.onFailure('这台设备暂时无法开启三维沙盘。可以重试，或返回二维地图继续查看当前方案。');
    }
    return () => {
      active = false;
      ownedRuntime?.dispose();
      if (runtimeRef.current === ownedRuntime) runtimeRef.current = null;
    };
    // The catalogue owns the fixed coordinate frame and static city; route updates keep the camera runtime.
  }, [catalog]);

  useEffect(() => { runtimeRef.current?.update(snapshot); }, [snapshot]);
  useEffect(() => { runtimeRef.current?.setPreset(props.scenePreset ?? 'overview'); }, [props.scenePreset]);
  useEffect(() => { if (props.lighting) setLighting(props.lighting); }, [props.lighting]);
  useEffect(() => { runtimeRef.current?.setLighting(lighting); }, [lighting]);
  useEffect(() => { runtimeRef.current?.setAnimation(effectiveAnimation); }, [effectiveAnimation]);
  useEffect(() => { if (props.animationEnabled !== undefined) setAnimationEnabled(props.animationEnabled); }, [props.animationEnabled]);
  const toggleAnimation = () => {
    const next = !animationEnabled;
    setAnimationEnabled(next);
    props.onAnimationChange?.(next);
  };

  if (cinematic) return <section className="city-sandbox city-sandbox--cinematic" aria-label="海岸写实三维场景"
    data-scene-state={stats ? 'ready' : 'loading'}>
    <div className="city-sandbox__canvas" ref={hostRef} />
    <p className="city-sandbox__status" role="status">{stats ? viewDescription : '正在绘制海岸光影…'}</p>
    {!reducedMotion && <button type="button" className="map-control city-sandbox__motion" aria-pressed={animationEnabled}
      onClick={toggleAnimation} disabled={!stats}>{animationEnabled ? '暂停海面' : '开启海面动效'}</button>}
  </section>;

  return <section className={`city-sandbox${reducedMotion ? ' has-reduced-motion' : ''}`} aria-label="城市写实三维沙盘"
    data-scene-state={stats ? 'ready' : 'loading'}>
    <div className="city-sandbox__canvas" ref={hostRef} />
    <div className="city-sandbox__toolbar">
      <div className="map-controls" role="group" aria-label="三维沙盘视图控制">
        <button type="button" className="map-control" aria-label="向左旋转三维沙盘" onClick={() => runtimeRef.current?.rotate(-1)} disabled={!stats}>左转 −</button>
        <button type="button" className="map-control" aria-label="向右旋转三维沙盘" onClick={() => runtimeRef.current?.rotate(1)} disabled={!stats}>右转 +</button>
        <button type="button" className="map-control" aria-label="放大三维沙盘" onClick={() => runtimeRef.current?.zoom(1)} disabled={!stats}>放大 +</button>
        <button type="button" className="map-control" aria-label="缩小三维沙盘" onClick={() => runtimeRef.current?.zoom(-1)} disabled={!stats}>缩小 −</button>
        <button type="button" className="map-control" onClick={() => runtimeRef.current?.overview()} disabled={!stats}>全览</button>
        <button type="button" className="map-control" onClick={() => runtimeRef.current?.reset()} disabled={!stats}>复位</button>
        <button type="button" className="map-control" onClick={() => runtimeRef.current?.focusSelected()} disabled={!stats || !selectedPlaceId}>聚焦选中</button>
        <button type="button" className="map-control" aria-pressed={animationEnabled} onClick={toggleAnimation} disabled={!stats || reducedMotion}>{animationEnabled ? '暂停海面' : '海面动效'}</button>
        <button type="button" className="map-control" aria-pressed={lighting === 'dusk'} onClick={() => setLighting(value => value === 'day' ? 'dusk' : 'day')} disabled={!stats}>{lighting === 'day' ? '日落光照' : '日间光照'}</button>
      </div>
      <p className="city-sandbox__status" role="status" aria-live="polite">{stats ? viewDescription : '正在绘制三维沙盘…'}</p>
    </div>
    <p className="city-sandbox__hint">用按钮控制视角；下方地点按钮可查看详情。滚轮和纵向滑动用于浏览页面。
      {reducedMotion && <span> 已减弱动画，选择与预演不会自动移动镜头。</span>}
    </p>
    <SceneLegend hasPlan={Boolean(plan)} hasPrevious={Boolean(previousPlan)} />
    <ScenePlaceList points={orderedScenePoints(layout, Boolean(plan))} selectedPlaceId={selectedPlaceId} onSelectPlace={onSelectPlace}
      playbackPlaceId={playbackPlaceId} label={plan ? '按方案顺序选择三维地点' : '选择三维参考地点'} />
    <SceneComparison catalog={catalog} plan={plan} previousPlan={previousPlan} selectedPlaceId={selectedPlaceId} onSelectPlace={onSelectPlace} />
    <SceneReferenceNote rejectedCount={layout.rejectedPlaceIds.length + layout.rejectedLegIds.length}
      hasOsmSources={catalog.sources.some(source => source.title.includes('OpenStreetMap'))} />
  </section>;
}
