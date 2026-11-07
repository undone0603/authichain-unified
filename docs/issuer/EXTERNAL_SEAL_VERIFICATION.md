# External signed SEAL reproduction (AuthiChain x402)

This is a **point-in-time cryptographic check** of a third-party credential; it is NOT an AuthiChain-issued Service SEAL or external independent security approval.

- External source: `https://api.sealkeeper.run/v1/agents/nzfO6WZVv2Adb_YNv9rJTcavydNDE-T9ybHAyubvrYc/seal`
- Key source: `https://sealkeeper.run/.well-known/seal.json`
- Credential SHA-256: `6738e3b140adde0ad461c12b98134591dafe6a878f3716bf9461e85955aeff63`
- Pinned public JWKS SHA-256: `0017e47295b9de3b466a5554824881a251ba591da4e9b113a27298746a4d2960` (compact JSON representation)
- Service ID: `nzfO6WZVv2Adb_YNv9rJTcavydNDE-T9ybHAyubvrYc`
- Issuer: `sealkeeper.run`, issuer key ID `k1`, SEAL standard `ver=9`.
- Issued Unix seconds `1794013748`; expires `1794100148` (maximum 24-hour lifetime).
- Signed evidence describes **27 unpaid x402 challenge checks**, `challenge_valid=27`, `wallet.proven=false`; owner status is issuer-reported verified; standing `bronze` is **issuer's claim**, not a conclusion independently scored by AuthiChain.
- Offline Ed25519 verification with the **explicit pinned SealKeeper public key** succeeds at historical issuance time `now=1794013749`, and fails closed after expiry. A tampered signature, wrong issuer, wrong subject, unsupported algorithm, wrong evidence interface and invalid paid-flag are rejected.
- No paid transaction, escrow, wallet control, agent/tool execution, physical product authenticity, regulatory compliance or independent acceptance by SealKeeper of AuthiChain as an issuer is proved by this signed snapshot.
- The code is a **subset verifier** covering the signature and critical evidence semantics; it deliberately does not claim to implement all SEAL v9 validity/standing rules. Additional full-schema conformance work is still required.

Run offline in the bundle root on Node 22 (no install):

```sh
node --test protocol/evidence-seal.test.mjs protocol/third-party-service-seal.test.mjs scripts/evidence-seal-demo-server.test.mjs
```

At live time, fetch the current credential from the external API; the snapshot expires and must never be displayed as a live verified badge after the expiry time.