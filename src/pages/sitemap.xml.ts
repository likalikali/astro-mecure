import type { APIRoute } from 'astro';
import getPosts from '@/utils/getPosts';
import getCategories from '@/utils/getCategories';
import getTags from '@/utils/getTags';
import { PAGES } from '../../scripts/cloud-admin-core.js';
export const GET: APIRoute = async ({ site }) => {
  const posts=await getPosts();
  const paths=['/','/archive/','/categories/','/tags/',...PAGES.map(p=>'/'+p.replace(/^src\/pages\//,'').replace(/\.mdx$/,'')+'/'),...posts.map(p=>p.url),...(await getCategories()).map(c=>c.url),...(await getTags()).map(t=>t.url)];
  const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...new Set(paths)].map(p=>`<url><loc>${escape(new URL(p,site).href)}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
