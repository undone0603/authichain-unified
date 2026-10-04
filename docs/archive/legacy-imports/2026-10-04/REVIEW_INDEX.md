# Legacy import review index

This index classifies the files recorded in
[`IMPORT_MANIFEST.json`](./IMPORT_MANIFEST.json). The manifest is the complete
file-level provenance and hash record; this document records the current
documentation disposition.

## Status definitions

- **Archive-only**: preserve as historical context; do not treat as current
  guidance.
- **Candidate**: may yield a verified, narrowly scoped addition after review
  against the listed canonical document.
- **Rejected**: do not promote because its implementation or product claims are
  stale or unverified.

## Review decisions

| Imported material                                                                                               | Status       | Canonical reference                                                                                    | Disposition                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `authichain-mvp/AI_AUTOFLOW.md`                                                                                 | Rejected     | [`docs/knowledge/AI_AUTOFLOW_STRATEGY.md`](../../../knowledge/AI_AUTOFLOW_STRATEGY.md)                 | Historical proposal with unverified implementation, schema, and performance claims.                                                   |
| `authichain-mvp/AUTHENTIC_ECONOMY.md`, `authichain-mvp/VISION.md`, and `authichain-mvp/outputs/*economy-map.md` | Archive-only | [`docs/AUTHENTIC_AGENTIC_ECONOMY.md`](../../../AUTHENTIC_AGENTIC_ECONOMY.md)                           | Historical positioning and economics; do not promote prices, deployment details, or implementation status.                            |
| `authichain-mvp/marketing/**` and `qron-mvp/marketing/**`                                                       | Archive-only | [`docs/OPERATING_CHARTER.md`](../../../OPERATING_CHARTER.md)                                           | Historical marketing and outreach material; it is not an active operating playbook.                                                   |
| `authichain-mvp/outputs/agentz-*.md`                                                                            | Archive-only | [`docs/CAPABILITIES.md`](../../../CAPABILITIES.md) and `agentz/`                                       | Historical agent descriptions; verify implementation against the capability catalog and code before reuse.                            |
| `authichain-mvp/marketing/strainchain/**` and `google-drive/strainchain_business_proposal.md`                   | Candidate    | [`docs/strategy/strainchain-genetics-passport.md`](../../../strategy/strainchain-genetics-passport.md) | Review only evidence-backed partner requirements; do not promote historical pricing, outreach, token, or compliance claims.           |
| `qron-mvp/**`                                                                                                   | Archive-only | [`docs/qron/`](../../../qron/) and [`docs/drive-import/specs/`](../../../drive-import/specs/)          | Historical auth, pricing, launch, and partner material. The Drive-imported QRON specifications remain the active imported references. |
| `google-drive/**` except the StrainChain proposal                                                               | Candidate    | [`docs/strategy/`](../../../strategy/) and [`docs/drive-import/specs/`](../../../drive-import/specs/)  | Extract only reviewed, source-supported facts; Google-native link stubs were intentionally not imported.                              |
| `authichain-archive/**`                                                                                         | Archive-only | [`docs/NETWORK.md`](../../../NETWORK.md) and [`docs/CAPABILITIES.md`](../../../CAPABILITIES.md)        | Historical workspace inventory, not product guidance.                                                                                 |
| `artifacts/legacy-media/**`                                                                                     | Candidate    | Production route selected per asset                                                                    | Preserve as source media. Do not wire into `public/` until a named page approves the asset.                                           |

All imported files not explicitly listed above are **archive-only** by default.
