import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { asset } from '../site';
import '../styles/immersive.css';

export type CityIllustrationKind = 'coast' | 'theatre' | 'landmarks';
export interface CityIllustrationSource {
  kind: CityIllustrationKind;
  src: string;
  alt: string;
  label: string;
  description: string;
  isRender: boolean;
}

// Rendered sources are added only after their actual output has been verified.
// Until then the existing licensed photography remains clearly identified.
const illustrations: Record<CityIllustrationKind, {
  rendered?: string;
  fallback: string;
  renderAlt: string;
  photoAlt: string;
  description: string;
}> = {
  coast: {
    rendered: 'realism/coastal-overview.webp',
    fallback: 'coast.webp',
    renderAlt: '写实风格场景渲染：海岸建筑、海面反光与远处的山形',
    photoAlt: '真实摄影：从野狸岛眺望珠海海岸与城市天际',
    description: '海岸、城市与远山的空间关系',
  },
  theatre: {
    rendered: 'realism/theatre-dusk.webp',
    fallback: 'hero.webp',
    renderAlt: '写实风格场景渲染：暮色里的日月贝建筑与海面倒影',
    photoAlt: '真实摄影：珠海大剧院日月贝与海岸城市景观',
    description: '日月贝建筑与海岸的相遇',
  },
  landmarks: {
    rendered: 'realism/route-landmarks.webp',
    fallback: 'coast.webp',
    renderAlt: '写实风格场景渲染：珠海海岸地标、城市建筑层次与海面景观',
    photoAlt: '真实摄影：珠海海岸城市景观，作为城市场景的视觉参考',
    description: '把海岸地标与城市层次放在同一幅画面里',
  },
};

export function cityIllustrationSource(kind: CityIllustrationKind, fallback = false): CityIllustrationSource {
  const source = illustrations[kind];
  const isRender = Boolean(source.rendered && !fallback);
  return {
    kind,
    src: asset(isRender ? source.rendered! : source.fallback),
    alt: isRender ? source.renderAlt : source.photoAlt,
    label: isRender ? '写实风格渲染 · 场景示意' : '真实摄影 · 视觉参考',
    description: source.description,
    isRender,
  };
}

export function CityThumbnail({ kind }: { kind: CityIllustrationKind }) {
  const [failedKind, setFailedKind] = useState<CityIllustrationKind | null>(null);
  const source = cityIllustrationSource(kind, failedKind === kind);
  useEffect(() => { setFailedKind(null); }, [kind]);
  return <span className={`city-illustration city-illustration--${kind}`} aria-hidden="true">
    <span className="city-illustration__image"><img key={source.src} src={source.src} alt="" width="160" height="100" loading="lazy" decoding="async"
      onError={() => { if (source.isRender) setFailedKind(kind); }}/></span>
  </span>;
}

interface CityIllustrationProps {
  kind: CityIllustrationKind;
  className?: string;
  caption?: ReactNode | false;
  decorative?: boolean;
  depth?: boolean;
  onSourceChange?: (source: CityIllustrationSource) => void;
}

export default function CityIllustration({ kind, className = '', caption, decorative = false, depth = false, onSourceChange }: CityIllustrationProps) {
  const figureRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [failedKind, setFailedKind] = useState<CityIllustrationKind | null>(null);
  const fallback = failedKind === kind;
  const source = useMemo(() => cityIllustrationSource(kind, fallback), [kind, fallback]);
  useEffect(() => { setFailedKind(null); }, [kind]);
  useEffect(() => { onSourceChange?.(source); }, [source, onSourceChange]);
  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }, []);

  const move = (event: PointerEvent<HTMLElement>) => {
    if (!depth || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = event.currentTarget;
    const bounds = host.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      host.style.setProperty('--city-depth-x', `${x * 10}px`);
      host.style.setProperty('--city-depth-y', `${y * 7}px`);
      frameRef.current = null;
    });
  };
  const reset = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    figureRef.current?.style.setProperty('--city-depth-x', '0px');
    figureRef.current?.style.setProperty('--city-depth-y', '0px');
  };

  return <figure ref={figureRef} className={`city-illustration city-illustration--${kind} ${className}`}
    data-illustration-source={source.isRender ? 'render' : 'photograph'} data-depth={depth || undefined}
    onPointerMove={depth ? move : undefined} onPointerLeave={depth ? reset : undefined}>
    <div className="city-illustration__image"><img key={source.src} src={source.src} alt={decorative ? '' : source.alt}
      width={source.isRender || kind === 'theatre' ? 1920 : 1200} height={source.isRender ? 1080 : kind === 'theatre' ? 1280 : 900}
      loading="lazy" decoding="async" onError={() => { if (source.isRender) setFailedKind(kind); }}/></div>
    {caption !== false && <figcaption><span>{source.label}</span><span>{caption ?? source.description}</span></figcaption>}
  </figure>;
}
