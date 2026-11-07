import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://127.0.0.1:5190';
const origin='https://blog.anriri.pp.ua';
const password=fs.readFileSync('admin-credentials.local.txt','utf8').match(/管理员密码：([^\r\n]+)/)[1];
let cookie='',current;
const slug='instant-verification-'+Date.now(), marker='Verification '+slug;
async function api(op,input,query={}){
 const response=await fetch(base+'/api/admin?'+new URLSearchParams({op,...query}),{
  method:input?'POST':'GET',cache:'no-store',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(input?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(60000)
 });
 if(op==='login'&&response.ok)cookie=response.headers.get('set-cookie').split(';')[0];
 const result=await response.json();
 if(!response.ok){const error=new Error(op+': '+response.status+' '+result.error);error.status=response.status;throw error;}
 return result;
}
async function page(path){const r=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(60000)});const text=await r.text();assert.ok(!text.includes('Internal server error'),'Incomplete streamed response: '+path);return {status:r.status,text,cache:r.headers.get('cache-control')};}
try{
 assert.equal((await page('/api/admin?op=list')).status,401);
 await api('login',{password});
 const about=await api('read',undefined,{path:'src/pages/about.mdx'});assert.ok(about.body.includes('<!-- 三色团子入口 -->'));
 assert.equal(about.meta.comment,true);assert.equal(about.meta.sidebar,true);
 if(base.includes('127.0.0.1')) {
  const edited=await api('save',{...about,body:about.body+'\n\n'+marker});
  try { assert.ok((await page('/about/')).text.includes(marker)); }
  finally {await api('save',{...about,sha:edited.sha});}
  assert.ok(!(await page('/about/')).text.includes(marker));
 }
 const date=new Date().toISOString();
 current=await api('save',{path:`src/content/blog/${slug}.md`,sha:'',meta:{title:marker,draft:true,tags:['instant-verification'],category:['instant-verification'],createdDate:'2020-01-02T03:04:05+08:00',date,updateDate:'2021-02-03T04:05:06+08:00'},body:'## Immediate publication\n\n'+marker});
 assert.equal((await page('/posts/'+slug+'/')).status,404);
 assert.ok(!(await page('/search-index.json')).text.includes(marker));
 const started=Date.now(),oldVersion=current.sha;
 current=await api('save',{...current,meta:{...current.meta,draft:false}});
 assert.equal(current.meta.createdDate,'2020-01-01T19:04:05.000Z');assert.equal(current.meta.date,date);assert.equal(current.meta.updateDate,'2021-02-02T20:05:06.000Z');
 const article=await page('/posts/'+slug+'/');assert.equal(article.status,200);assert.ok(article.text.includes(marker));assert.ok(article.cache.includes('no-store'));
 console.log('Saved and publicly readable without build in',Date.now()-started,'ms');
 for(const route of ['/','/archive/','/search-index.json','/rss/feed.json','/sitemap.xml','/categories/instant-verification/','/tags/instant-verification/'])assert.ok((await page(route)).text.includes(marker)|| (route==='/sitemap.xml'&&(await page(route)).text.includes(slug)),route);
 await assert.rejects(api('save',{...current,sha:oldVersion}),e=>e.status===409);
 current=await api('save',{...current,body:marker+' UPDATED'});
 assert.ok((await page('/posts/'+slug+'/')).text.includes(marker+' UPDATED'));
 await api('delete',{path:current.path,sha:current.sha});current=null;
 assert.equal((await page('/posts/'+slug+'/')).status,404);
 assert.equal((await page('/categories/instant-verification/')).status,404);
 assert.ok(!(await page('/search-index.json')).text.includes(marker));
 assert.ok(!(await page('/rss/feed.json')).text.includes(marker));
 await api('logout',{});cookie='';assert.equal((await page('/api/admin?op=list')).status,401);
 console.log('PASS: draft privacy, all 3 dates, publish/update/delete, lists/search/RSS/sitemap, conflicts, logout.');
}finally{
 if(current)await api('delete',{path:current.path,sha:current.sha}).catch(()=>console.error('Verification record needs cleanup:',current.path));
}
