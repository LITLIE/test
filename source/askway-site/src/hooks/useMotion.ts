import { useEffect, type RefObject } from 'react';
export default function useMotion(root:RefObject<HTMLElement>,key:string) {
  useEffect(()=>{
    let stopped=false;
    let cleanup:(()=>void)|undefined;
    Promise.all([import('gsap'),import('gsap/ScrollTrigger')]).then(([{gsap},{ScrollTrigger}])=>{
      if(stopped || !root.current)return;
      gsap.registerPlugin(ScrollTrigger);
      const media=gsap.matchMedia();
      media.add({motion:'(prefers-reduced-motion: no-preference)',desktop:'(min-width: 900px)'},context=>{
      if(!context.conditions?.motion)return;
      const ctx=gsap.context(()=>{
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(el=>{
          gsap.from(el,{y:24,opacity:0,duration:.75,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 91%',once:true}});
        });
        const hero=root.current?.querySelector<HTMLElement>('.hero');
        if(hero){
          gsap.from('[data-hero-title]',{y:22,duration:1.15,ease:'power3.out',stagger:.12});
          gsap.fromTo('.hero .route-line',{strokeDashoffset:100},{strokeDashoffset:0,duration:2,ease:'power2.inOut'});
          if(context.conditions?.desktop){
            gsap.to('[data-hero-image]',{yPercent:9,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.7}});
          }
        }
      },root);
      return()=>ctx.revert();
      });
      cleanup=()=>media.revert();
      document.fonts?.ready.then(()=>{if(!stopped)ScrollTrigger.refresh();});
    }).catch(()=>{cleanup?.();});
    return()=>{stopped=true;cleanup?.();};
  },[root,key]);
}
