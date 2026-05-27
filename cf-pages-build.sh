#!/bin/bash
# Cloudflare Pages build script
# Set this as the build command in Cloudflare Pages dashboard:
#   Build command: bash cf-pages-build.sh
#   Build output directory: .vercel/output/static
#   Node version: 20

set -e

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Building Next.js app with next-on-pages..."
npm run build
npx @cloudflare/next-on-pages

echo "Build complete. Output in .vercel/output/static"
