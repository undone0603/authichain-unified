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
    // @emotion packages: CSS-in-JS, safe on CF Workers; kept external to avoid webpack ESM issues
    '@emotion/styled', '@emotion/react', '@emotion/cache', '@emotion/utils',
    '@emotion/use-insertion-effect-with-fallbacks', '@emotion/serialize', '@emotion/hash',
  ],

  webpack: (config: { resolve: { fallback: Record<string, boolean>; alias: Record<string, unknown> } }) => {
    const stub = path.resolve(__dirname, 'src/stubs/empty.js');
    const cfCompatStub = path.resolve(__dirname, 'src/stubs/cf-compat.mjs');
    config.resolve.fallback = { ...config.resolve.fallback, net: false, tls: false, crypto: false };
    // Stub packages that cannot run on CF Workers so esbuild never sees require() calls for them.
    // Packages with ESM named/default imports need cf-compat.mjs (proper export declarations);
    // plain CJS-only packages can use empty.js.
    config.resolve.alias = {
      ...config.resolve.alias,
      ioredis: stub,
      redis: stub,
      'playwright-core': stub,
      'chromium-bidi': stub,
      // ESM-imported packages — need cf-compat.mjs for webpack 5 static analysis
      stripe:                    cfCompatStub,
      ai:                        cfCompatStub,
      '@ai-sdk/openai':          cfCompatStub,
      '@modelcontextprotocol/sdk': cfCompatStub,
      ethers:                    cfCompatStub,
      qrcode:                    cfCompatStub,
      nodemailer:                cfCompatStub,
      resend:                    cfCompatStub,
      // thirdweb: runs module-scope init code that crashes CF Workers at startup
      // Use $ suffix for exact match so subpath imports aren't eaten by the parent alias
      'thirdweb$':               cfCompatStub,
      'thirdweb/chains':         cfCompatStub,
      'thirdweb/react':          cfCompatStub,
      'thirdweb/wallets':        cfCompatStub,
      'thirdweb/extensions/erc721': cfCompatStub,
      // transitive deps of thirdweb/wagmi that use dns.resolve() or browser-only APIs
      viem:                      cfCompatStub,
      '@walletconnect/sign-client': stub,
      isows:                     stub,
      '@coinbase/cdp-sdk':       cfCompatStub,
      uncrypto:                  stub,
      // image/QR packages: not needed at CF Workers runtime
      jsqr:                      cfCompatStub,
      jimp:                      stub,
      // logging: no-op on CF Workers (use console.log instead)
      pino:                      stub,
      'pino-pretty':             stub,
      // postgres-js uses dns.resolve() — needs callable stub so drizzle can init
      postgres: path.resolve(__dirname, 'src/stubs/postgres-stub.mjs'),
      // drizzle postgres-js adapter accesses client internals at init time; stub the whole adapter
      'drizzle-orm/postgres-js': cfCompatStub,
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