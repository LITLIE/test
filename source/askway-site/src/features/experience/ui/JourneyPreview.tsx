import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SceneProps } from '../contracts';
import { buildSceneLayout, createSvgProjection, fitMapBounds, layoutMapLabels } from '../map/projection';
import { orderedScenePoints } from '../scene/SceneText';
import './JourneyPreview.css';

export default function JourneyPreview({ catalog, plan }: Pick<SceneProps, 'catalog' | 'plan'>) {
  const titleId = useId(), descriptionId = useId();
  const artId = useId().replaceAll(':', '');
  const mapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 240 });
  const layout = useMemo(() => buildSceneLayout(catalog, plan), [catalog, plan]);
  const points = useMemo(() => plan ? orderedScenePoints(layout, true) : [], [layout, plan]);
  const bounds = useMemo(() => fitMapBounds([
    ...points.map(point => point.local), ...layout.currentLegs.flatMap(leg => leg.points),
  ], layout.bounds), [points, layout]);
  const project = createSvgProjection(bounds, size.width, size.height, Math.min(38, size.width * .15));
  const labels = layoutMapLabels(points.map(point => {
    const bracket = point.place.name.indexOf('（');
    return {
      id: point.place.id, anchor: project(point.local),
      lines: bracket > 0 ? [point.place.name.slice(0, bracket), point.place.name.slice(bracket)] : [point.place.name],
      preferredSide: point.local.x < 0 ? 'left' as const : 'right' as const,
    };
  }), size.width, size.height);
  const byId = new Map(points.map(point => [point.place.id, point]));
  const names = plan?.orderedPlaceIds.map(id => catalog.places.find(place => place.id === id)?.name ?? id) ?? [];
  const routeDescription = plan
    ? `${catalog.city}的只读旅程安排：${names.join('，然后前往')}。共${plan.orderedPlaceIds.length}站，预算${plan.conditions.timeLimitMinutes}分钟，规则估算用时${plan.totals.totalMinutes}分钟，余量${plan.totals.remainingMinutes}分钟。地点按实际方案编号，连接为路线示意，现场道路和入口仍需核实，不用于导航。`
    : `${catalog.city}的海岸意象。当前没有已生成的旅程安排，核对条件后可在旅程体验中生成路线。`;

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      if (width < 100) return;
      // One SVG unit is one display pixel after measurement, including phone labels.
      const height = Math.round(Math.min(250, Math.max(220, width * .48)));
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (!observer) window.addEventListener('resize', measure, { passive: true });
    return () => { observer?.disconnect(); if (!observer) window.removeEventListener('resize', measure); };
  }, []);

  const w = size.width, h = size.height;
  const coast = `M0 0H${w * .71}C${w * .7} ${h * .18},${w * .49} ${h * .28},${w * .58} ${h * .48}S${w * .34} ${h * .7},${w * .4} ${h}H0Z`;
  return <figure className="experience-miniature journey-preview" data-preview-status={plan ? 'proposal' : 'unavailable'}
    data-preview-place-ids={JSON.stringify(plan?.orderedPlaceIds ?? [])}>
    <div className="journey-preview__heading">
      <span>{catalog.city} · 旅程示意</span>
      <div><strong>{plan ? `${plan.orderedPlaceIds.length} 站，连成一段安排` : '先看清旅程条件'}</strong>
        <span>{plan ? `余量 ${plan.totals.remainingMinutes} 分钟` : '暂无已生成路线'}</span></div>
    </div>
    <div className="journey-preview__map" ref={mapRef}>
      <svg role="img" aria-labelledby={`${titleId} ${descriptionId}`} width={w} height={h} style={{ height: h }} viewBox={`0 0 ${w} ${h}`}>
        <title id={titleId}>{catalog.city} · {plan ? '实际候选路线示意' : '海岸意象'}</title>
        <desc id={descriptionId}>{routeDescription}</desc>
        <defs><linearGradient id={`${artId}-sea`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0eef0"/><stop offset="1" stopColor="#c3dce1"/>
        </linearGradient></defs>
        <g aria-hidden="true">
          <rect width={w} height={h} fill={`url(#${artId}-sea)`}/>
          <path d={coast} fill="#f4f5ec" stroke="#bacdc4" strokeWidth="1.5"/>
          <path d={`M${w * .79} ${h * .69}q20 -8 40 0m-50 13q24 -8 46 0m-36 13q18 -5 34 0`} fill="none" stroke="#82aab5" strokeWidth="1" opacity=".6"/>
        </g>
        {layout.currentLegs.map(leg => <path key={leg.id} className="journey-preview__route" data-preview-leg-id={leg.id}
          d={leg.points.map((point, index) => { const position = project(point); return `${index ? 'L' : 'M'}${position.x.toFixed(2)},${position.y.toFixed(2)}`; }).join(' ')}/>) }
        {labels.map(label => {
          const point = byId.get(label.id)!;
          return <g key={label.id} data-preview-map-place-id={label.id}>
            <path className="journey-preview__leader" d={`M${label.anchor.x} ${label.anchor.y}L${label.marker.x} ${label.marker.y}L${label.label.x + label.label.width / 2} ${label.label.y + label.label.height / 2}`}/>
            <circle cx={label.anchor.x} cy={label.anchor.y} r="3" fill="#bd8231"/>
            <rect className="journey-preview__label" x={label.label.x} y={label.label.y} width={label.label.width} height={label.label.height} rx="5"/>
            <text className="journey-preview__place-name" x={label.label.x + 9} y={label.label.y + 20}>
              {label.lines.map((line, index) => <tspan key={line} x={label.label.x + 9} dy={index ? 19 : 0}>{line}</tspan>)}
            </text>
            <circle className="journey-preview__badge" cx={label.marker.x} cy={label.marker.y} r="13"/>
            <text className="journey-preview__number" x={label.marker.x} y={label.marker.y} textAnchor="middle" dominantBaseline="central">{point.order}</text>
          </g>;
        })}
      </svg>
    </div>
    <figcaption className="journey-preview__caption">
      {plan && <ol aria-label="实际候选的地点顺序">{plan.orderedPlaceIds.map((id, index) => <li key={id} data-preview-place-id={id}>
        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{names[index]}</span>
      </li>)}</ol>}
      <p>{plan ? `${plan.conditions.timeLimitMinutes} 分钟预算 · 规则估算。路线示意，不用于导航。` : '核对条件后生成安排。海岸为辅助意象，不用于导航。'}
        {' '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">点位 ©OpenStreetMap 贡献者 · ODbL</a>
        {(layout.rejectedPlaceIds.length || layout.rejectedLegIds.length) > 0 && <span>部分定位资料未绘入图中。</span>}
      </p>
    </figcaption>
  </figure>;
}
