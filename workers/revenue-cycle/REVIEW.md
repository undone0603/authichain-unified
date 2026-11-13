# Revenue-cycle independent review setup (free public repository)

Candidate: [PR #2434](https://github.com/undone0603/authichain-unified/pull/2434).

## Recommended third-party review

Install [CodeRabbit's GitHub App](https://github.com/apps/coderabbitai) on **only** `undone0603/authichain-unified`, using the GitHub installation owner account. Public-repository reviews are advertised as free; confirm the installation screen does not authorize paid plans or billing. Request a fresh review on PR #2434 and preserve its actual findings as evidence. This file does **not** claim the App has been installed or reviewed the PR.

## Important approval boundary

Automated GitHub App review is optional supplemental technical evidence, **not a release prerequisite** for this standalone read-only Worker. The owner explicitly removed the extra independent-review gate. The two observed active `main` rulesets each require **zero approving reviews**, while still requiring PR-based changes and no bypass actors. This does not change either ruleset, and any additional applicable branch protection must still be honored. Do **not** grant bypass permissions, alter financial controls, or misrepresent bot comments as approvals.

## Review checklist

- Cron `0 13 * * *` means 08:00 EST or 09:00 EDT, **not** 08:30 America/Detroit. Correct the misleading comment or select an explicit supported schedule before release.
- Verify public GET/HEAD checks are safe and expected statuses match production; add explicit per-request timeout.
- Distinguish `rails_ok` from verified payment, settlement, independent buyer attribution, entitlement, fulfillment and recurring revenue.
- Verify Worker has no secrets, Stripe API calls, mail sends, or mutation of `authichain-revenue-worker`.
- Run actual native tests and source-matched exact-head CI on the reconciled head; preserve timestamped logs.
- Confirm current `main`, mergeability, Cloudflare account, free-tier capacity, and approved deployment policy before merging or deploying the standalone Worker.

## Release status

**HOLD for engineering verification only:** automated/human independent review is optional, not a gate. Require source-matched tests on final head, accurate cron documentation, current-main reconciliation, and actual approved production deployment configuration before release. No merge/deploy is authorized by this document.
