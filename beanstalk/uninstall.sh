#!/usr/bin/env sh
# Reversible uninstall for Beanstalk hook.
set -eu
ROOT=$(git rev-parse --show-toplevel)
for TARGET in "$ROOT/.git/hooks/reference-transaction" "$ROOT/.husky/reference-transaction" "$ROOT/.githooks/reference-transaction"; do
  if [ -f "$TARGET" ] || [ -L "$TARGET" ]; then
    if grep -q "Beanstalk" "$TARGET" 2>/dev/null || [ -L "$TARGET" ]; then
      rm -f "$TARGET"
      echo "Removed $TARGET"
    fi
  fi
done
echo "Beanstalk hook uninstalled (config beanstalk.protectedRefs left intact)."
echo "To clear config: git config --unset-all beanstalk.protectedRefs"
