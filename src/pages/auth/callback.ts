import type { EmailOtpType } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';
import { safeNext } from '@/lib/http';

export const prerender = false;

// 確認メール・パスワード再設定メールのリンクの戻り先
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await locals.supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  return redirect(ok ? next : '/login?error=link', 303);
};
