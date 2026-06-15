import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';
import { BRAND_BASE, PRIMARY_DOMAIN } from '@/lib/brand-domains';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = (headersList.get('host') ?? '').toLowerCase().split(':')[0];
  const base =
    BRAND_BASE[host] ?? process.env.NEXT_PUBLIC_APP_URL ?? PRIMARY_DOMAIN;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/dashboard',
          '/login',
          '/sandbox',
          '/success',
          '/verify',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
