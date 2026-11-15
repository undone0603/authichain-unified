# Permissioned verification evidence sharing (draft copy)

**Status:** Documentation proposal only. No share-card endpoint, public badge, live integration, customer permission, or adoption metric is asserted here. Coordinate with [#2487](https://github.com/undone0603/authichain-unified/issues/2487) and the existing [free integration kit](https://github.com/undone0603/authichain-unified/pull/2488). Do not duplicate the kit's SDK/MCP examples.

## Copy for an owner-controlled README (after verifying the route)

> **Verify an AuthiChain record independently.** A verifier response describes an observed state at a specific time, not a certification that a physical item is genuine. Independently repeat verification at https://authichain.com/verify and inspect issuer, provenance, cryptographic signature, revocation state, and freshness. `not_found`, `unknown`, `unverified`, and `revoked` are not successful verification outcomes.

This copy may appear on an AuthiChain-owned documentation page after the public route is checked. Third-party sites, partner names, logos, product claims, endorsements, and customer-specific evidence require explicit permission. Do not automatically post, email, or share.

## Privacy-first fixture acceptance checklist

Use **synthetic public test data**, never a real customer's raw serial or private record. Before implementing a badge, OpenGraph preview, or share URL:

1. Check URL, HTML, OpenGraph metadata, logs, and analytics for customer email, raw private serial, access token, or identifying metadata; reject the fixture if any appear.
2. Display issuer, source, checked-at time (with timezone), evidence status, and reproducible independent verification instructions. Distinguish a valid cryptographic signature from physical authenticity.
3. Render negative/ambiguous statuses clearly; never collapse `not_found`, `unknown`, `unverified`, or `revoked` into a success badge. Treat stale evidence as stale.
4. Require an affirmative owner-controlled share action before publishing outside owned documentation. Record consent scope and allow revocation of publication without altering signed historical facts.
5. Preserve accessibility and plain-text fallback; never require a tracking pixel, cross-site identifier, wallet, or payment to independently check the example.

## Measurement without invented adoption

Track distinct stages separately: public discovery, successful **free independent verification**, explicit opt-in to integrate, independently observed third-party use, actual external settlement, and fulfilled authorized purchase. House wallets, bots, CI, test fixtures, unpaid checkout sessions, and self-reported counters are excluded from external-customer totals. Each claimed conversion needs a dated source, reproducible evidence, and a privacy-safe audit reference. Missing evidence means **unverified**, not zero or success.

**Release boundary:** This file alone does not authorize production publishing, source merges, customer communications, charges, payment activation, or changes to `humanHold` / `production_send=false`. Use exact-head CI and enforced protected review/release rules.
