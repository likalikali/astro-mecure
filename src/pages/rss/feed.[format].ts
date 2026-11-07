import type { APIRoute, GetStaticPaths } from 'astro';
import generateRssFeed from '@/utils/generateRSSFeed';
import config from '@/config'

export const GET: APIRoute = async ({params, site}) => {
  if (!site) {
    return new Response();
  }
  const format = params.format as 'xml' | 'json';
  if(!['xml','json'].includes(format)) return new Response('Not found',{status:404});
  return new Response(await generateRssFeed({
    title: config.title,
    description: config.description,
    site: site.href,
    author: config.author,
    favicon: config.favicon,
    format: format,
  }))
  // return rss({
  //   title: 'Title',
  //   description: 'A humble Astronaut’s guide to the stars',
  //   site: site?.href ?? '',
  //   items: (await getPosts()).map(post => ({
  //     title: post.title,
  //     pubDate: post.date,
  //     description: post.excerpt,
  //     draft: post.draft,
  //     // Compute RSS link from post `slug`
  //     // This example assumes all posts are rendered as `/blog/[slug]` routes
  //     link: `/blog/${post.slug}/`,
  //     content: post.raw
  //   })),
  // })
}
