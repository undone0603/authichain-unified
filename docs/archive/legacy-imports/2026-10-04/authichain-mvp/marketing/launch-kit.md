# Launch Kit — No-Sales-Calls Cold Traffic Bursts

Three one-shot launches to drive cold traffic into the self-serve
checkout funnels you already have. Each one is pre-written and can be
fired in ~30 minutes. None of them involve a sales call.

## The three launches

| #   | Platform                                | Product                      | Ask                           | Expected result                            |
| --- | --------------------------------------- | ---------------------------- | ----------------------------- | ------------------------------------------ |
| 1   | **Product Hunt**                        | QRON.space (AI QR art)       | Upvote + comment              | 500–5k visitors in 24h, 10–100 signups     |
| 2   | **Show HN**                             | AuthiChain API               | Upvote + technical discussion | 1k–10k visitors, 50–500 RapidAPI signups   |
| 3   | **Reddit r/Bitcoin + r/CryptoCurrency** | Bitcoin Ordinal custom QRONs | Upvote + direct purchase      | 500–3k visitors, 5–30 direct $49 purchases |

**Critical rule: do NOT launch all three on the same day.** Space them
one week apart so you can respond to each one's comment thread
individually. Comment response quality is the single biggest driver of
launch success.

## Prerequisites (do these first)

- [ ] QRON pricing page bug fixed ✅ (committed in `a3ec874`)
- [ ] `lib/plans.ts` is the single source of truth for prices
- [ ] RapidAPI listing submitted and LIVE (required for launch #2)
- [ ] Product Hunt account warmed up (at least 50 upvotes given, profile
      filled out — fresh accounts get throttled)
- [ ] Hacker News account at least 30 days old with some comment history
      (fresh accounts get shadow-banned)
- [ ] The 3 Reddit subs you'll post to — lurk for a week first, make 5
      genuine comments, THEN post

---

## Launch #1 — Product Hunt: QRON.space

**Scheduled for:** Week 1 (after pricing page fix is live)

**Tagline (60 char max):**

```
Beautiful AI QR codes, signed on blockchain
```

**Description (260 char max):**

```
QRON turns boring QR codes into AI-generated art that's 100% scannable
and signed on AuthiChain. Upload a brand, pick a style (cyberpunk,
luxury, watercolor, graffiti + 7 more), get an artistic QR. From $29
one-time. Bitcoin Ordinal inscriptions from $49.
```

**Gallery (5 images required):**

1. Hero: a dramatic QRON next to a boring QR, side-by-side
2. Style gallery: the 11 visual modes in a grid
3. "How it works": upload → describe → generate → scan
4. Bitcoin Ordinals section: "permanent on Bitcoin L1"
5. Pricing screenshot (the fixed one from commit `a3ec874`)

**Maker first comment (post immediately after launch):**

```markdown
Hey Product Hunt! 👋

I built QRON because every QR code I've ever seen looks like a bar-code
rejection from 1994. But QR codes are supposed to be the bridge between
the physical and the digital — why do they all look so ugly?

QRON fixes this. You describe a brand ("Nike swoosh, cyberpunk red"),
pick a style, and QRON generates an AI QR code that's actually beautiful
AND 100% scannable. It uses a pixel-clamping trick to preserve
scannability even at heavy stylization.

**Three things I'm proud of:**

1. **Every QRON is signed on AuthiChain** (ERC-721 on Polygon) so
   you can prove provenance. Useful for brands protecting against
   counterfeit scans.
2. **Bitcoin Ordinal tier** — inscribe your QRON permanently on Bitcoin
   L1 for $49. Shows up on ordinals.com, tradeable on Magic Eden.
3. **11 visual modes** — cyberpunk, luxury, watercolor, graffiti,
   portrait, miniature, geometric, memory, holographic, NFT mint, static.

**Free tier** gives you 10 generations/month. First 100 PH users get a
free Starter Pack (100 generations, normally $29) — DM me your email.

I'll be in the comments all day. Ask me anything about scannability
thresholds, Fal.ai, the pixel-clamping algorithm, Bitcoin inscription
flow, or why I built this.

Links:

- Live site: https://qron.space
- Pricing: https://qron.space/pricing
- Gallery: https://qron.space/gallery
```

**Prepared answers for expected questions:**

- _"How is this different from a regular QR code?"_ → Visual mode
  generation + blockchain signing + pixel-clamping for scannability.
- _"Does it actually scan?"_ → Yes, 100% by design. We use a clamping
  algorithm that preserves the QR data modules even at heavy AI
  stylization. Show a scan video.
- _"What's the AuthiChain part?"_ → Every QRON gets an ERC-721 cert on
  Polygon at generation time. Optional Bitcoin Ordinal inscription for
  premium tiers. Gives provenance for brand protection.
- _"How does pricing work?"_ → One-time packs ($29/$99/$299) never
  expire. Business tier ($49/mo) is unlimited. Free tier is 10/mo.
- _"Can I use this commercially?"_ → Yes, all paid tiers include
  commercial license.

**Do NOT in the comments:**

- Ask people to email you
- Offer "custom demos"
- Link a Calendly
- Say "DM me for pricing"

Every answer should redirect to the site, the pricing page, or the free
tier signup.

---

## Launch #2 — Show HN: AuthiChain API

**Scheduled for:** Week 2 (AFTER RapidAPI listing goes live)

**Title:**

```
Show HN: AuthiChain – Blockchain-backed product verification API (100ms, $0 free tier)
```

**Body:**

```markdown
I've been building an API that lets you verify if a physical product is
real. It's backed by an ERC-721 contract on Polygon
(0xc3143254997d48fdc9983d618fb2e10067673eb5) and runs on Cloudflare
Workers so responses are <200ms globally.

Why I built it: counterfeit goods are a $1.8T/year problem, fake
pharmaceuticals alone kill ~1M people annually, and existing solutions
(holograms, paper COAs, serial number lookups) are trivially forgeable.
I wanted something that was (a) provable on-chain, (b) callable as a
simple HTTP API, and (c) fast enough to run at scan-time in a retail
environment.

What you get:

- GET /verify?id=... → verify a product by serial/SKU
- POST /verify (with optional NFC hash for higher confidence)
- POST /verify/batch (up to 50 products in one call)
- GET /products/{id}/history → full scan history, geo-tagged
- POST /register → brand-authenticated new product registration
- A few more (brands, leaderboard, health, pricing)

Pricing: Free tier is 100 requests/month (enough for testing and small
projects). Paid tiers are $49/1k, $199/10k, $499/100k per month with
per-call overages.

Tech stack: Next.js 15 app at authichain.com, Cloudflare Workers for the
edge API, Polygon for the contract, Supabase for product metadata,
optional Bitcoin Ordinal dual-chain proof for premium SKUs.

Open to brutal feedback on the endpoint design, the confidence scoring
(currently 0.95 for standard, 0.99 with NFC), and the free-tier limits.

RapidAPI listing: [LINK] (live, no approval wait)
Docs: https://authichain.com/docs
OpenAPI: https://authichain.com/api/v1/openapi.json
```

**Prepared answers:**

- _"Why blockchain? This could be a database."_ → Fair. The reason is
  tamper-evidence for brand disputes and insurance audits. A database
  lets the operator (me) rewrite history; on-chain, I can't.
- _"What happens if you go out of business?"_ → The ERC-721 data
  persists on Polygon forever. The API is a convenience layer. Anyone
  can query the contract directly.
- _"Counterfeits will just copy the QR code."_ → Yes, which is why the
  verification also returns first-scan geolocation + scan count. If a
  QR is scanned simultaneously in Guangzhou and Paris, we flag it.
- _"How do you prevent the brand from lying at registration?"_ → We
  don't, at the contract level. We rely on brand attestation + legal
  enforcement, same as every other provenance system. The value is
  that LIES become permanent and auditable.

**After posting:**

- Stay on the thread for 4–6 hours responding to every comment
- Don't argue with HN trolls. Thank them, address the technical point,
  move on.
- Upvote good questions from others on the thread.

---

## Launch #3 — Reddit: Bitcoin Ordinal custom QRONs

**Scheduled for:** Week 3

**Subreddits (post sequentially, one per day):**

1. `r/BitcoinMarkets` (post day 1)
2. `r/ordinals` (post day 2)
3. `r/CryptoCurrency` (post day 3 — be VERY careful with rules, they
   auto-remove most things)

**Title:**

```
I turned AI-generated QR art into Bitcoin Ordinals — $49 inscription
```

**Body:**

```markdown
Been working on this for a few months — a way to inscribe beautiful
AI-generated QR codes as permanent Bitcoin Ordinals on L1.

Each QRON is:

- AI-generated (11 visual styles — cyberpunk, luxury, watercolor, etc.)
- 100% scannable (pixel-clamping keeps the QR data modules intact)
- Inscribed as a Bitcoin Ordinal via OrdinalsBot
- Viewable permanently on ordinals.com
- Tradeable on Magic Eden

Why I built it: static QR codes are the ugliest thing on the internet
but they're also the bridge between the physical and digital worlds.
Making them beautiful + permanent on Bitcoin felt like a real use case
for Ordinals that isn't just "PFP on L1."

Pricing:

- Ordinal Single: $49 (one inscription, direct Stripe checkout)
- AuthiChain BTC Auth: $299 (dual-chain proof: Polygon + BTC for
  product verification)
- Collection of 25: $799 (batch inscription + Magic Eden listing)

Happy to answer questions about the inscription process, how we handle
pixel-clamping to stay under the ~60KB block-space limit, or why I
picked Ordinals over other Bitcoin NFT standards.

Sample: https://qron.space/gallery
Direct checkout: https://qron.space/pricing (scroll to Bitcoin Ordinals)
```

**Reddit etiquette (non-negotiable):**

- No shortened URLs (Reddit auto-flags)
- No affiliate tracking params
- Disclose that you're the maker in the first sentence of your first
  comment reply
- Do NOT crosspost to more than 3 subs in a week
- Do NOT post to r/Bitcoin main (maxi subreddit, will brigade downvote
  anything with "AI" in the title)

**Expected outcome:** Most direct purchases will come from r/ordinals
(small but high-intent). r/BitcoinMarkets is broader but lower
conversion. r/CryptoCurrency is a traffic bonanza if the post survives
the auto-mod, otherwise dead.

---

## The no-calls rule for ALL three launches

Every answer, every comment, every reply must route back to one of:

1. `https://qron.space/pricing` (self-serve checkout)
2. `https://buy.stripe.com/...` (direct Stripe payment link)
3. `https://rapidapi.com/authichain/api/...` (RapidAPI self-serve signup)
4. `https://qron.space/gallery` (visual proof)
5. `https://authichain.com/api/v1/openapi.json` (developer docs)

**Never** route to:

- A contact form
- A Calendly
- "DM me"
- "Email me and I'll send you..."
- A waitlist

If someone wants to talk to you, they can buy the product first. Zero
calls.

## Timing guidance

| Week | Launch       | Day of week          | Time                                   |
| ---- | ------------ | -------------------- | -------------------------------------- |
| 1    | Product Hunt | Tuesday or Wednesday | 00:01 PST                              |
| 2    | Show HN      | Tuesday              | 08:00 ET                               |
| 3    | Reddit × 3   | Wednesday → Friday   | 09:00-11:00 in the sub's peak timezone |

Avoid Mondays (people catch up on weekend backlog) and Fridays (low
engagement) for Product Hunt and Show HN.

## Post-launch measurement

Track these for each launch, in a single spreadsheet:

| Metric                   | Where to find                                           |
| ------------------------ | ------------------------------------------------------- |
| Visitors to target URL   | Cloudflare analytics / Google Analytics                 |
| RapidAPI signups         | RapidAPI provider dashboard                             |
| Stripe checkouts started | Stripe dashboard                                        |
| **Paid purchases**       | Stripe dashboard — this is the only metric that matters |
| Revenue                  | Stripe                                                  |
| Comments / engagement    | The launch thread itself                                |

**Single success metric: $1 earned from a stranger who found you via the
launch.** Everything else is noise. If one launch earns $1 from a
stranger, the no-calls approach is validated and you scale what worked.
If zero launches earn anything, the offer is wrong, not the distribution.

## Related files

- QRON pricing (fixed, commit `a3ec874`): [`qron-app/app/pricing/page.tsx`](../../qron-app/app/pricing/page.tsx)
- RapidAPI submission: [`rapidapi-submission.md`](./rapidapi-submission.md)
- Michigan outreach (parallel no-calls channel): [`strainchain/cold-email-michigan.md`](./strainchain/cold-email-michigan.md)
- Positioning copy source: [`../outputs/agentz-v3-marketing.md`](../outputs/agentz-v3-marketing.md)
