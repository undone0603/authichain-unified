#!/usr/bin/env bash
# Reject paths that Windows NTFS cannot checkout (colon, ADS sidecars, reserved names).
# Usage:
#   scripts/check-windows-paths.sh           # whole index
#   scripts/check-windows-paths.sh --staged  # staged files only
set -euo pipefail

if [[ "${1:-}" == "--staged" ]]; then
  mapfile -t PATHS < <(git diff --cached --name-only --diff-filter=ACMR)
else
  mapfile -t PATHS < <(git ls-files)
fi

bad=0
for p in "${PATHS[@]:-}"; do
  [[ -z "$p" ]] && continue
  base="${p##*/}"

  if [[ "$base" == *Zone.Identifier ]]; then
    echo "WINDOWS_PATH $p  (NTFS Alternate Data Stream sidecar)"
    bad=1
    continue
  fi

  # Colon and backslash are illegal NTFS filename characters. Match them with
  # case so the patterns stay valid bash (a [[ == ]] glob with $'...' and a
  # backslash character class is a syntax error, and the scan never runs).
  case "$p" in
    *:*|*\\*)
      echo "WINDOWS_PATH $p  (colon or backslash is illegal on NTFS)"
      bad=1
      continue
      ;;
  esac

  case "$p" in
    *'<'*|*'>'*|*'"'*|*'|'*|*'?'*|*'*'*)
      echo "WINDOWS_PATH $p  (contains <>\"|?*)"
      bad=1
      continue
      ;;
  esac

  IFS=/ read -r -a parts <<<"$p"
  for part in "${parts[@]}"; do
    [[ -z "$part" ]] && continue
    if [[ "$part" == *' ' ]] || [[ "$part" == *. ]]; then
      echo "WINDOWS_PATH $p  (trailing space or dot in '$part')"
      bad=1
      break
    fi
    upper=$(printf '%s' "$part" | tr '[:lower:]' '[:upper:]')
    stem=${upper%%.*}
    case "$stem" in
      CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])
        echo "WINDOWS_PATH $p  (reserved device name '$part')"
        bad=1
        break
        ;;
    esac
  done
done

if [[ "$bad" -ne 0 ]]; then
  echo "Refuse paths Windows cannot checkout. Delete or rename, then retry."
  exit 1
fi

echo "windows-path-safety OK (${#PATHS[@]} paths)"
