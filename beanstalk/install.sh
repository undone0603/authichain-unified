#!/usr/bin/env sh
# Beanstalk install: idempotent, reversible, preserves existing Husky hooks.
set -eu
REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_SRC="$REPO_ROOT/beanstalk/hooks/reference-transaction"
HUSKY_DIR="$REPO_ROOT/.husky"
TARGET="$HUSKY_DIR/reference-transaction"
if [ ! -f "$HOOK_SRC" ]; then echo "error: hook source missing"; exit 1; fi
if [ -d "$HUSKY_DIR" ]; then
  if [ -e "$TARGET" ]; then
    if cmp -s "$TARGET" "$HOOK_SRC" 2>/dev/null || [ "$(readlink "$TARGET" 2>/dev/null)" = "../../beanstalk/hooks/reference-transaction" ]; then
      echo "already installed"; exit 0
    fi
    echo "error: target exists and differs; refusing to overwrite"; exit 1
  fi
  ln -s "../../beanstalk/hooks/reference-transaction" "$TARGET"
  chmod +x "$TARGET" 2>/dev/null || true
  echo "installed into .husky/"
  exit 0
fi
# fallback
mkdir -p "$REPO_ROOT/.githooks"
cp "$HOOK_SRC" "$REPO_ROOT/.githooks/reference-transaction"
chmod +x "$REPO_ROOT/.githooks/reference-transaction"
echo "copied to .githooks/; set core.hooksPath=.githooks manually if desired"
