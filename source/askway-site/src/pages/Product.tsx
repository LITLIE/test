import { ArrowDown, Check } from 'lucide-react';
import { Action, CooperationCallout, Eyebrow } from '../components/Shared';
import JourneyStage from '../components/JourneyStage';
import ProductDemo from '../components/ProductDemo';
import SoftwareDownload from '../components/SoftwareDownload';
export default function Product(){
  return <><section className="page-hero container"><Eyebrow>THE PRODUCT / 问途体验</Eyebrow><h1>从想去，<br/>到清楚地出发。</h1><div className="page-hero-bottom"><p>让偏好被理解，让安排有依据。<br/>问途把商讨、规划与现场执行衔接起来，<br/>把城市探索的每一步，交还给你。</p><Action to="/product/#demo">开始交互演示</Action></div><span className="page-scroll"><ArrowDown size={18} aria-hidden="true"/>往下，看看一段旅程如何形成</span></section>
    <JourneyStage compact/><ProductDemo/><SoftwareDownload/>
    <section className="product-principles container"><Eyebrow>THOUGHTFUL BY DESIGN</Eyebrow><h2>旅程可以改变。<br/>重要的条件，值得认真对待。</h2><div className="principles-grid">{[{title:'重要条件，先确认。',text:'时间、必去点和其他偏好，先被清楚地表达。发生冲突时，给出解释和调整方向。'},{title:'可行性，有独立校验。',text:'把条件检查与自由表达分开，让一份安排是否符合限制有可核实的依据。'},{title:'每次调整，由你决定。',text:'变化前后可比较，再选择采用或撤销。新的方案需要明确确认。'},{title:'已保存与最新查询，清楚区分。',text:'手机继续使用已选安排。在线路线与未知信息有自己的状态，不替换你的选择。'}].map(item=><article key={item.title}><Check size={20} aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="faq-section container"><div><Eyebrow>A FEW THINGS TO KNOW</Eyebrow><h2>出发前，<br/>你可能想知道。</h2></div><div className="faq-list">{[
      ['这里的交互演示能用于实际旅行吗？','交互演示使用有限的珠海示例，帮助你理解条件、取舍与可行性检查。时间与路线为演示估算。实际旅行应使用完整产品，并在出发前核实交通、开放与现场信息。'],
      ['问途如何处理发生冲突的条件？','重要条件先确认，再进入规划。无法同时满足时，说明冲突和可能的调整方向，由你决定如何改变要求。'],
      ['电脑与手机分别承担什么？','电脑适合规划与方案比较，手机衔接已保存的安排、路线参考与现场执行。产品也持续围绕手机上的规划体验进行迭代。'],
      ['到点讲解与离线体验有什么范围？','到点讲解依赖前台定位与权限，也提供手动播放路径。已保存的安排和本地进度与在线路线查询分开处理，具体可用范围以当前产品说明为准。'],
    ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section><CooperationCallout/></>;
}
