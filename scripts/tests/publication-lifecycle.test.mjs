import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../cloud-admin-handler.js';
import {session} from '../cloud-admin-core.js';

test('published version stays live through private drafts, discard, withdrawal and republishing',async()=>{
 const originalFetch=globalThis.fetch,records=new Map();
 process.env.BLOG_SESSION_SECRET='s'.repeat(40);process.env.BLOG_ADMIN_PASSWORD_HASH='salt:hash';process.env.BLOG_DATABASE_URL='https://test.invalid';process.env.BLOG_DATABASE_SECRET='test';
 globalThis.fetch=async(url,options)=>{
  const q=new URL(url).searchParams,path=q.get('path')?.slice(3),version=q.get('version')?.slice(3);
  if(options.method==='POST'){const record=JSON.parse(options.body);records.set(record.path,record);return {ok:true,json:async()=>[record]};}
  if(options.method==='PATCH'){const old=records.get(path);if(!old||old.deleted||old.version!==version)return {ok:true,json:async()=>[]};const record={...old,...JSON.parse(options.body)};records.set(path,record);return {ok:true,json:async()=>[record]};}
  return {ok:true,json:async()=>[...records.values()].filter(r=>(!path||r.path===path)&&!r.deleted)};
 };
 const request=async(op,input,query={})=>{
  const response={setHeader(){},end(text){this.body=JSON.parse(text);}};
  await handler({method:input?'POST':'GET',url:'/api/admin?'+new URLSearchParams({op,...query}),body:input,headers:{origin:'https://blog.anriri.pp.ua','content-type':'application/json',cookie:'__Host-blog-admin='+session(process.env.BLOG_SESSION_SECRET)}},response);
  return response;
 };
 const save=async(input)=>{const r=await request('save',input);assert.equal(r.statusCode,200,JSON.stringify(r.body));return r.body;};
 try{
  const path='src/content/blog/lifecycle.md';
  let doc=await save({path,sha:'',intent:'draft',body:'First',meta:{title:'Test',tags:[],category:[]}});
  assert.equal(doc.published,false);assert.equal(doc.meta.date,undefined);
  doc=await save({...doc,intent:'publish'});assert.equal(doc.published,true);const firstDate=doc.meta.date;
  const live=records.get(path);const source=live.source,html=live.html,date=live.meta.updateDate;
  const publishedVersion=doc.sha;
  doc=await save({...doc,intent:'draft',body:'Private changes',meta:{...doc.meta,updateDate:''}});
  assert.equal(doc.published,true);assert.equal(doc.hasDraft,true);assert.equal(doc.body,'Private changes');
  assert.equal(records.get(path).source,source);assert.equal(records.get(path).html,html);assert.equal(records.get(path).meta.updateDate,date);
  assert.equal((await request('read',null,{path})).body.body,'Private changes');
  assert.equal((await request('list')).body.entries[0].hasDraft,true);
  assert.equal((await request('save',{...doc,sha:publishedVersion,intent:'publish'})).statusCode,409);
  doc=await save({...doc,intent:'publish'});assert.equal(doc.hasDraft,false);assert.ok(records.get(path).html.includes('Private changes'));assert.equal(doc.meta.date,firstDate);
  doc=await save({...doc,intent:'draft',body:'Discard this'});
  doc=(await request('discard-draft',{path,sha:doc.sha})).body;assert.equal(doc.body,'Private changes');assert.equal(doc.hasDraft,false);
  doc=await save({...doc,intent:'draft',body:'Keep after withdrawal'});
  doc=(await request('withdraw',{path,sha:doc.sha})).body;assert.equal(doc.published,false);assert.equal(doc.body,'Keep after withdrawal');assert.equal(records.get(path).meta.draft,true);
  doc=await save({...doc,intent:'publish'});assert.equal(doc.meta.date,firstDate);assert.equal(doc.published,true);
  assert.equal((await request('save',{...doc,intent:'publish',body:''})).statusCode,400);
  await request('delete',{path,sha:doc.sha});assert.equal((await request('read',null,{path})).statusCode,404);
  const pagePath='src/pages/about.mdx';
  records.set(pagePath,{path:pagePath,version:'page-v1',kind:'page',source:'---\ntitle: About\ncomment: true\nsidebar: true\n---\n<!-- 三色团子入口 -->\nOnline',meta:{title:'About',comment:true,sidebar:true},html:'Online'});
  let about=(await request('read',null,{path:pagePath})).body;
  about=await save({...about,intent:'draft',body:'Unfinished',meta:{...about.meta,comment:false,sidebar:false}});
  assert.equal(about.hasDraft,true);assert.equal(records.get(pagePath).html,'Online');assert.equal(records.get(pagePath).meta.comment,true);
  assert.equal((await request('save',{...about,intent:'publish'})).statusCode,400);
  assert.equal((await request('withdraw',{path:pagePath,sha:about.sha})).statusCode,400);
  about=await save({...about,intent:'publish',body:'<!-- 三色团子入口 -->\nUpdated About'});
  assert.equal(about.hasDraft,false);assert.equal(records.get(pagePath).meta.comment,false);assert.equal(records.get(pagePath).meta.sidebar,false);
 }finally{globalThis.fetch=originalFetch;delete process.env.BLOG_DATABASE_SECRET;}
});
