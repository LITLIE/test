# 问途官网 2.0 本地验收 · 2026-11-24

依据用户提供的《问途官网改造指南》1.1，采用“纸艺城市 × 精密行程”。本报告记录已执行的本地前端检查；未执行公网发布、真实手机或现场核验，未启用 R6 生产服务。

## 工程与环境

用户继续任务时将允许工作区更新为 C:/Users/wzc/.codex/visualizations/2026/11/24/01a20cdf-a1bb-7082-be4b-b97682fcc490，源码迁移至其中 askway-site 并重新干净安装。原 D: 副本与最初 C: 指南/官网目录此后仅为只读参考。

Node 22.23.1、React 18.3.1、Vite 5.4.21、TypeScript 5.5.4、GSAP 3.15.1、Three 0.170.0；Playwright Core 1.65.1、axe-core 4.14.1、Lighthouse 13.6.0。全部命令从当前工程根目录执行，浏览器预览 http://127.0.0.1:4173/。

自身 file: 依赖已移除。安装使用 ignore-scripts；TEMP/TMP、npm cache、浏览器 profile/AppData/cache/crash 定向工程内。未安装浏览器、修改系统配置、调用生产数据或发送真实邮件。

## 实际检查

| 检查 | 命令/证据 | 结果 |
| --- | --- | --- |
| 干净安装 | npm ci --ignore-scripts --no-audit --no-fund | 新工作区 196 packages，退出 0 |
| 类型 | npm run typecheck | 退出 0 |
| 构建 | npm run build | 5 页、404、sitemap、catalog、build-info，退出 0 |
| 原及新增逻辑 | node --experimental-strip-types --test tests/unit.test.mjs tests/experience/*.test.mjs | 57 / 57 |
| 原浏览器主流程 | node tests/browser.mjs | 18 / 18 |
| 原回归 | node tests/regressions.mjs | 11 / 11 |
| 下载预留 | node tests/download.mjs | 4 / 4 |
| 旅程闭环 | node tests/experience/browser-flow.mjs | 14 / 14 |
| 工作台边界 | node tests/experience/workbench-regressions.mjs | 7 / 7 |
| 三维与回退 | node tests/experience/scene-browser.mjs | 13 / 13 |
| 静态与无 JS | node tests/experience/static-site.mjs | 5 / 5 |
| /askway/ 子路径 | node tests/experience/subpath.mjs | 8 / 8 |
| 自动可访问性 | node tests/experience/quality.mjs | 14 状态，0 自动违规 |
| 摄影文字 | manual-contrast-samples.json | 34 段达到对应门槛 |

共 57 项逻辑测试、67 项交互浏览器检查与 13 项静态/子路径检查通过，未出现未处理 JS 错误。原检查结果交付至 delivery/legacy；本轮新检查位于 delivery/experience；历史 docs/verification.md 仅对应 v1。

| 页面 | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 首页 | 100 | 100 | 100 | 100 | 1352.59 ms | 0 | 0.5 ms |
| 体验页 | 100 | 100 | 100 | 100 | 1353.31 ms | 0 | 0 ms |

使用 390×844、DPR1、150ms RTT、1638.4Kbps、CPU4× 的 simulate 实验室参数。分类分数四舍五入，不代表每项优化建议消失，也不代表公网/真机/真实 INP。完整原始 JSON/HTML 见 delivery/quality。

## 数据与流程

10 点均为实际查询并保留来源/ODbL 许可的 OSM WGS84 公开参考点，入口未核实。开放、费用、无障碍为 null/unknown。停留、距离和交通为自拟估算，几何为示意连线；未下载地图瓦片或商业路线数据。

默认 180 分钟：城市阳台、海滨公园、日月贝，37 交通 + 85 停留 + 20 缓冲 = 142，余 38。改 120 分钟后保留城市阳台和日月贝，99 分钟、余 21，减少一个可选点。同行照顾为 128 分钟、余 52，参考步行 0.18km，缓冲增加。时间不足时明确冲突，不自动丢弃必去点。

手工 fixture 核对 15 + 50 + 10 = 75，70 分钟无解；expected 未调用规划器计算。未知费用不当作免费/预算满足，未知开放不当作全天开放。

新草稿、旧响应、取消回包、会话重置、TTL 和基线均有围栏。重复核对幂等；未应用/未澄清想法不能直接采用。候选可明确放弃，再撤销当前采用。撤销恢复上一版资料与条件并分配新单调版本标识。

## 图形、移动与实测修复

二维、三维、时间轴使用同一 plan/selectedPlaceId。首页和初始体验未请求 Three chunk，SSR 无 Canvas/WebGL。代表性软件 WebGL 实测 1 renderer、1,928 三角面、27 draw calls、DPR1；全 10 点与旧/新线和双高亮审计上限 2,676 / 29。geometry/material 释放事件 28/28、27/27。

静止帧计数稳定，出屏和隐藏暂停；手动操作停止预演。context lost、资源失败均保留当前版本与二维；三次切换每次仅一个 Canvas。隐藏状态明确模拟 visibilityState/hidden 事件。这些是 Edge headless + SwiftShader 测试，不等于手机 GPU/显存/帧率实测。

360/390/768/1024/1440/1920px 检查无横向溢出；五页 390/1440px 有截图和 axe。720px CSS 视口用于 1440px 200% 缩放等效布局。正文抽查至少 14px，输入 16px；手机条件/地图/路线、菜单与同页链接不锁正文。

旧产物实际复现并修复：重复核对失效、澄清被编辑绕过、缺少候选放弃、移动焦点、预演被手动操作覆盖、中文个/半误解析。相关回归全部转为通过。

暂停测试的两项修正依据：页首 Canvas 仍约有 76px 可见，改为验证真正出屏；隐藏模拟需同时设置 visibilityState/hidden 才符合浏览器语义。产品暂停逻辑无需为这两项测试改变。

摄影导航对比度不足已修复：合作 CTA 3.14→6.42，坐标 2.37→7.89，手机说明 3.17→5.66。关于手机孤字、分组语义与字号覆盖已修复。

## 限制、交付与回退

尚未实测真实中档手机、Safari、屏幕阅读器、真实用户 INP、公网 HTTPS/API 和现场道路入口。没有实时天气、客流、票务、预算或无障碍保证。软件下载待开放，合作是前端草稿。

Three runtime 505.08kB（gzip128.81kB）仍触发 Vite 500kB 分块提示；该模块按需加载，未进入初始请求。模型无外部纹理/GLB，初始性能已实测达预算。

保留本地分支与基线，交付可维护源码、静态包、证据与回退静态包。没有修改线上站点、私有仓库可见性或原 AskWay 项目。
