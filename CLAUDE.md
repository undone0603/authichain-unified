@AGENTS.md

<!-- Everything below is ours. Next.js hosts its managed agent-rules block in
     AGENTS.md, and generate-agent-files.js skips this file entirely once it
     does (see the claudeMd: 'skipped' branch), so additions here survive
     `next dev`. -->

@docs/misc/CLAUDE.md

## Project guide

`docs/misc/CLAUDE.md` is the AuthiChain project guide — Truth Layer principles,
essential commands, architecture. It was written at the repo root and moved to
`docs/misc/` in the 2026-08-31 consolidation (b3f82a3), after which nothing
referenced it. Between then and 2026-09-11 the only instructions loading at the
root were Next.js framework notes, so the project's own guidance was never
reaching an agent session. The import above reconnects it.

## Working notes

- **Autonomy** — `docs/OPERATING_CHARTER.md` says what runs unattended and what
  waits for the owner. `.github/autonomy.json` is the only switchboard: every
  workflow must be classified there, and loops are turned on or off by editing
  it, never by clicking in the Actions UI (the reconciler would revert that).

- **Genetics passports** — `docs/strategy/strainchain-genetics-passport.md`
  carries the numbered design decisions and the pricing ruling. Read it before
  changing `src/lib/genetics.ts`, the `/genetics` routes, or anything about how
  provenance is displayed.
- **Totals are derived, never transcribed.** Every THCV/THC figure on a passport
  is recomputed from the raw panel at render time. Do not add a code path that
  displays a stored total.
- **`src/lib/plans.ts` is the source of truth for anything that charges a
  human.** `shared/pricing.ts` is a Stripe plan-detection reference holding
  test-mode IDs, despite what it used to call itself. Agent pay is x402 Base
  USDC (`src/lib/x402.ts`). Wallets, chains, `$QRON`, and “do not mix” rules:
  `docs/strategy/WEB3_IDENTITY.md`. Do not call two different EOAs “ops”.
- **Chrome colours and data colours are not interchangeable.** The botanical
  accents in `src/app/genetics/genetics.css` fail the chroma floor as data
  marks; charts use the validated `--viz-*` slots.

## Agent session policy

This governs what a Claude/agent session does by hand. `docs/OPERATING_CHARTER.md`
and `.github/autonomy.json` govern the scheduled loops; where this section is
stricter about a session's own actions, this section applies. The Truth Layer
"Act" step in `docs/misc/CLAUDE.md` (mint, trigger outreach) does not authorise a
session to send, mint or charge — those follow the rules below.

### Truth and evidence

Classify each material capability as IMPLEMENTED, TESTED, DEPLOYED,
PRODUCTION-VERIFIED, SIMULATED, MOCKED, BLOCKED, NOT IMPLEMENTED or EXTERNAL
AUTHORITY BOUNDARY, and never promote one to the next without evidence. A
passing test is not a deploy; a deploy is not verified production behaviour; an
HTTP 200 is not a successful business operation. Cite exact commits, run IDs,
test output and response codes. Never fabricate customers, payments, revenue,
entitlements, activations or retention. A CRM target list is not a forecast.

### Economic and communication safety

- The real switches are `cold_outreach.enabled` + `OWNER_LIVE_SEND`,
  `launch_mode`, `merge_autopilot.enabled`, the `hold`/`do-not-merge` labels and
  `approval-needed` issues. A session never flips these, never adds `approved`
  or `denied` (only the owner's label counts), and never removes a hold. (There
  is no `humanHold` or `production_send` in this repo; read those names in older
  prompts as these switches.)
- A session never sends production email, cold or otherwise, and never charges
  a card, refunds, grants a paid entitlement or makes any Stripe write other than
  a test-mode checkout session — not even to test a flow.
- Paid fulfilment (`fulfillDppPaidSession` and callers) requires a verified
  Stripe signature, idempotency on the event/session, and a durable state write;
  a failed write must return an error so Stripe retries. Never weaken this.
- Lead capture persists first; HubSpot, n8n and Resend run only after the write
  succeeds. A failed write returns an error and calls none of them.
- Unknown, malformed or unavailable is not counterfeit. `/api/v1/attestation/verify`
  is the trust boundary; keep its valid / invalid / indeterminate / unavailable
  semantics. Demo fixtures and simulated gateways are not production evidence.
- Identity is not authorisation: agent actions must pass capability, policy,
  scope, preconditions, idempotency, economic limits and audit.

### Merging

The merge autopilot (owner decision 2026-10-02) merges any green, clean PR from a
trusted author, whatever it touches — so a PR opened under `undone0603` will
merge on its own unless held. Therefore:

- When a session opens or pushes to a PR that changes Stripe webhook
  verification, paid fulfilment, outbound-send gating, the switches above,
  credentials or secret handling, it adds the `hold` label in the same step and
  says why in the PR body. Only the owner removes it.
- A session merges by hand only if every required check is green on the current
  head, GitHub reports it clean, no hold label or pending review exists, and the
  diff has been read. If labels, checks or protection can't be read, don't merge.
- Never merge your own PR; never relabel to get around a hold.

### Deploying

Pushes to `main` deploy through the existing workflows; that is the normal path.
Firing a `workflow_dispatch` deploy by hand is a production action — confirm with
the user first (see the steward skill). Record the deployed commit and Worker
version, then verify with read-only requests only: no email, no customer writes,
no charges, no entitlements, no continuity writes as smoke tests.

### Tests and release gates

- Stub HubSpot, n8n, Resend and Stripe in automated tests; never use production
  keys. Assert that failure paths make zero downstream calls.
- Cover replay, duplicates, expiry, revocation, malformed signatures, missing
  stores, policy mismatch and wrong scope, not only the happy path.
- Contract gate: the `Contract tests (Hardhat)` step of the `lint` job in
  `.github/workflows/lint.yml`; locally `pnpm test:contracts`. A pass on an older
  commit does not cover a newer one.
- Never skip, weaken or delete a test to get green.

### Git

Check branch, HEAD and `git status` before editing. Preserve unrelated changes;
if the tree is dirty with someone else's work, use a worktree off `origin/main`.
Read the full diff before committing; small commits with truthful messages; push
only the intended branch. Don't claim a push, merge or deploy without evidence.

### Owner-only

The charter's "always waits for the owner" list, plus: rotating the Notion token
exposed in plaintext in Drive (never echo it), fixing outbound mail on the
primary domain, approving held economic PRs, and supplying missing secrets. For
each, name the action, the authority needed and the evidence that would close it,
then carry on with unrelated safe work.

### Reporting

End each work cycle with: verified state, changes, tests run, deploy and
production evidence, economic side effects (normally none), PR dispositions,
blockers and owner-only items, and the next action.
