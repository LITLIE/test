import assert from 'node:assert/strict';
import { test } from 'node:test';

// Missing modules become an assertion failure during the initial red run.
const load = async (path) => {
  try { return await import(path); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; }
};
const [data, schema, conditions, planner, delta] = await Promise.all([
  load('../../src/features/experience/data/catalog.ts'),
  load('../../src/features/experience/data/catalog.schema.ts'),
  load('../../src/features/experience/domain/conditions.ts'),
  load('../../src/features/experience/domain/curated-planner.ts'),
  load('../../src/features/experience/domain/plan-delta.ts'),
]);
const required = (fn, name) => {
  assert.equal(typeof fn, 'function', `${name} has not been implemented`);
  return fn;
};
const fact = (value, status = 'estimate') => ({
  value, status, sourceId: 'TEST-ONLY', checkedAt: value === null ? null : '2026-01-01T00:00:00Z',
  note: 'Synthetic arithmetic fixture; never publish as visitor information.',
});
const fixture = () => ({
  version: 'test-only', asOf: '2026-01-01', city: 'Test', timeZone: 'Asia/Shanghai', originPlaceId: 'A',
  sources: [{ id: 'TEST-ONLY', title: 'Synthetic fixture', url: '', license: 'test-only', accessedAt: '2026-01-01T00:00:00Z' }],
  policy: { startBufferMinutes: 5, endBufferMinutes: 5, walkingMetersPerMinute: 7, roadFactor: 1, mixedMetersPerMinute: 70, transferMinutes: 5 },
  places: [
    { id: 'A', name: '测试点 A', category: 'coast', coordinates: [113.570, 22.270], minutes: 20, fee: 10 },
    { id: 'B', name: '测试点 B', category: 'culture', coordinates: [113.571, 22.270], minutes: 30, fee: 20 },
  ].map(p => ({
    id: p.id, name: p.name, category: p.category, description: 'Synthetic fixture',
    coordinates: fact(p.coordinates, 'reference'), coordinateSystem: 'WGS84', pointKind: 'reference',
    entranceVerified: false, visitMode: 'exterior', stayMinutes: fact(p.minutes),
    opening: fact(null, 'unknown'), fee: fact(p.fee, 'verified'), accessibility: fact(null, 'unknown'),
    sourceIds: ['TEST-ONLY'],
  })),
});
const draft = (overrides = {}) => ({
  date: '2026-11-24', startTime: '09:00', timeLimitMinutes: 120, pace: 'balanced', transport: 'walk',
  mandatoryPlaceIds: ['A', 'B'], excludedPlaceIds: [], scenario: 'none', originPlaceId: 'A', ...overrides,
});
const context = (overrides = {}) => ({ requestId: 'R1', sessionEpoch: 1, draftRevision: 1, nowMs: 1000, ...overrides });
const propose = (...args) => required(planner.proposeCuratedPlan, 'proposeCuratedPlan')(...args);
const realDraft = (overrides = {}) => draft({ originPlaceId: 'ZS-003', mandatoryPlaceIds: ['ZS-004'], transport: 'mixed', timeLimitMinutes: 180, ...overrides });

test('public catalog keeps ten attributed reference points and unknown operational facts', () => {
  assert.ok(data.catalog, 'public catalog has not been implemented');
  assert.equal(data.catalog.places.length, 10);
  assert.deepEqual(required(schema.validateCatalog, 'validateCatalog')(data.catalog), []);
  for (const place of data.catalog.places) {
    assert.equal(place.coordinateSystem, 'WGS84');
    assert.equal(place.entranceVerified, false);
    assert.equal(place.coordinates.status, 'reference');
    assert.equal(place.fee.value, null);
    assert.equal(place.opening.value, null);
    assert.equal(place.fee.status, 'unknown');
    assert.ok(place.coordinates.value[0] > 113 && place.coordinates.value[1] < 23, '[longitude, latitude] order');
    assert.ok(data.catalog.sources.find(s => s.id === place.coordinates.sourceId)?.license.includes('ODbL'));
  }
});

test('catalog validation rejects non-finite coordinates and unsupported provenance', () => {
  const bad = fixture();
  bad.places[0].coordinates.value = [Infinity, 22.27];
  bad.places[1].fee.sourceId = 'MISSING';
  const issues = required(schema.validateCatalog, 'validateCatalog')(bad);
  assert.ok(issues.some(i => i.code === 'INVALID_COORDINATES'));
  assert.ok(issues.some(i => i.code === 'UNKNOWN_SOURCE'));
});

test('catalog validation rejects a null estimate instead of silently treating it as zero', () => {
  const bad = fixture();
  bad.places[0].stayMinutes = fact(null, 'estimate');
  assert.ok(required(schema.validateCatalog, 'validateCatalog')(bad).some(i => i.code === 'INVALID_FACT'));
});

test('malformed text metadata is reported as a catalog issue without a validator crash', () => {
  const bad = fixture();
  bad.version = 42;
  bad.sources[0].title = 42;
  bad.places[0].name = 42;
  const validate = required(schema.validateCatalog, 'validateCatalog');
  assert.doesNotThrow(() => validate(bad));
  assert.ok(validate(bad).length > 0);
});

test('conditions validate real calendar dates and allow leap days', () => {
  const normalize = required(conditions.normalizeConditions, 'normalizeConditions');
  assert.ok(normalize(draft({ date: '2026-02-30' }), fixture()).issues.some(i => i.field === 'date'));
  assert.ok(normalize(draft({ date: '2026-02-29' }), fixture()).issues.some(i => i.field === 'date'));
  assert.equal(normalize(draft({ date: '2028-02-29' }), fixture()).issues.length, 0);
  assert.ok(normalize(draft({ startTime: '24:00' }), fixture()).issues.some(i => i.field === 'startTime'));
});

test('conditions preserve a required/excluded conflict and reject an excluded origin', () => {
  const result = required(conditions.normalizeConditions, 'normalizeConditions')(draft({ excludedPlaceIds: ['B', 'A'] }), fixture());
  assert.ok(result.issues.some(i => i.code === 'REQUIRED_EXCLUDED_CONFLICT' && i.placeIds.includes('B')));
  assert.ok(result.issues.some(i => i.code === 'ORIGIN_EXCLUDED'));
});

test('conditions deduplicate ids without mutating the input', () => {
  const input = draft({ mandatoryPlaceIds: ['B', 'B', 'A'] });
  const result = required(conditions.normalizeConditions, 'normalizeConditions')(input, fixture());
  assert.deepEqual(result.conditions.mandatoryPlaceIds, ['B', 'A']);
  assert.deepEqual(input.mandatoryPlaceIds, ['B', 'B', 'A']);
});

test('controlled language applies duration, exact named places, and pace', () => {
  assert.ok(data.catalog);
  const result = required(conditions.interpretIdea, 'interpretIdea')('只有两小时，必去日月贝，避开野狸岛，慢一点', realDraft(), data.catalog);
  assert.equal(result.draft.timeLimitMinutes, 120);
  assert.ok(result.draft.mandatoryPlaceIds.includes('ZS-004'));
  assert.ok(result.draft.excludedPlaceIds.includes('ZS-005'));
  assert.equal(result.draft.pace, 'relaxed');
  assert.equal(result.clarifications.length, 0);
});

test('controlled language does not claim reservation or contextual pronoun support', () => {
  assert.ok(data.catalog);
  const result = required(conditions.interpretIdea, 'interpretIdea')('把那里换掉，然后帮我预约门票', realDraft(), data.catalog);
  assert.ok(result.clarifications.length > 0);
  assert.deepEqual(result.draft, realDraft());
});

test('a partly recognized required-place phrase keeps its unknown place unresolved', () => {
  const result = required(conditions.interpretIdea, 'interpretIdea')('必去日月贝和拱北口岸', realDraft({ mandatoryPlaceIds: [] }), data.catalog);
  assert.deepEqual(result.draft.mandatoryPlaceIds, ['ZS-004']);
  assert.ok(result.clarifications.length > 0);
});

test('Chinese hour expressions with optional 个 and 半 produce literal 90 and 120 minute limits', () => {
  const interpret = required(conditions.interpretIdea, 'interpretIdea');
  for (const [input, minutes] of [['两个小时', 120], ['三个小时', 180], ['一个半小时', 90], ['一小时半', 90], ['半个小时', 30]]) {
    const result = interpret(input, realDraft(), data.catalog);
    assert.equal(result.draft.timeLimitMinutes, minutes, input);
    assert.equal(result.clarifications.length, 0, input);
  }
});

test('conflicting total durations request clarification without choosing the first duration', () => {
  const result = required(conditions.interpretIdea, 'interpretIdea')('2小时，或者3小时', realDraft(), data.catalog);
  assert.ok(result.clarifications.length > 0);
  assert.equal(result.draft.timeLimitMinutes, 180);
});

test('recognized duration never hides unsupported lodging, live crowds, congestion, or other requests', () => {
  const interpret = required(conditions.interpretIdea, 'interpretIdea');
  for (const input of ['2小时，安排酒店', '2小时，看看实时人流', '2小时，避免拥挤', '2小时，带上火星向导']) {
    const result = interpret(input, realDraft(), data.catalog);
    assert.equal(result.draft.timeLimitMinutes, 120);
    assert.ok(result.clarifications.length > 0, input);
  }
});

test('manual fixture totals are 15 travel + 50 stay + 10 buffer = 75 minutes', () => {
  const result = propose(fixture(), draft(), null, context());
  assert.equal(result.kind, 'proposal');
  const plan = result.proposal.candidate;
  assert.equal(plan.totals.travelMinutes, 15);
  assert.equal(plan.totals.stayMinutes, 50);
  assert.equal(plan.totals.bufferMinutes, 10);
  assert.equal(plan.totals.totalMinutes, 75);
  assert.equal(plan.totals.remainingMinutes, 45);
  assert.equal(plan.totals.knownFee, 30);
  assert.equal(plan.totals.hasUnknownFee, false);
  assert.deepEqual(plan.stops.map(s => [s.arrivalMinutes, s.departureMinutes]), [[5, 25], [40, 70]]);
});

test('manual fixture returns a hard time conflict at 70 minutes', () => {
  const result = propose(fixture(), draft({ timeLimitMinutes: 70 }), null, context());
  assert.equal(result.kind, 'conflict');
  assert.ok(result.issues.some(i => i.code === 'TIME_LIMIT' && i.placeIds.includes('B')));
});

test('a midnight crossing keeps destination-local date and honest next-day offsets', () => {
  const result = propose(fixture(), draft({ startTime: '23:40' }), null, context());
  assert.equal(result.kind, 'proposal');
  assert.equal(result.proposal.candidate.conditions.date, '2026-11-24');
  assert.equal(result.proposal.candidate.conditions.startTime, '23:40');
  // B arrives at 00:20 on November 25: 23:40 + 40 minutes.
  assert.equal(result.proposal.candidate.stops[1].arrivalMinutes, 40);
  assert.ok(result.proposal.candidate.explanations.some(s => s.includes('次日')));
});

test('unknown admission stays unknown even when the known subtotal is zero', () => {
  const catalog = fixture();
  for (const place of catalog.places) place.fee = fact(null, 'unknown');
  const result = propose(catalog, draft(), null, context());
  assert.equal(result.kind, 'proposal');
  const plan = result.proposal.candidate;
  assert.equal(plan.totals.knownFee, 0);
  assert.equal(plan.totals.hasUnknownFee, true);
  assert.equal(plan.checks.find(c => c.key === 'fees').status, 'unknown');
  assert.equal(plan.checks.find(c => c.key === 'opening').status, 'unknown');
});

test('missing required stay information requests clarification instead of zero-minute visits', () => {
  const catalog = fixture();
  catalog.places[1].stayMinutes = fact(null, 'unknown');
  const result = propose(catalog, draft(), null, context());
  assert.equal(result.kind, 'clarification');
  assert.ok(result.issues.some(i => i.code === 'MISSING_STAY' && i.placeIds.includes('B')));
});

test('different distances produce different leg costs, never a shared twenty-minute constant', () => {
  const catalog = fixture();
  const third = structuredClone(catalog.places[1]);
  third.id = 'C'; third.name = '测试点 C'; third.coordinates.value = [113.573, 22.270];
  third.stayMinutes = fact(10); catalog.places.push(third);
  const result = propose(catalog, draft({ mandatoryPlaceIds: ['A', 'B', 'C'], timeLimitMinutes: 240 }), null, context());
  assert.equal(result.kind, 'proposal');
  assert.deepEqual(result.proposal.candidate.legs.map(l => l.durationMinutes.value), [15, 30]);
  assert.ok(result.proposal.candidate.legs.every(l => l.geometry.kind === 'schematic' && l.durationMinutes.status === 'estimate'));
});

test('the three real tasks generate modifiable proposals or a concrete conflict', () => {
  assert.ok(data.catalog);
  const coastal = propose(data.catalog, realDraft({ mandatoryPlaceIds: ['ZS-001', 'ZS-002'] }), null, context());
  const landmark = propose(data.catalog, realDraft(), null, context({ requestId: 'R2' }));
  const companions = propose(data.catalog, realDraft({ mandatoryPlaceIds: ['ZS-007'], scenario: 'less-walking', pace: 'relaxed' }), null, context({ requestId: 'R3' }));
  for (const result of [coastal, landmark, companions]) {
    assert.equal(result.kind, 'proposal');
    assert.ok(result.proposal.candidate.totals.totalMinutes <= 180);
  }
  assert.ok(landmark.proposal.candidate.orderedPlaceIds.length >= 3 && landmark.proposal.candidate.orderedPlaceIds.length <= 4);
  assert.ok(landmark.proposal.candidate.totals.remainingMinutes >= 30);
  const overloaded = propose(data.catalog, realDraft({ timeLimitMinutes: 120, mandatoryPlaceIds: ['ZS-004', 'ZS-005', 'ZS-008', 'ZS-009'] }), null, context({ requestId: 'R4' }));
  assert.equal(overloaded.kind, 'conflict');
  assert.ok(overloaded.issues.some(i => i.code === 'TIME_LIMIT'));
});

test('extra time does not keep adding optional stops to fill the day', () => {
  assert.ok(data.catalog);
  const result = propose(data.catalog, realDraft({ timeLimitMinutes: 720 }), null, context());
  assert.equal(result.kind, 'proposal');
  assert.ok(result.proposal.candidate.orderedPlaceIds.length <= 4);
  assert.ok(result.proposal.candidate.totals.remainingMinutes > 400);
});

test('less-walking changes actual walking distance and explains its tradeoff', () => {
  assert.ok(data.catalog);
  const base = propose(data.catalog, realDraft({ transport: 'walk' }), null, context()).proposal?.candidate;
  assert.ok(base);
  const result = propose(data.catalog, realDraft({ scenario: 'less-walking', pace: 'relaxed', transport: 'mixed' }), base, context({ requestId: 'R2', draftRevision: 2 }));
  assert.equal(result.kind, 'proposal');
  assert.ok(result.proposal.candidate.totals.walkingKm < base.totals.walkingKm);
  assert.ok(result.proposal.candidate.explanations.some(s => /换乘|接驳|费用/.test(s)));
  assert.ok(result.proposal.delta.walkingKmChange < 0);
});

test('proposals bind a concrete request, session, draft, baseline, and expiry', () => {
  const initial = propose(fixture(), draft(), null, context()).proposal.candidate;
  initial.versionNo = 7;
  const result = propose(fixture(), draft(), initial, context({ requestId: 'R8', sessionEpoch: 3, draftRevision: 9, nowMs: 2000 }));
  assert.equal(result.kind, 'proposal');
  const p = result.proposal;
  assert.equal(p.requestId, 'R8'); assert.equal(p.sessionEpoch, 3); assert.equal(p.draftRevision, 9); assert.equal(p.baseVersionNo, 7);
  assert.ok(p.expiresAtMs > 2000);
  assert.ok(p.delta);
});

test('plan delta preserves unknown fee differences and identifies only a true reorder', () => {
  const before = propose(fixture(), draft(), null, context()).proposal.candidate;
  const after = structuredClone(before);
  after.orderedPlaceIds.reverse(); after.totals.walkingKm = 0; after.totals.hasUnknownFee = true;
  const result = required(delta.derivePlanDelta, 'derivePlanDelta')(before, after);
  assert.equal(result.orderChanged, true);
  assert.deepEqual(result.addedPlaceIds, []); assert.deepEqual(result.removedPlaceIds, []);
  assert.equal(result.feeChange, null);
  assert.ok(result.walkingKmChange < 0);
});
