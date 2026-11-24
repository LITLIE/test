import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnershipBrief } from '../src/lib/brief.mjs';
import { stepFromProgress } from '../src/lib/journey.mjs';
import { planDemo } from '../src/lib/demo.mjs';

test('a cooperation brief retains the submitted organization, contact and request', () => {
  const result = createPartnershipBrief({ organization: '  海湾旅宿  ', contact: '李女士 / hello@example.com', focus: 'hospitality', details: '希望共同核实从酒店出发的一日路线。' });
  assert.equal(result.ok, true);
  assert.match(result.text, /海湾旅宿/);
  assert.match(result.text, /李女士 \/ hello@example.com/);
  assert.match(result.text, /目的地服务衔接/);
  assert.match(result.text, /希望共同核实从酒店出发的一日路线。/);
  assert.doesNotMatch(result.text, /已提交|已发送|预约成功/);
});
test('missing details produce field errors rather than an apparently complete proposal', () => {
  const result = createPartnershipBrief({ organization: '', contact: '', focus: 'content', details: '  ' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.organization);
  assert.ok(result.errors.details);
});
test('unrecognized cooperation direction is rejected', () => {
  const result = createPartnershipBrief({ organization: '城市内容组', contact: '', focus: 'unknown', details: '想讨论内容共建' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.focus);
});
test('oversized text is rejected rather than silently cutting a user proposal', () => {
  const result = createPartnershipBrief({ organization: '城市内容组', contact: '', focus: 'content', details: '旅'.repeat(801) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.details);
});
test('optional contact can be absent while a useful local draft is produced', () => {
  const result = createPartnershipBrief({ organization: '城市内容组', contact: '', focus: 'content', details: '想共同核实城市讲解内容。' });
  assert.equal(result.ok, true);
  assert.match(result.text, /城市内容共建/);
  assert.match(result.text, /想共同核实城市讲解内容。/);
});
test('the journey progresses through all four stages and clamps scrollbar overshoot', () => {
  for (const [progress, expected] of [[-0.1,0],[0,0],[0.249,0],[0.25,1],[0.5,2],[0.75,3],[1,3],[1.1,3],[NaN,0]]) {
    assert.equal(stepFromProgress(progress), expected, `progress ${progress}`);
  }
});
test('a time-bounded demo plan preserves the mandatory landmark', () => {
  const result = planDemo({ minutes: 120, pace: 'standard', mustVisit: ['theatre'] });
  assert.equal(result.ok, true);
  assert.ok(result.totalMinutes <= 120);
  assert.ok(result.stops.some(stop => stop.id === 'theatre'));
});
test('an impossible combination explains the conflict instead of violating the time limit', () => {
  const result = planDemo({ minutes: 120, pace: 'slow', mustVisit: ['park','beach','theatre'] });
  assert.equal(result.ok, false);
  assert.ok(result.reason.length > 10);
});
test('a longer demo plan can include all requested stops with time left', () => {
  const result = planDemo({ minutes: 240, pace: 'slow', mustVisit: ['park','beach','theatre'] });
  assert.equal(result.ok, true);
  assert.equal(result.stops.length, 3);
  assert.ok(result.totalMinutes <= 240);
});
