import { ArrowUpRight, BookOpen, Info, X } from 'lucide-react';
import type { Catalog, Fact, Place } from '../contracts';
import { factLabels } from './format';

function FactRow({ label, fact, unit = '' }: { label: string; fact: Fact<string> | Fact<number>; unit?: string }) {
  return <div className="evidence-fact"><span>{label}</span><strong>{fact.value === null ? '待核实' : fact.value + unit}</strong><small className={'fact-status status-' + fact.status}>{factLabels[fact.status]}</small>{fact.checkedAt && <small className="fact-date">资料日期 {fact.checkedAt.slice(0, 10)}</small>}{fact.note && <p>{fact.note}</p>}</div>;
}
export default function PlaceDetails({ place, catalog, onClose }: { place: Place; catalog: Catalog; onClose: () => void }) {
  const coordinates = place.coordinates.value;
  return <aside className="place-evidence" data-place-details aria-label={place.name + '资料依据'}>
    <div className="evidence-heading"><span><BookOpen size={17} aria-hidden="true"/>证据透镜</span><button type="button" aria-label="收起地点依据" onClick={onClose}><X size={18} aria-hidden="true"/></button></div>
    <div className="evidence-place-title"><div><small>{place.category === 'coast' ? '海岸与地标' : place.category === 'park' ? '城市公园' : '城市文化'}</small><h3>{place.name}</h3></div><span>参考点</span></div>
    <p className="evidence-description">{place.description}</p>
    <div className="evidence-coordinate"><span>WGS84 · 经度 / 纬度</span><strong>{coordinates ? `${coordinates[0].toFixed(5)} / ${coordinates[1].toFixed(5)}` : '坐标待核实'}</strong><small>{factLabels[place.coordinates.status]} · {place.coordinates.checkedAt || '无核查日期'}</small></div>
    <p className="evidence-warning"><Info size={16} aria-hidden="true"/>入口未核实。该点用于空间参考；外观与公共区域的演示不能代表入馆、开放或无障碍可达。</p>
    <div className="evidence-facts"><FactRow label="建议停留" fact={place.stayMinutes} unit=" 分钟"/><FactRow label="开放信息" fact={place.opening}/><FactRow label="费用信息" fact={place.fee} unit=" 元"/><FactRow label="无障碍信息" fact={place.accessibility}/></div>
    <div className="evidence-sources"><h4>资料来源与许可</h4>{catalog.sources.filter(source => place.sourceIds.includes(source.id) || source.id === place.coordinates.sourceId).map(source => <a key={source.id} href={source.url || '#estimate-method'} target={source.url ? '_blank' : undefined} rel={source.url ? 'noreferrer' : undefined}><span>{source.title}<small>{source.license} · 资料日期 {source.accessedAt.slice(0, 10)}</small></span><ArrowUpRight size={15} aria-hidden="true"/></a>)}</div>
  </aside>;
}
