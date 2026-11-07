import type { APIRoute } from 'astro';
import getPosts from '@/utils/getPosts';

export const GET: APIRoute = async () => {
  const posts = (await getPosts())
    .filter(post => !post.draft && !post.access)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(post => ({
      title: post.title,
      description: (post.excerpt ?? '').replace(/<[^>]*>/g, '').slice(0, 350),
      category: post.category.label,
      tags: post.tags.map(tag => tag.label),
      url: post.url,
    }));

  return new Response(JSON.stringify(posts), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
