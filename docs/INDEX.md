# AuthiChain Unified — Docs Index

_Navigable map of the documentation estate. The canonical production repository is `undone0603/authichain-unified`._

## Start here

- [README.md](../README.md) — canonical product, production source, North-Star MVP and trust boundary
- [CLAUDE.md](../CLAUDE.md) — AI context, essential commands, architecture summary
- [GEMINI.md](../GEMINI.md) — AgentZ autonomous launch conventions
- [AGENTS.md](../AGENTS.md) — repository agent rules
- [project/START_HERE.md](project/START_HERE.md) — conversion funnel tracking quickstart
- [project/todo.md](project/todo.md) — platform TODO / progress tracker

## Canonical verification

- [strategy/NORTH_STAR_MVPS.md](strategy/NORTH_STAR_MVPS.md) — MVP sequence and definition of done
- [strategy/NORTH_STAR_VERIFICATION_INTEGRATION.md](strategy/NORTH_STAR_VERIFICATION_INTEGRATION.md) — canonical response propagation rules
- [attestation/v0.1.md](attestation/v0.1.md) — attestation contract
- [knowledge/VERIFICATION_GUIDE.md](knowledge/VERIFICATION_GUIDE.md) — verification semantics
- [knowledge/RELIABILITY_ARCHITECTURE.md](knowledge/RELIABILITY_ARCHITECTURE.md) — reliability and financial integrity notes

## Architecture & deployment

- [ESTATE.md](ESTATE.md) — canonical production source and Worker ownership map
- [NETWORK.md](NETWORK.md) — deployment topology
- [CAPABILITIES.md](CAPABILITIES.md) — capability catalog
- [DEPLOY-RUNBOOK.md](DEPLOY-RUNBOOK.md) — deployment paths and per-worker secrets
- [architecture/ADR-001-deploy-target-and-auth.md](architecture/ADR-001-deploy-target-and-auth.md)
- [architecture/decoupling.md](architecture/decoupling.md)
- [architecture/platform-robustness.md](architecture/platform-robustness.md)
- [architecture/config-standardization.md](architecture/config-standardization.md)
- [architecture/threat-model.md](architecture/threat-model.md)

## Operations

- [operations/CLOUDFLARE_FIRST_BASELINE.md](operations/CLOUDFLARE_FIRST_BASELINE.md) — Cloudflare deployment authority and smoke/repair loop
- [architecture/THIN_COMMERCIAL_SURFACES.md](architecture/THIN_COMMERCIAL_SURFACES.md) — brand sites stay thin; verification is shared
- [operations/PILOT-READY-BASELINE.md](operations/PILOT-READY-BASELINE.md) — engineering acceptance gate for the first real-product pilot
- [operations/INTEGRATION_CHECKLIST.md](operations/INTEGRATION_CHECKLIST.md) — lead-scoring deploy checklist
- Stripe operations: `operations/stripe-webhook-*`
- [operations/remote-control.md](operations/remote-control.md) — manual remote-control lane, not an autonomous deployment loop

## Strategy

- [strategy/ROADMAP.md](strategy/ROADMAP.md) — autonomous evolution roadmap
- [strategy/REVENUE_STRATEGY.md](strategy/REVENUE_STRATEGY.md) — pricing, grants, partnerships
- [strategy/SYSTEM_STATE.md](strategy/SYSTEM_STATE.md) — AgentZ state snapshot
- [strategy/ARCHITECTURE_OVERVIEW.md](strategy/ARCHITECTURE_OVERVIEW.md) — architecture history/reference
- [strategy/TECHNICAL_COMPETITIVE_SUPERIORITY.md](strategy/TECHNICAL_COMPETITIVE_SUPERIORITY.md)
- [strategy/AUTHENTICITY_INDEX.md](strategy/AUTHENTICITY_INDEX.md)
- [strategy/NORTH_STAR_MVPS.md](strategy/NORTH_STAR_MVPS.md)

## Product surfaces

- `apps/qron-platform/README.md` — QRON surface retained inside the canonical repository; not a separate production source
- `agentz/README.md` — AgentZ control plane and canonical verification consumption
- `protocol/README.md` — offline/reference protocol verifier and its boundary with the live worker

## Integrations

- [integrations/hubspot.md](integrations/hubspot.md)
- [integrations/openclaw-setup.md](integrations/openclaw-setup.md)

## Compliance and research

- [compliance/EU_DPP_COMPLIANCE_AUDIT.md](compliance/EU_DPP_COMPLIANCE_AUDIT.md)
- [project/competitor-research-report.md](project/competitor-research-report.md)
- [project/competitor-research-progress.md](project/competitor-research-progress.md)

## Knowledge base

- [knowledge/PRICING_TIERS.md](knowledge/PRICING_TIERS.md)
- [knowledge/RELIABILITY_ARCHITECTURE.md](knowledge/RELIABILITY_ARCHITECTURE.md)
- [knowledge/VERIFICATION_GUIDE.md](knowledge/VERIFICATION_GUIDE.md)
- [knowledge/AI_AUTOFLOW_STRATEGY.md](knowledge/AI_AUTOFLOW_STRATEGY.md)
- [knowledge/MARKETING_AUTOMATION.md](knowledge/MARKETING_AUTOMATION.md)
- [knowledge/OPERATIONAL_TIMELINE.md](knowledge/OPERATIONAL_TIMELINE.md)
- [knowledge/QRON_STYLES.md](knowledge/QRON_STYLES.md)
- [knowledge/CANNABIS_FAQ.md](knowledge/CANNABIS_FAQ.md)

## Reference

- [openapi.yaml](openapi.yaml) — API spec
- [archive/](archive/) — archived bundles and session artifacts
- [submissions/](submissions/) — grant submission drafts

## AgentZ

- `agentz/` — Python workflow orchestrator. CLI: `python -m agentz.cli list` / `run <id> --mode dry-run`
- Conventions: [../GEMINI.md](../GEMINI.md) · State: [strategy/SYSTEM_STATE.md](strategy/SYSTEM_STATE.md)

---

### Documentation hygiene

- Keep production claims tied to the current canonical repository and validated deployment evidence.
- Do not present historical/superseded sibling repositories as production authorities.
- CI-pinned inventory files remain machine-generated and should only change through their generating workflow.
