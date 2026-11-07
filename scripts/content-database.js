import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { compileDocument } from './content-renderer.js';
export const contentScope = new AsyncLocalStorage();
export function databaseConfigured() { return !!process.env.BLOG_DATABASE_URL && !!process.env.BLOG_DATABASE_SECRET; }
export async function databaseRequest(query, options = {}) {
  if (!databaseConfigured()) throw new Error('内容数据库尚未配置');
  const key = process.env.BLOG_DATABASE_SECRET;
  const response = await fetch(`${process.env.BLOG_DATABASE_URL}/rest/v1/blog_documents${query}`, {
    ...options, cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers }
  });
  if (!response.ok) {
    const error = new Error(response.status === 409 ? '内容已存在或地址重复，请重新载入。' : '内容数据库暂时无法访问，请稍后重试。');
    error.status = response.status === 409 ? 409 : 503;
    throw error;
  }
  return response.status === 204 ? [] : response.json();
}
export async function listDocuments() {
  const scope = contentScope.getStore();
  if (scope?.documents) return scope.documents;
  const load = async () => {
    const records = [];
    for(let offset=0;;offset+=500) {
      const page = await databaseRequest(`?deleted=eq.false&order=path&limit=500&offset=${offset}`);
      records.push(...page); if(page.length<500) break;
    }
    return records;
  };
  const promise = load(); if(scope) scope.documents = promise;
  return promise;
}
export async function readDocument(path) {
  const [doc] = await databaseRequest('?'+new URLSearchParams({path:'eq.'+path,deleted:'eq.false'}));
  if(!doc) { const e=new Error('内容不存在');e.status=404;throw e; }
  return doc;
}
export async function saveDocument(path, source, expectedVersion) {
  const compiled = await compileDocument(path,source);
  const record = {...compiled,version:randomUUID(),saved_at:new Date().toISOString(),deleted:false};
  const result = await databaseRequest(expectedVersion ? '?'+new URLSearchParams({path:'eq.'+path,version:'eq.'+expectedVersion,deleted:'eq.false'}) : '', {
    method: expectedVersion ? 'PATCH' : 'POST', body: JSON.stringify(record)
  });
  if(result.length!==1){const e=new Error('内容已被其他窗口修改，请先复制正文，再重新载入。');e.status=409;throw e;}
  return result[0];
}
export async function deleteDocument(path, expectedVersion) {
  if(!expectedVersion){const e=new Error('缺少内容版本，请重新载入');e.status=400;throw e;}
  const result = await databaseRequest('?'+new URLSearchParams({path:'eq.'+path,version:'eq.'+expectedVersion,deleted:'eq.false'}),{method:'PATCH',body:JSON.stringify({deleted:true,version:randomUUID(),saved_at:new Date().toISOString()})});
  if(result.length!==1){const e=new Error('内容已更新，请重新载入后再删除');e.status=409;throw e;}
}
