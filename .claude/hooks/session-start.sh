#!/bin/bash
# SessionStart hook: puts the Wrangler CLI on PATH in Claude Code on the web.
# Installs only wrangler (globally), not the whole workspace -- a full
# `pnpm install` here takes 10+ minutes. The version is the one the root
# importer resolves in pnpm-lock.yaml, so the session matches `pnpm exec wrangler`.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

version=$(awk '
  /^importers:/ { in_imp = 1; next }
  in_imp && /^  \.:$/ { in_root = 1; next }
  in_root && /^  [^ ]/ { exit }
  in_root && /^      wrangler:$/ { found = 1; next }
  found && /^        version:/ { sub(/^ *version: */, ""); sub(/\(.*/, ""); print; exit }
' pnpm-lock.yaml)
version=${version:-4}

if command -v wrangler >/dev/null 2>&1 && [ "$(wrangler --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" = "$version" ]; then
  echo "wrangler $version already installed"
  exit 0
fi

npm install --global --no-fund --no-audit "wrangler@$version"
wrangler --version
