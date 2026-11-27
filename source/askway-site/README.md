# 问途 AskWay 官网 · 3.1.0

采用城市摄影、可逆海面粒子转场和写实海岸展台的 React 官网。3.1 以 `262872a` 为基线，重排首页与产品、关于、合作页面，并精修日月贝材质、玻璃、台阶、栏杆和贴水护岸。旅程工作台保留表达、条件核对、生成候选、A/B 比较、采用与撤销。

当前为 curated 受控资料演示。参考坐标与逐路段估算有来源和状态；开放、费用、入口、无障碍保留未知。网站不提供实时导航或生产服务，软件公开下载仍待开放。

## 页面

| 路由 | 任务 |
| --- | --- |
| / | 纪实海岸、品牌叙事、同数据旅程预告、合作入口 |
| /product/ | 产品能力、原三点概念演示、软件获取状态 |
| /experience/ | 三个可修改任务、规则解析、证据透镜、版本比较、二维地图与按需写实三维场景 |
| /cooperation/ | 合作方向、前端草稿、复制与真实邮箱 |
| /about/ | 产品理念、真实阶段与资料范围 |

/product/#demo 和 /product/#download 保持可用。五页各有静态 HTML、标题、canonical、sitemap；刷新、无 JS 基本阅读和子路径均已检查。

## 运行

需要 Node.js 22.19 或更新版本，本轮使用 22.23.1。请在本工程根目录运行以下 PowerShell 命令，临时文件与缓存只写入本工程。

```powershell
$taskRoot = (Get-Location).Path
$env:TEMP = Join-Path $taskRoot '.agent_tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $taskRoot '.agent_cache/npm'
$env:APPDATA = Join-Path $taskRoot '.agent_tmp/appdata'
$env:LOCALAPPDATA = Join-Path $taskRoot '.agent_tmp/localappdata'
$env:XDG_CONFIG_HOME = Join-Path $taskRoot '.agent_cache/config'
$env:XDG_CACHE_HOME = Join-Path $taskRoot '.agent_cache'
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:npm_config_cache,$env:APPDATA,$env:LOCALAPPDATA,$env:XDG_CONFIG_HOME | Out-Null
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

开发地址 http://127.0.0.1:5173/。构建和预览：

```powershell
npm run typecheck
npm run build
npm run sync:publication
npm run preview
```

预览地址 http://127.0.0.1:4173/。本次运行的预览使用 `PORT=4191`。`sync:publication` 将构建同步至本仓库的静态根目录，校验路径且只移除旧 JS/CSS 包。请通过 HTTP 预览，不直接双击 dist/index.html。

## 配置与源码

- site.config.mjs：实际域名、base、邮箱与 software 下载配置。
- src/features/experience/config.ts：受控模式、三维开关、任务模板和演示日期。
- data/catalog.ts：10 个 OSM 公开参考点，WGS84 [经度, 纬度]，入口未核实。
- domain/ 与 state/：条件规范化、有限规则解析、规划、差分、请求/会话/草稿/基线围栏、候选有效期、采用与撤销。
- ui/、map/、scene/：共享方案和选点，二维投影、写实海岸场景、生命周期与失败回退。
- src/motion/、components/CoastalOpening.tsx：普通页面共享暂停、独立海面粒子与完整静态路线；系统减少动态效果、后台与实时展台交界停止绘制。
- dist/data/catalog.json、dist/build-info.json：构建生成的公开资料与版本记录。

新草稿不改变当前方案。采用需要明确确认；撤销恢复上一版完整内容、条件和资料，并分配新单调版本，例如恢复 V1 内容后当前为 V3。未知费用不当作免费，未知开放不当作全天开放。

三维只在用户开启后加载，静止不连续绘制；视区外/隐藏暂停，手动操作停止预演。加载失败与 context lost 保留二维与文字，不修改业务方案。

官网版本 3.1.0 与软件版本 0.4.2 分别管理。publicDownloadAvailable=false，仓库链接注明授权访问；不包含私有 APK、数据库和认证资料。

## 验证与交付

本轮美化见 [3.1验收](docs/upgrade/visual-refresh-verification.md) 与 [实施计划](docs/upgrade/visual-refresh-plan.md)；3.0历史记录见 [写实验收](docs/upgrade/realism-v3-verification.md)，此前2.0见 [验收记录](docs/upgrade/verification.md)、[质量测量](docs/upgrade/quality-audit.md)、[资料来源](docs/upgrade/data-sources.md)、[资源账本](docs/assets/ledger.md)。

```powershell
npm test
npm run test:experience
npm run test:browser
npm run test:regressions
npm run test:download
npm run test:workbench
npm run test:scene
npm run test:static
npm run test:visual
node tests/experience/subpath.mjs
node tests/experience/quality.mjs
```

浏览器默认使用本机现有 Edge，TEST_BROWSER 可指定兼容 Chromium。测试不下载浏览器，profile/cache/crash 位于工程内。质量检查使用 axe-core/Lighthouse，性能阶段应在其它浏览器任务结束后单独运行。subpath.mjs 需先启动 /askway/ 副本，见 [回退与迁移](docs/upgrade/rollback.md)。

交付包括可维护源码、静态产物、JSON/图片证据及回退包。部署包仅含 dist，不含 node_modules、缓存、浏览器配置与私有资料。真实手机、真实 INP、生产 HTTPS/API 与现场核实仍须独立完成。

本轮分支为 feat/coastal-visual-refresh，基线提交为 262872ae7f6baac08ab7b6efe30765ef5e1e79a3。迁移时复制完整源码到允许的工作区，按锁文件安装并更新 site.config。


3.0 新增自然海岸二维图、防重叠地名、比例尺/四向平移，以及透视写实三维、HDR光照/PBR材质、晨暮与海面控制；首页/产品城市展台按视区加载，原生Three渲染的三张1920×1080插图分布在页面。公开位置和建筑/地形模型仍为参考示意，不能用作导航。
