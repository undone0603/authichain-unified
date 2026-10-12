#!/usr/bin/env bash
# Runs on every attach. Must stay silent and cheap.
set -euo pipefail

SCOPE="${AUTHICHAIN_CODESPACE_SCOPE:-core}"
echo "authichain-unified Codespace · scope=${SCOPE} · node $(node -v 2>/dev/null || echo '?') · see .devcontainer/CONDENSING.md"
