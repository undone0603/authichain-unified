# Production issuer — live

Recorded 2026-09-18 after `AUTHICHAIN_ATTESTATION_KEY_ID` was added and #1043 shipped.
Updated 2026-09-19: public `/onboard` and `/story` are real dynamic handlers.

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
- `GET/POST https://authichain.com/onboard` — pilot intake (not a stub)
- `GET https://authichain.com/story/00000000-0000-4000-8000-000000000001` — launch-proof StoryMode

The private key stays on `authichain-edge-router`. Actions never needs `AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64`.
