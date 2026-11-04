import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import matter from 'gray-matter';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT_DIR, 'src', 'content', 'blog');
const UI_DIR = path.join(__dirname, 'cms-ui');
const TRASH_DIR = path.join(ROOT_DIR, '_drafts', '.trash');

const PORT = Number(process.env.CMS_PORT || 4322);
const SITE_URL = 'https://blog.anriri.pp.ua';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('请求体过大（超过 25MB）'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('无效的 JSON 请求格式'));
      }
    });
    req.on('error', reject);
  });
}

function formatDateForYaml(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString();
  }
  const str = String(val).trim();
  if (!str) return '';
  // Keep YYYY-MM-DD or YYYY-MM-DD HH:mm:ss or ISO format unquoted for Astro z.date()
  if (/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return str;
}

function formatYamlString(val) {
  const str = String(val ?? '').trim();
  if (!str) return '""';
  // If contains special YAML chars, wrap with JSON.stringify
  if (/[:#\[\]{}&*!|>'"%@`\n\r]/.test(str) || /^\d+$/.test(str) || /^(true|false|null|yes|no)$/i.test(str)) {
    return JSON.stringify(str);
  }
  return str;
}

function buildFrontmatter(meta) {
  const lines = ['---'];
  const title = (meta.title || '未命名文章').trim();
  lines.push(`title: ${formatYamlString(title)}`);

  const dateStr = formatDateForYaml(meta.date) || new Date().toISOString();
  lines.push(`date: ${dateStr}`);

  const updateDateStr = formatDateForYaml(meta.updateDate);
  if (updateDateStr) {
    lines.push(`updateDate: ${updateDateStr}`);
  }

  if (meta.draft === true) {
    lines.push('draft: true');
  }

  // Deduplicate tags to satisfy src/content/config.ts Zod refine rule
  const tags = Array.isArray(meta.tags)
    ? [...new Set(meta.tags.map(t => String(t).trim()).filter(Boolean))]
    : [];
  if (tags.length > 0) {
    lines.push(`tags: [${tags.map(formatYamlString).join(', ')}]`);
  }

  const category = Array.isArray(meta.category)
    ? meta.category.map(c => String(c).trim()).filter(Boolean)
    : [];
  if (category.length > 0) {
    lines.push(`category: [${category.map(formatYamlString).join(', ')}]`);
  }

  if (meta.image && String(meta.image).trim()) {
    lines.push(`image: ${formatYamlString(String(meta.image).trim())}`);
  }

  if (meta.cardVariant && meta.cardVariant !== 'blur') {
    lines.push(`cardVariant: ${meta.cardVariant}`);
  }

  if (meta.permalink && String(meta.permalink).trim()) {
    lines.push(`permalink: ${formatYamlString(String(meta.permalink).trim())}`);
  }

  if (meta.author && String(meta.author).trim() && meta.author !== 'default') {
    lines.push(`author: ${formatYamlString(String(meta.author).trim())}`);
  }

  if (meta.access && meta.access.password && String(meta.access.password).trim()) {
    lines.push('access:');
    lines.push(`  password: ${JSON.stringify(String(meta.access.password).trim())}`);
    if (meta.access.hint && String(meta.access.hint).trim()) {
      lines.push(`  hint: ${JSON.stringify(String(meta.access.hint).trim())}`);
    }
    if (meta.access.excerpt && String(meta.access.excerpt).trim()) {
      lines.push(`  excerpt: ${JSON.stringify(String(meta.access.excerpt).trim())}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

function normalizeDateToISO(val, fallbackMtime) {
  if (!val && fallbackMtime) return new Date(fallbackMtime).toISOString();
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString();
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return fallbackMtime ? new Date(fallbackMtime).toISOString() : new Date().toISOString();
}

function normalizeDateForInput(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  return String(val);
}

async function scanBlogPosts() {
  const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
  const posts = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      const fullPath = path.join(BLOG_DIR, entry.name);
      const post = await parsePostFile(fullPath, entry.name, false);
      if (post) posts.push(post);
    } else if (entry.isDirectory()) {
      const dirPath = path.join(BLOG_DIR, entry.name);
      const dirFiles = await fs.readdir(dirPath);
      const indexFile = dirFiles.find(f => f === 'index.mdx' || f === 'index.md');
      if (indexFile) {
        const relId = `${entry.name}/${indexFile}`;
        const fullPath = path.join(dirPath, indexFile);
        const assets = dirFiles.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
        const post = await parsePostFile(fullPath, relId, true, assets);
        if (post) posts.push(post);
      }
    }
  }

  posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

  // Collect global tags & categories statistics
  const tagMap = new Map();
  const categoryMap = new Map();

  for (const p of posts) {
    for (const t of p.tags) {
      tagMap.set(t, (tagMap.get(t) || 0) + 1);
    }
    if (p.category.length > 0) {
      const catKey = p.category.join(' / ');
      categoryMap.set(catKey, {
        path: p.category,
        label: catKey,
        count: (categoryMap.get(catKey)?.count || 0) + 1,
      });
    }
  }

  const allTags = [...tagMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const allCategories = [...categoryMap.values()].sort((a, b) => b.count - a.count);

  return { posts, allTags, allCategories };
}

async function parsePostFile(fullPath, relId, isFolder, assets = []) {
  try {
    const [rawContent, stat] = await Promise.all([
      fs.readFile(fullPath, 'utf-8'),
      fs.stat(fullPath),
    ]);
    const parsed = matter(rawContent);
    const data = parsed.data || {};
    const body = parsed.content || '';
    const ext = path.extname(relId);
    const slug = isFolder
      ? relId.split('/')[0]
      : path.basename(relId, ext);

    const plainText = body
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/[#>*`~\-_]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = plainText.length;
    const excerpt = data.access?.excerpt || plainText.slice(0, 140);

    return {
      id: relId.replace(/\\/g, '/'),
      slug,
      isFolder,
      ext,
      title: data.title || slug,
      date: normalizeDateForInput(data.date),
      dateISO: normalizeDateToISO(data.date, stat.birthtimeMs || stat.mtimeMs),
      updateDate: normalizeDateForInput(data.updateDate),
      draft: Boolean(data.draft),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      category: Array.isArray(data.category) ? data.category.map(String) : [],
      image: data.image ? String(data.image) : '',
      cardVariant: data.cardVariant || 'blur',
      permalink: data.permalink ? String(data.permalink) : '',
      author: data.author ? String(data.author) : 'default',
      access: data.access
        ? {
            password: String(data.access.password || ''),
            hint: data.access.hint ? String(data.access.hint) : '',
            excerpt: data.access.excerpt ? String(data.access.excerpt) : '',
          }
        : null,
      wordCount,
      excerpt,
      assets,
      mtime: stat.mtime.toISOString(),
    };
  } catch (err) {
    console.error(`Failed to parse ${relId}:`, err);
    return null;
  }
}

function sanitizeSlug(input) {
  return String(input || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^\.+|\.+$/g, '');
}

async function runGitCommand(cmd) {
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: ROOT_DIR,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: stdout.replace(/[\r\n]+$/, ''),
    stderr: stderr.replace(/[\r\n]+$/, ''),
  };
}

// Avoid shell interpolation for user-provided commit messages.
async function runGitArgs(args) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: ROOT_DIR,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: stdout.replace(/[\r\n]+$/, ''),
    stderr: stderr.replace(/[\r\n]+$/, ''),
  };
}

function resolveBlogPath(relativePath) {
  const fullPath = path.resolve(BLOG_DIR, relativePath);
  if (!fullPath.startsWith(BLOG_DIR + path.sep)) {
    throw new Error('非法路径访问');
  }
  return fullPath;
}

async function getGitStatus() {
  try {
    const [statusRes, branchRes, remoteRes, logRes] = await Promise.all([
      runGitCommand('git status --porcelain -uall'),
      runGitCommand('git branch --show-current'),
      runGitCommand('git remote get-url origin').catch(() => ({ stdout: '' })),
      runGitCommand('git log -n 6 --pretty=format:"%h|%s|%cr|%an"').catch(() => ({ stdout: '' })),
    ]);

    // Check ahead/behind count
    let ahead = 0;
    let behind = 0;
    try {
      const abRes = await runGitCommand('git rev-list --left-right --count HEAD...@{u}');
      const parts = abRes.stdout.split(/\s+/);
      if (parts.length >= 2) {
        ahead = Number(parts[0]) || 0;
        behind = Number(parts[1]) || 0;
      }
    } catch {
      // ignore if upstream not tracked
    }

    const changes = statusRes.stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const code = line.slice(0, 2);
        let filePath = line.slice(3).trim();
        // Unquote git escaped paths if any
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          try {
            filePath = JSON.parse(filePath);
          } catch {}
        }
        return {
          code,
          path: filePath,
          isBlog: filePath.startsWith('src/content/blog/'),
        };
      });

    const commits = logRes.stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, subject, time, author] = line.split('|');
        return { hash, subject, time, author };
      });

    return {
      branch: branchRes.stdout || 'main',
      remote: remoteRes.stdout || 'https://github.com/likalikali/astro-mecure.git',
      siteUrl: SITE_URL,
      ahead,
      behind,
      changes,
      commits,
    };
  } catch (err) {
    return {
      branch: 'main',
      remote: '',
      siteUrl: SITE_URL,
      ahead: 0,
      behind: 0,
      changes: [],
      commits: [],
      error: err.message,
    };
  }
}

const server = http.createServer(async (req, res) => {
  try {
    // Only serve the local editor to requests addressed to this loopback port.
    const allowedHosts = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
    if (!allowedHosts.includes(req.headers.host || '')) {
      return sendJson(res, 403, { error: '未授权的 Host' });
    }
    if (req.headers.origin) {
      const allowedOrigins = allowedHosts.map(host => `http://${host}`);
      if (!allowedOrigins.includes(req.headers.origin)) {
        return sendJson(res, 403, { error: '跨站请求已被拒绝' });
      }
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      return sendJson(res, 403, { error: '跨站请求已被拒绝' });
    }
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // API Routes
    if (pathname === '/api/posts' && req.method === 'GET') {
      const data = await scanBlogPosts();
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/post' && req.method === 'GET') {
      const id = reqUrl.searchParams.get('id');
      if (!id) return sendJson(res, 400, { error: '缺少文章 id 参数' });
      const safeRel = path.normalize(id).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = resolveBlogPath(safeRel);
      if (!fullPath.startsWith(BLOG_DIR)) {
        return sendJson(res, 403, { error: '非法路径访问' });
      }
      const isFolder = safeRel.includes('/') || safeRel.includes('\\');
      let assets = [];
      if (isFolder) {
        const dirFiles = await fs.readdir(path.dirname(fullPath));
        assets = dirFiles.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
      }
      const meta = await parsePostFile(fullPath, safeRel, isFolder, assets);
      if (!meta) return sendJson(res, 404, { error: '文章不存在或无法解析' });
      const rawFile = await fs.readFile(fullPath, 'utf-8');
      const parsed = matter(rawFile);
      return sendJson(res, 200, {
        ...meta,
        content: parsed.content.replace(/^\r?\n/, ''),
        rawFile,
      });
    }

    if (pathname === '/api/asset' && req.method === 'GET') {
      const slug = reqUrl.searchParams.get('slug') || '';
      const file = reqUrl.searchParams.get('file') || '';
      const cleanFile = file.replace(/^\.\//, '');
      const targetPath = resolveBlogPath(path.join(sanitizeSlug(slug), path.basename(cleanFile)));
      if (!targetPath.startsWith(BLOG_DIR) || !fsSync.existsSync(targetPath)) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const ext = path.extname(targetPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fsSync.createReadStream(targetPath).pipe(res);
      return;
    }

    if (pathname === '/api/post' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        originalId,
        slug: rawSlug,
        isFolder = false,
        ext: rawExt = '.mdx',
        meta = {},
        content = '',
      } = body;

      const ext = rawExt === '.md' ? '.md' : '.mdx';
      const slug = sanitizeSlug(rawSlug || meta.title || 'untitled-post');
      if (!slug) {
        return sendJson(res, 400, { error: 'Slug / 文件名不能为空' });
      }

      const targetRelId = isFolder ? `${slug}/index${ext}` : `${slug}${ext}`;
      const targetFullPath = resolveBlogPath(targetRelId);

      // Check collision if creating a new post or renaming
      if (!originalId || originalId !== targetRelId) {
        const exists = fsSync.existsSync(targetFullPath);
        if (exists) {
          return sendJson(res, 409, { error: `目标文章 "${targetRelId}" 已存在，请更换 Slug 或直接编辑该文章` });
        }
      }

      // Ensure directory exists if folder mode
      if (isFolder) {
        await fs.mkdir(path.dirname(targetFullPath), { recursive: true });
      }

      // If converting or renaming from an existing post
      if (originalId && originalId !== targetRelId) {
        const oldFullPath = resolveBlogPath(path.normalize(originalId).replace(/^(\.\.(\/|\\|$))+/, ''));
        if (oldFullPath.startsWith(BLOG_DIR) && fsSync.existsSync(oldFullPath)) {
          const oldIsFolder = originalId.includes('/') || originalId.includes('\\');
          if (oldIsFolder && isFolder) {
            // Move all assets from old folder to new folder
            const oldDir = path.dirname(oldFullPath);
            const newDir = path.dirname(targetFullPath);
            if (oldDir !== newDir) {
              const files = await fs.readdir(oldDir);
              for (const f of files) {
                if (f !== 'index.md' && f !== 'index.mdx') {
                  await fs.rename(path.join(oldDir, f), path.join(newDir, f));
                }
              }
            }
            await fs.unlink(oldFullPath);
            // Remove old dir if empty
            const remaining = await fs.readdir(oldDir).catch(() => []);
            if (remaining.length === 0) {
              await fs.rmdir(oldDir).catch(() => {});
            }
          } else {
            await fs.unlink(oldFullPath);
          }
        }
      }

      const frontmatter = buildFrontmatter(meta);
      const normalizedBody = String(content || '').replace(/\r\n/g, '\n');
      const finalFileContent = `${frontmatter}\n\n${normalizedBody.trimStart()}${normalizedBody.endsWith('\n') ? '' : '\n'}`;

      await fs.writeFile(targetFullPath, finalFileContent, 'utf-8');

      let assets = [];
      if (isFolder) {
        const dirFiles = await fs.readdir(path.dirname(targetFullPath));
        assets = dirFiles.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
      }

      const savedPost = await parsePostFile(targetFullPath, targetRelId, isFolder, assets);
      return sendJson(res, 200, {
        ok: true,
        message: `文章已保存至 src/content/blog/${targetRelId}`,
        post: savedPost,
      });
    }

    if (pathname === '/api/post' && req.method === 'DELETE') {
      const id = reqUrl.searchParams.get('id');
      if (!id) return sendJson(res, 400, { error: '缺少 id 参数' });
      const safeRel = path.normalize(id).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = resolveBlogPath(safeRel);
      if (!fullPath.startsWith(BLOG_DIR) || !fsSync.existsSync(fullPath)) {
        return sendJson(res, 404, { error: '文章不存在' });
      }

      await fs.mkdir(TRASH_DIR, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const isFolder = safeRel.includes('/') || safeRel.includes('\\');

      if (isFolder) {
        const folderName = safeRel.split(/[/\\]/)[0];
        const srcFolder = path.join(BLOG_DIR, folderName);
        const destFolder = path.join(TRASH_DIR, `${folderName}_${timestamp}`);
        await fs.cp(srcFolder, destFolder, { recursive: true });
        await fs.rm(srcFolder, { recursive: true, force: true });
      } else {
        const destFile = path.join(TRASH_DIR, `${path.basename(safeRel)}_${timestamp}`);
        await fs.copyFile(fullPath, destFile);
        await fs.unlink(fullPath);
      }

      return sendJson(res, 200, {
        ok: true,
        message: `已移入回收站备份 (_drafts/.trash/)`,
      });
    }

    if (pathname === '/api/upload-image' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { slug: rawSlug, filename: rawFilename, dataUrl, currentId } = body;
      const slug = sanitizeSlug(rawSlug || 'new-post');
      if (!slug || !dataUrl) {
        return sendJson(res, 400, { error: '缺少 slug 或图片数据' });
      }

      const matches = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return sendJson(res, 400, { error: '无效的 Base64 图片格式' });
      }
      const allowedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
      if (!allowedImageMimeTypes.has(matches[1].toLowerCase())) {
        return sendJson(res, 400, { error: '仅允许上传 PNG / JPEG / WebP / GIF 图片' });
      }
      const buffer = Buffer.from(matches[2], 'base64');
      const safeFile = path.basename(rawFilename || `img-${Date.now()}.png`).replace(/\s+/g, '-');
      if (!IMAGE_EXTS.has(path.extname(safeFile).toLowerCase()) || path.extname(safeFile).toLowerCase() === '.svg') {
        return sendJson(res, 400, { error: '不支持的图片扩展名' });
      }
      const targetDir = resolveBlogPath(slug);
      await fs.mkdir(targetDir, { recursive: true });

      // If the post was previously a single file (<slug>.md or <slug>.mdx), migrate it into <slug>/index.md(x)
      let migratedId = null;
      if (currentId && !currentId.includes('/') && !currentId.includes('\\')) {
        const oldPath = path.join(BLOG_DIR, path.basename(currentId));
        if (fsSync.existsSync(oldPath)) {
          const ext = path.extname(currentId);
          const newIndex = path.join(targetDir, `index${ext}`);
          if (!fsSync.existsSync(newIndex)) {
            await fs.rename(oldPath, newIndex);
            migratedId = `${slug}/index${ext}`;
          }
        }
      }

      const filePath = path.join(targetDir, safeFile);
      await fs.writeFile(filePath, buffer);

      const dirFiles = await fs.readdir(targetDir);
      const assets = dirFiles.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));

      return sendJson(res, 200, {
        ok: true,
        filename: safeFile,
        markdownPath: `./${safeFile}`,
        previewUrl: `/api/asset?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(safeFile)}`,
        assets,
        migratedId,
      });
    }

    if (pathname === '/api/import-md' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { filename = 'imported.mdx', rawText = '' } = body;
      const ext = filename.toLowerCase().endsWith('.md') ? '.md' : '.mdx';
      const baseSlug = sanitizeSlug(filename.replace(/\.(mdx?|markdown)$/i, ''));

      let parsedData = {};
      let content = rawText;
      try {
        const parsed = matter(rawText);
        parsedData = parsed.data || {};
        content = parsed.content || '';
      } catch {
        content = rawText;
      }

      // Extract first H1 if title is not in frontmatter
      let inferredTitle = parsedData.title || '';
      if (!inferredTitle) {
        const h1Match = content.match(/^\s*#\s+(.+)$/m);
        if (h1Match) {
          inferredTitle = h1Match[1].trim();
        } else {
          inferredTitle = filename.replace(/\.(mdx?|markdown)$/i, '');
        }
      }

      return sendJson(res, 200, {
        ok: true,
        slug: baseSlug,
        ext,
        meta: {
          title: inferredTitle,
          date: normalizeDateForInput(parsedData.date) || new Date().toISOString(),
          updateDate: normalizeDateForInput(parsedData.updateDate),
          draft: Boolean(parsedData.draft),
          tags: Array.isArray(parsedData.tags) ? parsedData.tags.map(String) : [],
          category: Array.isArray(parsedData.category) ? parsedData.category.map(String) : [],
          image: parsedData.image ? String(parsedData.image) : '',
          cardVariant: parsedData.cardVariant || 'blur',
          permalink: parsedData.permalink ? String(parsedData.permalink) : '',
          access: parsedData.access || null,
        },
        content: content.replace(/^\r?\n/, ''),
      });
    }

    if (pathname === '/api/git/status' && req.method === 'GET') {
      const status = await getGitStatus();
      return sendJson(res, 200, status);
    }

    if (pathname === '/api/git/publish' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        commitMessage = '',
        scope = 'blog', // 'blog' | 'all'
        push = true,
      } = body;

      const logs = [];
      const addTarget = scope === 'all' ? '.' : 'src/content/blog';

      try {
        logs.push({ step: 'git add', status: 'running', detail: `git add ${addTarget}` });
        await runGitCommand(`git add ${addTarget}`);
        logs[logs.length - 1].status = 'done';

        const statusCheck = await runGitCommand('git status --porcelain');
        const stagedLines = statusCheck.stdout
          .split('\n')
          .filter(l => l && !l.startsWith('??') && !l.startsWith(' '));

        if (stagedLines.length > 0) {
          const msg = commitMessage || `post: 更新博客文章 (${new Date().toLocaleString('zh-CN')})`;
          logs.push({ step: 'git commit', status: 'running', detail: 'git commit -m [message]' });
          const commitRes = await runGitArgs(['commit', '-m', msg]);
          logs[logs.length - 1].status = 'done';
          logs[logs.length - 1].output = commitRes.stdout;
        } else {
          logs.push({ step: 'git commit', status: 'skipped', detail: '工作区没有新的更改需要提交，直接检查推送状态' });
        }

        if (push) {
          logs.push({ step: 'git push', status: 'running', detail: 'git push origin HEAD' });
          const pushRes = await runGitCommand('git push origin HEAD');
          logs[logs.length - 1].status = 'done';
          logs[logs.length - 1].output = pushRes.stdout || pushRes.stderr || '推送成功';
        }

        const updatedStatus = await getGitStatus();
        return sendJson(res, 200, {
          ok: true,
          message: push
            ? '已成功提交并推送到 GitHub！线上站点 blog.anriri.pp.ua 将根据部署设置更新。'
            : '已成功提交到本地 Git 仓库！',
          logs,
          gitStatus: updatedStatus,
        });
      } catch (err) {
        if (logs.length > 0 && logs[logs.length - 1].status === 'running') {
          logs[logs.length - 1].status = 'error';
          logs[logs.length - 1].output = err.stderr || err.stdout || err.message;
        }
        return sendJson(res, 500, {
          ok: false,
          error: err.stderr || err.message || 'Git 操作执行失败',
          logs,
        });
      }
    }

    if (pathname === '/api/build-check' && req.method === 'POST') {
      try {
        const { stdout, stderr } = await execAsync('npm run build', {
          cwd: ROOT_DIR,
          maxBuffer: 20 * 1024 * 1024,
        });
        return sendJson(res, 200, {
          ok: true,
          message: 'Astro 静态构建校验通过！没有任何 Schema 或渲染错误。',
          output: (stdout + '\n' + stderr).trim().slice(-2000),
        });
      } catch (err) {
        return sendJson(res, 400, {
          ok: false,
          error: '构建校验未通过，请检查 Frontmatter 或 MDX 语法',
          output: ((err.stdout || '') + '\n' + (err.stderr || err.message || '')).trim().slice(-2500),
        });
      }
    }

    // Serve Static UI Files
    let filePath = pathname === '/' ? path.join(UI_DIR, 'index.html') : path.resolve(UI_DIR, '.' + pathname);
    if (!filePath.startsWith(UI_DIR + path.sep) || !fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
      filePath = path.join(UI_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  } catch (err) {
    console.error('CMS Server Error:', err);
    sendJson(res, 500, { error: err.message || '服务器内部错误' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n========================================================`);
  console.log(`  🚀 Anriri Blog Studio 可视化文章发布系统已启动`);
  console.log(`  👉 管理后台地址: http://localhost:${PORT}`);
  console.log(`  🌐 线上博客地址: https://blog.anriri.pp.ua`);
  console.log(`========================================================\n`);
});
