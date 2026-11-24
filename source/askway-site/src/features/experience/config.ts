import type { ConditionsDraft } from './contracts';

export const experienceConfig = {
  mode: 'curated' as const,
  sceneVersion: 'coastal-realism-v3',
  scene3d: true,
  liveGateway: false,
  demoDate: '2026-11-24',
};
export const tasks = [
  { id: 'coast', name: '海岸慢游', description: '三个小时，留一点给海风。', note: '日月贝必去 · 轻松探索', minutes: 180, mandatory: ['ZS-004'], pace: 'balanced' as const, scenario: 'none' as const },
  { id: 'short', name: '短时必去', description: '两小时，三个地方都想去。', note: '体验条件冲突与取舍', minutes: 120, mandatory: ['ZS-004', 'ZS-007', 'ZS-008'], pace: 'relaxed' as const, scenario: 'none' as const },
  { id: 'care', name: '同行照顾', description: '少走一点，多停留一会儿。', note: '减少步行 · 增加休息', minutes: 180, mandatory: ['ZS-004'], pace: 'relaxed' as const, scenario: 'less-walking' as const },
] as const;
export function makeDefaultDraft(taskId = 'coast'): ConditionsDraft {
  const task = tasks.find(item => item.id === taskId) || tasks[0];
  return {
    date: experienceConfig.demoDate, startTime: '14:00', timeLimitMinutes: task.minutes,
    pace: task.pace, transport: 'mixed', mandatoryPlaceIds: [...task.mandatory],
    excludedPlaceIds: [], scenario: task.scenario, originPlaceId: 'ZS-003',
  };
}
