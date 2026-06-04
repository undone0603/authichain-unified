import { serial, integer, pgTable, text, timestamp, varchar, boolean, json, numeric, bigint } from "drizzle-orm/pg-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  avatarUrl: text("avatarUrl"),
  company: varchar("company", { length: 256 }),
  title: varchar("title", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  onboardingCompleted: integer("onboardingCompleted").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  paddleCustomerId: varchar("paddleCustomerId", { length: 128 }),
  points: integer("points").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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
  status: varchar("status", { length: 50 }).default("active"),
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
  result: varchar("result", { length: 50 }).notNull(),
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
  status: varchar("status", { length: 50 }).default("active"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  nftTokenId: varchar("nftTokenId", { length: 256 }),
  nftContractAddress: varchar("nftContractAddress", { length: 64 }),
  certificateUrl: text("certificateUrl"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
  traits: json("traits"),
  status: varchar("status", { length: 50 }).default("listed"),
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
  status: varchar("status", { length: 50 }).default("active"),
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
  plan: varchar("plan", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  monthlyQuota: integer("monthlyQuota").notNull(),
  usedQuota: integer("usedQuota").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  paddleSubscriptionId: varchar("paddleSubscriptionId", { length: 128 }),
  paddleCustomerId: varchar("paddleCustomerId", { length: 128 }),
  billingCycle: varchar("billingCycle", { length: 50 }).default("monthly"),
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
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  status: varchar("status", { length: 50 }).default("draft"),
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
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USD"),
  method: varchar("method", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
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
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("draft"),
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
  status: varchar("status", { length: 50 }).default("pending"),
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
  eventType: varchar("eventType", { length: 50 }).notNull(),
  location: varchar("location", { length: 512 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  temperature: numeric("temperature", { precision: 5, scale: 2 }),
  humidity: numeric("humidity", { precision: 5, scale: 2 }),
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
  status: varchar("status", { length: 50 }).default("pending"),
  rewardAmount: numeric("rewardAmount", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: integer("rewardPaid").default(0),
  referredEmail: varchar("referredEmail", { length: 320 }),
  tier: varchar("tier", { length: 50 }),
  commissionPaid: numeric("commissionPaid", { precision: 10, scale: 2 }).default("0"),
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
  status: varchar("status", { length: 50 }).default("pending"),
  tier: varchar("affiliateTier", { length: 50 }).default("basic"),
  activeReferrals: integer("activeReferrals").default(0),
  paypalEmail: varchar("paypalEmail", { length: 320 }),
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
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Autopilot Config ────────────────────────────────────────────────────────
export const autopilotConfig = pgTable("autopilot_config", {
  id: serial("id").primaryKey(),
  enabled: integer("enabled").default(0),
  mode: varchar("mode", { length: 50 }).default("balanced"),
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
  status: varchar("status", { length: 50 }).default("pending"),
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
  status: varchar("status", { length: 50 }).default("draft"),
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
  status: varchar("status", { length: 50 }).default("pending"),
  monthlyApiCalls: integer("monthlyApiCalls").default(0),
  apiCallLimit: integer("apiCallLimit").default(10000),
  features: json("features"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WhiteLabelClient = typeof whiteLabelClients.$inferSelect;

// ─── API Usage (Daily) ───────────────────────────────────────────────────────
export const apiUsageDaily = pgTable("api_usage_daily", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  date: timestamp("date").notNull(),
  calls: integer("calls").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
  severity: varchar("severity", { length: 50 }).default("medium"),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"),
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
  trend: varchar("trend", { length: 50 }).default("stable"),
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Revenue Records ─────────────────────────────────────────────────────────
export const revenueRecords = pgTable("revenue_records", {
  id: serial("id").primaryKey(),
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
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Bonuses ─────────────────────────────────────────────────────────────────
export const bonuses = pgTable("bonuses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  bonusType: varchar("bonusType", { length: 64 }).notNull(),
  bonusName: varchar("bonusName", { length: 256 }).notNull(),
  bonusValue: integer("bonusValue").notNull(),
  tier: varchar("bonusTier", { length: 50 }),
  status: varchar("bonusStatus", { length: 50 }).default("pending"),
  deliveryMethod: varchar("deliveryMethod", { length: 64 }),
  claimedAt: timestamp("claimedAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bonus = typeof bonuses.$inferSelect;

// ─── Referral Clicks ─────────────────────────────────────────────────────────
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

// ─── AI Models (Marketplace) ─────────────────────────────────────────────────
export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  price: integer("price").notNull().default(0),
  status: varchar("modelStatus", { length: 50 }).default("draft"),
  downloads: integer("downloads").default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("reviewCount").default(0),
  creatorId: integer("creatorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AiModel = typeof aiModels.$inferSelect;

// ─── Model Purchases ─────────────────────────────────────────────────────────
export const modelPurchases = pgTable("model_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  modelId: integer("modelId").notNull(),
  pricePaid: integer("pricePaid").notNull(),
  purchaseType: varchar("purchaseType", { length: 50 }).default("purchase"),
  status: varchar("purchaseStatus", { length: 50 }).default("active"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModelPurchase = typeof modelPurchases.$inferSelect;

// ─── Model Reviews ────────────────────────────────────────────────────────────
export const modelReviews = pgTable("model_reviews", {
  id: serial("id").primaryKey(),
  modelId: integer("modelId").notNull(),
  userId: integer("userId").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Prompt Cache ────────────────────────────────────────────────────────────
export const promptCache = pgTable("prompt_cache", {
  id: serial("id").primaryKey(),
  promptHash: varchar("promptHash", { length: 128 }).notNull().unique(),
  response: text("response").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 64 }),
  usage: json("usage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Scheduled Job Runs ──────────────────────────────────────────────────────
export const scheduledJobRuns = pgTable("scheduled_job_runs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  jobName: varchar("jobName", { length: 128 }).notNull(),
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
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Character Generations ───────────────────────────────────────────────────
export const characterGenerations = pgTable("character_generations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  archetype: varchar("archetype", { length: 32 }).notNull(),
  style: varchar("style", { length: 128 }),
  colorway: varchar("colorway", { length: 64 }),
  mood: varchar("mood", { length: 64 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  provider: varchar("provider", { length: 64 }),
  providerModel: varchar("providerModel", { length: 64 }),
  variantCount: integer("variantCount").default(1),
  status: varchar("status", { length: 50 }).default("pending"),
  context: text("context"),
  bestAssetId: integer("bestAssetId"),
  selectedAssetId: integer("selectedAssetId"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Character Assets ────────────────────────────────────────────────────────
export const characterAssets = pgTable("character_assets", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  userId: integer("userId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  prompt: text("prompt"),
  isRecommended: integer("isRecommended").default(0),
  isSelected: integer("isSelected").default(0),
  mintStatus: varchar("mintStatus", { length: 50 }).default("not_minted"),
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
  scoreIconity: integer("scoreIconity"),
  scoreTrustClarity: integer("scoreTrustClarity"),
  scorePremiumFeel: integer("scorePremiumFeel"),
  scoreSilhouette: integer("scoreSilhouette"),
  scoreUiCompat: integer("scoreUiCompat"),
  scoreMintReady: integer("scoreMintReady"),
  scoreProtocolAlign: integer("scoreProtocolAlign"),
  selectedAt: timestamp("selectedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Protocol Agents ─────────────────────────────────────────────────────────
export const protocolAgents = pgTable("protocol_agents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  characterAssetId: integer("characterAssetId").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  agentType: varchar("agentType", { length: 32 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  reputationScore: integer("reputationScore").default(0),
  qronPending: numeric("qronPending", { precision: 20, scale: 9 }).default("0.000000000"),
  totalVerifications: integer("totalVerifications").default(0),
  successfulVerifications: integer("successfulVerifications").default(0),
  totalClaims: integer("totalClaims").default(0),
  featureScopes: json("featureScopes"),
  policyConfig: json("policyConfig"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Verification Claims ─────────────────────────────────────────────────────
export const verificationClaims = pgTable("verification_claims", {
  id: serial("id").primaryKey(),
  agentId: integer("agentId").notNull(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId"),
  claimType: varchar("claimType", { length: 50 }).notNull(),
  confidence: integer("confidence").notNull(),
  evidence: text("evidence"),
  reasoning: text("reasoning"),
  weight: varchar("weight", { length: 16 }),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Consensus Results ───────────────────────────────────────────────────────
export const consensusResults = pgTable("consensus_results", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId").notNull(),
  verdict: varchar("verdict", { length: 50 }).notNull(),
  confidence: integer("confidence").notNull(),
  participantCount: integer("participantCount").default(0),
  finalizedAt: timestamp("finalizedAt").defaultNow().notNull(),
});

// ─── QRON Reward Ledger ──────────────────────────────────────────────────────
export const qronRewardLedger = pgTable("qron_reward_ledger", {
  id: serial("id").primaryKey(),
  agentId: integer("agentId").notNull(),
  userId: integer("userId").notNull(),
  amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  referenceType: varchar("referenceType", { length: 32 }),
  referenceId: integer("referenceId"),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Staking Positions ───────────────────────────────────────────────────────
export const stakingPositions = pgTable("staking_positions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  agentId: integer("agentId"),
  amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  multiplier: numeric("multiplier", { precision: 5, scale: 2 }).default("1.00"),
  apy: numeric("apy", { precision: 5, scale: 2 }).default("5.00"),
  rewardsEarned: numeric("rewardsEarned", { precision: 20, scale: 9 }).default("0"),
  lastRewardCalculation: timestamp("lastRewardCalculation"),
  stakedAt: timestamp("stakedAt").defaultNow().notNull(),
  releaseAt: timestamp("releaseAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Checkpoint Batches ──────────────────────────────────────────────────────
export const checkpointBatches = pgTable("checkpoint_batches", {
  id: serial("id").primaryKey(),
  batchHash: varchar("batchHash", { length: 128 }).notNull(),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  claimCount: integer("claimCount").default(0),
  status: varchar("status", { length: 50 }).default("pending"),
  finalizedAt: timestamp("finalizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Missions ────────────────────────────────────────────────────────────────
export const missions = pgTable("missions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  priority: integer("priority").default(0).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Mission Tasks ───────────────────────────────────────────────────────────
export const missionTasks = pgTable("mission_tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  missionId: varchar("missionId", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  priority: integer("priority").default(0).notNull(),
  order: integer("order").default(0).notNull(),
  payload: json("payload"),
  result: json("result"),
  error: text("error"),
  scheduledAt: timestamp("scheduledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Platform Fees ───────────────────────────────────────────────────────────
export const platformFees = pgTable("platform_fees", {
  id: serial("id").primaryKey(),
  feeType: varchar("feeType", { length: 64 }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).default("0"),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  transactionId: integer("transactionId"),
  description: text("description"),
  currency: varchar("currency", { length: 16 }).default("USD"),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  feeAmount: numeric("feeAmount", { precision: 18, scale: 8 }).default("0"),
  stakingId: integer("stakingId"),
  currency: varchar("currency", { length: 16 }).default("USD"),
  status: varchar("status", { length: 50 }).default("pending"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Bayesian Priors ─────────────────────────────────────────────────────────
export const bayesianPriors = pgTable("bayesian_priors", {
  id: serial("id").primaryKey(),
  segment: varchar("segment", { length: 64 }).notNull().unique(),
  priorAlpha: numeric("priorAlpha", { precision: 10, scale: 4 }).default("2.0000"), // Successes
  priorBeta: numeric("priorBeta", { precision: 10, scale: 4 }).default("18.0000"), // Failures (Base 10% rate)
  currentMean: numeric("currentMean", { precision: 5, scale: 4 }).default("0.1000"),
  observationsCount: integer("observationsCount").default(0),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BayesianPrior = typeof bayesianPriors.$inferSelect;
export type InsertBayesianPrior = typeof bayesianPriors.$inferInsert;

// ─── Feedback ─────────────────────────────────────────────────────────────────
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("new"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  votes: integer("votes").default(0),
  adminResponse: text("adminResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// ─── Feedback Votes ──────────────────────────────────────────────────────────
export const feedbackVotes = pgTable("feedback_votes", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedbackId").notNull(),
  userId: integer("userId").notNull(),
  voteType: varchar("voteType", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertFeedbackVote = typeof feedbackVotes.$inferInsert;

// ─── Visitor Profiles ─────────────────────────────────────────────────────────
export const visitorProfiles = pgTable("visitor_profiles", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  country: varchar("country", { length: 64 }),
  city: varchar("city", { length: 128 }),
  region: varchar("region", { length: 128 }),
  trafficSource: varchar("trafficSource", { length: 64 }),
  referrer: text("referrer"),
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  deviceType: varchar("deviceType", { length: 20 }).default("desktop"),
  segment: varchar("segment", { length: 64 }),
  pageViews: integer("pageViews").default(0),
  converted: integer("converted").default(0),
  lastSeen: timestamp("lastSeen").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Personalization Rules ────────────────────────────────────────────────────
export const personalizationRules = pgTable("personalization_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  targetElement: varchar("targetElement", { length: 128 }).notNull(),
  conditions: text("conditions"),
  content: text("content").notNull(),
  priority: integer("priority").default(0),
  status: varchar("status", { length: 50 }).default("draft"),
  aiGenerated: integer("aiGenerated").default(0),
  views: integer("views").default(0),
  conversions: integer("conversions").default(0),
  conversionRate: numeric("conversionRate", { precision: 6, scale: 2 }).default("0"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Personalization Events ───────────────────────────────────────────────────
export const personalizationEvents = pgTable("personalization_events", {
  id: serial("id").primaryKey(),
  ruleId: integer("ruleId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
