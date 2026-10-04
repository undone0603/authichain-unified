# Autonomy change checklist

Complete this checklist before enabling a new automation or changing the scope
of an existing one.

## Classification

- [ ] The workflow is listed exactly once in `.github/autonomy.json`.
- [ ] Its lane matches its actual side effects.
- [ ] The operating charter permits the proposed action.
- [ ] The workflow has a named owner and an automation scorecard.

## Evidence and controls

- [ ] Every automated decision has a live, documented evidence source.
- [ ] Missing, stale, or conflicting evidence causes a fail-closed result.
- [ ] Inputs and outputs avoid secrets, personal data, and unverified claims.
- [ ] The workflow has bounded retries, an alert path, and a rollback path.
- [ ] Cost, model, and resource use are capped or explicitly owner-approved.

## External effects

- [ ] External messages use the charter's contact, consent, truth, and opt-out
      controls.
- [ ] Spending, pricing, refunds, contracts, filings, secrets, DNS, and schema
      changes stop for owner approval.
- [ ] Production changes use the existing tested deployment path.
- [ ] Public claims are backed by observable evidence.

## Validation and review

- [ ] A dry run or equivalent non-destructive validation has succeeded.
- [ ] Success and failure metrics are observable and documented.
- [ ] The change is reviewable in a pull request and reversible by configuration
      or revert.
- [ ] The relevant operating documentation and scorecard were updated.
