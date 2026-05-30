import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';

const BRAND_BASE: Record<string, string> = {
  'qron.space':         'https://qron.space',
  'www.qron.space':     'https://qron.space',
  'qron.io':            'https://qron.space',
  'authichain.com':     'https://authichain.com',
  'www.authichain.com': 'https://authichain.com',
  'strainchain.io':     'https://strainchain.io',
  'www.strainchain.io': 'https://strainchain.io',
  'govchain.us':        'https://govchain.us',
  'www.govchain.us':    'https://govchain.us',
};

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = (headersList.get('host') ?? '').toLowerCase().split(':')[0];
  const base = BRAND_BASE[host] ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://qron.space';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/dashboard', '/login', '/sandbox', '/success', '/verify'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
