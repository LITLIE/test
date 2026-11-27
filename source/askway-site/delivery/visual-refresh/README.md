# 问途 3.1 · 精选交付证据

以提交 `262872a` 为基线。源代码和可发布根目录已同步；原未提交工作保留在独立的旧副本。

- [桌面与手机首屏](previews/preview.jpg)
- [首页前后对照](previews/homepage-comparison.jpg)
- [四页构图](previews/pages-overview.jpg)
- [日月贝同机位对照](previews/theatre-comparison.jpg)
- [84帧／8.4秒正倒滚预览](previews/scroll-review.gif)
- [机器可读结果](results.json)
- [性能及限制](performance/final-summary.md)
- [详细验收](../../docs/upgrade/visual-refresh-verification.md)

GIF为保留时长和帧数的640×445压缩预览，原960×667录制在本地 `performance/home-scroll-forward-reverse.gif`。完整Lighthouse、截图、轨迹与运行日志在本地各子目录，不纳入版本控制。测试浏览器、临时和缓存均使用项目内独立路径。

首屏移动模拟LCP中位数约2.10秒、CLS0；不是每次加载或真机指标。软件WebGL的低帧率与真实手机／硬件GPU未测情况详见性能报告。
