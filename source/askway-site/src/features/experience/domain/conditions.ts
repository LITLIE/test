import type { Catalog, ConditionIssue, ConditionsDraft } from '../contracts.ts';

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function normalizeConditions(input: ConditionsDraft, catalog: Catalog): { conditions: ConditionsDraft; issues: ConditionIssue[] } {
  const issues: ConditionIssue[] = [];
  const unique = (values: unknown) => Array.isArray(values) ? [...new Set(values.filter((value): value is string => typeof value === 'string').map(value => value.trim()))] : [];
  const conditions: ConditionsDraft = {
    ...input,
    date: typeof input.date === 'string' ? input.date.trim() : '',
    startTime: typeof input.startTime === 'string' ? input.startTime.trim() : '',
    originPlaceId: typeof input.originPlaceId === 'string' ? input.originPlaceId.trim() : '',
    mandatoryPlaceIds: unique(input.mandatoryPlaceIds),
    excludedPlaceIds: unique(input.excludedPlaceIds),
  };
  if (!validDate(conditions.date)) issues.push({ code: 'INVALID_DATE', field: 'date', message: '请提供真实日期（YYYY-MM-DD），不把无效日期顺延到下月。' });
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(conditions.startTime)) issues.push({ code: 'INVALID_START_TIME', field: 'startTime', message: '出发时间须为 00:00 至 23:59，按珠海当地时间填写。' });
  if (!Number.isInteger(conditions.timeLimitMinutes) || conditions.timeLimitMinutes <= 0 || conditions.timeLimitMinutes > 720) issues.push({ code: 'INVALID_DURATION', field: 'timeLimitMinutes', message: '受控体验支持 1 至 720 分钟的总时长。' });
  if (!['relaxed', 'balanced', 'compact'].includes(conditions.pace)) issues.push({ code: 'INVALID_PACE', field: 'pace', message: '请选择从容、均衡或紧凑节奏。' });
  if (!['walk', 'mixed'].includes(conditions.transport)) issues.push({ code: 'INVALID_TRANSPORT', field: 'transport', message: '请选择步行或混合交通参考估算。' });
  if (!['none', 'less-walking'].includes(conditions.scenario)) issues.push({ code: 'INVALID_SCENARIO', field: 'scenario', message: '当前只支持普通规划与减少步行调整。' });
  const ids = new Set(catalog.places.map(place => place.id));
  if (!ids.has(conditions.originPlaceId)) issues.push({ code: 'INVALID_ORIGIN', field: 'originPlaceId', message: '请选择公开目录中的起点。', placeIds: [conditions.originPlaceId] });
  for (const field of ['mandatoryPlaceIds', 'excludedPlaceIds'] as const) {
    if (!Array.isArray(input[field]) || input[field].some(id => typeof id !== 'string')) issues.push({ code: 'INVALID_PLACE_SELECTION', field, message: '地点选择须使用公开目录中的明确地点。' });
    const unknown = conditions[field].filter(id => !ids.has(id));
    if (unknown.length) issues.push({ code: 'UNKNOWN_PLACE', field, placeIds: unknown, message: '部分地点不在受控公开目录里，需要先核对名称。' });
  }
  const overlap = conditions.mandatoryPlaceIds.filter(id => conditions.excludedPlaceIds.includes(id));
  if (overlap.length) issues.push({ code: 'REQUIRED_EXCLUDED_CONFLICT', field: 'mandatoryPlaceIds', placeIds: overlap, message: '同一个地点同时被设为必去和避开。', suggestion: '明确保留哪一种选择，再生成候选。' });
  if (conditions.excludedPlaceIds.includes(conditions.originPlaceId)) issues.push({ code: 'ORIGIN_EXCLUDED', field: 'originPlaceId', placeIds: [conditions.originPlaceId], message: '起点同时被设为避开点。', suggestion: '更换起点或取消对起点的避开。' });
  return { conditions, issues };
}

const aliases: Record<string, string[]> = {
  'ZS-001': ['珠海渔女', '渔女'], 'ZS-002': ['香炉湾沙滩', '香炉湾'], 'ZS-003': ['城市阳台'],
  'ZS-004': ['珠海大剧院（日月贝）', '珠海大剧院', '日月贝'], 'ZS-005': ['野狸岛'], 'ZS-006': ['海滨泳场'],
  'ZS-007': ['海滨公园'], 'ZS-008': ['白莲洞公园', '白莲洞'], 'ZS-009': ['珠海博物馆'], 'ZS-010': ['珠海规划展览馆', '规划展览馆'],
};
const wordNumbers: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12, 半: 0.5 };

/** A bounded rule parser: unsupported operations remain explicit clarifications. */
export function interpretIdea(text: string, draft: ConditionsDraft, catalog: Catalog): { draft: ConditionsDraft; recognized: string[]; clarifications: string[] } {
  const next: ConditionsDraft = { ...draft, mandatoryPlaceIds: [...draft.mandatoryPlaceIds], excludedPlaceIds: [...draft.excludedPlaceIds] };
  const recognized: string[] = [], clarifications: string[] = [];
  const input = text.trim();
  let remainingText = input;
  const consume = (fragment: string) => { remainingText = remainingText.replace(fragment, ''); };
  const take = (pattern: RegExp) => {
    if (!pattern.test(input)) return false;
    remainingText = remainingText.replace(new RegExp(pattern.source, 'g'), '');
    return true;
  };
  const number = '(\\d+(?:\\.\\d+)?|十二|十一|十|[一二两三四五六七八九半])';
  // Hour branch captures: amount, preceding 半, following 半, extra numeric
  // minutes. Minute-only branch captures amount separately. 一 个 半 小时
  // therefore matches as a complete 90-minute expression, not a 30-minute suffix.
  const durations = [...input.matchAll(new RegExp(`${number}\\s*(?:个\\s*)?(半\\s*)?小时(?:\\s*(半)|\\s*(\\d+)\\s*分钟)?|${number}\\s*分钟`, 'g'))];
  const minuteValues: number[] = [];
  for (const duration of durations) {
    consume(duration[0]);
    const before = input.slice(Math.max(0, duration.index - 10), duration.index);
    if (/停留\s*$|待\s*$|休息\s*$/.test(before)) { clarifications.push('当前文字规则只调整总时长，单点停留时间请先明确核对。'); continue; }
    if (/[-－]\s*$/.test(before) || (duration[2] && duration[3])) { clarifications.push('时长表达无效，请使用一个明确的正数总时长。'); continue; }
    if (duration[5]) minuteValues.push(Math.round(wordNumbers[duration[5]] ?? Number(duration[5])));
    else {
      const amount = wordNumbers[duration[1]] ?? Number(duration[1]);
      minuteValues.push(Math.round(amount * 60 + (duration[2] ? 30 : 0) + (duration[3] ? 30 : 0) + Number(duration[4] ?? 0)));
    }
  }
  const uniqueMinutes = [...new Set(minuteValues)];
  if (uniqueMinutes.length > 1) clarifications.push('出现多个不同总时长，请明确采用哪一个；草稿时长暂时保留。');
  else if (uniqueMinutes.length === 1) {
    next.timeLimitMinutes = uniqueMinutes[0];
    recognized.push(`总时长 ${uniqueMinutes[0]} 分钟`);
  }
  const date = /\b\d{4}-\d{2}-\d{2}\b/.exec(input);
  if (date) { next.date = date[0]; recognized.push(`出发日期 ${date[0]}`); consume(date[0]); }
  const time = /\b(\d{1,2}):(\d{2})\b/.exec(input);
  if (time && !/营业|开放时间/.test(input)) { next.startTime = `${time[1].padStart(2, '0')}:${time[2]}`; recognized.push(`出发时间 ${next.startTime}`); consume(time[0]); }
  if (take(/慢一点|慢点|从容|轻松|慢游|带老人/)) { next.pace = 'relaxed'; recognized.push('从容节奏'); }
  if (take(/紧凑|快一点|紧一点/)) { next.pace = 'compact'; recognized.push('紧凑节奏'); }
  if (take(/均衡|正常节奏/)) { next.pace = 'balanced'; recognized.push('均衡节奏'); }
  if (take(/少走路|少走一点|减少步行|少步行|照顾同行|带老人/)) { next.scenario = 'less-walking'; next.transport = 'mixed'; recognized.push('减少步行，采用混合交通参考'); }
  if (!/不要打车|不打车|不坐车/.test(input) && take(/混合交通|公交|打车|接驳|坐车/)) { next.transport = 'mixed'; recognized.push('混合交通'); }
  if (take(/全程步行|只步行|全程走路|徒步/)) { next.transport = 'walk'; recognized.push('步行交通'); }

  const wanted = new Set<string>(), avoided = new Set<string>();
  const actions = /(必去|一定要去|必须去|想去|想看|保留|避开|不要去|不去|排除)(.*?)(?=必去|一定要去|必须去|想去|想看|保留|避开|不要去|不去|排除|[，,。;；\n]|$)/g;
  for (const match of input.matchAll(actions)) {
    consume(match[0]);
    const places = catalog.places.filter(place => [place.name, ...(aliases[place.id] ?? [])].some(alias => match[2].includes(alias)));
    if (!places.length) { clarifications.push(`“${match[1]}”后面的地点未明确匹配公开目录，请在地点列表中选择。`); continue; }
    let unmatched = match[2];
    const recognizedAliases = places.flatMap(place => [place.name, ...(aliases[place.id] ?? [])]).sort((a, b) => b.length - a.length);
    for (const alias of recognizedAliases) unmatched = unmatched.replaceAll(alias, '');
    unmatched = unmatched.replace(/以及|和|与|及|请|吧|看看|参观|打卡|一次|慢一点|慢点|从容|轻松|紧凑|快一点/g, '').replace(/[\s、()（）]/g, '');
    if (unmatched) clarifications.push(`“${match[1]}”中的“${unmatched}”尚未匹配公开目录或已支持条件，请继续明确。`);
    const isAvoid = /避开|不要去|不去|排除/.test(match[1]);
    for (const place of places) { (isAvoid ? avoided : wanted).add(place.id); recognized.push(`${isAvoid ? '避开' : '必去'}${place.name}`); }
  }
  for (const id of wanted) { if (!avoided.has(id)) next.excludedPlaceIds = next.excludedPlaceIds.filter(value => value !== id); next.mandatoryPlaceIds.push(id); }
  for (const id of avoided) { if (!wanted.has(id)) next.mandatoryPlaceIds = next.mandatoryPlaceIds.filter(value => value !== id); next.excludedPlaceIds.push(id); }
  if (/酒店|住宿|人流|拥挤|拥堵|实时|预约|门票|天气|下雨|餐厅|咖啡|吃饭|餐馆|导航|无障碍|那里|那个|上一个|第二个|然后|顺便/.test(input)) clarifications.push('这段话包含尚未支持的住宿、票务、实时人流、设施保证或上下文操作；请先明确可核对的时长、地点与节奏。');
  // Remove only harmless framing around recognized fields. Anything else must
  // remain unresolved rather than silently disappearing after partial matching.
  const unhandled = remainingText.replace(/出发日期|出发时间|总时长|总时间|只有|仅有|总共|时长|时间|日期|出发|开始|改为|改成|改到|控制在|缩短到|延长到|也就是|或者|但必须|但是|但|我想|我们|我|请|帮忙|帮我|规划|安排|行程|路线|旅游|游览|希望|想要|可以吗|好吗|谢谢|再|也|先|就|吧|为|是/g, '').replace(/[\s，,。;；、!?！？：:]/g, '');
  if (unhandled && !clarifications.length) clarifications.push('仍有未识别的要求，请用已支持的条件字段明确；当前不会推断或执行剩余内容。');
  if (!recognized.length && !clarifications.length) clarifications.push('目前可识别明确总时长、必去/避开地点、出发日期与时间、节奏和减少步行；其余意图请用条件表确认。');
  const normalized = normalizeConditions(next, catalog);
  clarifications.push(...normalized.issues.map(issue => issue.message));
  return { draft: normalized.conditions, recognized: [...new Set(recognized)], clarifications: [...new Set(clarifications)] };
}
