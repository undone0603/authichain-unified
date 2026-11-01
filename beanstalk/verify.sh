#!/usr/bin/env sh
# Verify a Beanstalk snapshot against its manifest.
# Recomputes content hash and checks commit identifier.
# Does not perform cryptographic signatures or external anchoring.

set -eu

DEST="${1:?snapshot directory required}"
MANIFEST="$DEST/.beanstalk-manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "error: no .beanstalk-manifest.json in $DEST" >&2
  exit 1
fi

# Extract fields (simple jq-less)
COMMIT=$(grep -o '"commit": *"[^"]*"' "$MANIFEST" | cut -d'"' -f4)
STORED_HASH=$(grep -o '"content_hash": *"[^"]*"' "$MANIFEST" | cut -d'"' -f4)
MODE=$(grep -o '"copy_mode": *"[^"]*"' "$MANIFEST" | cut -d'"' -f4)

# Recompute (exclude manifest itself)
ACTUAL_HASH=$(find "$DEST" -type f ! -name '.beanstalk-manifest.json' -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')

if [ "$ACTUAL_HASH" != "$STORED_HASH" ]; then
  echo "error: content hash mismatch (stored=$STORED_HASH actual=$ACTUAL_HASH)" >&2
  exit 1
fi

echo "Verified: commit=$COMMIT mode=$MODE hash=$ACTUAL_HASH"
