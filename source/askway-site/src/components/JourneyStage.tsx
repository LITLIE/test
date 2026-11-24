import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, MapPin, Play, Route, Sparkles } from 'lucide-react';
import RouteArt from './RouteArt';
import { Eyebrow } from './Shared';
import { stepFromProgress } from '../lib/journey.mjs';
export const journeySteps=[
  {title:'说出想法',english:'A CONVERSATION',description:'想去哪里，想怎样度过一天？先从一次自然的商讨开始，让偏好有被认真理解的空间。'},
  {title:'让安排可行',english:'A CLEAR PLAN',description:'把时间、必去点与出游条件放在一起考虑。可行性有依据，发生冲突时，也有清楚的解释。'},
  {title:'看懂每次调整',english:'A BETTER CHOICE',description:'当想法改变，可以比较方案、看懂取舍，再决定是否采用。你的选择始终由你确认。'},
  {title:'带上这段旅程',english:'A JOURNEY TO GO',description:'将已保存的安排带到手机，衔接路线、执行进度与到点讲解。从规划，走向现场。'},
];
function Screen({active}:{active:number}){
  return <div className={'journey-screen stage-state-'+active}>
    <div className="screen-top"><span className="screen-dots"><i/><i/><i/></span><span>问途 · 城市探索</span><span className="screen-live">流程示意</span></div>
    <div className="screen-body">
      {active===0 && <div className="conversation-view"><div className="screen-label"><Sparkles size={16} aria-hidden="true"/>一次旅程，从你的想法开始</div><div className="chat-question">想在珠海走走。<br/>喜欢海边，也想看看日月贝，<br/>下午轻松一点。</div><div className="chat-answer">海边、日月贝、轻松一点。<br/>我们先把重要的条件记下来。</div><div className="condition-pills"><span>珠海</span><span>海岸漫游</span><span>日月贝 · 必去</span></div><div className="screen-bottom-hint">保留已确认的条件，继续商讨<ArrowRight size={16}/></div></div>}
      {active===1 && <div className="plan-view"><RouteArt active={1}/><div className="plan-receipt"><Route size={16} aria-hidden="true"/><div><strong>一条清晰的城市路线</strong><span>把偏好与可用时间，一起纳入安排</span></div><Check size={16} aria-hidden="true"/></div><div className="validation-label"><Check size={13}/>条件确认 <span>·</span><Check size={13}/>独立校验</div></div>}
      {active===2 && <div className="compare-view"><div className="screen-label">让每一次变化，都看得明白</div><div className="compare-card"><span>原有安排</span><h4>沿海岸，发现更多</h4><p>海滨公园 → 香炉湾 → 日月贝</p></div><div className="compare-arrow"><ArrowRight size={20}/><span>比较调整</span></div><div className="compare-card proposed"><span>另一种选择</span><h4>放慢一点，留更多余量</h4><p>香炉湾 → 日月贝</p><div className="compare-tag"><Check size={13}/>保留必去点</div></div></div>}
      {active===3 && <div className="execution-view"><div className="phone-shell"><div className="phone-notch"/><div className="phone-top">这一天，慢慢探索<span>珠海 · 已保存的安排</span></div><div className="phone-map"><RouteArt active={2}/></div><div className="phone-stop"><span>01</span><div><strong>香炉湾</strong><small>海风、沙滩与一段漫步</small></div><Check size={15}/></div><div className="phone-stop"><span>02</span><div><strong>日月贝</strong><small>下一站，城市与海的相遇</small></div><MapPin size={15}/></div><div className="phone-audio"><span className="audio-play"><Play size={13} fill="currentColor"/></span><div><strong>听见城市的故事</strong><span className="audio-bars"><i/><i/><i/><i/><i/><i/><i/></span></div><small>讲解示意</small></div></div><div className="execution-note"><Check size={15}/>同一份安排，连贯的体验</div></div>}
    </div>
  </div>;
}
export default function JourneyStage({compact=false}:{compact?:boolean}){
  const [active,setActive]=useState(0),sectionRef=useRef<HTMLElement>(null),manualY=useRef<number|null>(null),tabsRef=useRef<HTMLDivElement>(null);
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
      return()=>instance.kill();
      });
      dispose=()=>media.revert();
    });
    return()=>{dead=true;dispose?.();};
  },[compact]);
  const select=(i:number)=>{manualY.current=window.scrollY;setActive(i);};
  const keyboard=(event:React.KeyboardEvent<HTMLButtonElement>,i:number)=>{
    const target=event.key==='End'?3:event.key==='Home'?0:event.key==='ArrowRight'?(i+1)%4:event.key==='ArrowLeft'?(i+3)%4:null;
    if(target===null)return;
    event.preventDefault();select(target);tabsRef.current?.querySelectorAll<HTMLButtonElement>('button')[target]?.focus();
  };
  return <section className={'journey-section '+(compact?'journey-compact':'')} ref={sectionRef} id="journey">
    <div className="container"><div className="journey-heading" data-reveal><Eyebrow number="02">FROM AN IDEA TO A JOURNEY</Eyebrow><h2>一段旅程，<br/>从被理解开始。</h2><p>商讨、规划、调整、执行。<br/>把每一步，连成一条清晰的线。</p></div>
    <div className="journey-layout"><div className="journey-sticky">
      <Screen active={active}/>
      <div className="stage-tabs" role="tablist" aria-label="产品演示阶段" ref={tabsRef}>{journeySteps.map((step,i)=><button key={i} id={'stage-tab-'+i} type="button" role="tab" tabIndex={active===i?0:-1} aria-selected={active===i} aria-controls="stage-description" onKeyDown={event=>keyboard(event,i)} onClick={()=>select(i)}><span>0{i+1}</span>{step.title}</button>)}</div>
      <div className="stage-caption" id="stage-description" role="tabpanel" aria-labelledby={'stage-tab-'+active} aria-live="polite">{journeySteps[active].description}</div>
    </div><div className="journey-chapters">{journeySteps.map((step,i)=><div className={'journey-chapter '+(active===i?'chapter-active':'')} key={i} id={'journey-step-'+i}><span className="chapter-index">0{i+1}</span><div><span className="chapter-english">{step.english}</span><h3>{step.title}</h3><p>{step.description}</p></div></div>)}</div></div></div>
  </section>;
}
