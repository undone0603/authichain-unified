/** @type {import('next').NextConfig} */
import { existsSync } from "node:fs";
import { join } from "node:path";

// Guard against a regression that once shipped a broken build to prod: a
// stray root-level app/ directory silently shadows src/app/ in `next build`
// (all other routes get dropped with no warning). Fail fast instead.
if (existsSync(join(process.cwd(), "app")) && existsSync(join(process.cwd(), "src", "app"))) {
  throw new Error(
    "Both app/ and src/app/ exist at the project root. Next.js silently " +
    "builds only the root app/ directory and drops every route under " +
    "src/app/ with no error. Remove the root app/ directory (merge any " +
    "needed files into src/app/ first)."
  );
}

// Sentry is optional: @sentry/nextjs is not a dependency yet (zero-budget),
// and `next build` must not fail when it's absent. If the SDK is installed
// later, the wrapper activates automatically.
let withSentryConfig = (config, _opts) => config;
try {
  ({ withSentryConfig } = await import("@sentry/nextjs"));
} catch {
  // SDK not installed — export the config unwrapped.
}

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
outputFileTracingRoot: process.cwd(),
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
  webpack: (config, { webpack }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };

    // @coinbase/cdp-sdk's x402 payment-signing path imports the @x402/* packages
    // (@x402/evm, @x402/svm/exact/client, ...). They are optional peers: none is
    // declared in package.json and none resolves in the lockfile, so webpack
    // fails the entire build with "Module not found: Can't resolve '@x402/evm'".
    // They arrive purely transitively — thirdweb → @base-org/account →
    // @coinbase/cdp-sdk — reached from the governance page and the NFT mint
    // route. Nothing in this app calls signX402Payment, so ignore the whole
    // scope; aliasing them one at a time just surfaces the next sibling.
    //
    // If the agent-payable verification work in
    // docs/superpowers/plans/2026-08-07-x402-agent-verification.md ends up
    // settling through cdp-sdk, install the real @x402/* packages and delete
    // this — at that point these imports must resolve for real.
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// })
    );

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
      process.env.APP_ORIGIN ?? 'https://authichain.com',
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

export default withSentryConfig(nextConfig, {
    org: "authichain",
    project: "javascript-nextjs",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
});
