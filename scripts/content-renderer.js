import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';
import { parseDocument } from './cloud-admin-core.js';

export const MEMOIR_MARKER = '<!--BLOG_MEMOIRS-->';
export async function renderMarkdown(body) {
  const headings = []; let text = '';
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
    .use(rehypeSanitize, { ...defaultSchema, attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes.code || []), ['className', /^language-./, 'math-inline', 'math-display']] } })
    .use(() => tree => {
      const slugger = new GithubSlugger();
      text = toText(tree);
      visit(tree, 'element', node => {
        if (/^h[1-6]$/.test(node.tagName)) {
          const label = toText(node), slug = 'section-' + slugger.slug(label);
          node.properties.id = slug;
          headings.push({ depth: Number(node.tagName[1]), slug, text: label });
        }
      });
    }).use(rehypeKatex).use(rehypeStringify);
  const html = String(await processor.process(body));
  const wordCount = (text.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) || []).length;
  return { html, headings, excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 200), wordCount };
}
export async function compileDocument(path, source) {
  const doc = parseDocument(path, source);
  // Database content is Markdown, never executable MDX/JavaScript.
  if (/^\s*(?:import|export)\s/m.test(doc.body)) throw new Error('在线正文请使用 Markdown，不支持 import/export 代码。');
  const segments = doc.body.split('<!-- 三色团子入口 -->');
  const parts = await Promise.all(segments.map(renderMarkdown));
  const slug = doc.kind === 'post' ? (doc.meta.permalink || path.replace(/^src\/content\/blog\//, '').replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '')) : path.replace(/^src\/pages\//, '').replace(/\.mdx?$/, '');
  return { path, kind: doc.kind, slug, source, meta: doc.meta, html: parts.map(p=>p.html).join(MEMOIR_MARKER), headings: parts.flatMap(p=>p.headings), excerpt: parts[0].excerpt, word_count: parts.reduce((n,p)=>n+p.wordCount,0) };
}
