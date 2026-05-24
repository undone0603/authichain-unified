#!/bin/bash
# Cloudflare Pages build script
# Set this as the build command in Cloudflare Pages dashboard:
#   Build command: bash cf-pages-build.sh
#   Build output directory: .next
#   Node version: 20

set -e

echo "Installing dependencies..."
npm ci

echo "Building Next.js app..."
npm run build

echo "Build complete. Output in .next/"
