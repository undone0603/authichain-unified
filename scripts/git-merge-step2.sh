#!/usr/bin/env bash
# Merge now blocks on contracts/AuthiChainNFT.sol (origin/main has "Update AuthiChainNFT.sol").
# Inspect: is the local mod CRLF-only, or a real local edit we must preserve?
set -u
cd /home/zac/authichain-unified

F=contracts/AuthiChainNFT.sol
echo "=== real (non-CRLF) diff: worktree vs HEAD ==="
git diff --ignore-cr-at-eol -- "$F" | head -60
echo "---(end, stat)---"
git diff --stat --ignore-cr-at-eol -- "$F"

echo
echo "=== what origin/main does to this file vs HEAD ==="
git diff --stat --ignore-cr-at-eol HEAD origin/main -- "$F"
git diff --ignore-cr-at-eol HEAD origin/main -- "$F" | head -80
