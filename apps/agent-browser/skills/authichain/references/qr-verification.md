# QR Code Verification Reference

## Contents
1. [Signal Hierarchy](#signal-hierarchy)
2. [Cryptographic Verification](#cryptographic-verification)
3. [Redirect Chain Analysis](#redirect-chain-analysis)
4. [Tamper Indicators](#tamper-indicators)
5. [Verdict Mapping](#verdict-mapping)

## Signal Hierarchy

Collect signals in this order (strongest → weakest):

| Priority | Signal | Weight |
|----------|--------|--------|
| 1 | Valid cryptographic signature on payload | +0.4 |
| 2 | Blockchain anchor reference verified | +0.3 |
| 3 | Expiry timestamp present and valid | +0.15 |
| 4 | HTTPS destination, no redirect chain | +0.1 |
| 5 | Hologram/seal indicator in DOM | +0.05 |
| — | No signature present | -0.3 |
| — | Redirect to different domain | -0.2 |
| — | Expired timestamp | -0.25 |
| — | Non-HTTPS destination | -0.2 |

## Cryptographic Verification

### What to look for in the page
```
data-qr-signature="..."          → ECDSA/RSA signature over payload
data-qr-algorithm="ECDSA-256"   → Algorithm identifier
data-qr-issued-at="..."         → ISO 8601 issue timestamp
data-qr-expires-at="..."        → ISO 8601 expiry
data-qr-anchor="0x..."          → Blockchain transaction hash
data-qr-issuer="did:web:..."    → Issuer DID
```

### Verification steps
1. Extract `data-qr-signature` and `data-qr-payload`
2. Check algorithm is RSA-3072, ECDSA-256, or ML-DSA (post-quantum)
3. Verify expiry > current timestamp
4. If blockchain anchor present: note the tx hash as supporting evidence

## Redirect Chain Analysis

Trace the full URL path before flagging:
- Single HTTPS redirect (www → non-www): **acceptable**
- HTTP → HTTPS upgrade: **acceptable**
- Cross-domain redirect: **suspicious** — flag as `redirect-chain-cross-domain`
- Multiple hops (3+): **suspicious** — flag as `redirect-chain-excessive`
- Final destination ≠ advertised brand domain: **tampered** — flag as `destination-domain-mismatch`

## Tamper Indicators

Flag any of these:
- `qr-code-overprint` — Visual overlay detected on top of original QR
- `signature-missing` — No `data-qr-signature` attribute
- `signature-malformed` — Signature present but not base64url encoded
- `expiry-violated` — Current time > expiry timestamp
- `anchor-unverified` — Blockchain anchor reference not resolvable
- `issuer-unknown` — Issuer DID does not resolve to known root
- `homograph-domain` — Domain contains look-alike Unicode characters

## Verdict Mapping

| Signal combination | Verdict | Confidence range |
|---|---|---|
| Signature valid + anchor verified + not expired | authentic | 0.92–1.0 |
| Signature valid + not expired, no anchor | authentic | 0.80–0.90 |
| No signature, HTTPS, no redirect | inconclusive | 0.40–0.55 |
| No signature + redirect chain | suspicious | 0.20–0.40 |
| Signature invalid OR expired OR homograph | tampered | 0.05–0.25 |
