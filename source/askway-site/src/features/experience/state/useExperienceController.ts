import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ConditionsDraft, RequestScope } from '../contracts';
import { catalog } from '../data/catalog.ts';
import { normalizeConditions } from '../domain/conditions.ts';
import { makeDefaultDraft } from '../config';
import { createCuratedGateway } from '../gateways/curated.gateway.ts';
import { canAdoptProposal, createExperienceState, reduceExperience } from './experience.reducer.ts';

const gateway = createCuratedGateway(catalog);
export default function useExperienceController() {
  const [state, dispatch] = useReducer(reduceExperience, makeDefaultDraft(), createExperienceState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const requestRef = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const [, refreshExpiry] = useReducer((value: number) => value + 1, 0);
  const cancelIO = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  useEffect(() => cancelIO, [cancelIO]);
  useEffect(() => {
    if (!state.proposal) return;
    const timer = window.setTimeout(refreshExpiry, Math.max(0, state.proposal.expiresAtMs - Date.now()) + 10);
    return () => window.clearTimeout(timer);
  }, [state.proposal]);
  const updateDraft = useCallback((draft: ConditionsDraft) => {
    cancelIO();
    dispatch({ type: 'DRAFT_CHANGED', draft });
  }, [cancelIO]);
  const review = useCallback(() => {
    const result = normalizeConditions(stateRef.current.draft, catalog);
    if (result.issues.length) return result.issues;
    const changed = JSON.stringify(result.conditions) !== JSON.stringify(stateRef.current.draft);
    if (!changed && stateRef.current.confirmedRevision === stateRef.current.draftRevision) return [];
    if (changed) dispatch({ type: 'DRAFT_CHANGED', draft: result.conditions });
    dispatch({ type: 'CONDITIONS_CONFIRMED' });
    return [];
  }, []);
  const propose = useCallback(async () => {
    const current = stateRef.current;
    if (current.confirmedRevision !== current.draftRevision) return null;
    cancelIO();
    const controller = new AbortController();
    requestRef.current = controller;
    const scope: RequestScope = {
      requestId: 'curated-' + ++requestNumber.current, sessionEpoch: current.sessionEpoch,
      draftRevision: current.draftRevision, operation: 'propose',
    };
    dispatch({ type: 'REQUEST_STARTED', scope });
    try {
      const result = await gateway.propose(current.draft, current.activePlan, { ...scope, nowMs: Date.now() }, controller.signal);
      if (!controller.signal.aborted) { dispatch({ type: 'PROPOSAL_READY', scope, result }); return result; }
      return null;
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: 'REQUEST_FAILED', scope, message: error instanceof Error ? error.message : '生成失败，请重试。' });
      return null;
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [cancelIO]);
  const reset = useCallback((draft = makeDefaultDraft()) => {
    cancelIO(); dispatch({ type: 'RESET', draft });
  }, [cancelIO]);
  return {
    catalog, state, updateDraft, review, propose, reset,
    canGenerate: state.confirmedRevision === state.draftRevision && !state.pending,
    canAdopt: canAdoptProposal(state, Date.now()),
    adopt: () => dispatch({ type: 'ADOPT', nowMs: Date.now() }),
    undo: () => { cancelIO(); dispatch({ type: 'UNDO' }); },
    selectPlace: (placeId: string | null) => dispatch({ type: 'SELECT_PLACE', placeId }),
    setView: (view: '2d' | '3d') => dispatch({ type: 'SET_VIEW', view }),
    cancel: () => { cancelIO(); dispatch({ type: 'CANCEL' }); },
  };
}
