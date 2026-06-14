#!/usr/bin/env bash
# Locate a Vercel token locally without printing it. Prefix-only output.
set -u
cd /home/zac/authichain-unified
for f in .env .env.local .env.production .env.autonomous ~/.vercel/auth.json ~/.local/share/com.vercel.cli/auth.json; do
  if [ -f "$f" ]; then
    t=$(grep -oP '(?<=VERCEL_TOKEN=)\S+' "$f" 2>/dev/null | head -1)
    [ -z "$t" ] && t=$(grep -oP '(?<="token": ")[^"]+' "$f" 2>/dev/null | head -1)
    if [ -n "$t" ]; then
      echo "$f → token prefix ${t:0:6}… (len ${#t})"
    else
      echo "$f → exists, no token"
    fi
  fi
done
# also scan windows-side vercel CLI auth (Windows user rac)
for f in /mnt/c/Users/rac/AppData/Roaming/com.vercel.cli/Data/auth.json /mnt/c/Users/rac/.vercel/auth.json; do
  if [ -f "$f" ]; then
    t=$(grep -oP '(?<="token": ")[^"]+' "$f" 2>/dev/null | head -1)
    [ -n "$t" ] && echo "$f → token prefix ${t:0:6}… (len ${#t})" || echo "$f → exists, no token"
  fi
done
