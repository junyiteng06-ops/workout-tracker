import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type CategoryKey } from '@/config/site';

export type Article = CollectionEntry<'articles'>;

export async function getPublishedArticles(): Promise<Article[]> {
  const all = await getCollection('articles', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 記事が1件以上あるカテゴリだけを返す(空のカテゴリページは作らない) */
export async function getActiveCategories(): Promise<CategoryKey[]> {
  const used = new Set((await getPublishedArticles()).map((a) => a.data.category));
  return (Object.keys(CATEGORIES) as CategoryKey[]).filter((key) => used.has(key));
}

export function relatedArticles(current: Article, all: Article[], limit = 3): Article[] {
  const score = (a: Article) =>
    (a.data.category === current.data.category ? 2 : 0) + a.data.tags.filter((t) => current.data.tags.includes(t)).length;
  return all
    .filter((a) => a.id !== current.id)
    .map((a) => ({ a, s: score(a) }))
    .filter(({ s }) => s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map(({ a }) => a);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).format(date);
}
