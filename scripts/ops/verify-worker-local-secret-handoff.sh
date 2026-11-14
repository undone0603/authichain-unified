#!/usr/bin/env bash
# Zero-extra-service-cost, fail-closed, operator-local handoff.
# Run interactively in trusted WSL; never with bash -x or redirected stdin.
set +x
set -euo pipefail
umask 077

REPO="undone0603/authichain-unified"
ENVIRONMENT="production-cloudflare-verify-worker"
ACCOUNT="4c1869b90f13f86940aa3747839bf420"
WORKER="authichain-verify-worker"
TOKEN_SECRET="AUTHICHAIN_VERIFY_WORKER_CLOUDFLARE_API_TOKEN"
ACCOUNT_SECRET="AUTHICHAIN_VERIFY_WORKER_CLOUDFLARE_ACCOUNT_ID"

fail() { printf 'HOLD: %s\n' "$*" >&2; exit 1; }
for cmd in gh node; do command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is unavailable"; done
[[ -t 0 && -r /dev/tty ]] || fail "A trusted interactive terminal is required"
GH_HOST_VALUE="$(printenv GH_HOST || true)"
[[ -z "$GH_HOST_VALUE" || "$GH_HOST_VALUE" == "github.com" ]] || fail "GH_HOST is not github.com"
gh auth status --hostname github.com >/dev/null 2>&1 || fail "GitHub CLI sign-in is unavailable"

# Never upload secrets into a missing environment: gh can create environments implicitly.
gh api --method GET "repos/$REPO/branches/main" --jq '.protected' | grep -Fxq true ||
  fail "Repository main is not independently confirmed protected"
gh api --method GET "repos/$REPO/environments/$ENVIRONMENT" |
  node --input-type=module -e '
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    const env = JSON.parse(text);
    if (env.name !== "production-cloudflare-verify-worker" ||
        env.deployment_branch_policy?.protected_branches !== true ||
        env.deployment_branch_policy?.custom_branch_policies !== false ||
        env.can_admins_bypass !== false) {
      throw new Error("HOLD: dedicated GitHub environment is missing or insufficiently protected");
    }
    console.log("PASS: existing environment allows protected branches only, no admin bypass");
  '

# Do not silently overwrite or rotate any previous production secret.
EXISTING="$(gh secret list -e "$ENVIRONMENT" -R "$REPO" --json name --jq '.[].name')"
if printf '%s\n' "$EXISTING" | grep -Fxq "$TOKEN_SECRET"; then
  fail "Dedicated token secret already exists; require explicit rotation review"
fi
if printf '%s\n' "$EXISTING" | grep -Fxq "$ACCOUNT_SECRET"; then
  fail "Dedicated account secret already exists; require explicit rotation review"
fi

# The one-time bearer is read from the terminal, never argv, a file, or chat.
CF_TOKEN=""
trap 'unset CF_TOKEN; unset ACCOUNT WORKER' EXIT
read -r -s -p "New account-owned Cloudflare token (hidden input): " CF_TOKEN < /dev/tty
printf '\n' > /dev/tty
[[ -n "$CF_TOKEN" ]] || fail "No Cloudflare token supplied"
export CF_TOKEN ACCOUNT WORKER

# Validation uses read-only Cloudflare calls. A passing read does NOT establish
# a Specified Workers/Editor policy; separately inspect the real token metadata.
node --input-type=module <<'NODE'
import { createHash } from "node:crypto";
const account = process.env.ACCOUNT;
const worker = process.env.WORKER;
const token = process.env.CF_TOKEN;
async function get(path) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}
const verified = await get("/accounts/" + account + "/tokens/verify");
const id = verified.body?.result?.id;
if (verified.status !== 200 || verified.body?.success !== true ||
    verified.body?.result?.status !== "active" ||
    !/^[0-9a-f]{32}$/i.test(id ?? "")) {
  throw new Error("HOLD: active account-owned token was not verified");
}
const target = await get("/accounts/" + account + "/workers/scripts/" + worker + "/deployments");
if (target.status !== 200 || target.body?.success !== true) {
  throw new Error("HOLD: token cannot read the existing verify Worker");
}
console.log("PASS: active account-owned token and target Worker read access");
console.log("Token-ID SHA-256 (not a token secret): " + createHash("sha256").update(id).digest("hex"));
console.log("HOLD: per-Worker Editor scope still requires independent token-detail audit");
NODE

# GitHub CLI encrypts environment secrets before upload; stdin avoids argv leakage.
printf '%s' "$CF_TOKEN" | gh secret set "$TOKEN_SECRET" --env "$ENVIRONMENT" --repo "$REPO" ||
  fail "Cloudflare token secret upload failed; do not deploy"
unset CF_TOKEN
printf '%s' "$ACCOUNT" | gh secret set "$ACCOUNT_SECRET" --env "$ENVIRONMENT" --repo "$REPO" ||
  fail "Account-ID secret upload failed; do not deploy"

ACTUAL="$(gh secret list -e "$ENVIRONMENT" -R "$REPO" --json name --jq '.[].name')"
printf '%s\n' "$ACTUAL" | grep -Fxq "$TOKEN_SECRET" || fail "New token secret name was not confirmed"
printf '%s\n' "$ACTUAL" | grep -Fxq "$ACCOUNT_SECRET" || fail "New account secret name was not confirmed"
printf 'PASS: dedicated GitHub environment secret names are present (values remain write-only)\n'
printf 'HOLD: independently audit the exact token policy; open a separate redacted-attestation PR.\n'
printf 'HOLD: do NOT dispatch the production release without separate authorization.\n'
