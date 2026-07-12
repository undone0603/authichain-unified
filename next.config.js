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

import { withSentryConfig } from "@sentry/nextjs";

// ... (existing CSP and other config)
const nextConfig = {
    // ...
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
