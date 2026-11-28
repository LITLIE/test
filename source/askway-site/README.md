# 问途 AskWay 官网 · 3.2.1

维护源码位于本目录；仓库根是由 `dist` 同步的本地静态发布产物。3.2 以 `d79fc5c`（3.1）为起点，完成城市开场、三站示意、日月贝摄影近景和纸白产品交接。桌面使用原生滚动的一个短 sticky 舞台；手机默认竖版海报与正常阅读。当前交付为摄影转场原型，正式离线运镜母版和完整序列另属素材阶段。

产品、关于与合作继续保持各自的阅读节奏；四阶段概念保留键盘与原生说明展开。共享暂停、省流、后台与展示 owner 约束官网自动效果；工作台仍独立完成条件核对、候选比较、采用、放弃和一次撤销。

3.2.1 根据实际滚动反馈扩大镜头行程，引入有限视觉追随、摄影空间层及 3D 深度粒子。照片从路线落点展开并逐步收进产品卡，地图和文案分别进入；原生滚动、暂停和明确锚点导航保持可控。

## 本地运行

已有依赖可直接使用，不需要重新安装。每个 PowerShell 终端先限定进程级临时、缓存和浏览器目录：

```powershell
$siteRoot = (Get-Location).Path
$env:TEMP = Join-Path $siteRoot '.agent_tmp'
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:APPDATA = Join-Path $siteRoot '.agent_tmp/appdata'
$env:LOCALAPPDATA = Join-Path $siteRoot '.agent_tmp/localappdata'
$env:XDG_CONFIG_HOME = Join-Path $siteRoot '.agent_cache/config'
$env:XDG_CACHE_HOME = Join-Path $siteRoot '.agent_cache'
$env:npm_config_cache = Join-Path $siteRoot '.agent_cache/npm'
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:APPDATA,$env:LOCALAPPDATA,$env:XDG_CONFIG_HOME,$env:npm_config_cache | Out-Null
npm run dev
```

开发地址为 http://127.0.0.1:5173/。构建与本地静态同步：

```powershell
npm run typecheck
npm run build
npm run sync:publication
npm run preview
```

默认预览 http://127.0.0.1:4173/；`PORT` 可选择其它本地端口。通过 HTTP 查看页面。同步只写本仓库的静态根；外部推送和部署按实际授权处理。

## 配置与实现

- `site.config.mjs`：域名、basename、邮箱、Android 软件版本及下载状态。
- `src/features/cinematic/`：四段文案、确定性进度、一个 rAF 控制器、媒体与文案交接、实际卡内媒体矩形。
- `src/motion/`：会话暂停偏好、系统减少动态、省流、后台和连续展示 owner。
- `src/features/experience/ui/JourneyPreview.tsx`：使用真实候选的只读预览，SVG、HTML 与估算来自同一份方案。
- `src/features/experience/domain/`、`state/`：规则解析、规划、版本围栏、采用与撤销，展示动画不修改这些状态。
- `src/features/experience/map/`、`scene/`：公开 WGS84 参考点、二维地图、三维场景、生命周期与回退。
- `scripts/export-cinematic-posters.py`：可编辑竖版摄影构图；`public/assets/cinematic/manifest.json` 保存尺寸、来源、许可、字节与哈希。

网页展示示例使用合法请求版本，实际例子为城市阳台 → 海滨公园 → 日月贝，180 分钟预算、142 分钟规则估算、38 分钟余量。首页的海滨公园 → 香炉湾 → 日月贝明确属于路线示意。

官网 3.2.0 与 Android 软件 0.4.2 分别管理。公开下载和生产服务尚未启用，`publicDownloadAvailable=false`；不包含私有 APK、数据库或认证资料。未知费用、开放、入口和无障碍信息继续保留未知状态。

## 验证与交付

[3.2实施计划](docs/upgrade/cinematic-refresh-plan.md)、[3.2验收报告](docs/upgrade/cinematic-refresh-verification.md)、[3.1回退说明](docs/upgrade/cinematic-refresh-rollback.md)、[设计指南](docs/design/问途官网深度改进指南.md)、[资源账本](docs/assets/ledger.md)。3.1 历史记录保留在 [视觉验收](docs/upgrade/visual-refresh-verification.md)，3.0 见 [写实验收](docs/upgrade/realism-v3-verification.md)。

当前版本见 [3.2.1空间转场验收](docs/upgrade/motion-continuity-verification.md)。各轮历史证据保留自己的构建与源码哈希，不能替代当前版本的检查。

```powershell
npm test
npm run test:experience
npm run test:cinematic
npm run test:static
npm run test:browser
npm run test:regressions
npm run test:download
npm run test:workbench
npm run test:scene
npm run test:visual
npm run test:cinematic:browser
node tests/cinematic/continuity-browser.mjs
node tests/experience/realism-browser.mjs
```

浏览器 runner 使用现有 Edge，`TEST_URL` / `TEST_BROWSER` 可指定本地服务及兼容 Chromium。profile、下载、崩溃、临时文件和缓存均放工程目录，并检查实际路径与链接。质量检查使用现有 axe/Lighthouse；性能测量须在其它浏览器任务结束后独立运行。

```powershell
$env:QUALITY_OUTDIR = 'delivery/cinematic-refresh/final/accessibility'
node tests/experience/quality.mjs --axe-only
# 三次 Lighthouse 分别使用独立 QUALITY_OUTDIR，再运行 --lighthouse-only。
node scripts/capture-cinematic.mjs
node scripts/record-cinematic.mjs
node scripts/record-cinematic.mjs --measure
node scripts/record-cinematic.mjs --measure --mobile
node scripts/measure-presentation-scene.mjs
```

当前证据属于桌面 Edge、视口模拟及受控输入。实际手机、真实 INP、硬件 GPU 帧率、实际 200% 浏览器缩放、Safari 和现场出行资料需要独立验证；不能用实验室中位数代替每次加载保证。
