# 独立审查记录

审查起点为 HEAD `d79fc5ce7e528a54464223e39ddeaf33f83a9ca9`（3.1）。最终范围为现有摄影素材支持的四章城市转场原型、共享展示策略、紧凑旅程预览及官网阅读节奏升级；正式离线运镜母版、完整帧序列、视频和真机增强不在本轮范围。

独立审查以只读源码和本地图片为依据，对照《问途官网深度改进指南》及实施计划，检查新 `src/features/cinematic`、`PresentationMotion` / `presentationPolicy`、`useMotion`、`SeaRouteParticles`、城市展台接入、紧凑 `JourneyPreview` / `JourneyStage`、首页及产品／关于／合作页接入、SSR 入口、静态构建预加载与相关回归测试迁移。重点为功能、可访问性、SSR、暂停恢复和资源释放；未发现其他可确认的重要源码缺陷。

唯一重要发现为 **[P2] 展台懒加载圈遗漏共享暂停**：加载 `CinematicCity` 时按全局暂停，Suspense 加载提示仍保留，而加载圈的无限 CSS 动画未响应共享状态。现已在 `src/styles/immersive.css` 补充 `html[data-presentation-motion=paused] .immersive-loading>span{animation-play-state:paused}`。独立审查已静态确认规则；根任务另行通过浏览器诊断确认修复前暂停时动画时间继续增长，修复后 `playState` 为 `paused` 且两次 `currentTime` 均为 29.158。证据：[修复前诊断](checks/failure-diagnostics-before-fix.json)、[修复后诊断](checks/failure-diagnostics-resume.json)。浏览器诊断由根任务执行，独立审查者未运行浏览器。

第二轮只读视觉复核检查当时构建的八张静帧：1440px 桌面正向 city／route／theatre／product，以及 390px 移动 section city／route／theatre／product。该轮首页 SHA 为 `2f1088c33ed30d4d9a6ca32a3930c21f4a3d30330061dfd3b6af391bc12878be`，原记录与图片已完整保存在工作区本地的 `delivery/cinematic-refresh/review/before-aria/story/`；该历史目录由 Git 忽略。未发现重要视觉缺陷：标题、地标、三站及图注可读；移动竖图保留双贝轮廓，标题与建筑分开；主按钮可读；产品预览标签、顺序清单和版权链接在卡片边界内，固定暂停按钮未遮挡关键内容。比例尺语义修复后，根任务重新保存了当前终稿截图与对应哈希。

本独立审查未运行构建、浏览器、性能测量或完整测试套件；这些结果由根任务验收报告负责。图片复核仅覆盖上述静帧，不代表连续过渡／连续录像、其他视口、真实手机或硬件 GPU、Safari、实际 200% 缩放、软键盘及屏幕阅读器已经验证。

补充语义复核：只读确认 `src/features/experience/map/RouteMap2D.tsx:315` 的非交互比例尺 `g.coastal-map__scale` 已增加 `role="img"`，并保留包含当前比例尺数值的 `aria-label`。该组只包含 `path` / `text`，作为单一比例尺图形提供可访问名称适用；外层 SVG 仍为地图 `group`，地点按钮、键盘处理和地图控制不受此角色影响。此次仅确认源码语义，未运行浏览器或 axe；根任务负责新构建的重新验收。修前记录保存于 `review/before-aria/`。
