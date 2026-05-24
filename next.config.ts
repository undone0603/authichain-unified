import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  
  // eslint config handled via .eslintrc.json
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  serverExternalPackages: ['pino', 'pino-pretty', '@walletconnect/sign-client'],
  
  webpack: (config: { resolve: { fallback: Record<string, boolean> } }) => {
    config.resolve.fallback = { ...config.resolve.fallback, pino: false };
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
    unoptimized: false,
  },
  
  experimental: {
    serverActions: { allowedOrigins: ['qron.space', 'www.qron.space'] },
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