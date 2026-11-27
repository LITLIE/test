# 问途官网视觉改造实施计划

> 按用户提供的《问途官网前端改造指南》执行。以 `262872ae7f6baac08ab7b6efe30765ef5e1e79a3` 为基线，使用 writing-plans 与 subagent-driven-development 的任务划分和独立审查流程。

**目标：** 让城市摄影、问途品牌、海面收束成路线的滚动镜头和日月贝近景形成一套完整、可阅读的官网。

**架构：** 保留 React 静态预渲染及既有旅程操作。共享动态效果偏好控制普通页面的 Canvas 2D 粒子、路线流光和局部光扫；实时城市展台继续管理自身交互与资源。所有新增组件在静态 HTML、减少动态效果与故障回退时保留正文与完整路线。

**技术：** React 18.3、TypeScript、Vite 5、GSAP、Three.js 0.170；不新增依赖。源码目录 `source/askway-site/`。

**设计依据：** `C:/Users/wzc/.codex/visualizations/2026/11/26/01a21873-612a-76a3-aef4-2411795e7b79/问途官网前端改造指南.md`。

## 统一要求

- 所有写入、缓存、浏览器配置与临时目录限定在 `D:/AAA大三上/软件工程/`，外部只读。
- 使用独立 `askway-web` 副本和 `feat/coastal-visual-refresh` 分支，原 `askway-site` 未提交工作保留。
- 子智能体只使用 `gpt-6.1-sol`。
- 保留中文衬线标题、深海蓝、暖金和纸白；正文至少 16px，表单输入至少 16px，地点名称至少 16px；坐标、图注和站点副注属于次级标签（12–14px）。
- 1440px、390px、320px 和 200% 等效布局下不裁切标题与控件，无横向滚动。
- 海滨公园、香炉湾、日月贝路线为示意，地名用可读 HTML；不改变演示及工作台数据。
- 移动菜单焦点圈、Esc、返回焦点、后退、`#story/#demo/#download/#contact/#reference` 保留。
- 粒子不接管滚动或触摸，可反向滚动；不可见、后台、用户暂停、系统减少动态效果、实时城市同时可见时不连续绘制。
- 新纹理与静帧在资产清单说明原创生成方式和许可；不得把三维渲染写成实景摄影。
- 几何预算：桌面 ≤100,000、移动 ≤50,000 三角形；预计 draw calls 两档 ≤80。

## 任务 1：首页与共享动效（主智能体）

文件：`Home.tsx`、`SiteHeader.tsx`、`App.tsx`、`useMotion.ts`、`site.ts`、`main.tsx`；新增 `components/CoastalOpening.tsx`、`RouteDiagram.tsx`、`SeaRouteParticles.tsx`、`motion/PresentationMotion.tsx`、`motion/seaRouteMath.ts`、`styles/visual-refresh.css`。

- [x] 保存原版桌面/手机首屏与固定三维机位；确认基线 typecheck、单元、体验测试、构建。
- [x] 先增加粒子端点、可逆插值、非有限输入与暂停条件测试，确认失败来自缺失的新行为。
- [x] 首屏移除视觉中心按钮、旧路线叠图和单张摄影的轮播编号；桌面与手机分别裁图，保留两行标题与向下浏览。
- [x] `RouteDiagram({ className?: string, flowing?: boolean })` 输出完整 SVG 路线与三站 HTML 标签，供首页与产品页复用。粒子终点与 SVG 同一组坐标。
- [x] `PresentationMotionProvider/usePresentationMotion` 提供 `paused/reducedMotion/motionAllowed/togglePaused`；偏好保存在会话中，普通页面有可访问的暂停控制，体验路由退出装饰层。
- [x] 粒子按可见性懒加载，采用稳定海面 XYZ 起点和路线终点、统一滚动进度；RAF 在后台/离屏/展台/暂停时取消。
- [x] 去重首页流程介绍，让城市展台、原滚动旅程和城市目的地有各自作用。更新体验页摘要为写实三维场景示意。

## 任务 2：产品、关于、合作（页面子智能体）

文件：`Product.tsx`、`About.tsx`、`Cooperation.tsx`；新增 `styles/editorial-pages.css`（仅该任务修改）。消费任务 1 的 `RouteDiagram` 与文档根节点 `data-presentation-motion="running|paused"`。

- [x] 产品页纸白双栏首屏先展示完整路线，保留一个自然文字体验入口；压缩重复介绍，保留城市展台、原三点交互和下载。
- [x] 关于页使用 architecture.webp 建筑局部特写，照片内一次光扫；图注、故事、依据和正文留白。
- [x] 合作方向采用宽目录构图与一次边缘光扫，`#contact` 安静且焦点/错误清晰。
- [x] 原表单选择、校验、草稿失效、复制回退、下载状态与演示选点行为通过现有回归；不为纯排版编写重复实现的测试。

## 任务 3：日月贝与岸线（场景子智能体）

文件：`operaArchitecture.ts`、`realisticMaterials.ts`、`coastalCityModel.ts`、按必要性修改 `coastalEnvironment.ts/cityRuntime.ts`；新增近景材质及资产说明；相关几何/释放测试。

- [x] 固定基线机位分析壳板、玻璃、台阶、水线的可辨性；壳体保持大小关系。
- [x] 壳板、铺装、沥青分别使用适合的法线/粗糙度细节；金属/玻璃调整反射和粗糙度，避免石材法线混用。
- [x] 增加合并几何的近景尺度细节和护岸贴水层；玻璃分格与基座形体清楚，两档预算与纹理释放通过。
- [x] 同机位重新输出海岸全景、剧院黄昏、地标路线三张 WebP，更新来源与处理说明。

## 任务 4：整合、验证与交付（主智能体及独立审查）

- [x] typecheck、单元/体验、静态/无 JS、页面回归、工作台闭环、三维与暂停回退完成。
- [x] 保存 1440px/390px/320px、200% 等效布局、正反向滚动、减少动态效果和 WebGL 回退的证据。
- [x] 同条件改前/改后各三次模拟移动冷启动，报告中位数与测量条件；自动可访问性检查各页。
- [x] 独立子智能体做需求与代码审查，修复实际问题；不把模拟测试写成真实手机结论。
- [x] 构建并同步仓库根目录静态发布产物，留下可直接预览的结果与验证报告；不推送或发布外网。

## 执行判断

- 用户已指定完整设计指南并要求完成改造，按该指南直接实现，不增加设计审批回合。
- 原副本依赖锁的 261 个依赖条目与精确基线一致，复制工作区内已安装依赖，避免包管理器的外部副作用。
- 固定机位短片为指南中的可选增强；先完成首屏、粒子和可验证的近景提升，再按实际画面收益决定是否采用。
