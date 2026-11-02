# TruMark platinum photo-evidence reader — production-hosted pilot

**Live:** https://authichain-trumark-pt25.undone-k.workers.dev/

**Machine JSON:** https://authichain-trumark-pt25.undone-k.workers.dev/api/observation

**Source:** `workers/trumark-pt25-evidence/src/index.js` from PR #2300.

## Boundary
This is a *read-only, redacted, immutable photo-evidence observation*; it is **not** independent metal authentication, manufacturer verification, an issued digital certificate, or a production-signed claim. The status remains `EVIDENCE_ONLY_UNVERIFIED`. It has no database, writable endpoints, user-upload mechanism, secrets, external JS, or third-party issuer credentials. The full unit serial and the original photographs are not deployed.

The public service includes record SHA-256 values for the source images. These establish exact-photo byte comparison, not truth of photographed claims.

## Public deployment evidence — 2026-11-02
- Cloudflare Worker: `authichain-trumark-pt25` (isolated from the main AuthiChain production router).
- Workers.dev endpoint enabled; no custom production app route changed.
- Cloudflare deployment `d7858746-5e38-45c6-81e9-19e002bd3ccf`, version `b139b39e-4c26-4c44-9eb1-4c0bef7ed770`, API-created on 2026-11-02, serving 100% traffic per Cloudflare deployment API.
- Separate external HTTP read via TinyFish fetched both HTML and `/api/observation`; observed `EVIDENCE ONLY — NOT AUTHENTICATED` and `EVIDENCE_ONLY_UNVERIFIED`. This is public endpoint accessibility evidence, not materials verification or independent code audit.
- Source case status: PR #2300 remains a draft; CI/independent review may still be pending.

## TruMark print QR
The separate-sleeve printable QR encodes only `https://authichain-trumark-pt25.undone-k.workers.dev/`. No serial or buyer personal data.

Local OpenCV `QRCodeDetector.detectAndDecode` checks: standalone QR, full printable card and downscaled card each decoded to the exact URL (3/3). No real-world camera/print conditions have yet been independently tested.

## Vision notes
Images submitted by the owner: front 1152×1536 px and back 1536×1152 px. Manual vision review sees Valcambi-style diamond emblem, `platinum` `999.5` markings and assay-style packaging; image compression, small text, and glare limit microscopic detail. Hash and image-quality metrics cannot establish physical authenticity. Contrast/sharpness-enhanced crops for *private review only* are NOT substitute original evidence.

## Next controlled milestone
Obtain independent physical inspection and report with bar and certificate serial comparison, non-destructive platinum measurement if supported, apparatus/method and limits, date and examiner identity. Then perform issuer-authorized signed record issuance under the existing AuthiChain trust kernel, with no Valcambi impersonation; separately distinguish record integrity from physical genuineness. Do not fake a GS1 identifier or upgrade a photo-only record to `verified`.

## Test and deployment
`node --test protocol/samples/physical-assets/valcambi-pt25.test.mjs`

Development deploy (do not overwrite existing live service without review):
`cd workers/trumark-pt25-evidence && npx wrangler deploy`

The live deployment was made directly by Cloudflare API from the equivalent classic service-worker source. No main authichain.com deployment or D1 mutation occurred.
