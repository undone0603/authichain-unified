# Revenue-cycle independent review setup (free public repository)

Candidate: [PR #2434](https://github.com/undone0603/authichain-unified/pull/2434).

## Recommended third-party review

Install [CodeRabbit's GitHub App](https://github.com/apps/coderabbitai) on **only** `undone0603/authichain-unified`, using the GitHub installation owner account. Public-repository reviews are advertised as free; confirm the installation screen does not authorize paid plans or billing. Request a fresh review on PR #2434 and preserve its actual findings as evidence. This file does **not** claim the App has been installed or reviewed the PR.

## Important approval boundary

An automated GitHub App review or PR comment is supplemental technical evidence. It does not satisfy the independent human/eligible-collaborator approval rule unless the repository's actual existing branch-protection/ruleset policy explicitly accepts it. Do **not** disable required reviews, grant bypass permissions, alter financial controls, or mark a bot comment as approval.

## Review checklist

- Cron `0 13 * * *` means 08:00 EST or 09:00 EDT, **not** 08:30 America/Detroit. Correct the misleading comment or select an explicit supported schedule before release.
- Verify public GET/HEAD checks are safe and expected statuses match production; add explicit per-request timeout.
- Distinguish `rails_ok` from verified payment, settlement, independent buyer attribution, entitlement, fulfillment and recurring revenue.
- Verify Worker has no secrets, Stripe API calls, mail sends, or mutation of `authichain-revenue-worker`.
- Run actual native tests and source-matched exact-head CI on the reconciled head; preserve timestamped logs.
- Confirm current `main`, mergeability, Cloudflare account, free-tier capacity, and approved deployment policy before merging or deploying the standalone Worker.

## Release status

**HOLD:** third-party App installation and eligible review not yet verified. No merge/deploy is authorized by this document.
