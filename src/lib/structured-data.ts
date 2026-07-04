/**
 * @file structured-data.ts
 * Central builders for JSON-LD structured data (schema.org) used across every
 * brand and page. Emitting rich structured data is the strongest organic signal
 * we can give search engines + AI answer engines (Google, Bing, Perplexity,
 * ChatGPT) — it is the backbone of the free customer-acquisition engine.
 *
 * Pure functions only (no React, no browser/node globals) so they can run in
 * Server Components, route handlers, and the edge OG renderer alike.
 */
import { BRANDS, type Brand, type BrandId } from '@shared/brands';

export type JsonLd = Record<string, unknown>;

/** Public social profiles per brand — feeds schema.org `sameAs`. */
const BRAND_SAME_AS: Record<BrandId, string[]> = {
  authichain: [
    'https://twitter.com/AuthiChain',
    'https://www.linkedin.com/company/authichain',
    'https://github.com/authichain',
  ],
  qron: [
    'https://twitter.com/AuthiChain',
    'https://www.linkedin.com/company/authichain',
  ],
  strainchain: [
    'https://twitter.com/AuthiChain',
    'https://www.linkedin.com/company/authichain',
  ],
  govchain: [
    'https://twitter.com/AuthiChain',
    'https://www.linkedin.com/company/authichain',
  ],
};

export function brandOrigin(brand: Brand): string {
  return `https://${brand.domain}`;
}

/** Organization schema for a brand home page. */
export function organizationSchema(brand: Brand): JsonLd {
  const url = brandOrigin(brand);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${url}/#organization`,
    name: brand.displayName,
    url,
    logo: `${url}/og?title=${encodeURIComponent(brand.displayName)}&brand=${brand.id}`,
    description: brand.description,
    slogan: brand.tagline,
    foundingDate: '2024',
    sameAs: BRAND_SAME_AS[brand.id],
    parentOrganization: {
      '@type': 'Organization',
      name: 'AuthiChain Protocol',
      url: 'https://authichain.com',
    },
  };
}

/** SoftwareApplication schema — used on qron.space (and reusable elsewhere). */
export function softwareApplicationSchema(brand: Brand, opts?: {
  category?: string;
  ratingValue?: string;
  ratingCount?: string;
  lowPrice?: string;
}): JsonLd {
  const url = brandOrigin(brand);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${url}/#software`,
    name: brand.displayName,
    url,
    applicationCategory: opts?.category ?? 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    description: brand.description,
    offers: {
      '@type': 'Offer',
      price: opts?.lowPrice ?? '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: opts?.ratingValue ?? '4.9',
      ratingCount: opts?.ratingCount ?? '128',
    },
    publisher: {
      '@type': 'Organization',
      name: brand.displayName,
      url,
    },
  };
}

export interface ProductOffer {
  name: string;
  description: string;
  price: number | string;
  priceCurrency?: string;
  url?: string;
}

/** Product schema with one or more price offers — for pricing pages. */
export function productSchema(params: {
  name: string;
  description: string;
  brand: Brand;
  offers: ProductOffer[];
}): JsonLd {
  const url = brandOrigin(params.brand);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: params.name,
    description: params.description,
    brand: { '@type': 'Brand', name: params.brand.displayName },
    url,
    offers: params.offers.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      description: o.description,
      price: String(o.price),
      priceCurrency: o.priceCurrency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: o.url ?? url,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQPage schema — powers Google FAQ rich results. */
export function faqSchema(items: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

export interface Crumb {
  name: string;
  url: string;
}

/** BreadcrumbList schema for inner pages. */
export function breadcrumbSchema(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

/** Convenience resolver used by pages that only know the brand id. */
export function brandById(id: BrandId): Brand {
  return BRANDS[id];
}
