import { editorState } from './editor-state.js';
const $=id=>document.getElementById(id);
let entries=[],current=null,baseline='',unsaved=false,busy='',expired=false;
const notice=text=>{$('notice').textContent=text;};
function feedback(text='',tone='info'){$('feedback').textContent=text;$('feedback').dataset.tone=tone;$('feedback').hidden=!text;}
async function api(op,data,query={}){
 let res;
 try{res=await fetch('/api/admin?'+new URLSearchParams({op,...query}),data===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
 catch{throw new Error('网络连接失败，尚未确认操作结果。修改仍在编辑器中；请保留正文，联网后重新载入核对。');}
 const result=await res.json().catch(()=>{throw new Error('服务器没有返回完整结果，请保留正文后重新载入核对。');});
 if(!res.ok){const e=new Error(result.error||'操作未完成');e.status=res.status;throw e;}return result;
}
function handleError(e){
 if(e.status===401){expired=true;$('loginPanel').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;$('loginHint').textContent='登录已过期。当前编辑内容已保留，请登录后继续操作。';notice('请重新登录，当前修改不会被清空。');$('password').focus();}
 else if(current)feedback(e.message+(e.status===409?' 可先复制正文，再重新载入最新版本。':''),'error');else notice(e.message);
}
function localDate(value){if(!value)return '';const date=new Date(value);return Number.isFinite(date.getTime())?new Date(date.getTime()+8*3600_000).toISOString().slice(0,19):'';}
function formState(){return Object.fromEntries(['title','body','createdDate','date','updateDate','tags','category','description','autoModified','comment','sidebar'].map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));}
function renderState(){
 for(const id of ['new','refresh','logout'])$(id).disabled=!!busy;
 for(const el of $('entries').querySelectorAll('button'))el.disabled=!!busy;
 if(!current)return;
 const s=editorState(current,unsaved,busy);$('publication').textContent=s.publication;$('dirty').textContent=s.work;$('stateHint').textContent=s.hint;
 $('editForm').setAttribute('aria-busy',String(!!busy));
 for(const field of $('editForm').querySelectorAll('input,textarea,button'))field.disabled=!!busy;
 $('updateDate').disabled=!!busy||$('autoModified').checked;
 $('saveDraft').textContent=busy==='正在暂存…'?'正在暂存…':s.draftLabel;$('saveDraft').disabled=!s.canDraft;
 $('publish').textContent=busy==='正在发布…'?'正在发布…':s.publishLabel;$('publish').disabled=!s.canPublish;
 $('withdraw').hidden=!current.published||current.kind!=='post';$('withdraw').disabled=!s.canWithdraw;
 $('discardDraft').hidden=!current.hasDraft;$('discardDraft').disabled=!s.canDiscard;
 $('delete').hidden=current.kind==='page'||!current.sha;$('reload').disabled=!!busy||!current.sha;
 $('viewLive').hidden=!current.published;if(current.publicUrl)$('viewLive').href=current.publicUrl;
}
function setBusy(value){busy=value;renderState();}
function edited(){unsaved=JSON.stringify(formState())!==baseline;feedback();notice('');renderState();}
const mayLeave=()=>!unsaved||confirm('当前修改尚未暂存。离开会丢失这些修改，确定离开吗？');
function renderList(){
 const q=$('search').value.toLowerCase(),filter=$('filter').value;
 const shown=entries.filter(e=>e.title.toLowerCase().includes(q)&&(filter==='all'||filter==='page'&&e.kind==='page'||filter==='draft'&&e.kind==='post'&&!e.published||filter==='post'&&e.kind==='post'&&e.published||filter==='pending'&&e.hasDraft));
 $('count').textContent=`${shown.length} 项内容`;$('entries').replaceChildren();
 for(const e of shown.sort((a,b)=>(a.kind==='page'?0:1)-(b.kind==='page'?0:1)||a.title.localeCompare(b.title,'zh'))){
  const button=document.createElement('button');button.type='button';button.textContent=e.title;button.disabled=!!busy;button.setAttribute('aria-current',String(current?.path===e.path));
  const badge=document.createElement('small');badge.textContent=(e.kind==='page'?'页面 · ':'')+(e.published?(e.hasDraft?'已发布 · 待更新':'已发布'):'未发布草稿');button.append(badge);button.onclick=()=>open(e.path);$('entries').append(button);
 }
}
async function refresh(){if(busy)return;setBusy('正在刷新列表…');$('listStatus').textContent='正在读取最新内容…';try{entries=(await api('list')).entries;renderList();$('listStatus').textContent='';}catch(e){$('listStatus').textContent='列表刷新失败';handleError(e);}finally{setBusy('');}}
function display(doc){
 current=doc;const page=doc.kind==='page',m=doc.meta;$('empty').hidden=true;$('editForm').hidden=false;$('postFields').hidden=page;$('pageFields').hidden=!page;
 $('kind').textContent=page?'独立页面':'文章';$('title').value=m.title||'';$('body').value=doc.body||'';
 for(const key of ['createdDate','date','updateDate'])$(key).value=localDate(m[key]);
 $('autoModified').checked=true;$('tags').value=(m.tags||[]).join('，');$('category').value=(m.category||[]).join(' / ');$('description').value=m.description||'';$('comment').checked=m.comment===true;$('sidebar').checked=m.sidebar!==false;
 $('pageHint').hidden=doc.path!=='src/pages/about.mdx';baseline=JSON.stringify(formState());unsaved=false;feedback();notice('');renderList();renderState();
}
function updateEntry(doc){entries=entries.filter(e=>e.path!==doc.path);entries.push({path:doc.path,kind:doc.kind,title:doc.meta.title,published:doc.published,hasDraft:doc.hasDraft});}
async function open(path){if(busy||!mayLeave())return;feedback();setBusy('正在打开…');try{display(await api('read',undefined,{path}));}catch(e){handleError(e);}finally{setBusy('');}}
function collectMeta(){
 const m={title:$('title').value,tags:$('tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),category:$('category').value.split('/').map(s=>s.trim()).filter(Boolean),description:$('description').value,comment:$('comment').checked,sidebar:$('sidebar').checked};
 for(const key of ['createdDate','date','updateDate']){const v=$(key).value;m[key]=key==='updateDate'&&$('autoModified').checked?'':v===localDate(current.meta[key])?(current.meta[key]||''):v?v+'+08:00':'';}return m;
}
async function save(intent){
 if(busy||!current)return;const s=editorState(current,unsaved);if(intent==='draft'&&!s.canDraft||intent==='publish'&&!s.canPublish)return;
 if(intent==='publish'){
  if(!$('title').value.trim()){$('title').focus();feedback('发布前请填写标题。还没想好标题可以先暂存。','error');return;}
  if(!$('body').value.trim()){$('body').focus();feedback('发布前请填写正文。内容还没写完可以先暂存。','error');return;}
 }
 const input={path:current.path,sha:current.sha,body:$('body').value,meta:collectMeta(),intent};feedback();notice('');setBusy(intent==='draft'?'正在暂存…':'正在发布…');
 try{const doc=await api('save',input);updateEntry(doc);display(doc);feedback(intent==='draft'?(doc.published?'修改已暂存。线上仍展示上次发布的版本。':'草稿已暂存，仅你在后台可见。'):'发布成功，线上已更新。','success');}catch(e){handleError(e);}finally{setBusy('');}
}
async function transition(op){
 if(busy||!current)return;if(['withdraw','discard-draft'].includes(op)&&unsaved){feedback('请先暂存当前修改，再进行此操作。');return;}
 const messages={withdraw:'撤回后访客将无法访问这篇文章。内容和暂存修改会保留为草稿，确定撤回？','discard-draft':'放弃已暂存的修改，恢复上次发布的内容？线上版本不会改变。',delete:`确定删除“${current.meta.title}”吗？${current.published?'文章会立即从公网下线。':''}${unsaved?'当前未保存的修改也会丢失。':''}`};
 if(!confirm(messages[op]))return;feedback();setBusy(op==='delete'?'正在删除…':op==='withdraw'?'正在撤回…':'正在恢复线上版本…');
 try{const doc=await api(op,{path:current.path,sha:current.sha});
  if(op==='delete'){entries=entries.filter(e=>e.path!==current.path);current=null;baseline='';unsaved=false;$('editForm').hidden=true;$('empty').hidden=false;feedback();notice('文章已删除，已从公网移除。');renderList();}
  else{updateEntry(doc);display(doc);feedback(op==='withdraw'?'已撤回发布，内容保留为草稿。':'已放弃暂存修改，当前内容与线上一致。','success');}
 }catch(e){handleError(e);}finally{setBusy('');}
}
$('loginForm').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await api('login',{password:$('password').value});$('password').value='';$('loginPanel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;notice('');const resumed=expired;expired=false;await refresh();if(resumed&&current)feedback('已重新登录，修改已保留。请继续暂存或发布。');}catch(e){notice(e.message);}finally{e.submitter.disabled=false;}};
$('logout').onclick=async()=>{if(busy||!mayLeave())return;setBusy('正在退出…');try{await api('logout',{});unsaved=false;busy='';location.reload();}catch(e){handleError(e);setBusy('');}};
$('refresh').onclick=refresh;$('search').oninput=renderList;$('filter').onchange=renderList;
$('new').onclick=()=>{if(busy||!mayLeave())return;display({kind:'post',path:`src/content/blog/post-${Date.now()}-${crypto.randomUUID().slice(0,8)}.md`,sha:'',published:false,hasDraft:false,meta:{title:'',tags:[],category:[]},body:''});$('title').focus();};
$('editForm').oninput=()=>{if(!busy)edited();};$('editForm').onchange=()=>{if(!busy)edited();};$('editForm').onsubmit=e=>e.preventDefault();
$('saveDraft').onclick=()=>save('draft');$('publish').onclick=()=>save('publish');$('reload').onclick=()=>current&&open(current.path);
for(const [id,op] of [['withdraw','withdraw'],['discardDraft','discard-draft'],['delete','delete']])$(id).onclick=()=>transition(op);
$('copyBody').onclick=async()=>{try{await navigator.clipboard.writeText($('body').value);feedback('正文已复制，可以保留后再重新载入。');}catch{feedback('复制失败，请选中正文后手动复制。','error');}};
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&current&&!expired){e.preventDefault();save('draft');}});
window.addEventListener('beforeunload',e=>{if(unsaved||busy){e.preventDefault();e.returnValue='';}});
api('session').then(async()=>{$('loginPanel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;await refresh();}).catch(e=>{if(e.status!==401)notice(e.message);});
