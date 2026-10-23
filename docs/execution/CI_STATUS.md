# CI status

Evidence date: 2026-10-22. Commit under test: `main` `6b2535e1d117b76ac0bc65c0be154c124e540fa0` (merged PR #1995 / `fix/p1-dpp-fulfill-test-cas-mock`).
GitLab Pipeline #2977121316 status: PASSED.

## Local baseline (root vitest config, sandbox, Node 22, pnpm 10.28.2)

| Suite | Before fixes (`main`) | After fixes (`main` `6b2535e1`) |
| --- | --- | --- |
| `src` + `protocol` (`npx vitest run src protocol`) | 4 files failed; 11 tests failed, 1,271 passed, 1 skipped | 159 files passed; 1,286 passed, 1 skipped, 0 failed |
| Checkout gate and attestation (4 files) | 48 passed | 48 passed |
| `src` + `protocol` with !1998 and !1999 (Launch gate removed, 2 new tests) | n/a | 159 files passed; 1,288 passed, 1 skipped, 0 failed |
| Stripe webhook, verify-worker, dpp-fulfillment (7 files) | 68 passed | 68 passed |
| `agentz/tests` (Python venv from `requirements-agentz.txt` plus pytest and pytest-asyncio) | not run | 284 passed, 1 skipped, 0 failed |

All 11 failures were **pre-existing on `main`** (stale tests, not regressions from this work) and none was a production defect:

| Failing tests | Root cause | Fix (test-only) |
| --- | --- | --- |
| 9 in `src/lib/dpp-fulfill-checkout.test.ts` | `q.eq` is not a function | Mock `update()` now returns awaitable chain with `{ count: 1 }` |
| 1 in `src/app/api/stripe/webhook/route.test.ts` | Expected refusal warning, now holds unpaid | Assertion updated to `stripe_grant_held_unpaid` hold log |
| 2 in `workers/authichain-com` | JSdom URL resolution | Added `@vitest-environment node` header |
