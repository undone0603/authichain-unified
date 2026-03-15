import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal, bigint } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  avatarUrl: text("avatarUrl"),
  company: varchar("company", { length: 256 }),
  title: varchar("title", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  onboardingCompleted: int("onboardingCompleted").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  paddleCustomerId: varchar("paddleCustomerId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// MissionTask table
export const MissionTask = pgTable("mission_tasks", {
  id: serial("id").primaryKey(),
  // TODO: add real fields once known
  // example:
  // missionId: integer("mission_id").notNull(),
  // title: text("title").notNull(),
  // status: text("status").default("pending"),
});

// ─── Products ────────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
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
  status: mysqlEnum("status", ["active", "recalled", "expired", "flagged"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Authentications ─────────────────────────────────────────────────────────
export const authentications = mysqlTable("authentications", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  result: mysqlEnum("result", ["authentic", "counterfeit", "uncertain"]).notNull(),
  confidenceScore: int("confidenceScore").notNull(),
  aiAnalysis: json("aiAnalysis"),
  imageUrl: text("imageUrl"),
  isPublic: int("isPublic").default(0),
  shareToken: varchar("shareToken", { length: 128 }),
  shareCount: int("shareCount").default(0),
  verificationMethod: varchar("verificationMethod", { length: 64 }).default("ai_image"),
  blockchainVerified: int("blockchainVerified").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Authentication = typeof authentications.$inferSelect;

// ─── Certificates ────────────────────────────────────────────────────────────
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  authenticationId: int("authenticationId"),
  userId: int("userId").notNull(),
  certificateNumber: varchar("certificateNumber", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;

// ─── QR Codes ────────────────────────────────────────────────────────────────
export const qrCodes = mysqlTable("qr_codes", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  qrData: text("qrData").notNull(),
  qrImageUrl: text("qrImageUrl"),
  scanCount: int("scanCount").default(0),
  lastScannedAt: timestamp("lastScannedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QrCode = typeof qrCodes.$inferSelect;

// ─── NFT Collections ─────────────────────────────────────────────────────────
export const nftCollections = mysqlTable("nft_collections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  bannerUrl: text("bannerUrl"),
  category: varchar("category", { length: 128 }),
  floorPrice: decimal("floorPrice", { precision: 18, scale: 8 }).default("0"),
  totalVolume: decimal("totalVolume", { precision: 18, scale: 8 }).default("0"),
  itemCount: int("itemCount").default(0),
  ownerCount: int("ownerCount").default(0),
  verified: int("verified").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NftCollection = typeof nftCollections.$inferSelect;

// ─── NFTs ────────────────────────────────────────────────────────────────────
export const nfts = mysqlTable("nfts", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collectionId"),
  ownerId: int("ownerId").notNull(),
  creatorId: int("creatorId").notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  ipfsHash: varchar("ipfsHash", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  contractAddress: varchar("contractAddress", { length: 128 }),
  blockchain: varchar("blockchain", { length: 64 }).default("polygon"),
  price: decimal("price", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 16 }).default("ETH"),
  rarityScore: int("rarityScore"),
  rarityRank: int("rarityRank"),
  traits: json("traits"),
  status: mysqlEnum("status", ["listed", "sold", "unlisted", "auction"]).default("listed"),
  viewCount: int("viewCount").default(0),
  likeCount: int("likeCount").default(0),
  productId: int("productId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Nft = typeof nfts.$inferSelect;

// ─── Auctions ────────────────────────────────────────────────────────────────
export const auctions = mysqlTable("auctions", {
  id: int("id").autoincrement().primaryKey(),
  nftId: int("nftId").notNull(),
  sellerId: int("sellerId").notNull(),
  startPrice: decimal("startPrice", { precision: 18, scale: 8 }).notNull(),
  reservePrice: decimal("reservePrice", { precision: 18, scale: 8 }),
  currentBid: decimal("currentBid", { precision: 18, scale: 8 }),
  highestBidderId: int("highestBidderId"),
  bidCount: int("bidCount").default(0),
  status: mysqlEnum("status", ["active", "ended", "cancelled"]).default("active"),
  startsAt: timestamp("startsAt").defaultNow().notNull(),
  endsAt: timestamp("endsAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Auction = typeof auctions.$inferSelect;

// ─── Auction Bids ────────────────────────────────────────────────────────────
export const auctionBids = mysqlTable("auction_bids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  bidderId: int("bidderId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  plan: mysqlEnum("plan", ["starter", "professional", "enterprise"]).notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "past_due", "trialing", "paused"]).default("active"),
  monthlyQuota: int("monthlyQuota").notNull(),
  usedQuota: int("usedQuota").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  paddleSubscriptionId: varchar("paddleSubscriptionId", { length: 128 }),
  paddleCustomerId: varchar("paddleCustomerId", { length: 128 }),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "annual"]).default("monthly"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  trialEndsAt: timestamp("trialEndsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Usage Records ───────────────────────────────────────────────────────────
export const usageRecords = mysqlTable("usage_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  type: varchar("type", { length: 64 }).notNull(),
  quantity: int("quantity").default(1),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  status: mysqlEnum("status", ["draft", "pending", "paid", "overdue", "cancelled"]).default("draft"),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 128 }),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate"),
  items: json("items"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;

// ─── Payments ────────────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  method: mysqlEnum("method", ["stripe", "crypto", "escrow"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded", "escrowed"]).default("pending"),
  stripePaymentId: varchar("stripePaymentId", { length: 128 }),
  cryptoPaymentId: varchar("cryptoPaymentId", { length: 128 }),
  cryptoAddress: varchar("cryptoAddress", { length: 256 }),
  escrowReleaseDate: timestamp("escrowReleaseDate"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;

// ─── Leads ───────────────────────────────────────────────────────────────────
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 256 }),
  company: varchar("company", { length: 256 }),
  title: varchar("title", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  source: varchar("source", { length: 128 }),
  score: int("score").default(0),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "proposal", "won", "lost"]).default("new"),
  industry: varchar("industry", { length: 128 }),
  notes: text("notes"),
  lastContactedAt: timestamp("lastContactedAt"),
  assignedTo: int("assignedTo"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;

// ─── Email Campaigns ─────────────────────────────────────────────────────────
export const emailCampaigns = mysqlTable("email_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  type: mysqlEnum("type", ["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]).notNull(),
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "paused"]).default("draft"),
  recipientCount: int("recipientCount").default(0),
  sentCount: int("sentCount").default(0),
  openCount: int("openCount").default(0),
  clickCount: int("clickCount").default(0),
  bounceCount: int("bounceCount").default(0),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;

// ─── Email Drafts (Approval Workflow) ────────────────────────────────────────
export const emailDrafts = mysqlTable("email_drafts", {
  id: int("id").autoincrement().primaryKey(),
  prospectName: varchar("prospectName", { length: 256 }),
  prospectEmail: varchar("prospectEmail", { length: 320 }).notNull(),
  prospectCompany: varchar("prospectCompany", { length: 256 }),
  prospectTitle: varchar("prospectTitle", { length: 256 }),
  industry: varchar("industry", { length: 128 }),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  templateUsed: varchar("templateUsed", { length: 128 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "sent"]).default("pending"),
  generatedBy: varchar("generatedBy", { length: 64 }).default("ai_manager"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  sentAt: timestamp("sentAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailDraft = typeof emailDrafts.$inferSelect;

// ─── Supply Chain Events ─────────────────────────────────────────────────────
export const supplyChainEvents = mysqlTable("supply_chain_events", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  eventType: mysqlEnum("eventType", ["manufactured", "shipped", "in_transit", "customs", "delivered", "verified", "recalled"]).notNull(),
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
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(),
  referredId: int("referredId"),
  referralCode: varchar("referralCode", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "active", "converted", "expired"]).default("pending"),
  referredEmail: varchar("referredEmail", { length: 320 }),
  tier: mysqlEnum("tier", ["starter", "professional", "enterprise", "agency"]),
  rewardAmount: decimal("rewardAmount", { precision: 10, scale: 2 }).default("0"),
  commissionPaid: decimal("commissionPaid", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: int("rewardPaid").default(0),
  convertedAt: timestamp("convertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;

// ─── Affiliates ──────────────────────────────────────────────────────────────
export const affiliates = mysqlTable("affiliates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  affiliateCode: varchar("affiliateCode", { length: 32 }).notNull().unique(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).default("10.00"),
  totalEarnings: decimal("totalEarnings", { precision: 18, scale: 2 }).default("0"),
  pendingPayout: decimal("pendingPayout", { precision: 18, scale: 2 }).default("0"),
  totalReferrals: int("totalReferrals").default(0),
  totalConversions: int("totalConversions").default(0),
  tier: mysqlEnum("affiliateTier", ["basic", "silver", "gold", "platinum"]).default("basic"),
  activeReferrals: int("activeReferrals").default(0),
  paypalEmail: varchar("paypalEmail", { length: 320 }),
  status: mysqlEnum("status", ["active", "suspended", "pending"]).default("pending"),
  payoutMethod: varchar("payoutMethod", { length: 64 }),
  payoutDetails: json("payoutDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Affiliate = typeof affiliates.$inferSelect;

// ─── Affiliate Commissions ───────────────────────────────────────────────────
export const affiliateCommissions = mysqlTable("affiliate_commissions", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliateId").notNull(),
  paymentId: int("paymentId"),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "paid", "rejected"]).default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Autopilot Config ────────────────────────────────────────────────────────
export const autopilotConfig = mysqlTable("autopilot_config", {
  id: int("id").autoincrement().primaryKey(),
  enabled: int("enabled").default(0),
  mode: mysqlEnum("mode", ["conservative", "balanced", "aggressive"]).default("balanced"),
  guardrails: json("guardrails"),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AutopilotConfig = typeof autopilotConfig.$inferSelect;

// ─── Autopilot Decisions ─────────────────────────────────────────────────────
export const autopilotDecisions = mysqlTable("autopilot_decisions", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  action: varchar("action", { length: 256 }).notNull(),
  reasoning: text("reasoning"),
  confidence: int("confidence"),
  status: mysqlEnum("status", ["pending", "executed", "overridden", "failed"]).default("pending"),
  result: json("result"),
  overriddenBy: int("overriddenBy"),
  overrideReason: text("overrideReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AutopilotDecision = typeof autopilotDecisions.$inferSelect;

// ─── A/B Tests ───────────────────────────────────────────────────────────────
export const abTests = mysqlTable("ab_tests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["draft", "running", "completed", "paused"]).default("draft"),
  variants: json("variants"),
  winnerVariant: varchar("winnerVariant", { length: 64 }),
  totalParticipants: int("totalParticipants").default(0),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AbTest = typeof abTests.$inferSelect;

// ─── White Label Clients ─────────────────────────────────────────────────────
export const whiteLabelClients = mysqlTable("white_label_clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyName: varchar("companyName", { length: 256 }).notNull(),
  domain: varchar("domain", { length: 256 }),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 16 }),
  secondaryColor: varchar("secondaryColor", { length: 16 }),
  apiKey: varchar("apiKey", { length: 128 }).notNull().unique(),
  apiSecret: varchar("apiSecret", { length: 256 }),
  status: mysqlEnum("status", ["active", "suspended", "pending"]).default("pending"),
  monthlyApiCalls: int("monthlyApiCalls").default(0),
  apiCallLimit: int("apiCallLimit").default(10000),
  features: json("features"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhiteLabelClient = typeof whiteLabelClients.$inferSelect;

// ─── Activity Log ────────────────────────────────────────────────────────────
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Fraud Alerts ────────────────────────────────────────────────────────────
export const fraudAlerts = mysqlTable("fraud_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  productId: int("productId"),
  alertType: varchar("alertType", { length: 128 }).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  description: text("description"),
  status: mysqlEnum("status", ["open", "investigating", "resolved", "dismissed"]).default("open"),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FraudAlert = typeof fraudAlerts.$inferSelect;

// ─── Customer Health Scores ──────────────────────────────────────────────────
export const customerHealthScores = mysqlTable("customer_health_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  score: int("score").notNull(),
  factors: json("factors"),
  trend: mysqlEnum("trend", ["improving", "stable", "declining"]).default("stable"),
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Revenue Records ─────────────────────────────────────────────────────────
export const revenueRecords = mysqlTable("revenue_records", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  type: mysqlEnum("type", ["subscription", "one_time", "overage", "affiliate", "marketplace"]).notNull(),
  userId: int("userId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Notifications ──────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "authentication", "certificate", "payment", "subscription",
    "nft", "referral", "system", "alert", "supply_chain", "autopilot"
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  isRead: int("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Scheduled Job Runs ─────────────────────────────────────────────────────
export const scheduledJobRuns = mysqlTable("scheduled_job_runs", {
  id: int("id").autoincrement().primaryKey(),
  jobName: varchar("jobName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: int("duration"), // milliseconds
  result: json("result"),
  error: text("error"),
  itemsProcessed: int("itemsProcessed").default(0),
});

export type ScheduledJobRun = typeof scheduledJobRuns.$inferSelect;
export type InsertScheduledJobRun = typeof scheduledJobRuns.$inferInsert;

// ─── Character Generations ──────────────────────────────────────────────────
export const characterGenerations = mysqlTable("character_generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tenantId: varchar("tenantId", { length: 128 }),
  objectId: varchar("objectId", { length: 128 }),
  archetype: mysqlEnum("archetype", ["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]).notNull(),
  style: varchar("style", { length: 256 }).default("premium futuristic heraldic concept art"),
  colorway: varchar("colorway", { length: 256 }),
  mood: varchar("mood", { length: 256 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  provider: varchar("provider", { length: 64 }).default("openart"),
  providerModel: varchar("providerModel", { length: 128 }),
  variantCount: int("variantCount").default(4),
  status: mysqlEnum("status", ["pending", "generating", "completed", "selected", "mint_ready", "failed"]).default("pending"),
  selectedAssetId: int("selectedAssetId"),
  bestAssetId: int("bestAssetId"),
  context: json("context"),
  requestPayload: json("requestPayload"),
  responsePayload: json("responsePayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type CharacterGeneration = typeof characterGenerations.$inferSelect;
export type InsertCharacterGeneration = typeof characterGenerations.$inferInsert;

// ─── Character Assets ───────────────────────────────────────────────────────
export const characterAssets = mysqlTable("character_assets", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  tenantId: varchar("tenantId", { length: 128 }),
  userId: int("userId"),
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
  scoreIconity: int("scoreIconity"),
  scoreTrustClarity: int("scoreTrustClarity"),
  scorePremiumFeel: int("scorePremiumFeel"),
  scoreSilhouette: int("scoreSilhouette"),
  scoreUiCompat: int("scoreUiCompat"),
  scoreMintReady: int("scoreMintReady"),
  scoreProtocolAlign: int("scoreProtocolAlign"),
  isRecommended: int("isRecommended").default(0),
  isSelected: int("isSelected").default(0),
  selectedAt: timestamp("selectedAt"),
  // Mint fields
  metadataUri: text("metadataUri"),
  metadataHash: varchar("metadataHash", { length: 128 }),
  imageHash: varchar("imageHash", { length: 128 }),
  mintStatus: mysqlEnum("mintStatus", ["not_minted", "preparing", "queued", "minting", "minted", "failed"]).default("not_minted"),
  mintTxHash: varchar("mintTxHash", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  mintedAt: timestamp("mintedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CharacterAsset = typeof characterAssets.$inferSelect;
export type InsertCharacterAsset = typeof characterAssets.$inferInsert;

// ─── Protocol Agents ────────────────────────────────────────────────────────
export const protocolAgents = mysqlTable("protocol_agents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  characterAssetId: int("characterAssetId"),
  name: varchar("name", { length: 256 }).notNull(),
  agentType: mysqlEnum("agentType", ["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active"),
  level: int("level").default(1),
  xp: int("xp").default(0),
  reputationScore: int("reputationScore").default(100),
  totalVerifications: int("totalVerifications").default(0),
  successfulVerifications: int("successfulVerifications").default(0),
  totalClaims: int("totalClaims").default(0),
  consensusParticipations: int("consensusParticipations").default(0),
  qronEarned: decimal("qronEarned", { precision: 18, scale: 8 }).default("0"),
  qronPending: decimal("qronPending", { precision: 18, scale: 8 }).default("0"),
  walletAddress: varchar("walletAddress", { length: 128 }),
  tokenId: varchar("tokenId", { length: 128 }),
  policyConfig: json("policyConfig"),
  featureScopes: json("featureScopes"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProtocolAgent = typeof protocolAgents.$inferSelect;
export type InsertProtocolAgent = typeof protocolAgents.$inferInsert;

// ─── Verification Claims ────────────────────────────────────────────────────
export const verificationClaims = mysqlTable("verification_claims", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  productId: int("productId").notNull(),
  authenticationId: int("authenticationId"),
  claimType: mysqlEnum("claimType", ["authentic", "counterfeit", "inconclusive", "needs_review"]).notNull(),
  confidence: int("confidence").notNull(),
  evidence: json("evidence"),
  reasoning: text("reasoning"),
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "superseded"]).default("pending"),
  weight: decimal("weight", { precision: 5, scale: 3 }).default("1.000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VerificationClaim = typeof verificationClaims.$inferSelect;

// ─── Consensus Results ──────────────────────────────────────────────────────
export const consensusResults = mysqlTable("consensus_results", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  authenticationId: int("authenticationId"),
  finalStatus: mysqlEnum("finalStatus", ["authentic", "counterfeit", "inconclusive"]).notNull(),
  finalScore: int("finalScore").notNull(),
  quorumCount: int("quorumCount").notNull(),
  claimIds: json("claimIds"),
  settledOnChain: int("settledOnChain").default(0),
  checkpointBatchId: int("checkpointBatchId"),
  txHash: varchar("txHash", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsensusResult = typeof consensusResults.$inferSelect;

// ─── QRON Reward Ledger ─────────────────────────────────────────────────────
export const qronRewardLedger = mysqlTable("qron_reward_ledger", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  reason: mysqlEnum("reason", [
    "verification_reward", "consensus_participation", "accuracy_bonus",
    "streak_bonus", "referral_reward", "staking_yield", "penalty"
  ]).notNull(),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  status: mysqlEnum("status", ["pending", "settled", "claimed", "expired"]).default("pending"),
  settlementBatchId: int("settlementBatchId"),
  claimedAt: timestamp("claimedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QronRewardEntry = typeof qronRewardLedger.$inferSelect;

// ─── Checkpoint Batches ─────────────────────────────────────────────────────
export const checkpointBatches = mysqlTable("checkpoint_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchType: mysqlEnum("batchType", ["verification", "reward_settlement", "agent_registration"]).notNull(),
  rootHash: varchar("rootHash", { length: 128 }).notNull(),
  chainId: int("chainId").default(137),
  txHash: varchar("txHash", { length: 128 }),
  itemCount: int("itemCount").default(0),
  status: mysqlEnum("status", ["pending", "submitted", "confirmed", "failed"]).default("pending"),
  finalizedAt: timestamp("finalizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CheckpointBatch = typeof checkpointBatches.$inferSelect;

// ─── Bonuses ────────────────────────────────────────────────────────────────
export const bonuses = mysqlTable("bonuses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bonusType: varchar("bonusType", { length: 64 }).notNull(),
  bonusName: varchar("bonusName", { length: 256 }).notNull(),
  bonusValue: int("bonusValue").notNull(),
  tier: mysqlEnum("bonusTier", ["starter", "professional", "enterprise", "agency"]),
  status: mysqlEnum("bonusStatus", ["pending", "claimed", "delivered"]).default("pending"),
  deliveryMethod: varchar("deliveryMethod", { length: 64 }),
  claimedAt: timestamp("claimedAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bonus = typeof bonuses.$inferSelect;

// ─── Referral Clicks ────────────────────────────────────────────────────────
export const referralClicks = mysqlTable("referral_clicks", {
  id: int("id").autoincrement().primaryKey(),
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
export const aiModels = mysqlTable("ai_models", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  price: int("price").notNull().default(0),
  status: mysqlEnum("modelStatus", ["active", "draft", "archived"]).default("draft"),
  downloads: int("downloads").default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: int("reviewCount").default(0),
  creatorId: int("creatorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiModel = typeof aiModels.$inferSelect;

// ─── Model Purchases ───────────────────────────────────────────────────────
export const modelPurchases = mysqlTable("model_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId").notNull(),
  pricePaid: int("pricePaid").notNull(),
  purchaseType: mysqlEnum("purchaseType", ["purchase", "subscription", "rental"]).default("purchase"),
  status: mysqlEnum("purchaseStatus", ["active", "expired", "refunded"]).default("active"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModelPurchase = typeof modelPurchases.$inferSelect;

// ─── Model Reviews ─────────────────────────────────────────────────────────
export const modelReviews = mysqlTable("model_reviews", {
  id: int("id").autoincrement().primaryKey(),
  modelId: int("modelId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModelReview = typeof modelReviews.$inferSelect;


// ─── Service Orders ─────────────────────────────────────────────────────────
export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerName: varchar("customerName", { length: 256 }),
  customerCompany: varchar("customerCompany", { length: 256 }),
  customerPhone: varchar("customerPhone", { length: 32 }),
  serviceType: mysqlEnum("serviceType", [
    "authenticity_audit",
    "cinematic_page",
    "automation_setup",
    "landing_page",
    "brand_story_pack",
    "government_dossier",
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "in_progress", "delivered", "cancelled"]).default("pending").notNull(),
  amount: int("amount").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  businessName: varchar("businessName", { length: 256 }),
  businessType: varchar("businessType", { length: 128 }),
  businessUrl: varchar("businessUrl", { length: 512 }),
  notes: text("notes"),
  deliveryUrl: text("deliveryUrl"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;
