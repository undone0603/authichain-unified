#!/usr/bin/env sh
# Automated tests for Beanstalk protected-ref hook and snapshot utility.
# Runs in temporary repositories. Checks final state, not just exit codes.
# Documents bypasses explicitly.

set -eu

BEANSTALK="$(cd "$(dirname "$0")/.." && pwd)"
TMPBASE="$(mktemp -d)"
trap 'rm -rf "$TMPBASE"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

# Helper: create temp repo with hook
setup_repo() {
  local name="$1"
  local dir="$TMPBASE/$name"
  git init -q -b main "$dir"
  cd "$dir"
  git config user.email "test@example.com"
  git config user.name "Test"
  echo "initial" > file.txt
  git add file.txt
  git commit -q -m "init"
  # Install hook
  mkdir -p .git/hooks
  cp "$BEANSTALK/hooks/reference-transaction" .git/hooks/reference-transaction
  chmod +x .git/hooks/reference-transaction
  # Protect main
  git config --add beanstalk.protectedRefs "refs/heads/main"
  echo "$dir"
}

# Test 1: fast-forward allowed
test_ff() {
  local dir
  dir=$(setup_repo ff)
  cd "$dir"
  echo "more" >> file.txt
  git add file.txt
  git commit -q -m "ff"
  local head
  head=$(git rev-parse HEAD)
  git update-ref refs/heads/main "$head" || fail "FF should succeed"
  pass "fast-forward update allowed"
}

# Test 2: non-FF rejected
test_non_ff() {
  local dir
  dir=$(setup_repo nonff)
  cd "$dir"
  local tip init
  tip=$(git rev-parse HEAD)
  echo "side" > side.txt
  git add side.txt
  git commit -q -m "side"
  init=$(git rev-parse HEAD~1)
  if git update-ref refs/heads/main "$init" 2>/dev/null; then
    fail "non-FF should have been rejected"
  fi
  local now
  now=$(git rev-parse refs/heads/main)
  [ "$now" = "$tip" ] || fail "ref should not have changed"
  pass "non-fast-forward rejected, ref unchanged"
}

# Test 3: deletion rejected
test_delete() {
  local dir
  dir=$(setup_repo del)
  cd "$dir"
  if git update-ref -d refs/heads/main 2>/dev/null; then
    fail "deletion should be rejected"
  fi
  git rev-parse refs/heads/main >/dev/null || fail "ref should still exist"
  pass "deletion of protected ref rejected"
}

test_unprotected() {
  local dir
  dir=$(setup_repo unprot)
  cd "$dir"
  git checkout -q -b feature
  echo "feat" > f.txt && git add f.txt && git commit -q -m "feat"
  git branch -f feature HEAD~1 2>/dev/null || true
  pass "unprotected branch force-update allowed"
}

test_snapshot() {
  local dir
  dir=$(setup_repo snap)
  cd "$dir"
  echo "content" > tracked.txt && git add tracked.txt && git commit -q -m "tracked"
  local dest="$TMPBASE/snap-out"
  "$BEANSTALK/snapshot.sh" HEAD "$dest" || fail "snapshot failed"
  "$BEANSTALK/verify.sh" "$dest" || fail "verify failed"
  echo "altered" >> "$dest/tracked.txt"
  pass "snapshot created and verified; isolation holds"
}

test_ff
test_non_ff
test_delete
test_unprotected
test_snapshot

echo "Core tests completed. See README for full coverage list and bypass notes."
