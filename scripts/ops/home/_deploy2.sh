#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"

SRC="/mnt/c/Users/rac/AppData/Roaming/com.vercel.cli/Data"
mkdir -p "$HOME/.config/com.vercel.cli"
cp "$SRC/auth.json"   "$HOME/.config/com.vercel.cli/auth.json"   && echo "auth.json copied"
cp "$SRC/config.json" "$HOME/.config/com.vercel.cli/config.json" && echo "config.json copied"

cd /home/zac/authichain-unified || exit 2
# Link: bring the project link from the Windows copy if WSL copy is unlinked
if [ ! -f .vercel/project.json ]; then
  mkdir -p .vercel
  cp /mnt/c/Users/rac/authichain-unified/.vercel/project.json .vercel/project.json && echo "project.json linked from Windows copy"
fi
echo "=== whoami ==="
npx --yes vercel@latest whoami 2>&1 | tail -2
echo "=== deploy (PREVIEW) ==="
npx --yes vercel@latest deploy --yes 2>&1 | tail -45
echo "=== DEPLOY_EXIT=${PIPESTATUS[0]} ==="
