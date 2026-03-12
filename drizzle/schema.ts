import { integer, pgTable, text, timestamp, varchar, boolean, json, jsonb, numeric, bigint, index, serial } from "drizzle-orm/pg-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").default("user").notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  avatarUrl: text("avatarUrl"),
  company: varchar("company", { length: 256 }),
  title: varchar("title", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  onboardingCompleted: integer("onboardingCompleted").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => ({
  emailIdx: index("users_email_idx").on(table.email),
  stripeCustomerIdIdx: index("users_stripe_customer_id_idx").on(table.stripeCustomerId),
}));

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
  status: text("status").default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => ({
  userIdIdx: index("products_user_id_idx").on(table.userId),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Authentications ─────────────────────────────────────────────────────────
export const authentications = pgTable("authentications", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  userId: integer("userId").notNull(),
  result: text("result").notNull(),
  confidenceScore: integer("confidenceScore").notNull(),
  aiAnalysis: json("aiAnalysis"),
  imageUrl: text("imageUrl"),
  isPublic: integer("isPublic").default(0),
  shareToken: varchar("shareToken", { length: 128 }),
  shareCount: integer("shareCount").default(0),
  verificationMethod: varchar("verificationMethod", { length: 64 }).default("ai_image"),
  blockchainVerified: integer("blockchainVerified").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  productIdIdx: index("authentications_product_id_idx").on(table.productId),
}));

export type Authentication = typeof authentications.$inferSelect;

// ─── Certificates ────────────────────────────────────────────────────────────
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  authenticationId: integer("authenticationId"),
  userId: integer("userId").notNull(),
  certificateNumber: varchar("certificateNumber", { length: 64 }).notNull().unique(),
  status: text("status").default("active"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  certificateNumberIdx: index("certificates_certificate_number_idx").on(table.certificateNumber),
}));

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
  status: text("status").default("listed"),
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
  status: text("status").default("active"),
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
  plan: text("plan").notNull(),
  status: text("status").default("active"),
  monthlyQuota: integer("monthlyQuota").notNull(),
  usedQuota: integer("usedQuota").default(0),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  billingCycle: text("billingCycle").default("monthly"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  trialEndsAt: timestamp("trialEndsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => ({
  userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
}));

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
  status: text("status").default("draft"),
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
  method: text("method").notNull(),
  status: text("status").default("pending"),
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
  status: text("status").default("new"),
  industry: varchar("industry", { length: 128 }),
  notes: text("notes"),
  lastContactedAt: timestamp("lastContactedAt"),
  assignedTo: integer("assignedTo"),
  metadata: json("metadata"),
  segment: varchar("segment", { length: 20 }),
  nextActionAt: timestamp("nextActionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => ({
  emailIdx: index("leads_email_idx").on(table.email),
}));

export type Lead = typeof leads.$inferSelect;

// ─── Email Campaigns ─────────────────────────────────────────────────────────
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),
  status: text("status").default("draft"),
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
  status: text("status").default("pending"),
  generatedBy: varchar("generatedBy", { length: 64 }).default("ai_manager"),
  approvedBy: integer("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  sentAt: timestamp("sentAt"),
  notes: text("notes"),
  taskId: varchar("taskId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailDraft = typeof emailDrafts.$inferSelect;

// ─── Supply Chain Events ─────────────────────────────────────────────────────
export const supplyChainEvents = pgTable("supply_chain_events", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  eventType: text("eventType").notNull(),
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
  status: text("status").default("pending"),
  rewardAmount: numeric("rewardAmount", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: integer("rewardPaid").default(0),
  convertedAt: timestamp("convertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  referrerIdIdx: index("referrals_referrer_id_idx").on(table.referrerId),
}));

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
  status: text("status").default("pending"),
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
  status: text("status").default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Autopilot Config ────────────────────────────────────────────────────────
export const autopilotConfig = pgTable("autopilot_config", {
  id: serial("id").primaryKey(),
  enabled: integer("enabled").default(0),
  mode: text("mode").default("balanced"),
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
  status: text("status").default("pending"),
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
  status: text("status").default("draft"),
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
  status: text("status").default("pending"),
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
  severity: text("severity").default("medium"),
  description: text("description"),
  status: text("status").default("open"),
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
  trend: text("trend").default("stable"),
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Revenue Records ─────────────────────────────────────────────────────────
export const revenueRecords = pgTable("revenue_records", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  type: text("type").notNull(),
  userId: integer("userId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Notifications ──────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: text("type").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Missions ────────────────────────────────────────────────────────────────
export const missions = pgTable("missions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PLANNED"),
  priority: integer("priority").notNull().default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Mission = typeof missions.$inferSelect;
export type InsertMission = typeof missions.$inferInsert;

// ─── Mission Tasks ────────────────────────────────────────────────────────────
export const missionTasks = pgTable("mission_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  missionId: varchar("missionId", { length: 36 }).notNull().references(() => missions.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 60 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  runAt: timestamp("runAt").defaultNow().notNull(),
  lastError: text("lastError"),
  retryCount: integer("retryCount").notNull().default(0),
  retryAfter: timestamp("retryAfter"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("mission_tasks_pending_idx").on(table.status, table.runAt),
]);

export type MissionTask = typeof missionTasks.$inferSelect;
export type InsertMissionTask = typeof missionTasks.$inferInsert;

// ─── Proposals ────────────────────────────────────────────────────────────────
export const proposals = pgTable("proposals", {
  id:                varchar("id", { length: 36 }).primaryKey(),
  leadEmail:         varchar("leadEmail", { length: 320 }).notNull(),
  missionId:         varchar("missionId", { length: 36 }).notNull(),
  taskId:            varchar("taskId", { length: 36 }),
  segment:           varchar("segment", { length: 20 }).notNull().default("GOV"),
  content:           text("content").notNull(),
  paymentLink:       text("paymentLink"),
  checkoutSessionId: varchar("checkoutSessionId", { length: 128 }),
  status:            varchar("status", { length: 20 }).notNull().default("SENT"),
  pilotPriceUsd:     integer("pilotPriceUsd").notNull().default(0),
  sentAt:            timestamp("sentAt").defaultNow().notNull(),
  acceptedAt:        timestamp("acceptedAt"),
  createdAt:         timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("proposals_lead_email_idx").on(table.leadEmail),
  index("proposals_status_idx").on(table.status),
]);

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;
