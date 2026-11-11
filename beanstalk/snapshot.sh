#!/usr/bin/env sh
# Beanstalk snapshot utility.
# Creates an immutable-by-convention snapshot of a Git revision.
# Prefers reflink (cp --reflink=always) when supported; falls back to ordinary copy.
# Strict mode fails if reflink unavailable.
#
# Usage: snapshot.sh <revision> <dest-dir> [--strict-reflink]
# Excludes: credentials, .env*, untracked (by default), ignored.
# Includes: tracked content at the revision.
# Manifest records commit, format version, copy mode, content hash.

set -eu

REV="${1:?revision required}"
DEST="${2:?destination directory required}"
STRICT=0
if [ "${3:-}" = "--strict-reflink" ]; then
  STRICT=1
fi

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

COMMIT=$(git rev-parse --verify "$REV")
FORMAT_VERSION="1"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Extract tracked tree (excludes untracked, ignored, .git)
git archive --format=tar "$COMMIT" | tar -x -C "$TMP"

# Optional: detect and exclude common credential patterns (best-effort)
find "$TMP" -type f \( -name ".env*" -o -name "*credentials*" -o -name "*secret*" \) -delete 2>/dev/null || true

# Determine copy mode
COPY_MODE="ordinary"
if cp --reflink=always "$TMP" "$DEST.try" 2>/dev/null; then
  COPY_MODE="reflink"
  rm -rf "$DEST.try"
else
  if [ "$STRICT" = "1" ]; then
    echo "beanstalk: strict reflink required but filesystem does not support it" >&2
    exit 1
  fi
fi

# Final copy
mkdir -p "$DEST"
if [ "$COPY_MODE" = "reflink" ]; then
  cp -a --reflink=always "$TMP/." "$DEST/"
else
  cp -a "$TMP/." "$DEST/"
fi

# Content hash (sha256 of sorted file list + contents; simple)
CONTENT_HASH=$(find "$DEST" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')

MANIFEST="$DEST/.beanstalk-manifest.json"
cat > "$MANIFEST" <<EOF
{
  "format_version": "$FORMAT_VERSION",
  "commit": "$COMMIT",
  "revision": "$REV",
  "copy_mode": "$COPY_MODE",
  "content_hash": "$CONTENT_HASH",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "excludes": ["untracked", "ignored", ".env*", "credentials", "LFS (unless in tree)"],
  "includes": ["tracked files at revision"]
}
EOF

echo "Snapshot of $COMMIT written to $DEST (mode=$COPY_MODE, hash=$CONTENT_HASH)"
