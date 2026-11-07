import type { Tag } from '@/types';
import getPosts from './getPosts';
export default async function getTags(): Promise<Tag[]> {
 const posts = await getPosts();
 return posts.flatMap(post => post.tags).filter((entry,index,all) => all.findIndex(other => other.slug === entry.slug) === index);
}
