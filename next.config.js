// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the Next.js dev server to be reached from any hostname
  // (required so that multi-tenant preview URLs resolve properly).
  experimental: {
    // Propagate x-brand header set by middleware into RSC fetch cache keys
    // so per-brand pages are independently cached.
    serverComponentsExternalPackages: [],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com',   pathname: '/**' },
      { protocol: 'https', hostname: 'w3s.link',            pathname: '/ipfs/**' },
      { protocol: 'https', hostname: '*.ipfs.dweb.link',    pathname: '/**' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source:      '/gov',
        destination: process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us',
        permanent:   false,
      },
    ];
  },

  // Expose the canonical hostname to RSC/SSR without a separate env var.
  // Reads VERCEL_URL at build time; falls back to authichain.com for production.
  // Usage in layouts: process.env.NEXT_PUBLIC_CANONICAL_HOSTNAME
  env: {
    NEXT_PUBLIC_CANONICAL_HOSTNAME:
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://authichain.com',
  },
};

module.exports = nextConfig;
