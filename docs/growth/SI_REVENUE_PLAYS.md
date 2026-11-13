# SI knowledge to revenue: three evidence-gated sequences

This is a **draft-first, zero-cost, read-only implementation**, not a deployed sales system. It extends the existing `scripts/growth/buyer-signals.mjs` offer catalog; it does not change product prices or add paid infrastructure.

1. **Regulatory research → public source-cited DPP guide → free readiness check → optional $299 workspace.** Prioritize official EU DPP information, and qualify a real buyer before any individualized advice. The European Commission publishes an indicative schedule that includes 18 February 2027 for certain batteries: https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en . This is not a claim that an individual company must purchase.
2. **Agent knowledge graph → free MCP tutorial → live x402 offer discovery.** Use versioned, reviewed knowledge patterns from https://github.com/zby/commonplace to improve free integration evidence. Direct developers to https://signal.authichain.com/offer for current pricing; never send payment requests or claim an outside buyer without a settled receipt.
3. **QRON evidence lookup → honest share card → second independent verification.** Promote the public https://authichain.com/verify route with explicit issuer, source, unknowns and freshness. A QR code or signature never guarantees physical authenticity; only the recipient's opted-in share may be published.

**AI-generated research remains a hypothesis.** Seek explicitly warns that its content is AI-generated: https://www.talk-about.ai/ . The engine requires explicit review and distinct supporting evidence before changing promotion status. Its review flag is **self-attested**, not a fact-check performed by software. Source revision and actual buyer permission must be verified separately.

## Run without cloud spend

```bash
node --test scripts/ci/si-revenue-plays.test.mjs
node scripts/growth/si-revenue-plays.mjs docs/growth/si-revenue-plays.json
```

The output sorts source-linked, SHA-256-fingerprinted draft actions and retains the canonical DPP entry from the existing offer catalog. It rejects stale or malformed evidence, duplicate IDs, non-HTTPS/credentialed links, and claims of consent from public tenders. It **never fetches webpages, sends messages, writes files, creates payments, or counts customers**. Scores are ordinal priorities, not projected revenue.

## Promotion, conversion, and autonomy gates

- **Source gate:** maintain independent citations, observation date, explicit unknowns, review provenance and expiry. Do not bulk-copy others' copyrighted research.
- **Distribution gate:** publish only on user-controlled sites through protected CI; do not create cold-email/social spam. Public tenders produce research drafts, not implied consent.
- **Commerce gate:** free DPP completion → recorded opt-in → genuine $299 settled Checkout → signed Stripe webhook → durable atomic entitlement → authorized activation and service delivery. No claim of launch success from test payments or green CI.
- **Agent gate:** actual third-party free MCP calls and x402 settlement must be observed, not inferred from registry listings or owner tests.
- **Learning gate:** weekly critic compares source freshness and **real** buyer outcomes; retire stale or disproven hypotheses rather than self-rewarding on generated content.

**Deployment sequence:** Merge this PR only after its exact-head tests and actual repository protections. Keep source-only marketing work behind [#2490](https://github.com/undone0603/authichain-unified/pull/2490)'s legacy deployment-scope fix and [#2488](https://github.com/undone0603/authichain-unified/pull/2488)'s free MCP onboarding readiness. No production migration, charge, email, or deployment is authorized by this document.
