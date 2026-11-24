import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, MapPin, Route, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import RouteArt from './RouteArt';
import CityIllustration, { cityIllustrationSource } from './CityIllustrations';
import type { CityIllustrationKind, CityIllustrationSource } from './CityIllustrations';
import { Eyebrow } from './Shared';
import { stepFromProgress } from '../lib/journey.mjs';
export const journeySteps=[
  {title:'说出想法',english:'A CONVERSATION',description:'想去哪里，想怎样度过一天？先从一次自然的商讨开始，让偏好有被认真理解的空间。'},
  {title:'让安排可行',english:'A CLEAR PLAN',description:'把时间、必去点与出游条件放在一起考虑。可行性有依据，发生冲突时，也有清楚的解释。'},
  {title:'看懂每次调整',english:'A BETTER CHOICE',description:'当想法改变，可以比较方案、看懂取舍，再决定是否采用。你的选择始终由你确认。'},
  {title:'带上这段旅程',english:'A JOURNEY TO GO',description:'展示完整产品的跨端衔接与现场体验概念。本官网在当前会话中核对和比较方案；手机保存、导航与到点讲解需要另行接入并验证。'},
];
function Screen({active}:{active:number}){
  return <div className={'journey-screen stage-state-'+active}>
    <div className="screen-top"><span className="screen-dots" aria-hidden="true"><i/><i/><i/></span><span>问途 · 产品概念</span><span className="screen-live">受控示意</span></div>
    <div className="screen-body">
      {active===0 && <div className="conversation-view"><div className="screen-label"><Sparkles size={16} aria-hidden="true"/>一次旅程，从你的想法开始</div><div className="chat-question">想在珠海走走。<br/>喜欢海边，也想看看日月贝，<br/>下午轻松一点。</div><div className="chat-answer">海边、日月贝、轻松一点。<br/>先把重要的条件记下来。</div><div className="condition-pills"><span>珠海</span><span>海岸漫游</span><span>日月贝 · 必去</span></div><div className="screen-bottom-hint">条件表达概念<ArrowRight size={16} aria-hidden="true"/></div></div>}
      {active===1 && <div className="plan-view"><RouteArt active={1}/><div className="plan-receipt"><Route size={16} aria-hidden="true"/><div><strong>一条城市路线的形成思路</strong><span>把偏好与可用时间，一起纳入安排</span></div></div><div className="validation-label"><Check size={16} aria-hidden="true"/>条件核对与规则校验 · 概念示意</div></div>}
      {active===2 && <div className="compare-view"><div className="screen-label">让每一次变化，都看得明白</div><div className="compare-card"><span>原有概念安排</span><h4>沿海岸，发现更多</h4><p>海滨公园 → 香炉湾 → 日月贝</p></div><div className="compare-arrow"><ArrowRight size={20} aria-hidden="true"/><span>比较思路示意</span></div><div className="compare-card proposed"><span>另一种概念选择</span><h4>放慢一点，留更多余量</h4><p>香炉湾 → 日月贝</p><div className="compare-tag"><Check size={16} aria-hidden="true"/>重要条件，仍然保留</div></div></div>}
      {active===3 && <div className="execution-view"><div className="phone-shell"><div className="phone-notch" aria-hidden="true"/><div className="phone-top">这一天，慢慢探索<span>珠海 · 跨端衔接示意</span></div><div className="phone-map"><RouteArt active={2} included={[1,2]} decorative/></div><div className="phone-stop"><span>01</span><div><strong>香炉湾</strong><small>海风与一段漫步</small></div><Check size={16} aria-hidden="true"/></div><div className="phone-stop"><span>02</span><div><strong>日月贝</strong><small>城市与海的相遇</small></div><MapPin size={16} aria-hidden="true"/></div><div className="phone-audio"><MapPin size={18} aria-hidden="true"/><div><strong>现场体验的产品方向</strong><small>保存与讲解功能概念</small></div></div></div><div className="execution-note">从规划走向现场，逐步接入与核实。</div></div>}
    </div>
  </div>;
}
export default function JourneyStage({compact=false}:{compact?:boolean}){
  const [active,setActive]=useState(0),sectionRef=useRef<HTMLElement>(null),manualY=useRef<number|null>(null),tabsRef=useRef<HTMLDivElement>(null);
  const [imageSources,setImageSources]=useState<Partial<Record<CityIllustrationKind,CityIllustrationSource>>>({});
  const observeSource=useCallback((source:CityIllustrationSource)=>{
    setImageSources(previous=>previous[source.kind]?.src===source.src?previous:{...previous,[source.kind]:source});
  },[]);
  useEffect(()=>{
    let dead=false,dispose:(()=>void)|undefined;
    if(compact)return;
    Promise.all([import('gsap'),import('gsap/ScrollTrigger')]).then(([{gsap},{ScrollTrigger}])=>{
      if(dead || !sectionRef.current)return;
      gsap.registerPlugin(ScrollTrigger);
      const media=gsap.matchMedia();
      const allowed=window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');
      media.add(allowed.media,()=>{
      manualY.current=null;
      const instance=ScrollTrigger.create({trigger:sectionRef.current,start:'top 25%',end:'bottom 65%',onUpdate:self=>{
        if(dead || !allowed.matches)return;
        if(manualY.current!==null && Math.abs(window.scrollY-manualY.current)<40)return;
        manualY.current=null;setActive(stepFromProgress(self.progress));
      }});
      setActive(stepFromProgress(instance.progress));
      let refreshFrame:number|null=null;
      const refreshLayout=()=>{
        if(dead || !allowed.matches)return;
        if(refreshFrame!==null)cancelAnimationFrame(refreshFrame);
        refreshFrame=requestAnimationFrame(()=>{
          refreshFrame=null;
          if(dead || !allowed.matches)return;
          instance.refresh();instance.update();
          if(manualY.current===null || Math.abs(window.scrollY-manualY.current)>=40){
            manualY.current=null;setActive(stepFromProgress(instance.progress));
          }
        });
      };
      // Responsive content above the story can settle after the media callback.
      // Watching main catches position changes even when the story's own size is unchanged.
      const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(refreshLayout);
      observer?.observe(sectionRef.current!);
      if(sectionRef.current?.parentElement)observer?.observe(sectionRef.current.parentElement);
      window.addEventListener('resize',refreshLayout);
      return()=>{observer?.disconnect();window.removeEventListener('resize',refreshLayout);if(refreshFrame!==null)cancelAnimationFrame(refreshFrame);instance.kill();};
      });
      dispose=()=>media.revert();
    }).catch(()=>{dispose?.();});
    return()=>{dead=true;dispose?.();};
  },[compact]);
  const select=(i:number)=>{manualY.current=window.scrollY;setActive(i);};
  const keyboard=(event:React.KeyboardEvent<HTMLButtonElement>,i:number)=>{
    const target=event.key==='End'?3:event.key==='Home'?0:event.key==='ArrowRight'?(i+1)%4:event.key==='ArrowLeft'?(i+3)%4:null;
    if(target===null)return;
    event.preventDefault();select(target);tabsRef.current?.querySelectorAll<HTMLButtonElement>('button')[target]?.focus();
  };
  const illustrationKinds:CityIllustrationKind[]=['coast','landmarks','landmarks','theatre'];
  const cityCaptions=['从一阵海风，开始这一天。','让地点，在城市里相遇。','换一种安排，仍有风景。','带着期待，走向城市。'];
  const ribbonKind=illustrationKinds[active],ribbonSource=imageSources[ribbonKind]??cityIllustrationSource(ribbonKind);
  return <section className={'journey-section '+(compact?'journey-compact':'')} ref={sectionRef} id="journey" aria-describedby="journey-concept-note">
    <div className="container"><div className="journey-heading" data-reveal><Eyebrow number="02">FROM AN IDEA TO A JOURNEY</Eyebrow><h2>一段旅程，<br/>从被理解开始。</h2><p>商讨、规划、调整、执行。<br/>把每一步，连成一条清晰的线。</p></div>
    <p className="journey-concept-note" id="journey-concept-note">以下四阶段为受控产品概念，展示规划到现场的设计思路。可操作的条件核对与版本比较，请进入旅程体验。</p>
    <div className="journey-layout"><div className="journey-sticky">
      <div className="journey-city-ribbon"><CityIllustration kind={ribbonKind} caption={false} decorative onSourceChange={observeSource}/><div><span>{cityCaptions[active]}</span><small>{ribbonSource.label}</small></div></div>
      <Screen active={active}/>
      <div className="stage-tabs" role="tablist" aria-label="产品演示阶段" ref={tabsRef}>{journeySteps.map((step,i)=><button key={i} id={'stage-tab-'+i} type="button" role="tab" tabIndex={active===i?0:-1} aria-selected={active===i} aria-controls="stage-description" onKeyDown={event=>keyboard(event,i)} onClick={()=>select(i)}><span>0{i+1}</span>{step.title}</button>)}</div>
      <div className="stage-caption" id="stage-description" role="tabpanel" aria-labelledby={'stage-tab-'+active} aria-live="polite">{journeySteps[active].description}</div>
      <Link to="/experience/" className="journey-experience-link">亲自核对一段旅程<ArrowRight size={18} aria-hidden="true"/></Link>
    </div><div className="journey-chapters">{journeySteps.map((step,i)=><div className={'journey-chapter '+(active===i?'chapter-active':'')} key={i} id={'journey-step-'+i}><span className="chapter-index">0{i+1}</span><div><span className="chapter-english">{step.english}</span><h3>{step.title}</h3><p>{step.description}</p></div></div>)}</div></div></div>
  </section>;
}
