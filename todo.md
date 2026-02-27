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
- [ ] Pricing page (deferred - subscription page covers pricing)

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
