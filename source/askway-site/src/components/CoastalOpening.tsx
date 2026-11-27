import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { asset } from '../site';
import { Eyebrow } from './Shared';
import RouteDiagram from './RouteDiagram';
import { usePresentationMotion } from '../motion/PresentationMotion';

const SeaRouteParticles = lazy(() => import('./SeaRouteParticles'));
class DecorationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function CoastalOpening() {
  const openingRef = useRef<HTMLDivElement>(null);
  const { motionAllowed } = usePresentationMotion();
  const [visible, setVisible] = useState(false);
  const [saveData, setSaveData] = useState(true);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setSaveData(Boolean(connection?.saveData));
    const element = openingRef.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div className="coastal-opening" ref={openingRef}>
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-image-wrap"><img data-hero-image src={asset('hero.webp')}
        alt="实景摄影：珠海大剧院的一大一小两座日月贝，面向海岸与城市" width="1600" height="900" fetchPriority="high"/></div>
      <div className="hero-shade"/><div className="hero-grain" aria-hidden="true"/>
      <div className="container hero-content">
        <div className="hero-kicker"><span className="tiny-line"/>ASKWAY · A WAY TO EXPLORE</div>
        <h1 id="home-title"><span data-hero-title>让城市探索，</span><span data-hero-title className="hero-gold">自有方向。</span></h1>
        <p className="hero-description">从心之所向，到脚下的旅程。<br/>在城市与海之间，走出自己的节奏。</p>
      </div>
      <div className="hero-coordinates"><span>22°16′ N / 113°35′ E</span><span>珠海 · 日月贝 / 实景摄影</span></div>
      <div className="container hero-bottom">
        <a href="#story" className="scroll-cue"><ArrowDown size={18} aria-hidden="true"/><span>循着海风，向下看</span></a>
        <span className="hero-bottom-note">WHERE THE CITY MEETS THE SEA</span>
      </div>
    </section>
    <section className="route-story" id="story" aria-labelledby="route-story-title">
      <div className="container route-story-heading"><Eyebrow number="01">FROM A SPARK, TO A WAY</Eyebrow><span>一座城市，慢慢走。</span></div>
      <div className="container route-story-grid">
        <div className="route-story-copy">
          <h2 id="route-story-title">让心之所向，<br/>连成<span className="text-brand">一段旅程。</span></h2>
          <p>海面上的一点光，可以成为出发的方向。<br className="desktop-only"/>想去的地方、能用的时间、喜欢的节奏，<br className="desktop-only"/>问途把它们认真放在一起。</p>
          <Link to="/product/" className="text-link">看看旅程如何连起来<ArrowUpRight size={18} aria-hidden="true"/></Link>
        </div>
        <RouteDiagram className="home-route-diagram" flowing={false}/>
      </div>
      <div className="container route-story-foot"><span>先看清条件，再选择方向。</span><p>三站为路线示意。实际安排由你核对、比较与确认。</p></div>
    </section>
    {visible && motionAllowed && !saveData && <DecorationBoundary><Suspense fallback={null}><SeaRouteParticles openingRef={openingRef}/></Suspense></DecorationBoundary>}
  </div>;
}
