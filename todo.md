# AuthiChain Unified Platform TODO

## Database & Schema
- [x] Complete database schema with all tables (products, authentications, certificates, nfts, auctions, collections, subscriptions, usage, leads, campaigns, emails, supply chain, referrals, affiliates, autopilot, white-label, admin)
- [x] DB helper functions for all entities
- [x] Push migrations

## Core Backend (tRPC Routers)
- [x] Product authentication router with AI image analysis
- [x] QR code generation and scanning router
- [x] Certificate sharing and verification router
- [x] NFT marketplace router (list, buy, auction, collections, rarity)
- [x] Subscription management router with tiered plans and usage billing
- [x] AI Autopilot decision engine router
- [x] Email campaign router with SendGrid integration and approval workflow
- [x] Payment router (Stripe subscriptions + crypto via NOWPayments)
- [x] Supply chain tracking router with IoT monitoring
- [x] Referral and affiliate program router
- [x] Admin dashboard router (revenue, fraud, customer health)
- [x] White-label solutions router
- [x] LLM content generation router with A/B testing
- [x] Marketing and lead management router

## Frontend Pages
- [x] Home / Landing page
- [x] Dashboard (main user dashboard)
- [x] Product Authentication page (upload, analyze, results)
- [x] QR Code Dashboard (generate, scan, manage)
- [x] Certificate View page
- [x] NFT Marketplace (browse, buy, auction, collections)
- [x] Subscription Management page
- [x] AI Autopilot Dashboard
- [x] Email Campaigns page with approval workflow
- [x] Supply Chain Tracking page
- [x] Referral Dashboard
- [x] Admin Dashboard (revenue, fraud, health)
- [x] White-label Settings page
- [x] Pricing page with premium tiers, ROI calculator, and lead capture
- [x] Grants & Partnerships Hub page
- [x] Growth Engine page with conversion funnel, A/B tests, outreach

## Integrations
- [x] Stripe payment integration (router ready, needs API keys)
- [x] NOWPayments crypto integration (router ready, needs API keys)
- [x] SendGrid email integration (router ready, needs API keys)
- [x] LLM AI integration for authentication and content
- [x] QR code library integration
- [x] S3 storage for files/images

## Testing
- [x] Vitest tests for core routers (35 tests passing)
- [x] Auth flow tests
- [x] Subscription logic tests
- [x] Admin role-based access tests
- [x] Public endpoint tests (certificates, NFTs, referrals, white-label)

## Revenue-First Strategy (Phase 2)
- [x] Research blockchain/anti-counterfeiting grants and funding opportunities
- [x] Identify strategic partnership angles (luxury brands, pharma, supply chain)
- [x] Competitive landscape analysis and one-of-a-kind positioning
- [x] Premium pricing strategy aligned with unique value proposition ($49/$199/$799 tiers)
- [x] Build dedicated Pricing page with tiered enterprise pricing
- [x] Lead capture funnel with ROI calculator
- [x] Grant application materials and pitch deck content (6 grants identified, $2.4M+ potential)
- [x] Partnership outreach pipeline (12 targets across 4 categories)
- [x] Revenue analytics dashboard with MRR tracking and projections
- [x] Conversion optimization: funnel analytics, A/B testing framework
- [x] Automated email outreach sequences with performance tracking
- [x] Industry solutions positioning (6 verticals: luxury, pharma, agriculture, art, cannabis, electronics)
- [x] Add-on pricing for NFT minting, holographic QR packs, NFC tags, white-label, API access
- [x] Growth engine with 10-month revenue projection ($150K MRR / $1.8M ARR target)

## Thirdweb Blockchain Integration (Phase 3)
- [x] Configure Thirdweb secrets (client ID + API key)
- [x] Install Thirdweb SDK dependencies (thirdweb, @thirdweb-dev/sdk)
- [x] Build server-side Thirdweb service for blockchain operations (NFT minting, contract interactions)
- [x] Build frontend ThirdwebProvider and wallet connection UI
- [x] Integrate real blockchain auth into product authentication flow
- [x] Integrate real NFT minting into NFT marketplace
- [x] Add wallet connection to user profile/dashboard
- [x] Update certificate generation with on-chain verification
- [x] Write Thirdweb integration tests (41 tests passing)

## Phase 4: Deploy, Stripe, and Grant Submission
- [x] Deploy AuthiChainNFT smart contract to Polygon Amoy testnet (0xc3143254997d48fdc9983d618fb2e10067673eb5)
- [x] Configure contract address in platform
- [x] Connect Stripe for subscription billing ($49/$199/$799 tiers)
- [x] Build Stripe webhook handler for subscription lifecycle
- [ ] Prepare DHS SVIP grant application materials
- [ ] Submit grant application
- [x] End-to-end testing of all integrations

## Stripe Payment Testing
- [x] Test Stripe checkout flow on live deployed site with promo code MANUS100OFFEfh
- [x] Verify webhook handling for successful payment ($7.99 Enterprise test payment confirmed)
- [x] Fix promo code creation (live mode, legacy coupon format)

## Connected Apps Integration
- [x] Clean up temporary Stripe admin endpoints (moved to tRPC adminProcedure)
- [x] Integrate HubSpot CRM for lead management and sales pipeline (HUBSPOT_SERVICE_KEY working, CRM dashboard, auto-sync leads/payments)
- [ ] Integrate Gmail for automated email outreach (tools available, pending campaign setup)
- [x] Integrate Google Calendar for scheduling demos and meetings (4 events created)
- [x] Integrate HeyGen for AI avatar video generation (tRPC router + /heygen page built)
- [x] Integrate Airtable for data management workflows (contract + payment events logged)
- [x] Explore Meta Marketing for ad campaign management (connected, no active data)

## SEO Fixes
- [x] Fix homepage title to 30-60 characters (57 chars)
- [x] Add meta description (140 characters)
- [x] Add keywords meta tag (10 keywords)

## Custom Notification System
- [x] Add notifications table to database schema
- [x] Create notification DB helpers (create, list, markRead, markAllRead, delete)
- [x] Add notification tRPC router with CRUD endpoints
- [x] Build NotificationBell component with unread count badge
- [x] Build NotificationDropdown with recent notifications
- [x] Build full Notifications page with filtering and management
- [x] Integrate notifications into DashboardLayout header
- [x] Add auto-notifications for key events (auth, payments, subscriptions)
- [x] Write notification tests (11 tests passing)

## HubSpot Expanded Scopes
- [x] Verify newly scoped HUBSPOT_SERVICE_KEY works for contacts, companies, and deals (7 contacts, 8 companies, 4 deals)
- [x] Seed initial partnership companies and deals into HubSpot CRM (LVMH, Pfizer, Walmart, Sotheby's + 4 deals)
- [x] Verify CRM dashboard shows all three tabs with live data
## MACROHARD Integration (Phase 5)
- [x] Scaffold MACROHARD tRPC router (status, sync, query, pushEvent endpoints)
- [x] Build MACROHARD frontend page at /macrohard with connection status, sync panel, event push, API query
- [x] Add MACROHARD nav item to admin sidebar (Cpu icon)
- [x] Configure MACROHARD_API_URL and MACROHARD_API_KEY environment variables
- [x] Map MACROHARD data model to AuthiChain entities
- [x] Add real-time event webhooks from AuthiChain → MACROHARD
- [x] Integration tests for MACROHARD router

## DHS SVIP Grant Application
- [x] Write complete Phase I application ($200K ask, FIPS 140-2, W3C VC, CBP field app)
- [x] Prepare DHS SVIP grant application materials
- [ ] SAM.gov registration (required before submission — register at sam.gov)
- [ ] CAGE code + UEI number
- [ ] sbir.gov account creation
- [ ] Submit at https://www.dhs.gov/science-and-technology/svip-application-process


## qron.space Domain Setup
- [x] Add qron.space to Vercel project (vercel.com → qron-app → Settings → Domains)
- [x] Cloudflare DNS: delete A record to 216.198.79.1, add CNAME qron.space → cname.vercel-dns.com (proxy OFF)
