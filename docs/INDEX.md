# AuthiChain Unified — Docs Index

_Navigable map of the documentation estate. The repo is `undone0603/authichain-unified`._

## Start here
- [README.md](../README.md) — repo overview: QRON Platform + AuthiChain Unified Core
- [CLAUDE.md](../CLAUDE.md) — AI context, essential commands, architecture summary
- [GEMINI.md](../GEMINI.md) — AgentZ autonomous launch conventions
- [AGENTS.md](../AGENTS.md) — Next.js agent rules
- [project/START_HERE.md](project/START_HERE.md) — conversion funnel tracking quickstart
- [project/todo.md](project/todo.md) — platform TODO / progress tracker
- [project/SAM_PREP.md](project/SAM_PREP.md) — SAM.gov registration checklist

## Architecture & design
- [NETWORK.md](NETWORK.md) — live deploy map (Vercel projects, CF workers, DB)
- [CAPABILITIES.md](CAPABILITIES.md) — full capability catalog (tRPC routers, API routes, workers, schedulers, AgentZ)
- [DEPLOY-RUNBOOK.md](DEPLOY-RUNBOOK.md) — one-command deploy paths + per-worker secrets
- [architecture/ADR-001-deploy-target-and-auth.md](architecture/ADR-001-deploy-target-and-auth.md)
- [architecture/decoupling.md](architecture/decoupling.md)
- [architecture/platform-robustness.md](architecture/platform-robustness.md)
- [architecture/config-standardization.md](architecture/config-standardization.md)
- [architecture/threat-model.md](architecture/threat-model.md)

## Operations
- [operations/LAUNCH-READINESS-2026-06-23.md](operations/LAUNCH-READINESS-2026-06-23.md) — launch readiness checklist
- [operations/launch-staging.md](operations/launch-staging.md)
- [operations/INTEGRATION_CHECKLIST.md](operations/INTEGRATION_CHECKLIST.md) — lead-scoring deploy checklist
- [operations/stripe-webhook-setup.md](operations/stripe-webhook-setup.md)
- [operations/stripe-webhook-checklist.md](operations/stripe-webhook-checklist.md)
- [operations/SBA_Disaster_Loan_Template.md](operations/SBA_Disaster_Loan_Template.md)

## Marketing, growth & outreach
- [marketing/FUNNEL_QUICKSTART.md](marketing/FUNNEL_QUICKSTART.md) — 5-min funnel setup
- [marketing/funnel-tracking.md](marketing/funnel-tracking.md) — complete funnel reference
- [marketing/funnel-email-example.md](marketing/funnel-email-example.md)
- [marketing/ab-testing-guide.md](marketing/ab-testing-guide.md)
- [marketing/brand-selling-points.md](marketing/brand-selling-points.md)
- [marketing/gov-engine-lead-pipeline.md](marketing/gov-engine-lead-pipeline.md)
- [marketing/QUICK_START.md](marketing/QUICK_START.md) — lead scoring quick start
- [marketing/email-proposals-integration.md](marketing/email-proposals-integration.md)
- [marketing/gpt-instructions.md](marketing/gpt-instructions.md)
- [marketing/agentic-economy-strategy.md](marketing/agentic-economy-strategy.md)

## Compliance
- [compliance/EU_DPP_COMPLIANCE_AUDIT.md](compliance/EU_DPP_COMPLIANCE_AUDIT.md)

## Strategy & proposals (`docs/strategy/`)
- [strategy/ROADMAP.md](strategy/ROADMAP.md) — autonomous evolution roadmap
- [strategy/REVENUE_STRATEGY.md](strategy/REVENUE_STRATEGY.md) — pricing, grants, partnerships
- [strategy/SYSTEM_STATE.md](strategy/SYSTEM_STATE.md) — AgentZ state snapshot
- [strategy/ARCHITECTURE_OVERVIEW.md](strategy/ARCHITECTURE_OVERVIEW.md) — email reply/nurture system
- [strategy/TECHNICAL_COMPETITIVE_SUPERIORITY.md](strategy/TECHNICAL_COMPETITIVE_SUPERIORITY.md)
- [strategy/AUTHENTICITY_INDEX.md](strategy/AUTHENTICITY_INDEX.md)
- [strategy/DELIVERABLES.md](strategy/DELIVERABLES.md) · [strategy/IMPLEMENTATION_MANIFEST.md](strategy/IMPLEMENTATION_MANIFEST.md) · [strategy/LEAD_SCORING_SUMMARY.md](strategy/LEAD_SCORING_SUMMARY.md)
- Grants: [strategy/DHS_SVIP_Grant_Application.md](strategy/DHS_SVIP_Grant_Application.md) · [strategy/NSF_SBIR_Project_Pitch.md](strategy/NSF_SBIR_Project_Pitch.md)
- Partnerships: [strategy/MI_CRA](strategy/MI_CRA_Partnership_Proposal.md) · [strategy/NY_OCM](strategy/NY_OCM_Partnership_Proposal.md) · [strategy/OH_DCC](strategy/OH_DCC_Partnership_Proposal.md)
- More in `docs/strategy/` (DEMO_PROMPTS, DEPLOYMENT_LOG, FUNNEL_TRACKING_SUMMARY, MONUMENTAL_RELEASE, POSTAL_STRATEGY, SERIES_A_BOARDROOM_BRIEFING, SIGNATURE_MANIFEST, SIGNWELL_MIGRATION, STRATEGIC_EXPANSION, STRIPE_WEBHOOK_*, WORKSPACE, notes-progress, research-findings)

## Competitive research
- [project/competitor-research-report.md](project/competitor-research-report.md) — full competitor analysis
- [project/competitor-research-progress.md](project/competitor-research-progress.md) — research tracker

## Knowledge base (`docs/knowledge/`)
- [knowledge/PRICING_TIERS.md](knowledge/PRICING_TIERS.md)
- [knowledge/RELIABILITY_ARCHITECTURE.md](knowledge/RELIABILITY_ARCHITECTURE.md)
- [knowledge/VERIFICATION_GUIDE.md](knowledge/VERIFICATION_GUIDE.md)
- [knowledge/AI_AUTOFLOW_STRATEGY.md](knowledge/AI_AUTOFLOW_STRATEGY.md)
- [knowledge/MARKETING_AUTOMATION.md](knowledge/MARKETING_AUTOMATION.md)
- [knowledge/OPERATIONAL_TIMELINE.md](knowledge/OPERATIONAL_TIMELINE.md)
- [knowledge/QRON_STYLES.md](knowledge/QRON_STYLES.md)
- [knowledge/CANNABIS_FAQ.md](knowledge/CANNABIS_FAQ.md)
- [knowledge/GPT_INSTRUCTIONS.md](knowledge/GPT_INSTRUCTIONS.md) · [knowledge/GPT_OPENAPI_SPEC.yaml](knowledge/GPT_OPENAPI_SPEC.yaml)

## Superpowers (plans & specs)
- [superpowers/plans/worker-inventory.md](superpowers/plans/worker-inventory.md) — generated CF worker inventory (CI-checked)
- [superpowers/plans/worker-status-2026-04-27.md](superpowers/plans/worker-status-2026-04-27.md)
- Plans & specs in `docs/superpowers/plans/` and `docs/superpowers/specs/`

## Reference
- [openapi.yaml](openapi.yaml) — API spec
- [archive/](archive/) — archived cf-workers bundles & misc session artifacts
- [submissions/](submissions/) — grant submission drafts

## AgentZ (separate tree, not under docs/)
- `agentz/` — Python workflow orchestrator. CLI: `python -m agentz.cli list` / `run <id> --mode dry-run`
- Conventions: [../GEMINI.md](../GEMINI.md) · State: [strategy/SYSTEM_STATE.md](strategy/SYSTEM_STATE.md)

---

### Notes
- CI-pinned files kept in place: `superpowers/plans/worker-inventory.md` (regenerated by `scripts/gen-worker-inventory.sh`, checked by `.github/workflows/repo-maintenance.yml`) and `superpowers/plans/worker-status-2026-04-27.md` (referenced by worker STATUS files).
- `docs/NETWORK.md`, `docs/CAPABILITIES.md`, `docs/DEPLOY-RUNBOOK.md` remain at docs root (mutually cross-referenced).
- `docs/SECURITY-REMEDIATION-CRITICAL.md` is referenced but not present in the repo — pre-existing dangling link.
