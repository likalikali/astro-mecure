import type { Post } from '@/types';
import config from '@/config';
import defaultAvatar from '@/assets/avatar-sakura.webp';
import { type CollectionEntry, getCollection, getEntry } from 'astro:content';

// import { slug } from 'github-slugger';

import transformTags from './transformTags';
import transformCategory from './transformCategory';
import { url } from './url';
import getFileCreateTime from './getFileCreateTime';
import getFileUpdateTime from './getFileUpdateTime';
import { encryptProtectedContent, PROTECTED_POST_EXCERPT, PROTECTED_POST_RAW } from './protectedContent';
import { CONTENT_DIR, BLOG_COLLECTION_NAME as collection } from '@/constants';

function getPostPath(id: string) {
  let path = url(CONTENT_DIR, collection, id);
  if (path.startsWith('/')) {
    path = path.slice(1)
  }
  return path;
}

function countTags(posts: CollectionEntry<'blog'>[]) {
  const bucket = new Map<string, number>();
  posts.map(post => {
    post.data.tags.forEach(tag => {
      bucket.set(tag, (bucket.get(tag) ?? 0) + 1);
    });
  })
  return bucket;
}

function countCategories(posts: CollectionEntry<'blog'>[]) {
  const bucket = new Map<string, number>();
  posts.map(post => {
    const category = post.data.category.join('/');
    bucket.set(category, (bucket.get(category) ?? 0) + 1);
  })
  return bucket;
}

function postUrl(slug: string) {
  return url('posts', slug);
}

let cache: Post[] | null = null;

async function getPosts(): Promise<Post[]> {
  if (cache !== null) {
    return cache;
  }
  const posts = await getCollection(collection, ({ data }) => !data.draft);

  const tagsBucket = countTags(posts);
  const categoriesBucket = countCategories(posts);
  
  cache = await Promise.all(posts.map(async post => {
    const { Content, headings, remarkPluginFrontmatter } = await post.render();
    const authorData = (await getEntry(post.data.author)).data ?? { name: config.author };
    // Bundle our own author avatar instead of fetching another website at build time.
    const author = {
      ...authorData,
      ...(post.data.author.id === 'default' ? { avatar: defaultAvatar } : {}),
    };
    const date = post.data.date ?? getFileCreateTime(getPostPath(post.id));
    const updateDate = post.data.updateDate ?? getFileUpdateTime(getPostPath(post.id));
    const raw = remarkPluginFrontmatter.raw ?? '';
    const accessConfig = post.data.access;
    const accessExcerpt = accessConfig?.excerpt ?? PROTECTED_POST_EXCERPT;
    const access = accessConfig ? {
      isProtected: true as const,
      excerpt: accessExcerpt,
      encryptedContent: encryptProtectedContent(raw, accessConfig.password),
      ...(accessConfig.hint ? { hint: accessConfig.hint } : {}),
    } : undefined;

    return {
      slug: post.data.permalink ?? post.slug,
      title: post.data.title ?? '无标题',
      url: postUrl(post.slug),
      author: author,
      image: post.data.image,
      createdDate: post.data.createdDate ?? date,
      date: post.data.date ?? date,
      updateDate: post.data.updateDate ?? updateDate,
      draft: post.data.draft,
      category: {
        ...transformCategory(post.data.category),
        count: categoriesBucket.get(post.data.category.join('/')) ?? 1
      },
      tags: transformTags(post.data.tags).map(tag => ({ 
        ...tag, 
        count: tagsBucket.get(tag.label) ?? 1,
      })),
      cardVariant: post.data.cardVariant,
      ...(access ? { access } : {}),
      raw: access ? PROTECTED_POST_RAW : raw,
      excerpt: access ? accessExcerpt : remarkPluginFrontmatter.excerpt,
      readingTime: remarkPluginFrontmatter.readingTime,
      wordCount: remarkPluginFrontmatter.wordCount,
      headings: access ? [] : headings,
      Content: Content,
    }
  }))
  return cache;
}

export default getPosts;
