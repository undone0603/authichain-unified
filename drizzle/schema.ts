import {
  pgTable,
  pgEnum,
  varchar,
  text,
  integer,
  serial,
  timestamp,
  json,
  decimal,
} from "drizzle-orm/pg-core";

// ─── PostgreSQL Enums (standalone, database-level types) ─────────────────────

export const missionStatusEnum = pgEnum("mission_status", ["pending", "active", "completed", "failed"]);
export const missionTaskStatusEnum = pgEnum("mission_task_status", ["pending", "in_progress", "completed", "failed"]);
export const productStatusEnum = pgEnum("product_status", ["active", "recalled", "expired", "flagged"]);
export const authResultEnum = pgEnum("auth_result", ["authentic", "counterfeit", "uncertain"]);
export const certificateStatusEnum = pgEnum("certificate_status", ["active", "revoked", "expired"]);
export const nftStatusEnum = pgEnum("nft_status", ["listed", "sold", "unlisted", "auction"]);
export const auctionStatusEnum = pgEnum("auction_status", ["active", "ended", "cancelled"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["starter", "professional", "enterprise"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "cancelled", "past_due", "trialing", "paused"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "pending", "paid", "overdue", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["stripe", "crypto", "escrow"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded", "escrowed"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "proposal", "won", "lost"]);
export const campaignTypeEnum = pgEnum("campaign_type", ["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "scheduled", "sending", "sent", "paused"]);
export const emailDraftStatusEnum = pgEnum("email_draft_status", ["pending", "approved", "rejected", "sent"]);
export const supplyChainEventTypeEnum = pgEnum("supply_chain_event_type", ["manufactured", "shipped", "in_transit", "customs", "delivered", "verified", "recalled"]);
export const referralStatusEnum = pgEnum("referral_status", ["pending", "active", "converted", "expired"]);
export const referralTierEnum = pgEnum("referral_tier", ["starter", "professional", "enterprise", "agency"]);
export const affiliateTierEnum = pgEnum("affiliate_tier", ["basic", "silver", "gold", "platinum"]);
export const affiliateStatusEnum = pgEnum("affiliate_status", ["active", "suspended", "pending"]);
export const commissionStatusEnum = pgEnum("commission_status", ["pending", "approved", "paid", "rejected"]);
export const autopilotModeEnum = pgEnum("autopilot_mode", ["conservative", "balanced", "aggressive"]);
export const autopilotDecisionStatusEnum = pgEnum("autopilot_decision_status", ["pending", "executed", "overridden", "failed"]);
export const abTestStatusEnum = pgEnum("ab_test_status", ["draft", "running", "completed", "paused"]);
export const whiteLabelStatusEnum = pgEnum("white_label_status", ["active", "suspended", "pending"]);
export const fraudSeverityEnum = pgEnum("fraud_severity", ["low", "medium", "high", "critical"]);
export const fraudAlertStatusEnum = pgEnum("fraud_alert_status", ["open", "investigating", "resolved", "dismissed"]);
export const healthTrendEnum = pgEnum("health_trend", ["improving", "stable", "declining"]);
export const revenueTypeEnum = pgEnum("revenue_type", ["subscription", "one_time", "overage", "affiliate", "marketplace"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "authentication", "certificate", "payment", "subscription",
  "nft", "referral", "system", "alert", "supply_chain", "autopilot",
]);
export const jobRunStatusEnum = pgEnum("job_run_status", ["running", "completed", "failed"]);
export const archetypeEnum = pgEnum("archetype", ["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]);
export const charGenStatusEnum = pgEnum("char_gen_status", ["pending", "generating", "completed", "selected", "mint_ready", "failed"]);
export const mintStatusEnum = pgEnum("mint_status", ["not_minted", "preparing", "queued", "minting", "minted", "failed"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "inactive", "suspended"]);
export const claimTypeEnum = pgEnum("claim_type", ["authentic", "counterfeit", "inconclusive", "needs_review"]);
export const claimStatusEnum = pgEnum("claim_status", ["pending", "accepted", "rejected", "superseded"]);
export const consensusFinalStatusEnum = pgEnum("consensus_final_status", ["authentic", "counterfeit", "inconclusive"]);
export const rewardReasonEnum = pgEnum("reward_reason", [
  "verification_reward", "consensus_participation", "accuracy_bonus",
  "streak_bonus", "referral_reward", "staking_yield", "penalty",
]);
export const rewardStatusEnum = pgEnum("reward_status", ["pending", "settled", "claimed", "expired"]);
export const batchTypeEnum = pgEnum("batch_type", ["verification", "reward_settlement", "agent_registration"]);
export const batchStatusEnum = pgEnum("batch_status", ["pending", "submitted", "confirmed", "failed"]);
export const bonusTierEnum = pgEnum("bonus_tier", ["starter", "professional", "enterprise", "agency"]);
export const bonusStatusEnum = pgEnum("bonus_status", ["pending", "claimed", "delivered"]);
export const modelStatusEnum = pgEnum("model_status", ["active", "draft", "archived"]);
export const purchaseTypeEnum = pgEnum("purchase_type", ["purchase", "subscription", "rental"]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["active", "expired", "refunded"]);
export const serviceTypeEnum = pgEnum("service_type", [
  "authenticity_audit", "cinematic_page", "automation_setup",
  "landing_page", "brand_story_pack", "government_dossier",
]);
export const serviceOrderStatusEnum = pgEnum("service_order_status", ["pending", "paid", "in_progress", "delivered", "cancelled"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "brand"]);

// ─── Missions ────────────────────────────────────────────────────────────────

export const missions = pgTable("missions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: missionStatusEnum("status").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const missionTasks = pgTable("mission_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  missionId: varchar("mission_id", { length: 36 })
    .notNull()
    .references(() => missions.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: missionTaskStatusEnum("status").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ─── Products ────────────────────────────────────────────────────────────────

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  brand: varchar("brand", { length: 256 }),
  category: varchar("category", { length: 128 }),
  description: text("description"),
  imageUrl: text("imageUrl"),
  serialNumber: varchar("serialNumber", { length: 256 }),
  batchNumber: varchar("batchNumber", { length: 256 }),
  manufacturingDate: timestamp("manufacturingDate"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  nftTokenId: varchar("nftTokenId", { length: 128 }),
  status: productStatusEnum("status").default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Authentications ─────────────────────────────────────────────────────────

export const authentications = pgTable("authentications", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  userId: integer("userId").notNull(),
  result: authResultEnum("result").notNull(),
  confidenceScore: integer("confidenceScore").notNull(),
  aiAnalysis: json("aiAnalysis"),
  imageUrl: text("imageUrl"),
  isPublic: integer("isPublic").default(0),
  shareToken: varchar("shareToken", { length: 128 }),
  shareCount: integer("shareCount").default(0),
  verificationMethod: varchar("verificationMethod", { length: 64 }).default("ai_image"),
  blockchainVerified: integer("blockchainVerified").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Authentication = typeof authentications.$inferSelect;

// ─── Certificates ────────────────────────────────────────────────────────────

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId"),
  userId: integer("userId").notNull(),
  certificateNumber: varchar("certificateNumber", { length: 64 }).notNull().unique(),
  status: certificateStatusEnum("status").default("active"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;

// ─── QR Codes ────────────────────────────────────────────────────────────────

export const qrCodes = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  userId: integer("userId").notNull(),
  qrData: text("qrData").notNull(),
  qrImageUrl: text("qrImageUrl"),
  scanCount: integer("scanCount").default(0),
  lastScannedAt: timestamp("lastScannedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QrCode = typeof qrCodes.$inferSelect;

// ─── NFT Collections ─────────────────────────────────────────────────────────

export const nftCollections = pgTable("nft_collections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  bannerUrl: text("bannerUrl"),
  category: varchar("category", { length: 128 }),
  floorPrice: decimal("floorPrice", { precision: 18, scale: 8 }).default("0"),
  totalVolume: decimal("totalVolume", { precision: 18, scale: 8 }).default("0"),
  itemCount: integer("itemCount").default(0),
  ownerCount: integer("ownerCount").default(0),
  verified: integer("verified").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NftCollection = typeof nftCollections.$inferSelect;

// ─── NFTs ────────────────────────────────────────────────────────────────────

export const nfts = pgTable("nfts", {
  id: serial("id").primaryKey(),
  collectionId: integer("collectionId"),
  ownerId: integer("ownerId").notNull(),
  creatorId: integer("creatorId").notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  ipfsHash: varchar("ipfsHash", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  contractAddress: varchar("contractAddress", { length: 128 }),
  blockchain: varchar("blockchain", { length: 64 }).default("polygon"),
  price: decimal("price", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 16 }).default("ETH"),
  rarityScore: integer("rarityScore"),
  rarityRank: integer("rarityRank"),
  traits: json("traits"),
  status: nftStatusEnum("status").default("listed"),
  viewCount: integer("viewCount").default(0),
  likeCount: integer("likeCount").default(0),
  productId: integer("productId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Nft = typeof nfts.$inferSelect;

// ─── Auctions ────────────────────────────────────────────────────────────────

export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  nftId: integer("nftId").notNull(),
  sellerId: integer("sellerId").notNull(),
  startPrice: decimal("startPrice", { precision: 18, scale: 8 }).notNull(),
  reservePrice: decimal("reservePrice", { precision: 18, scale: 8 }),
  currentBid: decimal("currentBid", { precision: 18, scale: 8 }),
  highestBidderId: integer("highestBidderId"),
  bidCount: integer("bidCount").default(0),
  status: auctionStatusEnum("status").default("active"),
  startsAt: timestamp("startsAt").defaultNow().notNull(),
  endsAt: timestamp("endsAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Auction = typeof auctions.$inferSelect;

// ─── Auction Bids ────────────────────────────────────────────────────────────

export const auctionBids = pgTable("auction_bids", {
  id: serial("id").primaryKey(),
  auctionId: integer("auctionId").notNull(),
  bidderId: integer("bidderId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  plan: subscriptionPlanEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").default("active"),
  monthlyQuota: integer("monthlyQuota").notNull(),
  usedQuota: integer("usedQuota").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  paddleSubscriptionId: varchar("paddleSubscriptionId", { length: 128 }),
  paddleCustomerId: varchar("paddleCustomerId", { length: 128 }),
  billingCycle: billingCycleEnum("billingCycle").default("monthly"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  trialEndsAt: timestamp("trialEndsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Usage Records ───────────────────────────────────────────────────────────

export const usageRecords = pgTable("usage_records", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId"),
  type: varchar("type", { length: 64 }).notNull(),
  quantity: integer("quantity").default(1),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Invoices ────────────────────────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  status: invoiceStatusEnum("status").default("draft"),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 128 }),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate"),
  items: json("items"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;

// ─── Payments ────────────────────────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").default("pending"),
  stripePaymentId: varchar("stripePaymentId", { length: 128 }),
  cryptoPaymentId: varchar("cryptoPaymentId", { length: 128 }),
  cryptoAddress: varchar("cryptoAddress", { length: 256 }),
  escrowReleaseDate: timestamp("escrowReleaseDate"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
  status: leadStatusEnum("status").default("new"),
  industry: varchar("industry", { length: 128 }),
  notes: text("notes"),
  lastContactedAt: timestamp("lastContactedAt"),
  assignedTo: integer("assignedTo"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;

// ─── Email Campaigns ─────────────────────────────────────────────────────────

export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  type: campaignTypeEnum("type").notNull(),
  status: campaignStatusEnum("status").default("draft"),
  recipientCount: integer("recipientCount").default(0),
  sentCount: integer("sentCount").default(0),
  openCount: integer("openCount").default(0),
  clickCount: integer("clickCount").default(0),
  bounceCount: integer("bounceCount").default(0),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;

// ─── Email Drafts (Approval Workflow) ────────────────────────────────────────

export const emailDrafts = pgTable("email_drafts", {
  id: serial("id").primaryKey(),
  prospectName: varchar("prospectName", { length: 256 }),
  prospectEmail: varchar("prospectEmail", { length: 320 }).notNull(),
  prospectCompany: varchar("prospectCompany", { length: 256 }),
  prospectTitle: varchar("prospectTitle", { length: 256 }),
  industry: varchar("industry", { length: 128 }),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  templateUsed: varchar("templateUsed", { length: 128 }),
  status: emailDraftStatusEnum("status").default("pending"),
  generatedBy: varchar("generatedBy", { length: 64 }).default("ai_manager"),
  approvedBy: integer("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  sentAt: timestamp("sentAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailDraft = typeof emailDrafts.$inferSelect;

// ─── Supply Chain Events ─────────────────────────────────────────────────────

export const supplyChainEvents = pgTable("supply_chain_events", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  eventType: supplyChainEventTypeEnum("eventType").notNull(),
  location: varchar("location", { length: 512 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  temperature: decimal("temperature", { precision: 5, scale: 2 }),
  humidity: decimal("humidity", { precision: 5, scale: 2 }),
  handler: varchar("handler", { length: 256 }),
  notes: text("notes"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  iotDeviceId: varchar("iotDeviceId", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplyChainEvent = typeof supplyChainEvents.$inferSelect;

// ─── Referrals ───────────────────────────────────────────────────────────────

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrerId").notNull(),
  referredId: integer("referredId"),
  referralCode: varchar("referralCode", { length: 32 }).notNull().unique(),
  status: referralStatusEnum("status").default("pending"),
  referredEmail: varchar("referredEmail", { length: 320 }),
  tier: referralTierEnum("tier"),
  rewardAmount: decimal("rewardAmount", { precision: 10, scale: 2 }).default("0"),
  commissionPaid: decimal("commissionPaid", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: integer("rewardPaid").default(0),
  convertedAt: timestamp("convertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;

// ─── Affiliates ──────────────────────────────────────────────────────────────

export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  affiliateCode: varchar("affiliateCode", { length: 32 }).notNull().unique(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).default("10.00"),
  totalEarnings: decimal("totalEarnings", { precision: 18, scale: 2 }).default("0"),
  pendingPayout: decimal("pendingPayout", { precision: 18, scale: 2 }).default("0"),
  totalReferrals: integer("totalReferrals").default(0),
  totalConversions: integer("totalConversions").default(0),
  tier: affiliateTierEnum("affiliateTier").default("basic"),
  activeReferrals: integer("activeReferrals").default(0),
  paypalEmail: varchar("paypalEmail", { length: 320 }),
  status: affiliateStatusEnum("status").default("pending"),
  payoutMethod: varchar("payoutMethod", { length: 64 }),
  payoutDetails: json("payoutDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Affiliate = typeof affiliates.$inferSelect;

// ─── Affiliate Commissions ───────────────────────────────────────────────────

export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliateId").notNull(),
  paymentId: integer("paymentId"),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  status: commissionStatusEnum("status").default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Autopilot Config ────────────────────────────────────────────────────────

export const autopilotConfig = pgTable("autopilot_config", {
  id: serial("id").primaryKey(),
  enabled: integer("enabled").default(0),
  mode: autopilotModeEnum("mode").default("balanced"),
  guardrails: json("guardrails"),
  updatedBy: integer("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AutopilotConfig = typeof autopilotConfig.$inferSelect;

// ─── Autopilot Decisions ─────────────────────────────────────────────────────

export const autopilotDecisions = pgTable("autopilot_decisions", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  action: varchar("action", { length: 256 }).notNull(),
  reasoning: text("reasoning"),
  confidence: integer("confidence"),
  status: autopilotDecisionStatusEnum("status").default("pending"),
  result: json("result"),
  overriddenBy: integer("overriddenBy"),
  overrideReason: text("overrideReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AutopilotDecision = typeof autopilotDecisions.$inferSelect;

// ─── A/B Tests ───────────────────────────────────────────────────────────────

export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 64 }).notNull(),
  status: abTestStatusEnum("status").default("draft"),
  variants: json("variants"),
  winnerVariant: varchar("winnerVariant", { length: 64 }),
  totalParticipants: integer("totalParticipants").default(0),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AbTest = typeof abTests.$inferSelect;

// ─── White Label Clients ─────────────────────────────────────────────────────

export const whiteLabelClients = pgTable("white_label_clients", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  companyName: varchar("companyName", { length: 256 }).notNull(),
  domain: varchar("domain", { length: 256 }),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 16 }),
  secondaryColor: varchar("secondaryColor", { length: 16 }),
  apiKey: varchar("apiKey", { length: 128 }).notNull().unique(),
  apiSecret: varchar("apiSecret", { length: 256 }),
  status: whiteLabelStatusEnum("status").default("pending"),
  monthlyApiCalls: integer("monthlyApiCalls").default(0),
  apiCallLimit: integer("apiCallLimit").default(10000),
  features: json("features"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WhiteLabelClient = typeof whiteLabelClients.$inferSelect;

// ─── Activity Log ────────────────────────────────────────────────────────────

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: integer("entityId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Fraud Alerts ────────────────────────────────────────────────────────────

export const fraudAlerts = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  productId: integer("productId"),
  alertType: varchar("alertType", { length: 128 }).notNull(),
  severity: fraudSeverityEnum("severity").default("medium"),
  description: text("description"),
  status: fraudAlertStatusEnum("status").default("open"),
  resolvedBy: integer("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FraudAlert = typeof fraudAlerts.$inferSelect;

// ─── Customer Health Scores ──────────────────────────────────────────────────

export const customerHealthScores = pgTable("customer_health_scores", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  score: integer("score").notNull(),
  factors: json("factors"),
  trend: healthTrendEnum("trend").default("stable"),
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Revenue Records ─────────────────────────────────────────────────────────

export const revenueRecords = pgTable("revenue_records", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  type: revenueTypeEnum("type").notNull(),
  userId: integer("userId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Notifications ──────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Scheduled Job Runs ─────────────────────────────────────────────────────

export const scheduledJobRuns = pgTable("scheduled_job_runs", {
  id: serial("id").primaryKey(),
  jobName: varchar("jobName", { length: 128 }).notNull(),
  status: jobRunStatusEnum("status").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: integer("duration"), // milliseconds
  result: json("result"),
  error: text("error"),
  itemsProcessed: integer("itemsProcessed").default(0),
});

export type ScheduledJobRun = typeof scheduledJobRuns.$inferSelect;
export type InsertScheduledJobRun = typeof scheduledJobRuns.$inferInsert;

// ─── Character Generations ──────────────────────────────────────────────────

export const characterGenerations = pgTable("character_generations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tenantId: varchar("tenantId", { length: 128 }),
  objectId: varchar("objectId", { length: 128 }),
  archetype: archetypeEnum("archetype").notNull(),
  style: varchar("style", { length: 256 }).default("premium futuristic heraldic concept art"),
  colorway: varchar("colorway", { length: 256 }),
  mood: varchar("mood", { length: 256 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  provider: varchar("provider", { length: 64 }).default("openart"),
  providerModel: varchar("providerModel", { length: 128 }),
  variantCount: integer("variantCount").default(4),
  status: charGenStatusEnum("status").default("pending"),
  selectedAssetId: integer("selectedAssetId"),
  bestAssetId: integer("bestAssetId"),
  context: json("context"),
  requestPayload: json("requestPayload"),
  responsePayload: json("responsePayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type CharacterGeneration = typeof characterGenerations.$inferSelect;
export type InsertCharacterGeneration = typeof characterGenerations.$inferInsert;

// ─── Character Assets ───────────────────────────────────────────────────────

export const characterAssets = pgTable("character_assets", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  tenantId: varchar("tenantId", { length: 128 }),
  userId: integer("userId"),
  providerAssetId: varchar("providerAssetId", { length: 256 }),
  imageUrl: text("imageUrl").notNull(),
  previewUrl: text("previewUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  prompt: text("prompt"),
  metadata: json("metadata"),
  // 7-dimension scoring (0.0-10.0 scale, matching OpenArt protocol)
  protocolFitScore: decimal("protocolFitScore", { precision: 4, scale: 1 }),
  thumbnailClarityScore: decimal("thumbnailClarityScore", { precision: 4, scale: 1 }),
  premiumFeelScore: decimal("premiumFeelScore", { precision: 4, scale: 1 }),
  silhouetteScore: decimal("silhouetteScore", { precision: 4, scale: 1 }),
  trustSymbolismScore: decimal("trustSymbolismScore", { precision: 4, scale: 1 }),
  mintReadinessScore: decimal("mintReadinessScore", { precision: 4, scale: 1 }),
  uiCompatibilityScore: decimal("uiCompatibilityScore", { precision: 4, scale: 1 }),
  totalScore: decimal("totalScore", { precision: 5, scale: 2 }),
  // Legacy integer scores (backward compat)
  scoreIconity: integer("scoreIconity"),
  scoreTrustClarity: integer("scoreTrustClarity"),
  scorePremiumFeel: integer("scorePremiumFeel"),
  scoreSilhouette: integer("scoreSilhouette"),
  scoreUiCompat: integer("scoreUiCompat"),
  scoreMintReady: integer("scoreMintReady"),
  scoreProtocolAlign: integer("scoreProtocolAlign"),
  isRecommended: integer("isRecommended").default(0),
  isSelected: integer("isSelected").default(0),
  selectedAt: timestamp("selectedAt"),
  // Mint fields
  metadataUri: text("metadataUri"),
  metadataHash: varchar("metadataHash", { length: 128 }),
  imageHash: varchar("imageHash", { length: 128 }),
  mintStatus: mintStatusEnum("mintStatus").default("not_minted"),
  mintTxHash: varchar("mintTxHash", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  mintedAt: timestamp("mintedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CharacterAsset = typeof characterAssets.$inferSelect;
export type InsertCharacterAsset = typeof characterAssets.$inferInsert;

// ─── Protocol Agents ────────────────────────────────────────────────────────

export const protocolAgents = pgTable("protocol_agents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  characterAssetId: integer("characterAssetId"),
  name: varchar("name", { length: 256 }).notNull(),
  agentType: archetypeEnum("agentType").notNull(),
  status: agentStatusEnum("status").default("active"),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  reputationScore: integer("reputationScore").default(100),
  totalVerifications: integer("totalVerifications").default(0),
  successfulVerifications: integer("successfulVerifications").default(0),
  totalClaims: integer("totalClaims").default(0),
  consensusParticipations: integer("consensusParticipations").default(0),
  qronEarned: decimal("qronEarned", { precision: 18, scale: 8 }).default("0"),
  qronPending: decimal("qronPending", { precision: 18, scale: 8 }).default("0"),
  walletAddress: varchar("walletAddress", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  policyConfig: json("policyConfig"),
  featureScopes: json("featureScopes"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ProtocolAgent = typeof protocolAgents.$inferSelect;
export type InsertProtocolAgent = typeof protocolAgents.$inferInsert;

// ─── Verification Claims ────────────────────────────────────────────────────

export const verificationClaims = pgTable("verification_claims", {
  id: serial("id").primaryKey(),
  agentId: integer("agentId").notNull(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId"),
  claimType: claimTypeEnum("claimType").notNull(),
  confidence: integer("confidence").notNull(),
  evidence: json("evidence"),
  reasoning: text("reasoning"),
  status: claimStatusEnum("status").default("pending"),
  weight: decimal("weight", { precision: 5, scale: 3 }).default("1.000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VerificationClaim = typeof verificationClaims.$inferSelect;

// ─── Consensus Results ──────────────────────────────────────────────────────

export const consensusResults = pgTable("consensus_results", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId"),
  finalStatus: consensusFinalStatusEnum("finalStatus").notNull(),
  finalScore: integer("finalScore").notNull(),
  quorumCount: integer("quorumCount").notNull(),
  claimIds: json("claimIds"),
  settledOnChain: integer("settledOnChain").default(0),
  checkpointBatchId: integer("checkpointBatchId"),
  txHash: varchar("txHash", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsensusResult = typeof consensusResults.$inferSelect;

// ─── QRON Reward Ledger ─────────────────────────────────────────────────────

export const qronRewardLedger = pgTable("qron_reward_ledger", {
  id: serial("id").primaryKey(),
  agentId: integer("agentId").notNull(),
  userId: integer("userId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  reason: rewardReasonEnum("reason").notNull(),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: integer("referenceId"),
  status: rewardStatusEnum("status").default("pending"),
  settlementBatchId: integer("settlementBatchId"),
  claimedAt: timestamp("claimedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QronRewardEntry = typeof qronRewardLedger.$inferSelect;

// ─── Checkpoint Batches ─────────────────────────────────────────────────────

export const checkpointBatches = pgTable("checkpoint_batches", {
  id: serial("id").primaryKey(),
  batchType: batchTypeEnum("batchType").notNull(),
  rootHash: varchar("rootHash", { length: 128 }).notNull(),
  chainId: integer("chainId").default(137),
  txHash: varchar("txHash", { length: 128 }),
  itemCount: integer("itemCount").default(0),
  status: batchStatusEnum("status").default("pending"),
  finalizedAt: timestamp("finalizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CheckpointBatch = typeof checkpointBatches.$inferSelect;

// ─── Bonuses ────────────────────────────────────────────────────────────────

export const bonuses = pgTable("bonuses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  bonusType: varchar("bonusType", { length: 64 }).notNull(),
  bonusName: varchar("bonusName", { length: 256 }).notNull(),
  bonusValue: integer("bonusValue").notNull(),
  tier: bonusTierEnum("bonusTier").default("starter"),
  status: bonusStatusEnum("bonusStatus").default("pending"),
  deliveryMethod: varchar("deliveryMethod", { length: 64 }),
  claimedAt: timestamp("claimedAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bonus = typeof bonuses.$inferSelect;

// ─── Referral Clicks ────────────────────────────────────────────────────────

export const referralClicks = pgTable("referral_clicks", {
  id: serial("id").primaryKey(),
  referralCode: varchar("referralCode", { length: 32 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  referer: text("referer"),
  landingPage: text("landingPage"),
  convertedAt: timestamp("convertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralClick = typeof referralClicks.$inferSelect;

// ─── AI Models (Marketplace) ────────────────────────────────────────────────

export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  price: integer("price").notNull().default(0),
  status: modelStatusEnum("modelStatus").default("draft"),
  downloads: integer("downloads").default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("reviewCount").default(0),
  creatorId: integer("creatorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AiModel = typeof aiModels.$inferSelect;

// ─── Model Purchases ───────────────────────────────────────────────────────

export const modelPurchases = pgTable("model_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  modelId: integer("modelId").notNull(),
  pricePaid: integer("pricePaid").notNull(),
  purchaseType: purchaseTypeEnum("purchaseType").default("purchase"),
  status: purchaseStatusEnum("purchaseStatus").default("active"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModelPurchase = typeof modelPurchases.$inferSelect;

// ─── Model Reviews ─────────────────────────────────────────────────────────

export const modelReviews = pgTable("model_reviews", {
  id: serial("id").primaryKey(),
  modelId: integer("modelId").notNull(),
  userId: integer("userId").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModelReview = typeof modelReviews.$inferSelect;

// ─── Service Orders ─────────────────────────────────────────────────────────

export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerName: varchar("customerName", { length: 256 }),
  customerCompany: varchar("customerCompany", { length: 256 }),
  customerPhone: varchar("customerPhone", { length: 32 }),
  serviceType: serviceTypeEnum("serviceType").notNull(),
  status: serviceOrderStatusEnum("status").default("pending").notNull(),
  amount: integer("amount").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  businessName: varchar("businessName", { length: 256 }),
  businessType: varchar("businessType", { length: 128 }),
  businessUrl: varchar("businessUrl", { length: 512 }),
  notes: text("notes"),
  deliveryUrl: text("deliveryUrl"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 256 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: varchar("name", { length: 256 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 256 }),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
