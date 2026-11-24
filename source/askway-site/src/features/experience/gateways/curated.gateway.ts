import type { Catalog, ConditionsDraft, ConfirmedPlan } from '../contracts';
import { proposeCuratedPlan } from '../domain/curated-planner.ts';

export function createCuratedGateway(catalog: Catalog) {
  return {
    async propose(draft: ConditionsDraft, basePlan: ConfirmedPlan | null, scope: {
      requestId: string; sessionEpoch: number; draftRevision: number; nowMs: number;
    }, signal: AbortSignal) {
      await Promise.resolve();
      if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      return proposeCuratedPlan(catalog, draft, basePlan, scope);
    },
  };
}
