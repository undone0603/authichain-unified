/**
 * Single source of truth for the multi-brand domain → canonical URL map.
 * Imported by sitemap.ts, robots.ts, and any middleware that needs it.
 */
export const BRAND_BASE: Record<string, string> = {
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

export const PRIMARY_DOMAIN = 'https://qron.space';
