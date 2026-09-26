# Notion cleanup + Stripe rotate — 2026-09-25

Founder YES on Librarian Option B (archive, do not delete).
Do **not** put `whsec_`, `sk_live_`, Cloudflare, or Vercel token values in git, Notion, or chat.

Cost: $0/mo. Eliminates ~2–3 hrs/week of agents copying stale pipeline and leaked keys out of SSOT.

## Founder-gated (you; 15–25 min)

Live apex webhook: `we_1UGTCSGqTruSqV8ThM9bXVWp` → `https://authichain.com/api/stripe/webhook`
Bind target: **authichain-edge-router** (also `authichain-license-issuer`). Not Vercel.

```bash
# After Dashboard Reveal / remint. Use printf, never echo.
printf '%s' "$WHSEC" | npx wrangler secret put STRIPE_WEBHOOK_AUTHICHAIN_SECRET --name authichain-edge-router
printf '%s' "$WHSEC" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --name authichain-edge-router
bash scripts/rotate-secrets.sh
```

Also:

1. Stripe Dashboard → Webhooks → `we_1UGTCS…` → Reveal. Remint only if the Notion paste still matches.
2. Stripe Dashboard → API keys → roll `sk_live` if the n8n handoff value is current or unknown.
3. Roll Cloudflare API token + Vercel token that were pasted on the Mar 31 Unblock Sprint page. Put new values in wrangler / GitHub Actions only.
4. Replay a Dashboard event. Expect **2xx** at `https://authichain.com/api/stripe/webhook`. Old secret must 400.
5. Reply `rotated` in chat. Then agents redact the three leak pages.

Do not remint the grok.com connector webhook.
Do not write replacements into Notion or the vault until vault Share is founder-only.

See also: `docs/operations/stripe-webhook-signing-secret.md`

## Agent-done (2026-09-25)

- Created Notion parent `Archive — 2026-H1` under Mission Control (`3e7460fe-a355-8119-825d-c2a7c6f6b626`).
- Moved the three $3.2M / 11 hot leads campaign pages there.
- Secret CLEANUP Sprint Board rows stay Blocked until `rotated`.
- Did **not** fetch or redact: 5 Actions row, n8n handoff, Unblock Sprint, vault.

## After `rotated`

Redact in order, replace values with `[REDACTED 2026-09-26]`, keep the steps:

1. `✅ APPROVED — Execute These 5 Actions NOW`
2. AuthiChain Automation Core — n8n Build (`SUPABASE_ANON_KEY` too)
3. Session — March 31 2026 — Revenue Unblock Sprint
4. Prefix-only on KEEP Mar 31 Session Codex + Deployed Features
5. Delete Mission Control Key Infrastructure table

Then archive remaining Option B cluster. Do not bulk-delete Tasks Tracker / Inbox Archive.
