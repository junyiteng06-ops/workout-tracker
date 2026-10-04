import { SITE } from '@/config/site';

export interface Crumb {
  label: string;
  href?: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ label: 'ホーム', href: '/' }, ...crumbs].map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, site).toString() } : {}),
    })),
  };
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  url: URL;
  image: URL;
  published: Date;
  modified?: Date;
  site: URL;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    image: [opts.image.toString()],
    datePublished: opts.published.toISOString(),
    dateModified: (opts.modified ?? opts.published).toISOString(),
    mainEntityOfPage: opts.url.toString(),
    author: { '@type': 'Organization', name: SITE.author, url: new URL('/about', opts.site).toString() },
    publisher: { '@type': 'Organization', name: SITE.name, url: opts.site.toString() },
  };
}

export function websiteJsonLd(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    alternateName: SITE.nameJa,
    url: site.toString(),
    description: SITE.description,
    inLanguage: SITE.lang,
  };
}
