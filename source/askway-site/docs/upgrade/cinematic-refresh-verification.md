# 问途 3.2 连续城市叙事本地验收

本轮交付为 **3.2.0 摄影转场原型**：城市开场、三站路线示意、日月贝摄影近景和纸白产品交接共用一个原生滚动主舞台；手机默认竖版摄影与正常阅读。产品、关于、合作的阅读节奏与紧凑四阶段概念同步调整，工作台继续使用原有条件核对、候选比较、采用和一次撤销流程。

范围对应设计指南的 P0/P1、P3 与本轮 P5 本地核验。P2 正式帧序列与解码缓存、P4 高精度离线相机母版及影片属于后续阶段。本轮没有将摄影裁切描述为连续电影运镜或测绘模型，也没有启用真实生产服务、公开软件下载或外部发布。

## 验收版本与环境

| 项目 | 本轮身份 |
| --- | --- |
| 维护源码 | `askway-web/source/askway-site` |
| Git 基线及当前 HEAD | `d79fc5ce7e528a54464223e39ddeaf33f83a9ca9`；3.2 改动仍未提交，HEAD 单独不能代表本轮实现 |
| 最终首页 SHA-256 | `da5966f2246aca56ca4f0d1819e082033b50fc4d524e25a5d83048e90bfb8b40` |
| 3.1 基线首页 SHA-256 | `50956941b9a2451de1f2deffeed4fe2af2038e44a597d0eec04b42c24050922f` |
| 主构建 | `siteVersion=3.2.0`、`presentation=city-story-photographic-prototype-v1`、`base=/`；构建时间 `2026-11-27T15:11:04.689Z` |
| 本地浏览器 | Edge `158.0.4370.45`；Node `v22.23.1`；主预览 `http://127.0.0.1:4173/` |
| 主机 | LENOVO 83DF、Intel Core i9-14900HX；GPU 清单含 Intel UHD 与 RTX 4060 Laptop；这份清单不证明 headless WebGL 使用了硬件 GPU |

本轮记录使用构建首页、具体源文件、manifest 与资源哈希确认身份。最终截图、正倒滚、axe 与子路径复核采用恢复执行后的当前证据；子路径构建因 basename 不同而拥有不同 HTML 哈希，通过同源代码哈希建立对应关系。

此前 `review/visual/`、早期 `final/subpath/verification.json` 以及旧构建截图保留为历史过程。其首页哈希包括 `89eb0624…`、`07c6dd9e…`、`dc48f26a…`，不能自动代替本轮最终构建的验收。

## 实施与来源

- 首页以同一个几何进度驱动摄影、路线、局部光点及章节交接；标题、地名、署名、按钮和锚点继续由 HTML 提供。暂停与降级保留阅读结构；装饰模块失败或无 JavaScript 时仍有可读正文和照片。
- 用户暂停、系统减少动态、省流、文档隐藏、离屏与展示所有权共同约束自动效果。展台局部海面开关和手动相机选择不能解除全局暂停；进入体验路由释放官网展示层。暂停检查使用实际 draw-count 和 activeTime，恢复不补播隐藏时间。
- 原四阶段概念收为紧凑手动内容，保留方向键、Home、End 和原生说明展开。旧滚动定位迁移到新舞台几何，合作草稿失效、首错聚焦、复制回退、菜单、下载状态及工作台版本围栏保留。
- 产品末段的只读候选来自真实受控规则：城市阳台 → 海滨公园 → 日月贝，预算 180 分钟、规则估算 142 分钟、余量 38 分钟。SVG 与 HTML 来自同一候选；首页海滨公园 → 香炉湾 → 日月贝仍标为路线示意。
- 四张摄影资源的字节数与 SHA-256 已逐项匹配 manifest。原摄影作者为 Charlie fong 与钉钉，许可为 CC BY-SA 4.0；独立 `hero-mobile.webp` 为 720×1280、85,322 B，保留原图、作者、许可与处理记录。可编辑处理代码为 `scripts/export-cinematic-posters.py`，HTML 构图和锚点保存在 cinematic 源码中。既有三维继续标为场景示意，公开点位保留 OpenStreetMap/ODbL 来源。

来源入口：[资源账本](../assets/ledger.md)、[摄影 manifest](../../public/assets/cinematic/manifest.json)、[公开署名](../../public/asset-credits.json)。

本轮新增位图仅竖版海报 85,322 B（83.32 KiB）；四张摄影文件合计 576,454 B。其余照片和三维资产沿用既有来源。手机主图命中 hero-mobile.webp，初始资源中未重复请求桌面 hero.webp；浏览器可能按 lazy 距离阈值预取低优先级建筑细节图。

| 本地视口 | 初始传输 B | 暂停后完整阅读传输 B | 初始已加载图片 RGBA 估算 B | 完整阅读图片 RGBA 估算 B |
| --- | ---: | ---: | ---: | ---: |
| desktop | 1001699 | 1752793 | 5760000 | 38580200 |
| mobile | 1024075 | 1505799 | 7538600 | 32421800 |

[资源记录](../../delivery/cinematic-refresh/final/resource-budget.json) 采用新 profile、未压缩的本地 HTTP。完整阅读先明确暂停，所以不计自动三维的追加下载。RGBA 按自然尺寸×4、相同 URL 只计一次；Canvas 和 JS heap 分列在原始记录中。它不是解码缓存或整页 GPU 峰值实测。当前没有应用层帧序列/LRU，48/32MiB 的正式序列缓存预算留给 P2 验证。

## 功能、静态与布局结果

TypeScript 类型检查与最终构建成功。逻辑测试 **107/107**：基础 unit 9/9，experience/cinematic 98/98。

| 行为检查 | 通过 / 总数 |
| --- | ---: |
| 静态页面 | 5/5 |
| 原浏览器流程 | 18/18 |
| 回归 | 11/11 |
| 视觉与共享暂停 | 5/5 |
| 连续舞台与故障回退 | 19/19 |
| 下载状态 | 4/4 |
| 工作台 | 7/7 |
| 三维场景 | 13/13 |
| 写实展台 | 5/5 |
| 合计 | **87/87** |

命令与逐项输出保存在 [final/checks](../../delivery/cinematic-refresh/final/checks/) 的 `*-resume.log`。连续舞台覆盖正倒滚、直接锚点、暂停跨页、实时减少动态切换、省流、后台/离屏停止、动态所有权、资源失败、无 JS、真实只读候选与媒体交接。

[最终布局记录](../../delivery/cinematic-refresh/final/layouts/records.json) 覆盖 1440 桌面、390 手机视口、320 窄屏、720 CSS 等效缩放和 844 横屏：页面宽度等于视口，首页只有一个 h1。四段构图、产品入口、正常阅读和完整页面截图均保留。720 视口只代表 CSS 等效布局，不是实际浏览器 200% 缩放测试。

[正倒滚记录](../../delivery/cinematic-refresh/final/story/records.json) 与 [离线对照页](../../delivery/cinematic-refresh/final/story/review.html) 包含 12 条记录：桌面正向/反向各四段，手机正常阅读四段，另附四张手机完整章节图。四个相同进度的 CSS 构图参数完全一致；时间型光点和截图像素并不因此保证逐像素相同。输入为 Playwright 浏览器协议 wheel，属于受控输入，非真人触摸。交付为带时间戳截图序列，不称为连续视频；取图和等待解码开销不纳入独立调度性能。

[子路径恢复复核](../../delivery/cinematic-refresh/final/subpath/verification-resume.json) 使用 `/askway-check/` 隔离构建：五路由状态/canonical、九项资源 MIME 与前缀、同源代码哈希、SPA 跳转、地图及浏览器后退均通过。此结果证明本地 basename 接入；没有执行外部站点部署。

## 可访问性与实际修复

[最终 axe 记录](../../delivery/cinematic-refresh/final/accessibility/accessibility-summary.json) 覆盖五路由的桌面/手机及体验候选、依据状态，共 **14 个状态，0 violations**。记录仍包含 `incomplete`，例如渐变或摄影背景下自动工具不能确定对比度，需要人工复核；不能据此宣称完整 WCAG 合规、屏幕阅读器或真实触控已通过。

本轮收尾实际复现并处理了三处问题：

1. 展台懒加载提示的 CSS spinner 在全局状态为 paused 时仍继续旋转。修复将 `.immersive-loading>span` 的 `animation-play-state` 接入共享暂停。修前诊断观察到动画时间继续增长；修后 playState 为 paused，前后 currentTime 保持一致。证据为 `final/checks/failure-diagnostics-before-fix.json` 与 `failure-diagnostics-resume.json`。
2. 手机正常阅读隐藏桌面 theatre 摄影，浏览器正确延迟其 lazy 请求；原取证脚本仍等待所有图片解码，造成 10 秒超时。实际可见 architecture 摄影已加载，隐藏 theatre 的尺寸为 0、父层 `display:none`。取证等待改为仅检查有尺寸且无隐藏祖先的实际媒体，并补入 sticky 近景文字面板之外的同级摄影。最终四个手机章节记录完整，失败尝试也保留于 `record-attempt-resume.log`，没有用删除失败记录掩盖过程。

3. 地图 SVG 比例尺原本只有 aria-label，没有可命名角色。补充非交互 role=img 后重新构建并重跑全部浏览器检查；最终 axe 的 aria-prohibited-attr 待确认项消失，仅保留摄影/渐变对比度的人工复核。独立审查确认该比例尺内部只有图形与文字，没有改变选点或地图操作。

## 冷启动性能与独立调度

冷启动基线与最终构建须保持相同网络、CPU、视口和工具设置，逐轮保存，不排除慢运行。LCP、CLS、TBT 为实验室指标；中位数不是每次加载保证，TBT 不能代替真实 INP。

同条件使用移动 390×844 / DPR 1、150ms RTT、1638.4Kbps 模拟吞吐和 CPU 4 倍放慢。三轮均新建浏览器 profile，工具、网络和 CPU 设置经逐项比对一致；宿主 benchmarkIndex 与各轮警告原样保留。

| 页面 | 版本 | Performance 中位数 | LCP 中位数 ms | CLS | TBT 中位数 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| 首页 | 3.1 本轮基线 | 97 | 2103.28 | 0 | 4 |
| 首页 | 3.2 终稿 | 98 | 1801.91 | 0 | 0 |
| 体验 | 3.1 本轮基线 | 97 | 2102.49 | 0 | 4 |
| 体验 | 3.2 终稿 | 96 | 2252.58 | 0 | 59 |

| 页面 / 版本 | 第 1 轮 | 第 2 轮 | 第 3 轮 |
| --- | --- | --- | --- |
| 首页 / baseline | 97 / 2103.28 / 0 / 3.5 | 97 / 2104.26 / 0 / 4 | 97 / 2102.42 / 0 / 22.5 |
| 首页 / final | 98 / 1801.91 / 0 / 6.5 | 98 / 1802.08 / 0 / 0 | 98 / 1801.78 / 0 / 0 |
| 体验 / baseline | 97 / 2102.72 / 0 / 4 | 97 / 2102.49 / 0 / 1.5 | 97 / 2102.31 / 0 / 8 |
| 体验 / final | 96 / 2252.71 / 0 / 59 | 96 / 2252.54 / 0 / 67.5 | 96 / 2252.58 / 0 / 33 |

单轮格式为分数 / LCP ms / CLS / TBT ms。首页 LCP 比本轮基线减少约 301ms；体验页增加约 150ms，TBT 中位数由 4ms 增至 59ms，仍在本轮 200ms 目标内。全部轮次的 Accessibility、Best Practices、SEO 为 100。

原始最终六份 Lighthouse JSON/HTML 在 [final/performance](../../delivery/cinematic-refresh/final/performance/)，本轮重新采集的 3.1 基线在 baseline/performance。比例尺语义修复前的三轮和调度样本完整保存在工作区本地目录 `delivery/cinematic-refresh/review/before-aria/`；该历史目录由 Git 忽略，没有删除或筛除单轮。历史 3.1 的慢运行继续保留于原 3.1 报告，未与本轮基线混用。

普通主舞台与实时展台的 10 秒记录独立于截图采集和 Lighthouse；报告须分别说明输入方式、rAF 调度、长帧、实际 draw-count、软件/硬件 WebGL 与仪器开销。headless rAF 间隔不能表述为手机 GPU 耗时或硬件帧率。

| 独立记录 | 实际时长 ms | p95 间隔 ms | 最大间隔 ms | >16.7ms 次数 | 长任务 | 实际绘制增量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 桌面主舞台 rAF | 10015.5 | 4.3 | 49.8 | 2 | 0 | 1155 |
| 手机静态阅读模拟 rAF | 10010.1 | 4.3 | 33.4 | 2 | 0 | 1150 |
| SwiftShader 展台 render-count | 10003.4 | 291.6 | 294.3 | 34 | 0 | 35 |

主舞台使用浏览器协议 wheel 输入，各轮记录 132 / 133 个 wheel 事件；测量 rAF 本身含采样开销。draw-count 仅统计光点 Canvas，不能表示全部 CSS 或 GPU 帧。

展台实际检测到 ANGLE / SwiftShader，10 秒内 35 次完成的 renderer.render 调用，约 3.5 次/秒。该机位为 64978 三角形、31 次 draw calls、DPR 1；软件结果不能作为硬件 30/60fps 证明。展台采样期间主舞台 activeTime 与 draw-count 增量均为 0，展示 owner 互斥通过。运行时未暴露场景 activeTime，报告保留 null。

原始记录：[桌面主舞台](../../delivery/cinematic-refresh/performance/story-scheduling.json)、[手机阅读模拟](../../delivery/cinematic-refresh/performance/story-scheduling-mobile.json)、[软件 WebGL 展台](../../delivery/cinematic-refresh/performance/showcase-scheduling.json)。三类采样独立、无截图或编码，所有长帧与原始样本保留。

## 本地发布产物、回退与权限

本地同步已执行 scripts/sync-publication.mjs；仓库静态根 D:/AAA大三上/软件工程/askway-web 与 dist 的 52 个输出文件逐项 SHA-256 相同，涵盖五页、404、资源、署名、catalog、站点地图、CNAME 和 build-info。首页 SHA 为 da5966f2246aca56ca4f0d1819e082033b50fc4d524e25a5d83048e90bfb8b40。

维护源码与资源的 147 项叶文件哈希及聚合指纹保存在 [results.json](../../delivery/cinematic-refresh/results.json)；源指纹为 4fe57d9a5039e3fb0ec5bfed5c51ed88771f50b9745e3f69c2cd453bff5617fa。Git HEAD 仍为基线，当前改动没有提交、推送或部署。

3.1 可恢复 ZIP 已生成并保留在工作区本地：16,850,737 B，SHA-256 23a38db857b653ec67e41fd5c29d1a451a4bc78b5e167359be49a86fe4a241e4。该 ZIP 由 Git 忽略；克隆仓库后可按回退说明从 `d79fc5c` 重新生成。归档包含基线源码与完整静态根；回退说明的隔离解压/预览步骤未在当前目录执行。

[归档完整性记录](../../delivery/cinematic-refresh/rollback/archive-verification.json) 核对全部 ZIP CRC、五页入口、首页资源引用及 3.1.0 版本。git archive 将首页 14 个换行转为 Windows CRLF；仅规范化该换行后，首页内容与 Git 原对象及本轮 3.1 基线完全一致。

[3.2→3.1 回退说明](cinematic-refresh-rollback.md) 使用 `d79fc5c` 完整归档，在工作区内新建隔离目录解压和预览，保护当前未提交源码、3.2 构建及已有服务。停止隔离服务即可返回当前 3.2；具体 ZIP 与哈希以最终交付记录为准。

全部创建、修改、临时、缓存、浏览器 profile 与本地副本限定在 `D:/AAA大三上/软件工程` 内。未安装依赖、下载新工具、修改系统配置或发布外部站点。清理应在证据保存和服务停止后执行，只针对已确认的工作区内本轮临时路径。

## 覆盖边界与后续工作

本轮覆盖本机 Edge、CSS 视口/媒体/后台 API 模拟、受控 wheel 输入及本地静态服务。**真实手机、Safari、实际浏览器 200% 缩放、软键盘、屏幕阅读器、真实 INP 与真实手机 GPU 性能未测。** 入口、费用、当日开放和无障碍现场资料继续保留未知状态；软件下载与生产服务保持各自的启用条件。

后续若启用 P2 全套序列、视频或 P4 高精度母版，需重新核对来源、首末帧交接、字节解码缓存、快速反滚、故障与真实目标设备预算；当前摄影原型证据不自动覆盖这些增强。
