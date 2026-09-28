interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ADSENSE_CLIENT?: string;
  readonly PUBLIC_AMAZON_TAG?: string;
  readonly PUBLIC_RAKUTEN_AFFILIATE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
