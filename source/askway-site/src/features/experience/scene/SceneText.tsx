import type { SceneProps } from '../contracts';
import type { SceneLayout, ScenePlacePoint } from '../map/projection';

export function orderedScenePoints(layout: SceneLayout, hasPlan: boolean): ScenePlacePoint[] {
  if (!hasPlan) return layout.points;
  const byId = new Map(layout.points.map(point => [point.place.id, point]));
  return layout.routePlaceIds.map(id => byId.get(id)).filter((point): point is ScenePlacePoint => Boolean(point));
}

export function visibleScenePoints(layout: SceneLayout, hasPlan: boolean, selectedPlaceId: string | null): ScenePlacePoint[] {
  if (!hasPlan) return layout.points;
  return layout.points.filter(point => point.order !== null || point.previousOrder !== null || point.place.id === selectedPlaceId);
}

export function ScenePlaceList({ points, selectedPlaceId, onSelectPlace, playbackPlaceId, label }: {
  points: ScenePlacePoint[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  playbackPlaceId: string | null;
  label: string;
}) {
  return <ol className="scene-places" aria-label={label}>
    {points.map((point, index) => {
      const selected = point.place.id === selectedPlaceId;
      const playing = point.place.id === playbackPlaceId;
      return <li key={point.place.id}>
        <button type="button" className={[selected ? 'is-selected' : '', playing ? 'is-playing' : ''].filter(Boolean).join(' ')}
          onClick={() => onSelectPlace(point.place.id)} aria-pressed={selected} data-place-id={point.place.id}>
          <span className="scene-places__number" aria-hidden="true">{point.order ?? index + 1}</span>
          <span className="scene-places__name">{point.place.name}</span>
          {(selected || playing) && <span className="scene-places__state">{playing ? '预演到此' : '已选'}</span>}
        </button>
      </li>;
    })}
  </ol>;
}

export function SceneLegend({ hasPlan, hasPrevious }: { hasPlan: boolean; hasPrevious: boolean }) {
  return <div className="scene-legend" role="group" aria-label="地图图例">
    <span><i className={hasPlan ? 'legend-line' : 'legend-dot'} aria-hidden="true" />{hasPlan ? '当前方案 · 实线' : '公开参考地点'}</span>
    {hasPrevious && <span><i className="legend-line legend-line--old" aria-hidden="true" />上一版 · 虚线</span>}
    <span><i className="legend-dot is-selected" aria-hidden="true" />选中地点</span>
  </div>;
}

export function SceneReferenceNote({ rejectedCount = 0, hasOsmSources = false }: { rejectedCount?: number; hasOsmSources?: boolean }) {
  return <p className="scene-note">WGS84 公开参考点。连线为位置关系示意；海岸、地形、街区与地标为风格化辅助。道路与入口未核实，不用于导航。
    {rejectedCount > 0 && <span> 有 {rejectedCount} 项定位资料未绘入图中。</span>}
    {hasOsmSources && <span> 点位：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 贡献者 · ODbL</a>。</span>}
  </p>;
}

export function SceneComparison({ catalog, plan, previousPlan, selectedPlaceId, onSelectPlace }: Pick<SceneProps, 'catalog' | 'plan' | 'previousPlan' | 'selectedPlaceId' | 'onSelectPlace'>) {
  if (!plan || !previousPlan) return null;
  const names = new Map(catalog.places.map(place => [place.id, place.name]));
  const added = plan.orderedPlaceIds.filter(id => !previousPlan.orderedPlaceIds.includes(id));
  const removed = previousPlan.orderedPlaceIds.filter(id => !plan.orderedPlaceIds.includes(id));
  const keptOld = previousPlan.orderedPlaceIds.filter(id => plan.orderedPlaceIds.includes(id));
  const keptNew = plan.orderedPlaceIds.filter(id => previousPlan.orderedPlaceIds.includes(id));
  const orderChanged = keptOld.join('|') !== keptNew.join('|');
  const nameList = (ids: string[]) => ids.map(id => names.get(id) ?? id).join('、');
  return <div className="scene-comparison">
    <p>对比上一版 v{previousPlan.versionNo}：虚线保留上一版路线。
      {added.length > 0 && <span> 加入 {nameList(added)}。</span>}
      {removed.length > 0 && <span> 移出 {nameList(removed)}。</span>}
      <span>{orderChanged ? ' 保留地点的顺序已调整。' : ' 保留地点的顺序不变。'}</span>
    </p>
    {removed.length > 0 && <div className="map-controls" aria-label="查看上一版移出地点">
      {removed.map(id => <button key={id} type="button" className="map-control" aria-pressed={selectedPlaceId === id}
        onClick={() => onSelectPlace(id)}>查看 {names.get(id) ?? id}</button>)}
    </div>}
  </div>;
}
