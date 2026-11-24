import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minus, Plus } from 'lucide-react';
import type { SceneProps } from '../contracts';
import {
  buildSceneLayout, createMapViewportBounds, createSvgProjection, fitMapBounds,
  layoutMapLabels, projectWgs84, svgMetresPerPixel,
} from './projection';
import type { LocalPoint, MapLabelInput, ScenePlacePoint, Wgs84Coordinate } from './projection';
import { orderedScenePoints, visibleScenePoints, SceneComparison, SceneLegend, ScenePlaceList, SceneReferenceNote } from '../scene/SceneText';
import './map-detail.css';

const PADDING = 38;
const LABEL_SIDES: Record<string, 'left' | 'right'> = {
  'ZS-001': 'right', 'ZS-002': 'left', 'ZS-003': 'left', 'ZS-004': 'right', 'ZS-005': 'right',
  'ZS-006': 'right', 'ZS-007': 'left', 'ZS-008': 'right', 'ZS-009': 'left', 'ZS-010': 'right',
};

// Original illustrative anchors, separate from the catalogue's sourced reference points.
// These outlines and streets are not a surveyed shore, cadastral plan, or navigation network.
const COAST_OUTLINE: Wgs84Coordinate[] = [
  [113.5590, 22.3160], [113.5684, 22.3109], [113.5770, 22.3065], [113.5818, 22.3005],
  [113.5800, 22.2944], [113.5792, 22.2898], [113.5760, 22.2853], [113.5741, 22.2808],
  [113.5747, 22.2762], [113.5765, 22.2720], [113.5782, 22.2690], [113.5808, 22.2671],
  [113.5830, 22.2650], [113.5850, 22.2631], [113.5860, 22.2592], [113.5885, 22.2556],
  [113.5920, 22.2518], [113.5895, 22.2470], [113.5840, 22.2410], [113.5790, 22.2350],
];
const ISLAND_OUTLINE: Wgs84Coordinate[] = [
  [113.5818, 22.2867], [113.5835, 22.2880], [113.5863, 22.2877], [113.5894, 22.2865],
  [113.5901, 22.2843], [113.5892, 22.2812], [113.5864, 22.2799], [113.5834, 22.2814],
  [113.5820, 22.2836],
];
const BRIDGE_OUTLINE: Wgs84Coordinate[] = [[113.5760, 22.2844], [113.5790, 22.2853], [113.5824, 22.2852]];

function smoothPath(points: readonly LocalPoint[], closed = false) {
  if (!points.length) return '';
  const at = (index: number) => closed ? points[(index + points.length) % points.length] : points[Math.max(0, Math.min(points.length - 1, index))];
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - (closed ? 0 : 1); index += 1) {
    const a = at(index - 1), b = at(index), c = at(index + 1), d = at(index + 2);
    path += ` C${(b.x + (c.x - a.x) / 6).toFixed(2)},${(b.y + (c.y - a.y) / 6).toFixed(2)}` +
      ` ${(c.x - (d.x - b.x) / 6).toFixed(2)},${(c.y - (d.y - b.y) / 6).toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`;
  }
  return path + (closed ? ' Z' : '');
}

function organicArea(centre: LocalPoint, radiusX: number, radiusY: number, seed = 0): LocalPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI / 6;
    const ripple = 1 + Math.sin(index * 2.4 + seed) * 0.15;
    return { x: centre.x + Math.cos(angle) * radiusX * ripple, y: centre.y + Math.sin(angle) * radiusY * ripple };
  });
}

/** Small authored silhouettes complement reference badges; they do not model an entrance. */
function LandmarkGlyph({ id, category }: { id: string; category: ScenePlacePoint['place']['category'] }) {
  if (id === 'ZS-004') return <g className="coastal-map__landmark coastal-map__landmark--shell">
    <ellipse cx="1" cy="11" rx="19" ry="5" />
    <path d="M-16 9 C-16-10-3-23 2-23 C12-19 18-3 17 9 Z" />
    <path d="M-9 9 C-7-8 0-20 2-23 M-2 9 C2-6 4-14 2-23 M6 9 C10-3 9-12 2-23" />
    <path d="M13 10 C13-1 20-11 24-11 C31-5 31 3 29 10 Z" />
  </g>;
  if (id === 'ZS-001') return <g className="coastal-map__landmark coastal-map__landmark--statue">
    <ellipse cx="0" cy="11" rx="12" ry="4" /><path d="M-6 9 L-4-3 L1-8 L6 9 Z M-2-3 L-7-12 L-2-20 M2-5 L6-13 L1-20" />
    <circle cx="0" cy="-10" r="3" /><circle cx="0" cy="-23" r="4" />
  </g>;
  if (category === 'park') return <g className="coastal-map__landmark coastal-map__landmark--park">
    <ellipse cx="0" cy="10" rx="16" ry="5" /><path d="M-7 10 V-6 M8 10 V-1" />
    <path d="M-17-3 L-7-20 L3-3 Z M0 2 L8-14 L17 2 Z" />
  </g>;
  if (category === 'culture') return <g className="coastal-map__landmark coastal-map__landmark--museum">
    <path d="M-17-4 L1-11 L18-4 L0 3 Z M-17-4 V9 L0 16 L18 9 V-4 M0 3 V16" />
    <path d="M-11 0 V10 M-6 2 V12 M6 2 V12 M12 0 V10" />
  </g>;
  return <g className="coastal-map__landmark coastal-map__landmark--coast">
    <path d="M-14 4 Q-7-2 0 4 T14 4 M-14 11 Q-7 5 0 11 T14 11" />
    <path d="M-1 3 V-17 M-12-10 Q-1-23 10-10 Z" />
  </g>;
}

export default function RouteMap2D(props: SceneProps) {
  const { catalog, plan, previousPlan, selectedPlaceId, onSelectPlace, reducedMotion, playbackIndex } = props;
  const titleId = useId(), descriptionId = useId(), hintId = useId();
  const artId = useId().replaceAll(':', '');
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 560, height: 540 });
  const [viewMode, setViewMode] = useState<'route' | 'all'>(plan ? 'route' : 'all');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<LocalPoint>({ x: 0, y: 0 });
  const layout = useMemo(() => buildSceneLayout(catalog, plan, previousPlan), [catalog, plan, previousPlan]);
  const routePoints = visibleScenePoints(layout, Boolean(plan), selectedPlaceId);
  const visiblePoints = viewMode === 'all' || !plan ? layout.points : routePoints;
  const listPoints = viewMode === 'all' || !plan ? layout.points : orderedScenePoints(layout, true);
  const fitBounds = useMemo(() => viewMode === 'all' || !plan ? layout.bounds : fitMapBounds([
    ...visibleScenePoints(layout, true, selectedPlaceId).map(point => point.local),
    ...layout.currentLegs.flatMap(leg => leg.points), ...layout.previousLegs.flatMap(leg => leg.points),
  ], layout.bounds), [layout, plan, viewMode, selectedPlaceId]);
  const frame = createMapViewportBounds(fitBounds, zoom, offset, layout.bounds);
  const project = createSvgProjection(frame, size.width, size.height, PADDING);
  const metresPerPixel = svgMetresPerPixel(frame, size.width, size.height, PADDING);
  const playbackPlaceId = plan && playbackIndex != null ? plan.orderedPlaceIds[playbackIndex] ?? null : null;
  const selected = layout.points.find(point => point.place.id === selectedPlaceId);
  const centre = { x: (frame.minX + frame.maxX) / 2, y: (frame.minY + frame.maxY) / 2 };
  const fitCentre = { x: (fitBounds.minX + fitBounds.maxX) / 2, y: (fitBounds.minY + fitBounds.maxY) / 2 };
  const panStep = metresPerPixel * Math.min(size.width, size.height) * 0.2;
  const pan = (east: number, north: number) => setOffset({ x: centre.x - fitCentre.x + east * panStep, y: centre.y - fitCentre.y + north * panStep });
  const canPan = {
    west: frame.minX > layout.bounds.minX + 1, east: frame.maxX < layout.bounds.maxX - 1,
    north: frame.maxY < layout.bounds.maxY - 1, south: frame.minY > layout.bounds.minY + 1,
  };
  const selectPoint = (id: string) => {
    onSelectPlace(id);
    const point = layout.points.find(item => item.place.id === id);
    if (!point) return;
    const position = project(point.local);
    if (position.x < 36 || position.x > size.width - 36 || position.y < 40 || position.y > size.height - 40) {
      setOffset({ x: point.local.x - fitCentre.x, y: point.local.y - fitCentre.y });
    }
  };
  const changeZoom = (direction: number) => setZoom(value => Math.min(3.6, Math.max(1, Math.round((value + direction * 0.3) * 10) / 10)));
  const resetView = (mode = viewMode) => { setViewMode(mode); setZoom(1); setOffset({ x: 0, y: 0 }); };

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const resize = () => {
      const width = node.clientWidth;
      if (width < 160) return;
      // Matching viewBox units to actual display pixels keeps names at 14px on phones.
      const height = width < 430 ? 540 : Math.round(Math.max(480, Math.min(580, width * 0.84)));
      setSize(prior => prior.width === width && prior.height === height ? prior : { width, height });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setZoom(1); setOffset({ x: 0, y: 0 });
    if (plan) setViewMode('route');
  }, [plan?.id]);

  useEffect(() => {
    if (!selected) return;
    const position = project(selected.local);
    if (position.x < 36 || position.x > size.width - 36 || position.y < 40 || position.y > size.height - 40) {
      setOffset({ x: selected.local.x - fitCentre.x, y: selected.local.y - fitCentre.y });
    }
    // Selection triggers the camera; manual panning may leave it outside the view.
  }, [selectedPlaceId, playbackPlaceId]);

  const onMapKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
    const controls: Record<string, () => void> = {
      ArrowLeft: () => pan(-1, 0), ArrowRight: () => pan(1, 0), ArrowUp: () => pan(0, 1), ArrowDown: () => pan(0, -1),
      '+': () => changeZoom(1), '=': () => changeZoom(1), '-': () => changeZoom(-1), Home: () => resetView(),
    };
    if (controls[event.key]) { event.preventDefault(); controls[event.key](); }
  };
  const linePath = (points: readonly LocalPoint[], close = false) => points.map((point, index) => {
    const position = project(point);
    return `${index === 0 ? 'M' : 'L'}${position.x.toFixed(2)},${position.y.toFixed(2)}`;
  }).join(' ') + (close ? ' Z' : '');
  const curvedPath = (points: readonly LocalPoint[], close = false) => smoothPath(points.map(project), close);
  const span = Math.max(layout.bounds.maxX - layout.bounds.minX, layout.bounds.maxY - layout.bounds.minY);
  const isZhuhai = catalog.city === '珠海';
  const coast = isZhuhai ? COAST_OUTLINE.map(coordinate => projectWgs84(coordinate, layout.origin)) :
    Array.from({ length: 12 }, (_, index) => ({ x: layout.bounds.maxX - span * (0.22 + Math.sin(index * 0.8) * 0.06), y: layout.bounds.maxY - span * index / 11 }));
  const west = layout.bounds.minX - span;
  const land = [{ x: west, y: coast[0].y }, ...coast, { x: west, y: coast.at(-1)!.y }];
  const island = isZhuhai ? ISLAND_OUTLINE.map(coordinate => projectWgs84(coordinate, layout.origin)) : [];
  const shoreRoad = coast.slice(3, -2).map(point => ({ x: point.x - 115, y: point.y }));
  const inlandRoad = coast.slice(2, -2).map((point, index) => ({ x: point.x - 850 - Math.sin(index * 0.6) * 120, y: point.y }));
  const streets = Array.from({ length: 7 }, (_, index) => {
    const y = layout.bounds.minY + span * (index + 0.6) / 8;
    return [{ x: west, y: y + 160 }, { x: layout.bounds.minX + span * 0.19, y: y + 50 }, { x: layout.bounds.maxX, y: y - 150 }];
  });
  const blocks = Array.from({ length: 264 }, (_, index) => {
    const column = index % 12, row = Math.floor(index / 12);
    const x = layout.bounds.minX - span * 0.17 + column * span / 32;
    const y = layout.bounds.minY - span * 0.06 + row * span / 19;
    const width = span / 40 * (0.76 + (index % 5) * 0.04), height = span / 24 * (0.76 + (index % 3) * 0.06);
    return [{ x, y }, { x: x + width * 0.85, y: y + 14 }, { x: x + width, y: y + height * 0.2 },
      { x: x + width, y: y + height }, { x: x + 8, y: y + height - 12 }];
  });
  const hills = organicArea({ x: layout.bounds.minX + span * 0.08, y: layout.bounds.minY + span * 0.47 }, span * 0.17, span * 0.29, 2);
  const onScreen = visiblePoints.filter(point => {
    const position = project(point.local);
    return position.x >= 16 && position.x <= size.width - 16 && position.y >= 18 && position.y <= size.height - 18;
  });
  const labelInputs: MapLabelInput[] = onScreen.map(point => ({
    id: point.place.id, anchor: project(point.local),
    lines: point.place.id === 'ZS-004' ? ['珠海大剧院', '日月贝'] : [point.place.name],
    preferredSide: LABEL_SIDES[point.place.id] ?? (point.local.x < 0 ? 'left' : 'right'),
  }));
  const labels = layoutMapLabels(labelInputs, size.width, size.height, [
    { x: size.width - 66, y: 12, width: 54, height: 68 }, { x: 14, y: size.height - 56, width: 128, height: 44 },
  ]);
  const pointsById = new Map(onScreen.map(point => [point.place.id, point]));
  const scaleMetres = [20, 50, 100, 200, 500, 1000, 2000].filter(value => value <= metresPerPixel * 86).at(-1) ?? 20;
  const scaleWidth = scaleMetres / metresPerPixel;
  const scaleLabel = scaleMetres >= 1000 ? `${scaleMetres / 1000} km` : `${scaleMetres} m`;
  const offscreenCount = visiblePoints.length - onScreen.length;
  const selectionLabel = selected ? `已选 ${selected.place.name}` : `${visiblePoints.length} 个参考地点`;

  return <figure className={`route-map route-map--coastal${reducedMotion ? ' has-reduced-motion' : ''}`}
    aria-labelledby={titleId} data-map-kind="schematic-wgs84" data-map-view={viewMode} data-map-zoom={zoom}
    data-map-width={size.width} data-map-height={size.height}>
    <div className="route-map__toolbar coastal-map__toolbar">
      <span className="route-map__heading" id={titleId}>{catalog.city} · 海岸参考图<small>WGS84 · 位置关系示意</small></span>
      <div className="coastal-map__modes" role="group" aria-label="二维地图显示范围">
        <button type="button" aria-pressed={viewMode === 'route' && Boolean(plan)} disabled={!plan} onClick={() => resetView('route')}>路线全览</button>
        <button type="button" aria-pressed={viewMode === 'all' || !plan} onClick={() => resetView('all')}>全部地点</button>
      </div>
    </div>
    <div className="coastal-map__viewport" ref={viewportRef}>
      <svg className="route-map__canvas coastal-map__canvas" viewBox={`0 0 ${size.width} ${size.height}`}
        width={size.width} height={size.height} role="group" aria-roledescription="地图" tabIndex={0}
        aria-labelledby={`${titleId} ${descriptionId}`} aria-describedby={hintId} onKeyDown={onMapKey}>
        <desc id={descriptionId}>{plan ? `当前方案按顺序连接 ${plan.orderedPlaceIds.length} 个地点。` : `展示 ${layout.points.length} 个公开参考地点。`}
          地名按钮和下方地点列表均可查看选中状态。海岸、街区、绿地、道路与地标为原创风格化辅助，路线为示意。</desc>
        <defs>
          <linearGradient id={`${artId}-sea`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--map-water-shallow)" /><stop offset="1" stopColor="var(--map-water-deep)" />
          </linearGradient>
          <linearGradient id={`${artId}-land`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--map-paper)" /><stop offset="1" stopColor="var(--map-sand-light)" />
          </linearGradient>
          <pattern id={`${artId}-waves`} width="72" height="35" patternUnits="userSpaceOnUse">
            <path d="M3 19 Q12 14 21 19 T39 19 M48 5 Q55 1 63 5" className="coastal-map__wave" />
          </pattern>
          <pattern id={`${artId}-grain`} width="13" height="13" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="4" r="0.5" /><circle cx="10" cy="11" r="0.4" />
          </pattern>
          <clipPath id={`${artId}-mainland`}><path d={curvedPath(land, true)} /></clipPath>
          <clipPath id={`${artId}-frame`}><rect width={size.width} height={size.height} rx="8" /></clipPath>
        </defs>
        <g clipPath={`url(#${artId}-frame)`}>
          <rect width={size.width} height={size.height} fill={`url(#${artId}-sea)`} />
          <rect width={size.width} height={size.height} fill={`url(#${artId}-waves)`} />
          {[150, 330, 610, 980].map(distance => <path key={distance} className="coastal-map__water-contour"
            d={curvedPath(coast.map(point => ({ x: point.x + distance, y: point.y - distance * 0.1 })))} />)}
          <path d={curvedPath(land, true)} fill={`url(#${artId}-land)`} />
          <g clipPath={`url(#${artId}-mainland)`}>
            {blocks.map((block, index) => <path key={index} className={`coastal-map__block coastal-map__block--${index % 3}`} d={linePath(block, true)} />)}
            <path className="coastal-map__hill" d={curvedPath(hills, true)} />
            {[0.78, 0.59, 0.4].map(scale => <path key={scale} className="coastal-map__hill-contour"
              d={curvedPath(organicArea({ x: layout.bounds.minX + span * 0.08, y: layout.bounds.minY + span * 0.47 }, span * 0.17 * scale, span * 0.29 * scale, 2), true)} />)}
            {layout.points.filter(point => point.place.category === 'park' && point.place.id !== 'ZS-005').map((point, index) =>
              <g key={point.place.id}><path className="coastal-map__park" d={curvedPath(organicArea(point.local, span * 0.044, span * 0.033, index), true)} />
                <path className="coastal-map__park-path" d={curvedPath(organicArea(point.local, span * 0.03, span * 0.022, index), true)} /></g>)}
            {[shoreRoad, inlandRoad, ...streets].map((street, index) => <g key={index}>
              <path className="coastal-map__street-casing" d={curvedPath(street)} />
              <path className={`coastal-map__street${index < 2 ? ' coastal-map__street--primary' : ''}`} d={curvedPath(street)} />
            </g>)}
            <path className="coastal-map__promenade" d={curvedPath(coast.map(point => ({ x: point.x - 32, y: point.y })))} />
            <path className="coastal-map__beach" d={curvedPath(coast.slice(9, 15))} />
            <path className="coastal-map__beach coastal-map__beach--south" d={curvedPath(coast.slice(15, 18))} />
          </g>
          <path className="coastal-map__coast" d={curvedPath(coast)} />
          {island.length > 0 && <g>
            <path className="coastal-map__island-beach" d={curvedPath(island, true)} />
            <path className="coastal-map__island" d={curvedPath(island, true)} />
            <path className="coastal-map__island-path" d={curvedPath(island.map(point => ({ x: (point.x + projectWgs84([113.5856, 22.2842], layout.origin).x) / 2,
              y: (point.y + projectWgs84([113.5856, 22.2842], layout.origin).y) / 2 })), true)} />
            <path className="coastal-map__bridge" d={curvedPath(BRIDGE_OUTLINE.map(coordinate => projectWgs84(coordinate, layout.origin)))} />
          </g>}
          <rect width={size.width} height={size.height} fill={`url(#${artId}-grain)`} className="coastal-map__grain" />
          <g className="coastal-map__grid" aria-hidden="true">
            {[0.25, 0.5, 0.75].map(fraction => <path key={fraction} d={`M${size.width * fraction} 0 V${size.height} M0 ${size.height * fraction} H${size.width}`} />)}
          </g>
          <text className="coastal-map__bay" x={size.width - 26} y={size.height * 0.63} textAnchor="end" aria-hidden="true">{isZhuhai ? '香 炉 湾' : '近 岸 海 域'}</text>
          <text className="coastal-map__bay-subtitle" x={size.width - 26} y={size.height * 0.63 + 22} textAnchor="end" aria-hidden="true">海岸轮廓示意</text>
          {layout.previousLegs.map(leg => <path key={`old-${leg.id}`} className="route-map__route route-map__route--previous coastal-map__route--previous" d={linePath(leg.points)} />)}
          {layout.currentLegs.map(leg => <g key={leg.id}>
            <path className="coastal-map__route-casing" d={linePath(leg.points)} />
            <path className="route-map__route coastal-map__route" d={linePath(leg.points)} />
          </g>)}
          {onScreen.map(point => {
            const position = project(point.local);
            return <g key={`art-${point.place.id}`} transform={`translate(${position.x - 8} ${position.y - 22}) scale(.72)`} aria-hidden="true">
              <LandmarkGlyph id={point.place.id} category={point.place.category} />
            </g>;
          })}
          {labels.map(item => {
            const point = pointsById.get(item.id)!;
            const active = point.place.id === selectedPlaceId, playing = point.place.id === playbackPlaceId;
            const oldOnly = Boolean(plan) && point.order === null && point.previousOrder !== null;
            const number = point.order ?? (oldOnly ? `旧${point.previousOrder}` : layout.points.indexOf(point) + 1);
            const lineEnd = { x: Math.max(item.label.x, Math.min(item.label.x + item.label.width, item.marker.x)),
              y: Math.max(item.label.y, Math.min(item.label.y + item.label.height, item.marker.y)) };
            return <g key={item.id} className={[
              'route-map__marker', 'coastal-map__marker', active ? 'is-selected' : '', playing ? 'is-playing' : '',
              oldOnly ? 'route-map__marker--previous' : '', point.order !== null ? 'is-route-stop' : '',
            ].filter(Boolean).join(' ')} role="button" tabIndex={0} aria-pressed={active} aria-label={`${item.lines.join('')}${number}，选择${point.place.name}${oldOnly ? '，上一版地点' : ''}`}
              data-place-id={point.place.id} onClick={() => selectPoint(point.place.id)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPoint(point.place.id); } }}>
              <path className="coastal-map__label-leader" d={`M${item.anchor.x} ${item.anchor.y} L${item.marker.x} ${item.marker.y} L${lineEnd.x} ${lineEnd.y}`} />
              <circle className="coastal-map__geo-anchor" cx={item.anchor.x} cy={item.anchor.y} r="2.5" />
              <rect className="coastal-map__name-plate" x={item.label.x} y={item.label.y} width={item.label.width} height={item.label.height} rx="5" />
              <text className="coastal-map__place-name" x={item.label.x + 9} y={item.label.y + 21} data-map-label={item.id}>
                {item.lines.map((line, index) => <tspan key={line} x={item.label.x + 9} dy={index ? 19 : 0}>{line}</tspan>)}
              </text>
              <circle className="coastal-map__hit" cx={item.marker.x} cy={item.marker.y} r="22" />
              {(active || playing) && <circle className="coastal-map__selection-ring" cx={item.marker.x} cy={item.marker.y} r="21" />}
              <circle className="coastal-map__badge" cx={item.marker.x} cy={item.marker.y} r={oldOnly ? 18 : 15} />
              <text className="route-map__marker-number coastal-map__number" x={item.marker.x} y={item.marker.y + 0.5} textAnchor="middle" dominantBaseline="central">{number}</text>
            </g>;
          })}
          <g className="coastal-map__north" transform={`translate(${size.width - 47} 27)`} aria-hidden="true">
            <path d="M0 30 L0 1 M-6 11 L0 1 L6 11 M0 1 L5 22 L0 19 L-5 22 Z" />
            <text x="0" y="49" textAnchor="middle">北 N</text>
          </g>
          <g className="coastal-map__scale" transform={`translate(24 ${size.height - 40})`} aria-label={`参考点位比例尺，${scaleLabel}`}>
            <path d={`M0-4 V4 H${scaleWidth} V-4 M${scaleWidth / 2} 0 V4`} />
            <text x="0" y="23">0</text><text x={scaleWidth} y="23" textAnchor="end">{scaleLabel}</text>
          </g>
        </g>
      </svg>
    </div>
    <div className="coastal-map__navigation">
      <div className="map-controls" role="group" aria-label="二维地图缩放控制">
        <button type="button" className="map-control" aria-label="放大二维地图" onClick={() => changeZoom(1)} disabled={zoom >= 3.6}><Plus size={18} aria-hidden="true" />放大</button>
        <button type="button" className="map-control" aria-label="缩小二维地图" onClick={() => changeZoom(-1)} disabled={zoom <= 1}><Minus size={18} aria-hidden="true" />缩小</button>
        <button type="button" className="map-control" onClick={() => resetView()}><Maximize2 size={16} aria-hidden="true" />全览</button>
      </div>
      <div className="map-controls coastal-map__pan" role="group" aria-label="二维地图平移控制">
        <button type="button" className="map-control" aria-label="向西平移二维地图" onClick={() => pan(-1, 0)} disabled={!canPan.west}><ArrowLeft size={18} aria-hidden="true" /></button>
        <button type="button" className="map-control" aria-label="向北平移二维地图" onClick={() => pan(0, 1)} disabled={!canPan.north}><ArrowUp size={18} aria-hidden="true" /></button>
        <button type="button" className="map-control" aria-label="向南平移二维地图" onClick={() => pan(0, -1)} disabled={!canPan.south}><ArrowDown size={18} aria-hidden="true" /></button>
        <button type="button" className="map-control" aria-label="向东平移二维地图" onClick={() => pan(1, 0)} disabled={!canPan.east}><ArrowRight size={18} aria-hidden="true" /></button>
      </div>
    </div>
    <div className="coastal-map__view-status" role="status" aria-live="polite">
      <span>{zoom.toFixed(1)}× · {offscreenCount ? `${offscreenCount} 个地点在视野外，可平移或全览` : selectionLabel}</span>
      <span>{viewMode === 'all' ? '全部地点' : '路线与上一版'}</span>
    </div>
    <p className="coastal-map__keyboard-hint" id={hintId}>地图获得焦点后，可用方向键平移，+ / − 缩放，Home 全览。</p>
    <figcaption>
      <SceneLegend hasPlan={Boolean(plan)} hasPrevious={Boolean(previousPlan)} />
      <ScenePlaceList points={listPoints} selectedPlaceId={selectedPlaceId} onSelectPlace={selectPoint}
        playbackPlaceId={playbackPlaceId} label={viewMode === 'all' || !plan ? '选择公开参考地点' : '按方案顺序选择地点'} />
      <SceneComparison catalog={catalog} plan={plan} previousPlan={previousPlan} selectedPlaceId={selectedPlaceId} onSelectPlace={selectPoint} />
      <SceneReferenceNote rejectedCount={layout.rejectedPlaceIds.length + layout.rejectedLegIds.length}
        hasOsmSources={catalog.sources.some(source => source.title.includes('OpenStreetMap'))} />
    </figcaption>
  </figure>;
}
