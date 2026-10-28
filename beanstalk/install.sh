#!/usr/bin/env sh
# Beanstalk install: idempotent, reversible, preserves existing Husky hooks.
# Sets up reference-transaction hook without silently replacing other hooks.
# Explicit command: ./beanstalk/install.sh
# Status: ./beanstalk/status.sh
# Uninstall: ./beanstalk/uninstall.sh

set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_SRC="$REPO_ROOT/beanstalk/hooks/reference-transaction"
HUSKY_DIR="$REPO_ROOT/.husky"
TARGET="$HUSKY_DIR/reference-transaction"

if [ ! -f "$HOOK_SRC" ]; then
  echo "error: hook source missing at $HOOK_SRC" >&2
  exit 1
fi

# Prefer Husky if present (this repo uses it)
if [ -d "$HUSKY_DIR" ]; then
  if [ -L "$TARGET" ] || [ -f "$TARGET" ]; then
    if [ "$(readlink -f "$TARGET" 2>/dev/null || echo "$TARGET")" = "$HOOK_SRC" ] || cmp -s "$TARGET" "$HOOK_SRC" 2>/dev/null; then
      echo "already installed (Husky path)"
      exit 0
    fi
    echo "error: $TARGET exists and differs; refusing to overwrite" >&2
    echo "  tip: remove it manually or use a different hooksPath" >&2
    exit 1
  fi
  ln -s "../../beanstalk/hooks/reference-transaction" "$TARGET"
  chmod +x "$TARGET"
  echo "installed reference-transaction hook into .husky/ (Husky core.hooksPath)"
  exit 0
fi

# Fallback: custom hooksPath (does not change global config)
CUSTOM_HOOKS="$REPO_ROOT/.githooks"
mkdir -p "$CUSTOM_HOOKS"
TARGET="$CUSTOM_HOOKS/reference-transaction"
if [ -f "$TARGET" ] && ! cmp -s "$TARGET" "$HOOK_SRC"; then
  echo "error: $TARGET exists and differs" >&2
  exit 1
fi
cp "$HOOK_SRC" "$TARGET"
chmod +x "$TARGET"
# Note: user must set core.hooksPath=.githooks explicitly; we do not change git config
echo "copied hook to .githooks/reference-transaction"
echo "manual step required: git config core.hooksPath .githooks"
echo "  (or use Husky; this repo prefers .husky)"
