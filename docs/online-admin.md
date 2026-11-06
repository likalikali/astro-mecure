# 在线内容后台

入口：`https://blog.anriri.pp.ua/admin/`。管理员登录后可管理文章，以及关于、引用声明、更新日志、故乡/东北亚/江南三个时期页面。

## 使用

- 文章：新增、编辑、删除，修改分类和标签，切换公开/草稿。创建时间、首次上传时间和最后修改时间均可独立设置，按北京时间输入。默认保存时自动更新修改时间，取消勾选即可手工指定。
- 独立页面：修改标题、简介和正文，开关评论与侧边栏。关于页中 `<!-- 三色团子入口 -->` 可移动，保存时自动恢复团子组件。
- 保存直接提交到 GitHub `main`，随后等待 Vercel 自动发布；后台显示发布状态。通常 1–2 分钟，具体取决于构建队列。失败时 GitHub 中的修改仍在，修正后再保存。
- 同一内容被其他窗口修改时拒绝覆盖；先复制未保存正文，再重新打开文章。
- 编辑器支持 Markdown 与图片链接。现有文章未在表单显示的图片、密码保护等元数据保留。此版本不包含图片文件上传、站点布局代码或全局配置编辑。
- 删除文章后可从 GitHub 提交记录恢复。公开仓库的草稿文件也可被查看。

## 服务器配置

Vercel 项目 `astro-mecure` 的 Production 环境需要三个 **Secret** 变量（不要使用 PUBLIC 前缀）：

| 名称 | 用途 |
| --- | --- |
| `BLOG_ADMIN_PASSWORD_HASH` | 管理员密码的 scrypt 盐和摘要，格式 `salt:hexHash` |
| `BLOG_SESSION_SECRET` | 至少 32 字符的随机会话签名密钥 |
| `BLOG_GITHUB_TOKEN` | 仅授权 `likalikali/astro-mecure` 的 fine-grained PAT，Contents 读写权限；MetaData 默认读取 |

密码与签名密钥可通过 `node scripts/create-admin-credentials.mjs` 生成。文件保存在 Git 忽略的 `.env.admin.local` 和 `admin-credentials.local.txt` 中。将三项变量配置完成后重新部署，设置才会生效。GitHub token 过期时需要替换。

不要把电脑上其他用途的全账户 GitHub 凭据复制进此后台。使用专门为此仓库授权的令牌。

登录使用 HTTPS、HttpOnly / Secure / SameSite=Strict 的 8 小时会话 Cookie，写操作校验固定站点 Origin，文件路径只允许指定内容区域，保存使用 GitHub 文件版本校验防止覆盖。登录尝试另有每个函数实例的限速（不是分布式限速），应使用生成的高强度密码；若需要额外防护可在部署平台添加登录端点限速规则。API 和后台不缓存、不索引，未配置时拒绝操作。

## 检查

`npm run test:admin` 检查路径边界、会话、密码、三个日期与页面组件保留；`npm run build` 包含这些检查。

上线后验证：未登录不能读取内容；登录可列出文章和六个独立页面；修改测试文章并保存，等待发布成功，核对公网内容与三个时间；退出后读取接口被拒绝。
