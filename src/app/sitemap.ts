import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';
import { BRAND_BASE, PRIMARY_DOMAIN } from '@/lib/brand-domains';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = (headersList.get('host') ?? '').toLowerCase().split(':')[0];
  const base =
    BRAND_BASE[host] ?? process.env.NEXT_PUBLIC_APP_URL ?? PRIMARY_DOMAIN;
  const now = new Date();

  // Secondary brand domains: only their landing page matters for SEO
  if (base !== PRIMARY_DOMAIN) {
    return [
      { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    ];
  }

  // qron.space: full page inventory
  return [
    { url: base,                                  lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/pricing`,                     lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/eu-dpp`,                      lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/gallery`,                     lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/digital-product-passport`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/studio`,                      lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/demo`,                        lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/governance`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/authichain`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/about`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/enterprise`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/white-label`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs`,                        lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/explorers`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/contact`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/elite`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/affiliate`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/creators`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/ftc-shield`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/partners`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/status`,                      lastModified: now, changeFrequency: 'always',  priority: 0.5 },
    { url: `${base}/privacy`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/terms`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/legal`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
