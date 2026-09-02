#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
# strip Windows paths so Windows node/pnpm shims never shadow the Linux ones
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd "$(dirname "$0")/.." || exit 2
echo "=== node:$(node -v) pnpm:$(pnpm -v) cwd:$(pwd) ==="
echo "=== pnpm install (reconciling to linux binaries) ==="
pnpm install 2>&1 | tail -25
echo "=== EXIT_INSTALL=$? ==="
echo "=== tsc --noEmit (typecheck) ==="
pnpm run check 2>&1 | tail -40
echo "=== EXIT_CHECK=$? ==="
echo "=== pnpm build ==="
pnpm build 2>&1 | tail -50
echo "=== EXIT_BUILD=$? ==="
