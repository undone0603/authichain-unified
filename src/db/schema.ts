import {
  serial,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  numeric,
  bigint,
  bigserial,
  uuid,
  pgEnum,
  index,
  jsonb,
  primaryKey,
  real,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ──────────────────────────────────────────────────────────────────
export const tierEnum = pgEnum('tier', ['free', 'pro', 'enterprise']);

// ─── Users & Profiles ────────────────────────────────────────────────────────
// Merged from both schemas
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  openId: varchar('openId', { length: 64 }).notNull().unique(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  walletAddress: varchar('walletAddress', { length: 128 }),
  avatarUrl: text('avatarUrl'),
  company: varchar('company', { length: 256 }),
  title: varchar('title', { length: 256 }),
  phone: varchar('phone', { length: 32 }),
  onboardingCompleted: integer('onboardingCompleted').default(0),
  stripeCustomerId: varchar('stripeCustomerId', { length: 128 }).unique(),
  paddleCustomerId: varchar('paddleCustomerId', { length: 128 }),
  points: integer('points').default(0),
  // QRON specific fields
  generationsUsed: integer('generations_used').default(0).notNull(),
  // Free-gen grant removed — access comes from a free trial or paid plan.
  generationsLimit: integer('generations_limit').default(0).notNull(),
  affiliateId: text('affiliate_id').unique(),
  referredBy: text('referred_by'),
  storyModeEnabled: boolean('story_mode_enabled').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Products ────────────────────────────────────────────────────────────────
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull(),
  name: varchar('name', { length: 512 }).notNull(),
  brand: varchar('brand', { length: 256 }),
  category: varchar('category', { length: 128 }),
  description: text('description'),
  imageUrl: text('image_url'),
  serialNumber: varchar('serial_number', { length: 256 }),
  manufacturingDate: timestamp('manufacturing_date'),
  blockchainTxHash: varchar('blockchain_tx_hash', { length: 128 }),
  nftTokenId: varchar('nft_token_id', { length: 128 }),
  status: varchar('status', { length: 50 }).default('active'),
  // QRON specific fields
  manufacturer: text('manufacturer'),
  modelNumber: text('model_number'),
  metadata: jsonb('metadata').default({}),
  audioUrl: text('audioUrl'),
  visionMarkers: json('visionMarkers'),
  rarityScore: integer('rarityScore'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Authentications ─────────────────────────────────────────────────────────
export const authentications = pgTable('authentications', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  userId: integer('user_id').notNull(),
  result: varchar('result', { length: 50 }).notNull(),
  isPublic: integer('is_public').default(0),
  shareToken: varchar('share_token', { length: 128 }),
  shareCount: integer('share_count').default(0),
  verificationMethod: varchar('method', { length: 64 }).default('ai_image'),
  blockchainVerified: integer('blockchain_verified').default(0),
  metadata: json('metadata'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Authentication = typeof authentications.$inferSelect;

// ─── Certificates ────────────────────────────────────────────────────────────
export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  userId: integer('user_id').notNull(),
  certificateNumber: varchar('certificate_number', { length: 64 }).notNull().unique(),
  status: varchar('status', { length: 50 }).default('active'),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  blockchainTxHash: varchar('blockchain_tx', { length: 128 }),
  nftTokenId: varchar('nft_token_id', { length: 256 }),
  nftContractAddress: varchar('nft_contract_address', { length: 64 }),
  certificateUrl: text('certificate_url'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;

// ─── QR Codes & QRONs ────────────────────────────────────────────────────────
export const qrCodes = pgTable('qr_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id'),
  userId: integer('user_id').notNull(),
  name: text('name'),
  shortCode: text('short_code'),
  qrData: text('data').notNull(),
  qrImageUrl: text('qr_image_url'),
  scanCount: integer('scan_count').default(0),
  lastScannedAt: timestamp('last_scanned_at'),
  mode: text('mode').default('standard').notNull(),
  imageUrl: text('image_url'),
  style: jsonb('style'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  qrcodesUserIdx: index('idx_qrcodes_user_id').on(table.userId),
  qrcodesShortCodeIdx: index('idx_qrcodes_short_code').on(table.shortCode),
}));

export type QrCode = typeof qrCodes.$inferSelect;

// ─── QR Scan Events ──────────────────────────────────────────────────────────
export const qrScanEvents = pgTable('qr_scan_events', {
  id: serial('id').primaryKey(),
  qrCodeId: uuid('qrCodeId').notNull(),
  productId: uuid('productId').notNull(),
  isAuthentic: boolean('isAuthentic'),
  userAgent: text('userAgent'),
  scannedAt: timestamp('scannedAt').defaultNow().notNull(),
});
export type QrScanEvent = typeof qrScanEvents.$inferSelect;

// ─── Redirect Rules ──────────────────────────────────────────────────────────
export const redirectRules = pgTable(
  'redirect_rules',
  {
    id: serial('id').primaryKey(),
    qronId: integer('qron_id').notNull(),
    name: text('name').notNull(),
    url: text('url'),
    priority: integer('priority').default(100).notNull(),
    ruleType: text('rule_type').notNull(),
    conditions: jsonb('conditions'),
    weight: integer('weight'),
    isActive: boolean('is_active').default(true).notNull(),
    clickCount: integer('click_count').default(0),
    geoTargets: text('geo_targets').array().array(),
    deviceTargets: text('device_targets').array().array(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    redirectQronIdx: index('idx_redirect_qron').on(table.qronId),
  })
);

// ─── Brands ──────────────────────────────────────────────────────────────────
export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id'), // Linked to users.id
    name: text('name').notNull(),
    domain: text('domain'),
    logoUrl: text('logo_url'),
    industry: text('industry'),
    stakingTier: text('staking_tier').default('none').notNull(),
    qronStaked: numeric('qron_staked').default('0').notNull(),
    walletAddress: text('wallet_address'),
    unitCostDiscount: numeric('unit_cost_discount').default('0').notNull(),
    baseUnitCost: numeric('base_unit_cost').default('0.05').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    brandsDomainIdx: index('idx_brands_domain').on(table.domain),
  })
);

// ─── Telemetry Events (Phase 2 & Theater 1) ──────────────────────────────────
export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id'),
    brandId: uuid('brand_id'),
    productId: integer('product_id'),
    theater: text('theater').notNull(), // 'theater_1', 'theater_3', etc.
    source: text('source'),
    metrcTag: text('metrc_tag'),
    rawPayload: jsonb('raw_payload').notNull(),
    parsedState: jsonb('parsed_state').notNull(),
    ledgerHash: text('ledger_hash'),
    stateHash: text('state_hash'),
    anchoredTxHash: text('anchored_tx_hash'),
    isCompliant: boolean('is_compliant'),
    gpsLocation: jsonb('gps_location'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    telemetryTheaterIdx: index('idx_telemetry_theater').on(table.theater),
    telemetryHashIdx: index('idx_telemetry_hash').on(table.stateHash),
  })
);

// ─── Supply Chain Events ─────────────────────────────────────────────────────
export const supplyChainEvents = pgTable('supply_chain_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  location: varchar('location', { length: 512 }),
  latitude: numeric('location_lat', { precision: 10, scale: 7 }),
  longitude: numeric('location_lng', { precision: 10, scale: 7 }),
  handler: varchar('actor', { length: 256 }),
  notes: text('notes'),
  blockchainTxHash: varchar('blockchain_tx', { length: 128 }),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SupplyChainEvent = typeof supplyChainEvents.$inferSelect;

// ─── Subscriptions & Billing ─────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull(),
  plan: varchar('plan', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  monthlyQuota: integer('monthlyQuota').notNull(),
  usedQuota: integer('usedQuota').default(0),
  stripeCustomerId: varchar('stripeCustomerId', { length: 128 }),
  stripeSubscriptionId: varchar('stripeSubscriptionId', { length: 128 }),
  paddleSubscriptionId: varchar('paddleSubscriptionId', { length: 128 }),
  paddleCustomerId: varchar('paddleCustomerId', { length: 128 }),
  billingCycle: varchar('billingCycle', { length: 50 }).default('monthly'),
  currentPeriodStart: timestamp('currentPeriodStart'),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  trialEndsAt: timestamp('trialEndsAt'),
  cancelledAt: timestamp('cancelledAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});


// ─── Usage Records ───────────────────────────────────────────────────────────
export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  type: varchar("resource_type", { length: 64 }).notNull(),
  quantity: integer("quantity").default(1),
  metadata: json("metadata"),
  createdAt: timestamp("recorded_at").defaultNow().notNull(),
});

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  subscriptionId: uuid("subscription_id"),
  currency: varchar("currency", { length: 8 }).default("USD"),
  status: varchar("status", { length: 50 }).default("draft"),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 128 }),
  paidAt: timestamp("paid_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;

// ─── Payments ────────────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  method: varchar("payment_method", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  stripePaymentId: varchar("stripe_payment_id", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;

// ─── Leads ───────────────────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 256 }),
  company: varchar("company", { length: 256 }),
  title: varchar("title", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  source: varchar("source", { length: 128 }),
  score: integer("score").default(0),
  leadScore: integer("leadScore").default(0),
  emailOpened: boolean("emailOpened").default(false),
  emailClicked: boolean("emailClicked").default(false),
  emailReplied: boolean("emailReplied").default(false),
  roiCalculated: boolean("roiCalculated").default(false),
  demoStarted: boolean("demoStarted").default(false),
  interactionsCount: integer("interactionsCount").default(0),
  isVip: boolean("isVip").default(false),
  contractSent: boolean("contractSent").default(false),
  contractOpened: boolean("contractOpened").default(false),
  contractSigned: boolean("contractSigned").default(false),
  roiSavings: integer("roiSavings"),
  numProducts: integer("numProducts"),
  dealStage: varchar("dealStage", { length: 64 }),
  status: varchar("status", { length: 50 }).default("new"),
  industry: varchar("industry", { length: 128 }),
  notes: text("notes"),
  segment: varchar("segment", { length: 64 }),
  nextActionAt: timestamp("nextActionAt"),
  lastContactedAt: timestamp("lastContactedAt"),
  assignedTo: integer("assignedTo"),
  // A/B Testing Fields
  abVariant: varchar("ab_variant", { length: 1 }),
  abTestId: integer("ab_test_id"),
  pricingTierAssigned: varchar("pricing_tier_assigned", { length: 64 }),
  emailVariantAssigned: varchar("email_variant_assigned", { length: 64 }),
  linkedinVariantAssigned: varchar("linkedin_variant_assigned", { length: 1 }),
  // Inbound email reply tracking
  sentiment: varchar("sentiment", { length: 32 }), // positive|neutral|negative|objection
  lastReplyAt: timestamp("lastReplyAt"),
  objectionType: varchar("objectionType", { length: 64 }), // budget|timeline|competitor|decision_maker|other
  nurturePaused: boolean("nurturePaused").default(false),
  proposalsSent: integer("proposalsSent").default(0),
  repliesReceived: integer("repliesReceived").default(0),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;

// ─── Email Campaigns ─────────────────────────────────────────────────────────
export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 50 }).default("draft"),
  sentCount: integer("sent_count").default(0),
  openCount: integer("opened_count").default(0),
  clickCount: integer("clicked_count").default(0),
  scheduledAt: timestamp("send_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;

// ─── Email Drafts (Approval Workflow) ────────────────────────────────────────
export const emailDrafts = pgTable("email_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectName: varchar("prospect_name", { length: 256 }),
  prospectEmail: varchar("prospect_email", { length: 320 }).notNull(),
  prospectCompany: varchar("prospect_company", { length: 256 }),
  prospectTitle: varchar("prospect_title", { length: 256 }),
  industry: varchar("industry", { length: 128 }),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  templateUsed: varchar("template_used", { length: 128 }),
  status: varchar("status", { length: 50 }).default("pending"),
  generatedBy: varchar("generated_by", { length: 64 }).default("ai_manager"),
  taskId: varchar("taskId", { length: 64 }),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailDraft = typeof emailDrafts.$inferSelect;

// ─── Referrals ───────────────────────────────────────────────────────────────
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id"),
  referralCode: varchar("referral_code", { length: 32 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("pending"),
  rewardAmount: numeric("reward_amount", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: boolean("reward_paid").default(false),
  referredEmail: varchar("referred_email", { length: 320 }),
  tier: varchar("tier", { length: 50 }),
  commissionPaid: numeric("commission_paid", { precision: 10, scale: 2 }).default("0"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;

// ─── Affiliates ──────────────────────────────────────────────────────────────
export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  affiliateCode: varchar("affiliatecode", { length: 32 }).notNull().unique(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).default("10.00"),
  totalEarnings: numeric("total_earnings", { precision: 18, scale: 2 }).default("0"),
  pendingPayout: numeric("pending_payout", { precision: 18, scale: 2 }).default("0"),
  totalReferrals: integer("total_referrals").default(0),
  totalConversions: integer("total_conversions").default(0),
  status: varchar("status", { length: 50 }).default("pending"),
  tier: varchar("tier", { length: 50 }).default("basic"),
  activeReferrals: integer("active_referrals").default(0),
  paypalEmail: varchar("paypal_email", { length: 320 }),
  payoutMethod: varchar("payout_method", { length: 64 }),
  payoutDetails: json("payout_details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Affiliate = typeof affiliates.$inferSelect;

// ─── Affiliate Commissions ───────────────────────────────────────────────────
export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliateid").notNull(),
  paymentId: integer("paymentid"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Autopilot Config ────────────────────────────────────────────────────────
export const autopilotConfig = pgTable("autopilot_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull().unique().default("default"),
  enabled: integer("enabled").default(0),
  mode: varchar("mode", { length: 50 }).default("balanced"),
  guardrails: json("guardrails"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AutopilotConfig = typeof autopilotConfig.$inferSelect;

// ─── Autopilot Decisions ─────────────────────────────────────────────────────
export const autopilotDecisions = pgTable("autopilot_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("decision_type", { length: 64 }).notNull(),
  action: varchar("action", { length: 256 }).notNull(),
  reasoning: text("reasoning"),
  confidence: integer("confidence"),
  status: varchar("status", { length: 50 }).default("pending"),
  result: json("result"),
  overriddenBy: integer("overridden_by"),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AutopilotDecision = typeof autopilotDecisions.$inferSelect;

// ─── A/B Tests ───────────────────────────────────────────────────────────────
export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 64 }).notNull(),
  status: varchar("status", { length: 50 }).default("draft"),
  variants: json("variants"),
  winnerVariant: varchar("winnerVariant", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AbTest = typeof abTests.$inferSelect;

// ─── A/B Test Results (Detailed Tracking) ────────────────────────────────────
export const abTestResults = pgTable("ab_test_results", {
  id: serial("id").primaryKey(),
  abTestId: integer("ab_test_id").notNull(),
  leadId: integer("lead_id").notNull(),
  variantAssigned: varchar("variant_assigned", { length: 1 }).notNull(),
  emailSent: boolean("email_sent").default(false),
  emailOpened: boolean("email_opened").default(false),
  emailClicked: boolean("email_clicked").default(false),
  emailReplied: boolean("email_replied").default(false),
  linkedinImpression: integer("linkedin_impression").default(0),
  linkedinLike: integer("linkedin_like").default(0),
  linkedinComment: integer("linkedin_comment").default(0),
  linkedinShare: integer("linkedin_share").default(0),
  pricingViewed: boolean("pricing_viewed").default(false),
  pricingSelected: varchar("pricing_selected", { length: 64 }),
  pricingPurchased: boolean("pricing_purchased").default(false),
  dealConverted: boolean("deal_converted").default(false),
  dealSize: numeric("deal_size", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  abTestResultsTestIdx: index("idx_ab_test_results_test_id").on(table.abTestId),
  abTestResultsLeadIdx: index("idx_ab_test_results_lead_id").on(table.leadId),
  abTestResultsVariantIdx: index("idx_ab_test_results_variant").on(table.variantAssigned),
}));

export type AbTestResult = typeof abTestResults.$inferSelect;

// ─── A/B Test Variants (Template Versions) ────────────────────────────────────
export const abTestVariants = pgTable("ab_test_variants", {
  id: serial("id").primaryKey(),
  abTestId: integer("ab_test_id").notNull(),
  variantName: varchar("variant_name", { length: 1 }).notNull(),
  variantType: varchar("variant_type", { length: 64 }).notNull(),
  templateName: varchar("template_name", { length: 256 }),
  subject: varchar("subject", { length: 512 }),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  linkedinText: text("linkedin_text"),
  linkedinImageUrl: text("linkedin_image_url"),
  pricingJson: jsonb("pricing_json"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  abTestVariantsTestIdx: index("idx_ab_test_variants_test_id").on(table.abTestId),
  abTestVariantsVariantIdx: index("idx_ab_test_variants_variant").on(table.variantName),
}));

export type AbTestVariant = typeof abTestVariants.$inferSelect;

// ─── Daily A/B Test Metrics ──────────────────────────────────────────────────
export const dailyAbTestMetrics = pgTable("daily_ab_test_metrics", {
  id: serial("id").primaryKey(),
  abTestId: integer("ab_test_id").notNull(),
  metricDate: text("metric_date").notNull(),
  variantAParticipants: integer("variant_a_participants").default(0),
  variantBParticipants: integer("variant_b_participants").default(0),
  variantAConversions: integer("variant_a_conversions").default(0),
  variantBConversions: integer("variant_b_conversions").default(0),
  variantARevenue: numeric("variant_a_revenue", { precision: 12, scale: 2 }).default("0"),
  variantBRevenue: numeric("variant_b_revenue", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dailyMetricsTestIdx: index("idx_daily_metrics_test_id").on(table.abTestId),
  dailyMetricsDateIdx: index("idx_daily_metrics_date").on(table.metricDate),
}));

export type DailyAbTestMetric = typeof dailyAbTestMetrics.$inferSelect;

// ─── White Label Clients ─────────────────────────────────────────────────────
export const whiteLabelClients = pgTable("white_label_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  companyName: varchar("company_name", { length: 256 }).notNull(),
  domain: varchar("domain", { length: 256 }),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 16 }),
  secondaryColor: varchar("secondary_color", { length: 16 }),
  apiKey: varchar("api_key", { length: 128 }).notNull().unique(),
  apiSecret: varchar("api_secret", { length: 256 }),
  status: varchar("status", { length: 50 }).default("pending"),
  monthlyApiCalls: integer("monthly_api_calls").default(0),
  apiCallLimit: integer("api_call_limit").default(10000),
  features: json("features"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WhiteLabelClient = typeof whiteLabelClients.$inferSelect;

// ─── API Usage (Daily) ───────────────────────────────────────────────────────
export const apiUsageDaily = pgTable("api_usage_daily", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId"),
  tenantId: uuid("tenantId"),
  date: timestamp("date").notNull(),
  endpoint: varchar("endpoint", { length: 128 }),
  calls: integer("calls").default(0),
  callCount: integer("callCount").default(0),
  cost: numeric("cost", { precision: 12, scale: 6 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Activity Log ────────────────────────────────────────────────────────────
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: text("entityId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Fraud Alerts ────────────────────────────────────────────────────────────
export const fraudAlerts = pgTable("fraud_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id"),
  productId: uuid("product_id"),
  alertType: varchar("alert_type", { length: 128 }).notNull(),
  severity: varchar("severity", { length: 50 }).default("medium"),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"),
  resolvedBy: integer("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FraudAlert = typeof fraudAlerts.$inferSelect;

// ─── Customer Health Scores ──────────────────────────────────────────────────
export const customerHealthScores = pgTable("customer_health_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  score: integer("score").notNull(),
  factors: json("factors"),
  trend: varchar("trend", { length: 50 }).default("stable"),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Revenue Records ─────────────────────────────────────────────────────────
export const revenueRecords = pgTable("revenue_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 128 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  type: varchar("type", { length: 50 }).notNull(),
  userId: integer("userId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Notifications ──────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Bonuses ─────────────────────────────────────────────────────────────────
export const bonuses = pgTable("bonuses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  bonusType: varchar("bonus_type", { length: 64 }).notNull(),
  bonusName: varchar("bonus_name", { length: 256 }).notNull(),
  bonusValue: integer("bonus_value").notNull(),
  tier: varchar("tier", { length: 50 }),
  status: varchar("status", { length: 50 }).default("pending"),
  deliveryMethod: varchar("delivery_method", { length: 64 }),
  claimedAt: timestamp("claimed_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Bonus = typeof bonuses.$inferSelect;

// ─── Referral Clicks ─────────────────────────────────────────────────────────
export const referralClicks = pgTable("referral_clicks", {
  id: serial("id").primaryKey(),
  referralCode: varchar("referral_code", { length: 32 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  referer: text("referer"),
  landingPage: text("landing_page"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── AI Models (Marketplace) ─────────────────────────────────────────────────
export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  price: integer("price").notNull().default(0),
  status: varchar("model_status", { length: 50 }).default("draft"),
  downloads: integer("downloads").default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  creatorId: integer("creator_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiModel = typeof aiModels.$inferSelect;

// ─── Model Purchases ─────────────────────────────────────────────────────────
export const modelPurchases = pgTable("model_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  modelId: integer("model_id").notNull(),
  pricePaid: integer("price_paid").notNull(),
  purchaseType: varchar("purchase_type", { length: 50 }).default("purchase"),
  status: varchar("purchase_status", { length: 50 }).default("active"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ModelPurchase = typeof modelPurchases.$inferSelect;

// ─── Model Reviews ────────────────────────────────────────────────────────────
export const modelReviews = pgTable("model_reviews", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull(),
  userId: integer("user_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Prompt Cache ────────────────────────────────────────────────────────────
export const promptCache = pgTable("prompt_cache", {
  id: serial("id").primaryKey(),
  promptHash: varchar("prompt_hash", { length: 128 }).notNull().unique(),
  response: text("response").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 64 }),
  usage: json("usage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Scheduled Job Runs ──────────────────────────────────────────────────────
export const scheduledJobRuns = pgTable("scheduled_job_runs", {
  id: bigserial("id", { mode: 'number' }).primaryKey(),
  jobName: varchar("job_name", { length: 128 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: integer("duration"),
  itemsProcessed: integer("itemsProcessed").default(0),
  result: json("result"),
  error: text("error"),
});

// ─── Budget Config ───────────────────────────────────────────────────────────
export const budgetConfig = pgTable("budget_config", {
  id: serial("id").primaryKey(),
  monthlyLimit: numeric("monthlyLimit", { precision: 18, scale: 2 }).notNull(),
  spent: numeric("spent", { precision: 18, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 16 }).default("USD"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Service Orders ──────────────────────────────────────────────────────────
export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  serviceType: varchar("serviceType", { length: 64 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  priority: integer("priority").default(0),
  amount: numeric("amount", { precision: 18, scale: 4 }),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  customerName: varchar("customer_name", { length: 256 }),
  deliveryUrl: text("delivery_url"),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Character Generations ───────────────────────────────────────────────────
export const characterGenerations = pgTable("character_generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  archetype: varchar("archetype", { length: 32 }).notNull(),
  style: varchar("style", { length: 128 }),
  colorway: varchar("colorway", { length: 64 }),
  mood: varchar("mood", { length: 64 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  provider: varchar("provider", { length: 64 }),
  providerModel: varchar("provider_model", { length: 64 }),
  variantCount: integer("variant_count").default(1),
  status: varchar("status", { length: 50 }).default("pending"),
  context: text("context"),
  bestAssetId: integer("best_asset_id"),
  selectedAssetId: integer("selected_asset_id"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Character Assets ────────────────────────────────────────────────────────
export const characterAssets = pgTable("character_assets", {
  id: serial("id").primaryKey(),
  generationId: integer("generation_id").notNull(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt"),
  isRecommended: integer("is_recommended").default(0),
  isSelected: integer("is_selected").default(0),
  mintStatus: varchar("mint_status", { length: 50 }).default("not_minted"),
  nftTokenId: varchar("nft_token_id", { length: 64 }),
  metadataUri: text("metadata_uri"),
  metadataHash: varchar("metadata_hash", { length: 128 }),
  imageHash: varchar("image_hash", { length: 128 }),
  protocolFitScore: varchar("protocol_fit_score", { length: 8 }),
  thumbnailClarityScore: varchar("thumbnail_clarity_score", { length: 8 }),
  premiumFeelScore: varchar("premium_feel_score", { length: 8 }),
  silhouetteScore: varchar("silhouette_score", { length: 8 }),
  trustSymbolismScore: varchar("trust_symbolism_score", { length: 8 }),
  mintReadinessScore: varchar("mint_readiness_score", { length: 8 }),
  uiCompatibilityScore: varchar("ui_compatibility_score", { length: 8 }),
  totalScore: varchar("total_score", { length: 8 }),
  scoreIconity: integer("score_iconity"),
  scoreTrustClarity: integer("score_trust_clarity"),
  scorePremiumFeel: integer("score_premium_feel"),
  scoreSilhouette: integer("score_silhouette"),
  scoreUiCompat: integer("score_ui_compat"),
  scoreMintReady: integer("score_mint_ready"),
  scoreProtocolAlign: integer("score_protocol_align"),
  audioUrl: text("audio_url"),
  selectedAt: timestamp("selected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Protocol Agents ─────────────────────────────────────────────────────────
export const protocolAgents = pgTable("protocol_agents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  characterAssetId: integer("character_asset_id").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  agentType: varchar("agent_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  reputationScore: integer("reputation_score").default(0),
  qronPending: numeric("qron_pending", { precision: 20, scale: 9 }).default("0.000000000"),
  totalVerifications: integer("total_verifications").default(0),
  successfulVerifications: integer("successful_verifications").default(0),
  totalClaims: integer("total_claims").default(0),
  featureScopes: json("feature_scopes"),
  policyConfig: json("policy_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Verification Claims ─────────────────────────────────────────────────────
export const verificationClaims = pgTable("verification_claims", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  productId: integer("product_id").notNull(),
  authenticationId: integer("authentication_id"),
  claimType: varchar("claim_type", { length: 50 }).notNull(),
  confidence: integer("confidence").notNull(),
  evidence: text("evidence"),
  reasoning: text("reasoning"),
  weight: varchar("weight", { length: 16 }),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Consensus Results ───────────────────────────────────────────────────────
export const consensusResults = pgTable("consensus_results", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  authenticationId: integer("authentication_id").notNull(),
  verdict: varchar("verdict", { length: 50 }).notNull(),
  confidence: integer("confidence").notNull(),
  participantCount: integer("participant_count").default(0),
  finalizedAt: timestamp("finalized_at").defaultNow().notNull(),
});

// ─── QRON Reward Ledger ──────────────────────────────────────────────────────
export const qronRewardLedger = pgTable("qron_reward_ledger", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  referenceType: varchar("reference_type", { length: 32 }),
  referenceId: integer("reference_id"),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Staking Positions ───────────────────────────────────────────────────────
export const stakingPositions = pgTable("staking_positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  agentId: integer("agent_id"),
  amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  multiplier: numeric("multiplier", { precision: 5, scale: 2 }).default("1.00"),
  apy: numeric("apy", { precision: 5, scale: 2 }).default("5.00"),
  rewardsEarned: numeric("rewards_earned", { precision: 20, scale: 9 }).default("0"),
  lastRewardCalculation: timestamp("last_reward_calculation"),
  stakedAt: timestamp("staked_at").defaultNow().notNull(),
  releaseAt: timestamp("release_at"),
  endDate: timestamp("end_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Checkpoint Batches ──────────────────────────────────────────────────────
export const checkpointBatches = pgTable("checkpoint_batches", {
  id: serial("id").primaryKey(),
  batchHash: varchar("batch_hash", { length: 128 }).notNull(),
  blockchainTxHash: varchar("blockchain_tx_hash", { length: 128 }),
  claimCount: integer("claim_count").default(0),
  status: varchar("status", { length: 50 }).default("pending"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Missions ────────────────────────────────────────────────────────────────
export const missions = pgTable("missions", {
  id: uuid("id").primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Mission Tasks ───────────────────────────────────────────────────────────
export const missionTasks = pgTable("mission_tasks", {
  id: uuid("id").primaryKey(),
  missionId: uuid("mission_id").notNull(),
  kind: varchar("kind", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  priority: integer("priority").default(0).notNull(),
  order: integer("task_order").default(0).notNull(),
  payload: json("payload"),
  result: json("result"),
  error: text("error"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Platform Fees ───────────────────────────────────────────────────────────
export const platformFees = pgTable("platform_fees", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  status: varchar("status", { length: 50 }).default("pending"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Bayesian Priors ─────────────────────────────────────────────────────────
export const bayesianPriors = pgTable("bayesian_priors", {
  id: serial("id").primaryKey(),
  segment: varchar("segment", { length: 64 }).notNull().unique(),
  priorAlpha: numeric("prior_alpha", { precision: 10, scale: 4 }).default("2.0000"), // Successes
  priorBeta: numeric("prior_beta", { precision: 10, scale: 4 }).default("18.0000"), // Failures (Base 10% rate)
  currentMean: numeric("current_mean", { precision: 5, scale: 4 }).default("0.1000"),
  observationsCount: integer("observations_count").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BayesianPrior = typeof bayesianPriors.$inferSelect;
export type InsertBayesianPrior = typeof bayesianPriors.$inferInsert;

// ─── NFT Collections ─────────────────────────────────────────────────────────
export const nftCollections = pgTable("nft_collections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  contractAddress: varchar("contract_address", { length: 64 }),
  imageUrl: text("image_url"),
  totalSupply: integer("total_supply").default(0),
  status: varchar("status", { length: 50 }).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── NFTs ─────────────────────────────────────────────────────────────────────
export const nfts = pgTable("nfts", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: integer("collection_id"),
  tokenId: varchar("token_id", { length: 64 }),
  name: varchar("name", { length: 256 }),
  description: text("description"),
  imageUrl: text("image_url"),
  metadataUri: text("metadata_uri"),
  ownerAddress: varchar("owner_address", { length: 64 }),
  ownerId: integer("owner_id"),
  status: varchar("status", { length: 50 }).default("minted"),
  attributes: json("attributes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Auctions ─────────────────────────────────────────────────────────────────
export const auctions = pgTable("auctions", {
  id: uuid("id").primaryKey().defaultRandom(),
  nftId: uuid("nft_id"),
  sellerId: integer("seller_id"),
  startPrice: numeric("start_price", { precision: 18, scale: 8 }).notNull(),
  reservePrice: numeric("reserve_price", { precision: 18, scale: 8 }),
  currentBid: numeric("highest_bid", { precision: 18, scale: 8 }),
  highestBidderId: integer("highest_bidder_id"),
  bidCount: integer("bid_count").default(0),
  status: varchar("status", { length: 50 }).default("active"),
  endsAt: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Auction Bids ─────────────────────────────────────────────────────────────
export const auctionBids = pgTable("auction_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  auctionId: uuid("auction_id").notNull(),
  bidderId: integer("bidder_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Dead Letter Queue ────────────────────────────────────────────────────────
export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: serial("id").primaryKey(),
  taskType: varchar("task_type", { length: 128 }),
  payload: json("payload"),
  error: text("error"),
  retryCount: integer("retries").default(0),
  status: varchar("status", { length: 50 }).default("pending"),
  lastAttemptedAt: timestamp("last_attempted_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Feedback ────────────────────────────────────────────────────────────────
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  votes: integer("votes").default(0),
  adminResponse: text("adminResponse"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const feedbackVotes = pgTable("feedback_votes", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedbackId").notNull(),
  userId: integer("userId").notNull(),
  voteType: varchar("voteType", { length: 32 }).default("up"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertFeedback = typeof feedback.$inferInsert;
export type InsertFeedbackVote = typeof feedbackVotes.$inferInsert;

export type Mission = typeof missions.$inferSelect;
export type MissionTask = typeof missionTasks.$inferSelect;
export type CharacterGeneration = typeof characterGenerations.$inferSelect;
export type InsertCharacterGeneration = typeof characterGenerations.$inferInsert;
export type CharacterAsset = typeof characterAssets.$inferSelect;
export type InsertCharacterAsset = typeof characterAssets.$inferInsert;
export type ProtocolAgent = typeof protocolAgents.$inferSelect;
export type InsertProtocolAgent = typeof protocolAgents.$inferInsert;
export type StakingPosition = typeof stakingPositions.$inferSelect;
export type InsertStakingPosition = typeof stakingPositions.$inferInsert;
export type PlatformFee = typeof platformFees.$inferSelect;
export type InsertPlatformFee = typeof platformFees.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ─── Personalization ─────────────────────────────────────────────────────────
export const visitorProfiles = pgTable("visitor_profiles", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("user_agent"),
  country: varchar("country", { length: 8 }),
  city: varchar("city", { length: 128 }),
  referrer: text("referrer"),
  trafficSource: varchar("trafficSource", { length: 64 }),
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  segment: varchar("segment", { length: 64 }),
  deviceType: varchar("deviceType", { length: 32 }),
  pageViews: integer("pageViews").default(0).notNull(),
  converted: integer("converted").default(0).notNull(),
  timeOnSite: integer("time_on_site").default(0).notNull(),
  lastSeenAt: timestamp("lastSeen").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const personalizationRules = pgTable("personalization_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  segment: varchar("segment", { length: 64 }),
  country: varchar("country", { length: 8 }),
  utmSource: varchar("utm_source", { length: 128 }),
  deviceType: varchar("device_type", { length: 32 }),
  targetElement: varchar("targetElement", { length: 128 }),
  content: json("content"),
  conditions: json("conditions"),
  views: integer("views").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  conversionRate: numeric("conversionRate", { precision: 18, scale: 4 }).default("0").notNull(),
  priority: integer("priority").default(0),
  status: varchar("status", { length: 32 }).default("active"),
  aiGenerated: integer("ai_generated").default(0),
  createdBy: integer("created_by"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const personalizationEvents = pgTable("personalization_events", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  ruleId: integer("ruleId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Proposals ───────────────────────────────────────────────────────────────
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey(),
  leadEmail: varchar("lead_email", { length: 320 }).notNull(),
  segment: varchar("segment", { length: 64 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// ─── Inbound Email Replies ───────────────────────────────────────────────────────
export const inboundReplies = pgTable("inbound_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: integer("lead_id"), // FK to leads.id, null if unmatched
  leadEmail: varchar("lead_email", { length: 320 }).notNull(),
  senderName: varchar("sender_name", { length: 256 }),
  subject: varchar("subject", { length: 512 }),
  bodyPlaintext: text("body_plaintext"),
  bodyHtml: text("body_html"),
  messageId: varchar("message_id", { length: 256 }).notNull().unique(), // Resend ID for deduplication
  sentiment: varchar("sentiment", { length: 32 }), // positive|neutral|negative|objection
  objectionType: varchar("objection_type", { length: 64 }), // budget|timeline|competitor|decision_maker|other
  objectionDetails: text("objection_details"),
  confidence: real("confidence"), // 0.0-1.0 from Claude
  proposalMatchId: varchar("proposal_match_id", { length: 64 }), // FK to proposals.id
  matchConfidence: real("match_confidence"), // how sure we are about the match
  status: varchar("status", { length: 32 }).default("new"), // new|contacted|deal_won|disqualified|nurture_paused
  manualOverride: boolean("manual_override").default(false),
  manualSentiment: varchar("manual_sentiment", { length: 32 }),
  overriddenBy: integer("overridden_by"), // userId who overrode
  overriddenAt: timestamp("overridden_at"),
  metadata: jsonb("metadata").default({}), // raw headers, thread info
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  inboundRepliesLeadIdx: index("idx_inbound_replies_lead").on(table.leadId),
  inboundRepliesEmailIdx: index("idx_inbound_replies_email").on(table.leadEmail),
  inboundRepliesStatusIdx: index("idx_inbound_replies_status").on(table.status),
  inboundRepliesSentimentIdx: index("idx_inbound_replies_sentiment").on(table.sentiment),
}));

export type InboundReply = typeof inboundReplies.$inferSelect;
export type InsertInboundReply = typeof inboundReplies.$inferInsert;

// ─── Reply Nurture Sequences ────────────────────────────────────────────────────
export const replySequences = pgTable("reply_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: integer("lead_id").notNull(), // FK to leads.id
  replyId: uuid("reply_id").notNull(), // FK to inbound_replies.id
  templateType: varchar("template_type", { length: 64 }).notNull(), // objection_budget|objection_timeline|positive_followup|reminder|objection_competitor
  sequenceNumber: integer("sequence_number").default(1), // 1,2,3... in sequence
  status: varchar("status", { length: 32 }).default("pending"), // pending|sent|clicked|bounced|paused
  sentAt: timestamp("sent_at"),
  clickedAt: timestamp("clicked_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  emailSubject: varchar("email_subject", { length: 512 }),
  emailBody: text("email_body"),
  metadata: jsonb("metadata").default({}), // tracking info, link info
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  replySequencesLeadIdx: index("idx_reply_sequences_lead").on(table.leadId),
  replySequencesReplyIdx: index("idx_reply_sequences_reply").on(table.replyId),
  replySequencesStatusIdx: index("idx_reply_sequences_status").on(table.status),
  replySequencesScheduledIdx: index("idx_reply_sequences_scheduled").on(table.nextScheduledAt),
}));

export type ReplySequence = typeof replySequences.$inferSelect;
export type InsertReplySequence = typeof replySequences.$inferInsert;

// ── Restored 2026-08-17 ────────────────────────────────────────────────────────
// #663 ("Sync repository state") deleted 185 lines from this file, including
// every definition below, and added nothing in their place. Six of the seven are
// still imported by live code — src/lib/guardrail.ts, guardrail-anomaly.ts, the
// two /api/guardrail routes, server/email-service.ts and revenue-orchestrator.ts
// — so `pnpm check` has failed repo-wide ever since, blocking `ci`, `test` and
// `lint` on every PR.
//
// All of these tables exist in the live database and several hold data
// (guardrail_events 294 rows, guardrail_counters 7, guardrail_channels 6,
// seo_pages 7), so their removal was a stale-snapshot accident rather than an
// intentional schema change. Restored verbatim from 9313fdfd^.

export const seoPages = pgTable("seo_generated_pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  keyword: varchar("keyword", { length: 256 }).notNull(),
  brand: varchar("brand", { length: 64 }).notNull(),
  domain: varchar("domain", { length: 128 }).notNull(),
  title: varchar("title", { length: 60 }).notNull(),
  metaDescription: varchar("metaDescription", { length: 155 }).notNull(),
  h1: varchar("h1", { length: 256 }).notNull(),
  bodyHtml: text("bodyHtml").notNull(),
  jsonLd: jsonb("jsonLd").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    eventId: varchar("eventId", { length: 128 }).notNull(),
    eventType: varchar("eventType", { length: 128 }).notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
  },
  (t) => ({
    uniqProviderEvent: uniqueIndex("webhook_events_provider_eventId_uniq").on(
      t.provider,
      t.eventId
    ),
  })
);

export const guardrailChannels = pgTable("guardrail_channels", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(), // email|content|contract|spend
  dailyCap: integer("daily_cap").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  spendCeilingCents: integer("spend_ceiling_cents").default(0).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  guardrailChannelsNameUniq: uniqueIndex("guardrail_channels_name_uniq").on(table.name),
}));

export const guardrailCounters = pgTable("guardrail_counters", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  day: date("day").notNull(),
  count: integer("count").default(0).notNull(),
}, (table) => ({
  guardrailCountersChannelDayUniq: uniqueIndex("guardrail_counters_channel_day_uniq").on(table.channelId, table.day),
}));

export const suppressionList = pgTable("guardrail_suppression_list", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  reason: varchar("reason", { length: 32 }).notNull(), // bounced|complained|manual|unsubscribed
  source: varchar("source", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  suppressionListEmailUniq: uniqueIndex("guardrail_suppression_list_email_uniq").on(table.email),
}));

export const killSwitches = pgTable("kill_switches", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 128 }).notNull(), // "global" or a channel name
  enabled: boolean("enabled").default(false).notNull(), // true = tripped/blocked
  reason: text("reason"),
  updatedBy: varchar("updated_by", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  killSwitchesScopeUniq: uniqueIndex("kill_switches_scope_uniq").on(table.scope),
}));

export const guardrailEvents = pgTable("guardrail_events", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id"),
  action: varchar("action", { length: 32 }).notNull(), // check|record|suppress|kill_toggle
  allowed: boolean("allowed"),
  reason: text("reason"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  guardrailEventsChannelIdx: index("idx_guardrail_events_channel").on(table.channelId),
  guardrailEventsCreatedIdx: index("idx_guardrail_events_created").on(table.createdAt),
}));
