import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// Host-aware robots.txt. The app serves four brands from one codebase, so the
// Sitemap directive must point at the requesting host's sitemap.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || 'authichain.com';
  const BASE = `https://${host}`;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep authenticated + transactional surfaces out of the index.
        disallow: ['/api/', '/dashboard', '/admin', '/login', '/auth/', '/success'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
