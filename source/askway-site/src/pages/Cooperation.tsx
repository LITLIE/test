import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, Check, Copy, Mail, ArrowRight } from 'lucide-react';
import { cooperationLabels, createPartnershipBrief } from '../lib/brief.mjs';
import { site } from '../site';
import { Eyebrow } from '../components/Shared';
import '../styles/editorial-pages.css';
export default function Cooperation(){
  const location=useLocation();
  const [organization,setOrganization]=useState(''),[contact,setContact]=useState(''),[focus,setFocus]=useState('destination'),[details,setDetails]=useState('');
  const [result,setResult]=useState<ReturnType<typeof createPartnershipBrief>|null>(null),[copyState,setCopyState]=useState('');
  const formRef=useRef<HTMLFormElement>(null),resultRef=useRef<HTMLTextAreaElement>(null);
  const chooseFocus=(value:string)=>{setFocus(value);setResult(null);setCopyState('');};
  useEffect(()=>{const candidate=new URLSearchParams(location.search).get('focus');if(candidate && Object.hasOwn(cooperationLabels,candidate))chooseFocus(candidate);},[location.search]);
  const errors=result?.ok===false ? result.errors as Record<string,string> : {};
  const generate=()=>{
    const next=createPartnershipBrief({organization,contact,focus,details});
    setResult(next);setCopyState('');
    if(!next.ok)requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };
  const copy=async()=>{
    if(!result?.ok)return;
    const fallback=()=>{
      const previous=document.activeElement as HTMLElement|null;
      resultRef.current?.focus();resultRef.current?.select();
      let copied=false;
      try{copied=document.execCommand('copy');}catch{copied=false;}
      setCopyState(copied?'合作意向已复制。':'请选中下方内容复制。');
      if(copied)previous?.focus();
    };
    try{
      if(!navigator.clipboard?.writeText){fallback();return;}
      await navigator.clipboard.writeText(result.text);setCopyState('合作意向已复制。');
    }catch{fallback();}
  };
  return <div className="editorial-page editorial-cooperation cinematic-page"><section className="page-hero cooperation-hero cooperation-editorial-hero container"><div><Eyebrow>THE NEXT WAY / 一起探索</Eyebrow><h1>让城市的更多可能，<br/>在一段旅程里相遇。</h1></div><div className="cooperation-hero-aside"><span className="cooperation-hero-note">一个场景。<br/>一次认真开始的合作。</span><p>让内容、服务与真实的游览体验衔接。从一个具体问题开始，一起寻找更连贯的连接。</p><a className="text-link" href="#contact"><span>开启合作对话</span><ArrowUpRight size={18} aria-hidden="true"/></a></div><nav className="cinematic-page-index cooperation-page-index" aria-label="合作页内目录"><a href="#directions"><span className="page-index-number">01</span><span>合作方向</span><ArrowUpRight size={16} aria-hidden="true"/></a><a href="#cooperation-process"><span className="page-index-number">02</span><span>推进方式</span><ArrowUpRight size={16} aria-hidden="true"/></a><a href="#contact"><span className="page-index-number">03</span><span>整理合作意向</span><ArrowUpRight size={16} aria-hidden="true"/></a></nav></section>
    <section className="cooperation-directions container" id="directions"><div className="section-head"><Eyebrow>THREE WAYS TO BEGIN</Eyebrow><h2>先从一个场景，<br/>认真地开始。</h2></div>{[
      {id:'content',number:'01',title:'城市内容共建',english:'STORIES OF A CITY',for:'城市内容团队 · 景区与文旅机构',text:'把真实的景点内容、地方故事和讲解，衔接到一段可被体验的旅程中。共同核实内容、完善表达，探索更自然的城市叙事。',points:['自有景点与讲解内容','来源核实与内容授权','旅程中的内容体验']},
      {id:'destination',number:'02',title:'城市体验试点',english:'A PLACE TO BEGIN',for:'景区 · 文旅机构 · 场景研究团队',text:'从一个片区、一类游客或一条路线出发。共同确定有限的试点，观察规划与现场执行中的实际体验，逐步验证与改进。',points:['明确的场景与试点范围','路线与现场信息核实','体验观察与共同复盘']},
      {id:'hospitality',number:'03',title:'目的地服务衔接',english:'CONNECT THE EXPERIENCE',for:'酒店 · 目的地服务方',text:'探索住宿与城市出游之间的连接。从真实的出发场景与服务需求出发，讨论如何让内容、行程和目的地服务更连贯。',points:['从住宿出发的游览场景','在地内容与服务需求','可讨论的体验衔接方式']},
    ].map(item=><article className="cooperation-direction" key={item.id} data-light-sweep=""><span className="direction-edge-light" aria-hidden="true"/><span className="direction-number">{item.number}</span><div className="direction-title"><span className="direction-english">{item.english}</span><h3>{item.title}</h3><span className="direction-audience">{item.for}</span></div><div className="direction-description"><p>{item.text}</p><ul>{item.points.map(point=><li key={point}><Check size={14} aria-hidden="true"/>{point}</li>)}</ul></div><a href="#contact" className="text-link direction-link" onClick={()=>chooseFocus(item.id)}>聊聊这个方向<ArrowUpRight size={17} aria-hidden="true"/></a></article>)}</section>
    <section className="cooperation-process" id="cooperation-process"><div className="container"><Eyebrow>THOUGHTFUL, STEP BY STEP</Eyebrow><h2>把想法，<br/>变成可以共同推进的事。</h2><div className="process-grid">{['明确场景与目标','共同确定有限试点','内容与方案核实','体验验证与复盘'].map((item,i)=><div key={item}><span>0{i+1}</span><h3>{item}</h3>{i<3&&<ArrowRight size={18} aria-hidden="true"/>}</div>)}</div><p className="cooperation-scope">以上为可讨论的合作方向。具体范围、投入与交付安排，由双方在明确场景后共同确定。</p></div></section>
    <section className="contact-section container" id="contact"><div className="contact-intro"><Eyebrow>START A CONVERSATION</Eyebrow><h2>你的想法，<br/>是下一段旅程的起点。</h2><p>直接写信给我们，<br/>或用这几项问题，整理合作意向。</p><a className="contact-email" href={'mailto:'+site.email}><Mail size={21} strokeWidth={1.3} aria-hidden="true"/>{site.email}<ArrowUpRight size={18} aria-hidden="true"/></a><span className="contact-caption">这里的内容仅在当前页面整理，<br/>由你确认后，通过邮件发送。</span></div><form className="contact-form" ref={formRef} onChange={()=>{setResult(null);setCopyState('');}} onSubmit={event=>{event.preventDefault();generate();}} noValidate>
      <div className="contact-form-heading"><span>合作意向草稿</span><p>先整理，再确认。</p><small>填写带 * 的两项即可整理。内容由你核对后复制，或通过邮件发送。</small></div>
      <label htmlFor="organization">机构 / 团队名称 <span>*</span></label><input id="organization" value={organization} onChange={e=>setOrganization(e.target.value)} maxLength={60} required aria-invalid={!!errors.organization} aria-describedby={errors.organization?'organization-error':undefined} placeholder="我们来自哪里"/>{errors.organization&&<span id="organization-error" className="field-error">{errors.organization}</span>}
      <label htmlFor="focus">想先聊聊哪个方向？</label><select id="focus" value={focus} onChange={e=>setFocus(e.target.value)}>{Object.entries(cooperationLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="contact-info">联系方式 <small>选填</small></label><input id="contact-info" value={contact} onChange={e=>setContact(e.target.value)} maxLength={120} placeholder="联系人、邮箱或其他联系方式"/>
      <label htmlFor="details">希望共同探索的场景 <span>*</span></label><textarea id="details" rows={4} value={details} onChange={e=>setDetails(e.target.value)} maxLength={800} required aria-invalid={!!errors.details} aria-describedby={errors.details?'details-error':undefined} placeholder="可以是一条路线、一类游客，或一个想改善的体验。"/>{errors.details&&<span id="details-error" className="field-error">{errors.details}</span>}
      <button className="action action-primary" type="submit"><span>整理合作意向</span><ArrowRight size={17} aria-hidden="true"/></button>
      {result?.ok && <div className="brief-result"><h3>合作意向已整理好。</h3><p>检查内容，然后通过邮件发给我们。</p><textarea ref={resultRef} readOnly value={result.text} aria-label="合作意向草稿" rows={8}/><div className="brief-actions"><a href={'mailto:'+site.email+'?subject='+encodeURIComponent('问途 AskWay · '+organization+' 合作意向')+'&body='+encodeURIComponent(result.text)} className="action action-primary"><span>用邮件发送</span><Mail size={16} aria-hidden="true"/></a><button type="button" className="copy-button" onClick={copy}><Copy size={16} aria-hidden="true"/>复制内容</button></div><span className="copy-status" role="status">{copyState}</span></div>}
    </form></section>
  </div>;
}
