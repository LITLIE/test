# 3.2.1 空间转场独立审查

审查范围为保留现有摄影的 480svh 主舞台、有限视觉追随、CSS 3D 景深、路线终点窗口与产品卡片交接，以及 XYZ 透视粒子；不涉及替换城市模型。只读检查 `progress.ts`、`useStoryProgress.ts`、`StoryStage.tsx`、`cinematic.css`、`seaRouteMath.ts`、`SeaRouteParticles.tsx` 和相关新增测试，重点为暂停／锚点 snap、相位聚焦、调度收敛、限绘及资源释放。

初审唯一重要发现为 **[P2] 重复点击当前 hash 未立即 snap**。已复核修正：主舞台 click handler 对普通章节点击统一执行 `measure(true)` 和滚动 snap，保留修饰键及非 `_self` target 的原生行为，并在卸载时移除监听。根任务执行真实浏览器 RED→GREEN，当前 [browser/results.json](browser/results.json) 为 10/10，通过同 hash 再点击的相机对齐及可见标题聚焦检查。独立审查者仅核对源码与已有记录，未执行该浏览器测试。

两项视觉反馈也已复核收束：透明导航取消 background tween，首帧白色品牌不再落在浅色过渡底上，见根任务 [修前 header-probe](../baseline/header-probe.json) 与 [修后 header-probe](../preview/header-probe.json)；近景照片从完整缩小画面扩展，极小窗口阶段后即不透明，粒子 z-index 3 位于近景 z-index 4 之后，最新 `.51` 静帧未再出现路线／粒子穿透照片。

初审查看 10 张桌面预览，修后复核 `.000`、`.510`、`.660`、`.940`、`.985` 五张关键静帧：首屏品牌清楚，近景窗口与稳定标题可读，照片入卡边界及最终地图／按钮完整。最新 [preview/records.json](../preview/records.json) 的首页 SHA-256 为 `6e40284d6c6e10aa98019f93a9683fc7c4da69c12c9b8f10df0d85ac6d523632`，只读核对与当前 `dist/index.html` 一致。

在上述范围内，未发现尚未解决的可确认重要问题。独立审查未运行浏览器、构建、性能测量或完整测试，也不把静帧视为连续录像、真实触摸／滚轮、真机 GPU 或其他浏览器已经验证；完整验收与性能结论由根任务报告负责。
