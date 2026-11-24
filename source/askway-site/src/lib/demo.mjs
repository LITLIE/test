export const demoStops = [
  { id: 'park', name: '海滨公园', minutes: 35, subtitle: '在树荫与绿意间，放慢脚步', x: 22, y: 73 },
  { id: 'beach', name: '香炉湾', minutes: 45, subtitle: '沿海岸走走，留一点时间给海风', x: 52, y: 48 },
  { id: 'theatre', name: '日月贝', minutes: 50, subtitle: '在城市与海之间，看见珠海的轮廓', x: 79, y: 25 },
];
/** @param {{ minutes: number, pace: string, mustVisit: string[] }} input */
export function planDemo(input) {
  const allowed = new Set(demoStops.map(stop => stop.id));
  if (![120,180,240].includes(input.minutes) || !['standard','slow'].includes(input.pace) || !Array.isArray(input.mustVisit) || input.mustVisit.some(id => !allowed.has(id))) {
    return { ok: false, reason: '请选择完整的演示条件。', totalMinutes: 0, stops: [] };
  }
  let best = null;
  for (let mask = 1; mask < 8; mask++) {
    const stops = demoStops.filter((_, i) => (mask & (1 << i)) !== 0).map(stop => ({ ...stop, minutes: stop.minutes + (input.pace === 'slow' ? 10 : 0) }));
    if (!input.mustVisit.every(id => stops.some(stop => stop.id === id))) continue;
    const totalMinutes = stops.reduce((sum, stop) => sum + stop.minutes, 0) + 20 * (stops.length - 1) + 20;
    if (totalMinutes <= input.minutes && (!best || stops.length > best.stops.length || (stops.length === best.stops.length && totalMinutes < best.totalMinutes))) best = { ok: true, stops, totalMinutes, reason: '' };
  }
  return best || { ok: false, reason: '这组必去点与可用时间发生冲突。可以增加时间，或减少必去点，再试一次。', totalMinutes: 0, stops: [] };
}
