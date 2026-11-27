# 最终性能复测与滚动证据

原版提交 262872ae7f6baac08ab7b6efe30765ef5e1e79a3；改造版版本 3.1.0。
原版首页 HTML SHA256 5e95cb25d20a8c7921ba8b988e5f6fa2d2b9c66aaf3896d00bb31f4d6782f71d；改造版 50956941b9a2451de1f2deffeed4fe2af2038e44a597d0eec04b42c24050922f。
原版与改造版各顺序运行三轮 Lighthouse，全部设置一致，原始报告位于 ../before/run-N 和 ../after/run-N。

| 页面 | 指标 | 原版中位数 | 改造版中位数 | 改造 − 原版 |
| --- | --- | ---: | ---: | ---: |
| / | performance | 98 | 97 | -1 |
| / | lcpMs | 1953.694 | 2104.890 | 151.196 |
| / | cls | 0 | 0 | 0 |
| / | tbtMs | 39.500 | 37.500 | -2 |
| /experience/ | performance | 98 | 96 | -2 |
| /experience/ | lcpMs | 1953.747 | 2104.690 | 150.943 |
| /experience/ | cls | 0 | 0 | 0 |
| /experience/ | tbtMs | 36.500 | 139 | 102.500 |

三轮原始结果没有删除离群值。改造版第 2 轮体验页 Performance 81 / LCP 4396.508ms，第 3 轮首页 Performance 74 / LCP 7505.872ms；这些轮次均无运行错误或警告，但说明本地测量存在明显波动。性能中位数略低、LCP 中位数约增加 151ms，不能声称改造提升了加载性能。

普通首页滚动采用同一 1200px 范围，10 秒余弦正滚/倒滚，普通动态效果开启。使用两次 DOM click 锁定展台暂停，点击未触发 scrollIntoView。

| 版本 | CSS 视口 | rAF p50（ms） | p95（ms） | max（ms） | >33ms 帧 | Long tasks |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| before | 1440×1000 | 4.200 | 4.300 | 12.500 | 0/2395 | 0 |
| before | 390×844 | 4.200 | 4.300 | 12.400 | 0/2399 | 0 |
| after | 1440×1000 | 4.200 | 8.400 | 24.900 | 0/2097 | 0 |
| after | 390×844 | 4.200 | 4.300 | 62.400 | 1/2374 | 0 |

改造版实景展台单独测量 10.040 秒，renderCount 增加 29，观察输出 2.888 帧/秒；约 30fps 调度上限。实际 renderer.info：31 draw calls、64978 triangles、DPR 1。
软件渲染器：ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)。观察到的渲染变化间隔 p50=370.800 ms，p95=424.725 ms。

这些结果来自桌面 Headless Edge 的视口模拟。rAF 是回调调度间隔，实景使用 SwiftShader 软件 WebGL；两者均不等同于手机 GPU、硬件 GPU 帧率或 GPU 耗时。
普通采样通过 rAF + scrollTo 驱动同像素范围，没有测量真实滚轮或触摸事件链。主机的普通页回调约 4.2ms（约 240Hz）；该调度频率不能直接转换为手机帧率。
加载指标是本地实验室结果，没有测量线上现场 Core Web Vitals 或真实设备 INP。普通滚动每种条件只有一次 10 秒采样，机器背景负载和采样误差仍可能影响结果。

[查看正滚/倒滚录制](home-scroll-forward-reverse.gif)。CDP 录制单独进行，仅用于用户复查，没有把录制帧间隔计入性能结果。JPEG 原始帧与时间戳保存在 recording-frames/ 和 recording-manifest.json。

GIF 已重新读取验证：84 帧、8.400 秒、960×667。滚动原始轨迹均已核对为 0→1200→0px，全部测量首页哈希符合冻结版本；12次Lighthouse浏览器进程（原版与改造版各6次）均确认退出。

所有测量输出、浏览器 profile、缓存与临时路径都配置在本项目内；未安装依赖或下载浏览器。完整机器可读结果见 final-summary.json、scroll-*.json 和 sea-after-desktop.json。
