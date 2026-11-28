import type { StoryPhase } from './progress';

export const storyChapters: { phase: StoryPhase; label: string; anchor: string; progress: number }[] = [
  { phase: 'city', label: '城市开场', anchor: 'city-opening', progress: 0 },
  { phase: 'route', label: '连成旅程', anchor: 'story', progress: .36 },
  { phase: 'theatre', label: '看见珠海', anchor: 'city-detail', progress: .66 },
  { phase: 'product', label: '由你决定', anchor: 'product-intro', progress: .985 },
];
export const heroMobileMedia = '(max-width: 899px) and (orientation: portrait)';
export const heroMobileAsset = 'cinematic/hero-mobile.webp';
