import { defineMiddleware } from 'astro:middleware';
import { createSupabase } from '@/lib/supabase';

const isProtected = (path: string) => path === '/app' || path.startsWith('/app/') || path.startsWith('/api/');

export const onRequest = defineMiddleware(async (context, next) => {
  // ビルド時に静的生成するページ(記事など)では認証処理をしない
  if (context.isPrerendered) return next();

  const supabase = createSupabase(context.request, context.cookies);
  context.locals.supabase = supabase;

  // getClaims は JWT を検証し、期限が近ければセッションを更新して Cookie を書き直す
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  context.locals.user = claims ? { id: claims.sub, email: claims.email ?? '' } : null;

  const path = context.url.pathname;
  if (isProtected(path) && !context.locals.user) {
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'ログインが必要です' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    return context.redirect(`/login?next=${encodeURIComponent(path + context.url.search)}`);
  }

  const response = await next();
  // ログイン状態に依存するページは CDN やブラウザにキャッシュさせない
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
});
