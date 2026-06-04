// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      // Unsplash — high-quality stock images (free, no API key)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      // Plus.unsplash CDN
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
        pathname: '/**',
      },
      // IPFS / web3.storage for NFT metadata images
      {
        protocol: 'https',
        hostname: 'w3s.link',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.dweb.link',
        pathname: '/**',
      },
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
      // Redirect bare /gov to govchain.us
      {
        source:      '/gov',
        destination: process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us',
        permanent:   false,
      },
    ];
  },
};

module.exports = nextConfig;
