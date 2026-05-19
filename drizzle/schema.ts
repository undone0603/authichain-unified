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
  nftTokenId: varchar("nftTokenId", { length: 256 }),
  nftContractAddress: varchar("nftContractAddress", { length: 64 }),
  certificateUrl: text("certificateUrl"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
  leadScore: int("leadScore").default(0),
  emailOpened: boolean("emailOpened").default(false),
  emailClicked: boolean("emailClicked").default(false),
  emailReplied: boolean("emailReplied").default(false),
  roiCalculated: boolean("roiCalculated").default(false),
  demoStarted: boolean("demoStarted").default(false),
  interactionsCount: int("interactionsCount").default(0),
  isVip: boolean("isVip").default(false),
  contractSent: boolean("contractSent").default(false),
  contractOpened: boolean("contractOpened").default(false),
  contractSigned: boolean("contractSigned").default(false),
  roiSavings: int("roiSavings"),
  numProducts: int("numProducts"),
  dealStage: varchar("dealStage", { length: 64 }),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "proposal", "won", "lost", "HOT", "WARM", "COLD"]).default("new"),
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
  rewardAmount: decimal("rewardAmount", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: int("rewardPaid").default(0),
  referredEmail: varchar("referredEmail", { length: 320 }),
  tier: mysqlEnum("tier", ["starter", "professional", "enterprise", "agency"]),
  commissionPaid: decimal("commissionPaid", { precision: 10, scale: 2 }).default("0"),
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
  status: mysqlEnum("status", ["active", "suspended", "pending"]).default("pending"),
  tier: mysqlEnum("affiliateTier", ["basic", "silver", "gold", "platinum"]).default("basic"),
  activeReferrals: int("activeReferrals").default(0),
  paypalEmail: varchar("paypalEmail", { length: 320 }),
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

// ─── API Usage (Daily) ───────────────────────────────────────────────────────
export const apiUsageDaily = mysqlTable("api_usage_daily", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  date: timestamp("date").notNull(),
  calls: int("calls").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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

// ─── Bonuses ─────────────────────────────────────────────────────────────────
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

// ─── Referral Clicks ─────────────────────────────────────────────────────────
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

// ─── AI Models (Marketplace) ─────────────────────────────────────────────────
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

// ─── Model Purchases ─────────────────────────────────────────────────────────
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

// ─── Model Reviews ────────────────────────────────────────────────────────────
export const modelReviews = mysqlTable("model_reviews", {
  id: int("id").autoincrement().primaryKey(),
  modelId: int("modelId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Prompt Cache ────────────────────────────────────────────────────────────
export const promptCache = mysqlTable("prompt_cache", {
  id: int("id").autoincrement().primaryKey(),
  promptHash: varchar("promptHash", { length: 128 }).notNull().unique(),
  response: text("response").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 64 }),
  usage: json("usage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Scheduled Job Runs ──────────────────────────────────────────────────────
export const scheduledJobRuns = mysqlTable("scheduled_job_runs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  jobName: varchar("jobName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  itemsProcessed: int("itemsProcessed").default(0),
  result: json("result"),
  error: text("error"),
});

// ─── Budget Config ───────────────────────────────────────────────────────────
export const budgetConfig = mysqlTable("budget_config", {
  id: int("id").autoincrement().primaryKey(),
  monthlyLimit: decimal("monthlyLimit", { precision: 18, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 18, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 16 }).default("USD"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Service Orders ──────────────────────────────────────────────────────────
export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceType: varchar("serviceType", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  priority: int("priority").default(0),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Character Generations ───────────────────────────────────────────────────
export const characterGenerations = mysqlTable("character_generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  archetype: varchar("archetype", { length: 32 }).notNull(),
  style: varchar("style", { length: 128 }),
  colorway: varchar("colorway", { length: 64 }),
  mood: varchar("mood", { length: 64 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  provider: varchar("provider", { length: 64 }),
  providerModel: varchar("providerModel", { length: 64 }),
  variantCount: int("variantCount").default(1),
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed", "selected", "mint_ready"]).default("pending"),
  context: text("context"),
  bestAssetId: int("bestAssetId"),
  selectedAssetId: int("selectedAssetId"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Character Assets ────────────────────────────────────────────────────────
export const characterAssets = mysqlTable("character_assets", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  userId: int("userId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  prompt: text("prompt"),
  isRecommended: int("isRecommended").default(0),
  isSelected: int("isSelected").default(0),
  mintStatus: mysqlEnum("mintStatus", ["not_minted", "preparing", "queued", "minting", "minted", "failed"]).default("not_minted"),
  nftTokenId: varchar("nftTokenId", { length: 64 }),
  metadataUri: text("metadataUri"),
  metadataHash: varchar("metadataHash", { length: 128 }),
  imageHash: varchar("imageHash", { length: 128 }),
  protocolFitScore: varchar("protocolFitScore", { length: 8 }),
  thumbnailClarityScore: varchar("thumbnailClarityScore", { length: 8 }),
  premiumFeelScore: varchar("premiumFeelScore", { length: 8 }),
  silhouetteScore: varchar("silhouetteScore", { length: 8 }),
  trustSymbolismScore: varchar("trustSymbolismScore", { length: 8 }),
  mintReadinessScore: varchar("mintReadinessScore", { length: 8 }),
  uiCompatibilityScore: varchar("uiCompatibilityScore", { length: 8 }),
  totalScore: varchar("totalScore", { length: 8 }),
  scoreIconity: int("scoreIconity"),
  scoreTrustClarity: int("scoreTrustClarity"),
  scorePremiumFeel: int("scorePremiumFeel"),
  scoreSilhouette: int("scoreSilhouette"),
  scoreUiCompat: int("scoreUiCompat"),
  scoreMintReady: int("scoreMintReady"),
  scoreProtocolAlign: int("scoreProtocolAlign"),
  selectedAt: timestamp("selectedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Protocol Agents ─────────────────────────────────────────────────────────
export const protocolAgents = mysqlTable("protocol_agents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  characterAssetId: int("characterAssetId").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  agentType: varchar("agentType", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "retired"]).default("active"),
  level: int("level").default(1),
  xp: int("xp").default(0),
  reputationScore: int("reputationScore").default(0),
  qronPending: decimal("qronPending", { precision: 20, scale: 9 }).default("0.000000000"),
  totalVerifications: int("totalVerifications").default(0),
  successfulVerifications: int("successfulVerifications").default(0),
  totalClaims: int("totalClaims").default(0),
  featureScopes: json("featureScopes"),
  policyConfig: json("policyConfig"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Verification Claims ─────────────────────────────────────────────────────
export const verificationClaims = mysqlTable("verification_claims", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  productId: int("productId").notNull(),
  authenticationId: int("authenticationId"),
  claimType: mysqlEnum("claimType", ["authentic", "counterfeit", "inconclusive", "needs_review"]).notNull(),
  confidence: int("confidence").notNull(),
  evidence: text("evidence"),
  reasoning: text("reasoning"),
  weight: varchar("weight", { length: 16 }),
  status: mysqlEnum("status", ["pending", "verified", "rejected"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Consensus Results ───────────────────────────────────────────────────────
export const consensusResults = mysqlTable("consensus_results", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  authenticationId: int("authenticationId").notNull(),
  verdict: mysqlEnum("verdict", ["authentic", "counterfeit", "uncertain"]).notNull(),
  confidence: int("confidence").notNull(),
  participantCount: int("participantCount").default(0),
  finalizedAt: timestamp("finalizedAt").defaultNow().notNull(),
});

// ─── QRON Reward Ledger ──────────────────────────────────────────────────────
export const qronRewardLedger = mysqlTable("qron_reward_ledger", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 20, scale: 9 }).notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  referenceType: varchar("referenceType", { length: 32 }),
  referenceId: int("referenceId"),
  status: mysqlEnum("status", ["pending", "claimed", "void"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Staking Positions ───────────────────────────────────────────────────────
export const stakingPositions = mysqlTable("staking_positions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentId: int("agentId"),
  amount: decimal("amount", { precision: 20, scale: 9 }).notNull(),
  status: mysqlEnum("status", ["active", "unstaking", "released"]).default("active"),
  multiplier: decimal("multiplier", { precision: 5, scale: 2 }).default("1.00"),
  apy: decimal("apy", { precision: 5, scale: 2 }).default("5.00"),
  stakedAt: timestamp("stakedAt").defaultNow().notNull(),
  releaseAt: timestamp("releaseAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Checkpoint Batches ──────────────────────────────────────────────────────
export const checkpointBatches = mysqlTable("checkpoint_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchHash: varchar("batchHash", { length: 128 }).notNull(),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  claimCount: int("claimCount").default(0),
  status: mysqlEnum("status", ["pending", "anchoring", "anchored", "failed"]).default("pending"),
  finalizedAt: timestamp("finalizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Missions ────────────────────────────────────────────────────────────────
export const missions = mysqlTable("missions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "active", "completed", "failed", "cancelled"]).default("pending").notNull(),
  priority: int("priority").default(0).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Mission Tasks ───────────────────────────────────────────────────────────
export const missionTasks = mysqlTable("mission_tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  missionId: varchar("missionId", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed", "waiting_human"]).default("pending").notNull(),
  priority: int("priority").default(0).notNull(),
  order: int("order").default(0).notNull(),
  payload: json("payload"),
  result: json("result"),
  error: text("error"),
  scheduledAt: timestamp("scheduledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Platform Fees ───────────────────────────────────────────────────────────
export const platformFees = mysqlTable("platform_fees", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  status: mysqlEnum("status", ["pending", "collected", "distributed"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Bayesian Priors ─────────────────────────────────────────────────────────
export const bayesianPriors = mysqlTable("bayesian_priors", {
  id: int("id").autoincrement().primaryKey(),
  segment: varchar("segment", { length: 64 }).notNull().unique(),
  priorAlpha: decimal("priorAlpha", { precision: 10, scale: 4 }).default("2.0000"), // Successes
  priorBeta: decimal("priorBeta", { precision: 10, scale: 4 }).default("18.0000"), // Failures (Base 10% rate)
  currentMean: decimal("currentMean", { precision: 5, scale: 4 }).default("0.1000"),
  observationsCount: int("observationsCount").default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BayesianPrior = typeof bayesianPriors.$inferSelect;
export type InsertBayesianPrior = typeof bayesianPriors.$inferInsert;

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
