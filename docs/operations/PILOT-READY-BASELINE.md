# AuthiChain Pilot-Ready Baseline

This document defines the minimum engineering baseline before an AuthiChain real-product pilot.

## 1. CI quality gate

Every push and pull request targeting `main` must pass:

1. `pnpm install --frozen-lockfile`
2. `pnpm check`
3. `pnpm lint:ci`
4. `pnpm -w test` (or `pnpm test` for the main workflow)
5. `pnpm build`

This gate is intentionally independent of Vercel. A Vercel deployment-rate or capacity failure must not be mistaken for an application build failure.

## 2. Deployment architecture

The unified Next.js network app is deployed through Vercel, with Cloudflare providing edge/fronting services and separately managed workers. `docs/NETWORK.md` is the canonical deployment map.

Vercel status failures such as `build-rate-limit` are classified as infrastructure/deployment-capacity events. They are not dependency regressions unless an application build is actually executed and fails for application-specific reasons.

## 3. Attestation contract

The pilot uses AuthiChain Attestation Contract v0.1:

- provider-scoped `object_id`;
- optional `gtin`, `serial`, and `lot` subject identifiers;
- explicit `decision`: `verified`, `warning`, or `blocked`;
- explicit `status`: `active`, `revoked`, or `unknown`;
- deterministic JSON canonicalization;
- Ed25519/EdDSA compact JWS;
- public verification through JWKS.

The cryptographic verifier proves payload integrity and issuer-key control. It does not by itself prove that a physical item carrying a copied QR or transferred label is the same subject. Physical identity continuity requires registry/evidence checks.

## 4. Adversarial acceptance tests

The conformance suite must cover:

- tampered payload/signature;
- wrong `kid` or verification key;
- malformed JWS structure;
- unsupported JWS algorithm/type;
- missing issuer identity;
- empty provider-scoped object ID;
- malformed GTIN/serial/lot fields;
- malformed or missing evidence;
- invalid expiry windows;
- explicit warning/blocked decisions;
- revoked/unknown status;
- subject continuity fields (`object_id`, GTIN, serial/lot) preserved through verification.

The suite must not claim that a valid signature alone detects QR copying or label transfer. Those cases require an issuer registry and evidence-continuity policy.

## 5. Pilot execution gate

A pilot is ready when all of the following are true:

- repository CI is green;
- production build succeeds independently of Vercel;
- deployment targets match `docs/NETWORK.md`;
- the attestation conformance suite is green;
- a real product has a unique subject mapping;
- a scan produces a verification result with issuer, subject, evidence, decision, status, and timestamps;
- at least one negative case (tampered, revoked, expired, warning, blocked, or subject mismatch) is demonstrated end-to-end;
- scan and verification events are retained for audit.

## 6. Demo/licensing evidence

For each pilot product, retain:

- product/subject identifier;
- issued attestation JWS;
- public verification key/JWKS reference;
- evidence references and digests;
- scan timestamp;
- verification result;
- negative-test result;
- deployment/version identifier.

This package becomes the technical evidence set for licensing demos and partner due diligence.
