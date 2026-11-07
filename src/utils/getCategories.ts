import type { Category } from '@/types';
import getPosts from './getPosts';
export default async function getCategories(): Promise<Category[]> {
 const posts = await getPosts();
 return posts.flatMap(post => post.category).filter((entry,index,all) => all.findIndex(other => other.slug === entry.slug) === index);
}
