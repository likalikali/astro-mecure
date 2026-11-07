import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='https://yukinoshitasherry.github.io';
const response=await fetch(origin+'/archives/',{signal:AbortSignal.timeout(30000)});
assert.ok(response.ok,'Cannot read source archive');const html=await response.text();
const dates=new Map();
for(const block of html.split('<div class="post-item-wrapper">').slice(1)){
 const path=block.match(/class="post-title"><a href="([^"]+)"/)?.[1];
 const day=block.match(/Posted at(?:&nbsp;|\s)*(\d{4}-\d{2}-\d{2})/)?.[1];
 if(path&&day)dates.set(decodeURIComponent(new URL(path.replaceAll('&amp;','&'),origin).pathname),day);
}
const rows=[];
for(const file of (await fs.readdir('src/content/blog')).filter(f=>/^writing-prompt-.*\.md$/.test(f))){
 const path='src/content/blog/'+file,source=await fs.readFile(path,'utf8');
 const url=source.match(/https:\/\/yukinoshitasherry\.github\.io\/[^\s)]+/)?.[0];
 assert.ok(url,'Missing source for '+path);
 const day=dates.get(decodeURIComponent(new URL(url).pathname));assert.ok(day,'Missing date for '+url);
 rows.push({path,url,day,timestamp:day+'T00:00:00+08:00'});
}
assert.equal(rows.length,216);
await fs.mkdir('_drafts',{recursive:true});
await fs.writeFile('_drafts/placeholder-source-dates.json',JSON.stringify({retrievedAt:new Date().toISOString(),source:origin+'/archives/',datePolicy:'All three placeholder dates use the source publication day at 00:00 Beijing time; source creation/modification times are not separately provided.',rows},null,2));
console.log('Mapped',rows.length,'placeholder dates;',dates.size,'source archive entries.');

