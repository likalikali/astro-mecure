import { COOKIE, PAGES, allowedPath, checkPassword, session, validSession, parseDocument, updateDocument } from './cloud-admin-core.js';
import { databaseConfigured, listDocuments, readDocument, saveDocument, deleteDocument } from './content-database.js';
const ORIGIN = 'https://blog.anriri.pp.ua';
const attempts = new Map();
function reply(res, status, body) { res.statusCode = status; res.end(JSON.stringify(body)); }
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const secret = process.env.BLOG_SESSION_SECRET;
    if (!secret || secret.length < 32 || !process.env.BLOG_ADMIN_PASSWORD_HASH || !databaseConfigured()) return reply(res, 503, { error: '在线后台尚未完成服务器授权配置。' });
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
    if (op === 'list' && req.method === 'GET') {
      const docs = await listDocuments();
      return reply(res, 200, { entries: docs.map(doc => ({ path:doc.path, title:doc.meta.title, draft:doc.meta.draft===true, kind:doc.kind })) });
    }
    const path = req.method === 'GET' ? url.searchParams.get('path') : input.path;
    if (!allowedPath(path)) return reply(res, 400, { error: '不允许访问这个文件' });
    if (op === 'read' && req.method === 'GET') {
      const doc = await readDocument(path);
      return reply(res,200,parseDocument(path,doc.source,doc.version));
    }
    if (op === 'save' && req.method === 'POST') {
      let previous;
      try { previous=await readDocument(path); } catch(error) { if(error.status!==404 || input.sha) throw error; }
      if(PAGES.includes(path) && !previous) return reply(res,400,{error:'不能新建此页面'});
      if((previous?.version || '') !== (input.sha || '')) return reply(res,409,{error:'内容已更新，请先复制未保存正文，再重新载入。'});
      const source=updateDocument(path,input,previous?.source);
      const saved=await saveDocument(path,source,previous?.version);
      return reply(res,200,{...parseDocument(path,saved.source,saved.version),published:!saved.meta.draft});
    }
    if (op === 'delete' && req.method === 'POST') {
      if(PAGES.includes(path)) return reply(res,400,{error:'固定页面可编辑，不可删除。'});
      await deleteDocument(path,input.sha);
      return reply(res,200,{ok:true,published:true});
    }
    return reply(res, 404, { error: '操作不存在' });
  } catch (error) {
    console.error('Cloud admin request failed:', error.status || 400, error.name);
    return reply(res, error.status || 400, { error: error.status ? error.message : '操作未完成，请检查内容格式或稍后重试。未确认保存前请保留正文。' });
  }
}
