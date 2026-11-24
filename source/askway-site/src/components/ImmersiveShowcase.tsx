import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, Camera, Pause, Play, RotateCw, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import CityIllustration, { CityThumbnail, cityIllustrationSource } from './CityIllustrations';
import type { CityIllustrationKind, CityIllustrationSource } from './CityIllustrations';
import { Eyebrow } from './Shared';
import '../styles/immersive.css';

const CinematicCity = lazy(() => import('../features/experience/scene/CinematicCity'));
class ShowcaseBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
const views: {
  name: string;
  english: string;
  description: string;
  kind: CityIllustrationKind;
  view: 'coast' | 'theatre' | 'overview';
  lighting: 'day' | 'dusk';
}[] = [
  { name: '沿海岸', english: 'THE COAST', description: '从海面到城市，把一段海岸放进视野。', kind: 'coast', view: 'coast', lighting: 'day' },
  { name: '看日月贝', english: 'THE LANDMARK', description: '靠近向海而生的建筑，看见光线与尺度。', kind: 'theatre', view: 'theatre', lighting: 'dusk' },
  { name: '望向全城', english: 'THE JOURNEY', description: '退后一点，让地标与旅程在同一幅画面里相遇。', kind: 'landmarks', view: 'overview', lighting: 'day' },
];

export default function ImmersiveShowcase({ compact = false }: { compact?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const autoLocked = useRef(false);
  const [active, setActive] = useState(1);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [waterAnimation, setWaterAnimation] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [failed, setFailed] = useState<'resource' | 'scene' | null>(null);
  const [imageSources, setImageSources] = useState<Partial<Record<CityIllustrationKind, CityIllustrationSource>>>({});
  const current = views[active];
  const live = enabled && visible;
  const illustration = imageSources[current.kind] ?? cityIllustrationSource(current.kind);
  const observeSource = useCallback((source: CityIllustrationSource) => {
    setImageSources(previous => previous[source.kind]?.src === source.src ? previous : { ...previous, [source.kind]: source });
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(media.matches); if (media.matches) setEnabled(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
    const update = () => { setDesktop(media.matches); if (!media.matches) setEnabled(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!('IntersectionObserver' in window)) { autoLocked.current = true; setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting && entry.intersectionRatio > .06));
    }, { threshold: [0, .06, .2] });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reducedMotion || autoLocked.current || failed || !desktop) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!connection?.saveData) setEnabled(true);
  }, [visible, reducedMotion, failed, desktop]);

  const toggle = () => {
    if (failed === 'resource') { window.location.reload(); return; }
    autoLocked.current = true;
    setFailed(null);
    setEnabled(value => !value);
  };
  const fallback = (reason: 'resource' | 'scene') => {
    autoLocked.current = true;
    setEnabled(false);
    setFailed(reason);
  };

  return <section className={`immersive-showcase${compact ? ' immersive-showcase--compact' : ''}`} ref={sectionRef}
    aria-labelledby={compact ? 'product-city-window-title' : 'city-window-title'}>
    <div className="container immersive-heading">
      <div data-reveal><Eyebrow>THE CITY, IN PERSPECTIVE</Eyebrow><h2 id={compact ? 'product-city-window-title' : 'city-window-title'}>
        {compact ? <>把安排，<br/>放回<span>城市里。</span></> : <>城市有深度，<br/>旅程有<span>方向。</span></>}
      </h2></div>
      <div className="immersive-heading-copy" data-reveal><p>海面上的光，建筑的轮廓，地标之间的距离。<br className="desktop-only"/>换一个视角，看见城市，也看清你想怎样走过它。</p>
        <div><Waves size={17} aria-hidden="true"/><span>珠海 · 海岸城市展台</span></div>
      </div>
    </div>
    <div className="immersive-window-wrap">
      <div className="immersive-stage" ref={stageRef} data-live={live ? 'true' : 'false'}>
        <div className="immersive-poster" aria-hidden={live || undefined}><CityIllustration kind={current.kind} caption={false} depth={!live} onSourceChange={observeSource}/></div>
        {live && <div className="immersive-live"><ShowcaseBoundary onFailure={() => fallback('resource')}><Suspense fallback={<div className="immersive-loading" role="status"><span/>正在展开立体城市…</div>}>
          <CinematicCity view={current.view} lighting={current.lighting} reducedMotion={reducedMotion}
            animationEnabled={waterAnimation} onAnimationChange={setWaterAnimation} onFailure={() => fallback('scene')}/>
        </Suspense></ShowcaseBoundary></div>}
        <div className="immersive-window-shade" aria-hidden="true"/>
        <div className="immersive-stage-top"><span><Camera size={16} aria-hidden="true"/>CITY WINDOW / 0{active + 1}</span>
          <span>{live ? '交互三维 · 场景示意' : illustration.label}</span></div>
        <div className="immersive-stage-bottom"><div className="immersive-view-copy" aria-live="polite"><span>{current.english}</span><h3>{current.name}，慢慢看。</h3><p>{current.description}</p></div>
          <button type="button" className="immersive-toggle" onClick={toggle} aria-pressed={enabled}>
            {failed === 'resource' ? <RotateCw size={16} aria-hidden="true"/> : enabled ? <Pause size={16} aria-hidden="true"/> : <Play size={16} aria-hidden="true"/>}<span>{failed === 'resource' ? '刷新再开启' : enabled ? '暂停立体场景' : '开启立体场景'}</span>
          </button>
        </div>
        <span className="immersive-edge-mark" aria-hidden="true">ASKWAY / ZHUHAI</span>
      </div>
      <div className="immersive-view-controls" role="group" aria-label="选择城市展台视角">{views.map((item, index) => <button type="button" key={item.view}
        className="immersive-view-button" aria-pressed={active === index} onClick={() => setActive(index)}>
        <CityThumbnail kind={item.kind}/>
        <span className="immersive-view-number">0{index + 1}</span><span className="immersive-view-label"><strong>{item.name}</strong><span>{item.english}</span></span>
        <ArrowUpRight size={18} aria-hidden="true"/>
      </button>)}</div>
    </div>
    <div className="container immersive-footnote"><div><p>静态画面：{illustration.label}。交互视图为写实风格三维场景，建筑、地形与路线几何均为示意。</p>
      <p className="immersive-motion-note" role="status">{failed === 'resource' ? '三维资源未能载入，城市画面已保留。刷新页面后可再次开启。' : failed === 'scene' ? '当前设备暂未能开启三维，已保留城市画面。可再次尝试。' : reducedMotion ? '已减弱动画；可主动开启三维，静态视角也能完整浏览。' : '选择视角，或开启三维探索。滚轮与纵向滑动继续浏览页面。'}</p></div>
      <Link to="/experience/" className="text-link">把想法放进旅程<ArrowUpRight size={18} aria-hidden="true"/></Link>
    </div>
  </section>;
}
