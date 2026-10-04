interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ADSENSE_CLIENT?: string;
  readonly PUBLIC_AMAZON_TAG?: string;
  readonly PUBLIC_RAKUTEN_AFFILIATE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    supabase: import('@/lib/supabase').Supabase;
    user: { id: string; email: string } | null;
  }
}
