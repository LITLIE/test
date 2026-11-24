# AskWay Experience V2 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent feature units. Root integrates and verifies the shared contracts before delivery.

**Goal:** 实现有来源、可调整、可比较与可回退的城市旅程前端。

**Architecture:** 保留 React/Vite 静态预渲染，新增独立体验域。资料与确定性规划、版本 reducer、工作台和按需图形通过 contracts.ts 协作。

**Tech Stack:** React 18.3.1、Vite 5.4.21、TypeScript 5.5.4、GSAP 3.15.1、Three 0.170.0、Node test、Playwright Core。

**Spec:** docs/upgrade/design.md；用户提供的问途官网改造指南 1.1。

## Global Constraints

- 所有写入在本工作区；TEMP/TMP/npm cache/browser profile 指向项目内。
- curated 模式；不发布、不公开私有仓库、不调用生产服务、不发送真实邮件。
- 8—12 公开参考点，WGS84；入口未核实，unknown 不当作零费用或全天开放。
- 同一 plan/selectedPlaceId 驱动文字、二维和三维；草稿不改确认版。
- 保留下载入口、合作草稿、原测试与 /product/#demo；增加 /experience/ 静态正文。

## Task 1: 可恢复工程与干净依赖

**Files:** package.json、package-lock.json、.npmrc、scripts/build.mjs、scripts/serve.mjs。

- [x] 复制维护源码，建立 baseline 标签。
- [x] 删除自身 file: 依赖；设置 cache=.agent_cache/npm 和 ignore-scripts=true。
- [x] 使用 `npm install --package-lock-only --ignore-scripts` 后 `npm ci --ignore-scripts` 验证干净安装。
- [x] 运行原 `npm test`、`npm run typecheck`、`npm run build`。

## Task 2: 资料、规划与状态

**Files:** src/features/experience/contracts.ts、data/catalog.ts、data/catalog.schema.ts、domain/conditions.ts、domain/curated-planner.ts、domain/plan-delta.ts、state/experience.reducer.ts、tests/experience/*.test.mjs。

**Interfaces:** `proposeCuratedPlan(catalog, draft, basePlan, scope)` 返回 ProposalResult；`reduceExperience(state, action)` 返回独立版本状态；`canAdoptProposal(state, nowMs)` 校验围栏。

- [x] 使用手工 fixture 写测试：75 分钟合计成功、70 分钟必去冲突、必去/避开冲突、费用未知。
- [x] 写旧请求、草稿变化、基线失效、采用与撤销测试并观察初始失败。
- [x] 核对 8—12 个资料来源和公开许可，提供逐字段状态与估算策略。
- [x] 实现规划器与 reducer，运行 `node --experimental-strip-types --test tests/experience/*.test.mjs`。

## Task 3: 页面与工作台

**Files:** src/pages/Experience.tsx、src/features/experience/ui/*、state/useExperienceController.ts、styles/experience.css、src/pages/Home.tsx、Product.tsx、About.tsx、src/components/SiteHeader.tsx、SiteFooter.tsx、src/App.tsx、scripts/build.mjs。

**Interfaces:** 工作台读取 Catalog、ExperienceState，动作只通过 reducer；新路由静态预渲染正文。

- [x] 写浏览器主流程：模板→修改→核对→生成→详情→采用→调整→比较→采用→撤销。
- [x] 以明确标签区分草稿、待采用候选、当前版本与上一版本。
- [x] 接入条件织图、证据详情、时间轴、差分和减少步行情境。
- [x] 更新首页入口、产品/关于阶段文案和手机导航，保持原合作与下载行为。
- [x] 检查 360/390/768/1024/1440/1920 宽度和减弱动画。

## Task 4: 同数据地图与城市沙盘

**Files:** map/RouteMap2D.tsx、map/projection.ts、scene/ClientScene.tsx、scene/CitySandbox.tsx、docs/assets/ledger.md。

**Interfaces:** SceneProps 中 catalog、plan、previousPlan、selectedPlaceId、onSelectPlace、reducedMotion、playbackIndex。

- [x] 由坐标统一投影，二维显示选中地点、当前线和变化线，所有点有 DOM 可操作入口。
- [x] 程序化构建海岸、双贝地标与参考地点；客户端按需 import Three。
- [x] 显式旋转/缩放/复位；不拦截页面滚轮；静止不持续渲染。
- [x] 覆盖导入失败、WebGL 不支持、context lost、视区外/后台与离场资源释放。

## Task 5: 集成验收与交付

**Files:** tests/experience/browser-flow.mjs、tests/experience/scene-browser.mjs、delivery/*、docs/upgrade/verification.md、README.md。

- [x] 原单元、浏览器主流程、回归与下载检查通过；新增域测试通过。
- [x] 浏览器配置/TEMP 都在项目内，浏览器禁用 cache/crash report 外部写入。
- [x] 各页面静态正文、子路径、404、无 JS 基本导航与新路由刷新检查。
- [x] 真实浏览器截图与可访问性、性能测量；如无真机资料明确标为模拟。
- [x] 独立审查修复后交付源码、运行说明、实际证据和回退点。
