import { Check, Clock3, Footprints, MapPin } from 'lucide-react';
import type { Catalog, ConditionsDraft } from '../contracts';
import { paceLabels } from './format';

export default function ConstraintWeave({ draft, catalog, confirmed }: { draft: ConditionsDraft; catalog: Catalog; confirmed: boolean }) {
  return <div className={'constraint-weave ' + (confirmed ? 'is-confirmed' : '')} data-condition-review>
    <svg viewBox="0 0 320 96" aria-hidden="true" className="weave-threads"><path d="M52 20 C110 20 115 70 160 72 C205 70 211 20 268 20"/><path d="M52 20 Q160 104 268 20"/></svg>
    <div className="weave-nodes">
      <span><Clock3 size={17} aria-hidden="true"/><strong>{draft.timeLimitMinutes}</strong><small>分钟</small></span>
      <span><MapPin size={17} aria-hidden="true"/><strong>{draft.mandatoryPlaceIds.length}</strong><small>个必去点</small></span>
      <span><Footprints size={17} aria-hidden="true"/><strong>{draft.scenario === 'less-walking' ? '少走一点' : paceLabels[draft.pace]}</strong><small>{draft.scenario === 'less-walking' ? '手动情境' : '旅行节奏'}</small></span>
    </div>
    <div className="weave-result"><span className="weave-knot">{confirmed ? <Check size={14} aria-hidden="true"/> : '·'}</span><span>{confirmed ? '这组条件已确认' : '让每一条条件，都有着落'}</span></div>
    <p className="weave-origin">参考起点：{catalog.places.find(place => place.id === draft.originPlaceId)?.name} · 入口未核实</p>
  </div>;
}
