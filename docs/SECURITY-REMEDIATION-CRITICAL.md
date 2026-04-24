# SECURITY REMEDIATION -- CRITICAL

**Date:** 2026-04-13
**Auditor:** QRON/RON Autonomous Operations (Claude Code)
**Scope:** All Cloudflare Workers, authichain-unified codebase, cloud storage

---

## SEVERITY SUMMARY

| Severity | Findings | Status |
|----------|----------|--------|
| CRITICAL | 4 | 2 FIXED (code), 2 PENDING (rotation) |
| HIGH | 3 | 1 FIXED (code), 2 PENDING (rotation) |
| MEDIUM | 5 | 1 FIXED (code), 4 PENDING (migration) |
| LOW | 1 | No action needed |

---

## CRITICAL FINDINGS

### CRIT-1: Live Stripe Secret Key Exposed in 2 Workers

**Status: PENDING ROTATION**
**Workers:** `qron-stripe-webhook`, `qron-daily-ops`
**Secret:** `sk_live_51SXIyEGqTruSqV8T2boy...` (Stripe live secret key)
**Risk:** Full financial access -- refunds, charges, customer PII, subscription modifications.

**Remediation:**
1. Go to https://dashboard.stripe.com/apikeys
2. Roll the secret key (generate new, revoke old)
3. Store new key as Cloudflare Worker secret: `wrangler secret put STRIPE_SECRET`
4. Update both workers to read from `env.STRIPE_SECRET`

### CRIT-2: Stripe Webhook Signing Secret Exposed

**Status: PENDING ROTATION**
**Worker:** `qron-stripe-webhook`
**Secret:** `whsec_02XXa6AA3AcJlDzCQUCUtUAfctv29r1W`
**Risk:** Attacker can forge webhook events (fake sales, fake fulfillment).

**Remediation:**
1. Go to Stripe Dashboard > Webhooks > regenerate signing secret
2. Store as: `wrangler secret put WEBHOOK_SECRET`

### CRIT-3: Resend API Key Hardcoded in Worker Source

**Status: FIXED (code prepared, deployment pending)**
**Worker:** `resend-relay`
**Secret:** `re_Lc5G2g2X_2o73cM6xhL8xZUeGvv12AQXE`
**Risk:** Anyone with Cloudflare account access can send emails as authichain.com.

**Fix Applied:**
- Fixed worker code at `workers/resend-relay/index.js` (v1.1)
- API key removed from source, reads from `env.RESEND_API_KEY`
- Deploy script at `workers/resend-relay/deploy.sh`

**Remaining Manual Steps:**
1. Deploy via Cloudflare Dashboard or `wrangler deploy`
2. Add secret: `wrangler secret put RESEND_API_KEY`
3. Rotate the key at https://resend.com/api-keys

### CRIT-4: 9 Personal Email Addresses Hardcoded in Worker

**Status: FIXED (code prepared, deployment pending)**
**Worker:** `qron-outreach`
**Risk:** PII exposure. Names + emails of real prospects in deployable source code.

**Fix Applied:**
- Migration worker at `scripts/qron-outreach-migration.js`
- Clean worker at `scripts/qron-outreach-fixed.js` (reads from KV)
- KV data files at `scripts/kv-data/outreach_queue.json` and `sender_config.json`

**Remaining Manual Steps:**
1. Deploy migration worker via Dashboard
2. Hit `/migrate-to-kv?key=qron-ops-2026` to seed KV
3. Verify with `/verify-kv?key=qron-ops-2026`
4. Deploy clean worker
5. Set `AUTH_TOKEN` secret with a strong random value

---

## HIGH FINDINGS

### HIGH-1: Telegram Bot Tokens Exposed (2 tokens)

**Status: PENDING REVOCATION**
**Workers:** `qron-stripe-webhook`, `qrontoken-telegram-bot`
**Tokens:**
- `8654168528:AAHwRu-ZKhpzTA2GZvyS-0-IQUYV25o5Lq8` (QRON bot)
- `8727703401:AAFhjoVd5XCM00NnCwBG-IxrwC9P-lh6OvI` (Ops bot)
**Risk:** Bot impersonation, message exfiltration, spam.

**Remediation:**
1. Message @BotFather on Telegram: `/revoke` for each bot
2. Generate new tokens
3. Store as Worker secrets: `wrangler secret put QRON_BOT_TOKEN` / `OPS_BOT_TOKEN`

### HIGH-2: Groq API Key Exposed

**Status: PENDING ROTATION**
**Worker:** `qron-daily-ops`
**Secret:** `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`
**Risk:** Unauthorized LLM API usage, billing abuse.

**Remediation:**
1. Rotate at https://console.groq.com/keys
2. Store as: `wrangler secret put GROQ_KEY`

### HIGH-3: Closer Agent Bypasses Outreach Approval Gate

**Status: FIXED**
**File:** `server/agents/closer.ts`
**Risk:** Autonomous email sending without human approval even when `requireOutreachApproval=true`.

**Fix Applied:**
- Added `ENV.requireOutreachApproval` checks to all 4 email-sending functions
- When approval required: creates `emailDrafts` entry + pauses task for human review
- When approval not required: behavior unchanged (direct send)
- Functions fixed: `runSendDemoPacket`, `runGenerateProposal`, `runSendContract`, `runAutoReply`

---

## MEDIUM FINDINGS

### MED-1: Browser Password CSVs in OneDrive

**Status: PENDING DELETION**
**Location:** `C:\Users\rac\OneDrive\Documents\`
**Files:**
- `Chrome Passwords.csv`
- `Chrome Passwords Exactly.k.csv`
- `Microsoft Edge Passwords.csv`
**Risk:** Plaintext passwords accessible via OneDrive sync.

**Remediation:**
1. Verify all passwords migrated to 1Password (installed on this machine)
2. Permanently delete all 3 files
3. Empty OneDrive recycle bin

### MED-2: Supabase Anon Key in 5 Workers

**Status: PENDING MIGRATION**
**Workers:** `gmail-relay-z`, `qron-stripe-webhook`, `qron-daily-ops`, `authichain-api`, `authichain-verify`
**Risk:** Key rotation requires redeploying all 5 workers.

**Remediation:** Move to `env.SUPABASE_ANON_KEY` across all workers.

### MED-3: Dashboard Password in Query Parameters

**Status: PENDING FIX**
**Worker:** `authichain-dashboard`
**Password:** `authichain2026` (passed as `?key=authichain2026`)
**Risk:** Trivially guessable, appears in logs/history/referer headers. Dashboard exposes internal links.

**Remediation:** Replace with Cloudflare Access (Zero Trust) or header-based auth.

### MED-4: Hardcoded Auth Token Fallback

**Status: FIXED (in prepared code)**
**Worker:** `qron-outreach`
**Token:** `qron-ops-2026` (hardcoded default when `AUTH_TOKEN` env var not set)

**Fix:** Removed in the clean worker version. `AUTH_TOKEN` is now required.

### MED-5: Notion Integration Token in Google Doc

**Status: PENDING ROTATION**
**Location:** Google Drive "QRON Make.com Automation Setup" doc
**Token:** `ntn_18807...` (Notion integration token in plaintext)

**Remediation:** Rotate at https://www.notion.so/my-integrations

---

## LOW FINDINGS

### LOW-1: IndexNow Key in Worker Source

**Worker:** `qron-seo-engine`
**Key:** `f2dbe7c03cf14c188b019262eccf4b6d`
**Risk:** None -- IndexNow keys are public by design.
**Action:** No remediation needed.

---

## CODEBASE FIXES APPLIED (This Session)

| File | Fix | Impact |
|------|-----|--------|
| `drizzle/schema.ts` | Added missing `drizzle-orm/mysql-core` imports | Eliminated 573 TS errors |
| `drizzle/schema.ts` | Added staking, feedback, personalization tables | Resolved module export errors |
| `drizzle/schema.ts` | Added `segment`, `nextActionAt` to leads; `taskId` to emailDrafts | Schema-code alignment |
| `server/db.ts` | Implemented 60+ CRUD functions | Eliminated ~300 TS errors |
| `server/db.ts` | Fixed field mismatches (timestamp/createdAt, read/isRead) | Runtime crash prevention |
| `server/agents/closer.ts` | Added approval gate to 4 email functions | Security: no more bypass |
| `server/_core/paddle.ts` | Created missing Paddle webhook verification | Resolved module not found |
| `server/_core/types/crisp-api.d.ts` | Created ambient type declaration | Resolved module not found |
| `workers/resend-relay/index.js` | Prepared fixed worker (API key to env) | Security: credential removal |
| `scripts/qron-outreach-fixed.js` | Prepared fixed worker (emails to KV) | Security: PII removal |

**TypeScript errors: 978 -> 0**
**Build: Clean pass**

---

## EXECUTION CHECKLIST

Run these in order. Check off as completed.

### Phase 1: Immediate (Today)
- [ ] Rotate Stripe live secret key at stripe.com/dashboard
- [ ] Rotate Stripe webhook signing secret
- [ ] Deploy `resend-relay` v1.1 (use Dashboard Quick Edit)
- [ ] Set `RESEND_API_KEY` secret on resend-relay Worker
- [ ] Rotate Resend API key at resend.com
- [ ] Delete browser password CSVs from OneDrive
- [ ] Revoke both Telegram bot tokens via @BotFather

### Phase 2: Urgent (This Week)
- [ ] Deploy qron-outreach migration worker + seed KV
- [ ] Deploy qron-outreach clean worker
- [ ] Set `AUTH_TOKEN` secret on qron-outreach Worker
- [ ] Rotate Groq API key
- [ ] Move Stripe key to env in `qron-stripe-webhook` Worker
- [ ] Move Stripe key to env in `qron-daily-ops` Worker
- [ ] Move Telegram tokens to env in both workers

### Phase 3: Short-Term (This Month)
- [ ] Move Supabase anon key to env in all 5 workers
- [ ] Replace dashboard password with Cloudflare Access
- [ ] Rotate Notion integration token
- [ ] Audit all Workers quarterly for new hardcoded secrets
- [ ] Add pre-deploy secret scanning to CI/CD pipeline

---

## APPENDIX: Worker Security Scorecard

| Worker | Secrets | Severity | Clean? |
|--------|---------|----------|--------|
| resend-relay | 1 (API key) | CRITICAL | FIX PREPARED |
| qron-outreach | 10 (emails+token) | CRITICAL | FIX PREPARED |
| qron-stripe-webhook | 5 | CRITICAL | PENDING |
| qron-daily-ops | 4 | CRITICAL | PENDING |
| qrontoken-telegram-bot | 1 | HIGH | PENDING |
| gmail-relay-z | 1 | MEDIUM | PENDING |
| authichain-api | 1 | MEDIUM | PENDING |
| authichain-dashboard | 1 | MEDIUM | PENDING |
| authichain-verify | 1 | MEDIUM | PENDING |
| qron-seo-engine | 1 (public) | LOW | OK |
| qron-self-heal | 0 | CLEAN | OK |
| authichain-verifier | 0 | CLEAN | OK |
