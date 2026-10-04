# QRON (qron.space) — Economy Map

_Generated: 2026-04-07 | Source: Stripe Live + Codebase Audit_

---

## 1. SUBSCRIPTION TIERS

| Tier           | Monthly   | Seals/mo | Features                                            |
| -------------- | --------- | -------- | --------------------------------------------------- |
| **Free**       | $0        | 3        | Basic styles, watermarked                           |
| **Starter**    | $99/mo    | 5,000    | Dashboard, 1 team member                            |
| **Growth**     | $299/mo   | 25,000   | AI Product Stories, 5 team, API access              |
| **Scale**      | $999/mo   | 15,000   | AR experiences, unlimited team, custom integrations |
| **Enterprise** | $1,499/mo | 50,000+  | White-label, SLA, on-premise deploy, 24/7 support   |

---

## 2. ONE-TIME PURCHASES

### Credit Packs

| Pack          | Credits | Price  | Per-Credit |
| ------------- | ------- | ------ | ---------- |
| 50 Credits    | 50      | $9.99  | $0.20      |
| 250 Credits   | 250     | $39.99 | $0.16      |
| 1,000 Credits | 1,000   | $99.99 | $0.10      |

### Design Services

| Product                | Price |
| ---------------------- | ----- |
| Single AI QR Design    | $9    |
| Brand Pack (3 Designs) | $29   |
| Brand Pack (5 Designs) | $199  |
| Custom QRON Standard   | $49   |
| Custom QRON Premium    | $99   |
| Custom QRON Elite      | $249  |
| Custom Portal          | $35   |

### Story Mode Upsell

| Tier  | Price | Features                                                       |
| ----- | ----- | -------------------------------------------------------------- |
| Basic | $19   | Custom title, tagline, 1 CTA, theme colors                     |
| Pro   | $49   | Animated bg, 3 scenes, brand narrative, 3 CTAs                 |
| Elite | $99   | AI-written copy, video embed, scan analytics, unlimited scenes |

### Bitcoin Ordinals

| Product                        | Price |
| ------------------------------ | ----- |
| QRON Ordinal (single)          | $49   |
| QRON Genesis Ordinal           | $49   |
| 25-Piece Enterprise Collection | $799  |

---

## 3. GENERATION TIERS (inference)

| Mode       | Steps | Quality | Access     |
| ---------- | ----- | ------- | ---------- |
| Standard   | 4     | Good    | Free tier  |
| Premium    | 8     | Better  | Creator+   |
| Enterprise | 12    | Best    | Enterprise |

### 11 AI Styles

Pixel, Neon, Minimal, Stained Glass, Cyberpunk, Botanical,
Watercolor, Art Deco, Cosmic, Geometric, Vintage

---

## 4. WEBHOOK FULFILLMENT

**File:** `app/api/webhook/route.ts`

On `checkout.session.completed`:

- `type=story_mode` → sets `story_enabled`, `story_tier`, `story_unlocked_at`
- `type=credits` → adds to `qron_generations.credits_remaining`
- `type=subscription` → creates/updates subscription record

---

## 5. ENTITLEMENTS

| Feature        | Free | Starter | Growth | Enterprise |
| -------------- | ---- | ------- | ------ | ---------- |
| QR Generation  | 3/mo | 5K/mo   | 25K/mo | 50K+       |
| Premium Styles | -    | -       | All 11 | All 11     |
| Story Mode     | -    | Basic   | Pro    | Elite      |
| API Access     | -    | -       | Yes    | Yes        |
| White-label    | -    | -       | -      | Yes        |
| AR Experiences | -    | -       | -      | Yes        |

---

## 6. CROSS-PLATFORM CONNECTIONS

- `QRON_AUTHICHAIN_KEY` — shared secret for cross-service auth
- `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` — same AuthiChainNFT contract on Polygon
- QRON-generated QR codes can link to AuthiChain verify pages
- Story Mode content feeds into AuthiChain StoryMode pipeline
- Bitcoin Ordinals use shared OrdinalsBot integration

---

## 7. REVENUE STREAMS

| Stream           | Model     | Range           |
| ---------------- | --------- | --------------- |
| Subscriptions    | Recurring | $99 - $1,499/mo |
| Credit Packs     | One-time  | $9.99 - $99.99  |
| Design Services  | One-time  | $9 - $249       |
| Story Mode       | One-time  | $19 - $99       |
| Bitcoin Ordinals | One-time  | $49 - $799      |
| Custom Portals   | One-time  | $35             |
