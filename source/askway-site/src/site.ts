import { siteConfig } from '../site.config.mjs';
export const site = {...siteConfig,url:(import.meta.env.VITE_SITE_URL||siteConfig.url).replace(/\/$/,'')};
export const asset = (name: string) => import.meta.env.BASE_URL + 'assets/' + name;
export const pages = {
  '/': { title: '问途 AskWay · 让城市探索，自有方向', description: '问途连接出游偏好、可行行程与现场游览。从珠海出发，让每一次城市探索，都有清晰的方向。' },
  '/experience/': { title: '旅程体验 · 问途 AskWay', description: '用珠海公开参考资料核对条件、形成候选、比较取舍并确认采用。二维地图、写实三维城市场景示意与行程读取同一份受控方案。' },
  '/product/': { title: '产品体验 · 问途 AskWay', description: '了解问途的条件核对、方案比较与产品方向。进入新的受控旅程体验，或查看保留的三点概念演示与软件下载状态。' },
  '/cooperation/': { title: '一起探索 · 问途 AskWay', description: '与问途共同探索城市内容共建、城市体验试点与目的地服务衔接。整理合作意向，开启下一段城市旅程。' },
  '/about/': { title: '关于问途 · AskWay', description: '了解问途的产品出发点、公开参考资料与受控体验范围。从清楚的规划，走向逐步核实的城市场景。' },
};
export const normalizePagePath = (pathname: string) => pathname.replace(/\/+$/,'') + '/';
export const canonicalUrl = (pathname: string) => site.url + normalizePagePath(pathname);
