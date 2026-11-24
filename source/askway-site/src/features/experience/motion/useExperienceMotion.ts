import { useEffect, type RefObject } from 'react';

export default function useExperienceMotion(root: RefObject<HTMLElement>, key: string, reduced: boolean) {
  useEffect(() => {
    if (reduced || !root.current) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import('gsap').then(({ gsap }) => {
      if (cancelled || !root.current) return;
      const context = gsap.context(() => {
        gsap.fromTo('[data-experience-enter]', { y: 8 }, { y: 0, duration: .35, stagger: .025, ease: 'power2.out', clearProps: 'transform' });
      }, root.current);
      dispose = () => context.revert();
    }).catch(() => {});
    return () => { cancelled = true; dispose?.(); };
  }, [root, key, reduced]);
}
