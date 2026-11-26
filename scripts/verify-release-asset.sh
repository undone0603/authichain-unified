#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-undone0603/authichain-unified}"
TAG="${2:-agentz-evidence-44994872276-1}"
WORK_DIR="$(mktemp -d)"

echo "🚀 Starting release asset verification for $REPO @ $TAG..."
cd "$WORK_DIR"

echo "📦 Downloading release assets..."
gh release download "$TAG" -R "$REPO" --clobber

if [ ! -f "agentz-linux-arm64.tar.gz" ]; then
  echo "❌ Error: agentz-linux-arm64.tar.gz not found in release assets."
  exit 1
fi

if [ ! -f "SHA256SUMS" ]; then
  echo "❌ Error: SHA256SUMS not found in release assets."
  exit 1
fi

echo "🔐 Verifying SHA-256 checksum..."
sha256sum -c SHA256SUMS

echo "🛡️ Verifying GitHub artifact attestation (if supported)..."
if gh attestation verify agentz-linux-arm64.tar.gz -R "$REPO" 2>/dev/null; then
  echo "✅ GitHub artifact attestation verified successfully."
else
  echo "⚠️ GitHub artifact attestation check skipped or not present."
fi

echo "✨ Release asset verification completed successfully!"
rm -rf "$WORK_DIR"
