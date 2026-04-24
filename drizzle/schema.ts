import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  serial,
  jsonb,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const missions = pgTable("missions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 64 }),
  status: text("status").notNull(), // pending, active, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const missionTasks = pgTable("mission_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  missionId: varchar("mission_id", { length: 36 })
    .notNull()
    .references(() => missions.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  kind: varchar("kind", { length: 64 }),
  payload: jsonb("payload"),
  lastError: text("last_error"),
  status: text("status").notNull(), // pending, in_progress, completed, failed
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  status: text("status").default("active"), // active, recalled, expired, flagged
  // Generated Industrial Assets
  audioUrl: text("audioUrl"),
  visionMarkers: jsonb("visionMarkers"),
  rarityScore: integer("rarityScore"),
  brandVoiceScript: text("brandVoiceScript"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Dead Letter Queue (Reliability) ─────────────────────────────────────────
export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: serial("id").primaryKey(),
  originalJobId: integer("originalJobId"),
  taskType: varchar("taskType", { length: 128 }).notNull(),
  payload: jsonb("payload").notNull(),
  error: text("error"),
  retryCount: integer("retryCount").default(0),
  lastAttemptedAt: timestamp("lastAttemptedAt"),
  status: text("status").default("pending"), // pending, resolved, failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Authentications ─────────────────────────────────────────────────────────
export const authentications = pgTable("authentications", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  userId: integer("userId").notNull(),
  result: text("result").notNull(), // authentic, counterfeit, uncertain
  confidenceScore: integer("confidenceScore").notNull(),
  aiAnalysis: jsonb("aiAnalysis"),
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
  status: text("status").default("active"), // active, revoked, expired
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  nftTokenId: varchar("nft_token_id", { length: 128 }),
  nftContractAddress: varchar("nft_contract_address", { length: 128 }),
  certificateUrl: text("certificate_url"),
  bountyAmount: numeric("bountyAmount", { precision: 18, scale: 2 }).default("0"),
  escrowTxHash: varchar("escrowTxHash", { length: 128 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
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
  floorPrice: numeric("floorPrice", { precision: 18, scale: 8 }).default("0"),
  totalVolume: numeric("totalVolume", { precision: 18, scale: 8 }).default("0"),
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
  price: numeric("price", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 16 }).default("ETH"),
  rarityScore: integer("rarityScore"),
  rarityRank: integer("rarityRank"),
  traits: jsonb("traits"),
  status: text("status").default("listed"), // listed, sold, unlisted, auction
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
  startPrice: numeric("startPrice", { precision: 18, scale: 8 }).notNull(),
  reservePrice: numeric("reservePrice", { precision: 18, scale: 8 }),
  currentBid: numeric("currentBid", { precision: 18, scale: 8 }),
  highestBidderId: integer("highestBidderId"),
  bidCount: integer("bidCount").default(0),
  status: text("status").default("active"), // active, ended, cancelled
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
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  plan: text("plan").notNull(), // starter, professional, enterprise
  status: text("status").default("active"), // active, cancelled, past_due, trialing, paused
  monthlyQuota: integer("monthlyQuota").notNull(),
  usedQuota: integer("usedQuota").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  paddleSubscriptionId: varchar("paddleSubscriptionId", { length: 128 }),
  paddleCustomerId: varchar("paddleCustomerId", { length: 128 }),
  billingCycle: text("billingCycle").default("monthly"), // monthly, annual
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
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  status: text("status").default("draft"), // draft, pending, paid, overdue, cancelled
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 128 }),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate"),
  items: jsonb("items"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;

// ─── Payments ────────────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  method: text("method").notNull(), // stripe, crypto, escrow
  status: text("status").default("pending"), // pending, completed, failed, refunded, escrowed
  stripePaymentId: varchar("stripePaymentId", { length: 128 }),
  cryptoPaymentId: varchar("cryptoPaymentId", { length: 128 }),
  cryptoAddress: varchar("cryptoAddress", { length: 256 }),
  escrowReleaseDate: timestamp("escrowReleaseDate"),
  metadata: jsonb("metadata"),
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
  status: text("status").default("new"), // new, contacted, qualified, proposal, won, lost
  industry: varchar("industry", { length: 128 }),
  notes: text("notes"),
  lastContactedAt: timestamp("lastContactedAt"),
  assignedTo: integer("assignedTo"),
  segment: varchar("segment", { length: 64 }),
  nextActionAt: timestamp("nextActionAt"),
  metadata: jsonb("metadata"),
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
  type: text("type").notNull(), // nurture, onboarding, trial_conversion, announcement, outreach
  status: text("status").default("draft"), // draft, scheduled, sending, sent, paused
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
  status: text("status").default("pending"), // pending, approved, rejected, sent
  generatedBy: varchar("generatedBy", { length: 64 }).default("ai_manager"),
  approvedBy: integer("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  sentAt: timestamp("sentAt"),
  taskId: varchar("taskId", { length: 36 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailDraft = typeof emailDrafts.$inferSelect;

// ─── Supply Chain Events ─────────────────────────────────────────────────────
export const supplyChainEvents = pgTable("supply_chain_events", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  eventType: text("eventType").notNull(), // manufactured, shipped, in_transit, customs, delivered, verified, recalled
  location: varchar("location", { length: 512 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  temperature: numeric("temperature", { precision: 5, scale: 2 }),
  humidity: numeric("humidity", { precision: 5, scale: 2 }),
  handler: varchar("handler", { length: 256 }),
  notes: text("notes"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  iotDeviceId: varchar("iotDeviceId", { length: 128 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplyChainEvent = typeof supplyChainEvents.$inferSelect;

// ─── Referrals ───────────────────────────────────────────────────────────────
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrerId").notNull(),
  referredId: integer("referredId"),
  referralCode: varchar("referralCode", { length: 32 }).notNull().unique(),
  status: text("status").default("pending"), // pending, active, converted, expired
  referredEmail: varchar("referredEmail", { length: 320 }),
  tier: text("tier"), // starter, professional, enterprise, agency
  rewardAmount: numeric("rewardAmount", { precision: 10, scale: 2 }).default("0"),
  commissionPaid: numeric("commissionPaid", { precision: 10, scale: 2 }).default("0"),
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
  commissionRate: numeric("commissionRate", { precision: 5, scale: 2 }).default("10.00"),
  totalEarnings: numeric("totalEarnings", { precision: 18, scale: 2 }).default("0"),
  pendingPayout: numeric("pendingPayout", { precision: 18, scale: 2 }).default("0"),
  totalReferrals: integer("totalReferrals").default(0),
  totalConversions: integer("totalConversions").default(0),
  tier: text("tier").default("basic"), // basic, silver, gold, platinum
  activeReferrals: integer("activeReferrals").default(0),
  paypalEmail: varchar("paypalEmail", { length: 320 }),
  status: text("status").default("pending"), // active, suspended, pending
  payoutMethod: varchar("payoutMethod", { length: 64 }),
  payoutDetails: jsonb("payoutDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Affiliate = typeof affiliates.$inferSelect;

// ─── Affiliate Commissions ───────────────────────────────────────────────────
export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliateId").notNull(),
  paymentId: integer("paymentId"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  status: text("status").default("pending"), // pending, approved, paid, rejected
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Autopilot Config ────────────────────────────────────────────────────────
export const autopilotConfig = pgTable("autopilot_config", {
  id: serial("id").primaryKey(),
  enabled: integer("enabled").default(0),
  mode: text("mode").default("balanced"), // conservative, balanced, aggressive
  guardrails: jsonb("guardrails"),
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
  status: text("status").default("pending"), // pending, executed, overridden, failed
  result: jsonb("result"),
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
  status: text("status").default("draft"), // draft, running, completed, paused
  variants: jsonb("variants"),
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
  status: text("status").default("pending"), // active, suspended, pending
  monthlyApiCalls: integer("monthlyApiCalls").default(0),
  apiCallLimit: integer("apiCallLimit").default(10000),
  features: jsonb("features"),
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
  details: jsonb("details"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Fraud Alerts ────────────────────────────────────────────────────────────
export const fraudAlerts = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  productId: integer("productId"),
  alertType: varchar("alertType", { length: 128 }).notNull(),
  severity: text("severity").default("medium"), // low, medium, high, critical
  description: text("description"),
  status: text("status").default("open"), // open, investigating, resolved, dismissed
  resolvedBy: integer("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FraudAlert = typeof fraudAlerts.$inferSelect;

// ─── Customer Health Scores ──────────────────────────────────────────────────
export const customerHealthScores = pgTable("customer_health_scores", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  score: integer("score").notNull(),
  factors: jsonb("factors"),
  trend: text("trend").default("stable"), // improving, stable, declining
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Revenue Records ─────────────────────────────────────────────────────────
export const revenueRecords = pgTable("revenue_records", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  type: text("type").notNull(), // subscription, one_time, overage, affiliate, marketplace
  userId: integer("userId"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Notifications ──────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: text("type").notNull(), // authentication, certificate, payment, subscription, nft, referral, system, alert, supply_chain, autopilot
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Scheduled Job Runs ─────────────────────────────────────────────────────
export const scheduledJobRuns = pgTable("scheduled_job_runs", {
  id: serial("id").primaryKey(),
  jobName: varchar("jobName", { length: 128 }).notNull(),
  status: text("status").notNull(), // running, completed, failed
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: integer("duration"), // milliseconds
  result: jsonb("result"),
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
  archetype: text("archetype").notNull(), // guardian, archivist, sentinel, scout, arbiter, merchant, explorer
  style: varchar("style", { length: 256 }).default("premium futuristic heraldic concept art"),
  colorway: varchar("colorway", { length: 256 }),
  mood: varchar("mood", { length: 256 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  provider: varchar("provider", { length: 64 }).default("openart"),
  providerModel: varchar("providerModel", { length: 128 }),
  variantCount: integer("variantCount").default(4),
  status: text("status").default("pending"), // pending, generating, completed, selected, mint_ready, failed
  selectedAssetId: integer("selectedAssetId"),
  bestAssetId: integer("bestAssetId"),
  context: jsonb("context"),
  requestPayload: jsonb("requestPayload"),
  responsePayload: jsonb("responsePayload"),
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
  metadata: jsonb("metadata"),
  // 7-dimension scoring (0.0-10.0 scale, matching OpenArt protocol)
  protocolFitScore: numeric("protocolFitScore", { precision: 4, scale: 1 }),
  thumbnailClarityScore: numeric("thumbnailClarityScore", { precision: 4, scale: 1 }),
  premiumFeelScore: numeric("premiumFeelScore", { precision: 4, scale: 1 }),
  silhouetteScore: numeric("silhouetteScore", { precision: 4, scale: 1 }),
  trustSymbolismScore: numeric("trustSymbolismScore", { precision: 4, scale: 1 }),
  mintReadinessScore: numeric("mintReadinessScore", { precision: 4, scale: 1 }),
  uiCompatibilityScore: numeric("uiCompatibilityScore", { precision: 4, scale: 1 }),
  totalScore: numeric("totalScore", { precision: 5, scale: 2 }),
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
  mintStatus: text("mintStatus").default("not_minted"), // not_minted, preparing, queued, minting, minted, failed
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
  agentType: text("agentType").notNull(), // guardian, archivist, sentinel, scout, arbiter, merchant, explorer
  status: text("status").default("active"), // active, inactive, suspended
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  reputationScore: integer("reputationScore").default(100),
  totalVerifications: integer("totalVerifications").default(0),
  successfulVerifications: integer("successfulVerifications").default(0),
  totalClaims: integer("totalClaims").default(0),
  consensusParticipations: integer("consensusParticipations").default(0),
  qronEarned: numeric("qronEarned", { precision: 18, scale: 8 }).default("0"),
  qronPending: numeric("qronPending", { precision: 18, scale: 8 }).default("0"),
  walletAddress: varchar("walletAddress", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  policyConfig: jsonb("policyConfig"),
  featureScopes: jsonb("featureScopes"),
  metadata: jsonb("metadata"),
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
  claimType: text("claimType").notNull(), // authentic, counterfeit, inconclusive, needs_review
  confidence: integer("confidence").notNull(),
  evidence: jsonb("evidence"),
  reasoning: text("reasoning"),
  status: text("status").default("pending"), // pending, accepted, rejected, superseded
  weight: numeric("weight", { precision: 5, scale: 3 }).default("1.000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VerificationClaim = typeof verificationClaims.$inferSelect;

// ─── Consensus Results ──────────────────────────────────────────────────────
export const consensusResults = pgTable("consensus_results", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId"),
  finalStatus: text("finalStatus").notNull(), // authentic, counterfeit, inconclusive
  finalScore: integer("finalScore").notNull(),
  quorumCount: integer("quorumCount").notNull(),
  claimIds: jsonb("claimIds"),
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
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  reason: text("reason").notNull(), // verification_reward, consensus_participation, accuracy_bonus, streak_bonus, referral_reward, staking_yield, penalty
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: integer("referenceId"),
  status: text("status").default("pending"), // pending, settled, claimed, expired
  settlementBatchId: integer("settlementBatchId"),
  claimedAt: timestamp("claimedAt"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QronRewardEntry = typeof qronRewardLedger.$inferSelect;

// ─── Checkpoint Batches ─────────────────────────────────────────────────────
export const checkpointBatches = pgTable("checkpoint_batches", {
  id: serial("id").primaryKey(),
  batchType: text("batchType").notNull(), // verification, reward_settlement, agent_registration
  rootHash: varchar("rootHash", { length: 128 }).notNull(),
  chainId: integer("chainId").default(137),
  txHash: varchar("txHash", { length: 128 }),
  itemCount: integer("itemCount").default(0),
  status: text("status").default("pending"), // pending, submitted, confirmed, failed
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
  tier: text("tier"), // starter, professional, enterprise, agency
  status: text("status").default("pending"), // pending, claimed, delivered
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
  status: text("status").default("draft"), // active, draft, archived
  downloads: integer("downloads").default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
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
  purchaseType: text("purchaseType").default("purchase"), // purchase, subscription, rental
  status: text("status").default("active"), // active, expired, refunded
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
  serviceType: text("serviceType").notNull(), // authenticity_audit, cinematic_page, automation_setup, landing_page, brand_story_pack, government_dossier
  status: text("status").default("pending").notNull(), // pending, paid, in_progress, delivered, cancelled
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
  role: text("role").default("user").notNull(), // user, admin, brand
  stripeCustomerId: varchar("stripe_customer_id", { length: 256 }),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Mission types ──────────────────────────────────────────────────────────
export type MissionTask = typeof missionTasks.$inferSelect;

// ─── Staking Positions ──────────────────────────────────────────────────────
export const stakingPositions = pgTable("staking_positions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  amount: integer("amount").notNull(),
  apy: integer("apy").notNull(),
  status: text("status").default("active"), // active, withdrawn, locked
  rewardsEarned: integer("rewardsEarned").default(0).notNull(),
  lastRewardCalculation: timestamp("lastRewardCalculation").defaultNow().notNull(),
  startDate: timestamp("startDate").defaultNow(),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type StakingPosition = typeof stakingPositions.$inferSelect;
export type InsertStakingPosition = typeof stakingPositions.$inferInsert;

// ─── Platform Fees ──────────────────────────────────────────────────────────
export const platformFees = pgTable("platform_fees", {
  id: serial("id").primaryKey(),
  feeType: varchar("feeType", { length: 64 }).notNull(),
  percentage: integer("percentage").notNull(),
  amount: integer("amount").notNull(),
  transactionId: integer("transactionId"),
  description: varchar("description", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlatformFee = typeof platformFees.$inferSelect;
export type InsertPlatformFee = typeof platformFees.$inferInsert;

// ─── Transactions ───────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: text("type").notNull(), // stake, unstake, reward, fee, transfer
  amount: integer("amount").notNull(),
  status: text("status").default("pending"), // pending, completed, failed
  feeAmount: integer("feeAmount").default(0),
  stakingId: integer("stakingId"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ─── Feedback ───────────────────────────────────────────────────────────────
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: text("type").notNull(), // bug, feature, improvement, general
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: text("status").default("new"), // new, in_progress, completed, rejected
  priority: text("priority").default("medium"), // low, medium, high, critical
  votes: integer("votes").default(0).notNull(),
  adminResponse: text("adminResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// ─── Feedback Votes ─────────────────────────────────────────────────────────
export const feedbackVotes = pgTable("feedback_votes", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedbackId").notNull(),
  userId: integer("userId").notNull(),
  voteType: text("voteType").notNull(), // up, down
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackVote = typeof feedbackVotes.$inferSelect;
export type InsertFeedbackVote = typeof feedbackVotes.$inferInsert;

// ─── Visitor Profiles (Personalization) ─────────────────────────────────────
export const visitorProfiles = pgTable("visitor_profiles", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  country: varchar("country", { length: 64 }),
  city: varchar("city", { length: 128 }),
  region: varchar("region", { length: 128 }),
  trafficSource: varchar("trafficSource", { length: 128 }),
  referrer: text("referrer"),
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  deviceType: varchar("deviceType", { length: 32 }),
  segment: varchar("segment", { length: 64 }),
  pageViews: integer("pageViews").default(0).notNull(),
  timeOnSite: integer("timeOnSite").default(0).notNull(),
  converted: integer("converted").default(0).notNull(),
  lastSeen: timestamp("lastSeen").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Personalization Rules ──────────────────────────────────────────────────
export const personalizationRules = pgTable("personalization_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  targetElement: varchar("targetElement", { length: 128 }).notNull(),
  conditions: jsonb("conditions").notNull(),
  content: text("content").notNull(),
  priority: integer("priority").default(0).notNull(),
  status: text("status").default("draft"), // draft, active, paused
  views: integer("views").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  conversionRate: integer("conversionRate").default(0).notNull(),
  aiGenerated: integer("aiGenerated").default(0).notNull(),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Personalization Events ─────────────────────────────────────────────────
export const personalizationEvents = pgTable("personalization_events", {
  id: serial("id").primaryKey(),
  ruleId: integer("ruleId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── API Usage Daily (Tenant Billing) ────────────────────────────────────────
export const apiUsageDaily = pgTable("api_usage_daily", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // "2026-04-21"
  endpoint: varchar("endpoint", { length: 64 }).notNull(), // verify, qr_generate, etc.
  callCount: integer("callCount").default(0).notNull(),
  tokenUsage: integer("tokenUsage").default(0),
  cost: numeric("cost", { precision: 10, scale: 4 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("tenant_date_endpoint_idx").on(table.tenantId, table.date, table.endpoint),
]);
