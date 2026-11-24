import { ArrowDown, ArrowUpRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Action, CooperationCallout, Eyebrow } from '../components/Shared';
import JourneyStage from '../components/JourneyStage';
import ProductDemo from '../components/ProductDemo';
import SoftwareDownload from '../components/SoftwareDownload';
import CityIllustration from '../components/CityIllustrations';
import ImmersiveShowcase from '../components/ImmersiveShowcase';
export default function Product(){
  return <><section className="page-hero container"><Eyebrow>THE PRODUCT / 问途体验</Eyebrow><h1>从想去，<br/>到清楚地出发。</h1><div className="page-hero-bottom"><p>让偏好被理解，让安排有依据。<br/>从公开参考资料开始，核对条件、比较取舍，<br/>把每一次采用的决定，交还给你。</p><div className="product-hero-actions"><Action to="/experience/">开始旅程体验</Action><Link to="/product/#demo" className="text-link">查看三点概念演示</Link></div></div><span className="page-scroll"><ArrowDown size={18} aria-hidden="true"/>往下，看看一段旅程如何形成</span></section>
    <section className="product-experience-intro container" aria-labelledby="product-experience-title"><div><Eyebrow>A PLAN YOU CAN UNDERSTAND</Eyebrow><h2 id="product-experience-title">从想法到安排，<br/>每一步都能看清。</h2></div><div><p>新的旅程体验提供可修改的条件、可比较的候选和地点依据。文字、二维路线与三维城市场景围绕同一份方案工作。</p><p className="product-experience-scope">当前为公开资料与规则估算驱动的受控体验，参考位置和示意路线的用途均有明确标记。</p><Action to="/experience/">进入完整旅程体验</Action></div></section>
    <ImmersiveShowcase compact/>
    <section className="product-city-story container" aria-labelledby="product-city-story-title"><div className="product-city-story-head"><div data-reveal><Eyebrow>ONE JOURNEY, THREE WAYS TO SEE</Eyebrow><h2 id="product-city-story-title">一份安排，<br/>三种清楚的看法。</h2></div><p data-reveal>文字让条件与取舍可以逐项核对。二维把地点之间的关系铺开。三维让海岸、建筑与一段旅程在同一幅城市画面里相遇。</p></div><CityIllustration kind="landmarks" caption="城市地标与海岸地形的空间关系；建筑与地形几何为示意。" depth/>
      <ol className="product-view-details"><li><span>01 / 文字</span><div><h3>先看清这一天。</h3><p>重要条件、耗时与余量各有说明，候选经过比较后，再由你确认采用。</p></div><Link to="/experience/" className="text-link">核对旅程条件<ArrowUpRight size={17} aria-hidden="true"/></Link></li><li><span>02 / 二维</span><div><h3>把地点连起来。</h3><p>查看公开参考点与方案顺序，比较新增、移除与保留的地点，理解安排如何改变。</p></div><Link to="/experience/" className="text-link">查看路线关系<ArrowUpRight size={17} aria-hidden="true"/></Link></li><li><span>03 / 三维</span><div><h3>换个视角看城市。</h3><p>在写实风格场景中看见建筑与海岸的空间层次。模型帮助理解位置，现场出行仍需核实。</p></div><Link to="/experience/" className="text-link">走进城市展台<ArrowUpRight size={17} aria-hidden="true"/></Link></li></ol>
    </section>
    <JourneyStage compact/>
    <div className="legacy-demo-shell" role="region" aria-label="保留的三点概念演示"><div className="legacy-demo-note container"><div><span className="preview-mode">保留入口 · 三点概念演示</span><p>下方沿用海滨公园、香炉湾和日月贝的三点示例，时间与路线为概念估算。新的条件、候选与版本比较可在独立旅程体验中操作。</p></div><Action to="/experience/">试试新的旅程体验</Action></div><ProductDemo/></div><SoftwareDownload/>
    <section className="product-principles container"><Eyebrow>THOUGHTFUL BY DESIGN</Eyebrow><h2>旅程可以改变。<br/>重要的条件，值得认真对待。</h2><div className="principles-grid">{[{title:'重要条件，先确认。',text:'时间、必去点和其他偏好，先被清楚地表达。发生冲突时，给出解释和调整方向。'},{title:'可行性，有规则校验。',text:'把条件检查与表达分开，让安排是否符合已确认条件有可核对的依据。资料不足也有独立状态。'},{title:'每次调整，由你决定。',text:'变化前后可比较，再选择采用或撤销。修改草稿时，保留上一份已确认的安排。'},{title:'示意与未知，清楚区分。',text:'参考点、入口状态、路段估算和开放信息各有说明。地图与模型展示安排的关系，现场出行前仍需核实。'}].map(item=><article key={item.title}><Check size={20} aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="faq-section container"><div><Eyebrow>A FEW THINGS TO KNOW</Eyebrow><h2>出发前，<br/>你可能想知道。</h2></div><div className="faq-list">{[
      ['这里的交互演示能用于实际旅行吗？','新的旅程体验使用公开参考资料和规则估算；本页还保留旧三点概念演示。两者都用于理解条件与取舍，路线均为示意。现场出行前，应核实入口、交通、开放与其他信息。'],
      ['问途如何处理发生冲突的条件？','重要条件先确认，再进入规划。无法同时满足时，说明冲突和可能的调整方向，由你决定如何改变要求。'],
      ['电脑与手机分别承担什么？','电脑适合规划与方案比较，手机衔接已保存的安排、路线参考与现场执行。产品也持续围绕手机上的规划体验进行迭代。'],
      ['到点讲解与离线体验有什么范围？','跨端保存、定位和到点讲解属于完整产品的后续接入与核实范围。本官网当前在会话中核对条件和比较方案，产品概念舞台会明确标出示意内容。'],
    ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section><CooperationCallout/></>;
}
