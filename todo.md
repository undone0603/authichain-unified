# AuthiChain Unified Platform TODO

## Core Platform (Completed)
- [x] Database schema (42 tables)
- [x] tRPC routers (30+ namespaces)
- [x] Authentication (Manus OAuth)
- [x] Dashboard layout with sidebar navigation
- [x] Landing page with features/stats
- [x] Pricing page with Stripe checkout
- [x] Certificate verification (public)
- [x] QR code generation
- [x] NFT marketplace with auctions
- [x] Supply chain tracking
- [x] AI Autopilot engine
- [x] Email campaigns
- [x] Referral system
- [x] Affiliate program
- [x] White label clients
- [x] Admin dashboard
- [x] Growth engine
- [x] Grant hub
- [x] Blockchain hub (Thirdweb)
- [x] Character/Agent system
- [x] Network stats & leaderboard
- [x] CRM (HubSpot integration)
- [x] Scheduled tasks (8 jobs running)
- [x] Notification system

## SEO
- [x] Generate sitemap.xml with all public pages
- [x] Update robots.txt to reference sitemap
- [x] Add H1 heading to /certificate/:token page
- [x] Set document.title to 30-60 characters on /certificate/:token page
- [x] Add /services to sitemap.xml

## GitHub Dev Branch Merge
- [x] Merge user_github/dev branch (email/Paddle integration, package changes) into main
- [x] Resolve any merge conflicts
- [x] Verify all tests pass after merge (155 tests passing)
- [x] Sync merged main back to GitHub

## Revenue Services Build-Out
- [x] Create 6 Stripe products/prices (live account)
- [x] Build service_orders database table
- [x] Build service catalog backend (service-catalog.ts)
- [x] Build services router (catalog, checkout, orders, admin)
- [x] Build public /services page with all 6 offerings
- [x] Build /orders page for user order tracking
- [x] Add Services/Orders to sidebar navigation
- [x] Add Services link to homepage nav
- [x] Write tests for services router (8 tests)
- [ ] Build admin service order management UI
- [ ] Add webhook handler for service order payment completion

## Switch to Live Mode
- [x] Verify Stripe live account exists (acct_1SPZEFPUXqpBpzb3)
- [x] Create live products/prices in Stripe
- [ ] User: Switch Stripe keys to live in Settings > Payment
- [ ] Configure SendGrid API key for email system
- [ ] Map Paddle price IDs for dual payment gateway

## GitHub Staging (PostgreSQL files to integrate later)
- [ ] Integrate agents/ system (PostgreSQL -> MySQL)
- [ ] Integrate jobs/ pipeline (PostgreSQL -> MySQL)
- [ ] Integrate webhooks/ handlers (PostgreSQL -> MySQL)
- [ ] Integrate missions system (PostgreSQL -> MySQL)
- [ ] Integrate video studio (PostgreSQL -> MySQL)
- [ ] Integrate physical auth (PostgreSQL -> MySQL)
