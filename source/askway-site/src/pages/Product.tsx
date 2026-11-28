import { ArrowDown, ArrowUpRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CooperationCallout, Eyebrow } from '../components/Shared';
import ProductDemo from '../components/ProductDemo';
import SoftwareDownload from '../components/SoftwareDownload';
import ImmersiveShowcase from '../components/ImmersiveShowcase';
import RouteDiagram from '../components/RouteDiagram';
import { asset } from '../site';
import '../styles/editorial-pages.css';
export default function Product(){
  return <div className="editorial-page editorial-product cinematic-page"><section className="page-hero product-editorial-hero container">
    <div className="product-editorial-copy"><Eyebrow>THE PRODUCT / 问途体验</Eyebrow><h1>从想去，<br/>到清楚地出发。</h1><p>留多少时间，哪里一定想去，怎样走得轻松一点。先核对条件，再比较安排，最后由你确认这一天。</p><ol className="product-decision-line" aria-label="旅程形成过程"><li><span>01</span><div><strong>核对条件</strong><small>先看清想法与限制</small></div></li><li><span>02</span><div><strong>比较候选</strong><small>看见变化与取舍</small></div></li><li><span>03</span><div><strong>确认采用</strong><small>采用后可撤销一次</small></div></li></ol><Link to="/experience/" className="text-link">亲自核对一段旅程<ArrowUpRight size={18} aria-hidden="true"/></Link><p className="product-reading-scope">当前为受控资料体验。参考点与规则估算，帮助你理解一份安排。</p></div>
    <div className="product-route-sheet"><figure className="product-route-photograph"><div className="product-route-photo-frame"><img src={asset('theatre.webp')} alt="实景摄影：珠海日月贝的双贝壳体、玻璃立面与前方广场" width="1200" height="851" decoding="async"/></div><figcaption><span>从一座城市，看见一段旅程。</span><a href="https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_23.jpg" target="_blank" rel="noopener noreferrer">实景摄影：钉钉 · CC BY-SA 4.0<ArrowUpRight size={13} aria-hidden="true"/></a></figcaption></figure><div className="product-route-sheet-heading"><span>一段珠海旅程</span><span>路线示意 / ZHUHAI</span></div><RouteDiagram className="product-editorial-route"/><p>三站展示地点之间的连接关系。旅程体验中的文字、二维路线与三维场景读取同一份安排；时间与现场信息仍需核实。</p></div>
    <nav className="product-page-index cinematic-page-index" aria-label="产品页内目录"><a href="#demo"><span className="page-index-number">01</span><span>三点概念演示</span><ArrowDown size={16} aria-hidden="true"/></a><a href="#download"><span className="page-index-number">02</span><span>查看软件获取状态</span><ArrowUpRight size={16} aria-hidden="true"/></a></nav>
  </section>
    <ImmersiveShowcase compact/>
    <div className="legacy-demo-shell" role="region" aria-label="保留的三点概念演示"><div className="legacy-demo-note container"><span className="preview-mode">三点概念演示</span><p>用海滨公园、香炉湾和日月贝，试着把时间与必去点放在一起。下方时间与路线为概念估算，现场出行前仍需核实。</p></div><ProductDemo/></div><SoftwareDownload/>
    <section className="product-principles container"><Eyebrow>THOUGHTFUL BY DESIGN</Eyebrow><h2>旅程可以改变。<br/>重要的条件，值得认真对待。</h2><div className="principles-grid">{[{title:'重要条件，先确认。',text:'时间、必去点和其他偏好，先被清楚地表达。发生冲突时，给出解释和调整方向。'},{title:'可行性，有规则校验。',text:'把条件检查与表达分开，让安排是否符合已确认条件有可核对的依据。资料不足也有独立状态。'},{title:'每次调整，由你决定。',text:'变化前后可比较，再选择采用或撤销。修改草稿时，保留上一份已确认的安排。'},{title:'示意与未知，清楚区分。',text:'参考点、入口状态、路段估算和开放信息各有说明。地图与模型展示安排的关系，现场出行前仍需核实。'}].map(item=><article key={item.title}><Check size={20} aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="faq-section container"><div><Eyebrow>A FEW THINGS TO KNOW</Eyebrow><h2>出发前，<br/>你可能想知道。</h2></div><div className="faq-list">{[
      ['这里的交互演示能用于实际旅行吗？','新的旅程体验使用公开参考资料和规则估算；本页还保留旧三点概念演示。两者都用于理解条件与取舍，路线均为示意。现场出行前，应核实入口、交通、开放与其他信息。'],
      ['问途如何处理发生冲突的条件？','重要条件先确认，再进入规划。无法同时满足时，说明冲突和可能的调整方向，由你决定如何改变要求。'],
      ['电脑与手机分别承担什么？','电脑与手机都可以在本官网核对条件与比较方案。跨端保存与现场执行属于完整产品方向，尚需另行接入和验证。'],
      ['到点讲解与离线体验有什么范围？','跨端保存、定位和到点讲解属于完整产品的后续接入与核实范围。本官网当前在会话中核对条件和比较方案，产品概念舞台会明确标出示意内容。'],
    ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section><CooperationCallout/></div>;
}
