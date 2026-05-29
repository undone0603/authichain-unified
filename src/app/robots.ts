import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/^﻿/, '') || 'https://authichain.com';

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${BASE}/sitemap.xml`,
  };
}
