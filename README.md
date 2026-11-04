# Anriri 记事簿

个人博客：[blog.anriri.pp.ua](https://blog.anriri.pp.ua/)。使用 [Astro](https://astro.build/)、React、TypeScript 与 Tailwind CSS 搭建，并在开源主题 [astro-mecure](https://github.com/izmttk/astro-mecure) 上进行个性化修改。

## 本地运行

安装 Node.js 和 npm 后运行：

```bash
npm ci
npm run dev
```

构建和本地预览：

```bash
npm run build
npm run preview
```

- `src/config.ts`：站点标题、导航、作者与页面设置
- `src/content/authors/default.json`：文章作者信息
- `src/content/blog/`：博客内容
- `src/content/friends/`：友情链接
- `public/favicon.svg` 和 `public/favicon.ico`：标签页图标
- `src/assets/avatar-sakura.webp`：侧边栏头像

## 本地文章管理

```bash
npm run studio
```

管理服务默认监听 `127.0.0.1:4322`，可保存文章、管理插图并调用本地 Git 提交/推送。**不要把管理后台通过反向代理暴露到公网。** 运行前请确认 Git 和 Node.js 已正确安装、配置。

## 服务配置提醒

原模板的 **Giscus** 评论仓库属于上游，评论暂时关闭，待配置本人有权限的 GitHub Discussions 后再启用。原来的 **Algolia** 远程搜索已替换为本站构建的本地文章索引（`/search-index.json`），不再向上游搜索服务发送关键词。现有模板示例文章暂设为 `draft: true`，源文件保留备查，不再公开生成页面。

**关于加密文章**：当前功能的 `access.password` 仍写在文章 frontmatter 中。公开仓库中密码是可见的，所以不能将此功能当作真正保密的访问控制，也不要使用真实重要密码。

## 许可证及来源

本项目沿用上游主题的 MIT 许可证。原版权声明按许可证要求保留在 [LICENSE](./LICENSE)，网站素材来源见[引用声明](https://blog.anriri.pp.ua/reference)。

清理与安全检查记录见 [项目审计](./docs/PROJECT_AUDIT_2026-11-04.md)。
