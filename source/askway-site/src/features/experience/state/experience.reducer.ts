import type { ConditionsDraft, ConfirmedPlan, ExperienceAction, ExperienceState, Proposal, RequestScope } from '../contracts.ts';

const snapshot = (draft: ConditionsDraft): ConditionsDraft => ({ ...draft, mandatoryPlaceIds: [...draft.mandatoryPlaceIds], excludedPlaceIds: [...draft.excludedPlaceIds] });
// A plan transition uses the newly displayed content. Without a plan, the
// controller's already-validated catalog selection remains available for browsing.
const reconcileSelection = (plan: ConfirmedPlan | null, previousSelection: string | null): string | null =>
  plan === null ? previousSelection : previousSelection !== null && plan.orderedPlaceIds.includes(previousSelection) ? previousSelection : plan.orderedPlaceIds[0] ?? null;
const sameConditions = (left: ConditionsDraft, right: ConditionsDraft) =>
  left.date === right.date && left.startTime === right.startTime && left.timeLimitMinutes === right.timeLimitMinutes &&
  left.pace === right.pace && left.transport === right.transport && left.scenario === right.scenario && left.originPlaceId === right.originPlaceId &&
  left.mandatoryPlaceIds.join('|') === right.mandatoryPlaceIds.join('|') && left.excludedPlaceIds.join('|') === right.excludedPlaceIds.join('|');

export function createExperienceState(draft: ConditionsDraft): ExperienceState {
  return { sessionEpoch: 1, draftRevision: 1, versionCounter: 0, draft: snapshot(draft), confirmedRevision: null,
    activePlan: null, previousPlan: null, proposal: null, pending: null, issues: [], status: 'editing', selectedPlaceId: null, view: '2d', message: null };
}

const currentRequest = (state: ExperienceState, scope: RequestScope) =>
  state.pending !== null && state.pending.requestId === scope.requestId && state.pending.sessionEpoch === scope.sessionEpoch &&
  state.pending.draftRevision === scope.draftRevision && scope.sessionEpoch === state.sessionEpoch && scope.draftRevision === state.draftRevision && scope.operation === 'propose';
const boundProposal = (state: ExperienceState, proposal: Proposal) =>
  proposal.sessionEpoch === state.sessionEpoch && proposal.draftRevision === state.draftRevision &&
  proposal.baseVersionNo === (state.activePlan?.versionNo ?? 0) && sameConditions(proposal.candidate.conditions, state.draft);

export function canAdoptProposal(state: ExperienceState, nowMs: number): boolean {
  const proposal = state.proposal;
  if (!proposal || state.status !== 'proposal' || state.pending !== null || state.confirmedRevision !== state.draftRevision ||
      !Number.isFinite(nowMs) || !Number.isFinite(proposal.expiresAtMs) || nowMs >= proposal.expiresAtMs || !boundProposal(state, proposal)) return false;
  const candidate = proposal.candidate, ids = new Set(candidate.orderedPlaceIds);
  return ids.size === candidate.orderedPlaceIds.length && candidate.orderedPlaceIds[0] === state.draft.originPlaceId &&
    state.draft.mandatoryPlaceIds.every(id => ids.has(id)) && state.draft.excludedPlaceIds.every(id => !ids.has(id)) &&
    Number.isFinite(candidate.totals.totalMinutes) && candidate.totals.totalMinutes >= 0 && candidate.totals.totalMinutes <= state.draft.timeLimitMinutes;
}

export function reduceExperience(state: ExperienceState, action: ExperienceAction): ExperienceState {
  switch (action.type) {
    case 'DRAFT_CHANGED':
      return { ...state, draft: snapshot(action.draft), draftRevision: state.draftRevision + 1, confirmedRevision: null,
        proposal: null, pending: null, issues: [], status: 'editing', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), message: state.activePlan ? '条件已修改，当前版本仍保留；请重新核对后生成候选。' : null };
    case 'CONDITIONS_CONFIRMED':
      if (state.confirmedRevision === state.draftRevision && state.issues.length === 0) return state;
      return { ...state, confirmedRevision: state.draftRevision, status: 'reviewed', issues: [], message: '条件已核对，可以生成候选。' };
    case 'REQUEST_STARTED':
      if (state.confirmedRevision !== state.draftRevision || action.scope.sessionEpoch !== state.sessionEpoch || action.scope.draftRevision !== state.draftRevision || action.scope.operation !== 'propose' || !action.scope.requestId) return state;
      return { ...state, pending: { ...action.scope }, proposal: null, issues: [], status: 'planning', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), message: null };
    case 'PROPOSAL_READY': {
      if (!currentRequest(state, action.scope)) return state;
      if (action.result.kind !== 'proposal') return { ...state, pending: null, proposal: null, issues: action.result.issues, status: 'conflict', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), message: action.result.kind === 'clarification' ? '资料或条件需要进一步核对。' : '当前硬条件无法同时满足。' };
      const proposal = action.result.proposal;
      if (proposal.requestId !== action.scope.requestId || !boundProposal(state, proposal)) return { ...state, pending: null, proposal: null, status: 'failed', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), issues: [{ code: 'PROPOSAL_SCOPE_MISMATCH', message: '候选绑定的条件、会话或基线已改变，请重新生成。' }], message: '候选已失效，当前版本保留。' };
      return { ...state, pending: null, proposal: structuredClone(proposal), issues: [], status: 'proposal', selectedPlaceId: reconcileSelection(proposal.candidate, state.selectedPlaceId), message: '候选尚未采用；核对变化后再决定。' };
    }
    case 'REQUEST_FAILED':
      if (!currentRequest(state, action.scope)) return state;
      return { ...state, pending: null, proposal: null, status: 'failed', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), message: action.message, issues: [{ code: 'REQUEST_FAILED', message: action.message }] };
    case 'ADOPT': {
      if (!state.proposal) return state;
      if (!canAdoptProposal(state, action.nowMs)) return { ...state, proposal: null, pending: null, status: 'reviewed', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), message: '候选已过期或条件基线已改变，请重新生成。' };
      const versionNo = state.versionCounter + 1;
      const activePlan = { ...structuredClone(state.proposal.candidate), id: `${state.proposal.candidate.id}-v${versionNo}`, versionNo };
      return { ...state, activePlan, previousPlan: state.activePlan, versionCounter: versionNo, proposal: null, pending: null, issues: [], status: 'confirmed', selectedPlaceId: reconcileSelection(activePlan, state.selectedPlaceId), message: `已采用版本 V${versionNo}。` };
    }
    case 'UNDO': {
      if (!state.previousPlan) return state;
      const versionNo = state.versionCounter + 1, draftRevision = state.draftRevision + 1;
      const previousVersion = state.previousPlan.versionNo;
      const activePlan = { ...structuredClone(state.previousPlan), id: `undo-${state.sessionEpoch}-v${versionNo}`, versionNo,
        explanations: [...state.previousPlan.explanations, `恢复 V${previousVersion} 的内容，当前为 V${versionNo}；原条件与资料来源一并恢复。`] };
      return { ...state, activePlan, previousPlan: null, draft: snapshot(activePlan.conditions), draftRevision, confirmedRevision: draftRevision,
        versionCounter: versionNo, proposal: null, pending: null, issues: [], status: 'confirmed', selectedPlaceId: reconcileSelection(activePlan, state.selectedPlaceId), message: `已恢复 V${previousVersion} 的内容，当前为 V${versionNo}；原条件与资料来源一并恢复。` };
    }
    case 'SELECT_PLACE': {
      const validIds = new Set([...(state.activePlan?.orderedPlaceIds ?? []), ...(state.proposal?.candidate.orderedPlaceIds ?? [])]);
      if (action.placeId !== null && validIds.size > 0 && !validIds.has(action.placeId)) return state;
      return action.placeId === state.selectedPlaceId ? state : { ...state, selectedPlaceId: action.placeId };
    }
    case 'SET_VIEW': return action.view === state.view ? state : { ...state, view: action.view };
    case 'RESET': return { ...createExperienceState(action.draft), sessionEpoch: state.sessionEpoch + 1, versionCounter: state.versionCounter, view: state.view, message: '示例会话已重置。' };
    case 'CANCEL': return { ...state, pending: null, proposal: null, issues: [], status: state.confirmedRevision === state.draftRevision ? 'reviewed' : 'editing', selectedPlaceId: reconcileSelection(state.activePlan, state.selectedPlaceId), message: state.activePlan ? '候选已取消，当前版本保留。' : '候选已取消。' };
  }
}
