import { ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import type { Catalog, ConfirmedPlan, PlanDelta } from '../contracts';
import { describeConditions, placeName } from './format';

export default function PlanComparison({ before, after, delta, catalog, visible, onView }: {
  before: ConfirmedPlan; after: ConfirmedPlan; delta: PlanDelta; catalog: Catalog;
  visible: 'active' | 'candidate'; onView: (view: 'active' | 'candidate') => void;
}) {
  return <section className="exp-comparison" data-comparison aria-label="方案变化比较">
    <div className="comparison-heading"><span>一项变化，一次清楚的取舍。</span><small>A / B</small></div>
    <div className="comparison-choices">
      <button type="button" aria-pressed={visible === 'active'} onClick={() => onView('active')}><span>当前 A · V{before.versionNo}</span><strong>{before.totals.totalMinutes} <small>min</small></strong><small>{describeConditions(before.conditions)}</small></button>
      <button type="button" aria-pressed={visible === 'candidate'} onClick={() => onView('candidate')}><span>候选 B · 待采用</span><strong>{after.totals.totalMinutes} <small>min</small></strong><small>{describeConditions(after.conditions)}</small></button>
    </div>
    <ul className="comparison-delta">
      {delta.removedPlaceIds.map(id => <li key={'remove-' + id}><Minus size={15} aria-hidden="true"/>减少 {placeName(catalog, id)}</li>)}
      {delta.addedPlaceIds.map(id => <li key={'add-' + id}><Plus size={15} aria-hidden="true"/>增加 {placeName(catalog, id)}</li>)}
      <li>{delta.minutesChange <= 0 ? <ArrowDownRight size={15} aria-hidden="true"/> : <ArrowUpRight size={15} aria-hidden="true"/>}总时长{delta.minutesChange < 0 ? '减少' : '增加'} {Math.abs(delta.minutesChange)} 分钟</li>
      <li><span className="delta-dot" aria-hidden="true"/>步行{delta.walkingKmChange <= 0 ? '减少' : '增加'} {Math.abs(delta.walkingKmChange).toFixed(1)} km</li>
      {delta.orderChanged && <li><span className="delta-dot" aria-hidden="true"/>到访顺序有调整</li>}
      <li><span className="delta-dot" aria-hidden="true"/>{delta.feeChange === null ? '费用仍有未知项，不能保证预算' : `已知费用变化 ¥${delta.feeChange}`}</li>
    </ul>
    <p>采用前，当前 A 会独立保留。点击上方方案可对照地图与时间轴。</p>
  </section>;
}
