import type { ConfirmedPlan, PlanDelta } from '../contracts.ts';

const rounded = (value: number, decimals = 3) => Number(value.toFixed(decimals));

export function derivePlanDelta(before: ConfirmedPlan, after: ConfirmedPlan): PlanDelta {
  const oldIds = new Set(before.orderedPlaceIds), newIds = new Set(after.orderedPlaceIds);
  const addedPlaceIds = after.orderedPlaceIds.filter(id => !oldIds.has(id));
  const removedPlaceIds = before.orderedPlaceIds.filter(id => !newIds.has(id));
  const orderChanged = before.orderedPlaceIds.filter(id => newIds.has(id)).join('|') !== after.orderedPlaceIds.filter(id => oldIds.has(id)).join('|');
  const minutesChange = after.totals.totalMinutes - before.totals.totalMinutes;
  const walkingKmChange = rounded(after.totals.walkingKm - before.totals.walkingKm);
  const bufferMinutesChange = after.totals.bufferMinutes - before.totals.bufferMinutes;
  const feeChange = before.totals.hasUnknownFee || after.totals.hasUnknownFee ? null : rounded(after.totals.knownFee - before.totals.knownFee, 2);
  const summary: string[] = [];
  if (addedPlaceIds.length) summary.push(`增加 ${addedPlaceIds.length} 个停留点。`);
  if (removedPlaceIds.length) summary.push(`减少 ${removedPlaceIds.length} 个停留点，保留新条件中的必去点。`);
  if (orderChanged) summary.push('共同保留地点的先后顺序发生变化。');
  if (minutesChange) summary.push(`总估算时间${minutesChange > 0 ? '增加' : '减少'} ${Math.abs(minutesChange)} 分钟。`);
  if (walkingKmChange) summary.push(`估算步行${walkingKmChange > 0 ? '增加' : '减少'} ${Math.abs(walkingKmChange).toFixed(2)} 公里。`);
  if (bufferMinutesChange) summary.push(`缓冲时间${bufferMinutesChange > 0 ? '增加' : '减少'} ${Math.abs(bufferMinutesChange)} 分钟。`);
  if (feeChange === null) summary.push('存在未知费用，费用差额不能按零计算。');
  else if (feeChange) summary.push(`已知费用${feeChange > 0 ? '增加' : '减少'} ¥${Math.abs(feeChange).toFixed(2)}。`);
  if (!summary.length) summary.push('地点与时间安排保持一致。');
  return { addedPlaceIds, removedPlaceIds, orderChanged, minutesChange, walkingKmChange, bufferMinutesChange, feeChange, summary };
}
