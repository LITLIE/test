# 回退、子路径与迁移

当前仅交付本地前端，没有执行外部发布。source 包用于继续开发，static 包只包含 dist；不含软件 APK、缓存与认证资料。

## 回退

delivery/rollback/askway-v1-static.zip 是完整原四页静态产物，包括下载待开放区、图片与对应资源。恢复时整套替换，不混合 v1/v2 JS、catalog 或资源。

回退 ZIP 保留 dist/ 外层目录，解压后应将 dist/ **内部全部内容**替换到站点根目录。当前 v2 static ZIP 则直接以 index.html、assets/ 等为根层，两者目录结构不同。

baseline/official-site-2026-11-24 标签保存原源码。历史 package.json 有自身 file: 依赖；若重建该历史源码，应先清理此已记录问题，不直接复制当前 node_modules。

回退/删除遵循未来当轮工作区规则，先保护未提交改动；不自动写出允许范围。原 D: 副本当前只读。

## 子路径复现

在允许工作区内复制完整维护源码，用锁文件和工程内缓存安装。仅在副本根目录设置本进程环境：

```powershell
$env:SITE_BASE = '/askway/'
$env:SITE_URL = 'https://example.org'
npm run build
$env:PORT = '4175'
npm run preview
```

canonical 为 https://example.org/askway/，本地预览 http://127.0.0.1:4175/askway/。从原工程运行 node tests/experience/subpath.mjs；SUBPATH_TEST_URL 可指定其它地址。完成后清除本进程 SITE_BASE/SITE_URL，避免影响下次主构建。

本轮 .agent_tmp/subpath 使用工程内 node_modules 链接，写入均在工作区；检查完成后停止副本服务器、清理副本。

## 迁移到 AskWay

复制完整源码至未来允许工作区的 dev/askway-site，ignore-scripts 干净安装，更新 site.config 域名/base。保留照片/字体/Three 许可、catalog 署名和资料版本。

软件公开后先匿名核对仓库和实际 APK/Release 的可达性、版本、校验、签名、兼容性与配置说明，再更新 downloadUrl/publicDownloadAvailable。不仅检查仓库首页。

liveGateway 关闭；真实服务须经 HTTPS、隔离后端、会话/配额、权限、超时与回退验收。私钥不放 VITE_* 或静态产物。公网发布、DNS、仓库可见性和真实邮件需另行明确授权。
