import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from './Brand';
import { site } from '../site';
export default function SiteFooter() {
  return <footer className="site-footer"><div className="container">
    <div className="footer-top"><div><Brand/><p>从心之所向，<br/>到脚下的旅程。</p></div>
      <div className="footer-links"><span>探索问途</span><Link to="/product/">产品体验</Link><Link to="/product/#demo">交互演示</Link><Link to="/about/">关于问途</Link></div>
      <div className="footer-links"><span>一起出发</span><Link to="/cooperation/">合作方向</Link><a href={'mailto:'+site.email}>{site.email}<ArrowUpRight size={15} aria-hidden="true"/></a></div>
    </div>
    <div className="footer-bottom"><span>© 2026 问途 AskWay</span><span>以珠海为起点，探索城市的更多可能。</span>
      <details className="asset-credits"><summary>影像署名</summary><div><p>珠海大剧院影像：Charlie fong、钉钉，CC BY-SA 4.0。野狸岛城市影像：Vmenkov，CC BY-SA 3.0。图像经裁切及色彩调整。</p><a href="https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_Exterior_Southeast2021.jpg" target="_blank" rel="noreferrer">影像来源与许可<ArrowUpRight size={14} aria-hidden="true"/></a></div></details>
    </div>
  </div></footer>;
}
