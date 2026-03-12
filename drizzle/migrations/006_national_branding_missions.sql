-- Migration 006: National Branding Missions
-- Seeds 4 AgentZ missions for the Made in USA / National Origin Verification campaign
-- Run once on Supabase: Dashboard → SQL Editor → paste → Run

-- ── Mission 1: GOV_PILOT — Commerce/USDA Origin Verification ──────────────────
DO $$
DECLARE
  m1 UUID := gen_random_uuid();
BEGIN

INSERT INTO missions (id, type, title, status, priority, created_at, updated_at)
VALUES (
  m1,
  'GOV_PILOT',
  'National Origin Verification — Government Pilot (Commerce/USDA/CBP)',
  'IN_PROGRESS',
  10,
  NOW(),
  NOW()
);

-- Task 1a: Intel dossier on FTC/Commerce landscape
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m1, 'DRAFT_INTEL_DOSSIER',
  '{
    "segment": "GOV",
    "focus": "national_origin_verification",
    "topic": "FTC Made in USA enforcement landscape, Commerce Department Buy American office, USDA AMS procurement, CBP import verification, DHS SVIP supply chain security grants",
    "outputFormat": "executive_briefing",
    "keyQuestions": [
      "Who in Commerce/USDA is responsible for Made in USA enforcement?",
      "What is the current FTC complaint process for fraudulent origin claims?",
      "What budget exists for supply chain verification technology in federal procurement?",
      "Which government contractors are required to verify domestic content (DFARS/TAA)?",
      "What is the DHS SVIP supply chain security grant timeline and requirements?"
    ]
  }'::jsonb,
  'PENDING', NOW(), NOW(), NOW()
);

-- Task 1b: Build pilot packet
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m1, 'BUILD_PILOT_PACKET',
  '{
    "segment": "GOV",
    "focus": "national_origin_verification",
    "title": "AuthiChain: FTC-Compliant Blockchain Verification for Made in USA Claims",
    "sections": [
      "The Made in USA fraud problem — FTC enforcement gaps",
      "AuthiChain solution — 5-layer blockchain supply chain verification",
      "Technical architecture — component-level origin certificates on Polygon",
      "Government pilot proposal — 90-day proof of concept with 10 brands",
      "Compliance alignment — FTC, DFARS, TAA, Buy American Act",
      "ROI model — cost of fraudulent claims vs. verification infrastructure",
      "Case study template — how a federal agency could mandate AuthiChain verification"
    ],
    "targetAudience": "Office of Made in America, GSA procurement, Commerce Department trade policy",
    "callToAction": "Schedule a 30-minute technical briefing"
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '10 minutes', NOW(), NOW()
);

-- Task 1c: Find government leads
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m1, 'FIND_GOV_LEADS',
  '{
    "count": 15,
    "segment": "GOV",
    "icp": "federal procurement officer, supply chain policy director, trade compliance director",
    "targetAgencies": [
      "Office of Made in America (White House)",
      "Department of Commerce — International Trade Administration",
      "USDA Agricultural Marketing Service",
      "GSA Federal Acquisition Service",
      "Customs and Border Protection — Trade Enforcement",
      "DHS Science and Technology Directorate (SVIP)",
      "Department of Defense — DFARS compliance officers"
    ],
    "searchKeywords": ["supply chain verification", "domestic content", "Buy American", "origin certification", "trade compliance blockchain"],
    "prioritySignals": ["recently published RFPs for supply chain tech", "mentioned Made in USA enforcement", "involved in reshoring initiatives"]
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '5 minutes', NOW(), NOW()
);

-- Task 1d: Draft outbound email sequence
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m1, 'DRAFT_OUTBOUND_EMAIL',
  '{
    "segment": "GOV",
    "sequence": 1,
    "subjectLine": "Blockchain verification for Made in USA claims — 90-day pilot",
    "angle": "FTC enforcement gap — fraudulent origin claims cost American manufacturers billions. AuthiChain provides cryptographic proof of domestic content at the component level. Proposing a no-cost pilot with [Agency].",
    "tone": "professional, policy-aware, data-driven",
    "keyStats": [
      "20-40% of Made in USA claims are fraudulent or misleading (FTC)",
      "American manufacturers lose 15-30% pricing premium to fraudulent competitors",
      "AuthiChain provides FTC-compliant blockchain certificates for every manufacturing step"
    ],
    "cta": "15-minute briefing with our technical team"
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '20 minutes', NOW(), NOW()
);

-- Task 1e: Follow-up sequence
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m1, 'FOLLOWUP_SEQUENCE',
  '{
    "segment": "GOV",
    "maxFollowups": 3,
    "followup1": "Share FTC enforcement case study showing gap AuthiChain fills",
    "followup2": "Invite to live demo — scan a product, see full supply chain on-chain",
    "followup3": "DHS SVIP grant alignment — offer to co-author grant application"
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '3 days', NOW(), NOW()
);

-- Task 1f: CRM update
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m1, 'CRM_UPDATE',
  '{
    "segment": "GOV",
    "dealStage": "pilot_proposed",
    "dealName": "Government Origin Verification Pilot",
    "estimatedValue": 2000000,
    "notes": "National branding campaign — Made in USA verification standard. Target: Commerce/USDA/CBP/DHS SVIP."
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '25 minutes', NOW(), NOW()
);

END $$;

-- ── Mission 2: PRESS_LAUNCH — "Made in USA Fraud" Expose Campaign ────────────
DO $$
DECLARE
  m2 UUID := gen_random_uuid();
BEGIN

INSERT INTO missions (id, type, title, status, priority, created_at, updated_at)
VALUES (
  m2,
  'PRESS_LAUNCH',
  'National Branding Press Launch — Made in USA Verification Standard',
  'IN_PROGRESS',
  9,
  NOW(),
  NOW()
);

-- Task 2a: Draft press release
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m2, 'DRAFT_PRESS_RELEASE',
  '{
    "headline": "AuthiChain Launches First Blockchain Standard for Made in USA Verification, Exposing Widespread Fraud in Origin Claims",
    "subheadline": "New platform gives American manufacturers cryptographic proof of domestic content as FTC enforcement gaps cost billions annually",
    "angle": "expose + solution — reveal the fraud problem, position AuthiChain as the fix",
    "keyPoints": [
      "20-40% of Made in USA labels are fraudulent according to FTC data",
      "AuthiChain provides component-level blockchain certificates — raw material to finished product",
      "First platform to combine blockchain provenance + QRON visual fingerprints + community verification",
      "Launching with [X] Made in USA brands as founding partners",
      "Available for government procurement verification and consumer scanning"
    ],
    "quote": "Consumers and procurement officers deserve cryptographic proof, not a label they have to trust on faith.",
    "distribution": ["PR Newswire", "BusinessWire", "AP", "Reuters trade desk"],
    "embargoDate": "coordinate with anchor brand launch"
  }'::jsonb,
  'PENDING', NOW(), NOW(), NOW()
);

-- Task 2b: Find journalists and media contacts
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m2, 'FIND_RETAIL_LEADS',
  '{
    "count": 25,
    "vertical": "press",
    "icp": "supply chain reporter, trade policy journalist, blockchain/fintech writer, consumer protection reporter",
    "targetOutlets": [
      "Wall Street Journal — supply chain/trade beat",
      "Bloomberg — manufacturing and trade",
      "Reuters — trade policy",
      "TechCrunch — blockchain/fintech",
      "Forbes — manufacturing and supply chain",
      "Supply Chain Dive",
      "Modern Manufacturing",
      "Sourcing Journal (apparel/textiles)",
      "Food Safety News (pharma/food angle)"
    ],
    "searchKeywords": ["Made in USA", "supply chain transparency", "blockchain manufacturing", "FTC origin claims", "domestic content verification"],
    "pitchAngle": "exclusive data story: how many Made in USA products are actually made overseas"
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '5 minutes', NOW(), NOW()
);

-- Task 2c: Draft journalist pitch emails
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m2, 'DRAFT_OUTBOUND_EMAIL',
  '{
    "segment": "PRESS",
    "sequence": 1,
    "subjectLine": "Exclusive: we scanned 100 Made in USA products — here is what we found",
    "angle": "data-driven story pitch — FTC enforcement gap, consumer trust problem, AuthiChain as the solution. Offer exclusive access to platform demo and founding brand interviews.",
    "tone": "journalist-native — story-first, data-forward, no corporate speak",
    "dataHooks": [
      "Percentage of scanned products that fail origin verification",
      "Dollar value of premium consumers pay for Made in USA vs. actual domestic content",
      "Government procurement contracts that rely on unverified origin claims"
    ],
    "offer": "Exclusive data, product demo access, and quotes from founding brand CEOs before public launch"
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '15 minutes', NOW(), NOW()
);

-- Task 2d: Social media campaign
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m2, 'SCHEDULE_SOCIAL_POSTS',
  '{
    "platforms": ["twitter", "linkedin"],
    "campaignTheme": "Made in USA Verification Launch",
    "viralHook": "Thread: We scanned 100 products labeled Made in USA. Here is what the blockchain actually shows.",
    "posts": [
      {
        "day": 0,
        "type": "teaser",
        "copy": "Something big is coming for American manufacturing. 🇺🇸 Next week we reveal what we found when we put 100 Made in USA products on the blockchain.",
        "hashtags": ["MadeInUSA", "SupplyChain", "Blockchain", "Manufacturing"]
      },
      {
        "day": 2,
        "type": "data_reveal",
        "copy": "THREAD: We scanned 100 Made in USA products with AuthiChain. The results will surprise you. 🧵",
        "hashtags": ["MadeInUSA", "Authentication", "AuthiChain", "SupplyChainTransparency"]
      },
      {
        "day": 2,
        "type": "thread_body",
        "copy": "The problem: Made in USA is the most trusted — and most abused — label in American commerce. The FTC estimates 20-40% of claims are fraudulent. Until now, there was no way to verify.",
        "hashtags": []
      },
      {
        "day": 3,
        "type": "solution",
        "copy": "Today that changes. AuthiChain provides blockchain-verified origin certificates at every step — from raw material to finished product. Scan the QR. See the truth.",
        "hashtags": ["AuthiChain", "MadeInUSA", "Blockchain", "Manufacturing"]
      },
      {
        "day": 5,
        "type": "cta",
        "copy": "American manufacturers: you deserve to be believed. We give you cryptographic proof. Apply to be a founding AuthiChain verified brand → authichain.com",
        "hashtags": ["MadeInUSA", "AmericanManufacturing", "AuthiChain"]
      }
    ]
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '10 minutes', NOW(), NOW()
);

-- Task 2e: Follow-up journalist sequence
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m2, 'FOLLOWUP_SEQUENCE',
  '{
    "segment": "PRESS",
    "maxFollowups": 2,
    "followup1": "Send scan data summary and offer live demo — 10-minute product walkthrough via Zoom",
    "followup2": "Final follow-up with founding brand quotes and launch date — last chance for exclusive"
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '4 days', NOW(), NOW()
);

END $$;

-- ── Mission 3: PARTNER_ONBOARDING — Made in USA Anchor Brands ────────────────
DO $$
DECLARE
  m3 UUID := gen_random_uuid();
BEGIN

INSERT INTO missions (id, type, title, status, priority, created_at, updated_at)
VALUES (
  m3,
  'PARTNER_ONBOARDING',
  'Made in USA Anchor Brands — Founding Partner Outreach (Yeti, Benchmade, Red Wing)',
  'IN_PROGRESS',
  8,
  NOW(),
  NOW()
);

-- Task 3a: Intel dossier on target brands
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m3, 'DRAFT_INTEL_DOSSIER',
  '{
    "segment": "PARTNER",
    "focus": "made_in_usa_anchor_brands",
    "targetBrands": [
      "Yeti — premium coolers/drinkware, Austin TX, $1.5B revenue, made in USA marketing is core brand identity",
      "Benchmade — precision knives, Oregon City OR, law enforcement and premium consumers, made in USA is non-negotiable brand pillar",
      "Allen Edmonds — premium footwear, Port Washington WI, heritage American brand, made in USA since 1922",
      "Red Wing Heritage — work and lifestyle boots, Red Wing MN, 100+ years American manufacturing",
      "Darn Tough Vermont — performance socks, Northfield VT, lifetime guarantee, entirely Vermont-made",
      "Buck Knives — Idaho, 120+ year heritage, Made in USA is core marketing",
      "Carhartt — Michigan, workwear, Made in USA product lines premium tier"
    ],
    "researchFocus": [
      "Who is the VP/Director of Brand, Marketing, or Sustainability at each brand?",
      "What is their current approach to proving Made in USA claims?",
      "Have they had any FTC complaints or origin-related PR issues?",
      "What is their e-commerce QR/authentication strategy?",
      "What would AuthiChain verification add to their brand story?"
    ]
  }'::jsonb,
  'PENDING', NOW(), NOW(), NOW()
);

-- Task 3b: Build brand partner pitch packet
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m3, 'BUILD_PILOT_PACKET',
  '{
    "segment": "PARTNER",
    "focus": "made_in_usa_brand_certification",
    "title": "AuthiChain Verified: Prove What You Have Always Claimed",
    "sections": [
      "The credibility gap — Made in USA means everything and nothing",
      "AuthiChain Verified seal — what it means, how it works",
      "Consumer experience — scan QR, see full supply chain in 2 seconds",
      "Brand benefits — premium pricing, media coverage, government procurement preference",
      "The Founding Partner opportunity — free first year, co-marketing, case study rights",
      "Technical integration — 30-minute setup, no operational changes required",
      "ROI model — 15-30% pricing premium on verified vs. unverified competing products"
    ],
    "tone": "founder-to-founder, premium brand respect, peer-level",
    "callToAction": "Join 10 founding brands. Apply by [date]. Free first year.",
    "urgency": "Founding partner badge is exclusive. 10 spots total. First-mover advantage in your category."
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '10 minutes', NOW(), NOW()
);

-- Task 3c: Draft founder-level outreach emails
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m3, 'DRAFT_OUTBOUND_EMAIL',
  '{
    "segment": "PARTNER",
    "sequence": 1,
    "subjectLine": "Founding partner opportunity — AuthiChain Made in USA verification",
    "angle": "Peer founder reach — acknowledge their genuine commitment to American manufacturing, explain the credibility gap problem, position AuthiChain as the tool that lets their customers verify what they already know to be true. First-year free, co-marketing included.",
    "tone": "founder-peer, direct, no fluff, respect their time",
    "personalizedHooks": [
      "Acknowledge their specific Made in USA story and heritage",
      "Reference a specific product or campaign of theirs that demonstrates their commitment",
      "Explain why their category (knives/boots/coolers) is where trust matters most"
    ],
    "offer": "Free founding partner year. AuthiChain Verified badge. Co-branded press release. First-mover in your category."
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '20 minutes', NOW(), NOW()
);

-- Task 3d: Follow-up sequence
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m3, 'FOLLOWUP_SEQUENCE',
  '{
    "segment": "PARTNER",
    "maxFollowups": 3,
    "followup1": "Send the pilot packet + 2-minute product demo video (HeyGen-generated)",
    "followup2": "Introduce a second founding brand who has joined — social proof from a peer",
    "followup3": "Final: founding partner spots closing. Offer a 15-minute call this week."
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '5 days', NOW(), NOW()
);

-- Task 3e: CRM update
INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m3, 'CRM_UPDATE',
  '{
    "segment": "PARTNER",
    "dealStage": "pilot_proposed",
    "dealName": "Made in USA Founding Partner Program",
    "estimatedValue": 250000,
    "notes": "10 founding brand spots. Free year 1, $25K/year thereafter. Target: Yeti, Benchmade, Allen Edmonds, Red Wing, Darn Tough, Buck Knives, Carhartt."
  }'::jsonb,
  'PENDING', NOW() + INTERVAL '25 minutes', NOW(), NOW()
);

END $$;

-- ── Mission 4: TECH_SPRINT — Origin Passport Consumer Page ───────────────────
DO $$
DECLARE
  m4 UUID := gen_random_uuid();
BEGIN

INSERT INTO missions (id, type, title, status, priority, created_at, updated_at)
VALUES (
  m4,
  'TECH_SPRINT',
  'Origin Passport — Supply Chain Breakdown Consumer Page (/verify/:productId)',
  'IN_PROGRESS',
  8,
  NOW(),
  NOW()
);

INSERT INTO tasks (id, mission_id, kind, payload, status, run_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), m4, 'PLAN_SPRINT',
  '{
    "feature": "Build a public /verify/:productId page that shows the full Origin Passport for a product — supply chain breakdown by country percentage (e.g. 89% USA, 8% Canada, 3% Mexico), factory quality scores, QRON visual fingerprint embed, blockchain certificate link, and a trust score gauge. The page must be publicly accessible (no login required), mobile-first, and scannable from a QR code on physical products.",
    "context": "This is the consumer-facing authentication page that closes the loop between physical products (QRON QR codes) and the AuthiChain blockchain. It is the key deliverable for the Made in USA national branding campaign — when a customer scans a product, this is what they see. Design should feel premium, trustworthy, and simple. Tech: wouter public route, tRPC publicProcedure, Drizzle for product + qron data. Add a product_origins table (product_id, component, country, pct, certified_by) to store supply chain breakdown data.",
    "targetFiles": [
      "client/src/pages/VerifyProduct.tsx",
      "server/routers.ts",
      "drizzle/schema.ts",
      "drizzle/migrations/007_product_origins.sql",
      "client/src/App.tsx"
    ],
    "acceptanceCriteria": [
      "Public route /verify/:productId renders without login",
      "Shows product name, brand, category",
      "Shows supply chain breakdown as an animated country bar chart",
      "Shows QRON image + trust score (0-100) with grade A/B/C/F",
      "Shows blockchain certificate hash with Polygon explorer link",
      "Mobile-first, loads in under 2 seconds",
      "Works when scanned from a QR code on a physical product"
    ]
  }'::jsonb,
  'PENDING', NOW(), NOW(), NOW()
);

END $$;

-- ── Verify seeded missions ────────────────────────────────────────────────────
SELECT
  m.title,
  m.type,
  m.status,
  m.priority,
  COUNT(t.id) AS task_count,
  MIN(t.run_at) AS first_task_runs_at
FROM missions m
LEFT JOIN tasks t ON t.mission_id = m.id
WHERE m.created_at > NOW() - INTERVAL '1 minute'
GROUP BY m.id, m.title, m.type, m.status, m.priority
ORDER BY m.priority DESC;
