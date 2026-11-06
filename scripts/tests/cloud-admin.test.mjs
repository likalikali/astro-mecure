import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import matter from 'gray-matter';
import { allowedPath, session, validSession, checkPassword, updateDocument, parseDocument } from '../cloud-admin-core.js';
import handler from '../../api/admin.js';

test('restrict edits to articles and selected text pages', () => {
  for (const path of ['src/content/blog/test.md','src/content/blog/中文/index.mdx','src/pages/about.mdx']) assert.ok(allowedPath(path));
  for (const path of ['.env','src/pages/index.astro','src/content/blog/../config.ts','src/content/blog/%2e%2e/x.md','src/content/blog/x\\y.md']) assert.equal(allowedPath(path),false);
});
test('signed sessions reject tampering, expiry and another signing key', () => {
  const key='a'.repeat(40), expiry=Date.now()+60_000, token=session(key,expiry);
  assert.ok(validSession(token,key));
  assert.equal(validSession(token+'0',key),false);
  assert.equal(validSession(token,'b'.repeat(40)),false);
  assert.equal(validSession(token,key,expiry+1),false);
  assert.equal(validSession('nonsense',key),false);
});
test('password verification uses salted hashes', () => {
  const hash='salt:'+scryptSync('correct-password','salt',64).toString('hex');
  assert.ok(checkPassword('correct-password',hash));
  assert.equal(checkPassword('wrong',hash),false);
});
test('saving preserves unrelated metadata and allows all three dates to be set', () => {
  const previous='---\ntitle: Old\nimage: /cover.png\npermalink: stable\ncreatedDate: 2020-01-01\ndate: 2021-01-01\n---\nOld';
  const source=updateDocument('src/content/blog/test.md',{body:'New',meta:{title:'New',draft:false,tags:['a','a'],category:['生活'],createdDate:'2020-02-03T12:00:00+08:00',date:'2021-02-03T12:00:00+08:00',updateDate:'2022-02-03T12:00:00+08:00'}},previous);
  const {data}=matter(source);
  assert.equal(data.image,'/cover.png');assert.equal(data.permalink,'stable');assert.deepEqual(data.tags,['a']);
  assert.equal(data.createdDate.toISOString(),'2020-02-03T04:00:00.000Z');
  assert.equal(data.date.toISOString(),'2021-02-03T04:00:00.000Z');
  assert.equal(data.updateDate.toISOString(),'2022-02-03T04:00:00.000Z');
});
test('draft saves omit first publication, and about page retains its component and layout', () => {
  const source=updateDocument('src/content/blog/new.md',{body:'Draft',meta:{title:'Draft',draft:true,tags:[],category:[]}});
  assert.equal(matter(source).data.date,undefined);
  const old="---\nlayout: '@/layouts/MarkdownLayout.astro'\ntitle: 关于\ncomment: true\nsidebar: true\n---\nimport MemoirEntrances from '@/components/MemoirEntrances.astro';\n\nHello\n<MemoirEntrances />";
  const doc=parseDocument('src/pages/about.mdx',old,'sha');
  assert.ok(!doc.body.includes('import MemoirEntrances'));
  const saved=updateDocument(doc.path,{body:doc.body.replace('Hello','你好'),meta:doc.meta},old);
  assert.ok(saved.includes('<MemoirEntrances />'));assert.ok(saved.includes('你好'));
  assert.equal(matter(saved).data.sidebar,true);
  assert.throws(()=>updateDocument(doc.path,{body:'missing marker',meta:doc.meta},old));
});
async function request(method,op,body,headers={}) {
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=JSON.parse(text);}};
  await handler({method,url:'/api/admin?op='+op,body,headers},res);return res;
}
test('API fails closed, rejects cross-origin writes and unauthenticated reads',async()=>{
  process.env.BLOG_SESSION_SECRET='s'.repeat(40);process.env.BLOG_ADMIN_PASSWORD_HASH='salt:hash';process.env.BLOG_GITHUB_TOKEN='test-only';
  assert.equal((await request('GET','list')).statusCode,401);
  assert.equal((await request('POST','save',{}, {origin:'https://attacker.example','content-type':'application/json'})).statusCode,403);
  delete process.env.BLOG_GITHUB_TOKEN;
  assert.equal((await request('GET','list')).statusCode,503);
});
test('authenticated save uses file revision, preserves dates, and rejects stale edits',async()=>{
  const secret='s'.repeat(40);process.env.BLOG_SESSION_SECRET=secret;process.env.BLOG_ADMIN_PASSWORD_HASH='salt:hash';process.env.BLOG_GITHUB_TOKEN='test-only';
  const headers={origin:'https://blog.anriri.pp.ua','content-type':'application/json',cookie:'__Host-blog-admin='+session(secret)};
  const originalFetch=globalThis.fetch; let writes=0;
  const source='---\ntitle: Old\ncreatedDate: 2020-01-01\ndate: 2021-01-01\n---\nOld';
  globalThis.fetch=async(url,options)=>{
    if(options.method==='PUT'){
      writes++;const sent=JSON.parse(options.body);assert.equal(sent.sha,'a'.repeat(40));assert.equal(sent.branch,'main');
      const saved=matter(Buffer.from(sent.content,'base64').toString('utf8'));
      assert.equal(saved.data.date.toISOString(),'2021-01-01T00:00:00.000Z');assert.equal(saved.content.trim(),'Edited');
      return {ok:true,json:async()=>({content:{sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}})};
    }
    return {ok:true,json:async()=>({type:'file',encoding:'base64',sha:'a'.repeat(40),content:Buffer.from(source).toString('base64')})};
  };
  try {
    const body={path:'src/content/blog/test.md',sha:'a'.repeat(40),body:'Edited',meta:{title:'New',draft:false,tags:[],category:[]}};
    const result=await request('POST','save',body,headers);assert.equal(result.statusCode,200);assert.equal(result.body.commit,'c'.repeat(40));
    const stale=await request('POST','save',{...body,sha:'old'},headers);assert.equal(stale.statusCode,409);assert.equal(writes,1);
    const deletion=await request('POST','delete',{path:'src/pages/about.mdx',sha:'a'.repeat(40)},headers);assert.equal(deletion.statusCode,400);
  } finally {globalThis.fetch=originalFetch;delete process.env.BLOG_GITHUB_TOKEN;}
});
