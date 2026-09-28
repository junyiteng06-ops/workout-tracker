// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://example.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  adapter: cloudflare({
    // 公開ページはビルド時に画像を最適化する(実行時の画像変換は使わない＝無料枠で完結)
    imageService: 'compile',
  }),
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !/\/(app|login|signup)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
});
