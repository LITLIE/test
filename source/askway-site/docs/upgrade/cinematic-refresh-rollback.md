# 3.2 摄影转场原型回退到 3.1

3.1 基线为 `d79fc5ce7e528a54464223e39ddeaf33f83a9ca9`。回退包已由该提交的 `git archive` 生成，包含当时的维护源码与完整仓库静态根：`delivery/cinematic-refresh/rollback/askway-3.1-d79fc5c.zip`，16,850,737 B。SHA-256 为 `23a38db857b653ec67e41fd5c29d1a451a4bc78b5e167359be49a86fe4a241e4`，可用 `Get-FileHash` 核对。该 ZIP 仅在工作区本地保留，由 Git 忽略。

克隆仓库后，可在工作区内重新生成归档再进行下述隔离预览。示例命令从仓库根执行；输出目录须位于当前允许工作区内：

```powershell
$rollbackRepository = (Get-Location).Path
$rollbackArchiveDirectory = Join-Path $rollbackRepository 'source/askway-site/.agent_tmp/rollback'
New-Item -ItemType Directory -Path $rollbackArchiveDirectory -Force | Out-Null
$rollbackArchiveFile = Join-Path $rollbackArchiveDirectory 'askway-3.1-d79fc5c.zip'
if (Test-Path -LiteralPath $rollbackArchiveFile) { throw '归档目标已存在，请选新路径' }
git -c core.autocrlf=false archive --format=zip --output=$rollbackArchiveFile d79fc5ce7e528a54464223e39ddeaf33f83a9ca9
if ($LASTEXITCODE -ne 0) { throw '归档生成失败' }
Get-FileHash -LiteralPath $rollbackArchiveFile -Algorithm SHA256
```

重新生成的 ZIP 可能因 Git 版本和换行设置拥有不同字节哈希；以基线提交和归档内容确认身份。下述 `$rollbackPackage` 可替换为生成后的 `$rollbackArchiveFile`。

以下操作只建立工作区内的独立 3.1 预览，不覆盖当前 3.2 源码、`dist` 或仓库静态根，也不更改 Git 分支。当前未提交改动和已有预览服务继续保留。不执行外部推送、部署、安装、`reset` 或 `clean`。

## 解压到新目录

在新的 PowerShell 终端运行；目标目录必须尚不存在。若 `.agent_tmp` 是链接或 junction，停止并改用工作区内真实目录。

```powershell
$rollbackWorkspace = 'D:\AAA大三上\软件工程'
$rollbackPackage = Join-Path $rollbackWorkspace 'askway-web\source\askway-site\delivery\cinematic-refresh\rollback\askway-3.1-d79fc5c.zip'
$rollbackParent = Join-Path $rollbackWorkspace '.agent_tmp'
$rollbackRoot = Join-Path $rollbackParent 'askway-3.1-d79fc5c'
if (!(Test-Path -LiteralPath $rollbackPackage -PathType Leaf)) { throw '回退包尚未生成' }
if (Test-Path -LiteralPath $rollbackRoot) { throw '目标已存在，请选新的工作区内目录' }
if (Test-Path -LiteralPath $rollbackParent) {
  if ((Get-Item -LiteralPath $rollbackParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '临时目录不能是链接' }
}
Get-FileHash -LiteralPath $rollbackPackage -Algorithm SHA256
New-Item -ItemType Directory -Path $rollbackParent -Force | Out-Null
Expand-Archive -LiteralPath $rollbackPackage -DestinationPath $rollbackRoot
```

包以仓库文件为根层。确认隔离目录中存在 `index.html`、`assets`、`build-info.json`、四个子路由目录，以及 `source/askway-site`。不要将旧包与当前 3.2 文件混合。

## 直接预览已归档静态产物

归档不包含忽略的 `dist` 和依赖。将包内完整静态产物复制到隔离源码自己的 `dist`，使用其已有 Node 静态服务脚本；该脚本只依赖 Node 内置模块和归档配置，无需构建或安装。

```powershell
$rollbackSource = Join-Path $rollbackRoot 'source\askway-site'
$rollbackDist = Join-Path $rollbackSource 'dist'
New-Item -ItemType Directory -Path $rollbackDist | Out-Null
$rollbackEntries = @('index.html','404.html','.nojekyll','CNAME','build-info.json','robots.txt','sitemap.xml','asset-credits.json','assets','data','about','product','cooperation','experience')
foreach ($rollbackEntry in $rollbackEntries) {
  $rollbackInput = Join-Path $rollbackRoot $rollbackEntry
  if (Test-Path -LiteralPath $rollbackInput) {
    Copy-Item -LiteralPath $rollbackInput -Destination (Join-Path $rollbackDist $rollbackEntry) -Recurse
  }
}
$env:TEMP = Join-Path $rollbackRoot '.agent_tmp'
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:APPDATA = Join-Path $env:TEMP 'appdata'
$env:LOCALAPPDATA = Join-Path $env:TEMP 'localappdata'
$env:XDG_CONFIG_HOME = Join-Path $rollbackRoot '.agent_cache\config'
$env:XDG_CACHE_HOME = Join-Path $rollbackRoot '.agent_cache'
$env:npm_config_cache = Join-Path $rollbackRoot '.agent_cache\npm'
New-Item -ItemType Directory -Path $env:TEMP,$env:APPDATA,$env:LOCALAPPDATA,$env:XDG_CONFIG_HOME,$env:npm_config_cache -Force | Out-Null
$env:PORT = '4183'
$env:SITE_BASE = '/'
Set-Location -LiteralPath $rollbackSource
node scripts/serve.mjs
```

若 4183 已占用，选择另一个空闲本地端口。通过 `http://127.0.0.1:4183/` 查看 3.1，核对 `build-info.json` 的版本和 `/product/`、`/about/`、`/cooperation/`、`/experience/`、图片及主要入口。预览服务只绑定本机；浏览器取证仍须使用工程内 profile 与缓存。

## 返回 3.2

在隔离预览终端按 `Ctrl+C`，然后关闭该终端，结束其进程级环境设置。回到原 3.2 服务地址即可；原服务未被替换。若原服务已停止，在原 `askway-web/source/askway-site` 终端按 README 设置工作区内临时与缓存目录，再运行 `npm run preview`。

隔离目录可保留供对照。需要清理时先确认没有服务使用它、绝对路径仍为上述工作区内隔离目录，再按工作区规则删除；回退 ZIP 和当前 3.2 工作成果继续保留。将 3.1 替换到发布目录或外部站点属于另一次明确操作，本说明不执行该操作。

回退包已生成并核对哈希；隔离解压、预览和实际回退步骤未执行。
