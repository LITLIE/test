# 问途官网资源账本 · 2026-11-24

本轮版本：`experience-v2 / paper-city-2026-11-24-v1`。资源均在 `askway-site` 工程内；既有图片与字体的原始来源记录见 [asset-credits.json](<../../public/asset-credits.json>)。本轮沿用既有署名，未重新下载或加工这些媒体。

## 程序化地图与三维资源

| 资源 | 来源 / 作者 / 许可 | 生成与处理 | 版本 / 使用位置 |
| --- | --- | --- | --- |
| 公开参考点 | OpenStreetMap contributors；ODbL 1.0；逐点 source ID 与原对象 URL 在 catalog.sources 中 | 原始 WGS84 `[经度, 纬度]`，局部等距圆柱布局；固定原点纬度；不转换为 GCJ02；不宣称入口、道路或导航已核实 | `zhuhai-public-reference-2026-11-24-v1`；二维 SVG、三维地点与所有示意路段共用 |
| 纸艺海岸、海面与岛屿 | 本工程自制程序几何；AskWay 官网工程；按项目授权范围使用 | 从同一目录坐标框架生成装饰性纸层轮廓；并非测绘海岸；SVG 与 Three 使用同一轮廓 | `scene/paperTerrain.ts`；二维地图、城市沙盘 |
| 日月双贝 | 本工程自制；地点名称与代表坐标取自 `OSM-ZS-004`；形状是编辑性风格化参考 | 两个 18×10 半球壳、低面数台阶和合并轮廓线；无照片贴图或外部网格；尺寸未测绘 | `scene/paperCityModel.ts` 中 `shells()`；三维沙盘 |
| 馆舍 | 本工程自制；参考地点 `OSM-ZS-009`，不存在时才使用目录中的展览馆 | 盒体、四面纸檐与实例化立柱；不承诺真实建筑尺寸或可入馆 | 同文件 `museum()`；三维沙盘 |
| 绿地 | 本工程自制；参考地点 `OSM-ZS-007`，不存在时使用目录中的首个公园 | 十边形草坪、12 棵实例化低面数树和简化亭体 | 同文件 `park()`；三维沙盘 |
| 城市小块、路线与地点标记 | 本工程自制；路线只读取当前 / 上一版计划的 orderedPlaceIds 与 legs | 无标签的小块是装饰背景；示意路线合并为三角带，上一版为虚线；地点底部保持共同投影位置，地标上方的标记抬高以避免遮挡 | `paperCityModel.ts`；标记选择、镜头与预演 |
| Three.js 引擎 | three.js authors；MIT；[项目](https://threejs.org/)；原许可为 `node_modules/three/LICENSE` | ESM 直接使用 Three；未采用 Fiber、Drei、加载器、OrbitControls 或后处理 | `three@0.170.0` / `@types/three@0.170.0`；仅客户端城市沙盘懒加载分块 |
| 地点文字、图例与差分 | 本工程 React / SVG 内容 | 关键名称、选点操作与移出地点入口保留 DOM 按钮；Canvas 设 aria-hidden；场景有可见参考与来源说明 | `scene/SceneText.tsx`；二维、三维与失败回退 |

当前三维没有外部 `.glb`、纹理、照片、音频、模型或专用字体请求。模型与纹理下载体积为 0；几何生成代码包含在懒加载的 JavaScript 中。不能将 Three 的 JavaScript 体积计为 0，最终分块体积由集成构建记录。

## 既有媒体

| 文件 | 作者 / 原始来源 | 许可 | 处理 / 当前使用 |
| --- | --- | --- | --- |
| `public/assets/hero.webp` · 222,362 B | Charlie fong；[Zhuhai Grand Theatre Exterior Southeast2021](https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_Exterior_Southeast2021.jpg) | CC BY-SA 4.0 | 缩放转 WebP，页面裁切 / 调色；首页主视觉、日月贝故事、社交分享图 |
| `public/assets/architecture.webp` · 159,116 B | 钉钉；[Zhuhai Grand Theatre 13](https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_13.jpg) | CC BY-SA 4.0 | 缩放转 WebP、页面裁切；关于页建筑照片 |
| `public/assets/theatre.webp` · 109,654 B | 钉钉；[Zhuhai Grand Theatre 23](https://commons.wikimedia.org/wiki/File:Zhuhai_Grand_Theatre_23.jpg) | CC BY-SA 4.0 | 缩放转 WebP；保留的既有媒体，当前源码没有直接引用 |
| `public/assets/coast.webp` · 116,260 B | Vmenkov；[Zhuhai-seen-from-Yeli-0725](https://commons.wikimedia.org/wiki/File:Zhuhai-seen-from-Yeli-0725.jpg) | CC BY-SA 3.0 | 缩放转 WebP、页面裁切；首页海岸故事视觉参考。原图为从野狸岛观察的城市海岸景，不能标为某个公园 / 沙滩入口实拍 |
| `public/assets/heading.ttf` · 38,400 B | Noto Serif SC / Google Fonts；[字体来源](https://github.com/google/fonts/tree/main/ofl/notoserifsc) | SIL OFL 1.1；随工程 `FONT-LICENSE.txt` | 500 字重中文标题子集；本地 CSS font-face，font-display: swap；三维不另外请求字体 |
| `public/assets/favicon.svg` · 344 B；Brand / RouteArt 等源码向量 | AskWay 官网自制向量 | 项目授权范围 | 品牌与示意图；无新增外部资源 |
| Lucide 图标 | Lucide contributors；[项目](https://lucide.dev) | ISC | 本地 React SVG 图标；`lucide-react@0.468.0` |

照片的署名、许可及修改说明沿用公开资源页与 `asset-credits.json`。新事实目录中的参考位置不把照片变成入口验证证据。

## 当前文件版本

| 文件 | SHA-256 |
| --- | --- |
| architecture.webp | `A47FF66F7C411CD81150F1BF8B73ECE871FFD35473B2B3448CA8A25CF0D37DDC` |
| coast.webp | `9438940422162CA0ECE5D9B4B5F1C85DEFEF38121B4763D555BFDFB931833E67` |
| favicon.svg | `7253F9FCCAC33C265472F6443AA4A21DE2C25588B7692C0BED3081F9300A793C` |
| FONT-LICENSE.txt | `5E0DA210FB04058A8C0087985D2D456B931C2579811A49655721D3CF0C36B6D6` |
| heading.ttf | `9FAE11A4D7D88AF358F73FD31F6CCF6BA7CD76657BA84E9571A55D00664FCC1F` |
| hero.webp | `3504F8EAC73CB0568C1BA32DD2D8060BE015BFCF2FEB44D661AF93E3554D039B` |
| theatre.webp | `654B537927BF5B12F9DF2564DC46685338C7578D110B31F7099EB32BA487D15C` |

## 几何与生命周期审计

2026-11-24 使用 Node 22.23.1、真实 10 点目录，构建包含全十点路线、反向上一版及两个高亮标记的模型。统计为所有几何的保守上限，不是实际设备帧率：

| 审计项 | 本次输出 | 初期预算 |
| --- | --- | --- |
| 纸艺城市 | 1,576 三角面 / 22 预计 draw calls | — |
| 双版本路线与地点 | 1,100 三角面 / 7 预计 draw calls | — |
| 合计 | 2,676 三角面 / 29 预计 draw calls | ≤120,000 / ≤80 桌面 |
| Geometry dispose 事件 | 28 / 28 | 全部自建对象释放 |
| Material dispose 事件 | 27 / 27 | 全部自建材质释放 |
| 纹理 | 0 | 无外部纹理 |
| DPR | 手机上限 1；桌面上限 1.5 | 满足指南建议 |
| 活跃 WebGL | 用户启用时 1；离场 / 回退释放 | 同页最多 1 |

`ClientScene` 初始输出二维占位，客户端 effect 才 import `CitySandbox`；Node 预渲染不创建 Canvas / WebGL。`cityRuntime.ts` 的静止状态没有常驻帧循环；只有最长 650 ms 的镜头过渡继续 rAF。视区外、标签页隐藏暂停帧；离场移除 ResizeObserver、IntersectionObserver、页面与 Canvas 监听，释放实例 / geometry / material / renderer，并丢弃渲染上下文。WebGL 初始化失败、资源导入错误和 context lost 都保留受控方案与选中点，显示重试和二维按钮。

手工点位的 `tests/experience/projection.test.mjs` 已先观察模块缺失时失败，再通过 8 / 8：经纬顺序、米制控制点、SVG / Three 比例与方向一致、路段顺序、独立上一版、无效坐标 / CRS / 路段拒绝、空目录有限边界。集成类型检查 exit 0。

Vite SSR 审计也为 exit 0：无方案的 DOM 地点按钮为 10；手工三点方案的 DOM 顺序精确为 `ZS-003 → ZS-004 → ZS-007`；`ClientScene` 静态正文没有 Canvas，实际执行的 `CitySandbox / paperCityModel / cityRuntime` SSR 模块数为 0。审计临时 Vite cache 指向工程内 `.agent_cache/vite-scene-ssr`，结束后清理。

实际浏览器中的冷加载、渲染暂停、上下文回退、可访问性和 GPU 表现由集成验收记录，不以这些 Node 几何与 SSR 结果替代。


## 3.0 写实升级

新增CC0环境/纹理来源见 ../../public/assets/realism/sources.json；实际生成的三张1920×1080场景插图见 ../../public/assets/realism/illustrations.json。CG模型与线路保持参考示意，HDR不是珠海现场影像。新资源预算与实测见 ../upgrade/realism-v3-verification.md。
