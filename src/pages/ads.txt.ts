import type { APIRoute } from 'astro';
import { ADS } from '@/config/site';

// AdSenseの審査・配信に必要。パブリッシャーIDは "ca-pub-" を除いた "pub-..." 部分を使う
export const GET: APIRoute = () => {
  const body = ADS.client ? `google.com, ${ADS.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
