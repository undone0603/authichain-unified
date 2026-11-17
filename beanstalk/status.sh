#!/usr/bin/env sh
# Diagnostic status for Beanstalk.
set -eu
ROOT=$(git rev-parse --show-toplevel)
echo "Beanstalk status in $ROOT"
echo "Protected refs:"
git config --get-all beanstalk.protectedRefs 2>/dev/null || echo "  (none configured \u2014 opt-in)"
echo ""
echo "Hook locations:"
for p in "$ROOT/.git/hooks/reference-transaction" "$ROOT/.husky/reference-transaction" "$ROOT/.githooks/reference-transaction"; do
  if [ -e "$p" ]; then
    echo "  $p : present"
  else
    echo "  $p : absent"
  fi
done
echo ""
echo "core.hooksPath: $(git config --get core.hooksPath || echo none)"
echo "Git version: $(git --version)"
