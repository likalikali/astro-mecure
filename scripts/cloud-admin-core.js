import { createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import matter from 'gray-matter';
import { resolvePostDates } from './post-dates.js';

export const PAGES = ['about', 'reference', 'changelog', 'memoirs/hometown', 'memoirs/northeast-asia', 'memoirs/jiangnan'].map(p => `src/pages/${p}.mdx`);
export const COOKIE = '__Host-blog-admin';
export function allowedPath(path) {
  return typeof path === 'string' && (PAGES.includes(path) || /^src\/content\/blog\/(?!.*(?:\.\.|\\|%))[\p{L}\p{N}_ -]+(?:\/index)?\.mdx?$/u.test(path));
}
export function equal(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
export function checkPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [salt, hash] = (stored || '').split(':');
  return !!salt && !!hash && equal(scryptSync(password, salt, 64).toString('hex'), hash);
}
export function session(secret, expiry = Date.now() + 8 * 3600_000) {
  const payload = String(expiry);
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('hex');
}
export function validSession(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return false;
  const [expiry] = token.split('.');
  return Number(expiry) > now && Number(expiry) <= now + 8 * 3600_000 && equal(token, session(secret, Number(expiry)));
}
export function parseDocument(path, source, sha) {
  const { data, content } = matter(source);
  let body = content;
  if (path === 'src/pages/about.mdx') {
    body = body.replace(/^import MemoirEntrances from ['"]@\/components\/MemoirEntrances\.astro['"];?\s*/m, '').replace('<MemoirEntrances />', '<!-- 三色团子入口 -->');
  }
  return { path, sha, meta: data, body: body.trim(), kind: PAGES.includes(path) ? 'page' : 'post' };
}
export function updateDocument(path, input, previous) {
  if (!allowedPath(path)) throw new Error('不允许修改这个文件');
  if (typeof input.body !== 'string' || Buffer.byteLength(input.body) > 500_000) throw new Error('正文过长或格式不正确');
  if (!input.meta || typeof input.meta.title !== 'string' || !input.meta.title.trim() || input.meta.title.length > 250) throw new Error('请填写有效标题');
  const old = previous ? matter(previous).data : {};
  const meta = { ...old, title: input.meta.title.trim() };
  let body = input.body;
  if (PAGES.includes(path)) {
    meta.layout = '@/layouts/MarkdownLayout.astro';
    meta.description = String(input.meta.description ?? old.description ?? '').slice(0, 1000);
    for (const key of ['comment', 'sidebar']) if (typeof input.meta[key] === 'boolean') meta[key] = input.meta[key];
    if (path === 'src/pages/about.mdx') {
      if (!body.includes('<!-- 三色团子入口 -->')) throw new Error('请保留“三色团子入口”标记，可以把它移到其他位置');
      body = "import MemoirEntrances from '@/components/MemoirEntrances.astro';\n\n" + body.replace('<!-- 三色团子入口 -->', '<MemoirEntrances />');
    }
  } else {
    meta.draft = input.meta.draft === true;
    meta.author = old.author || 'default';
    meta.cardVariant = old.cardVariant || 'plain';
    for (const key of ['tags', 'category']) {
      if (!Array.isArray(input.meta[key]) || input.meta[key].some(x => typeof x !== 'string' || x.length > 80) || input.meta[key].length > 30) throw new Error('分类或标签格式不正确');
      meta[key] = [...new Set(input.meta[key].map(x => x.trim()).filter(Boolean))];
    }
    const dates = resolvePostDates({ ...input.meta, draft: meta.draft }, old);
    for (const [key, val] of Object.entries(dates)) {
      if (val) meta[key] = new Date(val);
      else delete meta[key];
    }
  }
  return matter.stringify('\n' + body.trim() + '\n', meta);
}
