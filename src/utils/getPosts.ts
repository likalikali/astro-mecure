import type { Post } from '@/types';
import config from '@/config';
import defaultAvatar from '@/assets/avatar-sakura.webp';
import { listDocuments, contentScope } from '../../scripts/content-database.js';
import transformTags from './transformTags';
import transformCategory from './transformCategory';
import { encryptProtectedContent, PROTECTED_POST_EXCERPT, PROTECTED_POST_RAW } from './protectedContent';

export default async function getPosts(): Promise<Post[]> {
  const scope = contentScope.getStore();
  if (scope?.posts) return scope.posts;
  const load = async () => {
    const records = (await listDocuments()).filter((doc: any) => doc.kind === 'post' && !doc.meta.draft);
    const tags = new Map<string, number>(), categories = new Map<string, number>();
    for (const {meta} of records) {
      for (const tag of meta.tags || []) tags.set(tag, (tags.get(tag) || 0) + 1);
      const category = (meta.category || []).join('/');
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    return records.map((doc: any) => {
      const m = doc.meta, access = m.access;
      const published = new Date(m.date || m.createdDate || doc.saved_at);
      return {
        slug: doc.slug, url: `/posts/${doc.slug}/`, title: m.title,
        author: { name: config.author, avatar: defaultAvatar }, image: m.image,
        createdDate: new Date(m.createdDate || published), date: published,
        updateDate: new Date(m.updateDate || published), draft: false,
        category: { ...transformCategory(m.category || []), count: categories.get((m.category || []).join('/')) || 1 },
        tags: transformTags(m.tags || []).map(tag => ({...tag,count:tags.get(tag.label) || 1})),
        cardVariant: m.cardVariant || 'plain',
        ...(access ? { access: { isProtected: true, hint: access.hint,
          excerpt: access.excerpt || PROTECTED_POST_EXCERPT,
          encryptedContent: encryptProtectedContent(doc.html, access.password) } } : {}),
        raw: access ? PROTECTED_POST_RAW : doc.html,
        excerpt: access ? (access.excerpt || PROTECTED_POST_EXCERPT) : doc.excerpt,
        headings: access ? [] : doc.headings,
        wordCount: doc.word_count, readingTime: doc.word_count / 300,
      } as Post;
    });
  };
  const promise = load();
  if(scope) scope.posts = promise;
  return promise;
}
