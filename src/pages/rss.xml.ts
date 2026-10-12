import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';
import { getPublishedArticles } from '@/lib/articles';

export const GET: APIRoute = async ({ site }) => {
  const articles = await getPublishedArticles();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: site!,
    items: articles.map(({ id, data }) => ({
      title: data.title,
      description: data.description,
      pubDate: data.pubDate,
      link: `/articles/${id}`,
    })),
    customData: `<language>${SITE.lang}</language>`,
  });
};
