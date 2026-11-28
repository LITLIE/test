import { useState } from 'react';
import { Check, Clock3 } from 'lucide-react';
import { catalog } from '../data/catalog.ts';
import { makeDefaultDraft } from '../config';
import { proposeCuratedPlan } from '../domain/curated-planner.ts';
import RouteMap2D from '../map/RouteMap2D';
import JourneyPreview from './JourneyPreview';
import '../styles/experience.css';

const example = proposeCuratedPlan(catalog, makeDefaultDraft(), null, {
  requestId: 'public-home-example', sessionEpoch: 1, draftRevision: 1, nowMs: 0,
});
const plan = example.kind === 'proposal' ? example.proposal.candidate : null;

export default function ExperiencePreview({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<string | null>('ZS-004');
  if (compact) return <JourneyPreview catalog={catalog} plan={plan}/>;
  return <figure className="experience-miniature">
    <div className="miniature-top"><span><span/>CURATED CITY JOURNEY</span><small>珠海 · 海岸慢游</small></div>
    <RouteMap2D catalog={catalog} plan={plan} selectedPlaceId={selected} onSelectPlace={setSelected} reducedMotion/>
    <figcaption className="miniature-caption"><span><Clock3 size={15} aria-hidden="true"/>3 小时 · 日月贝必去</span><span><Check size={15} aria-hidden="true"/>{plan ? `${plan.orderedPlaceIds.length} 站 · 留 ${plan.totals.remainingMinutes} 分钟余量` : `${catalog.places.length} 个公开参考点`}</span><small>与旅程工作台使用相同资料与规划规则；时间、路线为演示估算。</small></figcaption>
  </figure>;
}
