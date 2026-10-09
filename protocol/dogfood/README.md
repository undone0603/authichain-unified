# DOGFOOD-IDENTITY-V1: signed bot output

A bot's outbound text (post, email) is signed with that bot's own Ed25519 key
and checked by this repo's reference verifier before it goes out. Failure =
blocked.

- `bot-output.mjs`: canonical payload, verifier, ledger and qualification
  rules. Zero dependencies, offline. Pinned by `PIN.json` (sha256).
- `registry.json`: public keys + kid per bot. No private material, ever. Bots
  are `pending` until Zac binds their key secret and the public JWK is added
  here by PR.
- `cli.mjs`: `verify`, `live`, `append`, `ledger-check`, `qualify`.
- Signing endpoint: `worker-app/bot-signer.ts` (not mounted).

Signed payload (`aco-bot-sig/1`), signed as RFC 8785 JCS bytes:

    {"bot","channel","content_bytes","content_sha256","kid","nonce","ts","v"}

Bot keys are published at exactly
`https://authichain.com/api/v1/.well-known/bot-jwks.json` and matched by kid.
The root `/.well-known/jwks.json` serves the attestation key and is rejected.

A valid signature proves which bot sent the bytes. It does not prove the text
is true: Research's claims gate and FEDERAL-CLAIMS-RULE still apply.
