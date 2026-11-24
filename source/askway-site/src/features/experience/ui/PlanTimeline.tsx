import { ArrowRight, Check, Clock3, Footprints, Info, MapPin } from 'lucide-react';
import type { Catalog, ConfirmedPlan } from '../contracts';
import { formatClock, placeName } from './format';

export default function PlanTimeline({ plan, catalog, selectedPlaceId, onSelectPlace }: {
  plan: ConfirmedPlan; catalog: Catalog; selectedPlaceId: string | null; onSelectPlace: (id: string) => void;
}) {
  return <div className="plan-timeline" data-timeline>
    <div className="plan-total"><span>行程约 <strong>{plan.totals.totalMinutes}</strong> 分钟</span><span><Clock3 size={15} aria-hidden="true"/>{plan.totals.remainingMinutes} 分钟余量</span></div>
    <div className="plan-origin"><MapPin size={14} aria-hidden="true"/><span>{plan.conditions.startTime} · 从 {placeName(catalog, plan.conditions.originPlaceId)} 参考点出发</span></div>
    <ol className="exp-timeline-list">
      {plan.stops.map((stop, index) => {
        const place = catalog.places.find(item => item.id === stop.placeId)!;
        const leg = plan.legs.find(item => item.toPlaceId === stop.placeId);
        return <li key={stop.placeId} data-experience-enter>
          {leg && <div className="exp-travel-leg"><span className="travel-dots" aria-hidden="true"/><span>{leg.transport === 'walk' ? '步行' : '步行与换乘'}约 {leg.durationMinutes.value} 分钟 · {leg.distanceKm.value?.toFixed(1)} km</span><span className="estimate-tag">估算</span></div>}
          <button type="button" data-route-stop={stop.placeId} className={selectedPlaceId === stop.placeId ? 'is-selected' : ''} aria-pressed={selectedPlaceId === stop.placeId} onClick={() => onSelectPlace(stop.placeId)}>
            <span className="exp-stop-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="exp-stop-copy"><strong>{place.name}{plan.conditions.mandatoryPlaceIds.includes(stop.placeId) && <small>必去</small>}</strong><span>{formatClock(plan.conditions.startTime, stop.arrivalMinutes)}–{formatClock(plan.conditions.startTime, stop.departureMinutes)}</span><span>外观 / 公共区域 · 停留约 {stop.stayMinutes} 分钟</span></span>
            <ArrowRight size={15} aria-hidden="true"/>
          </button>
        </li>;
      })}
    </ol>
    <div className="time-equation"><span>交通 {plan.totals.travelMinutes}</span><b>+</b><span>停留 {plan.totals.stayMinutes}</span><b>+</b><span>休息 / 缓冲 {plan.totals.bufferMinutes}</span><b>=</b><strong>{plan.totals.totalMinutes} min</strong></div>
    <div className="exp-plan-facts"><span><Footprints size={15} aria-hidden="true"/>参考步行 {plan.totals.walkingKm.toFixed(1)} km</span><span data-fee-status>费用{plan.totals.hasUnknownFee ? '待核实' : `已知部分 ¥${plan.totals.knownFee}`}</span></div>
    <div className="exp-checks">{plan.checks.map(check => <div key={check.key} className={'check-' + check.status}>{check.status === 'satisfied' ? <Check size={14} aria-hidden="true"/> : <Info size={14} aria-hidden="true"/>}<span><strong>{check.label}</strong><small>{check.detail}</small></span></div>)}</div>
  </div>;
}
