async page => {
 const assert=(condition,message)=>{if(!condition)throw new Error(message);};
 let docs=new Map(),version=0,fail=0,delay=false,release,requests=0;
 const seed={path:'src/content/blog/browser-existing.md',sha:'seed',kind:'post',published:true,hasDraft:false,publicUrl:'/posts/browser-existing/',meta:{title:'已有文章',tags:[],category:[]},body:'线上旧版'};
 docs.set(seed.path,seed);
 await page.route('**/api/admin?*',async route=>{
  const op=new URL(route.request().url()).searchParams.get('op'),input=route.request().postDataJSON();
  if(op==='save'){
   requests++;
   if(delay){delay=false;await new Promise(resolve=>release=resolve);}
   if(fail){const status=fail;fail=0;if(status===999){await route.abort();return;}await route.fulfill({status,json:{error:status===401?'请先登录':status===409?'内容已更新':'保存失败'}});return;}
   const old=docs.get(input.path),published=input.intent==='publish'||!!old?.published;
   const doc={...input,kind:'post',sha:String(++version),published,hasDraft:input.intent==='draft'&&published,publicUrl:'/posts/browser-test/',meta:{...input.meta,title:input.meta.title||'未命名文章',draft:!published}};
   docs.set(doc.path,doc);await route.fulfill({json:doc});return;
  }
  if(op==='list'){await route.fulfill({json:{entries:[...docs.values()].map(d=>({...d,title:d.meta.title}))}});return;}
  if(op==='read'){await route.fulfill({json:docs.get(new URL(route.request().url()).searchParams.get('path'))});return;}
  if(op==='delete'){docs.delete(input.path);await route.fulfill({json:{ok:true,action:'delete'}});return;}
  await route.fulfill({json:{ok:true}});
 });
 await page.reload();await page.locator('#new').waitFor();
 await page.locator('#new').click();assert(await page.locator('#publish').isDisabled(),'new empty must not publish');
 assert(await page.locator('#draft').count()===0,'draft checkbox must be removed');
 await page.locator('#title').fill('生命周期测试');await page.locator('#body').fill('第一版');
 await page.locator('#saveDraft').click();await page.getByText('草稿已暂存，仅你在后台可见。',{exact:true}).waitFor();
 assert(await page.locator('#publication').innerText()==='未发布草稿','saved draft badge');
 await page.locator('#publish').click();await page.getByText('发布成功，线上已更新。',{exact:true}).waitFor();
 assert(await page.locator('#publish').isDisabled(),'clean publication cannot publish twice');
 await page.locator('#body').fill('第二版');assert(await page.locator('#feedback').isHidden(),'editing clears stale success');
 assert(await page.locator('#dirty').innerText()==='有未保存的修改','dirty status');
 await page.locator('#body').fill('第一版');assert(await page.locator('#publish').isDisabled(),'reverting text clears dirty');
 await page.locator('#body').fill('第二版');await page.locator('#saveDraft').click();await page.getByText('修改已暂存。线上仍展示上次发布的版本。',{exact:true}).waitFor();
 assert(await page.locator('#publication').innerText()==='已发布 · 待更新','pending state');
 await page.getByRole('button',{name:'已有文章 已发布',exact:true}).click();assert(await page.locator('#feedback').isHidden(),'switch clears feedback');
 await page.getByRole('button',{name:'生命周期测试 已发布 · 待更新',exact:true}).click();assert(await page.locator('#body').inputValue()==='第二版','reopen working draft');
 await page.locator('#body').fill('第三版');fail=409;await page.locator('#publish').click();await page.locator('#feedback[data-tone="error"]').waitFor();
 assert(await page.locator('#body').inputValue()==='第三版','conflict retains input');assert(await page.locator('#dirty').innerText()==='有未保存的修改','conflict remains dirty');
 fail=999;await page.locator('#saveDraft').click();await page.getByText(/网络连接失败/).waitFor();assert(await page.locator('#body').inputValue()==='第三版','network retains input');
 fail=401;await page.locator('#saveDraft').click();await page.locator('#loginPanel').waitFor();await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'进入书桌'}).click();
 await page.getByText('已重新登录，修改已保留。请继续暂存或发布。',{exact:true}).waitFor();assert(await page.locator('#body').inputValue()==='第三版','reauth retains body');
 delay=true;const before=requests;await page.locator('#publish').click();await page.waitForFunction(()=>document.querySelector('#publish').disabled);
 assert(await page.locator('#new').isDisabled(),'switch locked while saving');assert(await page.locator('#body').isDisabled(),'editor locked while saving');
 while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();await page.getByText('发布成功，线上已更新。',{exact:true}).waitFor();assert(requests===before+1,'single submission');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#delete').click();await page.getByText('文章已删除，已从公网移除。',{exact:true}).waitFor();
 assert(await page.locator('#editForm').isHidden(),'delete closes editor');assert(await page.getByText('发布成功，线上已更新。',{exact:true}).count()===0,'delete never shows publish success');
 console.log('PASS: browser lifecycle, stale feedback, revert, pending draft, failures, reauth, save locking, delete, mobile.');
}
