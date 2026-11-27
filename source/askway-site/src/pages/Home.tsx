import { useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Action, CooperationCallout, Eyebrow } from '../components/Shared';
import JourneyStage from '../components/JourneyStage';
import RouteArt from '../components/RouteArt';
import CityIllustration from '../components/CityIllustrations';
import ImmersiveShowcase from '../components/ImmersiveShowcase';
import ExperiencePreview from '../features/experience/ui/ExperiencePreview';
import CoastalOpening from '../components/CoastalOpening';
const scenes=[
  {name:'海滨公园',subtitle:'从一片绿意，走向海岸',description:'给旅程一个舒展的开始。在城市的绿意里停一停，再循着海风走向下一站。',kind:'coast' as const},
  {name:'香炉湾',subtitle:'把时间，留一点给海风',description:'沿着海岸慢慢走。让景点之间的过程，也成为这一天值得记住的一部分。',kind:'landmarks' as const},
  {name:'日月贝',subtitle:'在城市与海之间，看见珠海',description:'以一座向海而生的城市地标，串起风景、故事与旅行的下一步。',kind:'theatre' as const},
];
export default function Home(){
  const [scene,setScene]=useState(2);
  return <>
    <CoastalOpening/>
    <ImmersiveShowcase/>
    <section className="experience-preview container" aria-labelledby="experience-preview-title">
      <div className="experience-preview-grid">
        <div className="experience-preview-copy" data-reveal>
          <Eyebrow>YOUR CONDITIONS, A CLEARER JOURNEY</Eyebrow>
          <h2 id="experience-preview-title">每一步安排，<br/>都由<span className="text-brand">你来决定。</span></h2>
          <p>核对想法，比较候选，再确认这一段安排。<br className="desktop-only"/>变化看得明白，采用之后也能撤销一次。<br className="desktop-only"/>把判断留给你，把清晰留在旅程里。</p>
          <div className="preview-conditions" role="group" aria-label="旅程条件"><span>可用时间</span><span>必去地点</span><span>步行节奏</span></div>
          <div className="preview-actions"><Action to="/experience/">开始旅程体验</Action><Link to="/about/#reference" className="text-link">先看资料与范围<ArrowUpRight size={18} aria-hidden="true"/></Link></div>
        </div>
        <div className="experience-preview-art" data-reveal><ExperiencePreview/></div>
      </div>
      <p className="preview-scope">当前体验基于公开参考点与规则估算；二维路线与三维城市场景均为示意，使用范围可在地点详情中查看。</p>
    </section>
    <JourneyStage/>
    <section className="destination-section"><div className="container destination-heading" data-reveal><Eyebrow number="03">A CITY, MANY POSSIBILITIES</Eyebrow><div><h2>从珠海出发，<br/>重新发现城市。</h2><p>风景与故事之间，还有一条属于你的路线。</p></div></div>
      <div className="destination-layout container"><div className="destination-visual"><CityIllustration kind={scenes[scene].kind} caption={<><MapPin size={14} aria-hidden="true"/> {scenes[scene].name} · 城市视觉参考</>} depth/><div className="destination-image-shade"/><RouteArt active={scene}/><span className="scene-diagram">路线示意</span></div><div className="destination-copy"><div className="scene-tabs" role="group" aria-label="选择城市场景">{scenes.map((item,i)=><button key={item.name} type="button" aria-pressed={scene===i} onClick={()=>setScene(i)}><span>0{i+1}</span>{item.name}</button>)}</div><div className="scene-text" aria-live="polite"><span className="scene-overline">THE CITY, AT YOUR PACE</span><h3>{scenes[scene].subtitle}</h3><p>{scenes[scene].description}</p></div><div className="scene-material-note"><span><i/>海面与光线</span><span><i/>建筑与远山</span><span><i/>自己的节奏</span></div><Link to="/experience/" className="text-link">试着安排一段旅程<ArrowUpRight size={18} aria-hidden="true"/></Link></div></div>
    </section>
    <section className="partners-preview"><div className="container"><div className="section-head" data-reveal><Eyebrow number="05">MAKE THE NEXT WAY TOGETHER</Eyebrow><div><h2>城市的更多可能，<br/>值得一起探索。</h2><p>从一个具体场景开始，让内容、服务与体验相遇。</p></div></div><div className="partner-grid">
      {[{n:'01',title:'城市内容共建',english:'STORIES OF A CITY',focus:'content',text:'让景点、讲解与城市故事，进入一段可被体验的旅程。'},{n:'02',title:'城市体验试点',english:'A PLACE TO BEGIN',focus:'destination',text:'从单片区、小范围的场景出发，共同核实与改进游览体验。'},{n:'03',title:'目的地服务衔接',english:'CONNECT THE EXPERIENCE',focus:'hospitality',text:'探索酒店、目的地服务与城市出游安排之间的连接。'}].map(item=><Link key={item.n} to={'/cooperation/?focus='+item.focus+'#contact'} className="partner-card"><div><span>{item.n}</span><ArrowUpRight size={22} strokeWidth={1.4} aria-hidden="true"/></div><span className="partner-english">{item.english}</span><h3>{item.title}</h3><p>{item.text}</p></Link>)}
    </div></div></section>
    <CooperationCallout/>
  </>;
}
