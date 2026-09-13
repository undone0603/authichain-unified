# Nightstamp automation

## Runtime contract

Nightstamp is now deterministic-first. The QR payload is generated with ECC-H and the QR image is kept intact. The star field is rendered around the QR with local Jimp composition, so an AI image service is not on the critical path.

Supported styles:

- `navy-gold`
- `parchment`
- `glow`

A future ComfyUI/QR Code Monster adapter may be used as an optional art enhancer, but its output must never become the source of truth. Any generated candidate must be decoded against the expected `https://qron.space/sky/{id}` payload before delivery.

## Marketing loop

1. Stripe purchase creates/fulfills the Nightstamp.
2. The Memory Portal exposes `Create your own Nightstamp` with a portal referral token.
3. `POST /api/starmap/marketing` produces channel-specific copy and a referral URL.
4. `automation/n8n/nightstamp-marketing.json` can be imported into self-hosted n8n.
5. The resulting queue can be connected to Postiz or another publisher using official APIs/OAuth. Do not scrape social platforms.

Postiz is a useful optional publishing layer because its open-source project documents API and n8n integration support; keep publishing credentials in n8n, not in the QRON app.

## Use-case matrix

| Segment | Offer | CTA |
|---|---|---|
| Couples | Wedding / anniversary Nightstamp | `/starmap` |
| New parents | Birth-night keepsake | `/starmap` |
| Families | Memorial star map | `/starmap` |
| Photographers | $29 portal + referral commission | `/qron/star-map-for-wedding-photographers` |
| Venues | Event-specific branded sky | `/starmap` |
| Product brands | "Bottle under this sky" | `/starmap` |
| StrainChain | Harvest sky add-on | `/starmap` |

## SEO pages

Programmatic landing pages live under `/qron/*` for star-map QR, wedding, anniversary, birth, memorial, custom QR, and photographer searches.

## Environment boundary

No Fal key is required for Nightstamp rendering. If an optional AI renderer is added later, gate it behind an explicit provider flag and run QR decode validation before replacing any customer-facing asset.
