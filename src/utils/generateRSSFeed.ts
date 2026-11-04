import { compareDesc, getYear } from 'date-fns';
import { Feed } from 'feed';
import getPosts from './getPosts';
import type { Post } from '@/types';

interface RssFeedOptions {
  title: string;
  description?: string;
  site: string;
  author?: string;
  favicon?: string;
  format: 'xml' | 'json';
}

function getFeedImageUrl(image: Post['image'], site: string) {
  if (!image) {
    return undefined;
  }
  if (typeof image === 'string') {
    return new URL(image, site).href;
  }
  if ('src' in image) {
    return new URL(image.src, site).href;
  }
  return undefined;
}

export default async function generateRssFeed(options: RssFeedOptions) {
  const {
    title,
    description,
    site,
    favicon,
    author,
    format,
  } = options;
  const posts = (await getPosts()).filter(post => !post.draft).sort((a, b) => compareDesc(a.date, b.date));
  const feed = new Feed({
    title: title,
    description: description,
    id: new URL(site).href,
    link: new URL(site).href,
    language: "zh-CN",
    copyright: `Copyright © ${getYear(new Date())} ${author}`,
    image: favicon && new URL(favicon, site).href,
    favicon: favicon && new URL(favicon, site).href,
    updated: new Date(),
    author: {
      name: author,
    }
  });
  posts.forEach(post => {
    feed.addItem({
      title: post.title,
      id: new URL(post.url, site).href,
      link: new URL(post.url, site).href,
      description: post.excerpt,
      date: post.updateDate,
      published: post.date,
      content: post.raw,
      author: [{ name: post.author.name }],
      image: getFeedImageUrl(post.image, site),
    })
  });
  if (format === 'xml') {
    return feed.rss2();
  }
  return feed.json1();
}
