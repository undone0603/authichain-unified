#!/usr/bin/env bash
# Condensed Codespaces install for authichain-unified.
# Scope via AUTHICHAIN_CODESPACE_SCOPE=core|workers|full (default: core).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCOPE="${AUTHICHAIN_CODESPACE_SCOPE:-core}"
export HUSKY="${HUSKY:-0}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-1}"
export PUPPETEER_SKIP_DOWNLOAD="${PUPPETEER_SKIP_DOWNLOAD:-1}"

echo "==> authichain Codespaces setup (scope=${SCOPE})"

core_node() {
  local want
  want="$(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo 22)"
  echo "==> Node $(node -v) (want >=${want})"
}

enable_pnpm() {
  # Devcontainer image may ship npm; pin to packageManager field.
  corepack enable
  corepack prepare pnpm@10.28.2 --activate
  pnpm -v
}

install_deps() {
  case "$SCOPE" in
    core)
      # Full lockfile resolve is required for a consistent workspace, but skip
      # browser binaries and husky. Do not build the Next app or Playwright.
      echo "==> pnpm install (frozen, no browser binaries)"
      pnpm install --frozen-lockfile
      ;;
    workers)
      echo "==> pnpm install (frozen) + wrangler smoke"
      pnpm install --frozen-lockfile
      pnpm exec wrangler --version
      ;;
    full)
      echo "==> pnpm install (frozen, full scope — browsers still skipped unless you unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD)"
      pnpm install --frozen-lockfile
      ;;
    *)
      echo "Unknown AUTHICHAIN_CODESPACE_SCOPE=${SCOPE} (use core|workers|full)" >&2
      exit 1
      ;;
  esac
}

core_node
enable_pnpm
install_deps

echo "==> setup done (scope=${SCOPE}). See .devcontainer/CONDENSING.md"
