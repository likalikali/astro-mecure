const $ = id => document.getElementById(id);
let entries = [], current = null, unsaved = false, busy = false;
const notice = text => { $('notice').textContent = text; };
async function api(op, data, query = {}) {
  const params = new URLSearchParams({ op, ...query });
  const res = await fetch('/api/admin?' + params, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await res.json().catch(() => ({ error: '服务器暂时无法响应，请稍后重试。' }));
  if (!res.ok) throw new Error(result.error || '请求未完成');
  return result;
}
const dirty = value => { unsaved = value; $('dirty').textContent = value ? '尚未保存' : '已保存'; };
const mayLeave = () => !unsaved || confirm('当前修改尚未保存，确定放弃吗？');
function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 19) : '';
}
function renderList() {
  const q = $('search').value.toLowerCase(), filter = $('filter').value;
  const shown = entries.filter(e => (e.title.toLowerCase().includes(q)) && (filter === 'all' || filter === 'page' && e.kind === 'page' || filter === 'draft' && e.kind === 'post' && e.draft || filter === 'post' && e.kind === 'post' && !e.draft));
  $('count').textContent = `${shown.length} 项内容`;
  $('entries').replaceChildren();
  for (const entry of shown.sort((a,b) => (a.kind === 'page' ? 0 : 1) - (b.kind === 'page' ? 0 : 1) || a.title.localeCompare(b.title, 'zh'))) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.title;
    button.setAttribute('aria-current', String(current?.path === entry.path));
    const badge = document.createElement('small'); badge.textContent = entry.kind === 'page' ? '独立页面' : entry.draft ? '草稿' : '公开文章'; button.append(badge);
    button.onclick = () => open(entry.path); $('entries').append(button);
  }
}
async function refresh() {
  notice('正在读取最新内容……');
  try { entries = (await api('list')).entries; renderList(); notice(''); } catch (e) { notice(e.message); }
}
function display(doc) {
  current = doc; const page = doc.kind === 'page', m = doc.meta;
  $('empty').hidden = true; $('editForm').hidden = false; $('postFields').hidden = page; $('pageFields').hidden = !page;
  $('kind').textContent = page ? '独立页面' : '文章'; $('delete').hidden = page || !doc.sha;
  $('title').value = m.title || ''; $('body').value = doc.body || '';
  for (const key of ['createdDate', 'date', 'updateDate']) $(key).value = localDate(m[key]);
  $('autoModified').checked = true; $('updateDate').disabled = true;
  $('tags').value = (m.tags || []).join('，'); $('category').value = (m.category || []).join(' / ');
  $('draft').checked = m.draft === true; $('description').value = m.description || '';
  $('comment').checked = m.comment === true; $('sidebar').checked = m.sidebar !== false;
  $('pageHint').hidden = doc.path !== 'src/pages/about.mdx';
  dirty(false); renderList();
}
async function open(path) {
  if (busy || !mayLeave()) return;
  busy = true; notice('正在打开……');
  try { display(await api('read', undefined, { path })); notice(''); } catch(e) { notice(e.message); } finally { busy = false; }
}
function showPublished(isPublished = true) {
  $('deploy').textContent = isPublished ? '✓ 已发布，公网立即生效。打开或刷新博客即可看到。' : '✓ 草稿已保存，不在公网展示。';
}
$('loginForm').onsubmit = async e => {
  e.preventDefault(); const button = e.submitter; button.disabled = true;
  try { await api('login', { password: $('password').value }); $('password').value = ''; await enter(); } catch(e) { notice(e.message); } finally { button.disabled = false; }
};
async function enter() { $('loginPanel').hidden = true; $('workspace').hidden = false; $('logout').hidden = false; await refresh(); }
$('logout').onclick = async () => { if(busy || !mayLeave()) return; try { await api('logout', {}); location.reload(); } catch(e) { notice(e.message); } };
$('refresh').onclick = () => { if(!busy) refresh(); };
$('search').oninput = renderList; $('filter').onchange = renderList;
$('new').onclick = () => {
  if(busy || !mayLeave()) return;
  display({ kind: 'post', path: `src/content/blog/post-${Date.now()}-${crypto.randomUUID().slice(0,8)}.md`, sha: '', meta: { title: '', tags: [], category: [], draft: false }, body: '' });
  dirty(true); $('title').focus();
};
$('editForm').oninput = () => { if(!busy) dirty(true); };
$('autoModified').onchange = () => { $('updateDate').disabled = $('autoModified').checked; dirty(true); };
$('editForm').onsubmit = async e => {
  e.preventDefault(); if(busy || !current) return;
  const meta = { title: $('title').value, draft: $('draft').checked, tags: $('tags').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean), category: $('category').value.split('/').map(x=>x.trim()).filter(Boolean), description: $('description').value, comment: $('comment').checked, sidebar: $('sidebar').checked };
  for(const key of ['createdDate','date','updateDate']) meta[key] = key === 'updateDate' && $('autoModified').checked ? '' : $(key).value ? $(key).value + '+08:00' : '';
  busy = true; $('save').disabled = true; $('body').readOnly = true; notice('正在保存……');
  // Freeze all fields so a successful response cannot discard edits typed during the request.
  const fields = [...$('editForm').querySelectorAll('input, textarea, button')]; const disabled = fields.map(f=>f.disabled); fields.forEach(f=>f.disabled=true);
  try {
    const doc = await api('save', { path: current.path, sha: current.sha, meta, body: $('body').value });
    entries = entries.filter(x=>x.path !== doc.path); entries.push({ path: doc.path, kind: doc.kind, title: doc.meta.title, draft: doc.meta.draft });
    display(doc); notice('已保存。'); showPublished(doc.published);
  } catch(e) { notice(e.message); } finally { busy=false; fields.forEach((f,i)=>f.disabled=disabled[i]); $('save').disabled=false; $('body').readOnly=false; $('updateDate').disabled=$('autoModified').checked; }
};
$('delete').onclick = async () => {
  if(busy || !current || !confirm(`确定删除“${current.meta.title}”吗？网站将自动更新。`)) return;
  busy=true; $('delete').disabled=true;
  try { const result=await api('delete',{path:current.path,sha:current.sha}); entries=entries.filter(x=>x.path!==current.path); current=null; dirty(false); $('editForm').hidden=true; $('empty').hidden=false; renderList(); notice('文章已删除。'); showPublished(); }
  catch(e){notice(e.message);} finally{busy=false;$('delete').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(unsaved || busy){e.preventDefault();e.returnValue='';}});
api('session').then(enter).catch(e=>{if(!e.message.includes('登录'))notice(e.message);});
