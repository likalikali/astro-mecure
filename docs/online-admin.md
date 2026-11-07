# 在线内容后台：即时发布

入口：https://blog.anriri.pp.ua/admin/ 。管理员密码与入口保持不变。

## 日常使用

- 文章支持新增、修改、删除、分类和标签，以及公开/草稿切换。
- 创建时间、首次上传时间、最后修改时间独立设置，均按北京时间输入。默认保存时自动更新最后修改时间，取消勾选可以手工填写。
- 关于、引用声明、更新日志和三个时期的回忆录可编辑；评论和侧边栏可开关。
- 关于页的 `<!-- 三色团子入口 -->` 标记可移动，保存时保留三个团子。
- **点击“保存并立即生效”后，数据库写入成功即发布，无需 GitHub 提交或构建。** 已打开的公网页面刷新后显示新内容；草稿不公开。
- 编辑器使用 Markdown，不执行正文内的 JavaScript/MDX 导入。支持表格、代码块、数学公式、图片链接；图片上传不在本次改造范围内。
- 同一篇内容若被其他窗口先修改，会阻止覆盖。复制未保存文字后重新打开再编辑。

## 数据和备份

- 内容保存在 Supabase 的独立 `astro-mecure` 项目（`pscwmncvcmvrqnynphpl`）。`blog_documents` 保存当前内容，`blog_document_versions` 自动保存每次修改的完整版本。
- 删除是软删除，内容及历史版本保留，管理员可通过数据库恢复。历史版本目前不在编辑界面显示。
- GitHub 保存网站代码。`src/content/blog/` 和 `content-backup/pages/` 是切换时的文件快照，此后网页编辑以数据库为准；不要再通过旧本地 Studio 发布文章。
- 重复运行 `node --env-file=.env.database.local scripts/migrate-content-database.mjs` 只补缺失记录，不覆盖已有在线修改。
- 导出备份：`node --env-file=.env.database.local scripts/export-content-database.mjs`，文件写入 Git 忽略的 `_drafts/database-backups/`。备份包含正文、草稿及可能的文章访问设置，应按私密资料保管。
- Supabase 的可用性决定动态内容是否可读。免费项目可能因长期不活跃被暂停，届时在 Supabase 控制台恢复项目；数据库不可用时本站不会回退展示过时或已删除的文章。

## 部署配置

Vercel Production 保留 `BLOG_ADMIN_PASSWORD_HASH`、`BLOG_SESSION_SECRET`，新增：

- `BLOG_DATABASE_URL`：项目 API 地址。
- `BLOG_DATABASE_SECRET`：仅保存在服务器的 Supabase secret / legacy service_role key。

不再使用 `BLOG_GITHUB_TOKEN` 发布文章。内容表开启 RLS，撤销 anon/authenticated 的表权限；只有服务器凭据可读写。Supabase 的“RLS enabled, no policy”信息提示在这里是预期行为：这些表没有公开客户端访问。

Astro 改为服务端渲染。首页、正文、归档、分类、标签、搜索、RSS 与 sitemap 每次请求读取当前数据；只在单次请求内合并重复读取，不跨请求缓存。文章地址和页面地址保持不变。

Astro 4 使用兼容的 Vercel 7 适配器；构建后的 `finalize-vercel-runtime.mjs` 将函数运行环境设为已经验证的 Node 22，避免旧适配器默认输出退役的 Node 18。

## 检查与回退

- `npm run build`：安全、时间、数据库冲突、正文渲染与构建检查。
- `node --env-file=.env.database.local --env-file=.env.admin.local node_modules/astro/astro.js dev --host 127.0.0.1 --port 5190`：本地动态站点。
- `node scripts/verify-instant-publishing.mjs [站点地址]`：新增临时验证文章，测试草稿、三个时间、发布、更新、删除和各列表实时变化，最后清理验证文章。
- 回退代码前先导出数据库，避免遗失迁移后新增内容。旧 GitHub 版本只包含切换前快照，不能代替最新数据库备份。
