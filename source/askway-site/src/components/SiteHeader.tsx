import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Brand from './Brand';
const links = [{to:'/product/',label:'产品体验'},{to:'/cooperation/',label:'一起探索'},{to:'/about/',label:'关于问途'}];
export default function SiteHeader() {
  const location = useLocation();
  const [scrolled,setScrolled] = useState(false), [open,setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null), buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(()=>{ const onScroll=()=>setScrolled(window.scrollY>40);onScroll();window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll); },[]);
  useEffect(()=>setOpen(false),[location.key]);
  useEffect(()=>{const media=window.matchMedia('(min-width: 900px)');const resize=()=>{if(media.matches)setOpen(false);};media.addEventListener('change',resize);return()=>media.removeEventListener('change',resize);},[]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const content=[document.querySelector('main'),document.querySelector('footer')];
    content.forEach(el=>el?.setAttribute('inert',''));
    const controls=Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('a')||[]);
    controls[0]?.focus();
    const handle=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setOpen(false);buttonRef.current?.focus();}
      if(event.key==='Tab'){
        const all=[buttonRef.current,...controls].filter(Boolean) as HTMLElement[];
        const index=all.indexOf(document.activeElement as HTMLElement);
        if(event.shiftKey && index<=0){event.preventDefault();all[all.length-1]?.focus();}
        else if(!event.shiftKey && index===all.length-1){event.preventDefault();all[0]?.focus();}
      }
    };
    document.addEventListener('keydown',handle);
    return()=>{document.body.style.overflow=previous;content.forEach(el=>el?.removeAttribute('inert'));document.removeEventListener('keydown',handle);};
  },[open]);
  const solid=scrolled || location.pathname!=='/' || open;
  return <header className={'site-header '+(solid?'header-solid':'header-clear')}>
    <div className="container header-inner">
      <Brand light={!solid}/>
      <nav className="desktop-nav" aria-label="主导航">
        {links.map(link=><NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}
      </nav>
      <Link to="/cooperation/#contact" className="header-cta">探讨合作<ArrowUpRight size={16} aria-hidden="true"/></Link>
      <button ref={buttonRef} className="menu-toggle" type="button" aria-label={open?'关闭导航':'打开导航'} aria-controls="mobile-menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button>
    </div>
    {open && <div className="mobile-menu" id="mobile-menu" ref={menuRef}>
      <nav aria-label="移动主导航">{links.map((link,i)=><NavLink key={link.to} to={link.to}><span>0{i+1}</span>{link.label}<ArrowUpRight aria-hidden="true"/></NavLink>)}
      <Link to="/cooperation/#contact" className="mobile-contact">探讨合作<ArrowUpRight aria-hidden="true"/></Link></nav>
      <p>让每一次城市探索，都有清晰的方向。</p>
    </div>}
  </header>;
}
