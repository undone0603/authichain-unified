# SAMPLE-ONLY protocol passport (ADM-256 Item 3)

Title: SAMPLE ONLY — fictional AuthiChain passport (not a live product) <!-- pragma: allowlist secret -->
Issuer: Issuer did:key (SAMPLE — not the AuthiChain production issuer): did:key:z6MknvZLpAxf4Z1rbs2tNiv3pwwygwBEk6ivASSi6FpYt8Mp <!-- pragma: allowlist secret -->
Banner: FICTIONAL SAMPLE — for dogfood/demo labels only. Not a production attestation. Do not treat as a real product seal. <!-- pragma: allowlist secret -->
Footer: Generated SAMPLE-ONLY Ed25519 · private key never published · ADM-256 Item 3

## Ship rule

This did:key must never appear in production JWKS/issuer docs. <!-- pragma: allowlist secret -->

It is a SAMPLE-ONLY issuer for dogfood/demo labels. It is not the AuthiChain production issuer (`docs/launch/PRODUCTION_ISSUER.md`, kid `T3AL7c4w…`). Do not add it to live JWKS, `/protocol/issuer.json`, Workers secrets, or attestation keys. <!-- pragma: allowlist secret -->

## Files

- [`ISSUER.json`](./ISSUER.json) — public SAMPLE-ONLY issuer metadata and Ed25519 public JWK. No private key.
- [`passport.sample.json`](./passport.sample.json) — labelled fictional passport (unsigned).
- [`sign-sample-passport.mjs`](./sign-sample-passport.mjs) — optional signer. Does not generate or print a key.

## Signing (optional)

The committed sample is unsigned. A matching signature needs the SAMPLE-ONLY Ed25519 private key, which is never published.

Use one of:

```bash
# CI / Actions: secret already bound (do not invent or print a PEM)
SAMPLE_PASSPORT_SIGNING_KEY="$SAMPLE_PASSPORT_SIGNING_KEY" \
  node protocol/samples/sign-sample-passport.mjs

# Local: path to an existing SAMPLE-ONLY PEM you already hold
SAMPLE_SIGNING_KEY_PEM_FILE=/path/to/sample-only.pem \
  node protocol/samples/sign-sample-passport.mjs
```

The script refuses to run if neither is set, if the material is not Ed25519, or if the derived did:key is not `did:key:z6MknvZLpAxf4Z1rbs2tNiv3pwwygwBEk6ivASSi6FpYt8Mp`. It writes `passport.signed.json` and never prints the key.

`$0`. No Worker deploy. No wrangler. No production JWKS change. <!-- pragma: allowlist secret -->
