import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES, type CategoryKey } from '@/config/site';

const categoryKeys = Object.keys(CATEGORIES) as [CategoryKey, ...CategoryKey[]];

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(60),
      description: z.string().max(160),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.enum(categoryKeys),
      tags: z.array(z.string()).default([]),
      /** アフィリエイトリンクを含む記事は true(冒頭にPR表記を自動表示) */
      sponsored: z.boolean().default(false),
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { articles };
