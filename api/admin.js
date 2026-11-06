import { COOKIE, PAGES, allowedPath, checkPassword, session, validSession, parseDocument, updateDocument } from '../scripts/cloud-admin-core.js';
import { compile } from '@mdx-js/mdx';

const REPO = 'likalikali/astro-mecure';
const BRANCH = 'main';
const ORIGIN = 'https://blog.anriri.pp.ua';
const blobs = new Map(); // Content addressed cache only; every listing reads the current Git tree.
const attempts = new Map(); // Extra per-instance throttling, not a distributed security boundary.
async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...options, signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${process.env.BLOG_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!response.ok) {
    const error = new Error(response.status === 409 || response.status === 422 ? '内容已被其他窗口修改，请重新载入后再保存。' : response.status === 404 ? '文件不存在或仓库授权未配置。' : 'GitHub 暂时不可用或授权已过期，请稍后重试。');
    error.status = [409, 422].includes(response.status) ? 409 : response.status === 404 ? 404 : 502;
    throw error;
  }
  return response.json();
}
async function getFile(path) {
  const file = await github(`contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${BRANCH}`);
  if (file.type !== 'file' || file.encoding !== 'base64') throw new Error('不支持该文件类型');
  return { sha: file.sha, source: Buffer.from(file.content, 'base64').toString('utf8') };
}
function reply(res, status, body) { res.statusCode = status; res.end(JSON.stringify(body)); }
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const secret = process.env.BLOG_SESSION_SECRET;
    if (!secret || secret.length < 32 || !process.env.BLOG_ADMIN_PASSWORD_HASH || !process.env.BLOG_GITHUB_TOKEN) return reply(res, 503, { error: '在线后台尚未完成服务器授权配置。' });
    const url = new URL(req.url, ORIGIN), op = url.searchParams.get('op');
    if (!['GET', 'POST'].includes(req.method)) return reply(res, 405, { error: '不支持此操作' });
    if (req.method === 'POST' && (req.headers.origin !== ORIGIN || !String(req.headers['content-type']).startsWith('application/json'))) return reply(res, 403, { error: '请求来源不正确，请从本站管理页面操作。' });
    let input = {};
    if (req.method === 'POST') {
      input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!input || Buffer.byteLength(JSON.stringify(input)) > 600_000) return reply(res, 413, { error: '内容过大' });
    }
    if (op === 'login' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
      const now = Date.now();
      if (attempts.size > 2000) attempts.clear();
      const attempt = attempts.get(ip) || { count: 0, until: now + 600_000 };
      if (attempt.until < now) { attempt.count = 0; attempt.until = now + 600_000; }
      if (attempt.count >= 8) return reply(res, 429, { error: '尝试次数过多，请十分钟后再试。' });
      attempt.count++; attempts.set(ip, attempt);
      if (!checkPassword(input.password, process.env.BLOG_ADMIN_PASSWORD_HASH)) return reply(res, 401, { error: '密码不正确' });
      attempts.delete(ip);
      res.setHeader('Set-Cookie', `${COOKIE}=${session(secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
      return reply(res, 200, { ok: true });
    }
    const token = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!validSession(token, secret)) return reply(res, 401, { error: '请先登录，或登录已过期。' });
    if (op === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return reply(res, 200, { ok: true });
    }
    if (op === 'session' && req.method === 'GET') return reply(res, 200, { ok: true });
    if (op === 'status' && req.method === 'GET') {
      const sha = url.searchParams.get('sha');
      if (!/^[a-f0-9]{40}$/.test(sha || '')) return reply(res, 400, { error: '无效的发布记录' });
      const status = await github(`commits/${sha}/status`);
      const deployment = status.statuses.find(s => s.context === 'Vercel');
      return reply(res, 200, { state: deployment?.state || 'pending' });
    }
    if (op === 'list' && req.method === 'GET') {
      const tree = await github(`git/trees/${BRANCH}?recursive=1`);
      if (tree.truncated) throw new Error('目录过大，请联系维护者');
      const files = tree.tree.filter(e => e.type === 'blob' && allowedPath(e.path));
      const result = []; let next = 0;
      await Promise.all(Array.from({ length: 8 }, async () => {
        while (next < files.length) {
          const file = files[next++];
          let source = blobs.get(file.sha);
          if (!source) {
            const blob = await github(`git/blobs/${file.sha}`);
            source = Buffer.from(blob.content, 'base64').toString('utf8');
            if (blobs.size > 1000) blobs.clear();
            blobs.set(file.sha, source);
          }
          const doc = parseDocument(file.path, source, file.sha);
          result.push({ path: doc.path, title: doc.meta.title || file.path, draft: doc.meta.draft === true, kind: doc.kind });
        }
      }));
      return reply(res, 200, { entries: result });
    }
    const path = req.method === 'GET' ? url.searchParams.get('path') : input.path;
    if (!allowedPath(path)) return reply(res, 400, { error: '不允许访问这个文件' });
    if (op === 'read' && req.method === 'GET') {
      const file = await getFile(path);
      return reply(res, 200, parseDocument(path, file.source, file.sha));
    }
    if (op === 'save' && req.method === 'POST') {
      let previous;
      try { previous = await getFile(path); } catch (error) { if (error.status !== 404 || input.sha) throw error; }
      if (PAGES.includes(path) && !previous) return reply(res, 400, { error: '不能新建此页面' });
      if ((previous?.sha || '') !== (input.sha || '')) return reply(res, 409, { error: '文章已有更新，请复制未保存正文并重新载入。' });
      const source = updateDocument(path, input, previous?.source);
      if (path.endsWith('.mdx')) {
        try { await compile(source.replace(/^---[\s\S]*?---\s*/, '')); }
        catch { return reply(res, 400, { error: '页面格式有误，请检查未闭合的括号、标签或代码块。尚未保存。' }); }
      }
      const result = await github(`contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT', body: JSON.stringify({ message: `content: update ${path.split('/').pop()} via web admin`, content: Buffer.from(source).toString('base64'), branch: BRANCH, ...(previous ? { sha: previous.sha } : {}) })
      });
      return reply(res, 200, { ...parseDocument(path, source, result.content.sha), commit: result.commit.sha });
    }
    if (op === 'delete' && req.method === 'POST') {
      if (PAGES.includes(path)) return reply(res, 400, { error: '固定页面可编辑，不可删除。' });
      if (!/^[a-f0-9]{40}$/.test(input.sha || '')) return reply(res, 400, { error: '请重新载入文章' });
      const result = await github(`contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE', body: JSON.stringify({ message: `content: delete ${path.split('/').pop()} via web admin`, sha: input.sha, branch: BRANCH })
      });
      return reply(res, 200, { ok: true, commit: result.commit.sha });
    }
    return reply(res, 404, { error: '操作不存在' });
  } catch (error) {
    console.error('Cloud admin request failed:', error.status || 400, error.name);
    return reply(res, error.status || 400, { error: error.status ? error.message : '操作未完成，请检查内容格式或稍后重试。未确认保存前请保留正文。' });
  }
}
