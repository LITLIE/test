import type { Catalog, ConditionsDraft, ConfirmedPlan, FactStatus } from '../contracts';

export const paceLabels = { relaxed: '慢慢走走', balanced: '自在探索', compact: '紧凑一点' };
export const transportLabels = { walk: '以步行为主', mixed: '步行与换乘' };
export const factLabels: Record<FactStatus, string> = { verified: '已核实', reference: '公开参考', estimate: '演示估算', unknown: '待核实' };
export function placeName(catalog: Catalog, id: string) { return catalog.places.find(place => place.id === id)?.name || id; }
export function formatClock(start: string, offset: number) {
  const [hour, minute] = start.split(':').map(Number);
  const value = hour * 60 + minute + Math.round(offset);
  const day = Math.floor(value / 1440);
  return `${String(Math.floor((value % 1440) / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}${day ? day === 1 ? ' · 次日' : ` · +${day}天` : ''}`;
}
export function describeConditions(draft: ConditionsDraft) {
  return `${draft.timeLimitMinutes} 分钟 · ${paceLabels[draft.pace]} · ${draft.scenario === 'less-walking' ? '减少步行' : transportLabels[draft.transport]}`;
}
export function planSummary(plan: ConfirmedPlan, catalog: Catalog) {
  return [
    `问途 · 珠海旅程（受控资料演示 V${plan.versionNo}）`,
    `${plan.conditions.date} ${plan.conditions.startTime} · ${describeConditions(plan.conditions)}`,
    `参考起点：${placeName(catalog, plan.conditions.originPlaceId)}；入口未核实`,
    ...plan.stops.map((stop, index) => `${index + 1}. ${placeName(catalog, stop.placeId)} ${formatClock(plan.conditions.startTime, stop.arrivalMinutes)}–${formatClock(plan.conditions.startTime, stop.departureMinutes)}（停留约 ${stop.stayMinutes} 分钟）`),
    `交通 ${plan.totals.travelMinutes} + 停留 ${plan.totals.stayMinutes} + 休息与缓冲 ${plan.totals.bufferMinutes} = ${plan.totals.totalMinutes} 分钟；余量 ${plan.totals.remainingMinutes} 分钟`,
    '路线与时间为演示估算；费用、开放和入口需要另行核实。请勿用作导航。',
    `资料版本：${plan.catalogVersion}；来源：OpenStreetMap contributors（ODbL 1.0）`,
  ].join('\n');
}
