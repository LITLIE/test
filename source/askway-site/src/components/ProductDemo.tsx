import { useState } from 'react';
import { ArrowRight, Check, Clock3, MapPin, RotateCcw } from 'lucide-react';
import { demoStops, planDemo } from '../lib/demo.mjs';
import RouteArt from './RouteArt';
import { Eyebrow } from './Shared';
export default function ProductDemo(){
  const [minutes,setMinutes]=useState(180),[pace,setPace]=useState('standard'),[must,setMust]=useState<string[]>(['theatre']);
  const [result,setResult]=useState<ReturnType<typeof planDemo>|null>(()=>planDemo({minutes:180,pace:'standard',mustVisit:['theatre']})),[selected,setSelected]=useState('theatre');
  const toggle=(id:string)=>{setMust(previous=>previous.includes(id)?previous.filter(item=>item!==id):[...previous,id]);setResult(null);};
  return <section className="product-demo container" id="demo"><div className="section-head" data-reveal><Eyebrow>TRY A LITTLE JOURNEY</Eyebrow><h2>来，试着安排<br/>一段城市旅程。</h2><p>用一段珠海示例，体验问途的规划思路。</p></div>
    <div className="demo-layout"><form className="demo-controls" onSubmit={event=>{event.preventDefault();const next=planDemo({minutes,pace,mustVisit:must});setResult(next);if(next.ok)setSelected(next.stops[0].id);}}>
      <span className="panel-eyebrow">把你的想法告诉问途</span>
      <label htmlFor="demo-time">这一天，有多少时间？</label><select id="demo-time" value={minutes} onChange={event=>{setMinutes(Number(event.target.value));setResult(null);}}><option value={120}>2 小时 · 短暂漫游</option><option value={180}>3 小时 · 轻松探索</option><option value={240}>4 小时 · 留更多余量</option></select>
      <fieldset className="pace-field"><legend>希望以怎样的节奏出发？</legend><div className="pace-buttons"><button type="button" aria-pressed={pace==='standard'} onClick={()=>{setPace('standard');setResult(null);}}>自在探索</button><button type="button" aria-pressed={pace==='slow'} onClick={()=>{setPace('slow');setResult(null);}}>慢慢走走</button></div></fieldset>
      <fieldset className="must-field"><legend>有哪些一定想去的地方？</legend>{demoStops.map(stop=><label key={stop.id}><input type="checkbox" checked={must.includes(stop.id)} onChange={()=>toggle(stop.id)}/><span>{stop.name}</span><MapPin size={15} aria-hidden="true"/></label>)}</fieldset>
      <button type="submit" className="action action-primary"><span>形成示例安排</span><ArrowRight size={17} aria-hidden="true"/></button>
      <p className="demo-disclaimer">时间与路线均为演示估算。实际游览前，请核实开放、交通与现场信息。</p>
    </form><div className="demo-result" aria-live="polite">
      {result?.ok ? <><div className="demo-result-header"><span className="demo-valid"><Check size={14} aria-hidden="true"/>符合演示条件</span><span><Clock3 size={14} aria-hidden="true"/>约 {result.totalMinutes} 分钟</span></div><div className="demo-map"><RouteArt active={demoStops.findIndex(item=>item.id===selected)} included={result.stops.map(stop=>demoStops.findIndex(item=>item.id===stop.id))}/><div className="demo-map-caption">珠海 · 路线示意</div></div><div className="demo-itinerary">{result.stops.map((stop,i)=><button key={stop.id} type="button" className={selected===stop.id?'selected':''} onClick={()=>setSelected(stop.id)}><span className="stop-number">0{i+1}</span><div><strong>{stop.name}{must.includes(stop.id)&&<small>必去</small>}</strong><span>{stop.subtitle}</span></div><span className="stop-duration">{stop.minutes} 分钟</span></button>)}</div><div className="demo-remaining">为变化留一点空间<span>约 {minutes-result.totalMinutes} 分钟余量</span></div></> : result ? <div className="demo-conflict"><RotateCcw size={35} strokeWidth={1.3} aria-hidden="true"/><h3>先调整一下条件。</h3><p>{result.reason}</p><span>你的必去点没有被悄悄放宽。</span></div> : <div className="demo-ready demo-conflict"><MapPin size={35} strokeWidth={1.3} aria-hidden="true"/><h3>新的想法，<br/>等你确认。</h3><p>点击“形成示例安排”，看看这组条件能够怎样衔接。</p></div>}
    </div></div>
  </section>;
}
