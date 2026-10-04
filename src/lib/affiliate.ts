import { AFFILIATE } from '@/config/site';
import type { Product } from '@/data/products';

export type Shop = 'amazon' | 'rakuten' | 'yahoo';

export const SHOP_LABELS: Record<Shop, string> = {
  amazon: 'Amazonで見る',
  rakuten: '楽天市場で見る',
  yahoo: 'Yahoo!ショッピングで見る',
};

export const AFFILIATE_REL = 'sponsored nofollow noopener';

export function amazonUrl(product: Pick<Product, 'asin' | 'keyword'>): string {
  const url = product.asin
    ? new URL(`https://www.amazon.co.jp/dp/${product.asin}`)
    : new URL(`https://www.amazon.co.jp/s?k=${encodeURIComponent(product.keyword)}`);
  if (AFFILIATE.amazonTag) url.searchParams.set('tag', AFFILIATE.amazonTag);
  return url.toString();
}

export function rakutenUrl(product: Pick<Product, 'keyword'>): string {
  const target = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(product.keyword)}/`;
  if (!AFFILIATE.rakutenAffiliateId) return target;
  return `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE.rakutenAffiliateId}/?pc=${encodeURIComponent(target)}`;
}

export function yahooUrl(product: Pick<Product, 'keyword'>): string {
  return `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(product.keyword)}`;
}

/** ASPで発行したリンク(links)があれば優先し、なければIDから自動生成する */
export function shopLinks(product: Product): { shop: Shop; href: string }[] {
  const shops = product.shops ?? ['amazon', 'rakuten', 'yahoo'];
  const builders: Record<Shop, () => string> = {
    amazon: () => product.links?.amazon ?? amazonUrl(product),
    rakuten: () => product.links?.rakuten ?? rakutenUrl(product),
    yahoo: () => product.links?.yahoo ?? yahooUrl(product),
  };
  return shops.map((shop) => ({ shop, href: builders[shop]() }));
}
