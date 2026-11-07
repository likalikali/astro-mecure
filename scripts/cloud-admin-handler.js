import { COOKIE, PAGES, allowedPath, checkPassword, session, validSession, parseDocument, updateDocument } from './cloud-admin-core.js';
import { databaseConfigured, listDocuments, readDocument, saveDocument, saveDraftDocument, patchDocument, deleteDocument } from './content-database.js';
const ORIGIN = 'https://blog.anriri.pp.ua';
const attempts = new Map();
function reply(res, status, body) { res.statusCode = status; res.end(JSON.stringify(body)); }
export function editorDocument(doc) {
  const parsed=parseDocument(doc.path,doc.working_source || doc.source,doc.version);
  const liveMeta=doc.meta || parseDocument(doc.path,doc.source).meta;
  const published=liveMeta.draft!==true;
  return {...parsed,published,hasDraft:!!doc.working_source,savedAt:doc.saved_at,
    publicUrl:published ? (parsed.kind==='page' ? '/'+doc.path.replace(/^src\/pages\//,'').replace(/\.mdx$/,'')+'/' : '/posts/'+(doc.slug || doc.path.replace(/^src\/content\/blog\//,'').replace(/\.mdx?$/,''))+'/') : null};
}
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
      return reply(res, 200, { entries: docs.map(doc => {const e=editorDocument(doc);return {path:e.path,title:e.meta.title,kind:e.kind,draft:!e.published,published:e.published,hasDraft:e.hasDraft,savedAt:e.savedAt};}) });
    }
    const path = req.method === 'GET' ? url.searchParams.get('path') : input.path;
    if (!allowedPath(path)) return reply(res, 400, { error: '不允许访问这个文件' });
    if (op === 'read' && req.method === 'GET') {
      const doc = await readDocument(path);
      return reply(res,200,editorDocument(doc));
    }
    if (op === 'save' && req.method === 'POST') {
      let previous;
      try { previous=await readDocument(path); } catch(error) { if(error.status!==404 || input.sha) throw error; }
      if(PAGES.includes(path) && !previous) return reply(res,400,{error:'不能新建此页面'});
      if((previous?.version || '') !== (input.sha || '')) return reply(res,409,{error:'内容已更新，请先复制未保存正文，再重新载入。'});
      const intent=input.intent || (input.meta?.draft ? 'draft' : 'publish');
      if(!['draft','publish'].includes(intent))return reply(res,400,{error:'请选择暂存或发布操作'});
      if(intent==='publish' && (!input.meta?.title?.trim() || !input.body?.trim()))return reply(res,400,{error:'发布前请填写标题和正文。内容还没写完可以先暂存。'});
      const meta={...input.meta,title:input.meta?.title?.trim() || '未命名文章',draft:intent==='draft'};
      let source;
      try {source=updateDocument(path,{...input,meta},previous?.working_source || previous?.source,{publishing:intent==='publish'});}
      catch(error){return reply(res,400,{error:error.message});}
      const saved=intent==='draft' ? await saveDraftDocument(path,source,previous) : await saveDocument(path,source,previous?.version);
      return reply(res,200,{...editorDocument(saved),action:intent});
    }
    if(['withdraw','discard-draft'].includes(op) && req.method==='POST') {
      const previous=await readDocument(path);
      if(previous.version!==input.sha)return reply(res,409,{error:'内容已更新，请重新载入后再操作。'});
      if(op==='discard-draft') {
        if(!previous.working_source)return reply(res,400,{error:'没有可放弃的暂存修改'});
        return reply(res,200,{...editorDocument(await patchDocument(path,input.sha,{working_source:null})),action:op});
      }
      if(PAGES.includes(path))return reply(res,400,{error:'独立页面不能撤回，可暂存修改或发布更新。'});
      const doc=editorDocument(previous);
      if(!doc.published)return reply(res,400,{error:'文章尚未发布，无需撤回。'});
      const source=updateDocument(path,{...doc,meta:{...doc.meta,draft:true}},previous.working_source || previous.source,{publishing:false});
      const parsed=parseDocument(path,source);
      const saved=await patchDocument(path,input.sha,{source,meta:parsed.meta,html:'',headings:[],excerpt:'',word_count:0,working_source:null});
      return reply(res,200,{...editorDocument(saved),action:op});
    }
    if (op === 'delete' && req.method === 'POST') {
      if(PAGES.includes(path)) return reply(res,400,{error:'固定页面可编辑，不可删除。'});
      await deleteDocument(path,input.sha);
      return reply(res,200,{ok:true,action:'delete'});
    }
    return reply(res, 404, { error: '操作不存在' });
  } catch (error) {
    console.error('Cloud admin request failed:', error.status || 400, error.name);
    return reply(res, error.status || 400, { error: error.status ? error.message : '操作未完成，请检查内容格式或稍后重试。未确认保存前请保留正文。' });
  }
}
