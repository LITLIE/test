import { useState } from 'react';
import { ArrowDown, ArrowUpRight, Check, Compass, Layers, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { asset } from '../site';
import { Action, CooperationCallout, Eyebrow } from '../components/Shared';
import JourneyStage from '../components/JourneyStage';
import RouteArt from '../components/RouteArt';
const scenes=[
  {name:'海滨公园',subtitle:'从一片绿意，走向海岸',description:'给旅程一个舒展的开始。在城市的绿意里停一停，再循着海风走向下一站。',image:'coast.webp'},
  {name:'香炉湾',subtitle:'把时间，留一点给海风',description:'沿着海岸慢慢走。让景点之间的过程，也成为这一天值得记住的一部分。',image:'coast.webp'},
  {name:'日月贝',subtitle:'在城市与海之间，看见珠海',description:'以一座向海而生的城市地标，串起风景、故事与旅行的下一步。',image:'hero.webp'},
];
export default function Home(){
  const [scene,setScene]=useState(2);
  return <>
    <section className="hero">
      <div className="hero-image-wrap"><img data-hero-image src={asset('hero.webp')} alt="珠海大剧院日月贝与海岸城市景观" width="1920" height="1280" fetchPriority="high"/></div>
      <div className="hero-shade"/><div className="hero-grain" aria-hidden="true"/>
      <div className="container hero-content">
        <div className="hero-kicker"><span className="tiny-line"/>A WAY TO EXPLORE</div>
        <h1><span data-hero-title>让城市探索，</span><span data-hero-title className="hero-gold">自有方向。</span></h1>
        <p className="hero-description">从心之所向，到脚下的旅程。<br/>问途连接你的想法、清晰的安排与城市现场。</p>
        <div className="hero-actions"><Action to="/product/#demo" tone="cream">探索产品</Action><Action to="/cooperation/" tone="outline">一起探索</Action></div>
      </div>
      <div className="hero-route" aria-hidden="true"><RouteArt active={2} decorative/></div>
      <div className="hero-coordinates"><span>22°16′ N / 113°35′ E</span><span>珠海 · 日月贝</span></div>
      <div className="container hero-bottom"><a href="#story" className="scroll-cue"><ArrowDown size={18} aria-hidden="true"/><span>循着想法，向前走</span></a><span className="hero-bottom-note">ZHUHAI, WHERE THE CITY MEETS THE SEA</span><span className="hero-slide-number">01 <i/> 04</span></div>
    </section>
    <section className="manifesto container" id="story"><div data-reveal><Eyebrow number="01">A THOUGHTFUL WAY</Eyebrow><span className="manifesto-note">旅行的意义，<br/>也在抵达之间。</span></div><div data-reveal><h2>好的旅程，<br/>有风景，也有<span className="text-brand">章法。</span></h2><p>想去的地方、能用的时间、希望怎样走过一天。<br className="desktop-only"/>问途让这些想法被认真对待，再把它们连成一段清晰的旅程。</p></div></section>
    <JourneyStage/>
    <section className="destination-section"><div className="container destination-heading" data-reveal><Eyebrow number="03">A CITY, MANY POSSIBILITIES</Eyebrow><div><h2>从珠海出发，<br/>重新发现城市。</h2><p>风景与故事之间，还有一条属于你的路线。</p></div></div>
      <div className="destination-layout container"><div className="destination-visual"><img src={asset(scenes[scene].image)} alt={scene===2?'珠海大剧院外观':'从野狸岛眺望珠海海岸'} loading="lazy" width="1200" height="900"/><div className="destination-image-shade"/><RouteArt active={scene}/><span className="scene-caption"><MapPin size={14} aria-hidden="true"/>{scenes[scene].name} · 城市场景</span><span className="scene-diagram">路线示意</span></div><div className="destination-copy"><div className="scene-tabs" aria-label="选择城市场景">{scenes.map((item,i)=><button key={item.name} type="button" aria-pressed={scene===i} onClick={()=>setScene(i)}><span>0{i+1}</span>{item.name}</button>)}</div><div className="scene-text" aria-live="polite"><span className="scene-overline">THE CITY, AT YOUR PACE</span><h3>{scenes[scene].subtitle}</h3><p>{scenes[scene].description}</p></div><Link to="/product/#demo" className="text-link">试着安排一段旅程<ArrowUpRight size={18} aria-hidden="true"/></Link></div></div>
    </section>
    <section className="trust-section container"><div className="section-head" data-reveal><Eyebrow number="04">CLARITY AT EVERY STEP</Eyebrow><h2>安心出发，<br/>来自每一个清楚的决定。</h2></div><div className="trust-grid">
      {[{icon:Compass,title:'条件明确，才出发。',text:'重要的偏好与限制先确认。面对时间、必去点和其他条件，让安排有清楚的依据。'},{icon:Layers,title:'变化发生，也看得明白。',text:'比较方案、理解变化，再决定是否采用。把每一次取舍，交还给正在旅行的你。'},{icon:Check,title:'保存之后，接着走。',text:'已保存的安排与新的查询分开呈现。在电脑与手机之间，衔接同一段旅程。'}].map(({icon:Icon,title,text},i)=><article key={title} className="trust-item" data-reveal><span className="trust-icon"><Icon size={25} strokeWidth={1.4} aria-hidden="true"/></span><span className="item-index">0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}
    </div></section>
    <section className="partners-preview"><div className="container"><div className="section-head" data-reveal><Eyebrow number="05">MAKE THE NEXT WAY TOGETHER</Eyebrow><div><h2>城市的更多可能，<br/>值得一起探索。</h2><p>从一个具体场景开始，让内容、服务与体验相遇。</p></div></div><div className="partner-grid">
      {[{n:'01',title:'城市内容共建',english:'STORIES OF A CITY',focus:'content',text:'让景点、讲解与城市故事，进入一段可被体验的旅程。'},{n:'02',title:'城市体验试点',english:'A PLACE TO BEGIN',focus:'destination',text:'从单片区、小范围的场景出发，共同核实与改进游览体验。'},{n:'03',title:'目的地服务衔接',english:'CONNECT THE EXPERIENCE',focus:'hospitality',text:'探索酒店、目的地服务与城市出游安排之间的连接。'}].map(item=><Link key={item.n} to={'/cooperation/?focus='+item.focus+'#contact'} className="partner-card"><div><span>{item.n}</span><ArrowUpRight size={22} strokeWidth={1.4} aria-hidden="true"/></div><span className="partner-english">{item.english}</span><h3>{item.title}</h3><p>{item.text}</p></Link>)}
    </div></div></section>
    <CooperationCallout/>
  </>;
}
