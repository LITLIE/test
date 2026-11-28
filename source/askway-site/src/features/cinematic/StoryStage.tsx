import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, Check, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { asset } from '../../site';
import { Action, Eyebrow } from '../../components/Shared';
import RouteDiagram from '../../components/RouteDiagram';
import ExperiencePreview from '../experience/ui/ExperiencePreview';
import { usePresentationMotion, usePresentationSurface } from '../../motion/PresentationMotion';
import useStoryProgress from './useStoryProgress';
import { heroMobileAsset, heroMobileMedia, storyChapters } from './storyConfig';
import { storyPanelReadable, type StoryPhase } from './progress';

const SeaRouteParticles = lazy(() => import('../../components/SeaRouteParticles'));
class DecorationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function StoryStage() {
  const rootRef = useRef<HTMLDivElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  const { ready, paused, reducedMotion, saveData, motionAllowed } = usePresentationMotion();
  const [desktop, setDesktop] = useState(false), [photosReady, setPhotosReady] = useState(false), [nearReady, setNearReady] = useState(false);
  const sticky = ready && desktop && !paused && !reducedMotion && !saveData;
  const { controller, phase, visible } = useStoryProgress(rootRef, viewportRef, sticky);
  const ownsSurface = usePresentationSurface('city-story', visible && motionAllowed, 10);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px) and (min-height: 700px)');
    const supported = typeof CSS !== 'undefined' && CSS.supports('height', '100svh') && CSS.supports('position', 'sticky') && CSS.supports('clip-path', 'inset(0%)') && CSS.supports('perspective', '1400px');
    const update = () => setDesktop(media.matches && supported);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    controller.setRunning(motionAllowed && visible && ownsSurface);
    return () => controller.setRunning(false);
  }, [controller, motionAllowed, visible, ownsSurface]);
  useEffect(() => {
    if (ready && (!sticky || phase !== 'city')) setPhotosReady(true);
  }, [ready, sticky, phase]);
  useEffect(() => controller.subscribe(snapshot => {
    rootRef.current?.querySelectorAll<HTMLElement>('[data-story-panel]').forEach(panel => {
      const hidden = !storyPanelReadable(snapshot, panel.dataset.storyPanel as StoryPhase, sticky);
      if (panel.hasAttribute('inert') !== hidden) panel.toggleAttribute('inert', hidden);
      if (hidden && panel.getAttribute('aria-hidden') !== 'true') panel.setAttribute('aria-hidden', 'true');
      else if (!hidden && panel.hasAttribute('aria-hidden')) panel.removeAttribute('aria-hidden');
    });
  }), [controller, sticky]);

  const photograph = (name: string, width: number, height: number, alt: string, className: string) => <>
    <img className={className} src={photosReady ? asset(name) : undefined} width={width} height={height}
      loading="lazy" decoding="async" fetchPriority="low" alt={alt}
      onLoad={() => { if (name === 'theatre.webp') setNearReady(true); controller.invalidate(); }}
      onError={event => { event.currentTarget.dataset.failed = 'true'; if (name === 'theatre.webp') setNearReady(false); }}/>
    <noscript><img className={className} src={asset(name)} width={width} height={height} loading="lazy" alt={alt}/></noscript>
  </>;
  const theatreMedia = <div className="story-theatre-media" data-story-handoff-media={sticky ? 'true' : undefined}
    aria-hidden={sticky && phase !== 'theatre' ? true : undefined}>
    {photograph('theatre.webp', 1200, 851, '实景摄影：日月贝正面双贝、玻璃入口、广场台阶与行人', 'story-theatre-photo')}
    <div className="story-theatre-shade" aria-hidden="true"/>
  </div>;
  const openingPicture = (primary: boolean) => <picture>
    <source media={heroMobileMedia} srcSet={asset(heroMobileAsset)} width="720" height="1280"/>
    <img data-hero-image={primary || undefined} src={asset('hero.webp')} alt="实景摄影：珠海大剧院的一大一小两座日月贝，面向海岸与城市"
      width="1600" height="900" fetchPriority={primary ? 'high' : 'low'} onLoad={() => controller.invalidate()}/>
  </picture>;

  return <div className="coastal-opening cinematic-story" ref={rootRef} data-story-layout={sticky ? 'sticky' : 'static'}
    data-story-phase={phase} data-story-progress="0" data-story-draw-count="0" data-story-active-time="0"
    data-story-presentation="spatial-photo-v2" data-story-near-ready={nearReady ? 'true' : 'false'}>
    {storyChapters.map(chapter => <span key={chapter.phase} id={sticky ? chapter.anchor : undefined} tabIndex={-1}
      className={'story-anchor story-anchor--' + chapter.phase} data-story-anchor={chapter.phase}
      aria-label={chapter.label}/>)}
    <div className="story-viewport" ref={viewportRef}>
      {sticky && <div className="story-coast-depth" aria-hidden="true">
        <div className="hero-image-wrap">{openingPicture(false)}</div>
        <div className="hero-shade"/><div className="hero-grain"/>
      </div>}
      <section id={sticky ? undefined : 'city-opening'} tabIndex={-1} className="hero story-panel story-city" data-story-panel="city" aria-labelledby="home-title">
        <div className="hero-image-wrap">{openingPicture(true)}</div>
        <div className="hero-shade" aria-hidden="true"/><div className="hero-grain" aria-hidden="true"/>
        <div className="container hero-content">
          <div className="hero-kicker"><span className="tiny-line"/>ASKWAY · A WAY TO EXPLORE</div>
          <h1 id="home-title" data-story-heading tabIndex={-1}><span>让城市探索，</span><span className="hero-gold">自有方向。</span></h1>
          <p className="hero-description">从心之所向，到脚下的旅程。<br/>在城市与海之间，走出自己的节奏。</p>
          <Link to="/experience/" className="story-city-link">开启自己的旅程<ArrowUpRight size={18} aria-hidden="true"/></Link>
        </div>
        <div className="hero-coordinates"><span>22°16′ N / 113°35′ E</span><span>珠海 · 日月贝 / 实景摄影</span></div>
        <div className="container hero-bottom">
          <a href="#story" className="scroll-cue"><ArrowDown size={18} aria-hidden="true"/><span>循着海风，向下看</span></a>
          <a href="#product-intro" className="story-skip">直接看旅程体验<ArrowUpRight size={16} aria-hidden="true"/></a>
        </div>
      </section>

      <section id={sticky ? undefined : 'story'} tabIndex={-1} className="route-story story-panel story-route" data-story-panel="route" aria-labelledby="route-story-title">
        <div className="container story-section-heading"><Eyebrow number="01">FROM A SPARK, TO A WAY</Eyebrow><span>一座城市，慢慢走。</span></div>
        <div className="container route-story-grid">
          <div className="route-story-copy">
            <h2 id="route-story-title" data-story-heading tabIndex={-1}>让心之所向，<br/>连成<span className="text-brand">一段旅程。</span></h2>
            <p>想去的地方、能用的时间、喜欢的节奏。<br className="desktop-only"/>从海面的一点光，到一条清楚的线，<br className="desktop-only"/>把每个重要的想法，认真放在一起。</p>
            <Link to="/product/" className="text-link">看看旅程如何连起来<ArrowUpRight size={18} aria-hidden="true"/></Link>
          </div>
          <RouteDiagram className="home-route-diagram" flowing={false}/>
        </div>
        <div className="container route-story-foot"><span>先看清条件，再选择方向。</span><p>三站为路线示意。实际安排由你核对、比较与确认。</p></div>
      </section>

      {sticky && theatreMedia}
      <section id={sticky ? undefined : 'city-detail'} tabIndex={-1} className="story-panel story-theatre" data-story-panel="theatre" aria-labelledby="story-theatre-title">
        {!sticky && theatreMedia}
        <div className="container story-theatre-content">
          <div className="story-theatre-copy"><Eyebrow number="02">BETWEEN THE CITY AND THE SEA</Eyebrow>
            <h2 id="story-theatre-title" data-story-heading tabIndex={-1}>在城市与海之间，<br/>看见<span>珠海。</span></h2>
            <p>靠近一点，读懂一座建筑的轮廓。<br/>再慢一点，留心旅程经过的风景。</p>
            <Link to="/about/" className="text-link">认识问途的出发点<ArrowUpRight size={18} aria-hidden="true"/></Link>
          </div>
          <figure className="story-detail-frame">
            <div>{photograph('architecture.webp', 850, 1133, '实景摄影：日月贝壳板、外露结构与玻璃曲面的建筑细节', 'story-detail-photo')}</div>
            <figcaption><span>日月贝 · 建筑细部</span><a href="https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_13.jpg" target="_blank" rel="noreferrer">实景摄影 / 钉钉 · CC BY-SA 4.0<ArrowUpRight size={13} aria-hidden="true"/></a></figcaption>
          </figure>
        </div>
        <div className="container story-theatre-caption"><span><MapPin size={14} aria-hidden="true"/>珠海大剧院 · 日月贝</span>
          <a href="https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_23.jpg" target="_blank" rel="noreferrer">实景摄影 · 钉钉 / CC BY-SA 4.0<ArrowUpRight size={14} aria-hidden="true"/></a></div>
      </section>

      <section id={sticky ? undefined : 'product-intro'} tabIndex={-1} className="story-panel story-product" data-story-panel="product" aria-labelledby="experience-preview-title">
        <div className="container story-product-grid">
          <div className="story-product-copy"><Eyebrow number="03">YOUR WAY, YOUR CHOICE</Eyebrow>
            <h2 id="experience-preview-title" data-story-heading tabIndex={-1}>每一步安排，<br/>都由<span className="text-brand">你来决定。</span></h2>
            <p>核对想法，比较候选，再确认安排。<br className="desktop-only"/>变化看得明白，采用之后也能撤销一次。</p>
            <ol className="story-decisions" aria-label="旅程决定步骤"><li><span>01</span>核对条件</li><li><span>02</span>比较取舍</li><li><Check size={15} aria-hidden="true"/>确认采用</li></ol>
            <div className="story-product-actions"><Action to="/experience/">开始旅程体验</Action><Link to="/product/#demo" className="text-link">先看产品如何使用<ArrowUpRight size={18} aria-hidden="true"/></Link></div>
          </div>
          <div className="story-product-preview"><ExperiencePreview compact/></div>
        </div>
        <p className="container story-product-scope">公开参考点与规则估算 · 二维路线与城市场景均为示意。<Link to="/about/#reference">查看资料与使用范围<ArrowUpRight size={14} aria-hidden="true"/></Link></p>
      </section>
      {motionAllowed && visible && ownsSurface && <DecorationBoundary><Suspense fallback={null}>
        <SeaRouteParticles openingRef={rootRef} viewportRef={viewportRef} controller={controller}/>
      </Suspense></DecorationBoundary>}
      <nav className="story-chapter-nav" aria-label="城市故事章节">{storyChapters.map((chapter, index) =>
        <a key={chapter.phase} href={'#' + chapter.anchor} aria-current={phase === chapter.phase ? 'step' : undefined}>
          <span>0{index + 1}</span><span>{chapter.label}</span></a>)}</nav>
    </div>
  </div>;
}
