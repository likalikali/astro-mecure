# Anriri 项目清理审计（2026-11-04）

审计仓库：`likalikali/astro-mecure`；目标站点：`https://blog.anriri.pp.ua/`。

本次以仓库目录树、站点配置、页面、内容集合、本地 CMS、依赖清单和较大的 TS/TSX/Astro 文件为依据做静态审查。源代码保留 Git 历史；未执行生产环境部署和在线渗透测试，不能将此文当作完整安全认证。

## 关键域名纠错

核对公开站点发现 `suborbit.net` 是原主题作者“银河渡舟”的博客，不是本站。原 CMS 与“关于”页的明确自有域名为 `blog.anriri.pp.ua`。已修正 Astro 的 `site`、文章作者头像资源、管理后台和项目文档，避免生产构建的 canonical、RSS、sitemap 指向原作者站点。

## 已处理的问题

| 级别 | 问题 | 处理 |
| --- | --- | --- |
| 高 | `astro.config.ts` 的 `site` 与文章作者头像原来指向原作者域名 | 将 `site` 更正为现有记录中的 `blog.anriri.pp.ua`；作者头像改为打包本地图片，避免请求原作者站点。上线前仍需核对实际部署域名 |
| 高 | 评论指向原作者的 `izmttk/izmttk.github.io` Giscus，访客留言可能发到错误仓库 | 在 `src/config.ts` 中关闭评论，待本站自己的 Discussions 与分类 ID 配齐后启用 |
| 高 | 搜索使用旧 Algolia 应用和 `wider` 索引 | 移除过期凭据并使用站内静态 JSON 索引替代远程搜索，搜索按钮在桌面和移动端均可使用 |
| 高 | 本地 CMS 把提交说明拼进 Shell 命令，允许特殊字符造成命令执行 | Git commit 改用 `execFile` 和参数列表；保留固定的 Git 命令 |
| 中 | CMS 未做 Host / Origin 校验、路径判断采用字符串前缀 | 拒绝非本地 Host、跨站 Origin 与跨站 Fetch；使用目录边界解析路径 |
| 中 | CMS 上传允许任意扩展名 | 限制受支持的图片 MIME 与扩展名，不允许新上传 SVG |
| 中 | `src/config.ts` 作者填写模板作者 `Wider` | 改为 `Anriri`；保留站点维护者提供的头像及社交链接 |
| 中 | 2020–2023 年有 5 篇旧主题的技术/Markdown 示例文章 | 标记 `draft: true`，停止生成公开页面；保留源文件以便核对 |
| 低 | 个人介绍、更新日志、README 中残留上游作者的生平、发布说明和 Netlify 徽章 | 改为本站自己的中性信息、维护记录与使用说明 |
| 低 | 友链申请跳到上游仓库；存在自指友链 `wider` | 更换 PR 地址，移除原模板内的友链条目，改为空状态和本站邮箱/仓库申请入口 |
| 低 | 推荐主题组件跳向上游仓库，旧头像文件残留 | 从侧边栏移除推荐组件并清理未使用的旧头像/推荐封面 |
| 低 | 站内引用声明含旧邮箱，CMS 多处仍用旧二级域名 | 更新为站点现有联系邮箱与 `blog.anriri.pp.ua` |
| 低 | 浏览器 favicon 仍是原主题图标 | 增加自制樱花大福 `favicon.svg`，同时替换 `favicon.ico`，提供浏览器兼容回退 |

## 明确保留的内容

- `LICENSE` 中原作者的 MIT 版权说明：这是许可证要求，不能因去模板化而移除。
- 项目源代码、通用组件、Astro/React/Tailwind 技术栈及项目仓库地址：属于代码来源或正常基础设施。
- 2026 年的文章 `loopvar-and-closure-index.md`、当前个人头像和已配置的社交主页。
- 原始友链条目已从当前站点移除，可从 Git 历史恢复。
- 引用声明中的 Freepik / Pixiv 素材出处，避免删除图片许可信息。

## 尚待人工确认 / 剩余风险

1. **评论**目前暂时关闭；需要创建和配置本站自己的 GitHub Discussions。搜索现由本站生成本地静态索引，已不再依赖 Algolia。
2. **旧示例文章**虽已不公开，仍在 Git 仓库中。若确认无用可进一步删除或移入独立备份。
3. **友情链接**：原模板的 Arthals、JutasITe、Reashal 已移除。可按真实友链关系自行添加。
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

请确认首页、文章、标签/分类、RSS、站点地图、404 页面正常；检查浏览器标签页图标及 `/favicon.svg`、`/favicon.ico`；在浏览器网络面板确认不再请求旧的 Algolia 索引或加载旧 Giscus；测试 Ctrl/⌘ + K、手机端搜索按钮及 `/search-index.json`。

**备注**：这是一份静态审计及修复记录，并非所有依赖、图片版权和线上部署都已经获得验证。

## 补充修复

- 用自绘的大福 404 页面替代未明确授权的模板角色插画。
- 删除未引用的旧主题装饰 SVG、角色插画和工具记忆文件。
- 恢复移动端与桌面端搜索：使用本站的静态文章索引，自动排除草稿和密码保护文章，不依赖 Algolia。
- `favicon.ico` 已检查 ICO 结构：包含有效的 PNG 图像数据；`favicon.svg` 为 64×64 SVG。

- 友链页面去除了已失效的“留言申请”入口，并移除原模板留下的三个友链账号。

## 文章内容的来源核对（待作者确认）

- `src/content/blog/loopvar-and-closure-index.md/index.md` 的标题“循环变量与闭包”及开头段落，与上游网站 `https://suborbit.net/posts/loopvar-and-closure/` 的公开文章高度相似。该文件虽然使用 2026 年的日期，但仅凭日期不能确认版权归属。这篇是当前唯一保留公开的文章，为避免误删个人编辑内容及使首页变空，**本轮没有自动删除或隐藏**。请维护者核对作者与许可后再决定保留、改写或撤下。
- 其余五篇旧文章已经设置 `draft: true`；该处理会改变网站公开文章数量，源码保留在 Git 历史及工作树中。

- 本地 CMS 管理界面中的标签与分类建议，不再拼接带用户数据的行内 onclick 属性，而改用事件监听器；Markdown 本地预览仅允许 http(s)、站内相对地址、邮件和锚点链接，避免 javascript:/data: URL 出现在可点击链接中。

## 验证说明

- 2026-11-04：第二轮清理（独立搜索 / 大福 404）提交 `3411aefa` 对应的 GitHub Vercel 检查结果为 success。
- 原创友链清空与 CMS 建议/预览增强属于后续提交，需要再次等待对应 Vercel 构建通过。
- 由于当前工作环境无法直接获取远端 npm 依赖完整安装包，不声称执行过本地 `npm ci`、`npm run build` 或 `npm audit`。构建状态以 Vercel 为准。

## 依赖安全风险补充（高优先级）

已读取 `package-lock.json`，确认实际锁定：`astro@4.15.8`、`sharp@0.33.5`、`@docsearch/react@3.5.2`。请勿仅依据 package.json 的范围判断已安装版本。

截至 2026-11-04，Astro 上游公开安全公告中包括 [GHSA-26w7-cxv4-gfx2](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2)：不可信 AVIF 图片优化可能触发 Sharp/libheif 相关远程代码执行，受影响 Astro 版本小于 7.2.8，修复要求 Sharp 0.35.4。是否可在本项目触发还取决于具体图片输入和构建方式；不能仅凭包版本断定站点已经遭到攻击。

**已采取的临时缓解**：本地 CMS 暂停新上传 AVIF（仍支持 PNG / JPEG / WebP / GIF），减少不可信 AVIF 输入。**根本解决**：规划 Astro 与官方集成的受测升级、更新 lockfile、执行 `npm audit`，在 Vercel 预览环境回归文章、Markdown、图片、RSS、搜索、CMS 构建后发布。由于本轮无法运行完整本地依赖升级验证，未擅自升级主版本。

## 第三轮：内容归属与空站安全

- 2026-11-04：复核站点原稿，仓库里《循环变量与闭包》与上游 [原文章](https://suborbit.net/posts/loopvar-and-closure/) 的内容高度一致，上游发布于 2024-02-20，而当前稿件 frontmatter 为 2026 年日期。根据“清理他人痕迹”的要求，现将其设为草稿，避免将未经核实的原作者文章署名为 Anriri。源文件未删除，待本人核对权利或重新编写。
- 该变更使当前可公开文章数为零，因此给首页、归档、标签、分类添加空状态和零文章首页路径，避免整个网站显示空白或丢失根路由。
- **这不等于确定用户存在抄袭行为**：这是模板遗留内容的审慎处理，版权归属仍需基于用户自己的创作记录判断。

## 第三轮：CMS 文件上传安全

- 新增 `scripts/cms-image-validation.js`：按图片扩展名、请求 MIME 和文件头签名三层验证上传，仅接受 PNG/JPEG/GIF/WebP，拒绝 SVG/AVIF 和格式伪装，上传单图限制 8MB。
- 新增 `npm run test:security`（基于 Node 内置 `node:test`），覆盖合法图片、扩展名与 MIME 伪装、超大图片和异常文件名。
- 注意：魔数校验不等于完整解码或安全扫描，依然需要升级 Sharp 及其上游依赖。
