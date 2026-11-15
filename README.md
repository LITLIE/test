# litlie.zh.kg

绑定自定义域名 `litlie.zh.kg` 的产品介绍官网静态站点，托管于 GitHub Pages。

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构与全部内联 SVG 插图 |
| `styles.css` | 样式：浅色/深色自适应、响应式、动效 |
| `config.js` | **站点配置，改这里即可全站生效** |
| `app.js` | 配置注入、下载按钮、二维码、滚动淡入 |
| `CNAME` | 自定义域名声明，内容为 `litlie.zh.kg` |
| `.nojekyll` | 跳过 Jekyll 构建 |

## 上线前必须替换的内容

当前页面中的所有文案、版本记录与插图均为**示例占位**，不代表真实产品信息。

1. `config.js`：`productName`、`tagline`、`description`、`version`、`releaseDate`
2. `config.js`：`iosUrl`、`androidUrl` 填真实下载地址；`qrImage` 填真实二维码图片路径（如 `assets/qr.png`）
3. `config.js`：`contactEmail`、`privacyUrl`；若将来使用已备案域名，再填 `icpNumber`
4. `index.html`：6 张功能卡、更新日志、FAQ 的示例文案
5. 插图：目前是内联 SVG 界面示意图，替换为真实 App 截图会更贴近实际产品

**下载链接未配置时不会产生死链**：点击按钮会提示「请在 config.js 中填写」，填入地址后自动变为新窗口跳转。

## 页面模块

固定导航 → Hero（含手机界面示意图）→ 特性条 → 6 张功能卡 → 界面展示与三步流程 → 下载区（App Store / Android 按钮 + 二维码）→ 更新日志 → FAQ → 页脚（隐私政策、联系方式、版权）。

## 技术特点

- **零外部依赖**：无 CDN、无外部字体、无外部图片请求，国内访问稳定
- 插图与图标全部为内联 SVG，随主题缩放不失真
- 浅色/深色自适应，桌面 / 平板 / 手机三档响应式
- 尊重 `prefers-reduced-motion`，含跳转主内容的 skip link 与键盘焦点样式

## 部署方式

推送到 `ai` 分支后 GitHub Pages 自动构建（`source=ai /`，`cname=litlie.zh.kg`）。

## DNSPod 解析记录（已生效）

GitHub 官方要求根域名**至少 1 条 A 记录**；官方速查表的 4 个 IP 是冗余高可用，并非必须全部填写。DNSPod 免费版对**同一主机记录**的负载均衡条数限制为 2 条，因此 `@` 最多填 2 条 A，已足够。总记录数不限，其他主机记录不占这 2 条配额。

| 类型 | 主机记录 | 记录值 | 状态 |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | 必需，已生效 |
| A | `@` | `185.199.109.153` | 冗余，已生效 |
| CNAME（可选） | `www` | `litlie.github.io` | 不同主机记录，不占配额 |
| TXT（推荐） | `_github-pages-challenge-LITLIE` | GitHub 个人设置中给出的验证串 | 不同主机记录，不占配额 |

注意：主机记录填 `@`，不要填完整域名；记录值不要指向中国境内服务器，否则会触发未备案拦截。

## 当前状态与安全待办

- Pages `status=built`，DNS 全网生效，健康检查 `is_valid=true`、`is_served_by_pages=true`
- HTTPS 证书签发完成后，在 Settings → Pages 勾选 `Enforce HTTPS`
- 建议补：GitHub 域名验证 TXT（防抢绑）、CAA 记录、账号 MFA、2027-08-10 起的续期提醒

## 验证

- `https://dns.alidns.com/resolve?name=litlie.zh.kg&type=A` 应返回上述 2 个 IP
- `https://litlie.zh.kg` 应显示首页；本机 DNS 存在代理 fake-IP 干扰，不要以 `ping` / `nslookup` 结果为准
