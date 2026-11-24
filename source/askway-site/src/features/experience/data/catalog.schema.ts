import type { Catalog, ConditionIssue, Fact } from '../contracts.ts';

const statuses = new Set(['verified', 'reference', 'estimate', 'unknown']);
const dateIsValid = (value: unknown) => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
const nonemptyText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/** Runtime checks reject unusable facts; they do not certify real-world accuracy. */
export function validateCatalog(catalog: Catalog): ConditionIssue[] {
  const issues: ConditionIssue[] = [];
  const report = (code: string, message: string, field: string, placeIds?: string[]) => issues.push({ code, message, field, placeIds });
  if (!catalog || typeof catalog !== 'object') return [{ code: 'INVALID_CATALOG', message: '公开资料目录不可读取。' }];
  if (!Array.isArray(catalog.places) || !Array.isArray(catalog.sources)) return [{ code: 'INVALID_CATALOG', message: '公开资料缺少地点或来源列表。' }];
  if (!nonemptyText(catalog.version) || !nonemptyText(catalog.city) || !dateIsValid(catalog.asOf)) report('INVALID_CATALOG', '目录需要版本、城市与资料日期。', 'catalog');
  try { new Intl.DateTimeFormat('en', { timeZone: catalog.timeZone }); }
  catch { report('INVALID_TIMEZONE', '目的地时区无效。', 'timeZone'); }
  if (!catalog.timeZone) report('INVALID_TIMEZONE', '缺少目的地时区。', 'timeZone');
  if (catalog.places.length === 0 || catalog.places.length > 12) report('INVALID_CATALOG_SIZE', '受控目录须包含 1 至 12 个公开候选点。', 'places');

  const sourceIds = new Set<string>();
  for (const source of catalog.sources) {
    if (!source || typeof source.id !== 'string' || !source.id.trim() || sourceIds.has(source.id)) {
      report('INVALID_SOURCE', '来源 id 缺失或重复。', 'sources'); continue;
    }
    sourceIds.add(source.id);
    if (!nonemptyText(source.title) || !nonemptyText(source.license) || !dateIsValid(source.accessedAt) || typeof source.url !== 'string') report('INVALID_SOURCE', '来源须记录名称、许可与读取日期。', `sources.${source.id}`);
    if (source.url) {
      try { if (!['http:', 'https:'].includes(new URL(source.url).protocol)) throw new Error('unsupported URL'); }
      catch { report('INVALID_SOURCE', '来源网址必须是公开 HTTP(S) 链接，自拟资料可留空。', `sources.${source.id}.url`); }
    }
  }

  const checkFact = (raw: unknown, field: string, placeId: string) => {
    if (!raw || typeof raw !== 'object') { report('INVALID_FACT', '字段事实结构缺失。', field, [placeId]); return; }
    const fact = raw as Fact<unknown>;
    if (!statuses.has(fact.status) || (fact.value === null) !== (fact.status === 'unknown') || fact.value === undefined) report('INVALID_FACT', '未知字段必须为 null；已知或估算字段必须提供明确值。', field, [placeId]);
    if (!sourceIds.has(fact.sourceId)) report('UNKNOWN_SOURCE', '字段引用了目录中不存在的来源。', field, [placeId]);
    if (fact.status === 'unknown' ? fact.checkedAt !== null : !dateIsValid(fact.checkedAt)) report('INVALID_FACT', '字段核查日期与事实状态不一致。', field, [placeId]);
  };
  const placeIds = new Set<string>();
  for (const place of catalog.places) {
    if (!place || typeof place.id !== 'string' || !place.id.trim() || placeIds.has(place.id)) { report('INVALID_PLACE', '地点 id 缺失或重复。', 'places'); continue; }
    placeIds.add(place.id);
    if (!nonemptyText(place.name) || typeof place.description !== 'string' || !['coast', 'culture', 'park'].includes(place.category)) report('INVALID_PLACE', '地点名称、访问说明或分类无效。', `places.${place.id}`, [place.id]);
    if (place.coordinateSystem !== 'WGS84' || place.pointKind !== 'reference' || place.entranceVerified !== false || place.visitMode !== 'exterior') report('UNSUPPORTED_VISIT_MODE', '本目录只接受明确标记的 WGS84 外观参考点。', `places.${place.id}`, [place.id]);
    for (const field of ['coordinates', 'stayMinutes', 'opening', 'fee', 'accessibility'] as const) checkFact(place[field], `places.${place.id}.${field}`, place.id);
    const coordinates = place.coordinates?.value;
    if (coordinates !== null && (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90)) report('INVALID_COORDINATES', '参考坐标必须为有效的 WGS84 [经度, 纬度]。', `places.${place.id}.coordinates`, [place.id]);
    for (const field of ['stayMinutes', 'fee'] as const) {
      const value = place[field]?.value;
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field === 'stayMinutes' && value === 0))) report('INVALID_FACT', '停留建议需大于零，费用须非负；未知值不可按零填充。', `places.${place.id}.${field}`, [place.id]);
    }
    for (const field of ['opening', 'accessibility'] as const) if (place[field]?.value !== null && (typeof place[field]?.value !== 'string' || !place[field]?.value?.trim())) report('INVALID_FACT', '已知说明须为非空文本。', `places.${place.id}.${field}`, [place.id]);
    if (!Array.isArray(place.sourceIds) || place.sourceIds.length === 0 || place.sourceIds.some(id => !sourceIds.has(id))) report('UNKNOWN_SOURCE', '地点公开白名单缺少有效来源。', `places.${place.id}.sourceIds`, [place.id]);
  }
  if (!placeIds.has(catalog.originPlaceId)) report('INVALID_ORIGIN', '目录默认起点必须存在。', 'originPlaceId');
  const policy = catalog.policy;
  if (!policy || ['startBufferMinutes', 'endBufferMinutes', 'walkingMetersPerMinute', 'roadFactor', 'mixedMetersPerMinute', 'transferMinutes'].some(key => typeof policy[key as keyof typeof policy] !== 'number' || !Number.isFinite(policy[key as keyof typeof policy]))) report('INVALID_POLICY', '估算规则必须提供有限数值。', 'policy');
  else if (policy.startBufferMinutes < 0 || policy.endBufferMinutes < 0 || policy.walkingMetersPerMinute <= 0 || policy.mixedMetersPerMinute <= 0 || policy.roadFactor < 1 || policy.transferMinutes < 0) report('INVALID_POLICY', '交通速度、距离系数与缓冲规则超出允许范围。', 'policy');
  return issues;
}
