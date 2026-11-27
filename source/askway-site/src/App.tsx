import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import { Action, Eyebrow } from './components/Shared';
import Home from './pages/Home';
import Product from './pages/Product';
import Experience from './pages/Experience';
import Cooperation from './pages/Cooperation';
import About from './pages/About';
import useMotion from './hooks/useMotion';
import { canonicalUrl, normalizePagePath, pages, site } from './site';
import { PresentationMotionControl, PresentationMotionProvider, usePresentationMotion } from './motion/PresentationMotion';
function NotFound(){return <section className="not-found container"><Eyebrow>A DIFFERENT WAY</Eyebrow><h1>这条路，<br/>我们还没有走到。</h1><p>回到问途首页，重新找到出发的方向。</p><Action to="/">回到首页</Action></section>;}
function SiteApp(){
  const location=useLocation(),action=useNavigationType(),mainRef=useRef<HTMLElement>(null);
  const { motionAllowed } = usePresentationMotion();
  useMotion(mainRef,location.pathname,motionAllowed);
  useEffect(()=>{
    const info=pages[normalizePagePath(location.pathname) as keyof typeof pages];
    document.title=info?.title||'页面未找到 · 问途 AskWay';
    document.querySelector('meta[name="description"]')?.setAttribute('content',info?.description||'重新找到出发的方向。');
    const canonical=canonicalUrl(location.pathname);
    const link=document.querySelector<HTMLLinkElement>('link[rel="canonical"]')||document.head.appendChild(document.createElement('link'));
    link.rel='canonical';link.href=canonical;
    for(const [property,content] of Object.entries({'og:title':info?.title||document.title,'og:description':info?.description||'','og:url':canonical,'og:type':'website','og:image':site.url+'/assets/hero.webp'})){
      const meta=document.querySelector<HTMLMetaElement>('meta[property="'+property+'"]')||document.head.appendChild(document.createElement('meta'));
      meta.setAttribute('property',property);meta.content=content;
    }
    const robots=document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if(info)robots?.remove();
    else{const tag=robots||document.head.appendChild(document.createElement('meta'));tag.name='robots';tag.content='noindex';}
    if(location.hash){requestAnimationFrame(()=>{let id=location.hash.slice(1);try{id=decodeURIComponent(id);}catch{/* Keep malformed fragments usable as literal IDs. */}const target=document.getElementById(id);target?.scrollIntoView();if(target){target.tabIndex=-1;target.focus({preventScroll:true});}});}
    else if(action!=='POP'){window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}));}
  },[location.pathname,location.hash,location.key,action]);
  return <><a className="skip-link" href="#main">跳到主要内容</a><SiteHeader/><main ref={mainRef} id="main" tabIndex={-1}><Routes><Route path="/" element={<Home/>}/><Route path="/experience/" element={<Experience/>}/><Route path="/product/" element={<Product/>}/><Route path="/cooperation/" element={<Cooperation/>}/><Route path="/about/" element={<About/>}/><Route path="*" element={<NotFound/>}/></Routes></main><SiteFooter/><PresentationMotionControl/></>;
}
export default function App(){ return <PresentationMotionProvider><SiteApp/></PresentationMotionProvider>; }
