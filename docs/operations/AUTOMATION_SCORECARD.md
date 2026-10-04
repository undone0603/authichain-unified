# Automation scorecard

Every enabled automation needs this operating contract before it is added to
`.github/autonomy.json`. The operating charter remains authoritative when this
scorecard conflicts with it.

## Required fields

| Field             | Requirement                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Owner             | Named person or team accountable for the outcome.                                         |
| Lane              | One switchboard lane: ship, health, revenue, growth, improve, repair, manual, or retired. |
| Evidence          | Live source required before the automation can act.                                       |
| Permitted action  | Narrow, observable action the automation may take alone.                                  |
| Approval boundary | Side effects that always stop for owner approval.                                         |
| Failure behavior  | Fail-closed condition, alert route, and retry limit.                                      |
| Rollback          | Reversible configuration or deployment path.                                              |
| Cost cap          | Spend, model, or resource limit; use zero when no cost is authorized.                     |
| Success metric    | Observable outcome and review cadence.                                                    |

## Initial scorecards

| Automation       | Owner             | Lane    | Evidence and permitted action                                  | Approval boundary                                                                        | Success metric                                                         |
| ---------------- | ----------------- | ------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| DPP revenue loop | Revenue owner     | revenue | Observable funnel events; provision a paid, verified checkout. | Prices, refunds, new SKUs, schema changes, and unverified claims.                        | A complete attributable path from checkout to published, verified DPP. |
| Operations pulse | Operations owner  | health  | Live health probes; open or close the defined alert issue.     | Infrastructure, secret, DNS, and production configuration changes.                       | Fresh probes and no unresolved alert when systems are healthy.         |
| Draft repair     | Engineering owner | repair  | Failed check evidence; prepare deterministic draft fixes.      | Merge, security-sensitive changes, revenue changes, schema changes, and charter changes. | Lower repeat-failure rate with every merged, reviewed fix.             |

## Review cadence

Review each scorecard when its workflow changes, its evidence source changes,
or its success metric fails for two consecutive review periods. Retire or
tighten any automation that cannot demonstrate evidence-backed value.
