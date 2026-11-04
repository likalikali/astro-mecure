# Anriri 项目清理审计（2026-11-04）

审计仓库：`likalikali/astro-mecure`；目标站点：`https://blog.anriri.pp.ua/`。

本次以仓库目录树、站点配置、页面、内容集合、本地 CMS、依赖清单和较大的 TS/TSX/Astro 文件为依据做静态审查。源代码保留 Git 历史；未执行生产环境部署和在线渗透测试，不能将此文当作完整安全认证。

## 关键域名纠错

核对公开站点发现 `suborbit.net` 是原主题作者“银河渡舟”的博客，不是本站。原 CMS 与“关于”页的明确自有域名为 `blog.anriri.pp.ua`。已修正 Astro 的 `site`、文章作者头像绝对地址、管理后台和项目文档，避免生产构建的 canonical、RSS、sitemap 指向原作者站点。

## 已处理的问题

| 级别 | 问题 | 处理 |
| --- | --- | --- |
| 高 | `astro.config.ts` 的 `site` 与文章作者头像原来指向原作者域名 | 更正为站点配置中已有的 `blog.anriri.pp.ua`，上线前需核对实际部署域名 |
| 高 | 评论指向原作者的 `izmttk/izmttk.github.io` Giscus，访客留言可能发到错误仓库 | 在 `src/config.ts` 中关闭评论，待本站自己的 Discussions 与分类 ID 配齐后启用 |
| 高 | 搜索使用旧 Algolia 应用和 `wider` 索引 | 移除过期凭据，隐藏搜索按钮，避免查询发送到第三方索引 |
| 高 | 本地 CMS 把提交说明拼进 Shell 命令，允许特殊字符造成命令执行 | Git commit 改用 `execFile` 和参数列表；保留固定的 Git 命令 |
| 中 | CMS 未做 Host / Origin 校验、路径判断采用字符串前缀 | 拒绝非本地 Host、跨站 Origin 与跨站 Fetch；使用目录边界解析路径 |
| 中 | CMS 上传允许任意扩展名 | 限制受支持的图片 MIME 与扩展名，不允许新上传 SVG |
| 中 | `src/config.ts` 作者填写模板作者 `Wider` | 改为 `Anriri`；保留站点维护者提供的头像及社交链接 |
| 中 | 2020–2023 年有 5 篇旧主题的技术/Markdown 示例文章 | 标记 `draft: true`，停止生成公开页面；保留源文件以便核对 |
| 低 | 个人介绍、更新日志、README 中残留上游作者的生平、发布说明和 Netlify 徽章 | 改为本站自己的中性信息、维护记录与使用说明 |
| 低 | 友链申请跳到上游仓库；存在自指友链 `wider` | 更换 PR 地址，移除自指条目，保留其他友链待维护者核对 |
| 低 | 推荐主题组件跳向上游仓库，旧头像文件残留 | 从侧边栏移除推荐组件并清理未使用的旧头像/推荐封面 |
| 低 | 站内引用声明含旧邮箱，CMS 多处仍用旧二级域名 | 更新为站点现有联系邮箱与 `blog.anriri.pp.ua` |
| 低 | 浏览器 favicon 仍是原主题图标 | 增加自制樱花大福 `favicon.svg`，同时替换 `favicon.ico`，提供浏览器兼容回退 |

## 明确保留的内容

- `LICENSE` 中原作者的 MIT 版权说明：这是许可证要求，不能因去模板化而移除。
- 项目源代码、通用组件、Astro/React/Tailwind 技术栈及项目仓库地址：属于代码来源或正常基础设施。
- 2026 年的文章 `loopvar-and-closure-index.md`、当前个人头像和已配置的社交主页。
- `src/content/friends/` 中除自指 `wider.json` 之外的友链：未确认是否由维护者主动添加，不擅自删除。
- 引用声明中的 Freepik / Pixiv 素材出处，避免删除图片许可信息。

## 尚待人工确认 / 剩余风险

1. **评论与搜索**目前暂时不可用；应分别建立自己的 GitHub Discussions 与 Algolia 索引，随后再启用。
2. **旧示例文章**虽已不公开，仍在 Git 仓库中。若确认无用可进一步删除或移入独立备份。
3. **友情链接**中的 Arthals、JutasITe、Reashal 是否属于本人真实友链，仍需维护者判断。
4. **图片权利**：首页 Hero、樱花背景、404 插图等仍保留。出处已列出，但未经逐一核对授权，不能保证可用于任何用途。
5. **加密文章密码**：`access.password` 以明文写入提交到公开 GitHub 的 Markdown frontmatter，泄露给任何仓库读者。现有“加密文章”只保护静态页面浏览，不保护仓库源文件；不要填写敏感密码，敏感内容应采用服务端授权方案。
6. **npm 依赖**：`package.json` 和 lockfile 里仍包含较旧版本、可能不用的 DocSearch/Waline 等依赖。未执行 `npm audit`，不能宣称无已知漏洞；升级建议在独立分支并经过构建、回归测试后进行。
7. **CMS**：仅允许本机使用，不应该暴露公网。后台仍具备读写文件及 Git 推送能力。
8. **生产部署和缓存**：仓库更新不代表网站已部署；favicon 可能被浏览器强缓存，重新部署后需要强制刷新或换浏览器确认。

## 建议回归检查

```bash
npm ci
npm run build
npm audit --omit=dev
npm run studio
```

请确认首页、文章、标签/分类、RSS、站点地图、404 页面正常；检查浏览器标签页图标及 `/favicon.svg`、`/favicon.ico`；在浏览器网络面板确认不再请求旧的 Algolia 索引或加载旧 Giscus。

**备注**：这是一份静态审计及修复记录，并非所有依赖、图片版权和线上部署都已经获得验证。
