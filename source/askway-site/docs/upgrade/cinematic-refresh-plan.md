# 问途 3.2 连续城市叙事实施计划

> **For agentic workers:** 使用 subagent-driven-development 按独立文件边界执行；逐项记录验证结果。

**Goal:** 以 3.1 为起点完成可审查的摄影转场主舞台、轻量手机阅读、共享展示策略及各页节奏升级。

**Architecture:** 首页四段共用一个原生滚动进度，HTML 负责标题、地名、图注和入口；视觉层仅处理摄影、路线与局部光点。共享展示策略管理用户暂停、减少动态、省流、后台与连续展示所有权。工作台业务状态继续使用原有控制器。

**Tech Stack:** React 18、TypeScript、Vite 5、现有 GSAP / Three.js、Playwright Core、axe 与 Lighthouse，不添加依赖。

**Spec:** `docs/design/问途官网深度改进指南.md`；基线 `d79fc5ce7e528a54464223e39ddeaf33f83a9ca9`，`feat/coastal-visual-refresh`，3.1.0。

**执行结果：** 本轮 Task 1–5 范围已完成并通过本地验收，详情见 [终稿报告](cinematic-refresh-verification.md)。正式离线母版、完整帧序列与影片仍属独立后续阶段；本轮正倒滚交付为带时间戳截图序列。

## 全局约束

- 所有写入只在 `D:/AAA大三上/软件工程` 内；临时与缓存使用工程 `.agent_tmp/`、`.agent_cache/`，进程环境先重定向。
- 保留原有未跟踪指南，维护实际 `askway-web/source/askway-site`，不混入另一份旧源码。
- 先完成 P0 / P1 摄影转场与 P3 阅读节奏，再完成本轮 P5 本地核验；正式离线运镜母版、全套序列、视频和实时相机增强属于独立后续素材阶段。
- 本轮明确称为摄影转场原型；不声称已交付同机位电影母版或已验证真实手机 GPU 性能。
- 摄影使用已有 CC BY-SA 素材；新增裁切保留署名、原图、许可、处理方式及 SHA-256。CG 保持场景示意标签。
- 保留五路由与 `#main/#story/#journey/#demo/#download/#contact/#reference`。本地静态发布目录随构建同步，外部发布不在本轮交付内。
- 正文与输入 16px；图注至少 12px；触控至少 44px；键盘焦点不进入媒体裁切容器。
- 子智能体仅 `gpt-6.1-sol`，独立文件负责人，最终审查实际差异和证据。

## Task 1：保存基线与关键素材

**Files:** `scripts/capture-cinematic.mjs`、`delivery/cinematic-refresh/baseline/`、`public/assets/cinematic/manifest.json`。

- [x] 保存当前 HEAD、初始状态、构建文档哈希、1440 / 390 / 320 / 720 CSS 等效缩放构图。
- [x] 当前构建独立运行三次移动模拟 Lighthouse，保留单轮与中位数，不排除慢运行。
- [x] 为城市开场独立制作手机裁图；路线使用原 SVG；近景使用真实 `architecture.webp` / `theatre.webp`；产品使用同规则 ExperiencePreview。
- [x] 检查横竖四构图、来源及传输预算；只生成本轮实际引用的资源。

## Task 2：共享展示策略与所有权

**Files:** `src/motion/PresentationMotion.tsx`、`src/motion/presentationPolicy.ts`、`src/hooks/useMotion.ts`、`src/components/ImmersiveShowcase.tsx`、`src/components/JourneyStage.tsx`、`tests/experience/presentation-policy.test.mjs`。

**Interfaces:** `usePresentationMotion()` 增加 `documentVisible`、`saveData`、`motionAllowed`；`usePresentationSurface(id, visible, priority)` 返回独占连续展示许可，展台优先级高于主舞台。暂停偏好仍只有现有 sessionStorage 键。

- [x] 对所有条件交集、同时可见的优先级、资源就绪前禁止运行写纯函数测试并确认失败。
- [x] 暂停 / 减少动态 / 省流 / 后台使实际自动调度停止；手动地图、相机和局部选择继续可用。
- [x] 展台局部海面开关与共享许可相交，不隐式解除全局暂停；离屏实例释放。
- [x] 普通 GSAP 排除新舞台照片，入场与一次光扫继续使用原模式。
- [x] JourneyStage compact 保留四阶段手动选择与键盘，取消第二段长 sticky。

## Task 3：一个连续摄影主舞台

**Files:** `src/features/cinematic/progress.ts`、`storyConfig.ts`、`useStoryProgress.ts`、`StoryStage.tsx`、`cinematic.css`、`src/components/CoastalOpening.tsx`、`SeaRouteParticles.tsx`、`src/pages/Home.tsx`、`tests/cinematic/progress.test.mjs`。

**Interfaces:** `storyProgress(scroll, start, height, viewport)` 夹限有限进度；`storyFrame(value, previous)` 产生章节、方向与转场参数；`StoryController.subscribe(listener)` / `getSnapshot()` 为照片、粒子共用进度与可暂停 activeTime。仅章节变化触发 React 更新。

```ts
p = clamp((scroll - start) / Math.max(height - viewport, 1));
phase = p < .18 ? 'city' : p < .50 ? 'route' : p < .80 ? 'theatre' : 'product';
```

- [x] 对非有限值、夹限、边界、正倒滚同构图、几何变化、停止后 activeTime 写有效测试并确认失败。
- [x] 先使四段静态排版成立，桌面短 sticky 共用四段，手机默认正常阅读与竖图。
- [x] 同一几何进度驱动照片、路线和粒子；布局读取只在测量事件，不每帧读取整页布局。
- [x] 全部标题 / 三站 / 图注 / 入口保留 HTML；装饰 chunk 故障保持静态可读；静态模式不改变桌面外层高度。
- [x] 原生 `#story`、跳过镜头至 `#product-intro`、正倒滚与直接打开锚点均可定位并聚焦可见文字。
- [x] 主舞台后进入正常阅读，自主探索展台保留；原四阶段概念收为 compact，不重复长叙事。

## Task 4：产品、关于、合作的阅读节奏

**Files:** `src/pages/Product.tsx`、`About.tsx`、`Cooperation.tsx`、`src/styles/cinematic-pages.css`。

- [x] 产品以纸白路线与清楚页内目录衔接演示 / 下载；保留实际结果地点和编辑后失效。
- [x] 关于以建筑局部、安静正文与资料范围为主；摄影图注对应来源。
- [x] 合作以目录式方向和表单为主；方向预选、首错聚焦、草稿失效和复制回退不变。
- [x] 统一小标题、留白、按钮、焦点与手机 16px 输入，不添加虚构统计或业务承诺。

## Task 5：回归、独立审查和本地交付

**Files:** `tests/experience/visual-refresh-browser.mjs`、`tests/browser.mjs`、`tests/regressions.mjs`、`tests/cinematic/browser.mjs`、`scripts/build.mjs`、`package.json`、`docs/upgrade/cinematic-refresh-verification.md`、`delivery/cinematic-refresh/`。

- [x] 按新舞台行为迁移旧滚动定位，保留旧键盘、概念步骤、菜单与业务断言，不删除失败行为。
- [x] 验证暂停不增长 draw-count / activeTime、后台 / 离屏停止、恢复不补播、减少动态切换、锚点和装饰资源失败。
- [x] 运行 typecheck、unit、experience、build、static、browser、regressions、download、workbench、scene、visual、realism 与 axe。
- [x] 保存四段桌面 / 手机 / 320px / 横屏与等效缩放截图、正倒滚时间戳截图序列、普通主舞台及实时展台各 10 秒独立记录。
- [x] 独立三次最终 Lighthouse 与同条件基线比较，记录所有单轮、总传输 / 新增字节、来源与构建哈希。
- [x] 独立审查需求 / 实际差异 / SSR / 暂停 / 回退 / 权限 / 证据，修复确认缺陷。
- [x] 构建和同步本地仓库静态根，核对五路由、basename、canonical、图片 preload 与来源；保存回退说明并清理本轮无用缓存。

## 自审

本轮每项接口都服务实际摄影转场，无空壳序列、影片或虚假素材路径。P2 解码 LRU / 正式序列和 P4 实时精修需独立母版与真机收益证明，不作为当前手机默认。实际手机、Safari、实际浏览器 200% 缩放、软键盘及屏幕阅读器如未实测会在报告明确列出。
