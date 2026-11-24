import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleHelp, Compass, Copy, Footprints, Info, Layers, Map, MapPin, MessageCircle, Pause, Play, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ConditionsDraft, ConditionIssue, Pace } from '../contracts';
import { experienceConfig, makeDefaultDraft, tasks } from '../config';
import { interpretIdea, normalizeConditions } from '../domain/conditions.ts';
import useExperienceController from '../state/useExperienceController';
import useExperienceMotion from '../motion/useExperienceMotion';
import RouteMap2D from '../map/RouteMap2D';
import MapLandmarkPreview from '../map/MapLandmarkPreview';
import ClientScene from '../scene/ClientScene';
import ConstraintWeave from './ConstraintWeave';
import PlanTimeline from './PlanTimeline';
import PlanComparison from './PlanComparison';
import PlaceDetails from './PlaceDetails';
import { describeConditions, paceLabels, placeName, planSummary } from './format';
import '../styles/experience.css';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function ExperienceWorkbench() {
  const controller = useExperienceController();
  const controllerRef = useRef(controller); controllerRef.current = controller;
  const { catalog, state } = controller;
  const root = useRef<HTMLDivElement>(null);
  const mapRegion = useRef<HTMLDivElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const generateButton = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const [taskId, setTaskId] = useState('coast');
  const [idea, setIdea] = useState('');
  const [ideaPending, setIdeaPending] = useState(false);
  const [ideaFeedback, setIdeaFeedback] = useState<{ recognized: string[]; clarifications: string[] } | null>(null);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [reviewIssues, setReviewIssues] = useState<ConditionIssue[]>([]);
  const [mobilePanel, setMobilePanel] = useState<'conditions' | 'map' | 'plan'>('conditions');
  const [comparisonView, setComparisonView] = useState<'active' | 'candidate'>('candidate');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const displayPlan = comparisonView === 'active' && state.activePlan ? state.activePlan : state.proposal?.candidate || state.activePlan;
  const selectedPlace = catalog.places.find(place => place.id === state.selectedPlaceId) || catalog.places.find(place => place.id === state.draft.originPlaceId)!;
  const conditionsConfirmed = state.confirmedRevision === state.draftRevision;
  const hasClarifications = !!ideaFeedback?.clarifications.length;
  const validation = normalizeConditions(state.draft, catalog);
  const issues = state.issues.length ? state.issues : reviewAttempted ? reviewIssues.length ? reviewIssues : validation.issues : [];

  useExperienceMotion(root, `${state.status}:${state.proposal?.id || state.activePlan?.id || 'empty'}:${comparisonView}`, reducedMotion);
  useEffect(() => { setComparisonView('candidate'); setPlaying(false); setPlaybackIndex(null); setCopyStatus(''); }, [state.proposal?.id, state.activePlan?.id]);
  useEffect(() => { if (reducedMotion) setPlaying(false); }, [reducedMotion]);
  useEffect(() => {
    const stop = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', stop);
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) setPlaying(false); });
    if (mapRegion.current) observer.observe(mapRegion.current);
    return () => { document.removeEventListener('visibilitychange', stop); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!playing || reducedMotion || !displayPlan || playbackIndex === null) return;
    if (playbackIndex >= displayPlan.orderedPlaceIds.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => {
      const next = playbackIndex + 1;
      setPlaybackIndex(next);
      controllerRef.current.selectPlace(displayPlan.orderedPlaceIds[next]);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [playing, playbackIndex, displayPlan?.id, reducedMotion]);

  const edit = (patch: Partial<ConditionsDraft>) => {
    setPlaying(false); if (!hasClarifications) setIdeaFeedback(null); setReviewAttempted(false); setReviewIssues([]); setCopyStatus('');
    controller.updateDraft({ ...state.draft, ...patch });
  };
  const chooseTask = (id: string) => {
    const next = makeDefaultDraft(id);
    next.date = state.draft.date; next.startTime = state.draft.startTime;
    setTaskId(id); setIdea(''); setIdeaPending(false); setIdeaFeedback(null); setReviewAttempted(false); setReviewIssues([]); setPlaying(false); setPlaybackIndex(null); setComparisonView('candidate');
    controller.updateDraft(next); setMobilePanel('conditions');
  };
  const selectPlace = (id: string) => { setPlaying(false); controller.selectPlace(id); };
  const togglePlace = (key: 'mandatoryPlaceIds' | 'excludedPlaceIds', id: string) => {
    const current = state.draft[key]; edit({ [key]: current.includes(id) ? current.filter(value => value !== id) : [...current, id] });
  };
  const review = () => {
    setReviewAttempted(true);
    if (hasClarifications || ideaPending) return;
    const errors = controller.review(); setReviewIssues(errors);
    if (errors.length) requestAnimationFrame(() => errorSummary.current?.focus());
    else requestAnimationFrame(() => generateButton.current?.focus());
  };
  const applyIdea = () => {
    const result = interpretIdea(idea, state.draft, catalog);
    if (result.recognized.length) controller.updateDraft(result.draft);
    setIdeaFeedback(result); setIdeaPending(false); setReviewAttempted(false); setReviewIssues([]); setPlaying(false);
  };
  const generate = async () => {
    setPlaying(false); setPlaybackIndex(null); setComparisonView('candidate');
    const result = await controller.propose();
    setMobilePanel(result?.kind === 'proposal' ? 'plan' : 'conditions');
    if (result?.kind !== 'proposal') requestAnimationFrame(() => errorSummary.current?.focus());
  };
  const preview = () => {
    if (!displayPlan?.orderedPlaceIds.length) return;
    setPlaybackIndex(0); controller.selectPlace(displayPlan.orderedPlaceIds[0]); setPlaying(!reducedMotion); setMobilePanel('map');
  };
  const stepPreview = (direction: number) => {
    if (!displayPlan?.orderedPlaceIds.length) return;
    setPlaying(false);
    const next = Math.max(0, Math.min(displayPlan.orderedPlaceIds.length - 1, (playbackIndex ?? 0) + direction));
    setPlaybackIndex(next); controller.selectPlace(displayPlan.orderedPlaceIds[next]);
  };
  const changeComparison = (view: 'active' | 'candidate') => {
    setComparisonView(view); setPlaying(false); setPlaybackIndex(null);
    const next = view === 'active' ? state.activePlan : state.proposal?.candidate;
    if (next && !next.orderedPlaceIds.includes(state.selectedPlaceId || '')) controller.selectPlace(next.orderedPlaceIds[0]);
  };
  const copyPlan = async () => {
    if (!state.activePlan) return;
    const text = planSummary(state.activePlan, catalog);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.left = '-9999px'; document.body.append(field); field.select();
        const copied = document.execCommand('copy'); field.remove(); if (!copied) throw new Error('Clipboard unavailable');
      }
      setCopyStatus('当前版本的路线摘要已复制。');
    } catch { setCopyStatus('未能访问剪贴板。请选中路线文字手动复制。'); }
  };
  const reset = () => {
    controller.reset(); setTaskId('coast'); setIdea(''); setIdeaPending(false); setIdeaFeedback(null); setReviewAttempted(false); setReviewIssues([]); setDetailsOpen(false); setPlaying(false); setPlaybackIndex(null); setCopyStatus(''); setMobilePanel('conditions');
  };

  const sceneProps = {
    catalog, plan: displayPlan, previousPlan: state.proposal && comparisonView === 'candidate' ? state.activePlan : null,
    selectedPlaceId: state.selectedPlaceId, onSelectPlace: selectPlace, reducedMotion, playbackIndex,
  };

  return <div className="experience-page" ref={root}>
    <section className="experience-intro exp-container">
      <div className="exp-breadcrumb"><Link to="/">问途 AskWay</Link><span>/</span><span>城市旅程实验室</span></div>
      <div className="experience-title-row"><div><span className="exp-kicker"><span/>A JOURNEY, THOUGHT THROUGH</span><h1>把想法，<span>织成一段旅程。</span></h1></div><div className="experience-intro-note"><Compass size={25} strokeWidth={1.3} aria-hidden="true"/><p>先看清条件与依据。<br/>每一次调整，由你决定。</p></div></div>
      <div className="experience-meta"><span className="exp-mode" data-mode><i/>受控资料演示</span><span>珠海 · {catalog.places.length} 个公开参考点</span><span>资料查询 {catalog.asOf}</span><span>外观与公共区域 · 非实时导航</span></div>
      <noscript>本页仍可阅读资料范围和产品说明。条件生成与三维操作需要启用 JavaScript；也可使用页脚导航继续了解产品与合作。</noscript>
    </section>

    <section className="exp-container experience-entry" aria-label="选择旅程任务">
      <div className="exp-entry-heading"><span>从一个想法开始</span><small>选择模板后，每项条件都可以修改。</small></div>
      <div className="exp-task-grid">{tasks.map((task, index) => <button key={task.id} type="button" data-task={task.id} aria-pressed={taskId === task.id} onClick={() => chooseTask(task.id)} className={'exp-task ' + (taskId === task.id ? 'is-active' : '')}><span className="task-index">0{index + 1}</span><span className="task-copy"><strong>{task.name}</strong><span>{task.description}</span><small>{task.note}</small></span><ArrowUpRight size={20} strokeWidth={1.4} aria-hidden="true"/></button>)}</div>
    </section>

    <div className="exp-container">
      <div className="exp-workflow" role="group" aria-label="旅程决策进度"><span className="workflow-current"><b>01</b>表达与核对</span><i aria-hidden="true"/><span className={displayPlan ? 'workflow-current' : ''}><b>02</b>生成与比较</span><i aria-hidden="true"/><span className={state.activePlan ? 'workflow-current' : ''}><b>03</b>确认与回看</span><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true"/>重新开始</button></div>
      <div className="mobile-panel-nav" role="group" aria-label="工作台区域">{([['conditions', '条件'], ['map', '地图'], ['plan', '路线']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)}>{id === 'conditions' ? <Layers size={16} aria-hidden="true"/> : id === 'map' ? <Map size={16} aria-hidden="true"/> : <MapPin size={16} aria-hidden="true"/>}{label}</button>)}</div>

      <div className="experience-workspace" data-mobile-panel={mobilePanel}>
        <section className="exp-conditions-panel exp-panel" data-conditions-panel aria-label="表达与核对条件">
          <div className="exp-panel-heading"><div><span className="exp-panel-step">01 / YOUR THOUGHTS</span><h2>想怎样走过这一天？</h2></div><MessageCircle size={20} strokeWidth={1.5} aria-hidden="true"/></div>
          <div className="exp-idea"><label htmlFor="experience-idea">说说你的想法</label><textarea id="experience-idea" rows={3} maxLength={500} placeholder="下午有三个小时，想去日月贝，走得轻松一点。" value={idea} onChange={event => { setIdea(event.target.value); setIdeaPending(!!event.target.value.trim()); setIdeaFeedback(null); }}/><div><small>规则解析，支持时长、地点与节奏。</small><button type="button" onClick={applyIdea} disabled={!idea.trim()}><Sparkles size={14} aria-hidden="true"/>应用这段想法</button></div></div>
          {ideaPending && <div className="idea-feedback needs-application" role="status"><p>这段想法尚未应用。应用后再核对，或明确按表单条件继续。</p><button type="button" onClick={() => { setIdeaPending(false); setIdeaFeedback(null); setIdea(''); }}>只按表单条件继续</button></div>}
          {ideaFeedback && <div className={'idea-feedback ' + (hasClarifications ? 'needs-clarification' : '')} data-idea-feedback role="status">{hasClarifications && <strong>这段想法需要澄清</strong>}{ideaFeedback.recognized.length > 0 && <p>已回显：{ideaFeedback.recognized.join('；')}</p>}{ideaFeedback.clarifications.map(text => <p key={text}>{text}</p>)}{hasClarifications && <button type="button" onClick={() => { setIdeaFeedback(null); setIdeaPending(false); setIdea(''); }}>按下面已明确的条件继续</button>}</div>}
          <form className="exp-condition-form" onSubmit={event => { event.preventDefault(); review(); }}>
            <div className="exp-form-divider"><span>或，直接调整条件</span></div>
            <div className="exp-field-pair"><label>演示日期<input type="date" aria-label="演示日期" value={state.draft.date} onChange={event => edit({ date: event.target.value })}/></label><label>出发时刻<input type="time" aria-label="出发时刻" value={state.draft.startTime} onChange={event => edit({ startTime: event.target.value })}/></label></div>
            <label htmlFor="experience-time">可用时间</label><select id="experience-time" value={state.draft.timeLimitMinutes} onChange={event => edit({ timeLimitMinutes: Number(event.target.value) })}>{![60, 90, 120, 150, 180, 240, 300, 360, 480].includes(state.draft.timeLimitMinutes) && <option value={state.draft.timeLimitMinutes}>{state.draft.timeLimitMinutes} 分钟 · 自定义时长</option>}{[60, 90, 120, 150, 180, 240, 300, 360, 480].map(minutes => <option key={minutes} value={minutes}>{minutes} 分钟 · {minutes / 60} 小时</option>)}</select>
            <fieldset className="exp-pace"><legend>旅行节奏</legend><div>{(Object.entries(paceLabels) as [Pace, string][]).map(([pace, label]) => <button key={pace} type="button" aria-pressed={state.draft.pace === pace} onClick={() => edit({ pace })}>{label}</button>)}</div></fieldset>
            <div className="exp-field-pair"><label>参考起点<select aria-label="参考起点" value={state.draft.originPlaceId} onChange={event => edit({ originPlaceId: event.target.value })}>{catalog.places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>交通偏好<select aria-label="交通偏好" value={state.draft.transport} onChange={event => edit({ transport: event.target.value as 'walk' | 'mixed' })}><option value="mixed">步行与换乘</option><option value="walk">以步行为主</option></select></label></div>
            <fieldset className="exp-place-choices"><legend>一定要去 <small>硬条件</small></legend><div>{catalog.places.map(place => <label key={place.id}><input type="checkbox" aria-label={'必去：' + place.name} checked={state.draft.mandatoryPlaceIds.includes(place.id)} onChange={() => togglePlace('mandatoryPlaceIds', place.id)}/><span>{place.name}</span></label>)}</div></fieldset>
            <details className="exp-avoid"><summary>有没有想避开的地方？<ChevronRight size={15} aria-hidden="true"/></summary><fieldset className="exp-place-choices"><legend className="sr-only">避开地点</legend><div>{catalog.places.map(place => <label key={place.id}><input type="checkbox" aria-label={'避开：' + place.name} checked={state.draft.excludedPlaceIds.includes(place.id)} onChange={() => togglePlace('excludedPlaceIds', place.id)}/><span>{place.name}</span></label>)}</div></fieldset></details>
            <label className="exp-scenario"><input type="checkbox" checked={state.draft.scenario === 'less-walking'} onChange={event => edit({ scenario: event.target.checked ? 'less-walking' : 'none' })}/><span><Footprints size={17} aria-hidden="true"/><strong>预演：减少步行</strong><small>手动情境，增加休息与接驳余量。</small></span></label>
            <ConstraintWeave draft={state.draft} catalog={catalog} confirmed={conditionsConfirmed}/>
            <p className="draft-status" data-draft-status>{conditionsConfirmed ? <><Check size={14} aria-hidden="true"/>草稿 #{state.draftRevision} 已确认，可生成候选</> : <><Info size={14} aria-hidden="true"/>草稿 #{state.draftRevision} 尚未确认{state.activePlan ? '，当前版本仍独立保留' : ''}</>}</p>
            {issues.length > 0 && <div className="exp-issue-summary" ref={errorSummary} tabIndex={-1} data-conflict role="alert"><strong>这组条件需要调整</strong>{issues.map((issue, index) => <p key={issue.code + index}>{issue.message}{issue.suggestion && <small>{issue.suggestion}</small>}</p>)}</div>}
            <div className="exp-condition-actions"><button type="submit" className="exp-button exp-button-secondary" disabled={!!state.pending || hasClarifications || ideaPending}><ShieldCheck size={16} aria-hidden="true"/>核对并确认条件</button><button type="button" className="exp-button exp-button-primary" ref={generateButton} onClick={generate} disabled={!controller.canGenerate || hasClarifications || ideaPending}>{state.pending ? '正在生成候选' : '生成旅程候选'}<ArrowRight size={16} aria-hidden="true"/></button>{state.pending && <button type="button" className="exp-cancel" onClick={controller.cancel}>取消生成</button>}</div>
          </form>
        </section>

        <section className="exp-map-panel" data-map-panel aria-label="查看城市路线">
          <div className="exp-panel-heading exp-map-heading"><div><span className="exp-panel-step">02 / SEE THE CONNECTIONS</span><h2>{displayPlan ? '看见地点之间的关系。' : '一座城市，许多可能。'}</h2></div><span className="map-city-tag">ZHUHAI</span></div>
          <div className="exp-map-stage" ref={mapRegion} onPointerDownCapture={() => setPlaying(false)} onClickCapture={() => setPlaying(false)}>
            <div className="exp-map-toolbar"><span>{state.proposal && comparisonView === 'candidate' ? '候选 B · 待采用' : state.activePlan ? `当前版本 V${state.activePlan.versionNo}` : '公开候选点'}</span><div className="exp-view-switch"><button type="button" aria-pressed={state.view === '2d'} onClick={() => controller.setView('2d')}><Map size={14} aria-hidden="true"/>二维地图</button>{experienceConfig.scene3d && <button type="button" aria-pressed={state.view === '3d'} onClick={() => controller.setView('3d')}><Layers size={14} aria-hidden="true"/>三维沙盘</button>}</div></div>
            {state.view === '3d' ? <ClientScene {...sceneProps} onFallback={() => controller.setView('2d')}/> : <RouteMap2D {...sceneProps}/>}
            <div className="exp-map-footer"><span>位置参考 · 图形示意 · 入口未核实</span><span>列表、地图与沙盘共享同一方案</span></div>
          </div>
          <div className="exp-selected-place"><div><span className="exp-selected-kicker">{state.selectedPlaceId ? "SELECTED PLACE" : "REFERENCE ORIGIN"}</span><strong>{selectedPlace.name}</strong><small>{displayPlan ? '选点只影响视图，方案保持不变。' : '先了解地点，或在左侧把它加入条件。'}</small></div><button type="button" onClick={() => setDetailsOpen(open => !open)}><CircleHelp size={16} aria-hidden="true"/>{detailsOpen ? '收起地点依据' : '查看地点依据'}<ArrowUpRight size={14} aria-hidden="true"/></button></div>
          <div className="exp-playback"><div><button type="button" onClick={preview} disabled={!displayPlan}><Play size={15} aria-hidden="true"/>预演路线</button><button type="button" aria-label="上一站" onClick={() => stepPreview(-1)} disabled={!displayPlan || playbackIndex === null}><ChevronLeft size={18} aria-hidden="true"/></button><button type="button" aria-label="下一站" onClick={() => stepPreview(1)} disabled={!displayPlan || playbackIndex === null}><ChevronRight size={18} aria-hidden="true"/></button>{playing && <button type="button" onClick={() => setPlaying(false)}><Pause size={15} aria-hidden="true"/>暂停</button>}</div><span data-playback-status role="status">{playbackIndex !== null && displayPlan ? `第 ${playbackIndex + 1} 站 / ${displayPlan.orderedPlaceIds.length} · ${placeName(catalog, displayPlan.orderedPlaceIds[playbackIndex])}${playing ? '' : ' · 已暂停'}` : reducedMotion ? '减弱动画已开启，可逐站查看' : '按自己的节奏，看一遍路线'}</span></div>
          {detailsOpen && <><MapLandmarkPreview place={selectedPlace}/><PlaceDetails place={selectedPlace} catalog={catalog} onClose={() => setDetailsOpen(false)}/></>}
          <div className="exp-map-note"><Info size={16} aria-hidden="true"/><p>地图与沙盘使用同一份参考坐标和方案。线路为连接关系示意，交通时间按公开的演示策略估算；道路、入口和现场状况仍需核实。</p></div>
        </section>

        <section className="exp-plan-panel exp-panel" data-plan-panel aria-label="旅程方案与版本比较" aria-busy={!!state.pending}>
          <div className="exp-panel-heading"><div><span className="exp-panel-step">03 / YOUR DECISION</span><h2>{displayPlan ? '让每一次取舍，都清楚。' : '旅程，从条件开始。'}</h2></div><Compass size={20} strokeWidth={1.4} aria-hidden="true"/></div>
          {state.activePlan && <div className="exp-active-snapshot" data-active-plan><span><Check size={14} aria-hidden="true"/>当前版本 V{state.activePlan.versionNo}</span><strong>{describeConditions(state.activePlan.conditions)}</strong><small>{state.activePlan.conditions.date} · {state.activePlan.conditions.startTime} 出发</small><small data-active-route>{state.activePlan.orderedPlaceIds.map(id => placeName(catalog, id)).join(' → ')}</small></div>}
          {state.proposal && <div className="exp-candidate-heading" data-proposal><span className="candidate-status">待采用候选{state.activePlan ? ' B' : ''}</span><span>{state.proposal.candidate.orderedPlaceIds.length} 站 · 条件 #{state.proposal.draftRevision}</span></div>}
          {state.proposal && state.activePlan && state.proposal.delta && <PlanComparison before={state.activePlan} after={state.proposal.candidate} delta={state.proposal.delta} catalog={catalog} visible={comparisonView} onView={changeComparison}/>}
          {displayPlan ? <><PlanTimeline plan={displayPlan} catalog={catalog} selectedPlaceId={state.selectedPlaceId} onSelectPlace={selectPlace}/><div className="exp-plan-explanations"><h3>为什么这样安排？</h3>{displayPlan.explanations.map((text, index) => <p key={index}><span aria-hidden="true">0{index + 1}</span>{text}</p>)}</div></> : <div className="exp-plan-empty"><div className="empty-paper" aria-hidden="true"><MapPin size={29} strokeWidth={1}/><span/><span/></div><h3>一份安排，<br/>从认真听你说开始。</h3><p>选一个任务，调整时间与必去点。<br/>核对条件后，再生成候选。</p><button type="button" onClick={() => { setMobilePanel('conditions'); requestAnimationFrame(() => document.getElementById('experience-idea')?.focus()); }}>回到条件<ArrowRight size={15} aria-hidden="true"/></button><div className="empty-flow"><span>表达</span><i/><span>核对</span><i/><span>生成</span><i/><span>你来确认</span></div></div>}
          {state.proposal && <div className="exp-adopt-action"><button type="button" className="exp-button exp-button-primary" disabled={!controller.canAdopt || hasClarifications || ideaPending} onClick={() => { setPlaying(false); controller.adopt(); }}><Check size={17} aria-hidden="true"/>采用这份候选</button><p>{!controller.canAdopt ? '候选已过期或条件已改变，请重新生成；当前版本会保留。' : hasClarifications || ideaPending ? '先应用或澄清这段想法，再决定采用。' : `你的明确确认，才会形成${state.activePlan ? '新' : '当前'}版本。`}</p><button type="button" className="exp-discard" onClick={() => { setPlaying(false); controller.cancel(); }}>放弃这份候选</button></div>}
          {state.previousPlan && !state.proposal && <button type="button" className="exp-undo" onClick={() => { setPlaying(false); controller.undo(); }}><RotateCcw size={15} aria-hidden="true"/>撤销本次采用<small>返回 V{state.previousPlan.versionNo}</small></button>}
          {state.activePlan && <div className="exp-share"><button type="button" onClick={copyPlan}><Copy size={15} aria-hidden="true"/>复制当前路线摘要</button><p role="status">{copyStatus}</p></div>}
          {(state.message || state.status === 'planning' || state.status === 'failed') && <p className="exp-state-message" role="status">{state.message || (state.status === 'planning' ? '正在根据本地公开资料与已确认条件计算候选。' : '本次生成失败，输入与当前版本已保留。')}</p>}
        </section>
      </div>
    </div>

    <section className="exp-container experience-boundaries" id="estimate-method"><div><ShieldCheck size={23} strokeWidth={1.3} aria-hidden="true"/><h2>相信一段旅程，<br/>先看清它的依据。</h2><p>这里演示的是表达、核对和调整的过程。<br/>真实出游，还需要现场与实时资料。</p></div><dl><div><dt>我们如何估算？</dt><dd>使用 WGS84 参考点间的距离、交通偏好、停留建议与明确缓冲策略。每一路段单独计算，示意线不代表实际道路。</dd></div><div><dt>哪些还需要核实？</dt><dd>入口、当日开放、费用、无障碍与交通状况。未知信息逐项保留，不计算为免费或全天开放。</dd></div><div><dt>下一步是什么？</dt><dd>你可以了解产品与合作方向。真实服务试用和公开软件下载有独立的启用条件。<Link to="/product/#download">查看软件获取状态 <ArrowUpRight size={13} aria-hidden="true"/></Link></dd></div></dl></section>
    <div className="exp-container experience-source-line"><span>© OpenStreetMap contributors · ODbL 1.0 · 资料版本 {catalog.version}</span><a href={import.meta.env.BASE_URL + 'data/catalog.json'} target="_blank" rel="noreferrer">公开资料清单 <ArrowUpRight size={13} aria-hidden="true"/></a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">来源与许可 <ArrowUpRight size={13} aria-hidden="true"/></a></div>
  </div>;
}
