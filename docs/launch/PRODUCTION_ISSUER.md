# Production issuer — live

Recorded 2026-09-18 after `AUTHICHAIN_ATTESTATION_KEY_ID` was added and #1043 shipped.

```json
{
  "contract": "AuthiChain Attestation Contract v0.1",
  "alg": "EdDSA",
  "crv": "Ed25519",
  "kid": "lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE",
  "issuer": "https://authichain.com",
  "jwks": "https://authichain.com/protocol/jwks.json",
  "ready": true,
  "signing": true
}
```

Public endpoints:

- `GET https://authichain.com/protocol/issuer.json`
- `GET https://authichain.com/protocol/jwks.json`
- `GET https://authichain.com/.well-known/jwks.json`
- `POST https://authichain.com/protocol/launch-proof` (GitHub Actions OIDC or `CRON_SECRET`)

The private key stays on `authichain-edge-router`. Actions never needs `AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64`.
