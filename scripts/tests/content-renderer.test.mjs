import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDocument, renderMarkdown, MEMOIR_MARKER } from '../content-renderer.js';
import { contentScope, listDocuments, saveDocument } from '../content-database.js';

test('Markdown keeps tables, links and stable headings while stripping executable HTML',async()=>{
 const result=await renderMarkdown('## Hello\n\n[ok](https://example.com)\n\n<script>alert(1)</script><img src="x" onerror="alert(1)">\n\n| A | B |\n| - | - |\n| 1 | 2 |');
 assert.ok(result.html.includes('<table>'));assert.ok(result.html.includes('id="section-hello"'));
 assert.ok(!result.html.includes('<script'));assert.ok(!result.html.includes('onerror'));
 assert.deepEqual(result.headings,[{depth:2,slug:'section-hello',text:'Hello'}]);
});
test('about component marker survives as a safe rendering boundary',async()=>{
 const source="---\ntitle: 关于\n---\nimport MemoirEntrances from '@/components/MemoirEntrances.astro';\n\nBefore\n\n<MemoirEntrances />\n\nAfter";
 const record=await compileDocument('src/pages/about.mdx',source);
 assert.equal(record.slug,'about');assert.equal(record.html.split(MEMOIR_MARKER).length,2);
 assert.ok(!record.html.includes('import MemoirEntrances'));
});
test('request cache does not survive into the next request',async()=>{
 const original=globalThis.fetch;process.env.BLOG_DATABASE_URL='https://test.invalid';process.env.BLOG_DATABASE_SECRET='test';
 let calls=0;globalThis.fetch=async()=>({ok:true,json:async()=>[{version:++calls}]});
 try {
  await contentScope.run({},async()=>{assert.equal((await listDocuments())[0].version,1);assert.equal((await listDocuments())[0].version,1);});
  await contentScope.run({},async()=>{assert.equal((await listDocuments())[0].version,2);});
 } finally {globalThis.fetch=original;delete process.env.BLOG_DATABASE_SECRET;}
});
test('a racing write is rejected by the database compare-and-swap',async()=>{
 const original=globalThis.fetch;process.env.BLOG_DATABASE_URL='https://test.invalid';process.env.BLOG_DATABASE_SECRET='test';
 globalThis.fetch=async()=>({ok:true,json:async()=>[]});
 try {await assert.rejects(saveDocument('src/content/blog/test.md','---\ntitle: Test\n---\nText','stale'),e=>e.status===409);}
 finally{globalThis.fetch=original;delete process.env.BLOG_DATABASE_SECRET;}
});

test('only the approved non-autoplay NetEase player may embed',async()=>{
 const ok=await renderMarkdown('<iframe src="//music.163.com/outchain/player?type=2&id=3366825024&auto=0&height=66" onload="evil()"></iframe>');
 assert.ok(ok.html.includes('<iframe'));assert.ok(ok.html.includes('https://music.163.com/'));assert.ok(!ok.html.includes('onload'));
 for(const src of ['https://evil.example/','javascript:alert(1)','https://music.163.com.evil.example/outchain/player?type=2&id=1&auto=0&height=66'])assert.ok(!(await renderMarkdown(`<iframe src="${src}"></iframe>`)).html.includes('<iframe'));
});
