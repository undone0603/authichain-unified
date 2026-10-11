/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly ignore typescript errors during rapid local development
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ensure the UI compiles smoothly
  reactStrictMode: true,
};
export default nextConfig;
