#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"

SRC="/mnt/c/Users/rac/AppData/Roaming/com.vercel.cli/Data"
GC="$HOME/.local/share/com.vercel.cli"
mkdir -p "$GC"
cp "$SRC/auth.json"   "$GC/auth.json"   && echo "auth.json copied to XDG data"
cp "$SRC/config.json" "$GC/config.json" && echo "config.json copied to XDG data"

cd "$(dirname "$0")/.." || exit 2
echo "=== whoami (explicit --global-config) ==="
npx --yes vercel@latest whoami --global-config "$GC" 2>&1 | tail -2
echo "=== deploy (PREVIEW) ==="
npx --yes vercel@latest deploy --yes --global-config "$GC" 2>&1 | tail -45
echo "=== DEPLOY_EXIT=${PIPESTATUS[0]} ==="
