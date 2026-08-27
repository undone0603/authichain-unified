#!/usr/bin/env bash
# export-vercel-env.sh
# Pulls ALL env vars (decrypted) from every Vercel project in the team into a
# gitignored archive, before the projects are paused as part of the Vercel
# elimination (docs/NETWORK.md). Companion to push-env-to-vercel.sh.
#
# Usage (run from repo root with a Vercel token):
#   VERCEL_TOKEN=your_token bash scripts/export-vercel-env.sh
#
# Output:
#   .env-archive/vercel-export-<date>/<project>.env   one file per project
#   .env-archive/vercel-export-<date>/UNION.env       de-duplicated union
#
# Get your token: https://vercel.com/account/tokens

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN before running this script}"
TEAM_ID="${VERCEL_TEAM_ID:-team_PKVRDwUXPRFjmGTM7PZxjNys}"
OUT_DIR="${REPO_ROOT}/.env-archive/vercel-export-$(date +%Y-%m-%d)"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
mkdir -p "$OUT_DIR"
chmod 700 "${REPO_ROOT}/.env-archive" "$OUT_DIR"

api() {
  curl -sS -H "Authorization: Bearer ${TOKEN}" "https://api.vercel.com$1"
}

echo "Listing projects in team ${TEAM_ID}..."
PROJECTS_JSON="$(api "/v9/projects?teamId=${TEAM_ID}&limit=100")"
mapfile -t PROJECT_ROWS < <(echo "$PROJECTS_JSON" | jq -r '.projects[] | "\(.id)\t\(.name)"')
echo "Found ${#PROJECT_ROWS[@]} projects."

UNION_FILE="${OUT_DIR}/UNION.env"
: > "$UNION_FILE"

for row in "${PROJECT_ROWS[@]}"; do
  PROJECT_ID="${row%%$'\t'*}"
  PROJECT_NAME="${row#*$'\t'}"
  OUT_FILE="${OUT_DIR}/${PROJECT_NAME}.env"
  : > "$OUT_FILE"
  chmod 600 "$OUT_FILE"

  echo "── ${PROJECT_NAME} (${PROJECT_ID})"
  ENV_LIST="$(api "/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}")"
  mapfile -t ENV_IDS < <(echo "$ENV_LIST" | jq -r '.envs[]?.id')

  COUNT=0
  for ENV_ID in "${ENV_IDS[@]}"; do
    DECRYPTED="$(api "/v1/projects/${PROJECT_ID}/env/${ENV_ID}?teamId=${TEAM_ID}&decrypt=true")"
    KEY="$(echo "$DECRYPTED" | jq -r '.key // empty')"
    VALUE="$(echo "$DECRYPTED" | jq -r '.value // empty')"
    TYPE="$(echo "$DECRYPTED" | jq -r '.type // empty')"
    [ -z "$KEY" ] && continue
    if [ "$TYPE" = "sensitive" ] && [ -z "$VALUE" ]; then
      # Sensitive vars are write-only via the API; flag so nothing is silently lost.
      echo "# ${KEY}=<SENSITIVE — not retrievable via API; copy from dashboard>" >> "$OUT_FILE"
      echo "   ⚠ ${KEY} is sensitive (write-only) — recover it from the dashboard or its source service"
      continue
    fi
    printf '%s=%q\n' "$KEY" "$VALUE" >> "$OUT_FILE"
    printf '%s=%q\n' "$KEY" "$VALUE" >> "$UNION_FILE"
    COUNT=$((COUNT + 1))
  done
  echo "   exported ${COUNT}/${#ENV_IDS[@]} vars → ${OUT_FILE#"$REPO_ROOT"/}"
done

# De-duplicate the union (last write wins, matching push order)
sort -u -t= -k1,1 "$UNION_FILE" -o "$UNION_FILE"
chmod 600 "$UNION_FILE"

echo
echo "Done. Archive: ${OUT_DIR#"$REPO_ROOT"/}"
echo "Next steps:"
echo "  1. diff <(cut -d= -f1 ${UNION_FILE#"$REPO_ROOT"/} | sort) <(grep -oE '^[A-Z_0-9]+' .env | sort)  # find Vercel-only keys"
echo "  2. Merge missing keys into .env, then run scripts/push-secrets-to-cloudflare.sh"
echo "  3. Copy the archive somewhere offline before pausing the Vercel projects."
