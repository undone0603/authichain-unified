#!/usr/bin/env bash
set -euo pipefail

# Self-healing production build for authichain-unified.
# Handles known flakes: next/font/google 404s and heap OOM (exit 134).
# Matches CI behavior in .github/workflows/main.yml.

if [[ "${CLEAN_BUILD:-0}" == "1" ]]; then
  echo "[build] CLEAN_BUILD=1: removing node_modules and .next"
  rm -rf node_modules .next
  pnpm install --frozen-lockfile --prefer-offline
fi

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

attempt=1
max_attempts=3
while [[ $attempt -le $max_attempts ]]; do
  echo "[build] attempt $attempt/$max_attempts (NODE_OPTIONS=$NODE_OPTIONS)"
  if pnpm exec next build --webpack; then
    echo "[build] success on attempt $attempt"
    exit 0
  fi
  echo "[build] failed attempt $attempt; sleeping $((15 * attempt))s before retry"
  sleep $((15 * attempt))
  attempt=$((attempt + 1))
done

echo "[build] all $max_attempts attempts failed" >&2
echo '{"level":"error","msg":"pnpm build failed after retries","component":"build-wrapper","max_attempts":'"$max_attempts"'}' >&2
exit 1
