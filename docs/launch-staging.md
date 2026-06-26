# Launch Staging — Distribution Assets (ready to publish)

Everything here is **staged and verified**. Posting to external platforms is the only
human-gated step (outward/irreversible). Capture pipeline is verified working.

## ✅ Capture pipeline status
- `marketing.createLead` tRPC path → `lead_captures` table: **verified (test passes)**.
- Funnel: Visitor → Sign-up → Activated → Trial → Paid (funnel-tracking.md).
- Lead scoring + nurture handlers present (`authichain_growth_loop`, `lead-scoring`).
- **Implication:** traffic will not leak — inbound is captured, scored, and nurtured automatically.

## 📣 Staged community posts (status: ready)
| File | Channel | Audience | CTA |
|---|---|---|---|
| `content/launch/strainchain_reddit.md` | r/cannabis, r/MichiganCannabis | MI dispensary operators / MSOs | strainchain.io + $199 buy link |
| `content/launch/qron_reddit_v3.md` | r/QRcode, r/generative | designers, brand/maker | qron.space free generator |
| `content/launch/govchain_twitter.md` | X (govchain) | govtech / procurement | govchain.us |
| `content/launch/authichain_linkedin.md` | LinkedIn | brand-protection / luxury / pharma | authichain.com |

Post copy is written value-first (community-appropriate, not spammy). **Publish gate: human.**

## 🔎 SEO content (LM Studio–generated, ready for page metadata)

### AuthiChain — authichain.com
- **Title:** AI-Powered Blockchain Product Authentication — AuthiChain
- **Meta:** Verify authenticity of luxury goods, pharma, electronics & more with AuthiChain's AI-driven blockchain. EU DPP compliant, verifies in under 2 seconds. From $49/mo.
- **Keywords:** product authentication, AI, blockchain, verification, luxury goods, pharmaceuticals, DSCSA
- **H1:** Secure Your Brand with AuthiChain's AI-Powered Blockchain Solution

### StrainChain — strainchain.io
- **Title:** StrainChain — Blockchain Provenance for Cannabis | Verified Chain of Custody
- **Meta:** Blockchain provenance for cannabis. Integrates with METRC & BioTrack; lab certs anchored to Bitcoin Ordinals; QR scan verifies chain of custody. For dispensaries & MSOs. From $199/mo.
- **Keywords:** cannabis provenance, chain of custody, METRC, BioTrack, Bitcoin Ordinals
- **H1:** Empower Your Business with StrainChain's Blockchain Provenance

### GovChain — govchain.us
- **Title:** Secure On-Chain Government Document Verification with GovChain
- **Meta:** Verify government documents instantly with Bitcoin-anchored hashes for permits, certificates, RFP awards. Works offline, no central authority. SBIR/SVIP eligible.
- **Keywords:** government document verification, on-chain, Bitcoin, QR verification, SBIR, SVIP
- **H1:** Verify Government Documents Instantly and Securely with GovChain

### QRON — qron.space
- **Title:** Create AI Living QR Art with QRON — Scannable Art Generator
- **Meta:** AI-powered living QR codes. Editable redirects, scan analytics, Ed25519-signed and Polygon-anchored. From $5 one-off or $99/mo.
- **Keywords:** AI art, QR code generator, living QR art, generative art, Polygon
- **H1:** Welcome to the Future of Art — QRON

## Next (human-gated) steps
1. Approve + post the community content (start: Reddit-cannabis, highest fit).
2. Apply SEO metadata to each brand's homepage `<head>` / Next metadata.
3. (Optional, paid) Google/Meta ads for fastest real traffic — spends money, your call.
