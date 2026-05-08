import type { MetadataRoute } from 'next';

const BASE = 'https://qron.space';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    // Core pages
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE}/gallery`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE}/governance`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE}/digital-product-passport`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE}/authichain`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // SEO landing pages
    {
      url: `${BASE}/ai-qr-code-generator`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/qr-code-art`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
        {
      url: `${BASE}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
