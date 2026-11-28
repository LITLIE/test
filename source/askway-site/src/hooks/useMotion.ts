import { useEffect, type RefObject } from 'react';
export default function useMotion(root:RefObject<HTMLElement>,key:string,enabled=true) {
  const websiteMotion = enabled && !key.startsWith('/experience');
  useEffect(()=>{
    if(!websiteMotion || !root.current || !('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){(entry.target as HTMLElement).dataset.lightSweep='seen';observer.unobserve(entry.target);}});
    },{threshold:.2});
    root.current.querySelectorAll('[data-light-sweep]:not([data-light-sweep="seen"])').forEach(element=>{
      if(!element.closest('.cinematic-story'))observer.observe(element);
    });
    return()=>observer.disconnect();
  },[root,key,websiteMotion]);
  useEffect(()=>{
    if(!websiteMotion)return;
    let stopped=false;
    let cleanup:(()=>void)|undefined;
    const ownedTriggers = new Set<{ refresh: () => void }>();
    Promise.all([import('gsap'),import('gsap/ScrollTrigger')]).then(([{gsap},{ScrollTrigger}])=>{
      if(stopped || !root.current)return;
      gsap.registerPlugin(ScrollTrigger);
      const media=gsap.matchMedia();
      media.add({motion:'(prefers-reduced-motion: no-preference)',desktop:'(min-width: 900px)'},context=>{
      if(!context.conditions?.motion)return;
      const ctx=gsap.context(()=>{
        root.current?.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el=>{
          if(el.closest('.cinematic-story') || el.dataset.motionRevealed==='true')return;
          // A disabled presentation falls back to readable content. Do not replay
          // its entrance when the page becomes visible or the user resumes.
          el.dataset.motionRevealed='true';
          const entrance=gsap.from(el,{y:24,opacity:0,duration:.75,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 91%',once:true}});
          if(entrance.scrollTrigger)ownedTriggers.add(entrance.scrollTrigger);
        });
        const hero=Array.from(root.current?.querySelectorAll<HTMLElement>('.hero') || []).find(element=>!element.closest('.cinematic-story'));
        if(hero){
          if(hero.dataset.motionEntered!=='true'){
            hero.dataset.motionEntered='true';
            gsap.from(hero.querySelectorAll('[data-hero-title]'),{y:22,duration:1.15,ease:'power3.out',stagger:.12});
          }
          if(context.conditions?.desktop){
            const parallax=gsap.to(hero.querySelectorAll('[data-hero-image]'),{yPercent:9,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.7}});
            if(parallax.scrollTrigger)ownedTriggers.add(parallax.scrollTrigger);
          }
        }
      },root);
      return()=>ctx.revert();
      });
      cleanup=()=>media.revert();
      document.fonts?.ready.then(()=>{
        if(!stopped)ownedTriggers.forEach(trigger=>trigger.refresh());
      });
    }).catch(()=>{cleanup?.();});
    return()=>{stopped=true;cleanup?.();};
  },[root,key,websiteMotion]);
}
