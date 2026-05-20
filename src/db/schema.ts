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
  stakedAt: timestamp("stakedAt").defaultNow().notNull(),
  releaseAt: timestamp("releaseAt"),
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
  type: varchar("type", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
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
i m p o r t   {  
     p g T a b l e ,  
     t e x t ,  
     t i m e s t a m p ,  
     i n t e g e r ,  
     u u i d ,  
     p g E n u m ,  
     i n d e x ,  
     b o o l e a n ,  
     j s o n b ,  
     p r i m a r y K e y ,  
     n u m e r i c ,  
 }   f r o m   ' d r i z z l e - o r m / p g - c o r e ' ;  
  
 e x p o r t   c o n s t   t i e r E n u m   =   p g E n u m ( ' t i e r ' ,   [ ' f r e e ' ,   ' p r o ' ,   ' e n t e r p r i s e ' ] ) ;  
  
 e x p o r t   c o n s t   p r o f i l e s   =   p g T a b l e (  
     ' p r o f i l e s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) ,  
         e m a i l :   t e x t ( ' e m a i l ' ) ,  
         f u l l N a m e :   t e x t ( ' f u l l _ n a m e ' ) ,  
         a v a t a r U r l :   t e x t ( ' a v a t a r U r l ' ) ,  
         c o m p a n y :   t e x t ( ' c o m p a n y ' ) ,  
         s e c o n d a r y C o l o r :   t e x t ( ' s e c o n d a r y C o l o r ' ) ,  
         a p i K e y :   t e x t ( ' a p i K e y ' ) ,  
         a p i S e c r e t :   t e x t ( ' a p i S e c r e t ' ) ,  
         t i e r :   t e x t ( ' t i e r ' ) . d e f a u l t ( ' f r e e ' ) . n o t N u l l ( ) ,  
         g e n e r a t i o n s U s e d :   i n t e g e r ( ' g e n e r a t i o n s _ u s e d ' ) . d e f a u l t ( 0 ) . n o t N u l l ( ) ,  
         g e n e r a t i o n s L i m i t :   i n t e g e r ( ' g e n e r a t i o n s _ l i m i t ' ) . d e f a u l t ( 1 0 ) . n o t N u l l ( ) ,  
         s t r i p e C u s t o m e r I d :   t e x t ( ' s t r i p e _ c u s t o m e r _ i d ' ) . u n i q u e ( ) ,  
         s t r i p e S u b s c r i p t i o n I d :   t e x t ( ' s t r i p e _ s u b s c r i p t i o n _ i d ' ) ,  
         a f f i l i a t e I d :   t e x t ( ' a f f i l i a t e _ i d ' ) . u n i q u e ( ) ,  
         r e f e r r e d B y :   t e x t ( ' r e f e r r e d _ b y ' ) ,  
         s t o r y M o d e E n a b l e d :   b o o l e a n ( ' s t o r y _ m o d e _ e n a b l e d ' ) . d e f a u l t ( f a l s e ) ,   / /   A d d e d   f o r   S t o r y   M o d e  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ p r o f i l e s _ u s e r _ i d ' ) . o n ( t a b l e . u s e r I d ) ,  
         i n d e x ( ' i d x _ p r o f i l e s _ s t r i p e _ c u s t o m e r ' ) . o n ( t a b l e . s t r i p e C u s t o m e r I d ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   q r o n s   =   p g T a b l e (  
     ' q r o n s ' ,  
     {  
         i d :   i n t e g e r ( ' i d ' ) . p r i m a r y K e y ( ) ,   / /   A c t u a l   D B   u s e s   s e r i a l   i n t e g e r  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) . n o t N u l l ( ) ,  
         n a m e :   t e x t ( ' n a m e ' ) ,  
         u r l :   t e x t ( ' u r l ' ) ,  
         s h o r t C o d e :   t e x t ( ' s h o r t _ c o d e ' ) ,  
         s c a n C o u n t :   i n t e g e r ( ' s c a n _ c o u n t ' ) . d e f a u l t ( 0 ) . n o t N u l l ( ) ,  
         f o l d e r I d :   i n t e g e r ( ' f o l d e r _ i d ' ) ,  
         i s A c t i v e :   b o o l e a n ( ' i s _ a c t i v e ' ) . d e f a u l t ( t r u e ) . n o t N u l l ( ) ,  
         m o d e :   t e x t ( ' m o d e ' ) . d e f a u l t ( ' s t a n d a r d ' ) . n o t N u l l ( ) ,  
         t a r g e t U r l :   t e x t ( ' t a r g e t _ u r l ' ) . n o t N u l l ( ) ,  
         i m a g e U r l :   t e x t ( ' i m a g e _ u r l ' ) . n o t N u l l ( ) ,  
         p r o m p t :   t e x t ( ' p r o m p t ' ) ,  
         s t y l e :   j s o n b ( ' s t y l e ' ) ,   / /   A c t u a l   D B   u s e s   j s o n b   f o r   s t y l e  
         i s D e m o :   b o o l e a n ( ' i s _ d e m o ' ) . d e f a u l t ( f a l s e ) . n o t N u l l ( ) ,  
         s t o r y E n a b l e d :   b o o l e a n ( ' s t o r y _ e n a b l e d ' ) . d e f a u l t ( f a l s e ) ,   / /   A d d e d   f o r   S t o r y   M o d e  
         s t o r y T i e r :   t e x t ( ' s t o r y _ t i e r ' ) ,   / /   A d d e d   f o r   S t o r y   M o d e  
         s t o r y U n l o c k e d A t :   t i m e s t a m p ( ' s t o r y _ u n l o c k e d _ a t ' ) ,   / /   A d d e d   f o r   S t o r y   M o d e  
         m e t a d a t a :   j s o n b ( ' m e t a d a t a ' ) . d e f a u l t ( { } ) ,   / /   A d d e d   f o r   P h a s e   2 :   B l o c k c h a i n   A n c h o r i n g  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ q r o n s _ u s e r _ i d ' ) . o n ( t a b l e . u s e r I d ) ,  
         i n d e x ( ' i d x _ q r o n s _ s h o r t _ c o d e ' ) . o n ( t a b l e . s h o r t C o d e ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   r e d i r e c t R u l e s   =   p g T a b l e (  
     ' r e d i r e c t _ r u l e s ' ,  
     {  
         i d :   i n t e g e r ( ' i d ' ) . p r i m a r y K e y ( ) ,  
         q r o n I d :   i n t e g e r ( ' q r o n _ i d ' ) . n o t N u l l ( ) ,  
         n a m e :   t e x t ( ' n a m e ' ) . n o t N u l l ( ) ,  
         u r l :   t e x t ( ' u r l ' ) ,  
         p r i o r i t y :   i n t e g e r ( ' p r i o r i t y ' ) . d e f a u l t ( 1 0 0 ) . n o t N u l l ( ) ,  
         r u l e T y p e :   t e x t ( ' r u l e _ t y p e ' ) . n o t N u l l ( ) ,  
         c o n f i g u r a t i o n :   j s o n b ( ' c o n f i g u r a t i o n ' ) . d e f a u l t ( { } ) . n o t N u l l ( ) ,  
         c o n d i t i o n s :   j s o n b ( ' c o n d i t i o n s ' ) ,  
         w e i g h t :   i n t e g e r ( ' w e i g h t ' ) ,  
         i s A c t i v e :   b o o l e a n ( ' i s _ a c t i v e ' ) . d e f a u l t ( t r u e ) . n o t N u l l ( ) ,  
         c l i c k C o u n t :   i n t e g e r ( ' c l i c k _ c o u n t ' ) . d e f a u l t ( 0 ) ,  
         g e o T a r g e t s :   t e x t ( ' g e o _ t a r g e t s ' ) . a r r a y ( ) ,  
         d e v i c e T a r g e t s :   t e x t ( ' d e v i c e _ t a r g e t s ' ) . a r r a y ( ) ,  
         s t a r t T i m e :   t i m e s t a m p ( ' s t a r t _ t i m e ' ) ,  
         e n d T i m e :   t i m e s t a m p ( ' e n d _ t i m e ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ r e d i r e c t _ q r o n ' ) . o n ( t a b l e . q r o n I d ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   b r a n d s   =   p g T a b l e (  
     ' b r a n d s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) . n o t N u l l ( ) ,  
         n a m e :   t e x t ( ' n a m e ' ) . n o t N u l l ( ) ,  
         d o m a i n :   t e x t ( ' d o m a i n ' ) ,  
         l o g o U r l :   t e x t ( ' l o g o _ u r l ' ) ,  
         i n d u s t r y :   t e x t ( ' i n d u s t r y ' ) ,  
         s t a k i n g T i e r :   t e x t ( ' s t a k i n g _ t i e r ' ) . d e f a u l t ( ' n o n e ' ) . n o t N u l l ( ) ,  
         q r o n S t a k e d :   n u m e r i c ( ' q r o n _ s t a k e d ' ) . d e f a u l t ( ' 0 ' ) . n o t N u l l ( ) ,  
         w a l l e t A d d r e s s :   t e x t ( ' w a l l e t _ a d d r e s s ' ) ,  
         u n i t C o s t D i s c o u n t :   n u m e r i c ( ' u n i t _ c o s t _ d i s c o u n t ' ) . d e f a u l t ( ' 0 ' ) . n o t N u l l ( ) ,  
         b a s e U n i t C o s t :   n u m e r i c ( ' b a s e _ u n i t _ c o s t ' ) . d e f a u l t ( ' 0 . 0 5 ' ) . n o t N u l l ( ) ,  
         i s V e r i f i e d :   b o o l e a n ( ' i s _ v e r i f i e d ' ) . d e f a u l t ( f a l s e ) . n o t N u l l ( ) ,  
         i s A c t i v e :   b o o l e a n ( ' i s _ a c t i v e ' ) . d e f a u l t ( t r u e ) . n o t N u l l ( ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ b r a n d s _ u s e r ' ) . o n ( t a b l e . u s e r I d ) ,  
         i n d e x ( ' i d x _ b r a n d s _ d o m a i n ' ) . o n ( t a b l e . d o m a i n ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   b r a n d W e b h o o k s   =   p g T a b l e (  
     ' b r a n d _ w e b h o o k s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         b r a n d I d :   u u i d ( ' b r a n d _ i d ' ) . n o t N u l l ( ) ,  
         b r a n d :   t e x t ( ' b r a n d ' ) ,  
         e n d p o i n t U r l :   t e x t ( ' e n d p o i n t _ u r l ' ) . n o t N u l l ( ) ,  
         s e c r e t K e y :   t e x t ( ' s e c r e t _ k e y ' ) . n o t N u l l ( ) ,  
         e v e n t s :   t e x t ( ' e v e n t s ' ) . a r r a y ( ) . d e f a u l t ( [ ' q r o n _ s c a n n e d ' ] ) . n o t N u l l ( ) ,  
         i s A c t i v e :   b o o l e a n ( ' i s _ a c t i v e ' ) . d e f a u l t ( t r u e ) . n o t N u l l ( ) ,  
         d e l i v e r i e s T o t a l :   i n t e g e r ( ' d e l i v e r i e s _ t o t a l ' ) . d e f a u l t ( 0 ) ,  
         d e l i v e r i e s F a i l e d :   i n t e g e r ( ' d e l i v e r i e s _ f a i l e d ' ) . d e f a u l t ( 0 ) ,  
         l a s t D e l i v e r e d A t :   t i m e s t a m p ( ' l a s t _ d e l i v e r e d _ a t ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ b r a n d _ w e b h o o k s _ b r a n d ' ) . o n ( t a b l e . b r a n d I d ) ,  
     ]  
 ) ;  
  
 / /   M i n i m a l   P r o d u c t s   f o r   n o w   t o   a v o i d   m a s s i v e   s p r a w l  
 e x p o r t   c o n s t   p r o d u c t s   =   p g T a b l e (  
     ' p r o d u c t s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) ,  
         n a m e :   t e x t ( ' n a m e ' ) . n o t N u l l ( ) ,  
         d e s c r i p t i o n :   t e x t ( ' d e s c r i p t i o n ' ) ,  
         m a n u f a c t u r e r :   t e x t ( ' m a n u f a c t u r e r ' ) ,  
         m o d e l N u m b e r :   t e x t ( ' m o d e l _ n u m b e r ' ) ,  
         c a t e g o r y :   t e x t ( ' c a t e g o r y ' ) ,  
         m e t a d a t a :   j s o n b ( ' m e t a d a t a ' ) . d e f a u l t ( { } ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   c e r t i f i c a t i o n s   =   p g T a b l e (  
     ' c e r t i f i c a t i o n s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         p r o d u c t I d :   u u i d ( ' p r o d u c t _ i d ' ) . n o t N u l l ( ) . r e f e r e n c e s ( ( )   = >   p r o d u c t s . i d ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) ,  
         n a m e :   t e x t ( ' n a m e ' ) ,  
         s e r i a l N u m b e r :   t e x t ( ' s e r i a l _ n u m b e r ' ) . n o t N u l l ( ) . u n i q u e ( ) ,  
         s t a t u s :   t e x t ( ' s t a t u s ' ) . d e f a u l t ( ' p e n d i n g ' ) . n o t N u l l ( ) ,  
         q r I m a g e U r l :   t e x t ( ' q r _ i m a g e _ u r l ' ) ,  
         s e a l S v g U r l :   t e x t ( ' s e a l _ s v g _ u r l ' ) ,  
         a p p r o v e d A t :   t i m e s t a m p ( ' a p p r o v e d _ a t ' ) ,  
         i s s u e d A t :   t i m e s t a m p ( ' i s s u e d _ a t ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   d p p D a t a   =   p g T a b l e (  
     ' d p p _ d a t a ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         c e r t i f i c a t i o n I d :   u u i d ( ' c e r t i f i c a t i o n _ i d ' ) . n o t N u l l ( ) ,  
         m a t e r i a l C o m p o s i t i o n :   j s o n b ( ' m a t e r i a l _ c o m p o s i t i o n ' ) ,  
         c a r b o n F o o t p r i n t :   n u m e r i c ( ' c a r b o n _ f o o t p r i n t ' ) ,  
         r e p a i r a b i l i t y S c o r e :   n u m e r i c ( ' r e p a i r a b i l i t y _ s c o r e ' ) ,  
         e n d O f L i f e I n s t r u c t i o n s :   t e x t ( ' e n d _ o f _ l i f e _ i n s t r u c t i o n s ' ) ,  
         s u p p l y C h a i n P r o v e n a n c e :   j s o n b ( ' s u p p l y _ c h a i n _ p r o v e n a n c e ' ) ,  
         l a s t U p d a t e d :   t i m e s t a m p ( ' l a s t _ u p d a t e d ' ) . d e f a u l t N o w ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   s c a n L o g s   =   p g T a b l e (  
     ' s c a n _ l o g s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         q r o n I d :   i n t e g e r ( ' q r o n _ i d ' ) ,  
         i p :   t e x t ( ' i p ' ) ,  
         c o u n t r y :   t e x t ( ' c o u n t r y ' ) ,  
         r e g i o n :   t e x t ( ' r e g i o n ' ) ,  
         c i t y :   t e x t ( ' c i t y ' ) ,  
         u s e r A g e n t :   t e x t ( ' u s e r _ a g e n t ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   f o l d e r s   =   p g T a b l e (  
     ' f o l d e r s ' ,  
     {  
         i d :   i n t e g e r ( ' i d ' ) . p r i m a r y K e y ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) . n o t N u l l ( ) ,  
         n a m e :   t e x t ( ' n a m e ' ) . n o t N u l l ( ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   t a g s   =   p g T a b l e (  
     ' t a g s ' ,  
     {  
         i d :   i n t e g e r ( ' i d ' ) . p r i m a r y K e y ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) . n o t N u l l ( ) ,  
         n a m e :   t e x t ( ' n a m e ' ) . n o t N u l l ( ) ,  
         c o l o r :   t e x t ( ' c o l o r ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   q r o n T a g s   =   p g T a b l e (  
     ' q r o n _ t a g s ' ,  
     {  
         q r o n I d :   i n t e g e r ( ' q r o n _ i d ' ) . n o t N u l l ( ) ,  
         t a g I d :   i n t e g e r ( ' t a g _ i d ' ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         p r i m a r y K e y ( {   c o l u m n s :   [ t a b l e . q r o n I d ,   t a b l e . t a g I d ]   } ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   q r o n G e n e r a t i o n s   =   p g T a b l e (  
     ' q r o n _ g e n e r a t i o n s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) ,  
         u r l :   t e x t ( ' u r l ' ) ,  
         p r o m p t :   t e x t ( ' p r o m p t ' ) ,  
         m o d e :   t e x t ( ' m o d e ' ) ,  
         i m a g e U r l :   t e x t ( ' i m a g e _ u r l ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     }  
 ) ;  
  
 e x p o r t   c o n s t   t e l e m e t r y E v e n t s   =   p g T a b l e (  
     ' t e l e m e t r y _ e v e n t s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         u s e r I d :   u u i d ( ' u s e r _ i d ' ) ,  
         b r a n d I d :   u u i d ( ' b r a n d _ i d ' ) ,  
         p r o d u c t I d :   u u i d ( ' p r o d u c t _ i d ' ) ,  
         t h e a t e r :   t e x t ( ' t h e a t e r ' ) . n o t N u l l ( ) ,   / /   ' t h e a t e r _ 1 ' ,   ' t h e a t e r _ 3 ' ,   e t c .  
         r a w P a y l o a d :   j s o n b ( ' r a w _ p a y l o a d ' ) . n o t N u l l ( ) ,  
         p a r s e d S t a t e :   j s o n b ( ' p a r s e d _ s t a t e ' ) . n o t N u l l ( ) ,  
         s t a t e H a s h :   t e x t ( ' s t a t e _ h a s h ' ) . n o t N u l l ( ) ,  
         a n c h o r e d T x H a s h :   t e x t ( ' a n c h o r e d _ t x _ h a s h ' ) ,  
         t i m e s t a m p :   t i m e s t a m p ( ' t i m e s t a m p ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ t e l e m e t r y _ t h e a t e r ' ) . o n ( t a b l e . t h e a t e r ) ,  
         i n d e x ( ' i d x _ t e l e m e t r y _ h a s h ' ) . o n ( t a b l e . s t a t e H a s h ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   l e a d S e q u e n c e s   =   p g T a b l e (  
     ' l e a d _ s e q u e n c e s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         l e a d I d :   u u i d ( ' l e a d _ i d ' ) . n o t N u l l ( ) ,  
         c u r r e n t S t a g e :   i n t e g e r ( ' c u r r e n t _ s t a g e ' ) . d e f a u l t ( 1 ) . n o t N u l l ( ) ,  
         s t a t u s :   t e x t ( ' s t a t u s ' ) . d e f a u l t ( ' a c t i v e ' ) . n o t N u l l ( ) ,   / /   ' a c t i v e ' ,   ' p a u s e d ' ,   ' c o m p l e t e d '  
         l a s t A c t i o n A t :   t i m e s t a m p ( ' l a s t _ a c t i o n _ a t ' ) ,  
         n e x t A c t i o n A t :   t i m e s t a m p ( ' n e x t _ a c t i o n _ a t ' ) ,  
         m e t a d a t a :   j s o n b ( ' m e t a d a t a ' ) . d e f a u l t ( { } ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ s e q u e n c e _ l e a d ' ) . o n ( t a b l e . l e a d I d ) ,  
         i n d e x ( ' i d x _ s e q u e n c e _ s t a t u s ' ) . o n ( t a b l e . s t a t u s ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   l i v i n g A r t S c h e d u l e s   =   p g T a b l e (  
     ' l i v i n g _ a r t _ s c h e d u l e s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         q r o n I d :   i n t e g e r ( ' q r o n _ i d ' ) . n o t N u l l ( ) ,  
         p r o m p t :   t e x t ( ' p r o m p t ' ) . n o t N u l l ( ) ,  
         s t y l e :   t e x t ( ' s t y l e ' ) ,  
         s t a r t T i m e :   t i m e s t a m p ( ' s t a r t _ t i m e ' ) . n o t N u l l ( ) ,  
         e n d T i m e :   t i m e s t a m p ( ' e n d _ t i m e ' ) ,  
         i s P r o c e s s e d :   b o o l e a n ( ' i s _ p r o c e s s e d ' ) . d e f a u l t ( f a l s e ) . n o t N u l l ( ) ,  
         p r o c e s s e d A t :   t i m e s t a m p ( ' p r o c e s s e d _ a t ' ) ,  
         n e w I m a g e U r l :   t e x t ( ' n e w _ i m a g e _ u r l ' ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ l i v i n g _ a r t _ q r o n ' ) . o n ( t a b l e . q r o n I d ) ,  
         i n d e x ( ' i d x _ l i v i n g _ a r t _ s t a r t ' ) . o n ( t a b l e . s t a r t T i m e ) ,  
     ]  
 ) ;  
  
 e x p o r t   c o n s t   w h i t e L a b e l C l i e n t s   =   p g T a b l e (  
     ' w h i t e _ l a b e l _ c l i e n t s ' ,  
     {  
         i d :   u u i d ( ' i d ' ) . p r i m a r y K e y ( ) . d e f a u l t R a n d o m ( ) ,  
         n a m e :   t e x t ( ' n a m e ' ) . n o t N u l l ( ) ,  
         d o m a i n :   t e x t ( ' d o m a i n ' ) . u n i q u e ( ) ,  
         l o g o U r l :   t e x t ( ' l o g o _ u r l ' ) ,  
         b r a n d C o l o r s :   j s o n b ( ' b r a n d _ c o l o r s ' ) . d e f a u l t ( {   p r i m a r y :   ' # 0 0 0 0 0 0 ' ,   s e c o n d a r y :   ' # f f f f f f '   } ) ,  
         a p i K e y P r e f i x :   t e x t ( ' a p i _ k e y _ p r e f i x ' ) . u n i q u e ( ) ,  
         b i l l i n g P l a n :   t e x t ( ' b i l l i n g _ p l a n ' ) . d e f a u l t ( ' r e s e l l e r _ s t a n d a r d ' ) . n o t N u l l ( ) ,  
         i s A c t i v e :   b o o l e a n ( ' i s _ a c t i v e ' ) . d e f a u l t ( t r u e ) . n o t N u l l ( ) ,  
         c r e a t e d A t :   t i m e s t a m p ( ' c r e a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
         u p d a t e d A t :   t i m e s t a m p ( ' u p d a t e d _ a t ' ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     } ,  
     ( t a b l e )   = >   [  
         i n d e x ( ' i d x _ w h i t e _ l a b e l _ d o m a i n ' ) . o n ( t a b l e . d o m a i n ) ,  
     ]  
 ) ;  
 