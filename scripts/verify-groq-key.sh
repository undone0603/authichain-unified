#!/usr/bin/env bash
# Read-only: is the Groq key hardcoded in the deployed qron-daily-ops bundle still live?
# Key is read at runtime from the skim copy, never embedded here.
set -e
SRC=~/cf-skim/qron-daily-ops.js
[ -f "$SRC" ] || { echo "skim copy not found at $SRC"; ls ~/cf-skim/ | head -40; exit 1; }
KEY=$(grep -oP 'gsk_[A-Za-z0-9]+' "$SRC" | head -1)
[ -n "$KEY" ] || { echo "no gsk_ key found in bundle"; exit 1; }
echo "key found: ${KEY:0:8}…${KEY: -4} (length ${#KEY})"
code=$(curl -s -o /tmp/groq-check.json -m 20 -w "%{http_code}" \
  -H "Authorization: Bearer $KEY" https://api.groq.com/openai/v1/models)
echo "GET /v1/models -> HTTP $code"
head -c 300 /tmp/groq-check.json
echo