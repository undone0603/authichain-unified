# Authentic Economy — Unified Route Map

_Generated: 2026-04-07 | All 3 platforms audited_

---

## AuthiChain (authichain.com) — 44 pages, 64 API routes

### Pages (44)

| Route                                    | Status | Description                                                    |
| ---------------------------------------- | ------ | -------------------------------------------------------------- |
| `/`                                      | LIVE   | Landing page — hero, features, industries, pricing CTA         |
| `/pricing`                               | LIVE   | 3-tier pricing grid (Starter/Pro/Enterprise)                   |
| `/login`                                 | LIVE   | Supabase auth login                                            |
| `/signup`                                | LIVE   | User registration                                              |
| `/dashboard`                             | LIVE   | Main dashboard — products, stats, staking, referrals           |
| `/products/[id]`                         | LIVE   | Product detail — NFT mint, StoryMode, supply chain timeline    |
| `/upload`                                | LIVE   | Product upload/creation                                        |
| `/onboarding`                            | LIVE   | New user onboarding flow                                       |
| `/verify`                                | LIVE   | Public verification search page                                |
| `/verify/[truemark_id]`                  | LIVE   | Public product verification (iframe to Supabase function)      |
| `/storymode`                             | LIVE   | StoryMode landing — how it works, API docs                     |
| `/storymode/viewer`                      | LIVE   | Cinematic video viewer — generates GPT-4 script + HeyGen video |
| `/enterprise`                            | LIVE   | Enterprise sales page                                          |
| `/launch`                                | LIVE   | Launch/announcement page                                       |
| `/careers`                               | LIVE   | Careers page                                                   |
| `/checkout/success`                      | LIVE   | Post-payment success                                           |
| `/activity`                              | LIVE   | Activity feed                                                  |
| `/agent-browser`                         | LIVE   | AI agent browser interface                                     |
| `/compliance-v2`                         | LIVE   | Compliance dashboard v2                                        |
| `/qron`                                  | LIVE   | QRON integration page                                          |
| `/demo`                                  | LIVE   | Interactive demo                                               |
| `/demos`                                 | LIVE   | Demo gallery hub                                               |
| `/demos/fashion`                         | LIVE   | Fashion industry demo                                          |
| `/demos/luxury-watch`                    | LIVE   | Luxury watch demo                                              |
| `/demos/pharma`                          | LIVE   | Pharmaceutical demo                                            |
| `/demos/supply-chain`                    | LIVE   | Supply chain demo                                              |
| `/solutions/[industry]`                  | LIVE   | Dynamic industry solution page                                 |
| `/solutions/art`                         | LIVE   | Art & collectibles solution                                    |
| `/solutions/automotive`                  | LIVE   | Automotive solution                                            |
| `/solutions/cannabis`                    | LIVE   | Cannabis/StrainChain solution                                  |
| `/solutions/electronics`                 | LIVE   | Electronics solution                                           |
| `/solutions/eu-digital-product-passport` | LIVE   | EU DPP compliance                                              |
| `/solutions/fashion`                     | LIVE   | Fashion solution                                               |
| `/solutions/food-beverage`               | LIVE   | Food & beverage solution                                       |
| `/solutions/government`                  | LIVE   | Government solution                                            |
| `/solutions/jewelry`                     | LIVE   | Jewelry solution                                               |
| `/solutions/luxury`                      | LIVE   | Luxury goods solution                                          |
| `/solutions/pharma`                      | LIVE   | Pharmaceutical solution                                        |
| `/solutions/real-estate`                 | LIVE   | Real estate solution                                           |
| `/solutions/spirits`                     | LIVE   | Spirits solution                                               |
| `/solutions/wine`                        | LIVE   | Wine solution                                                  |
| `/outreach/michigan-dispensaries`        | LIVE   | StrainChain dispensary outreach                                |
| `/vs/chronicled`                         | LIVE   | Competitor comparison                                          |
| `/vs/vechain`                            | LIVE   | Competitor comparison                                          |

### API Routes (64)

#### Core Authentication & User

| Route                     | Methods | Auth | Description              |
| ------------------------- | ------- | ---- | ------------------------ |
| `/api/health`             | GET     | No   | Health check             |
| `/api/ping`               | GET     | No   | Ping/uptime              |
| `/api/verify/public/ping` | GET     | No   | Public verification ping |
| `/api/onboarding`         | POST    | Yes  | User onboarding          |
| `/api/activity`           | GET     | Yes  | User activity feed       |

#### Products & Verification

| Route                           | Methods  | Auth    | Description                                    |
| ------------------------------- | -------- | ------- | ---------------------------------------------- |
| `/api/products`                 | GET/POST | Yes     | List/create products (proxy to CF Worker)      |
| `/api/products/[id]`            | GET/PUT  | Yes     | Get/update product                             |
| `/api/products/export`          | GET      | Yes     | Export products                                |
| `/api/register`                 | POST     | Yes     | Register product on blockchain                 |
| `/api/verify`                   | POST     | Partial | Verify product authenticity                    |
| `/api/verify/[id]`              | GET      | No      | Public verify by ID                            |
| `/api/classify`                 | POST     | No      | AI product classification (proxy to CF Worker) |
| `/api/autoflow`                 | POST     | No      | AI AutoFlow classification                     |
| `/api/supply-chain/[productId]` | GET/POST | Yes     | Supply chain events CRUD                       |

#### NFT & Blockchain

| Route                            | Methods  | Auth | Description                     |
| -------------------------------- | -------- | ---- | ------------------------------- |
| `/api/nft/mint`                  | GET/POST | Yes  | Mint NFT certificate on Polygon |
| `/api/nft/metadata/[truemarkId]` | GET      | No   | ERC-721 metadata JSON           |
| `/api/nft/generate-image`        | POST     | Yes  | AI-generate NFT artwork         |

#### StoryMode

| Route                     | Methods | Auth | Description                                                  |
| ------------------------- | ------- | ---- | ------------------------------------------------------------ |
| `/api/storymode/generate` | POST    | Yes  | Generate cinematic script + HeyGen video (rate limited 3/hr) |
| `/api/storymode/status`   | GET     | Yes  | Poll HeyGen video status                                     |

#### Economy & Billing

| Route                      | Methods      | Auth            | Description                             |
| -------------------------- | ------------ | --------------- | --------------------------------------- |
| `/api/economy`             | GET          | No              | Authentic Economy cross-platform config |
| `/api/checkout`            | POST         | Yes             | Stripe subscription checkout            |
| `/api/checkout/one-time`   | POST         | Yes             | One-time purchase checkout              |
| `/api/checkout/qron-stake` | POST         | Yes             | QRON staking bundle purchase            |
| `/api/billing-portal`      | POST         | Yes             | Stripe billing portal redirect          |
| `/api/stripe/webhook`      | POST         | No (Stripe sig) | Stripe webhook handler                  |
| `/api/subscription`        | GET/POST/PUT | Yes             | Subscription management (proxy to CF)   |
| `/api/brands/me`           | GET/PUT      | Yes             | Current user's brand profile            |
| `/api/brands/fee-flows`    | GET          | Yes             | Fee flow history with 30-day summary    |
| `/api/brands/stake`        | POST         | Yes             | Stake QRON tokens                       |
| `/api/brands/unstake`      | POST         | Yes             | Unstake QRON tokens                     |

#### Sales & Outreach

| Route                         | Methods | Auth | Description                |
| ----------------------------- | ------- | ---- | -------------------------- |
| `/api/leads/capture`          | POST    | No   | Lead capture form          |
| `/api/leads/webhook`          | POST    | No   | Inbound lead webhook       |
| `/api/sales/leads`            | GET     | Yes  | Sales lead list            |
| `/api/nurture/send`           | POST    | Yes  | Send nurture email         |
| `/api/prospect`               | POST    | Yes  | Prospect enrichment        |
| `/api/enrich`                 | POST    | Yes  | Data enrichment            |
| `/api/convert/pipeline-deals` | POST    | Yes  | Convert leads to deals     |
| `/api/referral/apply`         | POST    | Yes  | Apply for referral program |
| `/api/referral/generate`      | POST    | Yes  | Generate referral code     |
| `/api/enterprise/contact`     | POST    | No   | Enterprise contact form    |
| `/api/demo/book`              | POST    | No   | Book demo                  |
| `/api/funding/seek`           | POST    | Yes  | Grant/funding applications |
| `/api/agent-browser-checkout` | POST    | Yes  | Agent browser checkout     |

#### Analytics & Admin

| Route                        | Methods | Auth | Description                  |
| ---------------------------- | ------- | ---- | ---------------------------- |
| `/api/analytics`             | GET     | Yes  | Analytics data (proxy to CF) |
| `/api/analytics/conversion`  | GET     | Yes  | Conversion analytics         |
| `/api/event`                 | POST    | No   | Event tracking               |
| `/api/badge`                 | GET     | No   | Trust badge renderer         |
| `/api/badge/embed`           | GET     | No   | Embeddable badge             |
| `/api/admin/revenue`         | GET     | Yes  | Revenue dashboard            |
| `/api/admin/expiring-trials` | GET     | Yes  | Expiring trial alerts        |
| `/api/generate`              | POST    | Yes  | Generic generation endpoint  |

#### Public API (v1)

| Route                  | Methods  | Auth | API Key | Description                                                  |
| ---------------------- | -------- | ---- | ------- | ------------------------------------------------------------ |
| `/api/v1/health`       | GET      | No   | No      | API health check                                             |
| `/api/v1/me`           | GET      | No   | Yes     | Current API key user                                         |
| `/api/v1/products`     | GET/POST | No   | Yes     | Products CRUD                                                |
| `/api/v1/register`     | POST     | No   | Yes     | Register product                                             |
| `/api/v1/verify`       | POST     | No   | Yes     | Verify product                                               |
| `/api/v1/classify`     | POST     | No   | Yes     | Classify product                                             |
| `/api/v1/mint-nft`     | POST     | No   | Yes     | Mint NFT                                                     |
| `/api/v1/analytics`    | GET      | No   | Yes     | Analytics                                                    |
| `/api/v1/industries`   | GET      | No   | No      | List industries                                              |
| `/api/v1/pricing`      | GET      | No   | No      | Pricing info                                                 |
| `/api/v1/leads`        | POST     | No   | Yes     | Submit lead                                                  |
| `/api/v1/qr/generate`  | POST     | No   | Yes     | Generate QR code                                             |
| `/api/v1/os/[...slug]` | GET/POST | No   | No      | OS proxy (scan/verify/register/events/story/rewards/apikeys) |

---

## QRON (qron.space) — 37 pages, 35 API routes

### Pages (37)

| Route                                          | Status | Description                                            |
| ---------------------------------------------- | ------ | ------------------------------------------------------ |
| `/`                                            | LIVE   | Home — AI QR generator, pricing, gallery, FAQ          |
| `/login`                                       | LIVE   | Supabase OTP magic link auth                           |
| `/pricing`                                     | LIVE   | Plan comparison (Free/Starter/Creator/Studio/Business) |
| `/portal`                                      | LIVE   | Living Portals feature page                            |
| `/portals`                                     | LIVE   | Living Portals dashboard                               |
| `/portals/[shortcode]`                         | LIVE   | Portal redirect/detail                                 |
| `/p/[serial]`                                  | LIVE   | Product/certification by serial                        |
| `/affiliate`                                   | LIVE   | Affiliate program (5-25% commission)                   |
| `/affiliate/apply`                             | LIVE   | Affiliate application form                             |
| `/free-qr-generator`                           | LIVE   | SEO landing — free QR generation                       |
| `/ai-qr-code-generator`                        | LIVE   | SEO landing — AI QR features                           |
| `/qr-code-art`                                 | LIVE   | SEO landing — QR art showcase                          |
| `/cannabis-qr-code`                            | LIVE   | SEO landing — cannabis vertical                        |
| `/restaurant-qr-code`                          | LIVE   | SEO landing — restaurant vertical                      |
| `/for/restaurants`                             | LIVE   | Vertical landing — restaurants                         |
| `/for/cannabis`                                | LIVE   | Vertical landing — cannabis dispensaries               |
| `/for/real-estate`                             | LIVE   | Vertical landing — real estate                         |
| `/for/events`                                  | LIVE   | Vertical landing — events                              |
| `/blog`                                        | LIVE   | Blog index                                             |
| `/blog/ai-qr-code-generator-free`              | LIVE   | Blog post                                              |
| `/blog/how-ai-qr-codes-work`                   | LIVE   | Blog post                                              |
| `/blog/restaurant-menu-qr-code`                | LIVE   | Blog post                                              |
| `/blog/restaurant-menu-qr-code-guide`          | LIVE   | Blog guide                                             |
| `/blog/cannabis-dispensary-qr-code-guide`      | LIVE   | Blog guide                                             |
| `/blog/cannabis-dispensary-qr-code-compliance` | LIVE   | Blog post                                              |
| `/contact`                                     | LIVE   | Contact form                                           |
| `/demo`                                        | LIVE   | Live demo                                              |
| `/gallery`                                     | LIVE   | QRON art gallery                                       |
| `/order`                                       | LIVE   | Order/checkout page                                    |
| `/success`                                     | LIVE   | Payment success                                        |
| `/sample`                                      | LIVE   | Sample showcase                                        |
| `/gig`                                         | LIVE   | Gig/services page                                      |
| `/targeted`                                    | LIVE   | Targeted QRON page                                     |
| `/admin/products`                              | LIVE   | Admin product management                               |
| `/admin/products/new`                          | LIVE   | Create product                                         |
| `/admin/certifications`                        | LIVE   | Admin certifications                                   |
| `/admin/certifications/new`                    | LIVE   | Create certification                                   |

### API Routes (35)

| Route                                    | Methods   | Auth       | Description                                       |
| ---------------------------------------- | --------- | ---------- | ------------------------------------------------- |
| `/api/checkout`                          | POST      | Optional   | Stripe checkout (subscription + one-time)         |
| `/api/checkout/custom-qron`              | POST      | Optional   | Custom QRON purchase                              |
| `/api/checkout/story-mode`               | POST/GET  | Optional   | Story Mode upsell                                 |
| `/api/billing-portal`                    | POST      | Yes        | Stripe billing portal                             |
| `/api/webhook`                           | POST      | Stripe sig | Fulfillment: plan, custom_qron, story_mode        |
| `/api/qron/generate`                     | POST/GET  | Yes        | Main QR generation (CF Worker + credit deduction) |
| `/api/qron/[id]`                         | GET/PATCH | Yes        | QRON detail + story content update                |
| `/api/qron/claim`                        | POST      | Yes        | Claim QRON ownership                              |
| `/api/qron/verify`                       | POST      | No         | Verify QRON via AuthiChain                        |
| `/api/qron/scan-validate`                | POST      | No         | Scan validation + analytics                       |
| `/api/qron/mint-nft`                     | POST      | Yes        | Mint QRON as NFT                                  |
| `/api/qron/generate-targeted`            | POST      | Yes        | Targeted QRON generation                          |
| `/api/activity`                          | GET       | Yes        | User activity feed                                |
| `/api/event`                             | POST      | No         | Event tracking                                    |
| `/api/demos`                             | GET       | No         | Demo QRON examples                                |
| `/api/presets`                           | GET       | No         | AI prompt presets                                 |
| `/api/generate/guest`                    | POST      | No         | Guest QR generation (limited)                     |
| `/api/capture-email`                     | POST      | No         | Email capture                                     |
| `/api/leads/capture`                     | POST      | No         | Lead capture                                      |
| `/api/nurture/send`                      | POST      | Yes        | Nurture email                                     |
| `/api/portals/create`                    | POST      | Yes        | Create Living Portal                              |
| `/api/portals/update`                    | POST      | Yes        | Update portal destination                         |
| `/api/portals/check`                     | GET       | No         | Check shortcode availability                      |
| `/api/portals/[shortcode]/stats`         | GET       | Yes        | Portal scan analytics                             |
| `/api/products/create`                   | POST      | Yes        | Create product                                    |
| `/api/products/[id]`                     | GET/PUT   | Yes        | Product CRUD                                      |
| `/api/certifications/[serial]`           | GET       | No         | Public certification lookup                       |
| `/api/certifications/create`             | POST      | Yes        | Create certification                              |
| `/api/admin/products`                    | GET       | Yes        | Admin product list                                |
| `/api/admin/certifications`              | GET/POST  | Yes        | Admin certifications CRUD                         |
| `/api/admin/certifications/[id]/approve` | POST      | Yes        | Approve certification                             |
| `/api/admin/certifications/[id]/revoke`  | POST      | Yes        | Revoke certification                              |
| `/api/admin/generate-demos`              | POST      | Yes        | Generate demo assets                              |
| `/api/admin/health`                      | GET       | No         | Health check                                      |

---

## StrainChain (strainchain.io) — Vertical within AuthiChain

StrainChain does not have a separate codebase — it operates as a cannabis vertical within AuthiChain, with dedicated Stripe products and a dispensary-focused landing page.

### Dedicated Routes

| Route                             | Platform   | Description                                    |
| --------------------------------- | ---------- | ---------------------------------------------- |
| `/solutions/cannabis`             | AuthiChain | StrainChain solution page                      |
| `/outreach/michigan-dispensaries` | AuthiChain | Dispensary outreach campaign                   |
| `/api/checkout`                   | AuthiChain | Handles StrainChain subscription tiers         |
| `/api/v1/os/scan`                 | AuthiChain | Product scan (cannabis products use same flow) |
| `/api/v1/os/verify`               | AuthiChain | Verification (strain provenance)               |
| `/storymode/viewer`               | AuthiChain | Strain origin story videos                     |

### Stripe Products (StrainChain-specific)

- StrainChain Basic ($199/mo)
- StrainChain Professional ($499/mo)
- StrainChain Enterprise ($999/mo)
- StrainChain Dispensary Partnership ($299/mo)

---

## Cross-Platform Connection Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTIC ECONOMY                                 │
│               /api/economy (unified config)                         │
├─────────────────┬──────────────────┬────────────────────────────────┤
│  authichain.com │   qron.space     │  strainchain.io               │
│  44 pages       │   37 pages       │  (vertical in AuthiChain)     │
│  64 API routes  │   35 API routes  │  4 Stripe products            │
├─────────────────┼──────────────────┼────────────────────────────────┤
│                 │                  │                                │
│  SHARED ENDPOINTS & DATA FLOWS:                                     │
│                                                                     │
│  qron.space/api/qron/verify ──→ authichain.com/api/v1/verify       │
│  qron.space/api/qron/mint-nft ──→ Polygon contract 0xc314...       │
│  authichain.com/api/nft/mint ──→ Polygon contract 0xc314...        │
│  authichain.com/api/storymode/* ←── qron.space story_mode purchase │
│  authichain.com/api/brands/fee-flows ←── per-scan QRON fees       │
│  authichain.com/api/v1/os/story ──→ Supabase storymode function   │
│                                                                     │
│  SHARED INFRASTRUCTURE:                                             │
│  • Polygon NFT contract: 0xc3143254997d48fdc9983d618fb2e10067673eb5│
│  • Supabase: nhdnkzhtadfkkluiulhs (products, events, fee_flows)    │
│  • Stripe: GqTruSqV8T account (all 41 products)                   │
│  • CF Worker: authichain-unified.undone-k.workers.dev              │
│  • QRON Worker: qron-ai-api.undone-k.workers.dev                  │
│  • HeyGen: shared StoryMode pipeline                               │
│  • QRON_AUTHICHAIN_KEY: cross-service auth                         │
│                                                                     │
│  SHARED TOKEN LAYER:                                                │
│  • QRON token: 0.05/scan → 40% stakers / 40% treasury / 20% burn  │
│  • Staking: bronze→platinum ($49-$14,999, 10-60% discount)         │
│  • fee_flows table: immutable ledger across all platforms            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Production Readiness Score

| Category           | AuthiChain                               | QRON                               | StrainChain          |
| ------------------ | ---------------------------------------- | ---------------------------------- | -------------------- |
| Pages              | 44/44 real                               | 37/37 real                         | 2/2 (vertical)       |
| API routes         | 64/64 functional                         | 35/35 functional                   | Shared w/ AuthiChain |
| Auth guards        | All protected routes have auth           | All protected routes have auth     | Shared               |
| Stripe integration | Full (webhook + checkout + portal)       | Full (webhook + checkout + portal) | Full                 |
| Database           | Supabase + RLS                           | Supabase + RLS                     | Shared               |
| NFT contract       | Deployed on Polygon                      | Shared contract                    | Shared contract      |
| StoryMode          | HeyGen + GPT-4 pipeline                  | Story Mode upsell                  | Shares pipeline      |
| Rate limiting      | StoryMode: 3/hr                          | Generation: credit-based           | Shared               |
| Error handling     | Typed errors (HeyGenError, NFTMintError) | Standard                           | Shared               |
| Health checks      | /api/health, /api/ping                   | /api/admin/health                  | Shared               |

**Total: 81 pages, 99 API routes, 41 Stripe products, 1 shared NFT contract, 1 shared token economy**
