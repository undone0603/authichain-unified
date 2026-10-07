# Estate Recovery Register

Compiled 6 October 2026 from chats and artifacts. Checked against `origin/main` at `119d2adf` on 7 October 2026. This file records what the sweep claimed and what the tree shows now. It is not a revenue classification, not a Value Receipt, and not an authorization to send, charge, deploy, or unfreeze AgentZ.

Source file: `Estate-Recovery-Register-2026-10-06.docx` (Downloads, 6 October 2026). Word metadata: one revision, creator "Un-named", created 2026-10-07T02:31:58Z. No comments and no footnotes.

Qualifying revenue stays the sealed Stripe reads of 2026-10-06: `NO_QUALIFYING_REVENUE`. Nothing in this register books cash.

## Still absent

1. Five-agent consensus SQL. The sweep names `score_asset`, `resolve_asset`, `get_asset_provenance`, `verify_asset`, and `get_public_verification`, with lookup order certificates, certs, products, then seals. Those names are not in this tree. The SQL was not copied here, because this pass did not recover the original statements.

## On main, contrary to "never landed"

2. EU Battery Regulation Art. 77 / Annex XIII gap map. `workers/authichain-com/src/battery-gap-map.ts` is on main. It checks stated watt-hours against nominal volts times amp-hours and says it is not a passport and not legal advice. The sweep's 18 February 2027 deadline is the regulation date the page already cites, not a new filing.

3. `contracts/ledger/AuthiChainLedger.sol` is on main, with `src/lib/ledger-contract.ts`, `scripts/ledger/deploy.ts`, and `test/AuthiChainLedger.test.ts`. Source in the repo does not show whether a deployment receipt exists. The sweep said the contract was never deployed. That deployment claim was not re-checked.

11. `protocol/attestation/engine.ts` awaits key import before sign and verify. The sweep's "never awaits" finding does not match this file.

13. `pnpm-workspace.yaml` has a `packages` field. The sweep's "CI never ran because the field was missing" note is a past state, not this file.

Below the sweep's cut: `verify_agent_action_receipts()` is in `supabase/migrations/20261001191414_agent_action_receipts_v1.sql`. It is a database function. It is not a gate on every agent action. No TypeScript, JavaScript, or Python caller of that function was found in an earlier read of this tree.

## Present, and not re-verified as live

4. QRON seal spec and an ES256 rotation procedure. The sweep says the live JWKS has one active key id and the procedure has never been run. This pass did not read the live JWKS.

5. OpenSign. The sweep describes a `signature_requests` migration and Worker routes `/api/sign/create` and `/api/sign/webhook`. This tree has `set_signature_requests_updated_at()` in an advisor migration. No OpenSign-named Worker was found in the name search.

8. Agents that invent evidence. Current `agentz` Python does not contain the company inboxes named in the sweep. `agentz/tests/test_partnership.py` asserts that DHL and Lloyd's are not returned as lead names. `agentz/workflows/handlers/authichain_apex_orchestrator.py` and `authichain_apex_hardened.py` still contain a hardcoded partner row named DHL. No mail was sent from this register.

12. Consensus weights. The sweep says one published set is 35/25/20/12/8 and another is 28/24/22/14/12, with no canonical spec. This pass did not pick a winner.

14. Postgres `REVOKE` from `anon` and `authenticated` does nothing while `PUBLIC` still holds the grant. The sweep's correct form is `REVOKE … FROM public, anon, authenticated`, then an explicit grant to `service_role`.

15. Airtable `update_automation` replaces the trigger and the nodes. Do not use it to "arm" a config that is still off.

16. The sweep's GitHub PAT workarounds: `wrangler deploy` does not need GitHub, and a logged-in browser plus public `api.github.com` reads can cover a public repo. A deploy still needs a founder decision. This pass did not deploy.

17. Vercel `x-vercel-error: DEPLOYMENT_DISABLED` (402) means billing. `DEPLOYMENT_NOT_FOUND` (404) means the project is gone.

18. Stripe MCP calls need an explicit account context and livemode, or they can return another account. This pass did not take a new Stripe snapshot.

19. Gov ingestion. The sweep says that after a rescore, 0 of 5,313 opportunities scored above 50 because the feed was physical-parts solicitations. That count was not re-run.

20. Autonomy audit, as recorded by the sweep and not re-counted here: environment variables read without `.env.example` entries, a drizzle journal that does not match the files on disk, duplicate migration numbers, a closer that stops at "merge manually", and thin tests.

## Not acted on

6. The sweep says a minter key for an address starting `0xbad4e580` exists on one Windows machine and has no backup. The key was not located and is not copied here.

7. The sweep says a live Stripe secret sits in plaintext in a Notion vault, and that older keys remain in public git history. The vault was not opened. No secret is copied here.

9. The sweep says `POST /api/v1/anchor` returned HTTP 201 with no API key, and that classify, verify, forensic-scan, and mint returned fabricated scores. The endpoint was not called.

10. Patent clock, as the sweep states it: a conservative US date of 27 February 2027, EU novelty treated as likely already lost, and the agent-action-receipt chain called the only undisclosed candidate. The confidential counsel brief of 2 October 2026, item 9, says the same chain is private-database only and that no public disclosure was found as of that brief. That is not a demonstration that every agent action is gated. The rest of the brief is not copied here.

## Coverage

The sweep says October 2025 through March 2026 was one chat deep, and that a late-2025 thread on CSRD, EUDR, CBAM, DSCSA, UFLPA, and FSMA needs a second pass. That second pass was not done.
