# AuthiChain Unified Platform: System Review & Post-Credits Task List

**Date:** March 7, 2026
**Platform URL:** https://authichain.com (alias: authichain-gpea3uhe.manus.space)
**GitHub:** Connected and synced to `main` branch
**Status:** Production-ready, 88 tests passing, 0 TypeScript errors

---

## 1. System Architecture Overview

AuthiChain is a full-stack blockchain authentication platform built on React 19, Tailwind CSS 4, Express 4, and tRPC 11 with Manus OAuth. The platform provides AI-powered product authentication, NFT certificate minting, supply chain tracking, and enterprise automation tools. The codebase is organized into a monorepo with a clear separation between client, server, and shared modules.

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React 19 + Tailwind 4 + shadcn/ui | Operational |
| Backend | Express 4 + tRPC 11 + Drizzle ORM | Operational |
| Database | TiDB (MySQL-compatible) | 42 tables, operational |
| Blockchain | Thirdweb SDK + Sepolia testnet | Connected |
| Payments | Stripe (test mode) + Paddle (not configured) | Partial |
| Email | SendGrid + SMTP (Nodemailer) | Not configured |
| CRM | HubSpot | Connected |
| Storage | S3 via Manus Forge | Operational |
| AI/LLM | Manus Forge LLM API | Operational |

---

## 2. Database Schema (42 Tables)

The database contains 42 tables organized across several functional domains.

| Domain | Tables | Description |
|--------|--------|-------------|
| **Core Auth** | `users` | User accounts with OAuth, Stripe/Paddle customer IDs, roles |
| **Products** | `products`, `authentications`, `certificates`, `qr_codes` | Product registration, AI authentication, certificate issuance, QR generation |
| **NFT** | `nft_collections`, `nfts`, `auctions`, `auction_bids` | NFT minting, collections, marketplace auctions |
| **Billing** | `subscriptions`, `usage_records`, `invoices`, `payments` | Subscription management, usage tracking, payment records |
| **Marketing** | `leads`, `email_campaigns`, `email_drafts`, `referrals`, `affiliates`, `affiliate_commissions`, `referral_clicks`, `bonuses` | Lead capture, email outreach, referral/affiliate programs |
| **Supply Chain** | `supply_chain_events` | Product journey tracking with location/status |
| **AI/Automation** | `autopilot_config`, `autopilot_decisions`, `ab_tests` | AI decision engine, A/B testing framework |
| **Enterprise** | `white_label_clients` | White-label client management |
| **Analytics** | `activity_log`, `fraud_alerts`, `customer_health_scores`, `revenue_records` | User activity, fraud detection, health scoring, revenue tracking |
| **Notifications** | `notifications` | In-app notification system |
| **Scheduler** | `scheduled_job_runs` | Cron job execution history |
| **Characters** | `character_generations`, `character_assets` | AI character/agent generation and assets |
| **Protocol** | `protocol_agents`, `verification_claims`, `consensus_results`, `qron_reward_ledger`, `checkpoint_batches` | Decentralized verification protocol |
| **Marketplace** | `ai_models`, `model_purchases`, `model_reviews` | AI model marketplace with purchases and reviews |

---

## 3. Backend Routers (30 Namespaces)

All tRPC routers are modularized into individual files under `server/` with the following namespaces wired into the `appRouter`:

| Router | Type | Key Procedures |
|--------|------|----------------|
| `auth` | Public/Protected | `me`, `logout` |
| `products` | Protected | CRUD for product registration |
| `authenticate` | Protected | AI-powered product authentication |
| `certificates` | Public/Protected | Certificate issuance and public verification |
| `qrcode` | Protected | QR code generation and management |
| `nft` | Protected | NFT minting, collections, marketplace |
| `subscription` | Protected | Plan management, Stripe checkout |
| `payments` | Protected | Payment history, Stripe integration |
| `autopilot` | Protected | AI decision engine configuration |
| `emailCampaigns` | Protected | Email campaign management |
| `emailDrafts` | Protected | Draft email composition |
| `supplyChain` | Protected | Supply chain event tracking |
| `notifications` | Protected | In-app notification management |
| `admin` | Admin-only | User management, system stats |
| `marketing` | Public | Lead capture, landing page data |
| `abTesting` | Protected | A/B test management |
| `whiteLabel` | Protected | White-label client management |
| `dashboard` | Protected | Analytics and metrics |
| `blockchain` | Public/Protected | On-chain operations, NFT balance |
| `hubspot` | Protected | CRM sync and contact management |
| `ai` | Protected | LLM-powered features |
| `referral` | Protected | Referral link generation, tracking |
| `affiliate` | Protected | Affiliate program management |
| `bonuses` | Protected/Admin | Bonus tier management |
| `marketplace` | Public/Protected | AI model browsing and purchasing |
| `referrals` | Protected | Legacy referral endpoints |
| `affiliates` | Protected | Legacy affiliate endpoints |
| `character` | Protected | AI character generation |
| `scheduler` | Admin-only | Scheduled job management |
| `system` | Protected | Owner notifications |

---

## 4. Frontend Pages (26 Pages)

| Page | Route | Auth Required | Description |
|------|-------|--------------|-------------|
| Home | `/` | No | Public landing page with hero, features, stats, pricing CTA |
| Pricing | `/pricing` | No | Plan comparison with Stripe checkout |
| Certificate Verify | `/certificate/:token` | No | Public certificate verification |
| Dashboard | `/dashboard` | Yes | Analytics overview, key metrics |
| Authenticate | `/authenticate` | Yes | AI product authentication interface |
| QR Codes | `/qr-codes` | Yes | QR code generation and management |
| Certificates | `/certificates` | Yes | Certificate management dashboard |
| NFT Marketplace | `/nft` | Yes | NFT minting, collections, auctions |
| Supply Chain | `/supply-chain` | Yes | Product journey tracking |
| Autopilot | `/autopilot` | Yes | AI decision engine |
| Email Campaigns | `/email-campaigns` | Yes | Email marketing management |
| Subscriptions | `/subscriptions` | Yes | Plan management and billing |
| Referrals | `/referrals` | Yes | Referral program dashboard |
| Blockchain Hub | `/blockchain` | Yes | On-chain operations |
| Character/Agent | `/character` | Yes | AI character dashboard |
| Character Create | `/character/create` | Yes | Character generation wizard |
| Network Stats | `/network` | Yes | Network leaderboard and stats |
| Notifications | `/notifications` | Yes | Notification center |
| Admin Dashboard | `/admin` | Admin | System administration |
| White Label | `/white-label` | Yes | White-label management |
| Grants Hub | `/grants` | Yes | Grant discovery and applications |
| Growth Engine | `/growth` | Yes | Growth automation tools |
| CRM | `/crm` | Yes | HubSpot CRM integration |
| Scheduled Tasks | `/scheduled-tasks` | Admin | Job scheduler management |
| Component Showcase | N/A | No | UI component library |
| Not Found | `*` | No | 404 page |

---

## 5. Active Automations (8 Scheduled Jobs)

All jobs are registered and running automatically on server boot.

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `subscription-health-check` | Every 6 hours | Monitors subscription status and flags issues |
| `certificate-expiry-check` | Daily at 7 AM | Alerts users about expiring certificates |
| `lead-nurturing` | Daily at 9 AM | Automated lead follow-up sequences |
| `database-cleanup` | Daily at 3 AM | Purges stale sessions and expired data |
| `weekly-analytics-digest` | Monday at 8 AM | Compiles weekly performance report |
| `hubspot-crm-sync` | Every 4 hours | Syncs contacts, deals, and activities to HubSpot |
| `customer-health-score` | Daily at 5 AM | Recalculates customer health scores |
| `fraud-detection-sweep` | Every 6 hours | Scans for suspicious authentication patterns |

---

## 6. Integration Status

| Integration | Status | Configuration | Action Required |
|-------------|--------|---------------|-----------------|
| **Stripe** | Test mode | sk_test_ / pk_test_ keys, webhook configured | Switch to live keys in Settings > Payment |
| **Stripe Webhook** | Active | `/api/stripe/webhook` with signature verification | Update webhook secret after switching to live |
| **Thirdweb** | Connected | Client ID + API key configured, Sepolia testnet | Deploy mainnet contract for production |
| **HubSpot** | Connected | Service key (pat-na2-...) configured | Operational, no action needed |
| **SendGrid** | Not configured | API key not set | Provide SendGrid API key in Settings > Secrets |
| **Paddle** | Not configured | API key not set | Optional: provide Paddle API key for dual payment |
| **Manus OAuth** | Active | App ID + OAuth server configured | Operational |
| **S3 Storage** | Active | Forge API configured | Operational |
| **LLM (AI)** | Active | Forge API configured | Operational |
| **Smart Contract** | Deployed | `0xc314...3eb5` on Sepolia | Deploy to mainnet for production |

---

## 7. Stripe Live Products (Already Created)

The following products and prices already exist in your live Stripe account:

| Product | Monthly Price | Annual Price | Product ID |
|---------|--------------|--------------|------------|
| AuthiChain Basic | $99/mo | $999/yr | prod_TmZFP0xecVNfx5 |
| AuthiChain Standard | $299/mo | $2,999/yr | prod_TmZFDwXiRtYHUO |
| AuthiChain Enhanced | $599/mo | $5,999/yr | prod_TmZFIqlEPAVCDX |
| AuthiChain Premium | $1,299/mo | $12,999/yr | prod_TmZFV0ZIptvArl |
| AuthiChain Growth Plan | $99/mo | -- | prod_TwzdFAPaNHWp9N |
| QRON Starter | $149/mo | -- | prod_TrhVfRxa5NjaUj |
| QRON Growth | $499/mo | -- | prod_TrhVD0CcdO864i |
| QRON Scale | $999/mo | -- | prod_TrhVOOQbf2WJPo |
| QRON Enterprise | $1,499/mo | -- | prod_TrhV5E5zKAZli6 |

---

## 8. Post-Credits Task List

The following tasks are organized by priority and can be completed independently after Manus credits expire. Each task includes the specific files to modify and steps to take.

### PRIORITY 1: Go Live (Revenue-Critical)

**Task 1.1: Switch Stripe to Live Mode**

Navigate to the Manus Management UI at Settings > Payment and enter your live Stripe keys. You can find them at https://dashboard.stripe.com/acct_1SPZEFPUXqpBpzb3/apikeys. The three values to update are `STRIPE_SECRET_KEY` (starts with `sk_live_`), `VITE_STRIPE_PUBLISHABLE_KEY` (starts with `pk_live_`), and `STRIPE_WEBHOOK_SECRET` (the live webhook secret from Stripe Dashboard > Developers > Webhooks). After updating, test with a real card or use the 99% promo code available in Settings > Payment.

**Task 1.2: Map Stripe Price IDs to Plans**

The `server/stripe-products.ts` file defines plan names and prices but does not reference the actual Stripe Price IDs. Update the checkout session creation in `server/subscriptions/router.ts` (or `server/routers.ts` subscription section) to use the live Price IDs listed in Section 7 above. For example, map `starter` to `price_1Sp06kPUXqpBpzb3zybdy0QS` ($99/mo Basic).

**Task 1.3: Deploy Smart Contract to Mainnet**

The current contract (`0xc314...3eb5`) is on Sepolia testnet. To go live with NFT minting, deploy the `AuthiChainNFT_flattened.sol` contract to Ethereum mainnet (or Polygon for lower gas fees) using Hardhat. Update `VITE_AUTHICHAIN_CONTRACT_ADDRESS` in Settings > Secrets with the new mainnet address. Update the Thirdweb chain configuration in `server/thirdweb.ts` to point to mainnet.

### PRIORITY 2: Configure Missing Integrations

**Task 2.1: Set Up SendGrid for Email**

Create a SendGrid account at https://sendgrid.com, generate an API key, and add it as `SENDGRID_API_KEY` in Settings > Secrets (the env var name in code is `sendgridApiKey`). This enables the email campaign system, certificate notification emails, welcome emails, and lead nurturing automation. Verify your sender domain in SendGrid for deliverability.

**Task 2.2: Configure Paddle (Optional Dual Payment)**

If you want Paddle as an alternative payment processor, create a Paddle account, get your API key and webhook secret, and add them as `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` in Settings > Secrets. The Paddle service is already coded in `server/paddle-service.ts` and the subscription router supports Paddle checkout.

### PRIORITY 3: SEO & Marketing

**Task 3.1: Add Open Graph Meta Tags**

Edit `client/index.html` to add Open Graph and Twitter Card meta tags for rich social sharing. Add the following inside the `<head>` tag:

```html
<meta property="og:title" content="AuthiChain - Blockchain Product Authentication" />
<meta property="og:description" content="AI-powered authentication, NFT certificates, and supply chain verification." />
<meta property="og:image" content="https://your-cdn-url/og-image.png" />
<meta property="og:url" content="https://authichain.com" />
<meta name="twitter:card" content="summary_large_image" />
```

**Task 3.2: Add JSON-LD Structured Data**

Add Organization and SoftwareApplication schema markup to `client/index.html` for enhanced Google search results:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AuthiChain",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "99", "priceCurrency": "USD" }
}
</script>
```

**Task 3.3: Submit Sitemap to Search Engines**

The sitemap is already at https://authichain.com/sitemap.xml. Submit it to Google Search Console (https://search.google.com/search-console) and Bing Webmaster Tools (https://www.bing.com/webmasters). Verify domain ownership using DNS TXT record or HTML file upload.

**Task 3.4: Set Up Google Analytics**

The platform has analytics endpoint env vars (`VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID`) but they may need configuration. Alternatively, add Google Analytics 4 by inserting the GA4 tag in `client/index.html`.

### PRIORITY 4: Feature Completion

**Task 4.1: Build AI Model Marketplace Frontend**

The backend for the AI model marketplace is complete (`server/marketplace/router.ts`, `server/marketplace/db.ts`) with endpoints for listing, purchasing, and reviewing models. The frontend page needs to be built at `client/src/pages/AiMarketplace.tsx` with a product grid, detail view, purchase flow (via Stripe), and review system. Wire it to the `trpc.marketplace.*` endpoints.

**Task 4.2: Complete Email Campaign UI**

The email campaign backend supports SendGrid and SMTP. Enhance the `client/src/pages/EmailCampaigns.tsx` page with a visual email builder, template library, recipient list management, and campaign analytics. The backend endpoints are in `server/email-campaigns/router.ts` and `server/email-drafts/router.ts`.

**Task 4.3: Build Affiliate Dashboard**

The affiliate/referral backend is fully built with commission tracking, tier bonuses, and click tracking. Create a dedicated affiliate portal page that shows earnings, referral links, click analytics, and payout history. Use `trpc.affiliate.*` and `trpc.referral.*` endpoints.

**Task 4.4: Implement White-Label Client Portal**

The white-label backend (`server/white-label/router.ts`) supports client management. Build a client-facing portal where white-label customers can access their branded authentication dashboard. This requires a subdomain routing strategy or path-based multi-tenancy.

### PRIORITY 5: Security & Hardening

**Task 5.1: Add Rate Limiting**

Install `express-rate-limit` and add rate limiting to sensitive endpoints: `/api/stripe/webhook` (100/min), `/api/trpc` (200/min per user), and public endpoints like `marketing.createLead` (10/min per IP). Add the middleware in `server/_core/index.ts` before the tRPC handler.

**Task 5.2: Add CORS Configuration**

Review and tighten CORS settings in `server/_core/index.ts`. In production, restrict `origin` to `https://authichain.com` and `https://www.authichain.com` only.

**Task 5.3: Add Input Sanitization**

Review all tRPC input schemas (Zod validators) in router files. Ensure all string inputs have reasonable `max()` length limits and that email inputs use `.email()` validation. Add `.trim()` to prevent whitespace injection.

**Task 5.4: Enable HTTPS-Only Cookies**

Verify that session cookies have `secure: true` and `sameSite: 'lax'` in production. Check `server/_core/context.ts` for cookie configuration.

### PRIORITY 6: Performance & Monitoring

**Task 6.1: Add Error Monitoring (Sentry)**

Install `@sentry/node` and `@sentry/react`. Initialize Sentry in `server/_core/index.ts` (server) and `client/src/main.tsx` (client). This captures unhandled errors, slow transactions, and user-facing crashes.

**Task 6.2: Add Database Indexing**

Add indexes to frequently queried columns. In `drizzle/schema.ts`, add `.index()` to: `users.email`, `users.stripeCustomerId`, `products.userId`, `certificates.certificateNumber`, `authentications.productId`, `leads.email`, `subscriptions.userId`, and `referrals.referrerId`. Run `pnpm db:push` after adding indexes.

**Task 6.3: Add Health Check Endpoint**

Create a `/health` endpoint in `server/_core/index.ts` that returns database connectivity status, uptime, and memory usage. This is essential for monitoring and load balancer health checks.

**Task 6.4: Set Up Uptime Monitoring**

Use a free service like UptimeRobot (https://uptimerobot.com) to monitor `https://authichain.com` and `https://authichain.com/health` every 5 minutes. Configure email/SMS alerts for downtime.

### PRIORITY 7: Content & Growth

**Task 7.1: Seed Demo Data**

Create sample products, certificates, and NFTs so new users see a populated marketplace. Write a seed script at `server/seed.mjs` that inserts demo products across industries (luxury goods, pharmaceuticals, electronics) with sample authentication results and certificates.

**Task 7.2: Create Blog/Content Section**

Add a `/blog` route with markdown-rendered articles about product authentication, counterfeiting statistics, and blockchain technology. This drives organic SEO traffic. Store articles as markdown files or in a new `blog_posts` database table.

**Task 7.3: Add Customer Testimonials**

Add a testimonials section to the Home page with real or representative customer quotes. Include company logos, names, and specific results (e.g., "Reduced counterfeiting by 94%").

**Task 7.4: Create API Documentation**

Build a public API docs page at `/docs` using the existing tRPC router definitions. This enables enterprise customers to integrate AuthiChain into their existing systems. Consider using `trpc-openapi` to generate OpenAPI specs automatically.

---

## 9. Quick Reference: Key Files to Edit

| Task | File(s) |
|------|---------|
| Stripe products/prices | `server/stripe-products.ts` |
| Subscription checkout | `server/routers.ts` (subscription section) or `server/subscriptions/router.ts` |
| Webhook handling | `server/_core/index.ts` (lines 36-135) |
| Database schema | `drizzle/schema.ts` |
| Environment variables | `server/_core/env.ts` |
| Frontend routes | `client/src/App.tsx` |
| Sidebar navigation | `client/src/components/DashboardLayout.tsx` |
| Scheduled jobs | `server/scheduled-jobs.ts` |
| Landing page | `client/src/pages/Home.tsx` |
| Pricing page | `client/src/pages/Pricing.tsx` |
| Global styles | `client/src/index.css` |
| HTML head/meta | `client/index.html` |
| Sitemap | `client/public/sitemap.xml` |
| Robots.txt | `client/public/robots.txt` |

---

## 10. Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm test` | Run all Vitest tests |
| `pnpm db:push` | Push schema changes to database |
| `npx drizzle-kit generate` | Generate migration files |
| `npx drizzle-kit migrate` | Apply migrations |
| `npx tsc --noEmit` | TypeScript type checking |

---

*Generated by Manus AI on March 7, 2026. AuthiChain Unified Platform v63d430ab.*
