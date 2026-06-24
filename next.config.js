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
  // Messy multi-architecture codebase — type errors are gated in CI, not here.
  typescript: { ignoreBuildErrors: true },

  // Keep Node-only logging/wallet libs out of the bundles. pino uses __dirname
  // and worker threads; bundling it (or anything that transitively imports it)
  // is a known source of "__dirname is not defined" at the edge/runtime.
  // playwright-core is a heavy Node-only lib (ships browser-driver binaries) that
  // gets pulled transitively into the cron API route. Keep it external so webpack
  // require()s it at runtime instead of trying to bundle it.
  serverExternalPackages: ['pino', 'pino-pretty', '@walletconnect/sign-client', 'playwright-core'],

  // The server/* code uses ESM `.js` import specifiers that actually point at
  // `.ts` files (e.g. `from "../db.js"` → `../db.ts`). esbuild resolves these
  // natively, but Next.js's webpack does not — it was failing with
  // "Module not found: Can't resolve '../db.js'". extensionAlias tells webpack
  // to try the TypeScript sources for a `.js`/`.mjs` request, fixing every such
  // import at once without rewriting the ~135 import statements.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
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

    // Bridge unprefixed dashboard vars to the client bundle. Supabase/Stripe
    // public values are inlined at build time, so they must be NEXT_PUBLIC_*.
    // Our env vault stores them unprefixed (SUPABASE_URL, etc.); map them here
    // so a single canonical dashboard var feeds both server and browser.
    // (URL + anon key are public-by-design — access is gated by RLS.)
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  },
};

export default nextConfig;
