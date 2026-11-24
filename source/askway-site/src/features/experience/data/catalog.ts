import type { Catalog, Fact, Place, Source } from '../contracts.ts';

const asOf = '2026-11-24';
const editorialSource: Source = {
  id: 'ASKWAY-EDITORIAL',
  title: '问途自拟停留与交通估算规则',
  url: '',
  license: '项目自拟建议（随本网站公开；不代表实测数据）',
  accessedAt: asOf,
};

type Reference = {
  id: string;
  name: string;
  category: Place['category'];
  coordinates: [number, number];
  entity: string;
  checkedAt: string;
  stay: number;
  description: string;
};

/** Coordinates are original WGS84 [longitude, latitude], never certified entrances. */
const references: Reference[] = [
  { id: 'ZS-001', name: '珠海渔女', category: 'coast', coordinates: [113.5830398, 22.2650277], entity: 'node/776049315', checkedAt: '2026-11-24T09:29:00.099Z', stay: 25,
    description: '安排地标外观停留，把海岸观察留在行程里。参考点代表雕像位置，接近路径与当天可达范围需要另行核实。' },
  { id: 'ZS-002', name: '香炉湾沙滩', category: 'coast', coordinates: [113.5774180, 22.2683467], entity: 'way/667979735', checkedAt: '2026-11-24T09:37:32.452Z', stay: 30,
    description: '在沙滩参考区域安排一段海岸停留。此示例不包含下水活动，开放范围与当天通行条件仍待核实。' },
  { id: 'ZS-003', name: '城市阳台', category: 'coast', coordinates: [113.5758239, 22.2652687], entity: 'relation/20629688', checkedAt: '2026-11-24T09:37:32.452Z', stay: 20,
    description: '从这里开始核对路线和同行者节奏，再选择附近停留。坐标代表公开命名区域，不表示任何商铺或设施入口。' },
  { id: 'ZS-004', name: '珠海大剧院（日月贝）', category: 'culture', coordinates: [113.5842512, 22.2858906], entity: 'node/1749730534', checkedAt: '2026-11-24T09:29:00.090Z', stay: 35,
    description: '本示例安排珠海大剧院的建筑外观停留。演出、内部参观和预约条件需要另外查询，不能从外观路线推断可入场。' },
  { id: 'ZS-005', name: '野狸岛', category: 'park', coordinates: [113.5871061, 22.2833708], entity: 'way/9762499', checkedAt: '2026-11-24T09:37:32.452Z', stay: 45,
    description: '以岛区公开参考位置安排较从容的户外停留。该点代表区域，实际步道、入口与无障碍连通性未核实。' },
  { id: 'ZS-006', name: '海滨泳场', category: 'coast', coordinates: [113.5860359, 22.2571703], entity: 'way/165087224', checkedAt: '2026-11-24T09:37:32.452Z', stay: 30,
    description: '此站只安排海滨外观与休息。名称和沙滩类别来自公开地图，下水、救生服务和其他设施开放不在本次资料范围内。' },
  { id: 'ZS-007', name: '海滨公园', category: 'park', coordinates: [113.5801167, 22.2620583], entity: 'way/164185336', checkedAt: '2026-11-24T09:30:14.378Z', stay: 30,
    description: '把公园参考区域作为海岸路线中的休息停留。使用公园面积实体，不使用同名公交站作为景点入口。' },
  { id: 'ZS-008', name: '白莲洞公园', category: 'park', coordinates: [113.5573477, 22.2472724], entity: 'way/193985122', checkedAt: '2026-11-24T09:30:18.511Z', stay: 45,
    description: '为希望增加公园停留的旅程保留一个较远选项。参考点代表公园区域，规划会显式计算额外交通，步道与入口待核实。' },
  { id: 'ZS-009', name: '珠海博物馆', category: 'culture', coordinates: [113.5716702, 22.2960255], entity: 'way/1210286635', checkedAt: '2026-11-24T09:30:20.516Z', stay: 25,
    description: '这站只安排博物馆建筑外观。入馆参观、展览、预约、开放时间和费用须另行核实。' },
  { id: 'ZS-010', name: '珠海规划展览馆', category: 'culture', coordinates: [113.5722172, 22.2971222], entity: 'way/1210286634', checkedAt: '2026-11-24T09:30:57.354Z', stay: 25,
    description: '以展览馆建筑外观作为文化主题的可选停留。此资料不承诺可入馆，也不包含当日展览或票务信息。' },
];

const unknown = <T>(note: string): Fact<T> => ({
  value: null, status: 'unknown', sourceId: editorialSource.id, checkedAt: null, note,
});

export const catalog: Catalog = {
  version: 'zhuhai-public-reference-2026-11-24-v1',
  asOf,
  city: '珠海',
  timeZone: 'Asia/Shanghai',
  originPlaceId: 'ZS-003',
  // Self-authored display estimates, not a road network or live provider payload.
  policy: {
    startBufferMinutes: 10,
    endBufferMinutes: 10,
    walkingMetersPerMinute: 70,
    roadFactor: 1.3,
    mixedMetersPerMinute: 180,
    transferMinutes: 6,
  },
  sources: [editorialSource, ...references.map((reference): Source => ({
    id: `OSM-${reference.id}`,
    title: `OpenStreetMap · ${reference.name} · © OpenStreetMap contributors`,
    url: `https://www.openstreetmap.org/${reference.entity}`,
    license: 'ODbL-1.0 · https://www.openstreetmap.org/copyright',
    accessedAt: reference.checkedAt,
  }))],
  places: references.map((reference): Place => ({
    id: reference.id,
    name: reference.name,
    category: reference.category,
    description: reference.description,
    coordinates: {
      value: reference.coordinates,
      status: 'reference',
      sourceId: `OSM-${reference.id}`,
      checkedAt: reference.checkedAt,
      note: '原始 WGS84 经度、纬度；公开对象代表位置。未作 GCJ02 转换，未实地核实入口或道路可达性。',
    },
    coordinateSystem: 'WGS84',
    pointKind: 'reference',
    entranceVerified: false,
    visitMode: 'exterior',
    stayMinutes: {
      value: reference.stay, status: 'estimate', sourceId: editorialSource.id, checkedAt: asOf,
      note: '自拟外观停留建议；节奏调整会改变停留量，不代表实测游览时间。',
    },
    opening: unknown<string>('未取得与当天外观访问范围相匹配的可靠开放资料；不能按全天开放处理。'),
    fee: unknown<number>('未取得可靠费用资料；不表示免费。交通、入馆、演出与其他消费也未报价。'),
    accessibility: unknown<string>('入口、步道与无障碍连通性未核实；少走路方案不是无障碍承诺。'),
    sourceIds: [`OSM-${reference.id}`, editorialSource.id],
  })),
};
