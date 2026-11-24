import assert from 'node:assert/strict';
import { test } from 'node:test';

let domain = {};
try { domain = await import('../../src/features/experience/state/experience.reducer.ts'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const required = (fn, name) => { assert.equal(typeof fn, 'function', `${name} has not been implemented`); return fn; };
const draft = (overrides = {}) => ({ date: '2026-11-24', startTime: '09:00', timeLimitMinutes: 120, pace: 'balanced', transport: 'walk', mandatoryPlaceIds: ['A', 'B'], excludedPlaceIds: [], scenario: 'none', originPlaceId: 'A', ...overrides });
const initial = () => required(domain.createExperienceState, 'createExperienceState')(draft());
const reduce = (...args) => required(domain.reduceExperience, 'reduceExperience')(...args);
const canAdopt = (...args) => required(domain.canAdoptProposal, 'canAdoptProposal')(...args);
const plan = (conditions = draft(), overrides = {}) => ({
  id: 'PLAN-A', versionNo: 1, catalogVersion: 'test-only', conditions: structuredClone(conditions), orderedPlaceIds: ['A', 'B'],
  legs: [], stops: [{ placeId: 'A', arrivalMinutes: 5, departureMinutes: 25, stayMinutes: 20 }, { placeId: 'B', arrivalMinutes: 40, departureMinutes: 70, stayMinutes: 30 }],
  totals: { travelMinutes: 15, stayMinutes: 50, bufferMinutes: 10, totalMinutes: 75, remainingMinutes: 45, knownFee: 30, hasUnknownFee: false, distanceKm: 0.1, walkingKm: 0.1 },
  checks: [], explanations: [], createdAtMs: 1000, ...overrides,
});
const scope = (state, requestId = 'R1') => ({ requestId, sessionEpoch: state.sessionEpoch, draftRevision: state.draftRevision, operation: 'propose' });
const proposal = (state, request = scope(state), overrides = {}) => ({
  id: `P-${request.requestId}`, baseVersionNo: state.activePlan?.versionNo ?? 0, draftRevision: request.draftRevision,
  sessionEpoch: request.sessionEpoch, requestId: request.requestId, expiresAtMs: 50000,
  candidate: plan(state.draft, { id: `PLAN-${request.requestId}`, versionNo: state.versionCounter + 1 }), delta: null, ...overrides,
});
const ready = (state, requestId = 'R1', overrides = {}) => {
  state = reduce(state, { type: 'CONDITIONS_CONFIRMED' });
  const request = scope(state, requestId);
  state = reduce(state, { type: 'REQUEST_STARTED', scope: request });
  return reduce(state, { type: 'PROPOSAL_READY', scope: request, result: { kind: 'proposal', proposal: proposal(state, request, overrides) } });
};

test('generation must follow explicit condition review', () => {
  const state = initial();
  const next = reduce(state, { type: 'REQUEST_STARTED', scope: scope(state) });
  assert.equal(next.pending, null);
  assert.equal(next.status, 'editing');
});

test('reviewing an unchanged confirmed draft is idempotent for an adoptable proposal and pending planning', () => {
  const proposed = ready(initial());
  assert.equal(canAdopt(proposed, 1000), true);
  const reviewedAgain = reduce(proposed, { type: 'CONDITIONS_CONFIRMED' });
  assert.equal(reviewedAgain, proposed);
  assert.equal(canAdopt(reviewedAgain, 1000), true);
  const reviewed = reduce(initial(), { type: 'CONDITIONS_CONFIRMED' });
  const planning = reduce(reviewed, { type: 'REQUEST_STARTED', scope: scope(reviewed) });
  assert.equal(reduce(planning, { type: 'CONDITIONS_CONFIRMED' }), planning);
});

test('a new draft keeps the active version while invalidating a proposal and in-flight request', () => {
  let state = reduce(ready(initial()), { type: 'ADOPT', nowMs: 1000 });
  const active = state.activePlan;
  state = ready(state, 'R2');
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ timeLimitMinutes: 180 }) });
  assert.equal(state.activePlan, active);
  assert.equal(state.proposal, null); assert.equal(state.pending, null); assert.equal(state.confirmedRevision, null);
  assert.equal(state.draftRevision, 2); assert.equal(state.status, 'editing');
});

test('a late response for the previous request cannot replace the current proposal', () => {
  let state = reduce(initial(), { type: 'CONDITIONS_CONFIRMED' });
  const old = scope(state, 'OLD'); const current = scope(state, 'NEW');
  state = reduce(state, { type: 'REQUEST_STARTED', scope: old });
  const oldProposal = proposal(state, old);
  state = reduce(state, { type: 'REQUEST_STARTED', scope: current });
  const ignored = reduce(state, { type: 'PROPOSAL_READY', scope: old, result: { kind: 'proposal', proposal: oldProposal } });
  assert.equal(ignored, state); assert.equal(ignored.pending.requestId, 'NEW');
});

test('draft changes discard late success and failure responses', () => {
  let state = reduce(initial(), { type: 'CONDITIONS_CONFIRMED' });
  const old = scope(state);
  state = reduce(state, { type: 'REQUEST_STARTED', scope: old });
  const oldProposal = proposal(state, old);
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ pace: 'relaxed' }) });
  assert.equal(reduce(state, { type: 'PROPOSAL_READY', scope: old, result: { kind: 'proposal', proposal: oldProposal } }), state);
  assert.equal(reduce(state, { type: 'REQUEST_FAILED', scope: old, message: 'late failure' }), state);
});

test('a request from a previous session is ignored after reset', () => {
  let state = reduce(initial(), { type: 'CONDITIONS_CONFIRMED' });
  const old = scope(state); const oldProposal = proposal(state, old);
  state = reduce(state, { type: 'RESET', draft: draft() });
  assert.equal(state.sessionEpoch, 2);
  assert.equal(reduce(state, { type: 'PROPOSAL_READY', scope: old, result: { kind: 'proposal', proposal: oldProposal } }), state);
});

test('response payload must agree with its request envelope', () => {
  for (const mismatch of [{ requestId: 'OTHER' }, { sessionEpoch: 2 }, { draftRevision: 99 }, { baseVersionNo: 7 }]) {
    const state = ready(initial(), 'R1', mismatch);
    assert.equal(state.proposal, null);
    assert.equal(canAdopt(state, 1000), false);
  }
});

test('a proposal can be adopted only before its TTL and with its current baseline', () => {
  const state = ready(initial());
  assert.equal(canAdopt(state, 49999), true);
  assert.equal(canAdopt(state, 50000), false);
  const expired = reduce(state, { type: 'ADOPT', nowMs: 50000 });
  assert.equal(expired.activePlan, null);
  assert.equal(canAdopt({ ...state, activePlan: plan(undefined, { versionNo: 3 }) }, 1000), false);
});

test('adopting a second version saves the previous snapshot and increments once', () => {
  let state = reduce(ready(initial()), { type: 'ADOPT', nowMs: 1000 });
  const first = state.activePlan;
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ timeLimitMinutes: 180 }) });
  state = ready(state, 'R2');
  state = reduce(state, { type: 'ADOPT', nowMs: 1000 });
  assert.equal(state.activePlan.versionNo, 2); assert.equal(state.versionCounter, 2);
  assert.equal(state.previousPlan, first); assert.equal(state.activePlan.conditions.timeLimitMinutes, 180);
  assert.equal(state.proposal, null);
  const repeated = reduce(state, { type: 'ADOPT', nowMs: 1000 });
  assert.equal(repeated, state);
});

test('undo restores earlier content with a new monotonic version and invalidates old candidates', () => {
  let state = reduce(ready(initial()), { type: 'ADOPT', nowMs: 1000 });
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ timeLimitMinutes: 180 }) });
  state = reduce(ready(state, 'R2'), { type: 'ADOPT', nowMs: 1000 });
  state = ready(state, 'R3');
  state = reduce(state, { type: 'UNDO' });
  assert.equal(state.activePlan.conditions.timeLimitMinutes, 120);
  assert.equal(state.activePlan.versionNo, 3); assert.equal(state.versionCounter, 3);
  assert.equal(state.draft.timeLimitMinutes, 120); assert.equal(state.proposal, null); assert.equal(state.pending, null);
  assert.equal(state.previousPlan, null);
  assert.equal(state.confirmedRevision, state.draftRevision);
});

test('selection and view switches never mutate confirmed plan or version counters', () => {
  const state = reduce(ready(initial()), { type: 'ADOPT', nowMs: 1000 });
  const selected = reduce(state, { type: 'SELECT_PLACE', placeId: 'B' });
  const next = reduce(selected, { type: 'SET_VIEW', view: '3d' });
  assert.equal(next.activePlan, state.activePlan); assert.equal(next.versionCounter, state.versionCounter);
  assert.equal(next.draftRevision, state.draftRevision); assert.equal(next.selectedPlaceId, 'B'); assert.equal(next.view, '3d');
});

test('a current failure keeps recoverable confirmed content', () => {
  let state = reduce(ready(initial()), { type: 'ADOPT', nowMs: 1000 });
  const active = state.activePlan;
  state = reduce(state, { type: 'CONDITIONS_CONFIRMED' });
  const request = scope(state, 'FAIL');
  state = reduce(state, { type: 'REQUEST_STARTED', scope: request });
  state = reduce(state, { type: 'REQUEST_FAILED', scope: request, message: 'timeout' });
  assert.equal(state.activePlan, active); assert.equal(state.status, 'failed'); assert.equal(state.pending, null);
});

test('reset clears content without rewinding the version counter', () => {
  let state = reduce(ready(initial()), { type: 'ADOPT', nowMs: 1000 });
  state = reduce(state, { type: 'RESET', draft: draft() });
  assert.equal(state.versionCounter, 1); assert.equal(state.activePlan, null);
  state = reduce(ready(state, 'R2'), { type: 'ADOPT', nowMs: 1000 });
  assert.equal(state.activePlan.versionNo, 2); assert.equal(state.versionCounter, 2);
});

test('a new proposal reconciles a removed selection while comparison accepts points from both plans', () => {
  let state = required(domain.createExperienceState, 'createExperienceState')(draft({ mandatoryPlaceIds: ['A'] }));
  state = reduce(ready(state), { type: 'ADOPT', nowMs: 1000 });
  state = reduce(state, { type: 'SELECT_PLACE', placeId: 'B' });
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ mandatoryPlaceIds: ['A'], timeLimitMinutes: 180 }) });
  const candidate = plan(state.draft, { orderedPlaceIds: ['A', 'C'], stops: [{ placeId: 'A', arrivalMinutes: 5, departureMinutes: 25, stayMinutes: 20 }, { placeId: 'C', arrivalMinutes: 40, departureMinutes: 70, stayMinutes: 30 }] });
  state = ready(state, 'R2', { candidate });
  assert.equal(state.selectedPlaceId, 'A', 'B is absent from the displayed candidate');
  state = reduce(state, { type: 'SELECT_PLACE', placeId: 'B' });
  assert.equal(state.selectedPlaceId, 'B', 'comparison can still select a point in the active version');
  state = reduce(state, { type: 'SELECT_PLACE', placeId: 'C' });
  assert.equal(state.selectedPlaceId, 'C', 'comparison can select a candidate point');
  assert.equal(reduce(state, { type: 'SELECT_PLACE', placeId: 'NOT-IN-EITHER-PLAN' }), state);
});

test('golden selection case reconciles edits, cancellation, adoption, and undo against displayed content', () => {
  let state = required(domain.createExperienceState, 'createExperienceState')(draft({ mandatoryPlaceIds: ['A'] }));
  state = reduce(ready(state), { type: 'ADOPT', nowMs: 1000 });
  const first = state.activePlan;
  const different = () => plan(state.draft, { orderedPlaceIds: ['A', 'C'], stops: [{ placeId: 'A', arrivalMinutes: 5, departureMinutes: 25, stayMinutes: 20 }, { placeId: 'C', arrivalMinutes: 40, departureMinutes: 70, stayMinutes: 30 }] });
  state = ready(state, 'R2', { candidate: different() });
  state = reduce(state, { type: 'SELECT_PLACE', placeId: 'C' });
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ mandatoryPlaceIds: ['A'], timeLimitMinutes: 180 }) });
  assert.equal(state.selectedPlaceId, 'A'); assert.equal(state.activePlan, first);
  state = ready(state, 'R3', { candidate: different() });
  state = reduce(state, { type: 'SELECT_PLACE', placeId: 'C' });
  state = reduce(state, { type: 'CANCEL' });
  assert.equal(state.selectedPlaceId, 'A'); assert.equal(state.activePlan, first);
  state = ready(state, 'R4', { candidate: different() });
  state = reduce(state, { type: 'SELECT_PLACE', placeId: 'C' });
  state = reduce(state, { type: 'ADOPT', nowMs: 1000 });
  assert.equal(state.selectedPlaceId, 'C'); assert.deepEqual(state.activePlan.orderedPlaceIds, ['A', 'C']);
  state = reduce(state, { type: 'UNDO' });
  assert.equal(state.selectedPlaceId, 'A'); assert.deepEqual(state.activePlan.orderedPlaceIds, ['A', 'B']);
  assert.equal(state.activePlan.conditions.timeLimitMinutes, 120); assert.equal(state.activePlan.versionNo, 3);
  assert.match(state.message, /恢复 V1 的内容/); assert.match(state.message, /当前为 V3/);
});

test('without a displayed plan, editing preserves a previously validated catalog selection', () => {
  let state = reduce(initial(), { type: 'SELECT_PLACE', placeId: 'CATALOG-POINT' });
  state = reduce(state, { type: 'DRAFT_CHANGED', draft: draft({ timeLimitMinutes: 180 }) });
  assert.equal(state.selectedPlaceId, 'CATALOG-POINT');
  state = reduce(state, { type: 'CANCEL' });
  assert.equal(state.selectedPlaceId, 'CATALOG-POINT');
});
