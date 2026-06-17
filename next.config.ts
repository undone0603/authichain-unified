import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Root tsconfig now maps @/* -> ./src/* and type-checks src/**, so `next build`
  // resolves and type-checks the Next app correctly. Strict build type-checking
  // is on (the dead Vite app at client/src has been retired from the type gate).
  typescript: { ignoreBuildErrors: false },
  
  // eslint config handled via .eslintrc.json
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  serverExternalPackages: ['drizzle-orm', 'postgres'],

  webpack: (config: { resolve: { fallback: Record<string, boolean>; alias: Record<string, unknown> }; plugins: unknown[] }, { isServer, webpack }: { isServer: boolean; webpack: { DefinePlugin: new (defs: Record<string, string>) => unknown } }) => {
    const stub = path.resolve(__dirname, 'src/stubs/empty.js');
    const cfCompatStub = path.resolve(__dirname, 'src/stubs/cf-compat.mjs');
    config.resolve.fallback = { ...config.resolve.fallback, net: false, tls: false, crypto: false };
    // Some Vite-era modules (client/src) read `import.meta.env.VITE_*`. In the Next
    // build `import.meta.env` is undefined, which throws during prerender. Replace it
    // with an empty object so those accesses yield undefined instead of crashing.
    config.plugins = config.plugins || [];
    config.plugins.push(new webpack.DefinePlugin({ 'import.meta.env': '({})' }));
    // Server modules use TS ESM-style `.js` import specifiers (e.g. '../_core/llm.js').
    // tsc/tsx map those to .ts; webpack needs extensionAlias to do the same.
    (config.resolve as { extensionAlias?: Record<string, string[]> }).extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    // Stub packages that cannot run on CF Workers so esbuild never sees require() calls for them.
    // Packages with ESM named/default imports need cf-compat.mjs (proper export declarations);
    // plain CJS-only packages can use empty.js.
    config.resolve.alias = {
      ...config.resolve.alias,
      // The Next.js app lives in src/, but the root tsconfig maps @/* to the
      // Vite app (client/src). Scope the @/ alias to src/ for the Next build so
      // src/app imports resolve, without disturbing the Vite client. Only @/…
      // is affected; scoped npm packages like @ai-sdk/openai are not.
      // Exact aliases for modules that exist in BOTH client/src (Vite) and src
      // (Next). Without these, Next's tsconfig-paths resolver (@/* -> client/src)
      // wins for the colliding paths and pulls Vite code (import.meta.env) into
      // the Workers build. Exact webpack aliases take precedence and force src.
      '@/lib/thirdweb': path.resolve(__dirname, 'src/lib/thirdweb'),
      '@/lib/trpc': path.resolve(__dirname, 'src/lib/trpc'),
      '@/components/APIKeyManager': path.resolve(__dirname, 'src/components/APIKeyManager'),
      '@/components/LeadCapturePopup': path.resolve(__dirname, 'src/components/LeadCapturePopup'),
      '@/components/ReferralTracker': path.resolve(__dirname, 'src/components/ReferralTracker'),
      '@/components/SocialShareCTA': path.resolve(__dirname, 'src/components/SocialShareCTA'),
      '@/components/TagManager': path.resolve(__dirname, 'src/components/TagManager'),
      '@/components/WebhookManager': path.resolve(__dirname, 'src/components/WebhookManager'),
      '@': path.resolve(__dirname, 'src'),
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
      // image/QR packages: not needed at CF Workers runtime
      jsqr:                      cfCompatStub,
      jimp:                      stub,
      // logging: no-op on CF Workers (use console.log instead)
      pino:                      stub,
      'pino-pretty':             stub,
      // NOTE: @emotion/* intentionally NOT stubbed universally — thirdweb uses emotion
      // on the client and it's browser-compatible. Server never sees it since
      // thirdweb/react is stubbed server-only in the isServer block below.
      // postgres-js uses dns.resolve() — needs callable stub so drizzle can init
      postgres: path.resolve(__dirname, 'src/stubs/postgres-stub.mjs'),
      // drizzle postgres-js adapter accesses client internals at init time; stub the whole adapter
      'drizzle-orm/postgres-js': cfCompatStub,
    };
    if (isServer) {
      // Thirdweb and viem run module-scope init that crashes CF Workers — stub server only.
      // Client bundle gets the real packages so ConnectButton/useActiveAccount work in browser.
      Object.assign(config.resolve.alias, {
        'thirdweb$':               cfCompatStub,
        'thirdweb/chains':         cfCompatStub,
        'thirdweb/react':          cfCompatStub,
        'thirdweb/wallets':        cfCompatStub,
        'thirdweb/extensions/erc721': cfCompatStub,
        'thirdweb/extensions/erc20': cfCompatStub,
        viem:                      cfCompatStub,
        // viem is aliased to a single stub file, so its subpaths must be stubbed too
        'viem/chains':             cfCompatStub,
        'viem/utils':              cfCompatStub,
        'viem/accounts':           cfCompatStub,
        '@walletconnect/sign-client': stub,
        isows:                     stub,
        '@coinbase/cdp-sdk':       cfCompatStub,
        uncrypto:                  stub,
      });
    }
    return config;
  },
  
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
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