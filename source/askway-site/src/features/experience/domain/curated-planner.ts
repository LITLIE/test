import type { Catalog, ConditionIssue, ConditionsDraft, ConfirmedPlan, Fact, Place, PlanLeg, ProposalResult } from '../contracts.ts';
import { validateCatalog } from '../data/catalog.schema.ts';
import { normalizeConditions } from './conditions.ts';
import { derivePlanDelta } from './plan-delta.ts';

type Context = { requestId: string; sessionEpoch: number; draftRevision: number; nowMs: number };
type PathCost = { travel: number; walking: number; path: number[] };
type Candidate = { path: number[]; count: number; themes: number; total: number; travel: number; walking: number };
const rounded = (number: number, decimals = 3) => Number(number.toFixed(decimals));
const radians = Math.PI / 180;

function straightMeters(from: [number, number], to: [number, number]): number {
  const deltaLat = (to[1] - from[1]) * radians, deltaLng = (to[0] - from[0]) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(from[1] * radians) * Math.cos(to[1] * radians) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6371008.8 * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(Math.max(0, 1 - a)));
}

function estimateLeg(catalog: Catalog, draft: ConditionsDraft, from: Place, to: Place): PlanLeg {
  // Both positions were checked before this function is called. No null-to-zero path.
  const fromCoordinates = from.coordinates.value!, toCoordinates = to.coordinates.value!;
  const distanceMeters = straightMeters(fromCoordinates, toCoordinates) * catalog.policy.roadFactor;
  const shortWalkThreshold = draft.scenario === 'less-walking' ? 400 : 800;
  const transport = draft.transport === 'walk' || distanceMeters <= shortWalkThreshold ? 'walk' : 'mixed';
  const paceSpeed = draft.pace === 'relaxed' ? 0.8 : draft.pace === 'compact' ? 1.05 : 1;
  const duration = transport === 'walk'
    ? Math.ceil(distanceMeters / (catalog.policy.walkingMetersPerMinute * paceSpeed))
    : Math.ceil(distanceMeters / catalog.policy.mixedMetersPerMinute) + catalog.policy.transferMinutes;
  const sourceId = catalog.sources.find(source => source.id === 'ASKWAY-EDITORIAL')?.id ?? catalog.sources[0].id;
  const estimate = (value: number, note: string): Fact<number> => ({ value, status: 'estimate', sourceId, checkedAt: catalog.asOf, note });
  return {
    id: `${from.id}-${to.id}-${transport}`,
    fromPlaceId: from.id, toPlaceId: to.id, transport,
    distanceKm: estimate(rounded(distanceMeters / 1000), 'WGS84 直线距离乘自拟距离系数；不说明道路连通、入口或导航距离。'),
    durationMinutes: estimate(duration, transport === 'walk' ? '按自拟距离与步行速度向上取整，非实测或实时交通。' : '按自拟混合交通速度与换乘缓冲估算；交通服务、班次和费用未核实。'),
    walkingKm: transport === 'walk' ? rounded(distanceMeters / 1000) : rounded(Math.min(distanceMeters / 1000, draft.scenario === 'less-walking' ? 0.18 : 0.35)),
    geometry: { kind: 'schematic', coordinates: [[...fromCoordinates], [...toCoordinates]] },
  };
}

const betterPath = (next: PathCost, old: PathCost | undefined) => !old || next.travel < old.travel ||
  (next.travel === old.travel && (next.walking < old.walking - 0.000001 || (Math.abs(next.walking - old.walking) < 0.000001 && next.path.join(',') < old.path.join(','))));

/** Finite deterministic reference planning, with independent hard-condition checks. */
export function proposeCuratedPlan(catalog: Catalog, input: ConditionsDraft, basePlan: ConfirmedPlan | null, context: Context): ProposalResult {
  const catalogIssues = validateCatalog(catalog);
  if (catalogIssues.length) return { kind: 'clarification', issues: catalogIssues };
  const { conditions: draft, issues } = normalizeConditions(input, catalog);
  if (issues.length) return { kind: issues.some(issue => !['REQUIRED_EXCLUDED_CONFLICT', 'ORIGIN_EXCLUDED'].includes(issue.code)) ? 'clarification' : 'conflict', issues };
  if (!context.requestId?.trim() || !Number.isSafeInteger(context.sessionEpoch) || context.sessionEpoch < 1 || !Number.isSafeInteger(context.draftRevision) || context.draftRevision < 1 || !Number.isFinite(context.nowMs)) return { kind: 'clarification', issues: [{ code: 'INVALID_REQUEST_CONTEXT', message: '当前请求缺少有效会话、草稿版本或时间，请重置后重试。' }] };

  const requiredIds = new Set([draft.originPlaceId, ...draft.mandatoryPlaceIds]);
  const missing: ConditionIssue[] = [];
  for (const place of catalog.places.filter(place => requiredIds.has(place.id))) {
    if (place.coordinates.value === null) missing.push({ code: 'MISSING_COORDINATES', field: 'coordinates', placeIds: [place.id], message: `${place.name}缺少可用参考坐标。`, suggestion: '补充合法公开坐标或修改必去条件。' });
    if (place.stayMinutes.value === null) missing.push({ code: 'MISSING_STAY', field: 'stayMinutes', placeIds: [place.id], message: `${place.name}缺少停留建议，不能按零分钟计算。`, suggestion: '先明确停留建议或修改必去条件。' });
  }
  if (missing.length) return { kind: 'clarification', issues: missing };
  const eligible = catalog.places.filter(place => !draft.excludedPlaceIds.includes(place.id) && place.coordinates.value !== null && place.stayMinutes.value !== null);
  const origin = eligible.find(place => place.id === draft.originPlaceId)!;
  const places = [origin, ...eligible.filter(place => place !== origin).sort((left, right) => left.id.localeCompare(right.id, 'en'))];
  const n = places.length, full = 1 << n;
  const requiredMask = places.reduce((mask, place, index) => requiredIds.has(place.id) ? mask | (1 << index) : mask, 0);
  const stays = places.map(place => Math.ceil(place.stayMinutes.value! * (draft.pace === 'relaxed' ? 1.25 : draft.pace === 'compact' ? 0.8 : 1)));
  const startBuffer = catalog.policy.startBufferMinutes + (draft.pace === 'relaxed' ? 5 : 0) + (draft.scenario === 'less-walking' ? 5 : 0);
  const endBuffer = catalog.policy.endBufferMinutes + (draft.pace === 'relaxed' ? 5 : 0);
  const buffer = startBuffer + endBuffer;
  const legs = places.map(from => places.map(to => from === to ? null : estimateLeg(catalog, draft, from, to)));

  // Held-Karp over <= 12 points. Every subset uses its shortest reference-time
  // open path from the chosen origin. Hard time checks precede soft ranking.
  const table: (PathCost | undefined)[][] = Array.from({ length: full }, () => Array<PathCost | undefined>(n));
  table[1][0] = { travel: 0, walking: 0, path: [0] };
  for (let mask = 1; mask < full; mask += 2) {
    for (let end = 0; end < n; end++) {
      const old = table[mask][end];
      if (!old) continue;
      for (let next = 1; next < n; next++) {
        if (mask & (1 << next)) continue;
        const leg = legs[end][next]!;
        const candidate = { travel: old.travel + leg.durationMinutes.value!, walking: old.walking + leg.walkingKm, path: [...old.path, next] };
        const nextMask = mask | (1 << next);
        if (betterPath(candidate, table[nextMask][next])) table[nextMask][next] = candidate;
      }
    }
  }
  const minimumRequiredPath = table[requiredMask].filter((path): path is PathCost => path !== undefined).sort((a, b) => a.travel - b.travel || a.walking - b.walking)[0];
  const mandatoryStay = stays.reduce((total, stay, index) => requiredMask & (1 << index) ? total + stay : total, 0);
  const minimumMinutes = minimumRequiredPath.travel + mandatoryStay + buffer;
  if (minimumMinutes > draft.timeLimitMinutes) return { kind: 'conflict', issues: [{
    code: 'TIME_LIMIT', field: 'timeLimitMinutes', placeIds: places.filter(place => requiredIds.has(place.id)).map(place => place.id),
    message: `仅起点与必去点就估算需要至少 ${minimumMinutes} 分钟，超过 ${draft.timeLimitMinutes} 分钟上限 ${minimumMinutes - draft.timeLimitMinutes} 分钟。`,
    suggestion: '减少一个必去点、延长时长，或核对是否采用混合交通；不会自动删除必去点。',
  }] };

  const ordinaryCap = draft.pace === 'compact' ? 5 : draft.pace === 'relaxed' ? 3 : 4;
  const cap = Math.max(requiredIds.size, draft.scenario === 'less-walking' ? Math.min(3, ordinaryCap) : ordinaryCap);
  const reserve = Math.max(10, Math.min(40, Math.round(draft.timeLimitMinutes * 0.18)));
  const candidates: Candidate[] = [];
  for (let mask = 1; mask < full; mask += 2) {
    if ((mask & requiredMask) !== requiredMask) continue;
    const selected = places.map((_, index) => index).filter(index => mask & (1 << index));
    if (selected.length > cap) continue;
    const stay = selected.reduce((total, index) => total + stays[index], 0);
    const best = table[mask].filter((path): path is PathCost => path !== undefined).sort((a, b) => a.travel - b.travel || a.walking - b.walking || a.path.join(',').localeCompare(b.path.join(','), 'en'))[0];
    const total = best.travel + stay + buffer;
    if (total > draft.timeLimitMinutes || (mask !== requiredMask && draft.timeLimitMinutes - total < reserve)) continue;
    candidates.push({ path: best.path, count: selected.length, themes: new Set(selected.map(index => places[index].category)).size, total, travel: best.travel, walking: best.walking });
  }
  candidates.sort((a, b) => draft.scenario === 'less-walking'
    ? b.count - a.count || a.walking - b.walking || a.travel - b.travel || b.themes - a.themes || a.path.join(',').localeCompare(b.path.join(','), 'en')
    : b.themes - a.themes || b.count - a.count || a.travel - b.travel || a.walking - b.walking || a.path.join(',').localeCompare(b.path.join(','), 'en'));
  const chosen = candidates[0];
  const ordered = chosen.path.map(index => places[index]);
  const planLegs = chosen.path.slice(1).map((index, step) => legs[chosen.path[step]][index]!);
  let cursor = startBuffer;
  const stops = chosen.path.map((index, step) => {
    if (step > 0) cursor += planLegs[step - 1].durationMinutes.value!;
    const arrivalMinutes = cursor;
    cursor += stays[index];
    return { placeId: places[index].id, arrivalMinutes, departureMinutes: cursor, stayMinutes: stays[index] };
  });
  const knownFee = rounded(ordered.reduce((total, place) => place.fee.value === null ? total : total + place.fee.value, 0), 2);
  const hasUnknownFee = ordered.some(place => place.fee.value === null || place.fee.status === 'unknown');
  const hasKnownFee = ordered.some(place => place.fee.value !== null && place.fee.status !== 'unknown');
  const totalMinutes = cursor + endBuffer;
  const mandatoryNames = ordered.filter(place => draft.mandatoryPlaceIds.includes(place.id)).map(place => place.name);
  const explanations = [
    mandatoryNames.length ? `保留全部必去点：${mandatoryNames.join('、')}。` : '没有额外必去点，按已选起点安排有限的可选停留。',
    `交通 ${chosen.travel} 分钟、停留 ${stops.reduce((total, stop) => total + stop.stayMinutes, 0)} 分钟、缓冲 ${buffer} 分钟分别计算。`,
    `按${draft.pace === 'relaxed' ? '从容' : draft.pace === 'compact' ? '紧凑' : '均衡'}节奏限制可选停留；可选点需保留至少 ${reserve} 分钟余量，时间宽松也不会持续加点。`,
    '路段是参考点之间的示意线，距离与交通时间均为自拟估算，未核实道路连通或入口。',
  ];
  if (draft.scenario === 'less-walking') explanations.push(draft.transport === 'mixed'
    ? '减少步行采用更短的步行接驳与有限可选停留；代价是可能增加换乘等待，交通服务和费用仍待核实。'
    : '减少步行优先选择较近的有限可选点；全程步行保留不变，因此必去点之间的距离无法消除。');
  else if (planLegs.some(leg => leg.transport === 'mixed')) explanations.push('较长路段采用混合交通参考；包含自拟换乘缓冲，不代表公交班次或已报价交通。');
  if (hasUnknownFee) explanations.push('已知费用仅是可确认字段的合计，存在未知费用，不能据此认定免费或预算已满足。');
  if (ordered.some(place => place.opening.value === null)) explanations.push('开放信息尚未核实；生成候选不表示当天所有停留均可访问。');
  const startMinutes = Number(draft.startTime.slice(0, 2)) * 60 + Number(draft.startTime.slice(3));
  if (startMinutes + totalMinutes >= 1440) explanations.push('行程跨到次日，时间轴以珠海当地日期与分钟偏移计算。');
  const skippedUnknown = catalog.places.filter(place => !draft.excludedPlaceIds.includes(place.id) && (place.coordinates.value === null || place.stayMinutes.value === null));
  if (skippedUnknown.length) explanations.push(`${skippedUnknown.length} 个资料不足的可选点未参与计算，不把缺失时间填为零。`);
  const candidate: ConfirmedPlan = {
    id: `plan-${context.sessionEpoch}-${context.requestId}`,
    versionNo: (basePlan?.versionNo ?? 0) + 1,
    catalogVersion: catalog.version,
    conditions: { ...draft, mandatoryPlaceIds: [...draft.mandatoryPlaceIds], excludedPlaceIds: [...draft.excludedPlaceIds] },
    orderedPlaceIds: ordered.map(place => place.id), legs: planLegs, stops,
    totals: {
      travelMinutes: chosen.travel, stayMinutes: stops.reduce((total, stop) => total + stop.stayMinutes, 0), bufferMinutes: buffer,
      totalMinutes, remainingMinutes: draft.timeLimitMinutes - totalMinutes, knownFee, hasUnknownFee,
      distanceKm: rounded(planLegs.reduce((total, leg) => total + leg.distanceKm.value!, 0)),
      walkingKm: rounded(planLegs.reduce((total, leg) => total + leg.walkingKm, 0)),
    },
    checks: [
      { key: 'time', label: '时间上限', status: 'estimate', detail: `参考估算 ${totalMinutes} ≤ ${draft.timeLimitMinutes} 分钟；实际到达仍需核实。` },
      { key: 'mandatory', label: '必去地点', status: 'satisfied', detail: `全部 ${draft.mandatoryPlaceIds.length} 个必去点已保留。` },
      { key: 'excluded', label: '避开地点', status: 'satisfied', detail: `全部 ${draft.excludedPlaceIds.length} 个避开点未进入方案。` },
      { key: 'opening', label: '开放信息', status: 'unknown', detail: '未校验目的地当地日期下的开放与访问范围；请在出发前核实。' },
      { key: 'fees', label: '费用信息', status: hasUnknownFee ? 'unknown' : ordered.some(place => place.fee.status !== 'verified') ? 'estimate' : 'satisfied', detail: !hasKnownFee ? '地点与交通费用尚未核实，当前无法给出总费用或预算结论。' : hasUnknownFee ? `已知地点费用 ¥${knownFee.toFixed(2)}，另有未知费用；交通和消费未报价。` : `已知地点费用合计 ¥${knownFee.toFixed(2)}；不包含未报价交通与消费。` },
      { key: 'entrance', label: '入口与无障碍', status: 'unknown', detail: '全部为公开参考位置，入口、步道与无障碍连通未实地核实。' },
    ],
    explanations,
    createdAtMs: context.nowMs,
  };
  return { kind: 'proposal', proposal: {
    id: `proposal-${context.sessionEpoch}-${context.requestId}`, baseVersionNo: basePlan?.versionNo ?? 0,
    draftRevision: context.draftRevision, sessionEpoch: context.sessionEpoch, requestId: context.requestId,
    expiresAtMs: context.nowMs + 120000, candidate, delta: basePlan ? derivePlanDelta(basePlan, candidate) : null,
  } };
}
