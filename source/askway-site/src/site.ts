import { siteConfig } from '../site.config.mjs';
export const site = {...siteConfig,url:import.meta.env.VITE_SITE_URL||siteConfig.url};
export const asset = (name: string) => import.meta.env.BASE_URL + 'assets/' + name;
export const pages = {
  '/': { title: '问途 AskWay · 让城市探索，自有方向', description: '问途连接出游偏好、可行行程与现场游览。从珠海出发，让每一次城市探索，都有清晰的方向。' },
  '/product/': { title: '产品体验 · 问途 AskWay', description: '从说出想法到带上旅程，了解问途的商讨式规划、条件校验、方案调整和跨端执行，体验珠海交互演示。' },
  '/cooperation/': { title: '一起探索 · 问途 AskWay', description: '与问途共同探索城市内容共建、城市体验试点与目的地服务衔接。整理合作意向，开启下一段城市旅程。' },
  '/about/': { title: '关于问途 · AskWay', description: '问途从真实的城市游览问题出发，用可解释的规划与连贯的跨端体验，让旅行决定更清晰。' },
};
