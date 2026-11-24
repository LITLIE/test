# 问途 AskWay 官网前端

以“海岸城市 × 可信科技”为方向的四页品牌官网，包含海岸首屏、滚动产品叙事、珠海场景切换、行程交互演示和合作需求整理。

- 当前验证可访问：http://litlie.zh.kg。现有自定义域名的 HTTPS 证书尚未就绪。
- 合作邮箱：2825947576@qq.com
- 临时托管仓库：https://github.com/LITLIE/test，沿用 ai 分支的 GitHub Pages 与 CNAME。
- 技术：React 18.3.1、TypeScript、Vite 5、GSAP、React Router、Lucide SVG。

## 本地运行

使用 Node.js 22。在工程目录内执行：

```powershell
$taskTmp = Join-Path (Get-Location) '.agent_tmp'
$taskCache = Join-Path (Get-Location) '.agent_cache/npm'
New-Item -ItemType Directory -Force -Path $taskTmp,$taskCache | Out-Null
$env:TEMP = $taskTmp
$env:TMP = $taskTmp
npm ci --ignore-scripts --cache $taskCache --no-audit --no-fund
npm run build
npm run preview
```

静态预览：http://127.0.0.1:4173。开发模式执行 npm run dev，访问 http://127.0.0.1:5173。

安装脚本默认关闭；临时文件、依赖与缓存均设置在工程目录内。不会自动安装浏览器。浏览器测试使用本机现有 Microsoft Edge，测试脚本内的 executablePath 可按实际环境调整。

## 页面与交互

| 路径 | 内容 |
|---|---|
| / | 品牌首页、海岸主视觉、四阶段产品舞台、场景与合作方向 |
| /product/ | 产品介绍、有限珠海示例的交互演示、产品原则与常见问题 |
| /cooperation/ | 三类合作方向、沟通流程、合作草稿、复制与邮件入口 |
| /about/ | 产品出发点、品牌理念与阶段进展 |

交互演示使用演示估算，支持时间、节奏和必去点选择。可行结果保留必去点并满足所选时间；冲突会明确说明。它用于解释规划思路，实际旅行应核实实时交通、开放和现场信息。

合作表单在当前页面整理内容，生成可复制的草稿与 mailto 链接，由访客通过邮件客户端确认发送。没有虚构提交成功，也没有新增线索数据库。

## 代码结构

- site.config.mjs：站点名称、公开邮箱、正式 URL 与构建 base。
- src/pages：四个页面。
- src/components：导航、页脚、路线绘制、产品舞台与交互演示。
- src/lib：合作草稿与演示行程逻辑。
- src/hooks/useMotion.ts：渐进加载动效、媒体偏好与清理。
- src/styles/site.css：品牌变量、编辑式布局、响应式与动效样式。
- public/assets：自托管图片、字体、图标与字体许可证。
- public/asset-credits.json：影像来源、作者、许可与处理记录。
- scripts/build.mjs：静态预渲染四页、404、站点元信息、sitemap 与 CNAME。
- tests：真实逻辑测试、浏览器主流程和回归检查。

## 验证

```powershell
npm test
npm run typecheck
npm run build
npm run preview
# 保持预览服务运行，在另一个终端执行：
npm run test:browser
npm run test:regressions
```

浏览器证据默认写入 .agent_tmp。测试包含手机菜单与键盘、360/390px 布局、正常及减弱动画、同页跳转、条件变化后的旧结果处理、地图与行程一致性、邮件草稿和复制。

## 迁移到 AskWay 仓库

本仓库的 source/askway-site 是完整源码。可复制到 AskWay 仓库的 dev/askway-site，再使用锁文件安装和构建。

若改变正式域名，或 HTTPS 证书就绪后切换协议，更新 site.config.mjs 的 url；构建会同步浏览器与静态 HTML 中的 URL，并根据域名生成 CNAME。若使用 GitHub 项目路径，配置 base 为对应路径，同时将 url 设为完整站点 URL。发布服务器应支持四个预渲染目录的直接访问。

当前 GitHub Pages 根目录放置 dist 的静态产物；source/askway-site 放置可迁移源码。源码发布不包含 node_modules、构建临时目录、浏览器配置、运行缓存、认证脚本或凭据。原有 CNAME 与 Pages 发布分支继续沿用。

## 素材与范围

图片与标题字体均为本地资源。Wikimedia 影像按 CC BY-SA 许可署名；Noto Serif SC 子集按 SIL OFL 许可使用；图片详情见 public/asset-credits.json。

网站首版交付品牌展示与可交互的前端示例。真实旅行账号、模型、地图服务和现有 AskWay 后端没有在本官网中初始化；完整产品接入可在独立产品入口中后续完成。
