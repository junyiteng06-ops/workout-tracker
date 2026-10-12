import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from 'astro:env/server';
import type { Database } from '@/lib/database.types';

export function createSupabase(request: Request, cookies: AstroCookies) {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get('Cookie') ?? ''),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookies.set(name, value, { ...options, sameSite: options.sameSite === true ? 'strict' : options.sameSite || 'lax' });
        }
      },
    },
  });
}

export type Supabase = ReturnType<typeof createSupabase>;
