import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    // Core pages
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/pricing`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/eu-dpp`,              lastModified: new Date('2026-05-29'), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/gallery`,             lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/digital-product-passport`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/studio`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/demo`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/governance`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/authichain`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/about`,               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/enterprise`,          lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/white-label`,         lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/docs`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/explorers`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/contact`,             lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/elite`,               lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/affiliate`,           lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/creators`,            lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/ftc-shield`,          lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/partners`,            lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/status`,              lastModified: now, changeFrequency: 'always',  priority: 0.5 },
    // Legal
    { url: `${BASE}/privacy`,             lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/terms`,               lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/legal`,               lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
