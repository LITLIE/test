# litlie.zh.kg

用于绑定自定义域名 `litlie.zh.kg` 的 GitHub Pages 静态站点。

## 仓库文件

- `index.html` — 站点首页（当前为链路验证页，会显示实际访问的域名）
- `CNAME` — 自定义域名声明，内容为 `litlie.zh.kg`
- `.nojekyll` — 跳过 Jekyll 构建，避免静态文件被额外处理

## 首次启用步骤（需在 GitHub 网页端完成）

1. 仓库 `Settings` → `Pages` → `Build and deployment`：Source 选 `Deploy from a branch`，分支选 `ai`，目录选 `/ (root)`，Save。
2. `Custom domain` 填 `litlie.zh.kg` 并 Save（本仓库已有 `CNAME` 文件，通常会自动带出）。
3. 个人头像 → `Settings` → `Pages` → `Add a domain`，获取 TXT 验证串（推荐，用于防止域名被抢绑）。
4. 在 DNSPod 添加下列解析记录，等待生效。
5. 证书自动签发后（最多 24 小时）勾选 `Enforce HTTPS`。

## DNSPod 解析记录

| 类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME（可选） | `www` | `litlie.github.io` |
| TXT（推荐） | `_github-pages-challenge-LITLIE` | GitHub 个人设置中给出的验证串 |

注意：主机记录填 `@`，不要填完整域名；记录值不要指向中国境内服务器，否则会触发未备案拦截。

## 验证

- `https://dns.alidns.com/resolve?name=litlie.zh.kg&type=A` 应返回上述 4 个 IP
- `https://litlie.zh.kg` 应显示首页，且页面中「当前访问域名」显示为 `litlie.zh.kg`
- 本机 DNS 存在代理 fake-IP 干扰，不要以 `ping` / `nslookup` 结果为准
