import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import { Action, Eyebrow } from './components/Shared';
import Home from './pages/Home';
import Product from './pages/Product';
import Cooperation from './pages/Cooperation';
import About from './pages/About';
import useMotion from './hooks/useMotion';
import { pages, site } from './site';
function NotFound(){return <section className="not-found container"><Eyebrow>A DIFFERENT WAY</Eyebrow><h1>这条路，<br/>我们还没有走到。</h1><p>回到问途首页，重新找到出发的方向。</p><Action to="/">回到首页</Action></section>;}
export default function App(){
  const location=useLocation(),action=useNavigationType(),mainRef=useRef<HTMLElement>(null);
  useMotion(mainRef,location.pathname);
  useEffect(()=>{
    const info=pages[location.pathname as keyof typeof pages];
    document.title=info?.title||'页面未找到 · 问途 AskWay';
    document.querySelector('meta[name="description"]')?.setAttribute('content',info?.description||'重新找到出发的方向。');
    const canonical=site.url+location.pathname;
    const link=document.querySelector<HTMLLinkElement>('link[rel="canonical"]')||document.head.appendChild(document.createElement('link'));
    link.rel='canonical';link.href=canonical;
    for(const [property,content] of Object.entries({'og:title':info?.title||document.title,'og:description':info?.description||'','og:url':canonical})){
      const meta=document.querySelector<HTMLMetaElement>('meta[property="'+property+'"]')||document.head.appendChild(document.createElement('meta'));
      meta.setAttribute('property',property);meta.content=content;
    }
    if(location.hash){requestAnimationFrame(()=>{const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));target?.scrollIntoView();if(target){target.tabIndex=-1;target.focus({preventScroll:true});}});}
    else if(action!=='POP'){window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}));}
  },[location.pathname,location.hash,location.key,action]);
  return <><a className="skip-link" href="#main">跳到主要内容</a><SiteHeader/><main ref={mainRef} id="main" tabIndex={-1}><Routes><Route path="/" element={<Home/>}/><Route path="/product/" element={<Product/>}/><Route path="/cooperation/" element={<Cooperation/>}/><Route path="/about/" element={<About/>}/><Route path="*" element={<NotFound/>}/></Routes></main><SiteFooter/></>;
}
