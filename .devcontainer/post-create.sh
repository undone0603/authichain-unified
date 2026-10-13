#!/usr/bin/env bash
# Runs once after the Codespace is created (after updateContentCommand).
# Keep this thin — heavy install belongs in setup.sh / updateContentCommand.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> post-create"
if [ ! -d node_modules ]; then
  echo "node_modules missing; re-running setup.sh"
  bash .devcontainer/setup.sh
fi

# Never print or invent secrets. Codespaces secrets are injected by GitHub.
if [ -f .env.example ] && [ ! -f .env.local ] && [ ! -f .env ]; then
  echo "==> Tip: copy .env.example locally only when you need live keys (do not commit)."
fi

echo "==> Ready. Scope=${AUTHICHAIN_CODESPACE_SCOPE:-core}. Read .devcontainer/CONDENSING.md"
