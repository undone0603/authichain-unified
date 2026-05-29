import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  
  // eslint config handled via .eslintrc.json
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  serverExternalPackages: [
    'pino', 'pino-pretty', '@walletconnect/sign-client', 'jsqr', 'jimp', 'thirdweb', 'viem',
    // CF Workers bundle: packages whose edge-light builds have missing sub-deps
    '@emotion/styled', '@emotion/react', '@emotion/cache', '@emotion/utils',
    '@emotion/use-insertion-effect-with-fallbacks', '@emotion/serialize', '@emotion/hash',
    'isows',
    '@coinbase/cdp-sdk', 'uncrypto',
  ],

  webpack: (config: { resolve: { fallback: Record<string, boolean>; alias: Record<string, unknown> } }) => {
    const stub = path.resolve(__dirname, 'src/stubs/empty.js');
    config.resolve.fallback = { ...config.resolve.fallback, pino: false, 'pino-pretty': false, jimp: false, net: false, tls: false, crypto: false };
    // Stub packages that cannot run on CF Workers so esbuild never sees require() calls for them.
    // resolve.alias: false is ineffective for server-side webpack; pointing to a real stub file works.
    config.resolve.alias = {
      ...config.resolve.alias,
      ioredis: stub,
      redis: stub,
      'playwright-core': stub,
      'chromium-bidi': stub,
      // Stripe: ~1.9 MB JS-only. Webhook + billing routes return 500 when stubbed; everything else is unaffected.
      stripe: stub,
      // Vercel AI SDK: ~10 MB combined. /api/chat returns 500; all other routes unaffected.
      ai: stub,
      '@ai-sdk/openai': stub,
      // MCP SDK: ~4 MB. /api/mcp returns 500; all other routes unaffected.
      '@modelcontextprotocol/sdk': stub,
      // Blockchain: anchoring routes return 500; QR/auth/payments unaffected.
      ethers: stub,
      // QR code generation: /api/generate returns 500; scan/verify routes unaffected.
      qrcode: stub,
      // Email transports: welcome/trial emails fail; core app unaffected.
      nodemailer: stub,
      resend: stub,
      // postgres-js uses dns.resolve() which is not available in CF Workers. /api/telemetry returns 500.
      postgres: stub,
    };
    return config;
  },
  
  allowedDevOrigins: [
    'govchain.us',
    'www.govchain.us',
    'strainchain.io',
    'www.strainchain.io',
    'authichain.com',
    'www.authichain.com',
    'qron.space',
    'www.qron.space',
  ],
  
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    unoptimized: true,
  },
  
  experimental: {
    serverActions: {
      allowedOrigins: [
        'qron.space', 'www.qron.space',
        'authichain.com', 'www.authichain.com',
        'strainchain.io', 'www.strainchain.io',
        'govchain.us', 'www.govchain.us',
      ],
    },
  },
  
  turbopack: {},
};

// Optionally wrap with PWA if available
let exportedConfig: NextConfig = nextConfig;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withPWAInit = require('next-pwa');
  const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
  });
  exportedConfig = withPWA(nextConfig);
} catch {
  // next-pwa not available or incompatible, skip PWA
}

export default exportedConfig;