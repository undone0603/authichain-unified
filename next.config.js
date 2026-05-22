// next.config.js
/** @type {import('next').NextConfig} */

// A production-safe CSP that:
//   - Allows 'unsafe-eval' for bundled JS (Vite/Rollup source maps, WalletConnect, etc.)
//   - Keeps everything else locked down
//   - Allows inline styles for CSS-in-JS / Tailwind
const CSP = [
  "default-src 'self'",
  // unsafe-eval needed for Vite/Rollup bundles, WalletConnect, and similar libs
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://w3s.link https://*.ipfs.dweb.link",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.alchemy.com https://polygon-mainnet.g.alchemy.com https://api.stripe.com https://cloudflare-eth.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {
  serverExternalPackages: [],

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
          { key: 'Content-Security-Policy',   value: CSP },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
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

  env: {
    NEXT_PUBLIC_CANONICAL_HOSTNAME:
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://authichain.com',
    // Build-time fallbacks: Turbopack inlines module-level instantiations,
    // so these secrets need a non-empty value at build time to prevent
    // constructor throws. At runtime, the real env vars take over.
    STRIPE_SECRET_KEY:        process.env.STRIPE_SECRET_KEY        ?? 'sk_test_build_placeholder',
    OPENAI_API_KEY:           process.env.OPENAI_API_KEY           ?? 'build_placeholder',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'build_placeholder',
  },
};

export default nextConfig;
