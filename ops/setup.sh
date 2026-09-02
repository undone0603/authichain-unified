#!/usr/bin/env bash
set -e

echo "=== AuthiChain Unified Setup ==="
cd "$(dirname "$0")/.."

# 1. Validate Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed."
  exit 1
fi
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "Error: Node.js version 22+ is required. Found: $NODE_VERSION"
  exit 1
fi

# 2. Validate pnpm
if ! command -v pnpm &> /dev/null; then
  echo "Error: pnpm is not installed."
  exit 1
fi

# 3. Validate Wrangler
if ! command -v npx wrangler &> /dev/null; then
    echo "Warning: Wrangler CLI not found. Deployment tasks will fail."
fi

# 4. Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# 5. Environment check
if [ ! -f ".env" ]; then
  echo "Warning: .env file not found. Copying from .env.example if available."
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created .env from .env.example. PLEASE UPDATE IT WITH YOUR SECRETS."
  fi
fi

# 6. Initialize Husky (pre-commit hooks)
echo "Initializing git hooks..."
npx husky install

echo "=== Setup complete! ==="
