var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  abTests: () => abTests,
  activityLog: () => activityLog,
  affiliateCommissions: () => affiliateCommissions,
  affiliates: () => affiliates,
  aiModels: () => aiModels,
  auctionBids: () => auctionBids,
  auctions: () => auctions,
  authentications: () => authentications,
  autopilotConfig: () => autopilotConfig,
  autopilotDecisions: () => autopilotDecisions,
  bonuses: () => bonuses,
  certificates: () => certificates,
  characterAssets: () => characterAssets,
  characterGenerations: () => characterGenerations,
  checkpointBatches: () => checkpointBatches,
  consensusResults: () => consensusResults,
  customerHealthScores: () => customerHealthScores,
  emailCampaigns: () => emailCampaigns,
  emailDrafts: () => emailDrafts,
  fraudAlerts: () => fraudAlerts,
  invoices: () => invoices,
  leads: () => leads,
  missionTasks: () => missionTasks,
  missions: () => missions,
  modelPurchases: () => modelPurchases,
  modelReviews: () => modelReviews,
  nftCollections: () => nftCollections,
  nfts: () => nfts,
  notifications: () => notifications,
  payments: () => payments,
  products: () => products,
  protocolAgents: () => protocolAgents,
  qrCodes: () => qrCodes,
  qronRewardLedger: () => qronRewardLedger,
  referralClicks: () => referralClicks,
  referrals: () => referrals,
  revenueRecords: () => revenueRecords,
  scheduledJobRuns: () => scheduledJobRuns,
  serviceOrders: () => serviceOrders,
  subscriptions: () => subscriptions,
  supplyChainEvents: () => supplyChainEvents,
  usageRecords: () => usageRecords,
  users: () => users,
  verificationClaims: () => verificationClaims,
  whiteLabelClients: () => whiteLabelClients
});
import {
  mysqlTable,
  varchar,
  text,
  mysqlEnum,
  int,
  timestamp,
  json,
  decimal
} from "drizzle-orm/mysql-core";
var missions, missionTasks, products, authentications, certificates, qrCodes, nftCollections, nfts, auctions, auctionBids, subscriptions, usageRecords, invoices, payments, leads, emailCampaigns, emailDrafts, supplyChainEvents, referrals, affiliates, affiliateCommissions, autopilotConfig, autopilotDecisions, abTests, whiteLabelClients, activityLog, fraudAlerts, customerHealthScores, revenueRecords, notifications, scheduledJobRuns, characterGenerations, characterAssets, protocolAgents, verificationClaims, consensusResults, qronRewardLedger, checkpointBatches, bonuses, referralClicks, aiModels, modelPurchases, modelReviews, serviceOrders, users;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    missions = mysqlTable("missions", {
      id: varchar("id", { length: 36 }).primaryKey(),
      title: varchar("title", { length: 255 }).notNull(),
      description: text("description").notNull(),
      status: mysqlEnum("status", ["pending", "active", "completed", "failed"]).notNull(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").onUpdateNow()
    });
    missionTasks = mysqlTable("mission_tasks", {
      id: varchar("id", { length: 36 }).primaryKey(),
      missionId: varchar("mission_id", { length: 36 }).notNull().references(() => missions.id),
      title: varchar("title", { length: 255 }).notNull(),
      description: text("description").notNull(),
      status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).notNull(),
      order: int("order").notNull(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").onUpdateNow()
    });
    products = mysqlTable("products", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    authentications = mysqlTable("authentications", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    certificates = mysqlTable("certificates", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    qrCodes = mysqlTable("qr_codes", {
      id: int("id").autoincrement().primaryKey(),
      productId: int("productId").notNull(),
      userId: int("userId").notNull(),
      qrData: text("qrData").notNull(),
      qrImageUrl: text("qrImageUrl"),
      scanCount: int("scanCount").default(0),
      lastScannedAt: timestamp("lastScannedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    nftCollections = mysqlTable("nft_collections", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    nfts = mysqlTable("nfts", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    auctions = mysqlTable("auctions", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    auctionBids = mysqlTable("auction_bids", {
      id: int("id").autoincrement().primaryKey(),
      auctionId: int("auctionId").notNull(),
      bidderId: int("bidderId").notNull(),
      amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    subscriptions = mysqlTable("subscriptions", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    usageRecords = mysqlTable("usage_records", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      subscriptionId: int("subscriptionId"),
      type: varchar("type", { length: 64 }).notNull(),
      quantity: int("quantity").default(1),
      metadata: json("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    invoices = mysqlTable("invoices", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    payments = mysqlTable("payments", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    leads = mysqlTable("leads", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    emailCampaigns = mysqlTable("email_campaigns", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    emailDrafts = mysqlTable("email_drafts", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    supplyChainEvents = mysqlTable("supply_chain_events", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    referrals = mysqlTable("referrals", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    affiliates = mysqlTable("affiliates", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    affiliateCommissions = mysqlTable("affiliate_commissions", {
      id: int("id").autoincrement().primaryKey(),
      affiliateId: int("affiliateId").notNull(),
      paymentId: int("paymentId"),
      amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
      status: mysqlEnum("status", ["pending", "approved", "paid", "rejected"]).default("pending"),
      paidAt: timestamp("paidAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    autopilotConfig = mysqlTable("autopilot_config", {
      id: int("id").autoincrement().primaryKey(),
      enabled: int("enabled").default(0),
      mode: mysqlEnum("mode", ["conservative", "balanced", "aggressive"]).default("balanced"),
      guardrails: json("guardrails"),
      updatedBy: int("updatedBy"),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    autopilotDecisions = mysqlTable("autopilot_decisions", {
      id: int("id").autoincrement().primaryKey(),
      type: varchar("type", { length: 64 }).notNull(),
      action: varchar("action", { length: 256 }).notNull(),
      reasoning: text("reasoning"),
      confidence: int("confidence"),
      status: mysqlEnum("status", ["pending", "executed", "overridden", "failed"]).default("pending"),
      result: json("result"),
      overriddenBy: int("overriddenBy"),
      overrideReason: text("overrideReason"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    abTests = mysqlTable("ab_tests", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    whiteLabelClients = mysqlTable("white_label_clients", {
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
      apiCallLimit: int("apiCallLimit").default(1e4),
      features: json("features"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    activityLog = mysqlTable("activity_log", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId"),
      action: varchar("action", { length: 128 }).notNull(),
      entityType: varchar("entityType", { length: 64 }),
      entityId: int("entityId"),
      details: json("details"),
      ipAddress: varchar("ipAddress", { length: 64 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    fraudAlerts = mysqlTable("fraud_alerts", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    customerHealthScores = mysqlTable("customer_health_scores", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      score: int("score").notNull(),
      factors: json("factors"),
      trend: mysqlEnum("trend", ["improving", "stable", "declining"]).default("stable"),
      lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    revenueRecords = mysqlTable("revenue_records", {
      id: int("id").autoincrement().primaryKey(),
      source: varchar("source", { length: 128 }).notNull(),
      amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
      currency: varchar("currency", { length: 8 }).default("USD"),
      type: mysqlEnum("type", ["subscription", "one_time", "overage", "affiliate", "marketplace"]).notNull(),
      userId: int("userId"),
      metadata: json("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    notifications = mysqlTable("notifications", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      type: mysqlEnum("type", [
        "authentication",
        "certificate",
        "payment",
        "subscription",
        "nft",
        "referral",
        "system",
        "alert",
        "supply_chain",
        "autopilot"
      ]).notNull(),
      title: varchar("title", { length: 256 }).notNull(),
      message: text("message").notNull(),
      isRead: int("isRead").default(0).notNull(),
      actionUrl: varchar("actionUrl", { length: 512 }),
      metadata: json("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    scheduledJobRuns = mysqlTable("scheduled_job_runs", {
      id: int("id").autoincrement().primaryKey(),
      jobName: varchar("jobName", { length: 128 }).notNull(),
      status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
      startedAt: timestamp("startedAt").defaultNow().notNull(),
      completedAt: timestamp("completedAt"),
      duration: int("duration"),
      // milliseconds
      result: json("result"),
      error: text("error"),
      itemsProcessed: int("itemsProcessed").default(0)
    });
    characterGenerations = mysqlTable("character_generations", {
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
      completedAt: timestamp("completedAt")
    });
    characterAssets = mysqlTable("character_assets", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    protocolAgents = mysqlTable("protocol_agents", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    verificationClaims = mysqlTable("verification_claims", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    consensusResults = mysqlTable("consensus_results", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    qronRewardLedger = mysqlTable("qron_reward_ledger", {
      id: int("id").autoincrement().primaryKey(),
      agentId: int("agentId").notNull(),
      userId: int("userId").notNull(),
      amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
      reason: mysqlEnum("reason", [
        "verification_reward",
        "consensus_participation",
        "accuracy_bonus",
        "streak_bonus",
        "referral_reward",
        "staking_yield",
        "penalty"
      ]).notNull(),
      referenceType: varchar("referenceType", { length: 64 }),
      referenceId: int("referenceId"),
      status: mysqlEnum("status", ["pending", "settled", "claimed", "expired"]).default("pending"),
      settlementBatchId: int("settlementBatchId"),
      claimedAt: timestamp("claimedAt"),
      metadata: json("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    checkpointBatches = mysqlTable("checkpoint_batches", {
      id: int("id").autoincrement().primaryKey(),
      batchType: mysqlEnum("batchType", ["verification", "reward_settlement", "agent_registration"]).notNull(),
      rootHash: varchar("rootHash", { length: 128 }).notNull(),
      chainId: int("chainId").default(137),
      txHash: varchar("txHash", { length: 128 }),
      itemCount: int("itemCount").default(0),
      status: mysqlEnum("status", ["pending", "submitted", "confirmed", "failed"]).default("pending"),
      finalizedAt: timestamp("finalizedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    bonuses = mysqlTable("bonuses", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    referralClicks = mysqlTable("referral_clicks", {
      id: int("id").autoincrement().primaryKey(),
      referralCode: varchar("referralCode", { length: 32 }).notNull(),
      ipAddress: varchar("ipAddress", { length: 64 }),
      userAgent: text("userAgent"),
      referer: text("referer"),
      landingPage: text("landingPage"),
      convertedAt: timestamp("convertedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    aiModels = mysqlTable("ai_models", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    modelPurchases = mysqlTable("model_purchases", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      modelId: int("modelId").notNull(),
      pricePaid: int("pricePaid").notNull(),
      purchaseType: mysqlEnum("purchaseType", ["purchase", "subscription", "rental"]).default("purchase"),
      status: mysqlEnum("purchaseStatus", ["active", "expired", "refunded"]).default("active"),
      expiresAt: timestamp("expiresAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    modelReviews = mysqlTable("model_reviews", {
      id: int("id").autoincrement().primaryKey(),
      modelId: int("modelId").notNull(),
      userId: int("userId").notNull(),
      rating: int("rating").notNull(),
      review: text("review"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    serviceOrders = mysqlTable("service_orders", {
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
        "government_dossier"
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("open_id", { length: 256 }).notNull().unique(),
      email: varchar("email", { length: 320 }),
      name: varchar("name", { length: 256 }),
      loginMethod: varchar("login_method", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin", "brand"]).default("user").notNull(),
      stripeCustomerId: varchar("stripe_customer_id", { length: 256 }),
      lastSignedIn: timestamp("last_signed_in"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      thirdwebClientId: process.env.VITE_THIRDWEB_CLIENT_ID ?? "",
      thirdwebSecretKey: process.env.thirdweb_api_key ?? "",
      hubspotServiceKey: process.env.HUBSPOT_SERVICE_KEY ?? "",
      stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
      sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
      paddleApiKey: process.env.PADDLE_API_KEY ?? "",
      paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? "",
      // ── Autonomous Revenue Pipeline ──────────────────────────────────────────
      autonomousPipelineEnabled: process.env.AUTONOMOUS_PIPELINE_ENABLED === "true",
      requireOutreachApproval: process.env.REQUIRE_OUTREACH_APPROVAL !== "false",
      requireDevApproval: process.env.REQUIRE_SCHEMA_MIGRATION_APPROVAL !== "false",
      suppressionList: process.env.SUPPRESSION_LIST ?? "",
      // ── Lead Discovery (Apollo.io) ────────────────────────────────────────────
      apolloApiKey: process.env.APOLLO_API_KEY ?? "",
      // ── Email ─────────────────────────────────────────────────────────────────
      resendApiKey: process.env.RESEND_API_KEY ?? "",
      gmailFromEmail: process.env.GMAIL_FROM_EMAIL ?? "",
      gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
      gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
      gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
      // ── AI / LLM ──────────────────────────────────────────────────────────────
      openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
      groqApiKey: process.env.GROQ_API_KEY ?? "",
      openaiApiKey: process.env.OPENAI_API_KEY ?? "",
      // ── Video / Media ─────────────────────────────────────────────────────────
      heygenApiKey: process.env.HEYGEN_API_KEY ?? "",
      // ── Budget guardrails ─────────────────────────────────────────────────────
      llmMonthlyBudgetUsd: Number(process.env.LLM_MONTHLY_BUDGET_USD ?? 500),
      llmPerRequestBudgetUsd: Number(process.env.LLM_PER_REQUEST_BUDGET_USD ?? 0.1),
      adsDailyCapUsd: Number(process.env.ADS_DAILY_CAP_USD ?? 300),
      enrichmentMonthlyCapUsd: Number(process.env.ENRICHMENT_MONTHLY_CAP_USD ?? 200),
      // ── Integrations ─────────────────────────────────────────────────────────
      airtableBaseId: process.env.AIRTABLE_BASE_ID ?? "",
      airtableApiKey: process.env.AIRTABLE_API_KEY ?? "",
      makeWebhookUrl: process.env.MAKE_WEBHOOK_URL ?? "",
      posthogApiKey: process.env.POSTHOG_API_KEY ?? ""
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  createDb: () => createDb,
  createMission: () => createMission,
  createProposal: () => createProposal,
  createServiceOrder: () => createServiceOrder,
  createSystemNotification: () => createSystemNotification,
  db: () => db,
  enqueueTask: () => enqueueTask,
  getActiveMissionTypes: () => getActiveMissionTypes,
  getAdaptivePriors: () => getAdaptivePriors,
  getAllServiceOrders: () => getAllServiceOrders,
  getAllUsers: () => getAllUsers,
  getBudgetStatus: () => getBudgetStatus,
  getDb: () => getDb,
  getDueTasks: () => getDueTasks,
  getMissionById: () => getMissionById,
  getMissions: () => getMissions,
  getQuarterlyValueReport: () => getQuarterlyValueReport,
  getRecentActivity: () => getRecentActivity,
  getRunTaskCount: () => getRunTaskCount,
  getServiceOrderById: () => getServiceOrderById,
  getServiceOrdersByUser: () => getServiceOrdersByUser,
  getSubscriptionByStripeSubscriptionId: () => getSubscriptionByStripeSubscriptionId,
  getTasksByMission: () => getTasksByMission,
  getWeeklyRevenueDigest: () => getWeeklyRevenueDigest,
  hasActionLogged: () => hasActionLogged,
  hasDunningStepLogged: () => hasDunningStepLogged,
  hasUserActionLogged: () => hasUserActionLogged,
  hasWebhookEventProcessed: () => hasWebhookEventProcessed,
  listHighScanUsers: () => listHighScanUsers,
  listInactiveUsersNoRecentScans: () => listInactiveUsersNoRecentScans,
  listPastDueSubscriptions: () => listPastDueSubscriptions,
  listUsersForOnboardingStep: () => listUsersForOnboardingStep,
  logActivity: () => logActivity,
  logAutomationAudit: () => logAutomationAudit,
  markTaskDone: () => markTaskDone,
  markTaskFailed: () => markTaskFailed,
  markTaskRunning: () => markTaskRunning,
  markTaskWaitingHuman: () => markTaskWaitingHuman,
  recordRevenue: () => recordRevenue,
  retryTask: () => retryTask,
  setSubscriptionStatusByStripeId: () => setSubscriptionStatusByStripeId,
  updateMissionStatus: () => updateMissionStatus,
  updateServiceOrderStatus: () => updateServiceOrderStatus,
  upsertStripeSubscription: () => upsertStripeSubscription,
  upsertUser: () => upsertUser
});
import { drizzle } from "drizzle-orm/mysql2";
import {
  eq,
  desc,
  and,
  sql,
  gte,
  lte,
  like
} from "drizzle-orm";
import { randomUUID } from "crypto";
function createDb(connectionString) {
  if (!connectionString) {
    throw new Error("[Database] Missing connection string");
  }
  return drizzle(connectionString);
}
async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[Database] DATABASE_URL is not set");
  }
  try {
    _db = createDb(url);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    _db = null;
    throw new Error("[Database] Unable to initialize database connection");
  }
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("[Database] User openId is required for upsert");
  }
  const db2 = await getDb();
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    const value = user[field];
    if (value !== void 0) {
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }
  const now = /* @__PURE__ */ new Date();
  values.lastSignedIn = user.lastSignedIn ?? now;
  updateSet.lastSignedIn = user.lastSignedIn ?? now;
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  const existing = await db2.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
  if (existing.length === 0) {
    await db2.insert(users).values(values);
  } else {
    await db2.update(users).set(updateSet).where(eq(users.openId, user.openId));
  }
}
async function createSystemNotification(userId, type, message) {
  const d = await getDb();
  await d.insert(notifications).values({
    userId,
    type,
    message,
    read: false
  });
}
async function getAllUsers() {
  const d = await getDb();
  return d.select().from(users);
}
async function getBudgetStatus() {
  const d = await getDb();
  const rows = await d.select().from(revenueRecords).orderBy(desc(revenueRecords.createdAt)).limit(1);
  return rows[0] ?? null;
}
async function getRecentActivity(limit = 20) {
  const d = await getDb();
  return d.select().from(activityLog).orderBy(desc(activityLog.timestamp)).limit(limit);
}
async function logActivity(action, details) {
  const d = await getDb();
  await d.insert(activityLog).values({ action, details });
}
async function hasWebhookEventProcessed(eventId) {
  console.warn(`[stripe-stub] hasWebhookEventProcessed(${eventId}) \u2014 returning false (not tracked)`);
  return false;
}
async function upsertStripeSubscription(data) {
  console.warn(`[stripe-stub] upsertStripeSubscription user=${data.userId} plan=${data.plan} status=${data.status} \u2014 not persisted`);
}
async function setSubscriptionStatusByStripeId(stripeSubscriptionId, status, endedAt) {
  console.warn(`[stripe-stub] setSubscriptionStatusByStripeId(${stripeSubscriptionId}, ${status}${endedAt ? `, ended=${endedAt.toISOString()}` : ""}) \u2014 not persisted`);
}
async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId) {
  console.warn(`[stripe-stub] getSubscriptionByStripeSubscriptionId(${stripeSubscriptionId}) \u2014 returning null`);
  return null;
}
async function recordRevenue(data) {
  console.warn(`[stripe-stub] recordRevenue source=${data.source} amount=${data.amount} ${data.currency} \u2014 not persisted`);
}
async function logAutomationAudit(action, details, userId, entityType, entityId) {
  console.warn(`[stripe-stub] logAutomationAudit action=${action}${userId ? ` user=${userId}` : ""}${entityType ? ` ${entityType}/${entityId ?? "?"}` : ""} \u2014 not persisted`);
}
async function enqueueTask(missionId, title, description, order) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missionTasks).values({ id, missionId, title, description, status: "pending", order });
  return id;
}
async function getDueTasks(limit = 10) {
  const d = await getDb();
  return d.select().from(missionTasks).where(eq(missionTasks.status, "pending")).orderBy(missionTasks.order).limit(limit);
}
async function getRunTaskCount() {
  const d = await getDb();
  const rows = await d.select({ count: sql`count(*)` }).from(missionTasks).where(eq(missionTasks.status, "in_progress"));
  return rows[0]?.count ?? 0;
}
async function markTaskRunning(id) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "in_progress" }).where(eq(missionTasks.id, id));
}
async function markTaskDone(id) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "completed" }).where(eq(missionTasks.id, id));
}
async function markTaskFailed(id) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "failed" }).where(eq(missionTasks.id, id));
}
async function markTaskWaitingHuman(id) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "pending" }).where(eq(missionTasks.id, id));
}
async function getActiveMissionTypes() {
  const d = await getDb();
  const rows = await d.select({ title: missions.title }).from(missions).where(eq(missions.status, "active"));
  return rows.map((r) => r.title);
}
async function getAdaptivePriors() {
  const d = await getDb();
  const rows = await d.select().from(activityLog).orderBy(desc(activityLog.timestamp)).limit(50);
  return rows;
}
async function createServiceOrder(data) {
  const d = await getDb();
  const result = await d.insert(serviceOrders).values(data);
  return result;
}
async function getAllServiceOrders() {
  const d = await getDb();
  return d.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
}
async function getServiceOrderById(id) {
  const d = await getDb();
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.id, id));
  return rows[0] ?? null;
}
async function getServiceOrdersByUser(userId) {
  const d = await getDb();
  return d.select().from(serviceOrders).where(eq(serviceOrders.userId, userId));
}
async function updateServiceOrderStatus(id, status) {
  const d = await getDb();
  await d.update(serviceOrders).set({ status }).where(eq(serviceOrders.id, id));
}
async function createProposal(data) {
  const d = await getDb();
  await d.execute(sql`INSERT INTO proposals (data) VALUES (${JSON.stringify(data)})`);
}
async function getWeeklyRevenueDigest() {
  const d = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  return d.select().from(revenueRecords).where(gte(revenueRecords.createdAt, weekAgo));
}
async function hasActionLogged(action, sinceDaysAgo = 1) {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 864e5);
  const rows = await d.select().from(activityLog).where(and(eq(activityLog.action, action), gte(activityLog.timestamp, since))).limit(1);
  return rows.length > 0;
}
async function getQuarterlyValueReport() {
  const d = await getDb();
  const quarterAgo = new Date(Date.now() - 90 * 864e5);
  return d.select().from(revenueRecords).where(gte(revenueRecords.createdAt, quarterAgo));
}
async function listHighScanUsers(minScans = 10) {
  const d = await getDb();
  return d.select().from(users).orderBy(desc(users.lastSignedIn)).limit(50);
}
async function listInactiveUsersNoRecentScans(daysSinceLastScan = 30) {
  const d = await getDb();
  const cutoff = new Date(Date.now() - daysSinceLastScan * 864e5);
  return d.select().from(users).where(lte(users.lastSignedIn, cutoff));
}
async function listUsersForOnboardingStep(step) {
  const d = await getDb();
  return d.select().from(users).orderBy(desc(users.createdAt)).limit(100);
}
async function listPastDueSubscriptions() {
  const d = await getDb();
  return d.select().from(subscriptions).where(eq(subscriptions.status, "past_due"));
}
async function hasDunningStepLogged(subscriptionId, step) {
  const d = await getDb();
  const rows = await d.select().from(activityLog).where(and(
    like(activityLog.action, `dunning:${step}:%`),
    like(activityLog.details ?? sql`''`, `%sub:${subscriptionId}%`)
  )).limit(1);
  return rows.length > 0;
}
async function hasUserActionLogged(userId, action, sinceDaysAgo) {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 864e5);
  const rows = await d.select().from(activityLog).where(and(
    eq(activityLog.action, action),
    gte(activityLog.timestamp, since)
  )).limit(1);
  return rows.length > 0;
}
async function getMissions(statusFilter) {
  const d = await getDb();
  if (statusFilter) {
    return d.select().from(missions).where(eq(missions.status, statusFilter));
  }
  return d.select().from(missions).orderBy(desc(missions.createdAt));
}
async function getMissionById(id) {
  const d = await getDb();
  const rows = await d.select().from(missions).where(eq(missions.id, id));
  return rows[0] ?? null;
}
async function createMission(type) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missions).values({
    id,
    title: type,
    description: `Mission: ${type}`,
    status: "pending"
  });
  return id;
}
async function updateMissionStatus(id, status) {
  const d = await getDb();
  await d.update(missions).set({ status: status.toLowerCase() }).where(eq(missions.id, id));
}
async function getTasksByMission(missionId) {
  const d = await getDb();
  return d.select().from(missionTasks).where(eq(missionTasks.missionId, missionId)).orderBy(missionTasks.order);
}
async function retryTask(id) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "pending" }).where(eq(missionTasks.id, id));
}
var _db, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    init_schema();
    _db = null;
    db = new Proxy({}, {
      get(_target, prop) {
        if (!_db) {
          throw new Error(
            "[Database] Database not available. Call `await getDb()` during startup."
          );
        }
        return Reflect.get(_db, prop);
      }
    });
  }
});

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
var TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, trimValue, isNonEmptyString2, buildEndpointUrl, validatePayload;
var init_notification = __esm({
  "server/_core/notification.ts"() {
    "use strict";
    init_env();
    TITLE_MAX_LENGTH = 1200;
    CONTENT_MAX_LENGTH = 2e4;
    trimValue = (value) => value.trim();
    isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
    buildEndpointUrl = (baseUrl) => {
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      return new URL(
        "webdevtoken.v1.WebDevService/SendNotification",
        normalizedBase
      ).toString();
    };
    validatePayload = (input) => {
      if (!isNonEmptyString2(input.title)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification title is required."
        });
      }
      if (!isNonEmptyString2(input.content)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification content is required."
        });
      }
      const title = trimValue(input.title);
      const content = trimValue(input.content);
      if (title.length > TITLE_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
        });
      }
      if (content.length > CONTENT_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
        });
      }
      return { title, content };
    };
  }
});

// server/stripe-products.ts
var stripe_products_exports = {};
__export(stripe_products_exports, {
  STRIPE_PRODUCTS: () => STRIPE_PRODUCTS,
  getPlanPrice: () => getPlanPrice,
  getPlanQuota: () => getPlanQuota
});
function getPlanPrice(plan, billing) {
  const product = STRIPE_PRODUCTS[plan];
  return billing === "annual" ? product.priceAnnual : product.priceMonthly;
}
function getPlanQuota(plan) {
  switch (plan) {
    case "starter":
      return 500;
    case "professional":
      return 5e3;
    case "enterprise":
      return 999999;
  }
}
var STRIPE_PRODUCTS;
var init_stripe_products = __esm({
  "server/stripe-products.ts"() {
    "use strict";
    STRIPE_PRODUCTS = {
      starter: {
        name: "AuthiChain Starter",
        description: "Essential blockchain authentication for growing brands. 500 verifications/month, AI analysis, QR codes, and basic supply chain tracking.",
        priceMonthly: 4900,
        // $49.00 in cents
        priceAnnual: 47e3,
        // $470.00/year ($39.17/mo, save 20%)
        features: [
          "500 AI authentications/month",
          "QR code generation",
          "Basic certificates",
          "Email support",
          "1 team member"
        ]
      },
      professional: {
        name: "AuthiChain Professional",
        description: "Advanced authentication suite with NFT certificates, autopilot AI, and full supply chain visibility. 5,000 verifications/month.",
        priceMonthly: 19900,
        // $199.00 in cents
        priceAnnual: 190800,
        // $1,908.00/year ($159/mo, save 20%)
        features: [
          "5,000 AI authentications/month",
          "NFT certificate minting",
          "AI Autopilot engine",
          "Supply chain tracking",
          "Email campaigns",
          "Priority support",
          "5 team members"
        ]
      },
      enterprise: {
        name: "AuthiChain Enterprise",
        description: "Full-scale enterprise authentication with white-label solutions, unlimited verifications, dedicated support, and custom integrations.",
        priceMonthly: 79900,
        // $799.00 in cents
        priceAnnual: 766800,
        // $7,668.00/year ($639/mo, save 20%)
        features: [
          "Unlimited AI authentications",
          "White-label solution",
          "Custom smart contracts",
          "Dedicated account manager",
          "SLA guarantee",
          "API access",
          "Unlimited team members",
          "Custom integrations"
        ]
      }
    };
  }
});

// server/stripe-service.ts
var stripe_service_exports = {};
__export(stripe_service_exports, {
  cancelSubscription: () => cancelSubscription,
  createPaymentCheckout: () => createPaymentCheckout,
  createSubscriptionCheckout: () => createSubscriptionCheckout,
  getCustomerInvoices: () => getCustomerInvoices,
  getCustomerPayments: () => getCustomerPayments,
  getOrCreateStripeCustomer: () => getOrCreateStripeCustomer,
  getStripe: () => getStripe,
  getSubscriptionDetails: () => getSubscriptionDetails,
  processWebhookEvent: () => processWebhookEvent
});
import Stripe from "stripe";
function getStripe() {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(secretKey, { apiVersion: "2025-03-31.basil" });
  }
  return _stripe;
}
async function createSubscriptionCheckout(params) {
  const stripe = getStripe();
  const product = STRIPE_PRODUCTS[params.plan];
  const priceAmount = params.billing === "annual" ? product.priceAnnual : product.priceMonthly;
  const sessionConfig = {
    mode: "subscription",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    customer_email: params.stripeCustomerId ? void 0 : params.userEmail,
    customer: params.stripeCustomerId || void 0,
    metadata: {
      user_id: params.userId.toString(),
      customer_email: params.userEmail,
      customer_name: params.userName,
      plan: params.plan,
      billing: params.billing
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description
          },
          unit_amount: priceAmount,
          recurring: {
            interval: params.billing === "annual" ? "year" : "month"
          }
        },
        quantity: 1
      }
    ],
    success_url: `${params.origin}/subscriptions?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${params.origin}/subscriptions?cancelled=true`
  };
  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session.url;
}
async function createPaymentCheckout(params) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    customer_email: params.stripeCustomerId ? void 0 : params.userEmail,
    customer: params.stripeCustomerId || void 0,
    metadata: {
      user_id: params.userId.toString(),
      customer_email: params.userEmail,
      customer_name: params.userName,
      ...params.metadata
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: params.description
          },
          unit_amount: params.amount
        },
        quantity: 1
      }
    ],
    success_url: `${params.origin}/payments?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${params.origin}/payments?cancelled=true`
  });
  return session.url;
}
async function getOrCreateStripeCustomer(userId, email, name, existingCustomerId) {
  const stripe = getStripe();
  if (existingCustomerId) {
    try {
      const customer2 = await stripe.customers.retrieve(existingCustomerId);
      if (!customer2.deleted) return existingCustomerId;
    } catch {
    }
  }
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { user_id: userId.toString() }
  });
  return customer.id;
}
async function getSubscriptionDetails(subscriptionId) {
  const stripe = getStripe();
  return await stripe.subscriptions.retrieve(subscriptionId);
}
async function cancelSubscription(subscriptionId, immediately = false) {
  const stripe = getStripe();
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  });
}
async function getCustomerPayments(customerId, limit = 20) {
  const stripe = getStripe();
  const charges = await stripe.charges.list({
    customer: customerId,
    limit
  });
  return charges.data.map((charge) => ({
    id: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    description: charge.description,
    created: charge.created,
    receiptUrl: charge.receipt_url
  }));
}
async function getCustomerInvoices(customerId, limit = 20) {
  const stripe = getStripe();
  const invoices3 = await stripe.invoices.list({
    customer: customerId,
    limit
  });
  return invoices3.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    amount: inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    created: inv.created,
    hostedInvoiceUrl: inv.hosted_invoice_url,
    pdfUrl: inv.invoice_pdf
  }));
}
async function processWebhookEvent(event) {
  const result = {
    eventType: event.type,
    handled: false
  };
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      result.userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : void 0;
      result.plan = session.metadata?.plan;
      result.subscriptionId = session.subscription;
      result.customerId = session.customer;
      result.email = session.customer_email || session.metadata?.customer_email || void 0;
      result.customerName = session.metadata?.customer_name || void 0;
      result.handled = true;
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      result.subscriptionId = subscription.id;
      result.customerId = subscription.customer;
      result.handled = true;
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      result.subscriptionId = subscription.id;
      result.customerId = subscription.customer;
      result.handled = true;
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      result.customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      result.subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      result.handled = true;
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      result.customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      result.subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      result.handled = true;
      break;
    }
    default:
      result.handled = false;
  }
  return result;
}
var _stripe;
var init_stripe_service = __esm({
  "server/stripe-service.ts"() {
    "use strict";
    init_stripe_products();
    _stripe = null;
  }
});

// server/_core/llm.ts
var llm_exports = {};
__export(llm_exports, {
  invokeLLM: () => invokeLLM
});
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/storage.ts
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
  }
});

// server/_core/imageGeneration.ts
async function generateImage(options) {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || []
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }
  const result = await response.json();
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url
  };
}
var init_imageGeneration = __esm({
  "server/_core/imageGeneration.ts"() {
    "use strict";
    init_storage();
    init_env();
  }
});

// server/character-service.ts
var character_service_exports = {};
__export(character_service_exports, {
  ARCHETYPES: () => ARCHETYPES,
  awardQRON: () => awardQRON,
  createProtocolAgent: () => createProtocolAgent,
  getAgentByUser: () => getAgentByUser,
  getAgentLeaderboard: () => getAgentLeaderboard,
  getAgentRewards: () => getAgentRewards,
  getGenerationStatus: () => getGenerationStatus,
  getNetworkStats: () => getNetworkStats,
  getUserCharacterAssets: () => getUserCharacterAssets,
  getUserGenerations: () => getUserGenerations,
  prepareMint: () => prepareMint,
  rewardAgentForVerification: () => rewardAgentForVerification,
  selectCharacterAsset: () => selectCharacterAsset,
  startCharacterGeneration: () => startCharacterGeneration,
  submitVerificationClaim: () => submitVerificationClaim
});
import { eq as eq5, desc as desc4, sql as sql3, and as and5, count } from "drizzle-orm";
import crypto2 from "crypto";
function buildCharacterPrompt(archetype, context) {
  const arch = ARCHETYPES[archetype];
  const v = arch.visual;
  const brandLine = context?.brand ? `
Brand affiliation: "${context.brand}" \u2014 incorporate subtle brand-aligned elements.` : "";
  const objectLine = context?.object ? `
Guarding/representing: ${context.object}.` : "";
  const colorLine = context?.colorway ? `
Color direction: ${context.colorway}.` : `
Primary color: ${arch.color}, with metallic accents and deep navy/charcoal background.`;
  const moodLine = context?.mood ? `
Mood: ${context.mood}.` : "\nMood: authoritative yet approachable, premium yet accessible.";
  const prompt = `Premium futuristic heraldic concept art of a protocol-grade digital character.

ROLE: ${v.role}
ARMOR/ATTIRE: ${v.armor}
SIGNATURE ELEMENT: ${v.weapon}
AURA: ${v.aura}
SETTING: ${v.environment}
${brandLine}${objectLine}${colorLine}${moodLine}

STYLE REQUIREMENTS:
- Clean vector-inspired digital art with subtle gradients
- Protocol-heraldic aesthetic: blockchain motifs, verification symbols, trust iconography
- Suitable for NFT minting: no text, no watermarks, no borders
- Square 1:1 aspect ratio, high detail, professional quality
- Character should embody trust, verification, and digital authority
- Background: abstract blockchain network pattern with subtle glow effects`;
  const negativePrompt = `text, watermark, signature, logo, border, frame, low quality, blurry, 
deformed, ugly, amateur, cartoon, anime, chibi, pixel art, voxel, 
photorealistic human face, photograph, stock photo, clip art,
violent, gore, nsfw, offensive symbols, real brand logos`;
  return { prompt, negativePrompt };
}
async function startCharacterGeneration(userId, archetype, context) {
  const db2 = await getDb();
  if (!db2) throw new Error("Database not available");
  const { prompt, negativePrompt } = buildCharacterPrompt(archetype, context);
  const [result] = await db2.insert(characterGenerations).values({
    userId,
    archetype,
    style: "premium futuristic heraldic concept art",
    colorway: context?.colorway || null,
    mood: context?.mood || null,
    prompt,
    negativePrompt,
    provider: "built-in",
    providerModel: "image-gen-v1",
    variantCount: 4,
    status: "pending",
    context: context ? JSON.stringify(context) : null
  });
  const generationId = result.insertId;
  generateVariants(generationId, prompt, archetype, userId).catch((err) => {
    console.error(`[CharacterGen] Generation ${generationId} failed:`, err);
  });
  return { generationId, prompt };
}
async function generateVariants(generationId, prompt, archetype, userId) {
  const db2 = await getDb();
  if (!db2) return;
  await db2.update(characterGenerations).set({ status: "generating" }).where(eq5(characterGenerations.id, generationId));
  const variants = [];
  const variations = [
    prompt,
    prompt + "\nEmphasis: power and authority, imposing presence.",
    prompt + "\nEmphasis: elegance and precision, refined details.",
    prompt + "\nEmphasis: dynamic energy and agility, motion lines."
  ];
  for (const variantPrompt of variations) {
    try {
      const result = await generateImage({ prompt: variantPrompt });
      if (result.url) {
        variants.push({ imageUrl: result.url, variantPrompt });
      }
    } catch (err) {
      console.error(`[CharacterGen] Variant generation failed:`, err);
    }
  }
  if (variants.length === 0) {
    await db2.update(characterGenerations).set({ status: "failed" }).where(eq5(characterGenerations.id, generationId));
    return;
  }
  let bestScore = -1;
  let bestAssetId = null;
  for (const variant of variants) {
    const [assetResult] = await db2.insert(characterAssets).values({
      generationId,
      userId,
      imageUrl: variant.imageUrl,
      prompt: variant.variantPrompt,
      mintStatus: "not_minted"
    });
    const assetId = assetResult.insertId;
    try {
      const score = await scoreCharacterAsset(assetId, variant.imageUrl, archetype);
      if (score > bestScore) {
        bestScore = score;
        bestAssetId = assetId;
      }
    } catch (err) {
      console.error(`[CharacterGen] Scoring failed for asset ${assetId}:`, err);
    }
  }
  if (bestAssetId) {
    await db2.update(characterAssets).set({ isRecommended: 1 }).where(eq5(characterAssets.id, bestAssetId));
  }
  await db2.update(characterGenerations).set({
    status: "completed",
    completedAt: /* @__PURE__ */ new Date(),
    bestAssetId
  }).where(eq5(characterGenerations.id, generationId));
}
async function scoreCharacterAsset(assetId, imageUrl, archetype) {
  const db2 = await getDb();
  if (!db2) return 0;
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert digital art evaluator for the AuthiChain protocol.
Score the character avatar on these 7 dimensions (0.0 to 10.0 scale, one decimal):

1. protocol_fit \u2014 Does the character embody the "${archetype}" role within a blockchain authentication protocol?
2. thumbnail_clarity \u2014 Is the character recognizable and impactful at 64\xD764 thumbnail size?
3. premium_feel \u2014 Does the art feel premium, polished, and worth minting as an NFT?
4. silhouette \u2014 Is the silhouette distinctive and instantly recognizable?
5. trust_symbolism \u2014 Does the design incorporate trust, verification, and authority symbols?
6. mint_readiness \u2014 Is the image clean (no artifacts, text, watermarks) and ready for on-chain minting?
7. ui_compatibility \u2014 Will it work well as an avatar in dashboards, leaderboards, and mobile UI?

Return ONLY a JSON object with these exact keys and float scores (e.g., 7.5).`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Score this ${archetype} character avatar for the AuthiChain protocol:` },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "character_score",
          strict: true,
          schema: {
            type: "object",
            properties: {
              protocol_fit: { type: "number" },
              thumbnail_clarity: { type: "number" },
              premium_feel: { type: "number" },
              silhouette: { type: "number" },
              trust_symbolism: { type: "number" },
              mint_readiness: { type: "number" },
              ui_compatibility: { type: "number" }
            },
            required: ["protocol_fit", "thumbnail_clarity", "premium_feel", "silhouette", "trust_symbolism", "mint_readiness", "ui_compatibility"],
            additionalProperties: false
          }
        }
      }
    });
    const content = result.choices[0]?.message?.content;
    const scoreText = typeof content === "string" ? content : "";
    const scores = JSON.parse(scoreText);
    const totalScore = scores.protocol_fit * 0.2 + scores.thumbnail_clarity * 0.15 + scores.premium_feel * 0.2 + scores.silhouette * 0.1 + scores.trust_symbolism * 0.15 + scores.mint_readiness * 0.1 + scores.ui_compatibility * 0.1;
    const roundedTotal = Math.round(totalScore * 100) / 100;
    await db2.update(characterAssets).set({
      protocolFitScore: String(scores.protocol_fit),
      thumbnailClarityScore: String(scores.thumbnail_clarity),
      premiumFeelScore: String(scores.premium_feel),
      silhouetteScore: String(scores.silhouette),
      trustSymbolismScore: String(scores.trust_symbolism),
      mintReadinessScore: String(scores.mint_readiness),
      uiCompatibilityScore: String(scores.ui_compatibility),
      totalScore: String(roundedTotal),
      // Also fill legacy integer scores (0-100 scale) for backward compat
      scoreIconity: Math.round(scores.protocol_fit * 10),
      scoreTrustClarity: Math.round(scores.trust_symbolism * 10),
      scorePremiumFeel: Math.round(scores.premium_feel * 10),
      scoreSilhouette: Math.round(scores.silhouette * 10),
      scoreUiCompat: Math.round(scores.ui_compatibility * 10),
      scoreMintReady: Math.round(scores.mint_readiness * 10),
      scoreProtocolAlign: Math.round(scores.protocol_fit * 10)
    }).where(eq5(characterAssets.id, assetId));
    return roundedTotal;
  } catch (err) {
    console.error(`[CharacterGen] LLM scoring failed for asset ${assetId}:`, err);
    const defaultScore = "7.0";
    await db2.update(characterAssets).set({
      protocolFitScore: defaultScore,
      thumbnailClarityScore: defaultScore,
      premiumFeelScore: defaultScore,
      silhouetteScore: defaultScore,
      trustSymbolismScore: defaultScore,
      mintReadinessScore: defaultScore,
      uiCompatibilityScore: defaultScore,
      totalScore: defaultScore,
      scoreIconity: 70,
      scoreTrustClarity: 70,
      scorePremiumFeel: 70,
      scoreSilhouette: 70,
      scoreUiCompat: 70,
      scoreMintReady: 70,
      scoreProtocolAlign: 70
    }).where(eq5(characterAssets.id, assetId));
    return 7;
  }
}
async function selectCharacterAsset(userId, assetId) {
  const db2 = await getDb();
  if (!db2) throw new Error("Database not available");
  const [asset] = await db2.select().from(characterAssets).innerJoin(characterGenerations, eq5(characterAssets.generationId, characterGenerations.id)).where(and5(eq5(characterAssets.id, assetId), eq5(characterGenerations.userId, userId))).limit(1);
  if (!asset) throw new Error("Asset not found or not owned by user");
  const userGens = await db2.select({ id: characterGenerations.id }).from(characterGenerations).where(eq5(characterGenerations.userId, userId));
  for (const gen of userGens) {
    await db2.update(characterAssets).set({ isSelected: 0 }).where(eq5(characterAssets.generationId, gen.id));
  }
  const arch = ARCHETYPES[asset.character_generations.archetype];
  const metadata = {
    name: `AuthiCharacter #${assetId} \u2014 ${arch?.name || asset.character_generations.archetype}`,
    description: `Protocol ${asset.character_generations.archetype} agent for the AuthiChain verification network. ${arch?.description || ""}`,
    image: asset.character_assets.imageUrl,
    external_url: "https://authichain-gpea3uhe.manus.space",
    attributes: [
      { trait_type: "Archetype", value: arch?.name || asset.character_generations.archetype },
      { trait_type: "Protocol Fit", value: parseFloat(asset.character_assets.protocolFitScore || "0"), display_type: "number" },
      { trait_type: "Thumbnail Clarity", value: parseFloat(asset.character_assets.thumbnailClarityScore || "0"), display_type: "number" },
      { trait_type: "Premium Feel", value: parseFloat(asset.character_assets.premiumFeelScore || "0"), display_type: "number" },
      { trait_type: "Silhouette", value: parseFloat(asset.character_assets.silhouetteScore || "0"), display_type: "number" },
      { trait_type: "Trust Symbolism", value: parseFloat(asset.character_assets.trustSymbolismScore || "0"), display_type: "number" },
      { trait_type: "Mint Readiness", value: parseFloat(asset.character_assets.mintReadinessScore || "0"), display_type: "number" },
      { trait_type: "UI Compatibility", value: parseFloat(asset.character_assets.uiCompatibilityScore || "0"), display_type: "number" },
      { trait_type: "Total Score", value: parseFloat(asset.character_assets.totalScore || "0"), display_type: "number" }
    ],
    protocol: "AuthiChain",
    version: "2.0"
  };
  const metadataJson = JSON.stringify(metadata);
  const metadataHash = crypto2.createHash("sha256").update(metadataJson).digest("hex");
  const imageHash = crypto2.createHash("sha256").update(asset.character_assets.imageUrl).digest("hex");
  const { url: metadataUri } = await storagePut(
    `character-metadata/${assetId}-${metadataHash.slice(0, 8)}.json`,
    Buffer.from(metadataJson),
    "application/json"
  );
  await db2.update(characterAssets).set({
    isSelected: 1,
    selectedAt: /* @__PURE__ */ new Date(),
    metadataUri,
    metadataHash,
    imageHash,
    mintStatus: "preparing"
  }).where(eq5(characterAssets.id, assetId));
  await db2.update(characterGenerations).set({ status: "selected", selectedAssetId: assetId }).where(eq5(characterGenerations.id, asset.character_assets.generationId));
  return { success: true, metadataHash };
}
async function prepareMint(userId, assetId) {
  const db2 = await getDb();
  if (!db2) throw new Error("Database not available");
  const [asset] = await db2.select().from(characterAssets).innerJoin(characterGenerations, eq5(characterAssets.generationId, characterGenerations.id)).where(and5(
    eq5(characterAssets.id, assetId),
    eq5(characterGenerations.userId, userId),
    eq5(characterAssets.isSelected, 1)
  )).limit(1);
  if (!asset) throw new Error("Asset not found, not owned, or not selected");
  if (!asset.character_assets.metadataUri || !asset.character_assets.metadataHash) {
    throw new Error("Asset metadata not prepared \u2014 select the asset first");
  }
  await db2.update(characterAssets).set({ mintStatus: "queued" }).where(eq5(characterAssets.id, assetId));
  await db2.update(characterGenerations).set({ status: "mint_ready" }).where(eq5(characterGenerations.id, asset.character_assets.generationId));
  return {
    success: true,
    metadataUri: asset.character_assets.metadataUri,
    metadataHash: asset.character_assets.metadataHash,
    imageHash: asset.character_assets.imageHash || "",
    imageUrl: asset.character_assets.imageUrl
  };
}
async function createProtocolAgent(userId, characterAssetId, name, agentType) {
  const db2 = await getDb();
  if (!db2) throw new Error("Database not available");
  const arch = ARCHETYPES[agentType];
  const [result] = await db2.insert(protocolAgents).values({
    userId,
    characterAssetId,
    name,
    agentType,
    status: "active",
    level: 1,
    xp: arch.baseXP,
    reputationScore: 100,
    featureScopes: JSON.stringify(arch.featureScopes),
    policyConfig: JSON.stringify({ autoVerify: false, minConfidence: 70 })
  });
  return { agentId: result.insertId };
}
async function getAgentByUser(userId) {
  const db2 = await getDb();
  if (!db2) return null;
  const [agent] = await db2.select().from(protocolAgents).where(and5(eq5(protocolAgents.userId, userId), eq5(protocolAgents.status, "active"))).orderBy(desc4(protocolAgents.createdAt)).limit(1);
  return agent || null;
}
async function getAgentLeaderboard(limit = 20) {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(protocolAgents).where(eq5(protocolAgents.status, "active")).orderBy(desc4(protocolAgents.reputationScore), desc4(protocolAgents.xp)).limit(limit);
}
async function getGenerationStatus(generationId) {
  const db2 = await getDb();
  if (!db2) return null;
  const [gen] = await db2.select().from(characterGenerations).where(eq5(characterGenerations.id, generationId)).limit(1);
  if (!gen) return null;
  const assets = await db2.select().from(characterAssets).where(eq5(characterAssets.generationId, generationId)).orderBy(desc4(characterAssets.totalScore));
  return { ...gen, assets };
}
async function getUserGenerations(userId) {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(characterGenerations).where(eq5(characterGenerations.userId, userId)).orderBy(desc4(characterGenerations.createdAt));
}
async function getUserCharacterAssets(userId) {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select({
    asset: characterAssets,
    generation: characterGenerations
  }).from(characterAssets).innerJoin(characterGenerations, eq5(characterAssets.generationId, characterGenerations.id)).where(eq5(characterGenerations.userId, userId)).orderBy(desc4(characterAssets.totalScore));
}
async function awardQRON(agentId, userId, amount, reason, referenceType, referenceId) {
  const db2 = await getDb();
  if (!db2) return;
  await db2.insert(qronRewardLedger).values({
    agentId,
    userId,
    amount,
    reason,
    referenceType,
    referenceId,
    status: "pending"
  });
  await db2.update(protocolAgents).set({
    qronPending: sql3`${protocolAgents.qronPending} + ${amount}`
  }).where(eq5(protocolAgents.id, agentId));
}
async function getAgentRewards(agentId, limit = 50) {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(qronRewardLedger).where(eq5(qronRewardLedger.agentId, agentId)).orderBy(desc4(qronRewardLedger.createdAt)).limit(limit);
}
async function getNetworkStats() {
  const db2 = await getDb();
  if (!db2) return {
    totalAgents: 0,
    totalVerifications: 0,
    totalConsensus: 0,
    totalQRONDistributed: "0",
    totalCheckpoints: 0,
    agentsByType: [],
    recentActivity: []
  };
  const [agentCount] = await db2.select({ count: count() }).from(protocolAgents);
  const [verifyCount] = await db2.select({ count: count() }).from(verificationClaims);
  const [consensusCount] = await db2.select({ count: count() }).from(consensusResults);
  const [checkpointCount] = await db2.select({ count: count() }).from(checkpointBatches);
  const [qronSum] = await db2.select({
    total: sql3`COALESCE(SUM(${qronRewardLedger.amount}), 0)`
  }).from(qronRewardLedger);
  const agentsByType = await db2.select({
    agentType: protocolAgents.agentType,
    count: count()
  }).from(protocolAgents).where(eq5(protocolAgents.status, "active")).groupBy(protocolAgents.agentType);
  const recentAgents = await db2.select().from(protocolAgents).orderBy(desc4(protocolAgents.createdAt)).limit(10);
  return {
    totalAgents: agentCount?.count || 0,
    totalVerifications: verifyCount?.count || 0,
    totalConsensus: consensusCount?.count || 0,
    totalQRONDistributed: qronSum?.total || "0",
    totalCheckpoints: checkpointCount?.count || 0,
    agentsByType,
    recentActivity: recentAgents
  };
}
async function submitVerificationClaim(agentId, productId, authenticationId, claimType, confidence, evidence, reasoning) {
  const db2 = await getDb();
  if (!db2) throw new Error("Database not available");
  const [agent] = await db2.select().from(protocolAgents).where(eq5(protocolAgents.id, agentId)).limit(1);
  const weight = agent?.reputationScore ? (agent.reputationScore / 100).toFixed(3) : "1.000";
  const [result] = await db2.insert(verificationClaims).values({
    agentId,
    productId,
    authenticationId,
    claimType,
    confidence,
    evidence: evidence ? JSON.stringify(evidence) : null,
    reasoning,
    weight,
    status: "pending"
  });
  await db2.update(protocolAgents).set({
    totalClaims: sql3`${protocolAgents.totalClaims} + 1`,
    xp: sql3`${protocolAgents.xp} + 10`
  }).where(eq5(protocolAgents.id, agentId));
  await awardQRON(agentId, agent?.userId || 0, "0.50", "verification_reward", "claim", result.insertId);
  return { claimId: result.insertId };
}
async function rewardAgentForVerification(userId, wasSuccessful) {
  const db2 = await getDb();
  if (!db2) return;
  const [agent] = await db2.select().from(protocolAgents).where(eq5(protocolAgents.userId, userId)).limit(1);
  if (!agent) return;
  const xpReward = wasSuccessful ? 25 : 10;
  const qronReward = wasSuccessful ? "1.00" : "0.25";
  const updateSet = {
    totalVerifications: sql3`${protocolAgents.totalVerifications} + 1`,
    xp: sql3`${protocolAgents.xp} + ${xpReward}`
  };
  if (wasSuccessful) {
    updateSet.successfulVerifications = sql3`${protocolAgents.successfulVerifications} + 1`;
  }
  await db2.update(protocolAgents).set(updateSet).where(eq5(protocolAgents.id, agent.id));
  await awardQRON(agent.id, userId, qronReward, "verification_reward", "verification", 0);
  console.log(`[Agent XP] User ${userId} agent ${agent.id} earned ${xpReward} XP + ${qronReward} QRON`);
}
var ARCHETYPES;
var init_character_service = __esm({
  "server/character-service.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_imageGeneration();
    init_llm();
    init_storage();
    ARCHETYPES = {
      guardian: {
        name: "Guardian",
        description: "Protects brand integrity and product authenticity",
        color: "#3B82F6",
        baseXP: 100,
        featureScopes: ["verify", "protect", "alert"],
        visual: {
          role: "shield-bearing protector",
          armor: "crystalline blockchain plates with glowing verification sigils",
          weapon: "luminous shield projecting holographic authenticity seals",
          aura: "steady blue-gold radiance of unwavering trust",
          environment: "fortified gateway between physical and digital realms"
        }
      },
      archivist: {
        name: "Archivist",
        description: "Records and preserves provenance data on-chain",
        color: "#8B5CF6",
        baseXP: 80,
        featureScopes: ["record", "archive", "query"],
        visual: {
          role: "ancient scholar of digital provenance",
          armor: "robes woven from data-stream fabric with golden chain links",
          weapon: "floating holographic scrolls containing immutable records",
          aura: "soft violet glow of accumulated knowledge",
          environment: "vast library of crystallized blockchain ledgers"
        }
      },
      sentinel: {
        name: "Sentinel",
        description: "Monitors supply chain integrity in real-time",
        color: "#EF4444",
        baseXP: 120,
        featureScopes: ["monitor", "detect", "respond"],
        visual: {
          role: "vigilant watchtower entity",
          armor: "sensor-mesh plating with pulsing IoT nodes",
          weapon: "radar-like scanning eyes that pierce deception",
          aura: "crimson alert pulses radiating outward",
          environment: "elevated observation post overlooking global supply networks"
        }
      },
      scout: {
        name: "Scout",
        description: "Discovers counterfeits and maps threat networks",
        color: "#10B981",
        baseXP: 90,
        featureScopes: ["scan", "discover", "map"],
        visual: {
          role: "agile reconnaissance operative",
          armor: "stealth-mesh cloak with network mapping trails",
          weapon: "magnifying lens eye revealing hidden patterns",
          aura: "emerald traces of discovered connections",
          environment: "shadowy marketplace where fakes hide among genuine goods"
        }
      },
      arbiter: {
        name: "Arbiter",
        description: "Resolves disputes and renders consensus verdicts",
        color: "#F59E0B",
        baseXP: 150,
        featureScopes: ["judge", "resolve", "settle"],
        visual: {
          role: "judicial figure of absolute fairness",
          armor: "consensus-weave robes with embedded voting nodes",
          weapon: "balanced scales of verification and gavel of finality",
          aura: "golden symmetry of impartial judgment",
          environment: "grand tribunal hall where truth is determined by consensus"
        }
      },
      merchant: {
        name: "Merchant",
        description: "Facilitates authentic commerce and value exchange",
        color: "#EC4899",
        baseXP: 110,
        featureScopes: ["trade", "certify", "price"],
        visual: {
          role: "master trader of verified goods",
          armor: "merchant vestments threaded with smart-contract filigree",
          weapon: "authentication stamp that brands genuine articles",
          aura: "warm rose-gold shimmer of trusted commerce",
          environment: "bustling digital bazaar where every item bears proof of origin"
        }
      },
      explorer: {
        name: "Explorer",
        description: "Charts new authentication frontiers and protocols",
        color: "#06B6D4",
        baseXP: 95,
        featureScopes: ["discover", "pioneer", "integrate"],
        visual: {
          role: "frontier pathfinder of new verification domains",
          armor: "adaptive exploration suit with multi-protocol interfaces",
          weapon: "compass that points toward undiscovered authentication methods",
          aura: "cyan trails of newly charted protocol paths",
          environment: "edge of the known verification network, peering into unexplored chains"
        }
      }
    };
  }
});

// server/paddle-service.ts
var paddle_service_exports = {};
__export(paddle_service_exports, {
  cancelPaddleSubscription: () => cancelPaddleSubscription,
  createPaddleTransaction: () => createPaddleTransaction,
  getPaddle: () => getPaddle,
  upsertPaddleCustomer: () => upsertPaddleCustomer,
  verifyPaddleWebhook: () => verifyPaddleWebhook
});
async function getPaddleSDK() {
  const sdk2 = await import("@paddle/paddle-node-sdk");
  return sdk2;
}
async function getPaddle() {
  if (!_paddle) {
    if (!ENV.paddleApiKey) throw new Error("PADDLE_API_KEY is not configured");
    const { Paddle, Environment } = await getPaddleSDK();
    _paddle = new Paddle(ENV.paddleApiKey, {
      environment: ENV.isProduction ? Environment.production : Environment.sandbox
    });
  }
  return _paddle;
}
async function upsertPaddleCustomer(input) {
  const paddle = await getPaddle();
  const customers = await paddle.customers.list({ email: [input.email] });
  const existing = customers.data?.[0];
  if (existing) return existing.id;
  const customer = await paddle.customers.create({
    email: input.email,
    name: input.name,
    customData: { userId: String(input.userId) }
  });
  return customer.id;
}
async function createPaddleTransaction(input) {
  const paddle = await getPaddle();
  const transaction = await paddle.transactions.create({
    items: [{ priceId: input.priceId, quantity: 1 }],
    customerId: input.customerId,
    checkout: { url: input.successUrl }
  });
  return transaction.checkout?.url || "";
}
async function cancelPaddleSubscription(subscriptionId) {
  const paddle = await getPaddle();
  await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: "next_billing_period" });
}
async function verifyPaddleWebhook(rawBody, signature) {
  if (!ENV.paddleWebhookSecret) return false;
  try {
    const paddle = await getPaddle();
    const event = await paddle.webhooks.unmarshal(rawBody, ENV.paddleWebhookSecret, signature);
    return !!event;
  } catch {
    return false;
  }
}
var _paddle;
var init_paddle_service = __esm({
  "server/paddle-service.ts"() {
    "use strict";
    init_env();
    _paddle = null;
  }
});

// server/hubspot-service.ts
var hubspot_service_exports = {};
__export(hubspot_service_exports, {
  createCompany: () => createCompany,
  createContact: () => createContact,
  createDeal: () => createDeal,
  getCRMStats: () => getCRMStats,
  isHubSpotConfigured: () => isHubSpotConfigured,
  listCompanies: () => listCompanies,
  listContacts: () => listContacts,
  listDeals: () => listDeals,
  searchContacts: () => searchContacts,
  syncLeadToHubSpot: () => syncLeadToHubSpot,
  syncPaymentToHubSpot: () => syncPaymentToHubSpot
});
import { Client } from "@hubspot/api-client";
function getClient() {
  if (!_client) {
    if (!ENV.hubspotServiceKey) throw new Error("HUBSPOT_SERVICE_KEY is not configured");
    _client = new Client({ accessToken: ENV.hubspotServiceKey });
  }
  return _client;
}
function isHubSpotConfigured() {
  return !!ENV.hubspotServiceKey;
}
async function listContacts(limit = 50) {
  const client = getClient();
  try {
    const response = await client.crm.contacts.basicApi.getPage(
      limit,
      void 0,
      ["firstname", "lastname", "email", "phone", "company", "hs_lead_status", "createdate", "lastmodifieddate"]
    );
    return response.results.map((c) => ({ id: c.id, ...c.properties }));
  } catch (err) {
    console.error("[HubSpot] List contacts error:", err.message || err);
    return [];
  }
}
async function searchContacts(query) {
  const client = getClient();
  try {
    const response = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [],
      sorts: [],
      query,
      properties: ["firstname", "lastname", "email", "phone", "company", "hs_lead_status"],
      limit: 20,
      after: "0"
    });
    return response.results.map((c) => ({ id: c.id, ...c.properties }));
  } catch (err) {
    console.error("[HubSpot] Search contacts error:", err.message || err);
    return [];
  }
}
async function createContact(data) {
  const client = getClient();
  try {
    const response = await client.crm.contacts.basicApi.create({
      properties: { ...data },
      associations: []
    });
    return { success: true, id: response.id, properties: response.properties };
  } catch (err) {
    console.error("[HubSpot] Create contact error:", err.message || err);
    return { success: false, error: err.message || "Failed to create contact" };
  }
}
async function listCompanies(limit = 50) {
  const client = getClient();
  try {
    const response = await client.crm.companies.basicApi.getPage(
      limit,
      void 0,
      ["name", "domain", "industry", "description", "createdate"]
    );
    return response.results.map((c) => ({ id: c.id, ...c.properties }));
  } catch (err) {
    console.error("[HubSpot] List companies error:", err.message || err);
    return [];
  }
}
async function createCompany(data) {
  const client = getClient();
  try {
    const response = await client.crm.companies.basicApi.create({
      properties: { ...data },
      associations: []
    });
    return { success: true, id: response.id, properties: response.properties };
  } catch (err) {
    console.error("[HubSpot] Create company error:", err.message || err);
    return { success: false, error: err.message || "Failed to create company" };
  }
}
async function createDeal(data) {
  const client = getClient();
  try {
    const response = await client.crm.deals.basicApi.create({
      properties: { ...data },
      associations: []
    });
    return { success: true, id: response.id, properties: response.properties };
  } catch (err) {
    console.error("[HubSpot] Create deal error:", err.message || err);
    return { success: false, error: err.message || "Failed to create deal" };
  }
}
async function listDeals(limit = 50) {
  const client = getClient();
  try {
    const response = await client.crm.deals.basicApi.getPage(
      limit,
      void 0,
      ["dealname", "amount", "dealstage", "pipeline", "createdate", "closedate", "hs_lastmodifieddate"]
    );
    return response.results.map((d) => ({ id: d.id, ...d.properties }));
  } catch (err) {
    console.error("[HubSpot] List deals error:", err.message || err);
    return [];
  }
}
async function getCRMStats() {
  try {
    const client = getClient();
    let contactCount = 0, companyCount = 0, dealCount = 0;
    let isConnected = false;
    const missingScopes = [];
    try {
      const contactSearch = await client.crm.contacts.searchApi.doSearch({
        filterGroups: [],
        sorts: [],
        properties: ["email"],
        limit: 1,
        after: "0"
      });
      contactCount = contactSearch.total;
      isConnected = true;
    } catch (err) {
      if (err.code === 403 || err.body?.category === "MISSING_SCOPES") missingScopes.push("contacts");
      else throw err;
    }
    try {
      const companySearch = await client.crm.companies.searchApi.doSearch({
        filterGroups: [],
        sorts: [],
        properties: ["name"],
        limit: 1,
        after: "0"
      });
      companyCount = companySearch.total;
      isConnected = true;
    } catch (err) {
      if (err.code === 403 || err.body?.category === "MISSING_SCOPES") missingScopes.push("companies");
    }
    try {
      const dealSearch = await client.crm.deals.searchApi.doSearch({
        filterGroups: [],
        sorts: [],
        properties: ["dealname"],
        limit: 1,
        after: "0"
      });
      dealCount = dealSearch.total;
      isConnected = true;
    } catch (err) {
      if (err.code === 403 || err.body?.category === "MISSING_SCOPES") missingScopes.push("deals");
    }
    return {
      contacts: contactCount,
      companies: companyCount,
      deals: dealCount,
      connected: isConnected,
      missingScopes: missingScopes.length > 0 ? missingScopes : void 0
    };
  } catch (err) {
    console.error("[HubSpot] Get CRM stats error:", err.message || err);
    return { contacts: 0, companies: 0, deals: 0, connected: false, error: err.message };
  }
}
async function syncLeadToHubSpot(lead) {
  if (!isHubSpotConfigured()) return null;
  try {
    const [firstname, ...rest] = (lead.name || "").split(" ");
    const lastname = rest.join(" ");
    const result = await createContact({
      email: lead.email,
      firstname: firstname || void 0,
      lastname: lastname || void 0,
      company: lead.company || void 0
    });
    console.log("[HubSpot] Lead synced:", result.success ? result.id : result.error);
    return result;
  } catch (err) {
    console.error("[HubSpot] Lead sync failed:", err.message);
    return null;
  }
}
async function syncPaymentToHubSpot(payment) {
  if (!isHubSpotConfigured()) return null;
  try {
    const result = await createDeal({
      dealname: `AuthiChain ${payment.plan} - ${payment.email}`,
      amount: payment.amount.toString(),
      dealstage: "closedwon",
      closedate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    });
    console.log("[HubSpot] Payment synced as deal:", result.success ? result.id : result.error);
    return result;
  } catch (err) {
    console.error("[HubSpot] Payment sync failed:", err.message);
    return null;
  }
}
var _client;
var init_hubspot_service = __esm({
  "server/hubspot-service.ts"() {
    "use strict";
    init_env();
    _client = null;
  }
});

// server/thirdweb.ts
var thirdweb_exports = {};
__export(thirdweb_exports, {
  CHAINS: () => CHAINS,
  buildAuthCertificateMetadata: () => buildAuthCertificateMetadata,
  buildSupplyChainMetadata: () => buildSupplyChainMetadata,
  checkThirdwebConnection: () => checkThirdwebConnection,
  getAuthiChainContract: () => getAuthiChainContract,
  getContractTotalSupply: () => getContractTotalSupply,
  getDefaultChain: () => getDefaultChain,
  getNFTBalance: () => getNFTBalance,
  getThirdwebClient: () => getThirdwebClient,
  getWalletNFTs: () => getWalletNFTs,
  mintAuthenticationNFT: () => mintAuthenticationNFT,
  uploadImageToIPFS: () => uploadImageToIPFS,
  uploadMetadataToIPFS: () => uploadMetadataToIPFS,
  uploadToIPFS: () => uploadToIPFS
});
import { createThirdwebClient, getContract, defineChain } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { mintTo, balanceOf, totalSupply, getOwnedNFTs } from "thirdweb/extensions/erc721";
import { upload } from "thirdweb/storage";
import { sendTransaction } from "thirdweb";
function getThirdwebClient() {
  if (!_client2) {
    const secretKey = ENV.thirdwebSecretKey;
    if (!secretKey) {
      throw new Error("Thirdweb secret key not configured. Set thirdweb_api_key env var.");
    }
    _client2 = createThirdwebClient({ secretKey });
  }
  return _client2;
}
function getDefaultChain() {
  return ENV.isProduction ? CHAINS.polygon : CHAINS.polygonAmoy;
}
function getAuthiChainContract(config) {
  const client = getThirdwebClient();
  const chain = config.chainId ? defineChain(config.chainId) : getDefaultChain();
  return getContract({
    client,
    chain,
    address: config.address
  });
}
async function uploadToIPFS(data) {
  const client = getThirdwebClient();
  const fileToUpload = typeof data === "string" ? new File([data], "data.json", { type: "application/json" }) : data;
  const uri = await upload({ client, files: [fileToUpload] });
  return typeof uri === "string" ? uri : uri[0];
}
async function uploadImageToIPFS(imageBuffer, filename) {
  const client = getThirdwebClient();
  const uint8 = new Uint8Array(imageBuffer);
  const file = new File([uint8], filename, { type: "image/png" });
  const uri = await upload({ client, files: [file] });
  return typeof uri === "string" ? uri : uri[0];
}
async function uploadMetadataToIPFS(metadata) {
  const client = getThirdwebClient();
  const jsonStr = JSON.stringify(metadata);
  const file = new File([jsonStr], "metadata.json", { type: "application/json" });
  const uri = await upload({ client, files: [file] });
  return typeof uri === "string" ? uri : uri[0];
}
async function mintAuthenticationNFT(params) {
  const client = getThirdwebClient();
  const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: params.contractAddress });
  const account = privateKeyToAccount({ client, privateKey: params.privateKey });
  const metadataUri = await uploadMetadataToIPFS(params.metadata);
  const transaction = mintTo({
    contract,
    to: params.recipientAddress,
    nft: {
      name: params.metadata.name,
      description: params.metadata.description,
      image: params.metadata.image,
      external_url: params.metadata.external_url,
      attributes: params.metadata.attributes,
      properties: params.metadata.properties
    }
  });
  const result = await sendTransaction({ transaction, account });
  return {
    transactionHash: result.transactionHash,
    metadataUri,
    chain: chain.id
  };
}
async function getNFTBalance(contractAddress, walletAddress, chainId) {
  const client = getThirdwebClient();
  const chain = chainId ? defineChain(chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: contractAddress });
  const balance = await balanceOf({ contract, owner: walletAddress });
  return balance.toString();
}
async function getContractTotalSupply(contractAddress, chainId) {
  const client = getThirdwebClient();
  const chain = chainId ? defineChain(chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: contractAddress });
  const supply = await totalSupply({ contract });
  return supply.toString();
}
async function getWalletNFTs(contractAddress, walletAddress, chainId) {
  const client = getThirdwebClient();
  const chain = chainId ? defineChain(chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: contractAddress });
  const nfts3 = await getOwnedNFTs({ contract, owner: walletAddress });
  return nfts3;
}
function buildAuthCertificateMetadata(data) {
  return {
    name: `AuthiChain Certificate: ${data.productName}`,
    description: `Blockchain-verified authentication certificate for ${data.productBrand ? data.productBrand + " " : ""}${data.productName}. Verified with ${data.confidenceScore}% confidence by AuthiChain AI on ${data.verificationDate}.`,
    image: data.imageUrl,
    external_url: `https://authichain.com/certificate/${data.certificateNumber}`,
    attributes: [
      { trait_type: "Product", value: data.productName },
      ...data.productBrand ? [{ trait_type: "Brand", value: data.productBrand }] : [],
      ...data.productSerial ? [{ trait_type: "Serial Number", value: data.productSerial }] : [],
      { trait_type: "Confidence Score", value: data.confidenceScore },
      { trait_type: "Verification Date", value: data.verificationDate },
      { trait_type: "Certificate Number", value: data.certificateNumber },
      { trait_type: "Verification Method", value: "AI Image Analysis + Blockchain" },
      { trait_type: "Platform", value: "AuthiChain" }
    ],
    properties: {
      authichain_version: "2.0",
      verification_engine: "AuthiChain AI v2"
    },
    authichain_certificate: data.certificateNumber,
    authichain_product_id: data.authenticatorId,
    authichain_confidence_score: data.confidenceScore,
    authichain_verification_date: data.verificationDate
  };
}
function buildSupplyChainMetadata(data) {
  return {
    name: `Supply Chain Event: ${data.eventType} - ${data.productName}`,
    description: `Supply chain verification event for ${data.productName}. Event: ${data.eventType} at ${data.location} by ${data.handler}.`,
    attributes: [
      { trait_type: "Event Type", value: data.eventType },
      { trait_type: "Location", value: data.location },
      { trait_type: "Handler", value: data.handler },
      { trait_type: "Timestamp", value: data.timestamp },
      ...data.previousHash ? [{ trait_type: "Previous Hash", value: data.previousHash }] : [],
      { trait_type: "Platform", value: "AuthiChain" }
    ]
  };
}
async function checkThirdwebConnection() {
  try {
    const client = getThirdwebClient();
    const chain = getDefaultChain();
    return {
      connected: true,
      clientId: ENV.thirdwebClientId || "configured",
      chain: ENV.isProduction ? "Polygon Mainnet (137)" : "Polygon Amoy Testnet (80002)"
    };
  } catch (error) {
    return {
      connected: false,
      clientId: "",
      chain: "",
      error: error.message
    };
  }
}
var _client2, CHAINS;
var init_thirdweb = __esm({
  "server/thirdweb.ts"() {
    "use strict";
    init_env();
    _client2 = null;
    CHAINS = {
      polygon: defineChain(137),
      polygonAmoy: defineChain(80002),
      ethereum: defineChain(1),
      sepolia: defineChain(11155111),
      base: defineChain(8453),
      baseSepolia: defineChain(84532)
    };
  }
});

// server/jobs/budget-monitor.ts
import "dotenv/config";
import { pathToFileURL } from "node:url";
function alertAction(metric, threshold, periodKey) {
  return `budget_alert_${metric}_${threshold}_${periodKey}`;
}
async function alreadyAlerted(action) {
  const recent = await getRecentActivity(2e3);
  return recent.some((a) => a.action === action);
}
async function notifyAdmins(title, message, details) {
  const admins = (await getAllUsers()).filter((u) => u.role === "admin");
  for (const admin of admins) {
    await createSystemNotification(admin.id, title, message, "alert", "/admin");
    await logActivity({
      userId: admin.id,
      action: "budget_alert_dispatched",
      entityType: "budget",
      entityId: admin.id,
      details
    });
  }
  return admins.length;
}
async function runBudgetMonitor() {
  const status = await getBudgetStatus();
  let alerts = 0;
  let recipients = 0;
  const checks = [
    { metric: "llm", pct: status.llm.pct, period: status.period.month },
    { metric: "ads", pct: status.ads.pct, period: status.period.day },
    { metric: "enrichment", pct: status.enrichment.pct, period: status.period.month }
  ];
  for (const c of checks) {
    for (const t2 of [90, 70]) {
      if (c.pct < t2) continue;
      const action = alertAction(c.metric, t2, c.period);
      if (await alreadyAlerted(action)) continue;
      const count3 = await notifyAdmins(
        `Budget Alert: ${c.metric.toUpperCase()} ${t2}%`,
        `${c.metric} spend reached ${c.pct}% for period ${c.period}.`,
        { metric: c.metric, threshold: t2, pct: c.pct, period: c.period }
      );
      await logActivity({
        userId: null,
        action,
        entityType: "budget",
        entityId: 0,
        details: { metric: c.metric, threshold: t2, pct: c.pct, period: c.period }
      });
      alerts++;
      recipients += count3;
      break;
    }
  }
  return { status, alerts, recipients };
}
var isMain;
var init_budget_monitor = __esm({
  "server/jobs/budget-monitor.ts"() {
    "use strict";
    init_db();
    isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
    if (isMain) {
      runBudgetMonitor().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Budget monitor failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/jobs/dunning.ts
import "dotenv/config";
import { pathToFileURL as pathToFileURL2 } from "node:url";
function daysSince(date) {
  if (!date) return 0;
  const then = new Date(date).getTime();
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1e3));
}
async function runStep(subscription, step, message) {
  const alreadyLogged = await hasDunningStepLogged(subscription.id, step);
  if (alreadyLogged) return false;
  await createSystemNotification(
    subscription.userId,
    "Billing Reminder",
    message,
    "alert",
    "/subscriptions"
  );
  await logActivity({
    userId: subscription.userId,
    action: `billing_dunning_${step}`,
    entityType: "subscription",
    entityId: subscription.id,
    details: {
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status
    }
  });
  return true;
}
async function runDunningEscalation() {
  const pastDue = await listPastDueSubscriptions();
  let sent = 0;
  for (const sub of pastDue) {
    const ageDays = daysSince(sub.updatedAt || sub.currentPeriodEnd || sub.createdAt);
    if (ageDays >= 14) {
      const didSend = await runStep(
        sub,
        "day_14",
        "Final billing reminder: update payment details to avoid service downgrade."
      );
      if (didSend) sent++;
      continue;
    }
    if (ageDays >= 7) {
      const didSend = await runStep(
        sub,
        "day_7",
        "Billing reminder: payment is still overdue. Please update billing details."
      );
      if (didSend) sent++;
      continue;
    }
    if (ageDays >= 3) {
      const didSend = await runStep(
        sub,
        "day_3",
        "Billing reminder: we could not process your payment. Please update your card."
      );
      if (didSend) sent++;
    }
  }
  return { checked: pastDue.length, remindersSent: sent };
}
var isMain2;
var init_dunning = __esm({
  "server/jobs/dunning.ts"() {
    "use strict";
    init_db();
    isMain2 = !!process.argv[1] && import.meta.url === pathToFileURL2(process.argv[1]).href;
    if (isMain2) {
      runDunningEscalation().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Dunning job failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/jobs/retention.ts
import "dotenv/config";
import { pathToFileURL as pathToFileURL3 } from "node:url";
async function sendOnboarding(step, message) {
  const users2 = await listUsersForOnboardingStep(step);
  let sent = 0;
  for (const u of users2) {
    const action = `retention_onboarding_day_${step}`;
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(u.id, "Onboarding Tip", message, "system", "/dashboard");
    await logActivity({
      userId: u.id,
      action,
      entityType: "retention",
      entityId: u.id,
      details: { step }
    });
    sent++;
  }
  return { checked: users2.length, sent };
}
async function sendNoScanNudges() {
  const users2 = await listInactiveUsersNoRecentScans(7);
  let sent = 0;
  for (const u of users2) {
    const action = "retention_no_scans_7d_nudge";
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(
      u.id,
      "Activation Nudge",
      "No scans detected in 7 days. Publish a QR portal to reactivate usage.",
      "alert",
      "/qrcodes"
    );
    await logActivity({
      userId: u.id,
      action,
      entityType: "retention",
      entityId: u.id,
      details: { daysWithoutScans: 7 }
    });
    sent++;
  }
  return { checked: users2.length, sent };
}
async function sendUpsellPrompts() {
  const users2 = await listHighScanUsers(100);
  let sent = 0;
  for (const u of users2) {
    const action = "retention_high_scan_upsell_prompt";
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(
      u.id,
      "Usage Milestone",
      "High scan volume detected. Consider upgrading for higher limits and advanced analytics.",
      "subscription",
      "/subscriptions"
    );
    await logActivity({
      userId: u.id,
      action,
      entityType: "retention",
      entityId: u.id,
      details: { threshold: 100 }
    });
    sent++;
  }
  return { checked: users2.length, sent };
}
async function runRetentionAutomation() {
  const d0 = await sendOnboarding(0, "Welcome. Complete your activation checklist to go live faster.");
  const d2 = await sendOnboarding(2, "Day 2 tip: connect CRM and Stripe to unlock autonomous revenue workflows.");
  const d5 = await sendOnboarding(5, "Day 5 tip: optimize lead routing by segment and improve conversion quality.");
  const d10 = await sendOnboarding(10, "Day 10 tip: review churn and retention triggers to increase LTV.");
  const noScans = await sendNoScanNudges();
  const upsell = await sendUpsellPrompts();
  return {
    onboarding: { day0: d0, day2: d2, day5: d5, day10: d10 },
    triggers: { noScans7d: noScans, highScanUpsell: upsell }
  };
}
var isMain3;
var init_retention = __esm({
  "server/jobs/retention.ts"() {
    "use strict";
    init_db();
    isMain3 = !!process.argv[1] && import.meta.url === pathToFileURL3(process.argv[1]).href;
    if (isMain3) {
      runRetentionAutomation().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Retention job failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/jobs/weekly-digest.ts
import "dotenv/config";
import { pathToFileURL as pathToFileURL4 } from "node:url";
async function runWeeklyDigestDispatch() {
  const now = /* @__PURE__ */ new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1e3));
  const weekNum = Math.floor(dayOfYear / 7) + 1;
  const periodKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  const periodAction = `report_generated_weekly_kpi_digest_${periodKey}`;
  if (await hasActionLogged(periodAction)) {
    return { admins: 0, delivered: 0, skipped: true, periodKey };
  }
  const digest = await getWeeklyRevenueDigest();
  const users2 = await getAllUsers();
  const admins = users2.filter((u) => u.role === "admin");
  const message = [
    `Leads: ${digest.leads}`,
    `MQL->SQL: ${digest.mqlToSql}`,
    `Demos booked: ${digest.demosBooked}`,
    `Trial->Paid: ${digest.trialToPaid}`,
    `Churn: ${digest.churn}`,
    `MRR: ${digest.mrr}`,
    `ARPA: ${digest.arpa}`
  ].join(" | ");
  let delivered = 0;
  for (const admin of admins) {
    await createSystemNotification(admin.id, "Weekly KPI Digest", message, "system", "/admin");
    await logActivity({
      userId: admin.id,
      action: periodAction,
      entityType: "reporting",
      entityId: admin.id,
      details: { periodKey, digest }
    });
    delivered++;
  }
  return { admins: admins.length, delivered, periodKey, digest };
}
var isMain4;
var init_weekly_digest = __esm({
  "server/jobs/weekly-digest.ts"() {
    "use strict";
    init_db();
    isMain4 = !!process.argv[1] && import.meta.url === pathToFileURL4(process.argv[1]).href;
    if (isMain4) {
      runWeeklyDigestDispatch().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Weekly digest job failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/jobs/quarterly-value.ts
import "dotenv/config";
import { pathToFileURL as pathToFileURL5 } from "node:url";
async function runQuarterlyValueReportDispatch() {
  const report = await getQuarterlyValueReport();
  const periodAction = `report_generated_quarterly_value_${report.period}`;
  if (await hasActionLogged(periodAction)) {
    return { admins: 0, delivered: 0, skipped: true, period: report.period };
  }
  const users2 = await getAllUsers();
  const admins = users2.filter((u) => u.role === "admin");
  let delivered = 0;
  for (const admin of admins) {
    await createSystemNotification(
      admin.id,
      "Quarterly Value Report",
      report.roiSummary,
      "system",
      "/admin"
    );
    await logActivity({
      userId: admin.id,
      action: periodAction,
      entityType: "reporting",
      entityId: admin.id,
      details: report
    });
    delivered++;
  }
  return { admins: admins.length, delivered, period: report.period, report };
}
var isMain5;
var init_quarterly_value = __esm({
  "server/jobs/quarterly-value.ts"() {
    "use strict";
    init_db();
    isMain5 = !!process.argv[1] && import.meta.url === pathToFileURL5(process.argv[1]).href;
    if (isMain5) {
      runQuarterlyValueReportDispatch().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Quarterly value job failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/jobs/organic-traffic.ts
import "dotenv/config";
import { pathToFileURL as pathToFileURL6 } from "node:url";
function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function buildFallbackPlan() {
  const output = [];
  for (const bucket of DEFAULT_TOPICS) {
    for (const topic of bucket.topics) {
      output.push({
        segment: bucket.segment,
        channel: "blog",
        topic,
        title: `AuthiChain Guide: ${topic}`,
        slug: slugify(`${bucket.segment}-${topic}`),
        keywords: ["qr conversion", bucket.segment, "attribution", "checkout automation"],
        cta: "Book a demo",
        publishWindowDays: 7
      });
    }
  }
  return output;
}
async function buildLlmPlan() {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a B2B growth lead for AuthiChain. Generate practical organic traffic content plan items that map to lead capture, qualification, outreach, and checkout."
      },
      {
        role: "user",
        content: "Return 9 items (3 each for restaurants/events/ecommerce). Include channel, topic, title, slug, keywords, CTA, and publish window days."
      }
    ],
    outputSchema: {
      name: "organic_content_plan",
      strict: true,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                segment: { type: "string" },
                channel: { type: "string", enum: ["blog", "email", "linkedin"] },
                topic: { type: "string" },
                title: { type: "string" },
                slug: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                cta: { type: "string" },
                publishWindowDays: { type: "integer" }
              },
              required: [
                "segment",
                "channel",
                "topic",
                "title",
                "slug",
                "keywords",
                "cta",
                "publishWindowDays"
              ],
              additionalProperties: false
            }
          }
        },
        required: ["items"],
        additionalProperties: false
      }
    }
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items.map((item) => ({
    segment: String(item.segment || "unknown"),
    channel: item.channel === "email" || item.channel === "linkedin" ? item.channel : "blog",
    topic: String(item.topic || "Untitled"),
    title: String(item.title || "Untitled"),
    slug: slugify(String(item.slug || item.title || item.topic || "untitled")),
    keywords: Array.isArray(item.keywords) ? item.keywords.map((x) => String(x)) : [],
    cta: String(item.cta || "Book a demo"),
    publishWindowDays: Number.isFinite(Number(item.publishWindowDays)) ? Math.max(1, Math.min(30, Number(item.publishWindowDays))) : 7
  }));
}
async function emitAnalyticsEvents(itemCount) {
  const posthogKey = process.env.POSTHOG_PROJECT_KEY || process.env.VITE_POSTHOG_KEY || "";
  const posthogHost = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  if (posthogKey) {
    await fetch(`${posthogHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event: "organic_content_plan_generated",
        distinct_id: "agentz-organic",
        properties: { source: "authichain-unified", itemCount }
      })
    }).catch(() => null);
  }
  const measurementId = process.env.GA4_MEASUREMENT_ID || "";
  const apiSecret = process.env.GA4_API_SECRET || "";
  if (measurementId && apiSecret) {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "agentz.1",
        events: [{ name: "organic_content_plan_generated", params: { item_count: itemCount } }]
      })
    }).catch(() => null);
  }
}
async function runOrganicTrafficAutomation() {
  let items = buildFallbackPlan();
  let generatedBy = "template";
  if (process.env.BUILT_IN_FORGE_API_KEY) {
    try {
      const llmItems = await buildLlmPlan();
      if (llmItems.length > 0) {
        items = llmItems;
        generatedBy = "llm";
      }
    } catch {
    }
  }
  await emitAnalyticsEvents(items.length);
  const payload = {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    generatedBy,
    itemCount: items.length,
    items
  };
  await logActivity({
    userId: null,
    action: "organic_content_plan_generated",
    entityType: "marketing",
    entityId: 0,
    details: payload
  });
  return payload;
}
var DEFAULT_TOPICS, isMain6;
var init_organic_traffic = __esm({
  "server/jobs/organic-traffic.ts"() {
    "use strict";
    init_llm();
    init_db();
    DEFAULT_TOPICS = [
      {
        segment: "restaurants",
        topics: [
          "QR-driven table conversion optimization",
          "Menu scan-to-order attribution setup",
          "Reducing no-show risk with demo-ready QR flows"
        ]
      },
      {
        segment: "events",
        topics: [
          "Venue QR funnels from scan to paid access",
          "Sponsor ROI reporting with location-level scans",
          "Launch-week checklist for event conversion flows"
        ]
      },
      {
        segment: "ecommerce",
        topics: [
          "Scan-to-checkout attribution for product packaging",
          "Recovering abandoned checkout after QR intent",
          "Retention loops after first scan conversion"
        ]
      }
    ];
    isMain6 = !!process.argv[1] && import.meta.url === pathToFileURL6(process.argv[1]).href;
    if (isMain6) {
      runOrganicTrafficAutomation().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Organic traffic automation failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/_core/bayesian.ts
function _gammaGT(shape) {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (; ; ) {
    let x, v;
    do {
      x = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function _sampleGamma(shape) {
  if (shape < 1) return _gammaGT(1 + shape) * Math.pow(Math.random(), 1 / shape);
  return _gammaGT(shape);
}
function sampleBeta(alpha, beta) {
  const g1 = _sampleGamma(alpha);
  const g2 = _sampleGamma(beta);
  return g1 / (g1 + g2);
}
function betaMean({ alpha, beta }) {
  return alpha / (alpha + beta);
}
function betaVariance({ alpha, beta }) {
  const n = alpha + beta;
  return alpha * beta / (n * n * (n + 1));
}
function betaCI(prior) {
  const mu = betaMean(prior);
  const sd = Math.sqrt(betaVariance(prior));
  return [Math.max(0, mu - 1.96 * sd), Math.min(1, mu + 1.96 * sd)];
}
function thompsonSample(arms) {
  let best = arms[0];
  let bestSample = -Infinity;
  for (const arm of arms) {
    const s = sampleBeta(arm.prior.alpha, arm.prior.beta);
    if (s > bestSample) {
      bestSample = s;
      best = arm;
    }
  }
  return best.id;
}
function selectTone(segment) {
  const toneMap = TONE_PRIORS[segment] ?? DEFAULT_TONE_PRIORS;
  const arms = Object.entries(toneMap).map(([id, prior]) => ({ id, prior }));
  return thompsonSample(arms);
}
function ucb1Score(prior, totalTasks) {
  const n = prior.alpha + prior.beta - 2;
  if (n <= 0) return Infinity;
  return betaMean(prior) + Math.sqrt(2 * Math.log(Math.max(1, totalTasks)) / n);
}
function bayesianPreamble(opts) {
  const { segment, tone, conversionEstimate, ci, evidence = [] } = opts;
  const pct2 = (v) => `${(v * 100).toFixed(1)}%`;
  return `[BAYESIAN REASONING]
Prior: ${segment} segment has an estimated ${pct2(conversionEstimate)} reply rate (95% CI: ${pct2(ci[0])}\u2013${pct2(ci[1])}).
Selected tone: ${tone.toUpperCase()} (Thompson-sampled from posterior).
Evidence signals: ${evidence.length ? evidence.join("; ") : "none beyond segment prior"}.
Posterior belief: adjust messaging to maximise expected reply probability given the above.
Decision: write the email that best exploits this posterior while remaining authentic.
[END REASONING]

`;
}
var SEGMENT_PRIORS, SEGMENT_REVENUE, TONE_PRIORS, DEFAULT_TONE_PRIORS;
var init_bayesian = __esm({
  "server/_core/bayesian.ts"() {
    "use strict";
    SEGMENT_PRIORS = {
      GOV: { alpha: 2, beta: 23 },
      // ~8 %  reply rate, slow-moving
      RETAIL: { alpha: 3, beta: 17 },
      // ~15 % reply rate
      PRESS: { alpha: 4, beta: 16 },
      // ~20 % — journalists are responsive
      PARTNER: { alpha: 5, beta: 15 },
      // ~25 % — aligned incentive
      DEFAULT: { alpha: 2, beta: 23 }
    };
    SEGMENT_REVENUE = {
      GOV: 12e4,
      RETAIL: 18e3,
      PRESS: 5e3,
      // brand value, not direct revenue
      PARTNER: 4e4,
      DEFAULT: 1e4
    };
    TONE_PRIORS = {
      GOV: {
        formal: { alpha: 4, beta: 6 },
        // government respects formality
        warm: { alpha: 2, beta: 8 },
        direct: { alpha: 3, beta: 7 },
        story: { alpha: 1, beta: 9 }
      },
      RETAIL: {
        formal: { alpha: 2, beta: 8 },
        warm: { alpha: 4, beta: 6 },
        // retail is relationship-driven
        direct: { alpha: 3, beta: 7 },
        story: { alpha: 3, beta: 7 }
      },
      PRESS: {
        formal: { alpha: 1, beta: 9 },
        warm: { alpha: 3, beta: 7 },
        direct: { alpha: 4, beta: 6 },
        // journalists like concise pitches
        story: { alpha: 5, beta: 5 }
        // story-angle works for press
      },
      PARTNER: {
        formal: { alpha: 3, beta: 7 },
        warm: { alpha: 3, beta: 7 },
        direct: { alpha: 5, beta: 5 },
        // partners want ROI fast
        story: { alpha: 2, beta: 8 }
      }
    };
    DEFAULT_TONE_PRIORS = {
      formal: { alpha: 2, beta: 8 },
      warm: { alpha: 3, beta: 7 },
      direct: { alpha: 3, beta: 7 },
      story: { alpha: 2, beta: 8 }
    };
  }
});

// server/apollo-service.ts
async function apolloSearchLeads(segment, count3) {
  if (!ENV.apolloApiKey) {
    return [];
  }
  const params = SEGMENT_PARAMS[segment] ?? SEGMENT_PARAMS.GOV;
  const body = {
    ...params,
    page: 1,
    per_page: Math.min(count3, 25)
  };
  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": ENV.apolloApiKey
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apollo API error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => ({ people: [] }));
  const people = data?.people ?? [];
  return people.filter((p) => p.email && p.name && p.organization?.name).map((p) => ({
    name: p.name ?? `${p.first_name} ${p.last_name}`.trim(),
    firstName: p.first_name ?? "",
    lastName: p.last_name ?? "",
    email: p.email,
    title: p.title ?? "",
    org: p.organization?.name ?? "",
    orgIndustry: p.organization?.industry ?? void 0,
    linkedinUrl: p.linkedin_url ?? void 0,
    city: p.city ?? void 0,
    state: p.state ?? void 0,
    country: p.country ?? void 0,
    seniority: p.seniority ?? void 0
  }));
}
var APOLLO_BASE, SEGMENT_PARAMS;
var init_apollo_service = __esm({
  "server/apollo-service.ts"() {
    "use strict";
    init_env();
    APOLLO_BASE = "https://api.apollo.io/v1";
    SEGMENT_PARAMS = {
      GOV: {
        person_titles: [
          "chief procurement officer",
          "director of procurement",
          "procurement director",
          "supply chain director",
          "director of operations",
          "program director",
          "compliance officer",
          "director of logistics",
          "operations director",
          "deputy director",
          "department head",
          "government relations"
        ],
        person_seniorities: ["director", "vp", "c_suite", "manager", "senior"],
        q_organization_keyword_tags: [
          "government",
          "federal",
          "state government",
          "county",
          "municipal",
          "department of defense",
          "public sector",
          "agency",
          "bureau"
        ]
      },
      RETAIL: {
        person_titles: [
          "owner",
          "founder",
          "general manager",
          "director of operations",
          "buyer",
          "head of procurement",
          "retail director",
          "store director",
          "vp of retail",
          "chief operating officer",
          "dispensary manager"
        ],
        person_seniorities: ["owner", "founder", "director", "vp", "c_suite", "manager"],
        q_organization_keyword_tags: [
          "dispensary",
          "retail",
          "cannabis",
          "specialty retail",
          "boutique",
          "consumer goods",
          "pharmacy",
          "health and wellness"
        ]
      },
      PRESS: {
        person_titles: [
          "journalist",
          "reporter",
          "editor",
          "senior writer",
          "technology reporter",
          "crypto reporter",
          "blockchain reporter",
          "fintech editor"
        ],
        person_seniorities: ["senior", "manager", "director", "c_suite"],
        q_organization_keyword_tags: [
          "media",
          "press",
          "news",
          "publication",
          "magazine",
          "online media",
          "technology media",
          "crypto",
          "fintech"
        ]
      },
      PARTNER: {
        person_titles: [
          "vp of partnerships",
          "head of partnerships",
          "business development",
          "director of alliances",
          "channel director",
          "vp of business development"
        ],
        person_seniorities: ["director", "vp", "c_suite", "manager"],
        q_organization_keyword_tags: [
          "software",
          "technology",
          "saas",
          "platform",
          "integration",
          "api"
        ]
      }
    };
  }
});

// server/agents/lead-finder.ts
async function scoreleads(apolloLeads, segment, icp, conversionMean, ciLo, ciHi, expectedValue) {
  if (apolloLeads.length === 0) return [];
  const leadList = apolloLeads.map(
    (l, i) => `${i}: name="${l.name}" title="${l.title}" org="${l.org}" industry="${l.orgIndustry ?? ""}" seniority="${l.seniority ?? ""}"`
  ).join("\n");
  const prompt = `[BAYESIAN REASONING]
Prior: ${segment} conversion rate \u2248 ${(conversionMean * 100).toFixed(1)}% (95% CI: ${(ciLo * 100).toFixed(1)}%\u2013${(ciHi * 100).toFixed(1)}%).
Expected value per converted lead: ~$${expectedValue}.
[END REASONING]

ICP: ${icp}
Segment: ${segment}

Score each lead's fit for AuthiChain's blockchain product authentication platform.
AuthiChain's strongest value props: supply chain integrity, anti-counterfeit via QR+AI, NFT provenance.

Leads:
${leadList}

Return JSON array (same order, same indices):
[{ "index": 0, "fitProbability": 0.0\u20131.0, "fitNotes": "one sentence reason" }, ...]`;
  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" }
    });
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content ?? "[]");
    const scores = Array.isArray(parsed) ? parsed : parsed.leads ?? parsed.scores ?? [];
    return apolloLeads.map((lead, i) => {
      const score = scores.find((s) => s.index === i);
      return {
        ...lead,
        fitProbability: score?.fitProbability ?? 0.5,
        fitNotes: score?.fitNotes ?? ""
      };
    });
  } catch {
    return apolloLeads.map((l) => ({ ...l, fitProbability: 0.5, fitNotes: "unscored" }));
  }
}
async function runLeadFinder(task) {
  const payload = task.payload;
  const segment = payload.segment ?? (task.kind === "FIND_GOV_LEADS" ? "GOV" : "RETAIL");
  const count3 = payload.count ?? 10;
  const icp = payload.icp ?? (segment === "GOV" ? "government agency procurement and supply chain officer" : "retail cannabis dispensary owner or manager");
  const adaptivePriors = await getAdaptivePriors();
  const prior = adaptivePriors[segment] ?? adaptivePriors.DEFAULT;
  const conversionMean = betaMean(prior);
  const [ciLo, ciHi] = betaCI(prior);
  const expectedRevenue = SEGMENT_REVENUE[segment] ?? SEGMENT_REVENUE.DEFAULT;
  const expectedValue = (conversionMean * expectedRevenue).toFixed(0);
  const apolloLeads = await apolloSearchLeads(segment, count3);
  const scored = await scoreleads(apolloLeads, segment, icp, conversionMean, ciLo, ciHi, expectedValue);
  scored.sort((a, b) => b.fitProbability - a.fitProbability);
  const selected = scored.slice(0, count3);
  const db2 = await getDb();
  let inserted = 0;
  for (const lead of selected) {
    if (!lead.email || !lead.org) continue;
    if (db2) {
      await db2.insert(leads).values({
        email: lead.email.toLowerCase(),
        name: lead.name,
        company: lead.org,
        title: lead.title,
        notes: `[apollo][fit:${lead.fitProbability.toFixed(2)}] ${lead.fitNotes}`,
        source: `agentz_apollo_${segment.toLowerCase()}`,
        status: "new",
        segment
      }).onConflictDoNothing();
    }
    await enqueueTask(task.missionId, "DRAFT_OUTBOUND_EMAIL", {
      segment,
      sequence: 1,
      leadEmail: lead.email,
      leadName: lead.name,
      leadOrg: lead.org,
      leadTitle: lead.title,
      linkedinUrl: lead.linkedinUrl
    });
    inserted++;
  }
  await logActivity({
    userId: null,
    action: "lead_finder_completed",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      segment,
      source: "apollo",
      found: apolloLeads.length,
      scored: scored.length,
      inserted,
      missionId: task.missionId
    }
  });
}
var init_lead_finder = __esm({
  "server/agents/lead-finder.ts"() {
    "use strict";
    init_llm();
    init_db();
    init_schema();
    init_bayesian();
    init_apollo_service();
  }
});

// server/email-service.ts
async function getGmailAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 6e4) {
    return _cachedToken;
  }
  const staticToken = process.env.GMAIL_ACCESS_TOKEN || "";
  if (staticToken && !ENV.gmailRefreshToken) {
    _cachedToken = staticToken;
    _tokenExpiresAt = Date.now() + 55 * 60 * 1e3;
    return staticToken;
  }
  if (!ENV.gmailClientId || !ENV.gmailClientSecret || !ENV.gmailRefreshToken) {
    return staticToken;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.gmailClientId,
      client_secret: ENV.gmailClientSecret,
      refresh_token: ENV.gmailRefreshToken,
      grant_type: "refresh_token"
    }).toString()
  });
  if (!res.ok) {
    console.error("[gmail] token refresh failed:", res.status, await res.text().catch(() => ""));
    return staticToken;
  }
  const data = await res.json().catch(() => ({}));
  _cachedToken = data.access_token ?? staticToken;
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1e3;
  return _cachedToken;
}
function suppressionSet() {
  return new Set(
    ENV.suppressionList.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
  );
}
function isSuppressed(email) {
  return suppressionSet().has(email.trim().toLowerCase());
}
function toBase64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sendEmail(input) {
  const to = input.to.trim().toLowerCase();
  if (isSuppressed(to)) {
    return { status: "suppressed", reason: "suppression_list" };
  }
  const fromEmail = ENV.gmailFromEmail || process.env.GMAIL_FROM_EMAIL || "";
  const fromName = input.fromName || "AuthiChain";
  if (fromEmail) {
    const gmailAccessToken = await getGmailAccessToken();
    if (gmailAccessToken) {
      const mime = [
        `From: ${fromName} <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${input.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        input.body
      ].join("\r\n");
      const raw = toBase64Url(mime);
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmailAccessToken}`
        },
        body: JSON.stringify({ raw })
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          status: "sent",
          provider: "gmail",
          providerMessageId: data?.id,
          threadId: data?.threadId
        };
      }
      console.warn("[email] Gmail send failed, falling back to SendGrid");
    }
  }
  if (ENV.sendgridApiKey) {
    const senderEmail = fromEmail || "outreach@authichain.com";
    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.sendgridApiKey}`
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: fromName },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body }]
      })
    });
    if (sgRes.ok || sgRes.status === 202) {
      const msgId = sgRes.headers.get("X-Message-Id") ?? void 0;
      return { status: "sent", provider: "sendgrid", providerMessageId: msgId };
    }
    const errTxt = await sgRes.text().catch(() => "");
    console.error("[email] SendGrid failed:", sgRes.status, errTxt.slice(0, 200));
    return { status: "skipped", provider: "sendgrid", reason: `sendgrid_failed:${sgRes.status}` };
  }
  return { status: "skipped", reason: "no_email_provider_configured" };
}
async function checkThreadReplies(threadId) {
  const gmailAccessToken = await getGmailAccessToken();
  if (!gmailAccessToken || !threadId) return { hasReply: false };
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
  );
  if (!res.ok) return { hasReply: false };
  const thread = await res.json().catch(() => null);
  const messages = thread?.messages ?? [];
  const replies = messages.filter(
    (m) => Array.isArray(m.labelIds) && m.labelIds.includes("INBOX")
  );
  if (replies.length === 0) return { hasReply: false };
  const latest = replies[replies.length - 1];
  function extractBody(payload) {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    for (const part of payload.parts ?? []) {
      const t2 = extractBody(part);
      if (t2) return t2;
    }
    return "";
  }
  const replyText = extractBody(latest.payload).slice(0, 1500);
  const fromHeader = (latest.payload?.headers ?? []).find((h) => h.name === "From");
  return { hasReply: true, replyText, replyFrom: fromHeader?.value };
}
var _cachedToken, _tokenExpiresAt;
var init_email_service = __esm({
  "server/email-service.ts"() {
    "use strict";
    init_env();
    _cachedToken = null;
    _tokenExpiresAt = 0;
  }
});

// server/agents/outbound-email.ts
import { eq as eq6 } from "drizzle-orm";
async function runOutboundEmail(task) {
  const payload = task.payload;
  const segment = payload.segment ?? "GOV";
  const sequence = payload.sequence ?? 1;
  const recipientContext = segmentContext[segment] ?? "business professional";
  const tone = selectTone(segment);
  const prior = SEGMENT_PRIORS[segment] ?? SEGMENT_PRIORS.DEFAULT;
  const conversionEstimate = betaMean(prior);
  const ci = betaCI(prior);
  const reasoning = bayesianPreamble({
    segment,
    tone,
    conversionEstimate,
    ci,
    evidence: payload.leadTitle ? [`lead title: ${payload.leadTitle}`] : []
  });
  const subjectFallback = sequence === 1 ? "Introducing AuthiChain \u2013 Product Authentication on the Blockchain" : `Follow-up ${sequence}: AuthiChain Product Authentication`;
  const prompt = `${reasoning}You are writing a cold outreach email on behalf of AuthiChain (authichain.com).

Recipient: ${payload.leadName ?? "there"} at ${payload.leadOrg ?? "your organization"}${payload.leadTitle ? `, ${payload.leadTitle}` : ""}
Recipient profile: ${recipientContext}
Sequence: Email ${sequence} of 3
Tone directive: ${toneGuidance[tone]}

AuthiChain helps brands verify product authenticity via blockchain-backed QR codes and AI. Key value props:
- Instant product authentication via QR scan
- Tamper-evident certificate of authenticity
- Counterfeit detection with AI confidence scoring
- NFT-backed provenance trail

Write a ${sequence === 1 ? "3-4 sentence intro email" : "2-3 sentence follow-up"} that applies the tone directive above and ends with a clear CTA (schedule a 15-min call or reply with interest).

Return JSON: { "subject": "...", "body": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let subject;
  let body;
  try {
    const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
    subject = parsed.subject ?? subjectFallback;
    body = parsed.body ?? "";
  } catch {
    throw new Error("Outbound email LLM returned unparseable JSON");
  }
  if (!body) throw new Error("LLM returned empty email body");
  if (ENV.requireOutreachApproval) {
    const db3 = await getDb();
    if (db3) {
      await db3.insert(emailDrafts).values({
        prospectEmail: payload.leadEmail ?? "unknown@unknown.com",
        prospectName: payload.leadName ?? void 0,
        prospectCompany: payload.leadOrg ?? void 0,
        prospectTitle: payload.leadTitle ?? void 0,
        subject,
        body,
        status: "pending",
        generatedBy: "agentz",
        taskId: task.id
      });
    }
    await markTaskWaitingHuman(task.id);
    await logActivity({ userId: null, action: "outbound_email_draft_pending_approval", entityType: "task", entityId: 0, details: {
      taskId: task.id,
      segment,
      sequence,
      leadEmail: payload.leadEmail,
      subject,
      tone,
      conversionEstimate: conversionEstimate.toFixed(3)
    } });
    return;
  }
  if (!payload.leadEmail) throw new Error("No leadEmail in payload for direct send");
  const sendResult = await sendEmail({ to: payload.leadEmail, subject, body });
  const db2 = await getDb();
  if (db2) {
    await db2.update(leads).set({ status: "CONTACTED", lastContactedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq6(leads.email, payload.leadEmail.toLowerCase()));
  }
  if (sendResult.status === "sent") {
    const check48h = new Date(Date.now() + 48 * 60 * 60 * 1e3);
    await enqueueTask(task.missionId, "CHECK_REPLIES", {
      threadId: sendResult.threadId,
      leadEmail: payload.leadEmail,
      leadName: payload.leadName,
      leadOrg: payload.leadOrg,
      leadTitle: payload.leadTitle,
      segment,
      sequence,
      maxSequence: 3
    }, check48h);
  }
  await logActivity({ userId: null, action: "outbound_email_sent", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    segment,
    sequence,
    leadEmail: payload.leadEmail,
    subject,
    sendStatus: sendResult.status,
    tone,
    conversionEstimate: conversionEstimate.toFixed(3),
    ci: `${(ci[0] * 100).toFixed(1)}%\u2013${(ci[1] * 100).toFixed(1)}%`
  } });
}
var segmentContext, toneGuidance;
var init_outbound_email = __esm({
  "server/agents/outbound-email.ts"() {
    "use strict";
    init_llm();
    init_env();
    init_email_service();
    init_db();
    init_schema();
    init_bayesian();
    segmentContext = {
      GOV: "government agency procurement officer focused on supply chain integrity and anti-counterfeiting",
      RETAIL: "retail business owner (dispensary or specialty retail) focused on product authenticity and brand trust",
      PRESS: "technology journalist or crypto reporter interested in blockchain product authentication",
      PARTNER: "technology partner or integration partner interested in embedded authentication APIs"
    };
    toneGuidance = {
      formal: "Use a professional, respectful tone. Reference institutional responsibilities and compliance.",
      warm: "Use a friendly, conversational tone. Acknowledge their work and build rapport first.",
      direct: "Lead with ROI immediately. Be brief, specific, and end with a single concrete CTA.",
      story: "Open with a one-sentence customer story or stat that creates curiosity, then pitch."
    };
  }
});

// server/agents/followup.ts
import { eq as eq7, and as and6, lte as lte2, inArray as inArray2 } from "drizzle-orm";
async function runFollowupSequence(task) {
  const payload = task.payload;
  const segment = payload.segment ?? "GOV";
  const maxFollowups = payload.maxFollowups ?? 3;
  const db2 = await getDb();
  if (!db2) {
    await logActivity({ userId: null, action: "followup_skipped_no_db", entityType: "task", entityId: 0, details: { taskId: task.id, segment } });
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const dueLeads = await db2.select().from(leads).where(
    and6(
      eq7(leads.segment, segment),
      inArray2(leads.status, ["CONTACTED"]),
      lte2(leads.nextActionAt, now)
    )
  );
  let drafted = 0;
  let sent = 0;
  for (const lead of dueLeads) {
    const meta = lead.metadata ?? {};
    const followupNum = Math.min((meta.followupCount ?? 0) + 1, maxFollowups);
    const tone = followupNum === 1 ? "gentle reminder" : followupNum === 2 ? "value-focused" : "final outreach with urgency";
    const prompt = `Write follow-up email ${followupNum} of ${maxFollowups} to ${lead.name ?? lead.email} at ${lead.company ?? "their organization"} about AuthiChain product authentication.
Tone: ${tone}
Keep it to 2-3 sentences. End with a clear CTA.
Return JSON: { "subject": "...", "body": "..." }`;
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" }
    });
    let subject;
    let body;
    try {
      const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
      subject = parsed.subject ?? `Follow-up ${followupNum}: AuthiChain`;
      body = parsed.body ?? "";
    } catch {
      continue;
    }
    if (!body) continue;
    const nextActionAt = new Date(now.getTime() + (followupNum < maxFollowups ? 4 * 864e5 : 7 * 864e5));
    if (ENV.requireOutreachApproval) {
      await db2.insert(emailDrafts).values({
        prospectEmail: lead.email,
        prospectName: lead.name ?? void 0,
        prospectCompany: lead.company ?? void 0,
        subject,
        body,
        status: "pending",
        generatedBy: "agentz_followup",
        taskId: task.id
      });
      await db2.update(leads).set({ nextActionAt, metadata: { ...meta, followupCount: followupNum }, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(leads.id, lead.id));
      drafted++;
    } else {
      const sendResult = await sendEmail({ to: lead.email, subject, body });
      await db2.update(leads).set({
        status: "CONTACTED",
        lastContactedAt: now,
        nextActionAt,
        metadata: { ...meta, followupCount: followupNum },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq7(leads.id, lead.id));
      if (sendResult.status === "sent") sent++;
    }
  }
  if (ENV.requireOutreachApproval && drafted > 0) {
    await markTaskWaitingHuman(task.id);
  }
  await logActivity({ userId: null, action: "followup_sequence_completed", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    segment,
    dueLeads: dueLeads.length,
    drafted,
    sent
  } });
}
var init_followup = __esm({
  "server/agents/followup.ts"() {
    "use strict";
    init_llm();
    init_env();
    init_email_service();
    init_db();
    init_schema();
  }
});

// server/agents/pilot-packet.ts
async function runBuildPilotPacket(task) {
  const payload = task.payload;
  const segment = payload.segment ?? "GOV";
  const focus = payload.focus ?? segmentContext2[segment] ?? "enterprise customers";
  const prompt = `You are preparing a pilot program proposal document for AuthiChain (authichain.com).

Target audience: ${focus}

Create a comprehensive pilot packet outline including:
1. Executive Summary (2-3 sentences)
2. Problem Statement (specific to this segment)
3. AuthiChain Solution Overview (key features relevant to segment)
4. Pilot Scope (what will be tested, success metrics, timeline: 30-60 days)
5. Implementation Requirements (technical and operational)
6. Pricing & ROI Estimate (placeholder figures)
7. Next Steps & Call to Action

Return JSON: { "title": "...", "sections": [{ "heading": "...", "content": "..." }] }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let packet;
  try {
    packet = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Pilot packet LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "pilot_packet_built", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    segment,
    title: packet.title,
    sectionCount: packet.sections?.length ?? 0,
    missionId: task.missionId
  } });
}
async function runDraftIntelDossier(task) {
  const payload = task.payload;
  const segment = payload.segment ?? "GOV";
  const focus = payload.focus ?? segmentContext2[segment] ?? "market landscape";
  const prompt = `You are an intelligence analyst preparing a competitive and market dossier for AuthiChain's ${segment} sales team.

Focus: ${focus}

Include:
1. Market Size & Opportunity (TAM/SAM for this segment)
2. Key Buyer Personas (3-5 decision-maker profiles)
3. Competitive Landscape (2-3 alternatives, AuthiChain differentiators)
4. Objection Handling Guide (top 3 objections + responses)
5. Talking Points (5 bullet points tailored to this audience)
6. Recommended Outreach Channels

Return JSON: { "title": "...", "sections": [{ "heading": "...", "content": "..." }] }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let dossier;
  try {
    dossier = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Intel dossier LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "intel_dossier_drafted", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    segment,
    focus,
    missionId: task.missionId
  } });
}
var segmentContext2;
var init_pilot_packet = __esm({
  "server/agents/pilot-packet.ts"() {
    "use strict";
    init_llm();
    init_db();
    segmentContext2 = {
      GOV: "government agencies focused on supply chain integrity, border control, and anti-counterfeiting compliance",
      RETAIL: "retail businesses (dispensaries, specialty retail) focused on product authenticity and brand protection",
      TECH: "technology partners and enterprise integrators evaluating authentication API capabilities",
      PARTNER: "strategic partners interested in co-selling or embedding AuthiChain in their platform"
    };
  }
});

// server/agents/crm-update.ts
import { eq as eq8 } from "drizzle-orm";
async function runCrmUpdate(task) {
  const payload = task.payload;
  if (!isHubSpotConfigured()) {
    await logActivity({ userId: null, action: "crm_update_skipped", entityType: "task", entityId: 0, details: { taskId: task.id, reason: "hubspot_not_configured" } });
    return;
  }
  const db2 = await getDb();
  if (payload.leadEmail) {
    await syncLeadToHubSpot({
      email: payload.leadEmail,
      name: payload.leadName,
      company: payload.leadOrg
    });
    if (db2) {
      await db2.update(leads).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq8(leads.email, payload.leadEmail.toLowerCase()));
    }
    await logActivity({ userId: null, action: "crm_lead_synced", entityType: "task", entityId: 0, details: {
      taskId: task.id,
      leadEmail: payload.leadEmail,
      segment: payload.segment
    } });
    return;
  }
  if (!db2) return;
  const segmentLeads = payload.segment ? await db2.select().from(leads).where(eq8(leads.segment, payload.segment)) : await db2.select().from(leads);
  let synced = 0;
  for (const lead of segmentLeads) {
    try {
      await syncLeadToHubSpot({
        email: lead.email,
        name: lead.name ?? void 0,
        company: lead.company ?? void 0
      });
      synced++;
    } catch {
    }
  }
  await logActivity({ userId: null, action: "crm_bulk_sync_completed", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    segment: payload.segment,
    total: segmentLeads.length,
    synced,
    missionId: task.missionId
  } });
}
var init_crm_update = __esm({
  "server/agents/crm-update.ts"() {
    "use strict";
    init_hubspot_service();
    init_db();
    init_schema();
  }
});

// server/agents/retail.ts
async function runFinalizeRetailSignage(task) {
  const payload = task.payload;
  const vertical = payload.vertical ?? "dispensary";
  const prompt = `You are helping a ${vertical} retail partner finalize in-store signage for AuthiChain product authentication.

Create signage copy and placement guide for:
1. Point-of-sale QR scan prompt (10 words max, consumer-facing)
2. Shelf talker text (25 words max)
3. Counter card headline + 2-line body
4. Staff talking points (3 bullet points for training)

Return JSON: { "posScan": "...", "shelfTalker": "...", "counterCard": { "headline": "...", "body": "..." }, "staffPoints": ["..."] }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let signage;
  try {
    signage = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Retail signage LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "retail_signage_finalized", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    vertical,
    missionId: task.missionId
  } });
}
async function runPackageSkuOnboarding(task) {
  const payload = task.payload;
  const skuCount = payload.skuCount ?? 10;
  const vertical = payload.vertical ?? "dispensary";
  const prompt = `Create an SKU onboarding checklist for a ${vertical} integrating AuthiChain authentication for ${skuCount} products.

Include:
1. Pre-onboarding requirements (data fields needed per SKU)
2. QR code generation steps
3. Batch upload format (CSV headers)
4. Testing protocol (scan verification steps)
5. Go-live checklist

Return JSON: { "sections": [{ "heading": "...", "steps": ["..."] }] }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let onboarding;
  try {
    onboarding = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("SKU onboarding LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "sku_onboarding_packaged", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    vertical,
    skuCount,
    missionId: task.missionId
  } });
}
var init_retail = __esm({
  "server/agents/retail.ts"() {
    "use strict";
    init_llm();
    init_db();
  }
});

// server/agents/infra.ts
async function runCheckDnsConfig(task) {
  const payload = task.payload;
  const domain = payload.domain ?? "authichain.com";
  const checks = [];
  for (const type of ["A", "AAAA", "CNAME", "MX", "TXT"]) {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
      const data = await res.json();
      checks.push({
        record: type,
        status: data.Status === 0 ? "ok" : "error",
        value: data.Answer?.[0]?.data ?? void 0
      });
    } catch {
      checks.push({ record: type, status: "unreachable" });
    }
  }
  const failed = checks.filter((c) => c.status !== "ok");
  await logActivity({ userId: null, action: "dns_config_checked", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    domain,
    checks,
    failedCount: failed.length,
    missionId: task.missionId
  } });
  if (failed.length > 0) {
    throw new Error(`DNS check failed for ${failed.map((f) => f.record).join(", ")} on ${domain}`);
  }
}
async function runVerifySsl(task) {
  const payload = task.payload;
  const domain = payload.domain ?? "authichain.com";
  const url = `https://${domain}`;
  let status = "unknown";
  let statusCode = null;
  let error = null;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(1e4) });
    statusCode = res.status;
    status = res.ok ? "ok" : "http_error";
  } catch (e) {
    status = "ssl_or_network_error";
    error = String(e);
  }
  await logActivity({ userId: null, action: "ssl_verified", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    domain,
    status,
    statusCode,
    error,
    missionId: task.missionId
  } });
  if (status !== "ok") {
    throw new Error(`SSL/connectivity check failed for ${domain}: ${status} ${error ?? ""}`);
  }
}
async function runLighthouseAudit(task) {
  const payload = task.payload;
  const url = payload.url ?? "https://authichain.com";
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=seo`;
  let scores = {};
  let error = null;
  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(3e4) });
    if (res.ok) {
      const data = await res.json();
      const cats = data.lighthouseResult?.categories ?? {};
      scores = Object.fromEntries(
        Object.entries(cats).map(([k, v]) => [k, Math.round(v.score * 100)])
      );
    } else {
      error = `PageSpeed API returned ${res.status}`;
    }
  } catch (e) {
    error = String(e);
  }
  await logActivity({ userId: null, action: "lighthouse_audit_completed", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    url,
    scores,
    error,
    missionId: task.missionId
  } });
  if (error) {
    throw new Error(`Lighthouse audit failed: ${error}`);
  }
}
var init_infra = __esm({
  "server/agents/infra.ts"() {
    "use strict";
    init_db();
  }
});

// server/twitter-service.ts
import { createHmac, randomBytes } from "crypto";
function pct(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function buildOAuthHeader(params) {
  const { method, url, apiKey, apiSecret, accessToken, accessTokenSecret, bodyParams = {} } = params;
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1e3)),
    oauth_token: accessToken,
    oauth_version: "1.0"
  };
  const allParams = { ...oauthParams, ...bodyParams };
  const sortedParams = Object.keys(allParams).sort().map((k) => `${pct(k)}=${pct(allParams[k])}`).join("&");
  const sigBase = [method.toUpperCase(), pct(url), pct(sortedParams)].join("&");
  const sigKey = `${pct(apiSecret)}&${pct(accessTokenSecret)}`;
  const signature = createHmac("sha1", sigKey).update(sigBase).digest("base64");
  oauthParams["oauth_signature"] = signature;
  const authHeader = "OAuth " + Object.keys(oauthParams).sort().map((k) => `${pct(k)}="${pct(oauthParams[k])}"`).join(", ");
  return authHeader;
}
function getKeys(account = "authichain") {
  const prefix = account === "qron" ? "TWITTER_QRON_" : "TWITTER_";
  const apiKey = process.env[`${prefix}API_KEY`] ?? "";
  const apiSecret = process.env[`${prefix}API_SECRET`] ?? "";
  const accessToken = process.env[`${prefix}ACCESS_TOKEN`] ?? "";
  const accessTokenSecret = process.env[`${prefix}ACCESS_TOKEN_SECRET`] ?? "";
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error(`Twitter credentials not configured for account: ${account}. Set ${prefix}API_KEY, ${prefix}API_SECRET, ${prefix}ACCESS_TOKEN, ${prefix}ACCESS_TOKEN_SECRET.`);
  }
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}
async function postThread(tweets, account) {
  const results = [];
  let replyToId;
  for (const text2 of tweets) {
    const url = `${TWITTER_API_BASE}/tweets`;
    const { apiKey, apiSecret, accessToken, accessTokenSecret } = getKeys(account);
    const payload = { text: text2 };
    if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId };
    const authHeader = buildOAuthHeader({ method: "POST", url, apiKey, apiSecret, accessToken, accessTokenSecret });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Thread tweet failed: ${await res.text()}`);
    const json2 = await res.json();
    const handle = account === "qron" ? "QRONspace" : "AuthiChain";
    results.push({ id: json2.data.id, text: json2.data.text, url: `https://x.com/${handle}/status/${json2.data.id}` });
    replyToId = json2.data.id;
  }
  return results;
}
var TWITTER_API_BASE;
var init_twitter_service = __esm({
  "server/twitter-service.ts"() {
    "use strict";
    TWITTER_API_BASE = "https://api.twitter.com/2";
  }
});

// server/linkedin-service.ts
async function getAccessToken() {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 6e4) {
    return _tokenCache.token;
  }
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN ?? "";
  const clientId = process.env.LINKEDIN_CLIENT_ID ?? "";
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? "";
  const directToken = process.env.LINKEDIN_ACCESS_TOKEN ?? "";
  if (!refreshToken && directToken) {
    _tokenCache = { token: directToken, expiresAt: Date.now() + 55 * 24 * 60 * 60 * 1e3 };
    return directToken;
  }
  if (!refreshToken) throw new Error("LINKEDIN_REFRESH_TOKEN or LINKEDIN_ACCESS_TOKEN not set");
  if (!clientId || !clientSecret) throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not set");
  const res = await fetch(LI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${await res.text()}`);
  const json2 = await res.json();
  _tokenCache = { token: json2.access_token, expiresAt: Date.now() + json2.expires_in * 1e3 };
  return json2.access_token;
}
async function resolvePersonUrn(token) {
  if (_personUrnCache) return _personUrnCache;
  const envUrn = process.env.LINKEDIN_PERSON_URN ?? "";
  if (envUrn) {
    _personUrnCache = envUrn;
    return envUrn;
  }
  const res = await fetch(`${LI_API}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) {
    const json2 = await res.json();
    if (json2.sub) {
      _personUrnCache = json2.sub.startsWith("urn:li:person:") ? json2.sub : `urn:li:person:${json2.sub}`;
      return _personUrnCache;
    }
  }
  const meRes = await fetch(`${LI_API}/me`, {
    headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" }
  });
  if (meRes.ok) {
    const me = await meRes.json();
    if (me.id) {
      _personUrnCache = `urn:li:person:${me.id}`;
      return _personUrnCache;
    }
  }
  throw new Error("Could not resolve LinkedIn person URN \u2014 set LINKEDIN_PERSON_URN secret or ensure OpenID Connect product is active");
}
async function postUpdate(params) {
  const token = await getAccessToken();
  const personUrn = await resolvePersonUrn(token);
  const orgUrn = process.env.LINKEDIN_ORG_URN ?? "";
  const author = params.author === "org" && orgUrn ? orgUrn : personUrn;
  if (!author) throw new Error("LINKEDIN_PERSON_URN not set");
  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: params.text },
        shareMediaCategory: params.url ? "ARTICLE" : "NONE",
        ...params.url ? {
          media: [
            {
              status: "READY",
              originalUrl: params.url,
              title: { text: params.urlTitle ?? params.url },
              description: { text: params.urlDescription ?? "" }
            }
          ]
        } : {}
      }
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  };
  const res = await fetch(`${LI_API}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`LinkedIn post failed (${res.status}): ${await res.text()}`);
  const postId = res.headers.get("x-restli-id") ?? "";
  return {
    id: postId,
    postUrl: `https://www.linkedin.com/feed/update/${postId}`
  };
}
async function postLinkedInThread(texts, author = "person") {
  const results = [];
  for (const text2 of texts) {
    const result = await postUpdate({ text: text2, author });
    results.push(result);
    await new Promise((r) => setTimeout(r, 1e3));
  }
  return results;
}
var LI_API, LI_TOKEN_URL, _tokenCache, _personUrnCache;
var init_linkedin_service = __esm({
  "server/linkedin-service.ts"() {
    "use strict";
    LI_API = "https://api.linkedin.com/v2";
    LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
    _tokenCache = null;
    _personUrnCache = "";
  }
});

// server/agents/content.ts
async function runGenerateLaunchChecklist(task) {
  const payload = task.payload;
  const scope = payload.scope ?? "full_launch";
  const prompt = `Create a comprehensive launch checklist for AuthiChain (authichain.com), scope: ${scope}.

Categories:
- Technical readiness (infra, SSL, monitoring, backups)
- Product readiness (features complete, QA done, docs live)
- Marketing readiness (press release, social content, email campaign)
- Sales readiness (CRM set up, outreach sequences queued)
- Legal/compliance (ToS, Privacy Policy, GDPR)
- Launch day (countdown steps, go/no-go criteria)
- Post-launch (monitoring, support coverage, feedback loops)

Return JSON: { "title": "...", "categories": [{ "name": "...", "items": [{ "task": "...", "owner": "...", "done": false }] }] }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let checklist;
  try {
    checklist = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Launch checklist LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "launch_checklist_generated", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    scope,
    missionId: task.missionId
  } });
}
async function runDraftLaunchEmail(task) {
  const payload = task.payload;
  const audience = payload.audience ?? "founders";
  const prompt = `Write a launch announcement email for AuthiChain (authichain.com).

Audience: ${audience}
AuthiChain is a blockchain-backed product authentication platform \u2014 QR codes, AI analysis, NFT certificates of authenticity.

Write an engaging, founder-voiced launch email (300-400 words) covering:
1. The problem (counterfeiting costs brands billions)
2. The AuthiChain solution
3. Key features (3 bullets)
4. Call to action (sign up / schedule demo)
5. P.S. with a personal note

Return JSON: { "subject": "...", "body": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let email;
  try {
    email = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Launch email LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "launch_email_drafted", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    audience,
    subject: email.subject,
    missionId: task.missionId
  } });
}
async function runDraftPressRelease(task) {
  const prompt = `Write a press release announcing the launch of AuthiChain (authichain.com).

AuthiChain enables brands and distributors to authenticate products using blockchain-backed QR codes and AI-powered counterfeit detection. Key features: instant QR scan authentication, NFT certificates of authenticity, AI confidence scoring, tamper-evident provenance trail.

Follow standard press release format:
- FOR IMMEDIATE RELEASE
- Headline
- Subheadline
- Dateline + lead paragraph
- 2-3 body paragraphs (problem \u2192 solution \u2192 market opportunity)
- Quote from a fictional founder ("John Carter, CEO of AuthiChain")
- About AuthiChain boilerplate
- Contact information placeholder

Return JSON: { "headline": "...", "subheadline": "...", "body": "...", "quote": "...", "boilerplate": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let pr;
  try {
    pr = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Press release LLM returned unparseable JSON");
  }
  await logActivity({ userId: null, action: "press_release_drafted", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    missionId: task.missionId
  } });
}
async function runScheduleSocialPosts(task) {
  const payload = task.payload;
  const platforms = payload.platforms ?? ["twitter", "linkedin"];
  const prompt = `Create a social media launch content calendar for AuthiChain (authichain.com).

Platforms: ${platforms.join(", ")}
Timeline: launch week (7 days)

For each platform, write 5-7 posts covering:
- Teaser (2 days before launch)
- Launch day announcement
- Feature spotlight (1 per key feature)
- Social proof / early adopter call
- Engagement post (question for audience)

Return JSON: { "platforms": { "<platform>": [{ "day": 0, "copy": "...", "hashtags": ["..."] }] } }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let calendar;
  try {
    calendar = JSON.parse(result.choices[0].message.content ?? "{}");
  } catch {
    throw new Error("Social posts LLM returned unparseable JSON");
  }
  const postedUrls = [];
  const twitterPosts = (calendar.platforms?.["twitter"] ?? calendar.platforms?.["x"] ?? []).filter((p) => p.day === 0);
  const linkedinPosts = (calendar.platforms?.["linkedin"] ?? []).filter((p) => p.day === 0);
  const formatText = (post, maxLen = 0) => {
    const tagged = post.hashtags?.length ? `${post.copy}

${post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}` : post.copy;
    return maxLen && tagged.length > maxLen ? tagged.slice(0, maxLen - 3) + "\u2026" : tagged;
  };
  const [twitterResults, linkedinResults] = await Promise.allSettled([
    // Twitter/X — 280 char limit, real thread support
    (async () => {
      if (!(platforms.includes("twitter") || platforms.includes("x")) || twitterPosts.length === 0) return [];
      const texts = twitterPosts.map((p) => formatText(p, 280));
      const tweets = await postThread(texts, "authichain");
      return tweets.map((t2) => t2?.url ?? "").filter(Boolean);
    })(),
    // LinkedIn — 3000 char limit, sequential posts
    (async () => {
      if (!platforms.includes("linkedin") || linkedinPosts.length === 0) return [];
      const texts = linkedinPosts.map((p) => formatText(p, 3e3));
      const posts = await postLinkedInThread(texts, "person");
      return posts.map((p) => p.postUrl).filter(Boolean);
    })()
  ]);
  if (twitterResults.status === "fulfilled") postedUrls.push(...twitterResults.value);
  else console.warn("[content.ts] Twitter post failed:", twitterResults.reason);
  if (linkedinResults.status === "fulfilled") postedUrls.push(...linkedinResults.value);
  else console.warn("[content.ts] LinkedIn post failed:", linkedinResults.reason);
  await logActivity({ userId: null, action: "social_posts_scheduled", entityType: "task", entityId: 0, details: {
    taskId: task.id,
    platforms,
    missionId: task.missionId,
    postedUrls,
    totalScheduled: Object.values(calendar.platforms ?? {}).reduce((s, arr) => s + arr.length, 0)
  } });
}
var init_content = __esm({
  "server/agents/content.ts"() {
    "use strict";
    init_llm();
    init_db();
    init_twitter_service();
    init_linkedin_service();
  }
});

// server/agents/closer.ts
import { eq as eq9 } from "drizzle-orm";
async function updateLeadStatus(email, status) {
  const db2 = await getDb();
  if (!db2) return;
  await db2.update(leads).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(leads.email, email.toLowerCase()));
}
async function classifyReplyIntent(replyText, segment) {
  const prompt = `Classify this email reply from a B2B sales prospect for AuthiChain (blockchain product authentication).
Segment: ${segment}
Reply: """${replyText.slice(0, 800)}"""

Return JSON: { "intent": "<one of: interested | wants_proposal | objection | pricing | not_interested | already_customer | unknown>", "reasoning": "..." }`;
  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" }
    });
    const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
    return parsed.intent ?? "unknown";
  } catch {
    return "unknown";
  }
}
async function runCheckReplies(task) {
  const payload = task.payload;
  const { threadId, leadEmail, leadName, leadOrg, leadTitle, segment } = payload;
  const sequence = payload.sequence ?? 1;
  const maxSequence = payload.maxSequence ?? 3;
  const replyCheck = await checkThreadReplies(threadId ?? "");
  if (replyCheck.hasReply && replyCheck.replyText) {
    const intent = await classifyReplyIntent(replyCheck.replyText, segment);
    await updateLeadStatus(leadEmail, "REPLIED");
    await logActivity({
      userId: null,
      action: "reply_received",
      entityType: "task",
      entityId: 0,
      details: { taskId: task.id, leadEmail, segment, intent, replyFrom: replyCheck.replyFrom }
    });
    const nextBase = { leadEmail, leadName, leadOrg, leadTitle, segment, threadId, replyText: replyCheck.replyText };
    const delay48h = new Date(Date.now() + 48 * 60 * 60 * 1e3);
    switch (intent) {
      case "interested":
        await enqueueTask(task.missionId, "SEND_DEMO_PACKET", nextBase);
        break;
      case "wants_proposal":
        await enqueueTask(task.missionId, "GENERATE_PROPOSAL", nextBase);
        break;
      case "objection":
        await enqueueTask(task.missionId, "AUTO_REPLY", { ...nextBase, intent: "objection" });
        break;
      case "pricing":
        await enqueueTask(task.missionId, "AUTO_REPLY", { ...nextBase, intent: "pricing" });
        break;
      case "not_interested":
        await updateLeadStatus(leadEmail, "CLOSED_LOST");
        await logActivity({
          userId: null,
          action: "outcome_signal",
          entityType: "lead",
          entityId: 0,
          details: { signal: "no_response", segment }
        });
        break;
      case "already_customer":
        await updateLeadStatus(leadEmail, "CLOSED_WON");
        break;
      default:
        await enqueueTask(task.missionId, "SEND_DEMO_PACKET", nextBase, delay48h);
    }
    await logActivity({
      userId: null,
      action: "outcome_signal",
      entityType: "lead",
      entityId: 0,
      details: { signal: "email_replied", segment }
    });
    return;
  }
  if (sequence < maxSequence) {
    const delay = new Date(Date.now() + 3 * 24 * 60 * 60 * 1e3);
    await enqueueTask(task.missionId, "FOLLOWUP_SEQUENCE", {
      segment,
      leadEmail,
      leadName,
      leadOrg,
      leadTitle,
      sequence: sequence + 1,
      maxFollowups: maxSequence
    }, delay);
  } else {
    await updateLeadStatus(leadEmail, "CLOSED_LOST");
    await logActivity({
      userId: null,
      action: "outcome_signal",
      entityType: "lead",
      entityId: 0,
      details: { signal: "no_response", segment }
    });
  }
}
async function runSendDemoPacket(task) {
  const payload = task.payload;
  const { leadEmail, leadName, leadOrg, leadTitle, segment, replyText, threadId } = payload;
  const roiContext = SEGMENT_ROI_CONTEXT[segment] ?? SEGMENT_ROI_CONTEXT.DEFAULT;
  const prompt = `You are writing a personalized demo/value email for AuthiChain \u2014 NO sales call required.
Recipient: ${leadName ?? "there"} at ${leadOrg ?? "your organization"}${leadTitle ? ` (${leadTitle})` : ""}
Segment: ${segment}
${replyText ? `Their previous reply: "${replyText.slice(0, 300)}"` : ""}

ROI context for this segment:
${roiContext}

Write a 4\u20136 sentence email that:
1. Opens with their specific pain (tailored to their industry/role)
2. Shows how AuthiChain solves it with a concrete metric or example
3. Includes a short product walk-through summary (3 bullet points max)
4. Closes with two options: (a) self-serve onboarding link, (b) reply to this email with questions
5. No calendly link, no "schedule a call" \u2014 the goal is autonomous close via email

Return JSON: { "subject": "...", "body": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let subject;
  let body;
  try {
    const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
    subject = parsed.subject ?? `AuthiChain for ${leadOrg ?? segment}: How It Works`;
    body = parsed.body ?? "";
  } catch {
    throw new Error("SEND_DEMO_PACKET LLM returned unparseable JSON");
  }
  if (!body) throw new Error("Demo packet LLM returned empty body");
  const sendResult = await sendEmail({ to: leadEmail, subject, body });
  if (sendResult.status === "sent") {
    await updateLeadStatus(leadEmail, "DEMO_SENT");
    const check72h = new Date(Date.now() + 72 * 60 * 60 * 1e3);
    await enqueueTask(task.missionId, "CHECK_REPLIES", {
      threadId: sendResult.threadId ?? threadId,
      leadEmail,
      leadName,
      leadOrg,
      leadTitle,
      segment,
      sequence: 0,
      maxSequence: 1
    }, check72h);
  }
  await logActivity({
    userId: null,
    action: "demo_packet_sent",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, leadEmail, segment, sendStatus: sendResult.status }
  });
}
async function runGenerateProposal(task) {
  const payload = task.payload;
  const { leadEmail, leadName, leadOrg, leadTitle, segment, replyText, threadId } = payload;
  const priceUsd = PILOT_PRICE_USD[segment] ?? PILOT_PRICE_USD.DEFAULT;
  const prompt = `Write a professional B2B proposal for AuthiChain (authichain.com), a blockchain product authentication platform.

Client: ${leadName ?? "Decision-Maker"} at ${leadOrg ?? "your organization"}${leadTitle ? `, ${leadTitle}` : ""}
Segment: ${segment}
Pilot price: $${priceUsd.toLocaleString()} USD (6-month pilot program)
${replyText ? `Context from their last email: "${replyText.slice(0, 400)}"` : ""}

Write a 400\u2013600 word proposal covering:
1. Executive Summary (2\u20133 sentences, specific to their industry)
2. Problem Statement (their specific pain points)
3. Our Solution (how AuthiChain addresses it \u2014 QR authentication, AI confidence scoring, NFT provenance)
4. ROI Analysis (3 bullet points with realistic numbers for their segment)
5. Pilot Scope (what's included in the 6-month pilot: onboarding, integrations, support)
6. Investment: $${priceUsd.toLocaleString()} for 6-month pilot (then [quote renewal])
7. Next Steps (one sentence directing them to the payment link to get started immediately)

Tone: authoritative, specific, zero fluff.
Return JSON: { "subject": "Proposal: AuthiChain Pilot for [Org]", "body": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let subject;
  let proposalContent;
  try {
    const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
    subject = parsed.subject ?? `AuthiChain Pilot Proposal \u2014 ${leadOrg ?? segment}`;
    proposalContent = parsed.body ?? "";
  } catch {
    throw new Error("GENERATE_PROPOSAL LLM returned unparseable JSON");
  }
  if (!proposalContent) throw new Error("Proposal LLM returned empty content");
  let paymentLink;
  let checkoutSessionId;
  if (priceUsd > 0) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: priceUsd * 100,
            product_data: {
              name: `AuthiChain ${segment} Pilot Program`,
              description: `6-month pilot program for ${leadOrg ?? "your organization"}`
            }
          },
          quantity: 1
        }],
        metadata: { leadEmail, segment, missionId: task.missionId, taskId: task.id },
        success_url: "https://authichain.com/welcome?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://authichain.com/pricing",
        customer_email: leadEmail,
        expires_at: Math.floor(Date.now() / 1e3) + 86400 * 30
        // 30 days
      });
      paymentLink = session.url ?? void 0;
      checkoutSessionId = session.id;
    } catch {
    }
  }
  const proposalId = await createProposal({
    leadEmail,
    missionId: task.missionId,
    taskId: task.id,
    segment,
    content: proposalContent,
    paymentLink,
    checkoutSessionId,
    pilotPriceUsd: priceUsd
  });
  const paymentSection = paymentLink ? `

---
\u{1F512} Ready to proceed? Secure your pilot today:
${paymentLink}
(This link is valid for 30 days)` : "";
  const sendResult = await sendEmail({
    to: leadEmail,
    subject,
    body: `${proposalContent}${paymentSection}`
  });
  await updateLeadStatus(leadEmail, "PILOT_PROPOSED");
  await logActivity({
    userId: null,
    action: "proposal_sent",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      leadEmail,
      segment,
      proposalId,
      hasPaymentLink: !!paymentLink,
      sendStatus: sendResult.status,
      priceUsd
    }
  });
}
async function runSendContract(task) {
  const payload = task.payload;
  const { leadEmail, leadName, leadOrg, segment } = payload;
  const priceUsd = PILOT_PRICE_USD[segment] ?? PILOT_PRICE_USD.DEFAULT;
  const prompt = `Draft a simple, professional Service Agreement between AuthiChain Inc. and ${leadOrg ?? "Client"}.

Terms to include:
1. Parties: AuthiChain Inc. (Provider) and ${leadOrg ?? "Client"} (Client), represented by ${leadName ?? "authorized signatory"}
2. Services: 6-month AuthiChain pilot \u2014 product authentication platform including QR code generation, blockchain provenance tracking, AI confidence scoring, dashboard access, and onboarding support
3. Payment: $${priceUsd.toLocaleString()} USD, due upon execution
4. IP: AuthiChain retains all platform IP. Client retains rights to their product data.
5. Data: AuthiChain stores no personally identifiable consumer data beyond scan metadata. Compliant with SOC 2 principles.
6. Termination: Either party may terminate with 30 days written notice after the pilot period.
7. Acceptance: Execution of payment constitutes acceptance of these terms.
8. Governing law: State of Delaware, United States.

Keep it to 250\u2013350 words. Professional but readable \u2014 this is a pilot agreement, not a 50-page enterprise contract.
Return JSON: { "subject": "AuthiChain Service Agreement \u2014 [Org]", "body": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let subject;
  let contractBody;
  try {
    const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
    subject = parsed.subject ?? `AuthiChain Service Agreement \u2014 ${leadOrg ?? segment}`;
    contractBody = parsed.body ?? "";
  } catch {
    throw new Error("SEND_CONTRACT LLM returned unparseable JSON");
  }
  let paymentLink = payload.paymentLink;
  if (!paymentLink && priceUsd > 0) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price_data: { currency: "usd", unit_amount: priceUsd * 100, product_data: { name: `AuthiChain ${segment} Pilot \u2014 Contract Execution` } }, quantity: 1 }],
        metadata: { leadEmail, segment, missionId: task.missionId, taskId: task.id, type: "contract" },
        success_url: "https://authichain.com/welcome?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://authichain.com/pricing",
        customer_email: leadEmail,
        expires_at: Math.floor(Date.now() / 1e3) + 86400 * 14
        // 14 days to sign
      });
      paymentLink = session.url ?? void 0;
    } catch {
    }
  }
  const paymentSection = paymentLink ? `

---
To execute this agreement, complete payment here:
${paymentLink}
(Link expires in 14 days. Payment constitutes acceptance of the above terms.)` : "";
  const sendResult = await sendEmail({
    to: leadEmail,
    subject,
    body: `${contractBody}${paymentSection}`
  });
  await logActivity({
    userId: null,
    action: "contract_sent",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, leadEmail, segment, sendStatus: sendResult.status, hasPaymentLink: !!paymentLink }
  });
}
async function runAutoReply(task) {
  const payload = task.payload;
  const { leadEmail, leadName, leadOrg, segment, replyText, intent, threadId } = payload;
  const intentGuidance = intent === "pricing" ? `Pricing context for ${segment}: ${PRICING_TABLE[segment] ?? PRICING_TABLE.DEFAULT}
Provide clear pricing, justify the ROI, and offer a direct payment link.` : `This is an objection. Address it directly, confidently, and with evidence. Do NOT be defensive.`;
  const prompt = `You are responding to a prospect on behalf of AuthiChain. No hedging \u2014 be direct and close.

Prospect: ${leadName ?? "there"} at ${leadOrg ?? "your org"}
Their message: """${replyText.slice(0, 600)}"""
Intent category: ${intent}
${intentGuidance}

Write a 3\u20135 sentence reply that:
1. Acknowledges their specific point (one sentence)
2. Addresses it with facts/ROI (2\u20133 sentences)
3. Closes with a clear next step: "Reply to confirm and I'll send the agreement" or direct payment link offer

Return JSON: { "subject": "Re: [keep thread subject]", "body": "..." }`;
  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" }
  });
  let subject;
  let body;
  try {
    const parsed = JSON.parse(result.choices[0].message.content ?? "{}");
    subject = parsed.subject ?? `Re: AuthiChain`;
    body = parsed.body ?? "";
  } catch {
    throw new Error("AUTO_REPLY LLM returned unparseable JSON");
  }
  const sendResult = await sendEmail({ to: leadEmail, subject, body });
  if (sendResult.status === "sent") {
    const check72h = new Date(Date.now() + 72 * 60 * 60 * 1e3);
    await enqueueTask(task.missionId, "CHECK_REPLIES", {
      threadId: sendResult.threadId ?? threadId,
      leadEmail,
      leadName,
      leadOrg,
      segment,
      sequence: 0,
      maxSequence: 1
    }, check72h);
  }
  await logActivity({
    userId: null,
    action: "auto_reply_sent",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, leadEmail, segment, intent, sendStatus: sendResult.status }
  });
}
var PILOT_PRICE_USD, SEGMENT_ROI_CONTEXT, PRICING_TABLE;
var init_closer = __esm({
  "server/agents/closer.ts"() {
    "use strict";
    init_llm();
    init_email_service();
    init_db();
    init_schema();
    init_stripe_service();
    PILOT_PRICE_USD = {
      GOV: 25e3,
      RETAIL: 5e3,
      PARTNER: 1e4,
      PRESS: 0,
      // press is comp
      DEFAULT: 1e4
    };
    SEGMENT_ROI_CONTEXT = {
      GOV: "Government agencies lose billions annually to counterfeit goods in procurement. AuthiChain provides instant blockchain verification at point-of-receipt.",
      RETAIL: "Retail brands lose 20\u201340% of premium revenue to counterfeit products. AuthiChain gives every SKU a tamper-evident QR code customers can scan to verify authenticity.",
      PARTNER: "Embed AuthiChain's authentication API in 30 minutes. White-label the dashboard. Add a new revenue stream without building the infra.",
      PRESS: "AuthiChain is the first platform to combine AI confidence scoring with NFT provenance tracking for physical product authentication.",
      DEFAULT: "AuthiChain enables brands to verify product authenticity via blockchain-backed QR codes and AI confidence scoring."
    };
    PRICING_TABLE = {
      GOV: "$25,000 for a 6-month pilot. Includes full onboarding, integrations, dedicated support, and a blockchain dashboard. Government pricing is fixed \u2014 no negotiation on scope, but we can phase the payment.",
      RETAIL: "$5,000 for a 6-month pilot. Includes unlimited SKU onboarding, QR code generation, authentication analytics, and brand protection reporting. ROI typically pays back within 60 days.",
      PARTNER: "$10,000 for 6 months. Includes API access, white-label dashboard, co-marketing, and a dedicated integration engineer.",
      DEFAULT: "Pricing is $5,000\u2013$25,000 depending on scope, with a 6-month pilot structure. We can tailor the package to your needs."
    };
  }
});

// server/heygen-service.ts
async function heygenFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": ENV.heygenApiKey,
      "Content-Type": "application/json",
      ...options.headers ?? {}
    }
  });
  const json2 = await res.json();
  if (json2.error) throw new Error(`HeyGen: ${JSON.stringify(json2.error)}`);
  return json2;
}
async function listAvatars() {
  const json2 = await heygenFetch("/v2/avatars");
  return json2.data?.avatars ?? [];
}
async function listVoices() {
  const json2 = await heygenFetch("/v2/voices");
  return json2.data?.voices ?? [];
}
async function getVideoStatus(videoId) {
  const json2 = await heygenFetch(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
  return json2.data;
}
async function generateVideo(params) {
  const dim = DIMENSIONS[params.aspectRatio ?? "16:9"];
  const json2 = await heygenFetch("/v2/video/generate", {
    method: "POST",
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: "avatar",
          avatar_id: params.avatarId,
          avatar_style: "normal"
        },
        voice: {
          type: "text",
          input_text: params.script,
          voice_id: params.voiceId
        }
      }],
      dimension: dim,
      title: params.title
    })
  });
  const videoId = json2.data?.video_id;
  if (!videoId) throw new Error("HeyGen did not return a video_id");
  return videoId;
}
async function draftOutreachScript(params) {
  const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
  const prompt = `Write a 30-second outreach video script (under 80 words) for an AI avatar to say.
Target: ${params.firstName} at ${params.company} (${params.segment} sector).
Use case hook: ${params.useCase}.
Product: AuthiChain \u2014 product authentication & anti-counterfeiting platform.
Tone: professional, warm, direct. End with a soft CTA to book a 15-min call.
Return ONLY the script text, no labels or quotes.`;
  const res = await invokeLLM2({ messages: [{ role: "user", content: prompt }] });
  return res.choices?.[0]?.message?.content?.trim() ?? "";
}
var BASE, DIMENSIONS;
var init_heygen_service = __esm({
  "server/heygen-service.ts"() {
    "use strict";
    init_env();
    BASE = "https://api.heygen.com";
    DIMENSIONS = {
      "16:9": { width: 1280, height: 720 },
      "9:16": { width: 720, height: 1280 },
      "1:1": { width: 720, height: 720 }
    };
  }
});

// server/youtube-service.ts
async function getAccessToken2(channel = "authichain") {
  const cache = channel === "qron" ? _qronTokenCache : _tokenCache2;
  if (cache && cache.expiresAt > Date.now() + 3e4) return cache.token;
  const refreshToken = channel === "qron" ? process.env.YOUTUBE_QRON_REFRESH_TOKEN ?? "" : process.env.YOUTUBE_REFRESH_TOKEN ?? "";
  if (!refreshToken) throw new Error(`YOUTUBE_${channel === "qron" ? "QRON_" : ""}REFRESH_TOKEN not set`);
  const res = await fetch(YT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${await res.text()}`);
  const json2 = await res.json();
  const entry = { token: json2.access_token, expiresAt: Date.now() + json2.expires_in * 1e3 };
  if (channel === "qron") _qronTokenCache = entry;
  else _tokenCache2 = entry;
  return json2.access_token;
}
async function uploadVideo(params) {
  const token = await getAccessToken2(params.channel ?? "authichain");
  const videoRes = await fetch(params.videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to fetch video from ${params.videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();
  const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
  const metadata = {
    snippet: {
      title: params.title,
      description: params.description,
      tags: params.tags ?? ["AuthiChain", "QRON", "authentication", "blockchain"],
      categoryId: params.category ?? "28"
    },
    status: { privacyStatus: params.privacy ?? "public" }
  };
  const initRes = await fetch(
    `${YT_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(videoBuffer.byteLength)
      },
      body: JSON.stringify(metadata)
    }
  );
  if (!initRes.ok) throw new Error(`YouTube upload init failed: ${await initRes.text()}`);
  const uploadUri = initRes.headers.get("Location");
  if (!uploadUri) throw new Error("YouTube did not return an upload URI");
  const uploadRes = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(videoBuffer.byteLength)
    },
    body: videoBuffer
  });
  if (!uploadRes.ok) throw new Error(`YouTube upload failed: ${await uploadRes.text()}`);
  const uploadJson = await uploadRes.json();
  const videoId = uploadJson.id;
  return { videoId, youtubeUrl: `https://www.youtube.com/watch?v=${videoId}` };
}
var YT_TOKEN_URL, YT_UPLOAD_URL, _tokenCache2, _qronTokenCache;
var init_youtube_service = __esm({
  "server/youtube-service.ts"() {
    "use strict";
    YT_TOKEN_URL = "https://oauth2.googleapis.com/token";
    YT_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
    _tokenCache2 = null;
    _qronTokenCache = null;
  }
});

// server/agents/heygen-video.ts
async function runGenerateOutreachVideo(task) {
  const p = task.payload;
  let avatarId = p.avatarId;
  if (!avatarId) {
    const avatars = await listAvatars();
    if (!avatars.length) throw new Error("No HeyGen avatars available");
    avatarId = avatars[0].avatar_id;
  }
  let voiceId = p.voiceId;
  if (!voiceId) {
    const voices = await listVoices();
    const enVoice = voices.find((v) => v.language?.startsWith("en")) ?? voices[0];
    if (!enVoice) throw new Error("No HeyGen voices available");
    voiceId = enVoice.voice_id;
  }
  const script = await draftOutreachScript({
    firstName: p.firstName,
    company: p.company,
    segment: p.segment,
    useCase: p.useCase ?? `anti-counterfeiting for ${p.segment.toLowerCase()} sector`
  });
  const videoId = await generateVideo({
    avatarId,
    voiceId,
    script,
    title: `Outreach \u2014 ${p.firstName} @ ${p.company}`
  });
  let videoUrl;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await getVideoStatus(videoId);
    if (status.status === "completed") {
      videoUrl = status.video_url;
      break;
    }
    if (status.status === "failed") {
      throw new Error(`HeyGen video failed: ${status.error ?? "unknown"}`);
    }
  }
  if (!videoUrl) throw new Error("HeyGen video timed out");
  let youtubeUrl;
  try {
    const yt = await uploadVideo({
      videoUrl,
      title: `AuthiChain Outreach \u2014 ${p.company} | Anti-Counterfeiting Demo`,
      description: `Personalized outreach video for ${p.firstName} at ${p.company}.

AuthiChain provides blockchain-backed product authentication for the ${p.segment} sector.

Learn more: https://authichain.com`,
      tags: ["AuthiChain", "authentication", "blockchain", "anti-counterfeiting", p.segment.toLowerCase()],
      privacy: "unlisted",
      // Keep outreach videos unlisted
      channel: "authichain"
    });
    youtubeUrl = yt.youtubeUrl;
  } catch (e) {
    console.warn("[heygen-video] YouTube upload failed (non-fatal):", e);
  }
  await logActivity({
    userId: 0,
    action: "heygen_video_generated",
    entityType: "lead",
    entityId: p.leadId,
    details: { videoId, videoUrl, youtubeUrl, script, avatarId, voiceId }
  });
}
var POLL_INTERVAL_MS, MAX_POLLS;
var init_heygen_video = __esm({
  "server/agents/heygen-video.ts"() {
    "use strict";
    init_db();
    init_heygen_service();
    init_youtube_service();
    POLL_INTERVAL_MS = 8e3;
    MAX_POLLS = 30;
  }
});

// server/agents/dev-team/github-service.ts
var github_service_exports = {};
__export(github_service_exports, {
  addPRComment: () => addPRComment,
  addPRReview: () => addPRReview,
  createBranch: () => createBranch,
  createIssue: () => createIssue,
  createPR: () => createPR,
  deleteBranch: () => deleteBranch,
  getBranchSha: () => getBranchSha,
  getDefaultBranch: () => getDefaultBranch,
  getFile: () => getFile,
  getLatestRunForSha: () => getLatestRunForSha,
  getPR: () => getPR,
  getPRFiles: () => getPRFiles,
  listDeployments: () => listDeployments,
  listFiles: () => listFiles,
  mergePR: () => mergePR,
  searchCode: () => searchCode,
  waitForCIRun: () => waitForCIRun,
  writeFile: () => writeFile
});
function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}
function repo() {
  const owner = process.env.GITHUB_OWNER ?? "undone0603";
  const name = process.env.GITHUB_REPO ?? "authichain-unified";
  return `${owner}/${name}`;
}
async function gh(method, path, body) {
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : void 0
  });
  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`GitHub API ${method} ${path} \u2192 ${res.status}: ${text2}`);
  }
  if (res.status === 204) return null;
  return res.json();
}
async function getDefaultBranch() {
  const data = await gh("GET", `/repos/${repo()}`);
  return data.default_branch ?? "main";
}
async function getBranchSha(branch) {
  const data = await gh("GET", `/repos/${repo()}/git/ref/heads/${encodeURIComponent(branch)}`);
  return data.object.sha;
}
async function createBranch(branchName) {
  const base = await getDefaultBranch();
  const sha = await getBranchSha(base);
  await gh("POST", `/repos/${repo()}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha
  });
}
async function deleteBranch(branchName) {
  await gh("DELETE", `/repos/${repo()}/git/refs/heads/${encodeURIComponent(branchName)}`);
}
async function getFile(path, branch) {
  try {
    const qs = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const data = await gh("GET", `/repos/${repo()}/contents/${path}${qs}`);
    return {
      path,
      content: Buffer.from(data.content, "base64").toString("utf-8"),
      sha: data.sha,
      encoding: data.encoding
    };
  } catch {
    return null;
  }
}
async function listFiles(dirPath, branch) {
  try {
    const qs = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const data = await gh("GET", `/repos/${repo()}/contents/${dirPath}${qs}`);
    if (!Array.isArray(data)) return [];
    return data.filter((f) => f.type === "file").map((f) => f.path);
  } catch {
    return [];
  }
}
async function writeFile(opts) {
  const body = {
    message: opts.message,
    content: Buffer.from(opts.content, "utf-8").toString("base64"),
    branch: opts.branch
  };
  if (opts.sha) body.sha = opts.sha;
  const data = await gh("PUT", `/repos/${repo()}/contents/${opts.path}`, body);
  return { sha: data.content.sha };
}
async function createPR(opts) {
  const base = opts.base ?? await getDefaultBranch();
  return gh("POST", `/repos/${repo()}/pulls`, {
    title: opts.title,
    body: opts.body,
    head: opts.head,
    base,
    draft: false
  });
}
async function getPR(number) {
  return gh("GET", `/repos/${repo()}/pulls/${number}`);
}
async function getPRFiles(number) {
  return gh("GET", `/repos/${repo()}/pulls/${number}/files`);
}
async function addPRReview(opts) {
  await gh("POST", `/repos/${repo()}/pulls/${opts.prNumber}/reviews`, {
    body: opts.body,
    event: opts.event,
    comments: opts.comments ?? []
  });
}
async function mergePR(number, mergeMethod = "squash") {
  await gh("PUT", `/repos/${repo()}/pulls/${number}/merge`, {
    merge_method: mergeMethod
  });
}
async function addPRComment(number, body) {
  await gh("POST", `/repos/${repo()}/issues/${number}/comments`, { body });
}
async function getLatestRunForSha(sha) {
  const data = await gh("GET", `/repos/${repo()}/actions/runs?head_sha=${sha}&per_page=10`);
  const runs = data.workflow_runs ?? [];
  return runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
}
async function waitForCIRun(sha, opts) {
  const timeout = opts?.timeoutMs ?? 10 * 60 * 1e3;
  const interval = opts?.pollIntervalMs ?? 2e4;
  const deadline = Date.now() + timeout;
  let run = null;
  for (let i = 0; i < 6 && !run; i++) {
    await new Promise((r) => setTimeout(r, 1e4));
    run = await getLatestRunForSha(sha);
  }
  if (!run) return null;
  while (Date.now() < deadline) {
    run = await getLatestRunForSha(sha);
    if (run?.status === "completed") return run;
    await new Promise((r) => setTimeout(r, interval));
  }
  return run;
}
async function createIssue(opts) {
  return gh("POST", `/repos/${repo()}/issues`, opts);
}
async function searchCode(query) {
  const q = encodeURIComponent(`${query} repo:${repo()}`);
  const data = await gh("GET", `/search/code?q=${q}&per_page=10`);
  return (data.items ?? []).map((i) => ({ path: i.path, url: i.html_url }));
}
async function listDeployments(environment) {
  const qs = environment ? `?environment=${encodeURIComponent(environment)}` : "";
  const data = await gh("GET", `/repos/${repo()}/deployments${qs}`);
  return Array.isArray(data) ? data : [];
}
var GH_API;
var init_github_service = __esm({
  "server/agents/dev-team/github-service.ts"() {
    "use strict";
    GH_API = "https://api.github.com";
  }
});

// server/agents/dev-team/code-writer.ts
async function runPlanSprint(task) {
  const p = task.payload;
  const branchName = `agentz/sprint-${task.id.slice(0, 8)}`;
  const prompt = `You are AgentZ, technical lead for authichain-unified.

Feature request: "${p.feature}"
${p.context ? `
Additional context: ${p.context}` : ""}
${p.targetFiles?.length ? `
Hinted files: ${p.targetFiles.join(", ")}` : ""}

Break this feature into a concrete development plan. Return JSON:
{
  "branch": "${branchName}",
  "prTitle": "feat: <short title>",
  "prBody": "## What\\n...\\n\\n## Why\\n...\\n\\n## Testing\\n...",
  "tasks": [
    {
      "kind": "WRITE_CODE",
      "payload": {
        "branch": "${branchName}",
        "feature": "...",
        "filesToModify": ["path/to/existing.ts"],
        "filesToCreate": ["path/to/new.ts"],
        "context": "specific instructions for this code change"
      }
    }
  ],
  "followupTasks": [
    { "kind": "OPEN_PR",     "payload": { "branch": "${branchName}", "title": "...", "body": "..." } },
    { "kind": "RUN_TESTS",   "payload": { "branch": "${branchName}" } },
    { "kind": "CODE_REVIEW", "payload": { "branch": "${branchName}" } }
  ]
}

Rules:
- Split large features into multiple WRITE_CODE tasks (one per concern: DB schema, server, client)
- Always include OPEN_PR \u2192 RUN_TESTS \u2192 CODE_REVIEW after WRITE_CODE tasks
- Keep each WRITE_CODE task focused on 1-3 files maximum`;
  const result = await invokeLLM({
    messages: [
      { role: "system", content: CODEBASE_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    responseFormat: { type: "json_object" }
  });
  let plan;
  try {
    plan = JSON.parse(result.choices[0].message.content);
  } catch {
    throw new Error("PLAN_SPRINT: LLM returned unparseable JSON");
  }
  await createBranch(plan.branch);
  const { db: db2 } = await Promise.resolve().then(() => (init_schema(), schema_exports)).then(() => Promise.resolve().then(() => (init_db(), db_exports)));
  const allTasks = [...plan.tasks, ...plan.followupTasks];
  for (let i = 0; i < allTasks.length; i++) {
    const t2 = allTasks[i];
    const taskId = crypto.randomUUID();
    const runAt = new Date(Date.now() + (i + 1) * 5 * 60 * 1e3);
    await db2.execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,$3,$4,'PENDING',$5)`,
      [taskId, task.missionId, t2.kind, JSON.stringify(t2.payload), runAt]
    );
  }
  await logActivity({
    userId: null,
    action: "sprint_planned",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      branch: plan.branch,
      tasksEnqueued: allTasks.length,
      feature: p.feature
    }
  });
}
async function runWriteCode(task) {
  const p = task.payload;
  const filesToModify = p.filesToModify ?? [];
  const filesToCreate = p.filesToCreate ?? [];
  const existingFiles = [];
  for (const path of filesToModify) {
    const file = await getFile(path, p.branch);
    if (file) existingFiles.push({ path, content: file.content });
  }
  if (!filesToModify.length && !filesToCreate.length) {
    const searchResults = await searchCode(p.feature.split(" ").slice(0, 3).join(" "));
    for (const r of searchResults.slice(0, 4)) {
      const file = await getFile(r.path, p.branch);
      if (file) existingFiles.push({ path: r.path, content: file.content });
    }
  }
  const archFiles = ["server/missions/types.ts", "server/_core/env.ts"];
  for (const path of archFiles) {
    if (!existingFiles.find((f) => f.path === path)) {
      const file = await getFile(path, p.branch);
      if (file) existingFiles.push({ path, content: file.content.slice(0, 2e3) });
    }
  }
  const fileContext = existingFiles.map(
    (f) => `### ${f.path}
\`\`\`typescript
${f.content}
\`\`\``
  ).join("\n\n");
  const userPrompt = `Feature: "${p.feature}"
${p.context ? `
Instructions: ${p.context}` : ""}
${p.prNumber ? `
This is a fix for review feedback on PR #${p.prNumber}` : ""}

Files to modify: ${filesToModify.join(", ") || "none \u2014 use your judgement based on codebase knowledge"}
Files to create: ${filesToCreate.join(", ") || "none specified"}

## Current file contents:
${fileContext || "(no files provided \u2014 create new files as needed)"}

Write the code changes. Return the full JSON response as specified in your system prompt.`;
  const result = await invokeLLM({
    messages: [
      { role: "system", content: CODEBASE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    responseFormat: { type: "json_object" }
  });
  let codeResult;
  try {
    codeResult = JSON.parse(result.choices[0].message.content);
  } catch {
    throw new Error("WRITE_CODE: LLM returned unparseable JSON");
  }
  if (!codeResult.files?.length) {
    throw new Error("WRITE_CODE: LLM returned no files");
  }
  const committedFiles = [];
  for (const file of codeResult.files) {
    const existing = await getFile(file.path, p.branch);
    await writeFile({
      path: file.path,
      content: file.content,
      message: `[AgentZ] ${file.commitMessage}`,
      branch: p.branch,
      sha: existing?.sha
    });
    committedFiles.push(file.path);
  }
  await logActivity({
    userId: null,
    action: "code_written",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      branch: p.branch,
      files: committedFiles,
      summary: codeResult.summary,
      nextSteps: codeResult.nextSteps
    }
  });
}
var CODEBASE_SYSTEM_PROMPT;
var init_code_writer = __esm({
  "server/agents/dev-team/code-writer.ts"() {
    "use strict";
    init_llm();
    init_db();
    init_github_service();
    CODEBASE_SYSTEM_PROMPT = `You are AgentZ, the autonomous senior engineer for authichain-unified.

## Tech stack
- Runtime: Cloudflare Workers (nodejs_compat), TypeScript
- Frontend: React 19, Vite, wouter (routing), shadcn/ui, Tailwind CSS, TanStack Query via tRPC
- Backend: tRPC v11, Drizzle ORM, PostgreSQL (Supabase), Zod validation
- Auth: JWT cookies via getSessionCookieOptions
- Blockchain: Thirdweb SDK, Polygon + Base
- AI: Forge API (OpenAI-compatible) via server/_core/llm.ts invokeLLM()
- Payments: Stripe
- CRM: HubSpot
- Deployment: Cloudflare Worker + Vercel (static assets)

## Project structure
- server/routers.ts         \u2014 all tRPC procedures (add new routers here)
- server/db.ts              \u2014 all database queries (add helpers here)
- server/_core/env.ts       \u2014 env var access (add new vars here)
- server/_core/llm.ts       \u2014 invokeLLM(params) for all LLM calls
- server/agents/            \u2014 pipeline agents (one file per concern)
- server/jobs/              \u2014 cron job runners
- server/missions/types.ts  \u2014 TaskKind + MissionType enums
- drizzle/schema.ts         \u2014 Drizzle table definitions
- drizzle/migrations/       \u2014 numbered SQL migration files
- client/src/pages/         \u2014 React page components (lazy-loaded in App.tsx)
- client/src/components/    \u2014 shared UI components
- client/src/lib/trpc.ts    \u2014 tRPC client (import trpc from here)

## Coding conventions
- All imports use .js extension (even for .ts files) \u2014 required for ESM
- Agents export async function run<Name>(task: Task): Promise<void>
- Use logActivity() for audit trail, createSystemNotification() for user alerts
- New pages need: lazy import in App.tsx + Route + nav item in DashboardLayout.tsx
- New tRPC routes: add to appRouter in routers.ts, use adminProcedure for admin-only
- DB helpers: add to db.ts, use drizzle ORM syntax
- Env vars: add to ENV object in server/_core/env.ts AND wrangler.toml comment

## Response format
Always respond with a JSON object:
{
  "files": [
    {
      "path": "relative/path/from/repo/root",
      "content": "complete file content \u2014 never partial",
      "action": "create" | "update",
      "commitMessage": "short commit message for this file"
    }
  ],
  "summary": "one-sentence summary of what was changed",
  "nextSteps": ["any notes for the PR description or code reviewer"]
}

IMPORTANT: Always return COMPLETE file content. Never use "..." or "existing code here" placeholders.`;
  }
});

// server/agents/dev-team/pr-manager.ts
async function runOpenPR(task) {
  const p = task.payload;
  const pr = await createPR({
    title: p.title,
    body: p.body,
    head: p.branch,
    base: p.base
  });
  await logActivity({
    userId: null,
    action: "pr_opened",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      prNumber: pr.number,
      prUrl: pr.html_url,
      branch: p.branch
    }
  });
  const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const reviewTaskId = crypto.randomUUID();
  await db2.execute(
    `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'CODE_REVIEW',$3,'PENDING',NOW() + INTERVAL '2 minutes')`,
    [reviewTaskId, task.missionId, JSON.stringify({ branch: p.branch, prNumber: pr.number })]
  );
}
async function runCodeReview(task) {
  const p = task.payload;
  const pr = await getPR(p.prNumber);
  const changedFiles = await getPRFiles(p.prNumber);
  const fileDiffs = changedFiles.slice(0, 10).map(
    (f) => `### ${f.filename} (${f.status})
\`\`\`diff
${f.patch ?? "(binary or large file)"}
\`\`\``
  ).join("\n\n");
  const result = await invokeLLM({
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "user", content: `PR #${p.prNumber}: ${pr.title}

${pr.body}

## Changed Files

${fileDiffs}` }
    ],
    responseFormat: { type: "json_object" }
  });
  let review;
  try {
    review = JSON.parse(result.choices[0].message.content);
  } catch {
    throw new Error("CODE_REVIEW: LLM returned unparseable JSON");
  }
  const ghEvent = review.verdict === "APPROVE" ? "APPROVE" : review.verdict === "REQUEST_CHANGES" ? "REQUEST_CHANGES" : "COMMENT";
  const reviewBody = [
    `**AgentZ Code Review** \u2014 ${review.summary}`,
    review.requiredFixes.length ? `
**Required fixes:**
${review.requiredFixes.map((f) => `- ${f}`).join("\n")}` : "",
    review.suggestions.length ? `
**Suggestions:**
${review.suggestions.map((s) => `- ${s}`).join("\n")}` : ""
  ].filter(Boolean).join("\n");
  await addPRReview({
    prNumber: p.prNumber,
    body: reviewBody,
    event: ghEvent,
    comments: review.inlineComments.filter((c) => c.line > 0).map((c) => ({ path: c.path, line: c.line, body: c.body }))
  });
  await logActivity({
    userId: null,
    action: "code_review_posted",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      prNumber: p.prNumber,
      verdict: review.verdict,
      summary: review.summary,
      fixes: review.requiredFixes
    }
  });
  const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  if (review.verdict === "APPROVE") {
    await db2.execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'MERGE_PR',$3,'PENDING',NOW() + INTERVAL '1 minute')`,
      [crypto.randomUUID(), task.missionId, JSON.stringify({ prNumber: p.prNumber, branch: p.branch })]
    );
  } else if (review.verdict === "REQUEST_CHANGES") {
    await db2.execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'WRITE_CODE',$3,'PENDING',NOW() + INTERVAL '2 minutes')`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch: p.branch,
          feature: `Fix review feedback on PR #${p.prNumber}`,
          context: `Required fixes:
${review.requiredFixes.join("\n")}`,
          prNumber: p.prNumber
        })
      ]
    );
  }
}
async function runMergePR(task) {
  const p = task.payload;
  if (ENV.requireDevApproval) {
    await markTaskWaitingHuman(task.id);
    await addPRComment(
      p.prNumber,
      `**AgentZ:** PR is ready to merge \u2705

Tests passed \xB7 Code reviewed \xB7 Awaiting human approval.

To proceed: re-queue this task or merge manually on GitHub.`
    );
    await logActivity({
      userId: null,
      action: "merge_awaiting_approval",
      entityType: "task",
      entityId: 0,
      details: { taskId: task.id, missionId: task.missionId, prNumber: p.prNumber }
    });
    return;
  }
  const pr = await getPR(p.prNumber);
  if (pr.state !== "open") {
    throw new Error(`PR #${p.prNumber} is already ${pr.state}`);
  }
  if (pr.mergeable === false) {
    throw new Error(`PR #${p.prNumber} has merge conflicts \u2014 needs manual resolution`);
  }
  await mergePR(p.prNumber, "squash");
  const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  await db2.execute(
    `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'MONITOR_DEPLOY',$3,'PENDING',NOW() + INTERVAL '3 minutes')`,
    [crypto.randomUUID(), task.missionId, JSON.stringify({ prNumber: p.prNumber, branch: p.branch })]
  );
  await logActivity({
    userId: null,
    action: "pr_merged",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, missionId: task.missionId, prNumber: p.prNumber }
  });
}
var REVIEW_SYSTEM_PROMPT;
var init_pr_manager = __esm({
  "server/agents/dev-team/pr-manager.ts"() {
    "use strict";
    init_llm();
    init_db();
    init_env();
    init_github_service();
    REVIEW_SYSTEM_PROMPT = `You are AgentZ, a rigorous senior code reviewer for authichain-unified.

Review for:
1. Correctness \u2014 logic bugs, off-by-one errors, race conditions
2. Security \u2014 SQL injection, XSS, unvalidated inputs, exposed secrets
3. Types \u2014 TypeScript errors, missing null checks
4. Conventions \u2014 .js imports, proper logActivity() usage, correct tRPC patterns
5. Performance \u2014 unnecessary DB queries, missing indexes, N+1 problems
6. Completeness \u2014 missing edge cases, incomplete error handling

Return JSON:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "summary": "1-2 sentence overall assessment",
  "inlineComments": [
    { "path": "file/path.ts", "line": 42, "body": "comment text" }
  ],
  "requiredFixes": ["description of blocking issue 1", ...],
  "suggestions": ["non-blocking suggestion 1", ...]
}

If there are no blocking issues, verdict should be APPROVE.
Only REQUEST_CHANGES for actual bugs, security issues, or broken TypeScript.`;
  }
});

// server/agents/dev-team/test-runner.ts
async function runTests(task) {
  const p = task.payload;
  let headSha;
  if (p.prNumber) {
    const pr = await getPR(p.prNumber);
    headSha = pr.head.sha;
  } else {
    const { getBranchSha: getBranchSha2 } = await Promise.resolve().then(() => (init_github_service(), github_service_exports));
    headSha = await getBranchSha2(p.branch);
  }
  const run = await waitForCIRun(headSha, { timeoutMs: 10 * 60 * 1e3 });
  if (!run) {
    throw new Error(`RUN_TESTS: No CI run found for ${p.branch} (SHA: ${headSha?.slice(0, 8)})`);
  }
  const passed = run.conclusion === "success";
  await logActivity({
    userId: null,
    action: passed ? "tests_passed" : "tests_failed",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      branch: p.branch,
      runId: run.id,
      conclusion: run.conclusion,
      runUrl: run.html_url
    }
  });
  if (!passed) {
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    await db2.execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'AUTO_FIX',$3,'PENDING',NOW() + INTERVAL '2 minutes')`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch: p.branch,
          errorSummary: `CI failed on branch ${p.branch}. Run: ${run.html_url}. Conclusion: ${run.conclusion}.`
        })
      ]
    );
    throw new Error(`Tests failed (${run.conclusion}). AUTO_FIX enqueued. See: ${run.html_url}`);
  }
}
async function runMonitorDeploy(task) {
  const p = task.payload;
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? `https://authichain-unified.${process.env.CLOUDFLARE_ACCOUNT_ID}.workers.dev`;
  let deployHealthy = false;
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 3e4));
    try {
      const res = await fetch(`${workerUrl}/api/health`, {
        signal: AbortSignal.timeout(1e4)
      });
      if (res.ok || res.status < 500) {
        deployHealthy = true;
        break;
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  await logActivity({
    userId: null,
    action: deployHealthy ? "deploy_healthy" : "deploy_failed",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, missionId: task.missionId, prNumber: p.prNumber, lastError }
  });
  if (!deployHealthy) {
    const issue = await createIssue({
      title: `[AgentZ] Deploy health check failed after PR #${p.prNumber}`,
      body: `Automatic deploy monitor detected an issue after merging PR #${p.prNumber}.

**Error:** ${lastError}

**Branch:** ${p.branch}

Investigate and fix or revert.`,
      labels: ["bug", "deploy", "agentz"]
    });
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    await db2.execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'AUTO_FIX',$3,'PENDING',NOW())`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch: `agentz/hotfix-${task.id.slice(0, 8)}`,
          errorSummary: `Production health check failing: ${lastError}. Issue: ${issue.html_url}`
        })
      ]
    );
    const { getAllAdminIds } = await Promise.resolve().then(() => (init_db(), db_exports));
    const adminIds = await getAllAdminIds();
    for (const adminId of adminIds) {
      await createSystemNotification(
        adminId,
        "\u{1F6A8} Deploy Health Check Failed",
        `Post-deploy health check failed after PR #${p.prNumber}: ${lastError}. AUTO_FIX queued.`,
        "alert",
        issue.html_url
      );
    }
  }
}
async function runFileBug(task) {
  const p = task.payload;
  const issue = await createIssue({
    title: p.title,
    body: p.body,
    labels: p.labels ?? ["bug", "agentz"]
  });
  await logActivity({
    userId: null,
    action: "bug_filed",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, missionId: task.missionId, issueNumber: issue.number, issueUrl: issue.html_url }
  });
}
async function runAutoFix(task) {
  const p = task.payload;
  const keywords = p.errorSummary.split(" ").slice(0, 5).join(" ");
  const searchResults = await searchCode(keywords);
  const result = await invokeLLM({
    messages: [
      { role: "system", content: DIAGNOSIS_PROMPT },
      { role: "user", content: `Error: ${p.errorSummary}

Related files found: ${searchResults.map((r) => r.path).join(", ")}
${p.failedFiles?.length ? `
Failed files: ${p.failedFiles.join(", ")}` : ""}` }
    ],
    responseFormat: { type: "json_object" }
  });
  let diagnosis;
  try {
    diagnosis = JSON.parse(result.choices[0].message.content);
  } catch {
    throw new Error("AUTO_FIX: LLM returned unparseable JSON");
  }
  const targetBranch = diagnosis.isHotfix ? `agentz/hotfix-${task.id.slice(0, 8)}` : p.branch;
  if (diagnosis.isHotfix) {
    const { createBranch: createBranch2 } = await Promise.resolve().then(() => (init_github_service(), github_service_exports));
    await createBranch2(targetBranch);
  }
  const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const fixTaskId = crypto.randomUUID();
  await db2.execute(
    `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'WRITE_CODE',$3,'PENDING',NOW() + INTERVAL '1 minute')`,
    [
      fixTaskId,
      task.missionId,
      JSON.stringify({
        branch: targetBranch,
        feature: `Auto-fix: ${diagnosis.diagnosis}`,
        filesToModify: diagnosis.filesToFix,
        context: diagnosis.fixDescription
      })
    ]
  );
  if (diagnosis.isHotfix) {
    const runAt2 = new Date(Date.now() + 6 * 60 * 1e3);
    await db2.execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'OPEN_PR',$3,'PENDING',$4)`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch: targetBranch,
          title: `fix: ${diagnosis.diagnosis.slice(0, 70)}`,
          body: `**Auto-fix by AgentZ**

**Root cause:** ${diagnosis.diagnosis}

**Original error:** ${p.errorSummary}`
        }),
        runAt2
      ]
    );
  }
  await logActivity({
    userId: null,
    action: "auto_fix_queued",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      diagnosis: diagnosis.diagnosis,
      branch: targetBranch,
      isHotfix: diagnosis.isHotfix,
      fixTaskId
    }
  });
}
var DIAGNOSIS_PROMPT;
var init_test_runner = __esm({
  "server/agents/dev-team/test-runner.ts"() {
    "use strict";
    init_llm();
    init_db();
    init_github_service();
    DIAGNOSIS_PROMPT = `You are AgentZ, a debugging expert for authichain-unified.

Given an error summary, identify the most likely root cause and the exact files that need to be changed to fix it.

Return JSON:
{
  "diagnosis": "1-2 sentence root cause analysis",
  "filesToFix": ["path/to/file.ts"],
  "fixDescription": "clear instruction for the WRITE_CODE agent to follow",
  "isHotfix": true/false  // true if this needs a new branch, false if it can go on the existing branch
}`;
  }
});

// server/jobs/task-runner.ts
async function runTask(task) {
  await markTaskRunning(task.id);
  try {
    switch (task.kind) {
      case "FIND_GOV_LEADS":
      case "FIND_RETAIL_LEADS":
        await runLeadFinder(task);
        break;
      case "DRAFT_OUTBOUND_EMAIL":
        await runOutboundEmail(task);
        break;
      case "FOLLOWUP_SEQUENCE":
        await runFollowupSequence(task);
        break;
      case "BUILD_PILOT_PACKET":
        await runBuildPilotPacket(task);
        break;
      case "DRAFT_INTEL_DOSSIER":
        await runDraftIntelDossier(task);
        break;
      case "CRM_UPDATE":
        await runCrmUpdate(task);
        break;
      case "FINALIZE_RETAIL_SIGNAGE":
        await runFinalizeRetailSignage(task);
        break;
      case "PACKAGE_SKU_ONBOARDING":
        await runPackageSkuOnboarding(task);
        break;
      case "CHECK_DNS_CONFIG":
        await runCheckDnsConfig(task);
        break;
      case "VERIFY_SSL":
        await runVerifySsl(task);
        break;
      case "RUN_LIGHTHOUSE_AUDIT":
        await runLighthouseAudit(task);
        break;
      case "GENERATE_LAUNCH_CHECKLIST":
        await runGenerateLaunchChecklist(task);
        break;
      case "DRAFT_LAUNCH_EMAIL":
        await runDraftLaunchEmail(task);
        break;
      case "DRAFT_PRESS_RELEASE":
        await runDraftPressRelease(task);
        break;
      case "SCHEDULE_SOCIAL_POSTS":
        await runScheduleSocialPosts(task);
        break;
      case "CHECK_REPLIES":
        await runCheckReplies(task);
        break;
      case "SEND_DEMO_PACKET":
        await runSendDemoPacket(task);
        break;
      case "GENERATE_PROPOSAL":
        await runGenerateProposal(task);
        break;
      case "SEND_CONTRACT":
        await runSendContract(task);
        break;
      case "AUTO_REPLY":
        await runAutoReply(task);
        break;
      case "GENERATE_OUTREACH_VIDEO":
        await runGenerateOutreachVideo(task);
        break;
      // ── Dev Team ────────────────────────────────────────────────────────
      case "PLAN_SPRINT":
        await runPlanSprint(task);
        break;
      case "WRITE_CODE":
        await runWriteCode(task);
        break;
      case "OPEN_PR":
        await runOpenPR(task);
        break;
      case "RUN_TESTS":
        await runTests(task);
        break;
      case "CODE_REVIEW":
        await runCodeReview(task);
        break;
      case "MERGE_PR":
        await runMergePR(task);
        break;
      case "MONITOR_DEPLOY":
        await runMonitorDeploy(task);
        break;
      case "FILE_BUG":
        await runFileBug(task);
        break;
      case "AUTO_FIX":
        await runAutoFix(task);
        break;
      default:
        throw new Error(`Unknown task kind: ${task.kind}`);
    }
    await markTaskDone(task.id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markTaskFailed(task.id, message);
    await logActivity({ userId: null, action: "task_failed", entityType: "task", entityId: 0, details: {
      taskId: task.id,
      kind: task.kind,
      missionId: task.missionId,
      error: message
    } });
    return { ok: false };
  }
}
var init_task_runner = __esm({
  "server/jobs/task-runner.ts"() {
    "use strict";
    init_db();
    init_lead_finder();
    init_outbound_email();
    init_followup();
    init_pilot_packet();
    init_crm_update();
    init_retail();
    init_infra();
    init_content();
    init_closer();
    init_heygen_video();
    init_code_writer();
    init_pr_manager();
    init_test_runner();
  }
});

// server/jobs/pipeline-tick.ts
var pipeline_tick_exports = {};
__export(pipeline_tick_exports, {
  runPipelineTick: () => runPipelineTick
});
import "dotenv/config";
import { pathToFileURL as pathToFileURL7 } from "node:url";
async function runPipelineTick() {
  if (!ENV.autonomousPipelineEnabled) {
    return { enabled: false, skipped: true, reason: "AUTONOMOUS_PIPELINE_ENABLED=false" };
  }
  const budgetMonitor = await runBudgetMonitor();
  const dunning = await runDunningEscalation();
  const retention = await runRetentionAutomation();
  const weeklyDigest = await runWeeklyDigestDispatch();
  const quarterlyValue = await runQuarterlyValueReportDispatch();
  const organicTraffic = await runOrganicTrafficAutomation();
  const [dueTasks, runCount, adaptivePriors] = await Promise.all([
    getDueTasks(),
    getRunTaskCount(),
    getAdaptivePriors()
  ]);
  const totalTasks = Math.max(runCount, 1);
  const kindToSegment = {
    FIND_GOV_LEADS: "GOV",
    FIND_RETAIL_LEADS: "RETAIL",
    DRAFT_OUTBOUND_EMAIL: "GOV",
    FOLLOWUP_SEQUENCE: "GOV",
    BUILD_PILOT_PACKET: "PARTNER",
    DRAFT_INTEL_DOSSIER: "PRESS",
    CRM_UPDATE: "PARTNER",
    DRAFT_PRESS_RELEASE: "PRESS"
  };
  const scored = dueTasks.map((task) => {
    const seg = kindToSegment[task.kind] ?? "DEFAULT";
    const prior = adaptivePriors[seg] ?? adaptivePriors.DEFAULT;
    return { task, score: ucb1Score(prior, totalTasks) };
  });
  scored.sort((a, b) => b.score - a.score);
  const taskResults = { total: dueTasks.length, ran: 0, errors: 0 };
  for (const { task } of scored) {
    const result = await runTask(task);
    if (result.ok) {
      taskResults.ran++;
    } else {
      taskResults.errors++;
    }
  }
  const PMF_THRESHOLDS = {
    GOV: { missionType: "GOV_PILOT", threshold: 0.12 },
    RETAIL: { missionType: "RETAIL_PILOT", threshold: 0.1 }
  };
  const activeMissionTypes = await getActiveMissionTypes();
  const pmfCreated = [];
  for (const [seg, { missionType, threshold }] of Object.entries(PMF_THRESHOLDS)) {
    const prior = adaptivePriors[seg];
    if (!prior) continue;
    const mean = betaMean(prior);
    if (mean >= threshold && !activeMissionTypes.includes(missionType)) {
      await createMission(missionType);
      pmfCreated.push(missionType);
    }
  }
  const summary = {
    enabled: true,
    budgetMonitor,
    dunning,
    retention,
    weeklyDigest,
    quarterlyValue,
    organicTraffic,
    missionTasks: taskResults,
    pmfCreated
  };
  await logActivity({
    userId: null,
    action: "pipeline_tick_executed",
    entityType: "automation",
    entityId: 0,
    details: summary
  });
  return summary;
}
var isMain7;
var init_pipeline_tick = __esm({
  "server/jobs/pipeline-tick.ts"() {
    "use strict";
    init_env();
    init_db();
    init_budget_monitor();
    init_dunning();
    init_retention();
    init_weekly_digest();
    init_quarterly_value();
    init_organic_traffic();
    init_db();
    init_task_runner();
    init_bayesian();
    isMain7 = !!process.argv[1] && import.meta.url === pathToFileURL7(process.argv[1]).href;
    if (isMain7) {
      runPipelineTick().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }).catch((err) => {
        console.error("Pipeline tick failed:", err);
        process.exit(1);
      });
    }
  }
});

// server/scheduled-jobs.ts
var scheduled_jobs_exports = {};
__export(scheduled_jobs_exports, {
  getJobHistory: () => getJobHistory,
  getRegisteredJobs: () => getRegisteredJobs,
  initializeScheduler: () => initializeScheduler,
  runJobManually: () => runJobManually,
  stopScheduler: () => stopScheduler
});
import cron from "node-cron";
import { eq as eq10, lt, and as and7, sql as sql4, desc as desc5, lte as lte3, gte as gte2, count as count2 } from "drizzle-orm";
function registerJob(job) {
  jobs.push(job);
}
async function executeJob(job) {
  const db2 = await getDb();
  if (!db2) {
    console.warn(`[Scheduler] Skipping ${job.name}: database not available`);
    return;
  }
  const startTime = Date.now();
  console.log(`[Scheduler] Starting job: ${job.name}`);
  const [runRecord] = await db2.insert(scheduledJobRuns).values({
    jobName: job.name,
    status: "running",
    startedAt: /* @__PURE__ */ new Date()
  });
  const runId = runRecord.insertId;
  try {
    const result = await job.handler();
    const duration = Date.now() - startTime;
    await db2.update(scheduledJobRuns).set({
      status: "completed",
      completedAt: /* @__PURE__ */ new Date(),
      duration,
      itemsProcessed: result.itemsProcessed,
      result: result.details
    }).where(eq10(scheduledJobRuns.id, Number(runId)));
    console.log(`[Scheduler] Completed ${job.name} in ${duration}ms (${result.itemsProcessed} items)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Scheduler] Failed ${job.name}:`, error.message);
    await db2.update(scheduledJobRuns).set({
      status: "failed",
      completedAt: /* @__PURE__ */ new Date(),
      duration,
      error: error.message || "Unknown error"
    }).where(eq10(scheduledJobRuns.id, Number(runId)));
  }
}
function initializeScheduler() {
  console.log("[Scheduler] Initializing scheduled jobs...");
  for (const job of jobs) {
    if (!job.enabled) {
      console.log(`[Scheduler] Skipping disabled job: ${job.name}`);
      continue;
    }
    const task = cron.schedule(job.schedule, () => {
      executeJob(job).catch(
        (err) => console.error(`[Scheduler] Unhandled error in ${job.name}:`, err)
      );
    });
    scheduledTasks.set(job.name, task);
    console.log(`[Scheduler] Registered: ${job.name} (${job.schedule})`);
  }
  console.log(`[Scheduler] ${scheduledTasks.size} jobs registered and running`);
}
function stopScheduler() {
  Array.from(scheduledTasks.entries()).forEach(([name, task]) => {
    task.stop();
    console.log(`[Scheduler] Stopped: ${name}`);
  });
  scheduledTasks.clear();
}
function getRegisteredJobs() {
  return jobs.map((j) => ({
    name: j.name,
    description: j.description,
    schedule: j.schedule,
    enabled: j.enabled,
    isRunning: scheduledTasks.has(j.name)
  }));
}
async function getJobHistory(jobName, limit = 50) {
  const db2 = await getDb();
  if (!db2) return [];
  if (jobName) {
    return db2.select().from(scheduledJobRuns).where(eq10(scheduledJobRuns.jobName, jobName)).orderBy(desc5(scheduledJobRuns.startedAt)).limit(limit);
  }
  return db2.select().from(scheduledJobRuns).orderBy(desc5(scheduledJobRuns.startedAt)).limit(limit);
}
async function runJobManually(jobName) {
  const job = jobs.find((j) => j.name === jobName);
  if (!job) return false;
  await executeJob(job);
  return true;
}
var jobs, scheduledTasks;
var init_scheduled_jobs = __esm({
  "server/scheduled-jobs.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_notification();
    init_hubspot_service();
    init_env();
    jobs = [];
    scheduledTasks = /* @__PURE__ */ new Map();
    registerJob({
      name: "subscription-health-check",
      description: "Check expiring subscriptions, flag past-due accounts, reset monthly quotas",
      schedule: "0 6 * * *",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const now = /* @__PURE__ */ new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1e3);
        let processed = 0;
        const details = {};
        const expiringSubs = await db2.select().from(subscriptions).where(and7(
          eq10(subscriptions.status, "active"),
          lte3(subscriptions.currentPeriodEnd, threeDaysFromNow),
          gte2(subscriptions.currentPeriodEnd, now)
        ));
        for (const sub of expiringSubs) {
          await db2.insert(notifications).values({
            userId: sub.userId,
            type: "subscription",
            title: "Subscription Expiring Soon",
            message: `Your ${sub.plan} subscription expires in less than 3 days. Renew to avoid service interruption.`,
            actionUrl: "/subscriptions"
          });
          processed++;
        }
        details.expiringNotified = expiringSubs.length;
        const pastDueSubs = await db2.select().from(subscriptions).where(and7(
          eq10(subscriptions.status, "active"),
          lt(subscriptions.currentPeriodEnd, now)
        ));
        for (const sub of pastDueSubs) {
          await db2.update(subscriptions).set({ status: "past_due" }).where(eq10(subscriptions.id, sub.id));
          processed++;
        }
        details.markedPastDue = pastDueSubs.length;
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (now.getDate() === 1) {
          const [resetResult] = await db2.update(subscriptions).set({ usedQuota: 0 }).where(eq10(subscriptions.status, "active"));
          details.quotasReset = true;
        }
        return { itemsProcessed: processed, details };
      }
    });
    registerJob({
      name: "certificate-expiry-check",
      description: "Flag certificates expiring within 30 days and notify owners",
      schedule: "0 7 * * *",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const now = /* @__PURE__ */ new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3);
        let processed = 0;
        const expiringCerts = await db2.select().from(certificates).where(and7(
          eq10(certificates.status, "active"),
          lte3(certificates.expiresAt, thirtyDaysFromNow),
          gte2(certificates.expiresAt, now)
        ));
        for (const cert of expiringCerts) {
          await db2.insert(notifications).values({
            userId: cert.userId,
            type: "certificate",
            title: "Certificate Expiring Soon",
            message: `Certificate #${cert.certificateNumber} expires on ${cert.expiresAt?.toLocaleDateString()}. Renew it to maintain product authenticity.`,
            actionUrl: "/certificates"
          });
          processed++;
        }
        const [expiredResult] = await db2.update(certificates).set({ status: "expired" }).where(and7(
          eq10(certificates.status, "active"),
          lt(certificates.expiresAt, now)
        ));
        return {
          itemsProcessed: processed,
          details: { expiringNotified: expiringCerts.length, autoExpired: "checked" }
        };
      }
    });
    registerJob({
      name: "lead-nurturing",
      description: "Identify stale leads, update scores, and sync unsynced leads to HubSpot",
      schedule: "0 9 * * *",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const now = /* @__PURE__ */ new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
        let processed = 0;
        const details = {};
        const staleLeads = await db2.select().from(leads).where(and7(
          eq10(leads.status, "new"),
          lt(leads.createdAt, sevenDaysAgo)
        ));
        details.staleLeadsFound = staleLeads.length;
        if (isHubSpotConfigured()) {
          const newLeads = await db2.select().from(leads).where(eq10(leads.status, "new")).limit(20);
          let synced = 0;
          for (const lead of newLeads) {
            try {
              await syncLeadToHubSpot({
                email: lead.email,
                name: lead.name || void 0,
                company: lead.company || void 0,
                source: lead.source || "website"
              });
              synced++;
            } catch {
            }
          }
          details.hubspotSynced = synced;
          processed += synced;
        }
        return { itemsProcessed: processed, details };
      }
    });
    registerJob({
      name: "database-cleanup",
      description: "Purge old read notifications, stale job runs, and expired sessions",
      schedule: "0 3 * * *",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3);
        let processed = 0;
        const details = {};
        const [notifResult] = await db2.delete(notifications).where(and7(
          eq10(notifications.isRead, 1),
          lt(notifications.createdAt, thirtyDaysAgo)
        ));
        details.oldNotificationsDeleted = "checked";
        processed++;
        const [jobRunResult] = await db2.delete(scheduledJobRuns).where(and7(
          eq10(scheduledJobRuns.status, "completed"),
          lt(scheduledJobRuns.startedAt, ninetyDaysAgo)
        ));
        details.oldJobRunsDeleted = "checked";
        processed++;
        return { itemsProcessed: processed, details };
      }
    });
    registerJob({
      name: "weekly-analytics-digest",
      description: "Compile weekly platform stats and notify owner",
      schedule: "0 8 * * 1",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
        const [newUsersResult] = await db2.select({ count: count2() }).from(users).where(gte2(users.createdAt, oneWeekAgo));
        const newUsers = newUsersResult?.count || 0;
        const [authsResult] = await db2.select({ count: count2() }).from(authentications).where(gte2(authentications.createdAt, oneWeekAgo));
        const newAuths = authsResult?.count || 0;
        const [leadsResult] = await db2.select({ count: count2() }).from(leads).where(gte2(leads.createdAt, oneWeekAgo));
        const newLeads = leadsResult?.count || 0;
        const [paymentsResult] = await db2.select({ count: count2() }).from(payments).where(gte2(payments.createdAt, oneWeekAgo));
        const newPayments = paymentsResult?.count || 0;
        const [activeSubs] = await db2.select({ count: count2() }).from(subscriptions).where(eq10(subscriptions.status, "active"));
        const totalActiveSubs = activeSubs?.count || 0;
        let crmStats = { contacts: 0, companies: 0, deals: 0 };
        if (isHubSpotConfigured()) {
          try {
            const stats = await getCRMStats();
            crmStats = { contacts: stats.contacts, companies: stats.companies, deals: stats.deals };
          } catch {
          }
        }
        const digest = `\u{1F4CA} AuthiChain Weekly Digest (${oneWeekAgo.toLocaleDateString()} - ${(/* @__PURE__ */ new Date()).toLocaleDateString()})

New Users: ${newUsers}
Authentications: ${newAuths}
New Leads: ${newLeads}
Payments: ${newPayments}
Active Subscriptions: ${totalActiveSubs}

HubSpot CRM: ${crmStats.contacts} contacts | ${crmStats.companies} companies | ${crmStats.deals} deals`;
        await notifyOwner({
          title: "AuthiChain Weekly Analytics Digest",
          content: digest
        });
        return {
          itemsProcessed: 1,
          details: { newUsers, newAuths, newLeads, newPayments, totalActiveSubs, crmStats }
        };
      }
    });
    registerJob({
      name: "hubspot-crm-sync",
      description: "Sync new leads and payment events to HubSpot CRM",
      schedule: "0 */4 * * *",
      enabled: true,
      handler: async () => {
        if (!isHubSpotConfigured()) {
          return { itemsProcessed: 0, details: { skipped: "HubSpot not configured" } };
        }
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1e3);
        let synced = 0;
        const recentLeads = await db2.select().from(leads).where(gte2(leads.createdAt, fourHoursAgo)).limit(50);
        for (const lead of recentLeads) {
          try {
            await syncLeadToHubSpot({
              email: lead.email,
              name: lead.name || void 0,
              company: lead.company || void 0,
              source: lead.source || "website"
            });
            synced++;
          } catch {
          }
        }
        return {
          itemsProcessed: synced,
          details: { leadsFound: recentLeads.length, leadsSynced: synced }
        };
      }
    });
    registerJob({
      name: "customer-health-score",
      description: "Recalculate customer health scores based on usage, payments, and engagement",
      schedule: "0 5 * * *",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
        let processed = 0;
        const activeSubs = await db2.select().from(subscriptions).where(eq10(subscriptions.status, "active"));
        for (const sub of activeSubs) {
          const quotaUsage = sub.usedQuota && sub.monthlyQuota ? Math.round(sub.usedQuota / sub.monthlyQuota * 100) : 0;
          let score = Math.min(100, quotaUsage);
          if (sub.plan === "enterprise") score = Math.min(100, score + 20);
          else if (sub.plan === "professional") score = Math.min(100, score + 10);
          const [existing] = await db2.select().from(customerHealthScores).where(eq10(customerHealthScores.userId, sub.userId)).orderBy(desc5(customerHealthScores.lastCalculatedAt)).limit(1);
          let trend = "stable";
          if (existing) {
            if (score > existing.score + 5) trend = "improving";
            else if (score < existing.score - 5) trend = "declining";
          }
          await db2.insert(customerHealthScores).values({
            userId: sub.userId,
            score,
            factors: { quotaUsage, plan: sub.plan, billingCycle: sub.billingCycle },
            trend,
            lastCalculatedAt: /* @__PURE__ */ new Date()
          });
          processed++;
        }
        return { itemsProcessed: processed, details: { subscribersScored: processed } };
      }
    });
    registerJob({
      name: "fraud-detection-sweep",
      description: "Detect suspicious authentication patterns and flag potential fraud",
      schedule: "0 */6 * * *",
      enabled: true,
      handler: async () => {
        const db2 = await getDb();
        if (!db2) return { itemsProcessed: 0, details: { error: "No DB" } };
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1e3);
        let flagged = 0;
        const highVolumeUsers = await db2.select({
          userId: authentications.userId,
          authCount: count2()
        }).from(authentications).where(gte2(authentications.createdAt, sixHoursAgo)).groupBy(authentications.userId).having(sql4`count(*) > 50`);
        for (const user of highVolumeUsers) {
          await db2.insert(fraudAlerts).values({
            userId: user.userId,
            alertType: "high_volume_auth",
            severity: "medium",
            description: `User performed ${user.authCount} authentications in the last 6 hours, which exceeds the threshold of 50.`,
            metadata: { authCount: user.authCount, period: "6h" }
          });
          flagged++;
        }
        const failedAuths = await db2.select({
          productId: authentications.productId,
          failCount: count2()
        }).from(authentications).where(and7(
          gte2(authentications.createdAt, sixHoursAgo),
          eq10(authentications.result, "counterfeit")
        )).groupBy(authentications.productId).having(sql4`count(*) > 5`);
        for (const item of failedAuths) {
          if (item.productId) {
            await db2.insert(fraudAlerts).values({
              productId: item.productId,
              alertType: "multiple_counterfeit_flags",
              severity: "high",
              description: `Product received ${item.failCount} counterfeit flags in the last 6 hours.`,
              metadata: { failCount: item.failCount, period: "6h" }
            });
            flagged++;
          }
        }
        return { itemsProcessed: flagged, details: { highVolumeUsers: highVolumeUsers.length, failedAuthProducts: failedAuths.length } };
      }
    });
    registerJob({
      name: "autonomous-pipeline-tick",
      description: "Run AgentZ revenue pipeline: find leads, draft outreach, monitor deals",
      schedule: "*/15 * * * *",
      // every 15 minutes
      enabled: ENV.autonomousPipelineEnabled,
      handler: async () => {
        const { runPipelineTick: runPipelineTick2 } = await Promise.resolve().then(() => (init_pipeline_tick(), pipeline_tick_exports));
        const result = await runPipelineTick2();
        if ("skipped" in result && result.skipped) {
          return { itemsProcessed: 0, details: result };
        }
        const r = result;
        const tasksRan = r.taskResults?.ran ?? 0;
        return {
          itemsProcessed: tasksRan,
          details: {
            budgetMonitor: r.budgetMonitor,
            dunning: r.dunning,
            retention: r.retention,
            taskResults: r.taskResults
          }
        };
      }
    });
  }
});

// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
  statusCode;
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  client;
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await (void 0)(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await (void 0)(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
init_notification();
import { z } from "zod";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z8 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/referral/router.ts
init_db();
import { z as z2 } from "zod";

// server/referral/core.ts
init_db();
init_schema();
import { nanoid } from "nanoid";
import { eq as eq2 } from "drizzle-orm";
var COMMISSION_RATES = {
  starter: 0.1,
  // 10%
  professional: 0.15,
  // 15%
  enterprise: 0.2,
  // 20%
  agency: 0.25
  // 25%
};
var AFFILIATE_BONUS_TIERS = [
  { threshold: 5, bonus: 1e3, tier: "silver" },
  // $10 bonus at 5 referrals
  { threshold: 10, bonus: 2500, tier: "gold" },
  // $25 bonus at 10 referrals
  { threshold: 25, bonus: 7500, tier: "platinum" }
  // $75 bonus at 25 referrals
];
function generateReferralCode(userId) {
  return `REF-${userId}-${nanoid(6).toUpperCase()}`;
}
function generateAffiliateCode(userId) {
  return `AFF-${userId}-${nanoid(6).toUpperCase()}`;
}
async function createReferralCode(referrerId) {
  const code = generateReferralCode(referrerId);
  const result = await db.insert(referrals).values({
    referrerId,
    referralCode: code,
    status: "pending"
  });
  return { id: result[0].insertId, referralCode: code };
}
async function trackReferralClick(params) {
  await db.insert(referralClicks).values(params);
}
async function completeReferral(params) {
  const rate = COMMISSION_RATES[params.tier] || COMMISSION_RATES.starter;
  await db.update(referrals).set({
    referredId: params.referredId,
    referredEmail: params.referredEmail,
    status: "converted",
    tier: params.tier,
    convertedAt: /* @__PURE__ */ new Date()
  }).where(eq2(referrals.referralCode, params.referralCode));
}
async function getReferralStats(referrerId) {
  const all = await db.select().from(referrals).where(eq2(referrals.referrerId, referrerId));
  const converted = all.filter((r) => r.status === "converted");
  const totalCommission = converted.reduce((sum, r) => sum + parseFloat(r.commissionPaid || "0"), 0);
  return {
    totalReferrals: all.length,
    convertedReferrals: converted.length,
    pendingReferrals: all.filter((r) => r.status === "pending").length,
    totalCommission,
    conversionRate: all.length > 0 ? Math.round(converted.length / all.length * 100) : 0
  };
}

// server/referral/router.ts
var referralRouter = router({
  generateCode: protectedProcedure.mutation(async ({ ctx }) => {
    return await createReferralCode(ctx.user.id);
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return await getReferralStats(ctx.user.id);
  }),
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return await (void 0)(ctx.user.id);
  }),
  trackClick: publicProcedure.input(z2.object({
    referralCode: z2.string(),
    ipAddress: z2.string().optional(),
    userAgent: z2.string().optional(),
    referer: z2.string().optional(),
    landingPage: z2.string().optional()
  })).mutation(async ({ input }) => {
    await trackReferralClick(input);
    return { success: true };
  }),
  validate: publicProcedure.input(z2.object({ code: z2.string() })).query(async ({ input }) => {
    const referral = await (void 0)(input.code);
    return { valid: !!referral, referral };
  }),
  complete: protectedProcedure.input(z2.object({
    referralCode: z2.string(),
    referredEmail: z2.string().email(),
    tier: z2.enum(["starter", "professional", "enterprise", "agency"]).optional().default("starter")
  })).mutation(async ({ ctx, input }) => {
    await completeReferral({
      referralCode: input.referralCode,
      referredId: ctx.user.id,
      referredEmail: input.referredEmail,
      tier: input.tier
    });
    return { success: true };
  })
});

// server/affiliate/router.ts
init_db();
import { z as z3 } from "zod";
var affiliateRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    return await (void 0)(ctx.user.id);
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const affiliate = await (void 0)(ctx.user.id);
    if (!affiliate) return null;
    const commissions = await (void 0)(affiliate.id);
    const totalEarned = parseFloat(affiliate.totalEarnings || "0");
    const pendingPayout = parseFloat(affiliate.pendingPayout || "0");
    const nextTier = AFFILIATE_BONUS_TIERS.find((t2) => (affiliate.totalReferrals || 0) < t2.threshold);
    return {
      affiliate,
      commissions,
      totalEarned,
      pendingPayout,
      nextTierThreshold: nextTier?.threshold ?? null,
      nextTierBonus: nextTier?.bonus ?? null
    };
  }),
  submitApplication: protectedProcedure.input(z3.object({
    paypalEmail: z3.string().email().optional(),
    payoutMethod: z3.string().optional().default("paypal")
  })).mutation(async ({ ctx, input }) => {
    const existing = await (void 0)(ctx.user.id);
    if (existing) return { success: false, message: "Already enrolled in affiliate program" };
    const code = generateAffiliateCode(ctx.user.id);
    const result = await (void 0)({
      userId: ctx.user.id,
      affiliateCode: code,
      status: "active",
      commissionRate: "10.00",
      payoutMethod: input.payoutMethod,
      payoutDetails: input.paypalEmail ? { paypalEmail: input.paypalEmail } : null
    });
    return { success: true, affiliateCode: code, id: result.id };
  }),
  getReferrals: protectedProcedure.query(async ({ ctx }) => {
    return await (void 0)(ctx.user.id);
  })
});

// server/bonuses/router.ts
init_db();
init_schema();
import { z as z4 } from "zod";
import { eq as eq3, and as and3 } from "drizzle-orm";
var bonusesRouter = router({
  getUserBonuses: protectedProcedure.query(async ({ ctx }) => {
    return await db.select().from(bonuses).where(eq3(bonuses.userId, ctx.user.id));
  }),
  claimBonus: protectedProcedure.input(z4.object({ bonusId: z4.number() })).mutation(async ({ ctx, input }) => {
    const [bonus] = await db.select().from(bonuses).where(and3(eq3(bonuses.id, input.bonusId), eq3(bonuses.userId, ctx.user.id))).limit(1);
    if (!bonus) throw new Error("Bonus not found");
    if (bonus.status !== "pending") throw new Error("Bonus already claimed or delivered");
    await db.update(bonuses).set({ status: "claimed", claimedAt: /* @__PURE__ */ new Date() }).where(eq3(bonuses.id, input.bonusId));
    return { success: true };
  }),
  createUserBonuses: adminProcedure.input(z4.object({
    userId: z4.number(),
    bonusType: z4.string(),
    bonusName: z4.string(),
    bonusValue: z4.number(),
    tier: z4.enum(["starter", "professional", "enterprise", "agency"]).optional(),
    deliveryMethod: z4.string().optional().default("account_credit")
  })).mutation(async ({ input }) => {
    const result = await db.insert(bonuses).values({
      userId: input.userId,
      bonusType: input.bonusType,
      bonusName: input.bonusName,
      bonusValue: input.bonusValue,
      tier: input.tier,
      status: "pending",
      deliveryMethod: input.deliveryMethod
    });
    return { id: result[0].insertId };
  })
});

// server/marketplace/router.ts
import { z as z5 } from "zod";

// server/marketplace/db.ts
init_db();
init_schema();
import { eq as eq4, desc as desc3, and as and4, sql as sql2 } from "drizzle-orm";
async function listModels(filters) {
  let query = db.select().from(aiModels);
  const conditions = [];
  if (filters?.status) conditions.push(eq4(aiModels.status, filters.status));
  if (filters?.category) conditions.push(eq4(aiModels.category, filters.category));
  if (conditions.length) {
    query = query.where(and4(...conditions));
  }
  return await query.orderBy(desc3(aiModels.downloads)).limit(filters?.limit || 50);
}
async function getModelById(id) {
  const [model] = await db.select().from(aiModels).where(eq4(aiModels.id, id)).limit(1);
  return model;
}
async function createModel(data) {
  const result = await db.insert(aiModels).values({ ...data, status: "draft" });
  return { id: result[0].insertId };
}
async function purchaseModel(data) {
  const result = await db.insert(modelPurchases).values({ ...data, status: "active" });
  await db.update(aiModels).set({ downloads: sql2`${aiModels.downloads} + 1` }).where(eq4(aiModels.id, data.modelId));
  return { id: result[0].insertId };
}
async function getUserPurchases(userId) {
  return await db.select().from(modelPurchases).where(eq4(modelPurchases.userId, userId)).orderBy(desc3(modelPurchases.createdAt));
}
async function addReview(data) {
  const result = await db.insert(modelReviews).values(data);
  const [avg] = await db.select({ avg: sql2`AVG(rating)`, count: sql2`COUNT(*)` }).from(modelReviews).where(eq4(modelReviews.modelId, data.modelId));
  await db.update(aiModels).set({ rating: avg.avg, reviewCount: avg.count }).where(eq4(aiModels.id, data.modelId));
  return { id: result[0].insertId };
}
async function getModelReviews(modelId) {
  return await db.select().from(modelReviews).where(eq4(modelReviews.modelId, modelId)).orderBy(desc3(modelReviews.createdAt));
}

// server/marketplace/router.ts
var marketplaceRouter = router({
  listModels: publicProcedure.input(z5.object({
    category: z5.string().optional(),
    limit: z5.number().optional().default(50)
  })).query(async ({ input }) => {
    return await listModels({ ...input, status: "active" });
  }),
  getModel: publicProcedure.input(z5.object({ id: z5.number() })).query(async ({ input }) => {
    return await getModelById(input.id);
  }),
  createModel: adminProcedure.input(z5.object({
    name: z5.string().min(1),
    description: z5.string().optional(),
    category: z5.string().optional(),
    price: z5.number().min(0)
  })).mutation(async ({ ctx, input }) => {
    return await createModel({ ...input, creatorId: ctx.user.id });
  }),
  purchaseModel: protectedProcedure.input(z5.object({
    modelId: z5.number(),
    purchaseType: z5.enum(["purchase", "subscription", "rental"]).optional().default("purchase")
  })).mutation(async ({ ctx, input }) => {
    const model = await getModelById(input.modelId);
    if (!model) throw new Error("Model not found");
    return await purchaseModel({
      userId: ctx.user.id,
      modelId: input.modelId,
      pricePaid: model.price,
      purchaseType: input.purchaseType
    });
  }),
  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    return await getUserPurchases(ctx.user.id);
  }),
  addReview: protectedProcedure.input(z5.object({
    modelId: z5.number(),
    rating: z5.number().min(1).max(5),
    review: z5.string().optional()
  })).mutation(async ({ ctx, input }) => {
    return await addReview({ ...input, userId: ctx.user.id });
  }),
  getReviews: publicProcedure.input(z5.object({ modelId: z5.number() })).query(async ({ input }) => {
    return await getModelReviews(input.modelId);
  })
});

// server/email-drafts/router.ts
init_db();
import { z as z6 } from "zod";
var emailDraftsRouter = router({
  listPending: protectedProcedure.query(async () => {
    return await (void 0)();
  }),
  create: protectedProcedure.input(z6.object({
    prospectName: z6.string().optional(),
    prospectEmail: z6.string().email(),
    prospectCompany: z6.string().optional(),
    industry: z6.string().optional(),
    subject: z6.string().min(1),
    body: z6.string().min(1)
  })).mutation(async ({ input }) => {
    return await (void 0)({ ...input, status: "pending", generatedBy: "ai_manager" });
  }),
  approve: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
    const drafts = await (void 0)();
    const draft = drafts.find((d) => d.id === input.id);
    await (void 0)(input.id, "approved", ctx.user.id);
    if (draft) {
      try {
        await (void 0)(draft.prospectEmail, draft.subject, draft.body);
        await (void 0)(input.id, "sent", ctx.user.id);
      } catch (err) {
        console.error("[EmailDrafts] Failed to send approved email:", err);
      }
    }
    return { success: true };
  }),
  reject: protectedProcedure.input(z6.object({ id: z6.number(), notes: z6.string().optional() })).mutation(async ({ ctx, input }) => {
    await (void 0)(input.id, "rejected", ctx.user.id);
    return { success: true };
  }),
  bulkApprove: protectedProcedure.input(z6.object({ ids: z6.array(z6.number()) })).mutation(async ({ ctx, input }) => {
    for (const id of input.ids) await (void 0)(id, "approved", ctx.user.id);
    return { success: true, count: input.ids.length };
  })
});

// server/missions/router.ts
init_db();
import { z as z7 } from "zod";
var missionsRouter = router({
  list: protectedProcedure.input(z7.object({ status: z7.string().optional() })).query(async ({ input }) => {
    return getMissions(input.status);
  }),
  create: protectedProcedure.input(z7.object({ type: z7.custom() })).mutation(async ({ input }) => {
    const id = await createMission(input.type);
    return { id };
  }),
  get: protectedProcedure.input(z7.object({ id: z7.string() })).query(async ({ input }) => {
    return getMissionById(input.id);
  }),
  updateStatus: protectedProcedure.input(z7.object({ id: z7.string(), status: z7.custom() })).mutation(async ({ input }) => {
    await updateMissionStatus(input.id, input.status);
    return { ok: true };
  })
});
var tasksRouter = router({
  list: protectedProcedure.input(z7.object({ missionId: z7.string() })).query(async ({ input }) => {
    return getTasksByMission(input.missionId);
  }),
  retry: protectedProcedure.input(z7.object({ id: z7.string() })).mutation(async ({ input }) => {
    await retryTask(input.id);
    return { ok: true };
  })
});

// server/service-catalog.ts
var SERVICE_CATALOG = {
  authenticity_audit: {
    key: "authenticity_audit",
    name: "Authenticity Intelligence Audit",
    tagline: "Your fastest path to trust infrastructure",
    description: "A comprehensive forensic analysis of your supply chain risks, counterfeit exposure, and trust layer opportunities. Delivered as a premium 1-2 page intelligence report with actionable recommendations.",
    price: 25e3,
    displayPrice: "$250",
    stripeProductId: "prod_U92VgF7580wUWf",
    stripePriceId: "price_1TAkQNGqTruSqV8TjpR71cUz",
    deliverables: [
      "Forensic supply chain risk map",
      "Counterfeit exposure score",
      "Trust layer upgrade plan",
      "Sample QRON cinematic verification",
      "Product mockup with AuthiChain integration"
    ],
    targetAudience: [
      "Local businesses",
      "Cannabis dispensaries",
      "Collectibles shops",
      "Boutiques",
      "Maker studios",
      "Small e-commerce brands"
    ],
    deliveryTime: "24-48 hours",
    icon: "Shield",
    featured: true
  },
  cinematic_page: {
    key: "cinematic_page",
    name: "QRON Cinematic Product Page",
    tagline: "Premium verification that feels futuristic",
    description: "A cinematic verification page for your product that includes a QR code, provenance story, verification badge, and a stunning landing page. Makes your brand feel premium and futuristic.",
    price: 9900,
    displayPrice: "$99",
    stripeProductId: "prod_U92V0a4F7YKPyM",
    stripePriceId: "price_1TAkQbGqTruSqV8T9r0Uo1KS",
    deliverables: [
      "Custom QR code",
      "Cinematic landing page",
      "Provenance story",
      "Verification badge"
    ],
    targetAudience: [
      "Shopify sellers",
      "Etsy makers",
      "Local artisans",
      "Small brands"
    ],
    deliveryTime: "24 hours",
    icon: "Film"
  },
  automation_setup: {
    key: "automation_setup",
    name: "AI Automation Setup",
    tagline: "Automate your business workflows with AI",
    description: "Custom AI automation setup tailored to your business. We configure automated posting, lead management, inbox triage, and reporting systems that run on autopilot.",
    price: 29900,
    displayPrice: "$299",
    stripeProductId: "prod_U92VOcRexFKpM3",
    stripePriceId: "price_1TAkQpGqTruSqV8TSRM3LwaB",
    deliverables: [
      "Automated posting system",
      "Lead scraping & management",
      "Inbox triage automation",
      "Automated reporting dashboard"
    ],
    targetAudience: [
      "Small businesses",
      "Creators",
      "Shopify stores",
      "Realtors",
      "Local services"
    ],
    deliveryTime: "3-5 business days",
    icon: "Bot"
  },
  landing_page: {
    key: "landing_page",
    name: "Authenticity Landing Page",
    tagline: "Instant digital trust for your products",
    description: "A digital authenticity layer for your products with a QR code, trust badge, cinematic landing page, and simple verification flow. Walk-in ready for any retail business.",
    price: 9900,
    displayPrice: "$99",
    stripeProductId: "prod_U92VAeVfxK5dCE",
    stripePriceId: "price_1TAkR2GqTruSqV8TR0ea5Zxm",
    deliverables: [
      "Custom QR code",
      "Trust badge",
      "Branded landing page",
      "Simple verification flow"
    ],
    targetAudience: [
      "Dispensaries",
      "Boutiques",
      "Resale shops",
      "Collectibles stores"
    ],
    deliveryTime: "24 hours",
    icon: "Globe"
  },
  brand_story_pack: {
    key: "brand_story_pack",
    name: "Brand Story Intelligence Pack",
    tagline: "Your brand narrative, elevated with trust",
    description: "A complete brand narrative package that weaves authenticity into your story. Includes a trust narrative, QRON cinematic identity, product authenticity arc, and a sample verification experience.",
    price: 49900,
    displayPrice: "$499",
    stripeProductId: "prod_U92WUhyDGedEUK",
    stripePriceId: "price_1TAkREGqTruSqV8T26Rh7gaF",
    deliverables: [
      "Brand trust story",
      "Trust narrative document",
      "QRON cinematic identity",
      "Product authenticity arc",
      "Sample verification experience"
    ],
    targetAudience: [
      "Small brands",
      "Creators",
      "Local businesses",
      "Etsy sellers",
      "Shopify stores"
    ],
    deliveryTime: "3-5 business days",
    icon: "BookOpen"
  },
  government_dossier: {
    key: "government_dossier",
    name: "Government-Ready Intelligence Dossier",
    tagline: "Enterprise-grade trust infrastructure proposal",
    description: "A comprehensive intelligence package designed for government and institutional buyers. Includes a counterfeit risk map, trust infrastructure proposal, pilot plan, and cinematic dossier presentation.",
    price: 25e4,
    displayPrice: "$2,500",
    stripeProductId: "prod_U92W7q8TWzFsEj",
    stripePriceId: "price_1TAkRTGqTruSqV8T5TbFgn3Y",
    deliverables: [
      "Counterfeit risk map",
      "Trust infrastructure proposal",
      "Pilot implementation plan",
      "Cinematic dossier presentation"
    ],
    targetAudience: [
      "Local government",
      "County offices",
      "Tribal governments",
      "Law enforcement",
      "Economic development boards"
    ],
    deliveryTime: "5-10 business days",
    icon: "Building2",
    featured: true
  }
};
var SERVICE_LIST = Object.values(SERVICE_CATALOG);
var SERVICE_KEYS = Object.keys(SERVICE_CATALOG);

// server/routers.ts
init_db();
init_stripe_service();
var adminProcedure2 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ─── Products ────────────────────────────────────────────────────────────
  products: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserProducts } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserProducts(ctx.user.id);
    }),
    getById: protectedProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
      const { getProductById } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getProductById(input.id);
    }),
    create: protectedProcedure.input(z8.object({
      name: z8.string().min(1),
      brand: z8.string().optional(),
      category: z8.string().optional(),
      description: z8.string().optional(),
      imageUrl: z8.string().optional(),
      serialNumber: z8.string().optional(),
      batchNumber: z8.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createProduct, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await createProduct({ ...input, userId: ctx.user.id });
      await logActivity2({ userId: ctx.user.id, action: "product_created", entityType: "product", entityId: result.id });
      return result;
    })
  }),
  // ─── AI Authentication ───────────────────────────────────────────────────
  authenticate: router({
    analyze: protectedProcedure.input(z8.object({
      productId: z8.number(),
      imageUrl: z8.string()
    })).mutation(async ({ ctx, input }) => {
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      const { createAuthentication, getProductById, getUserSubscription, updateSubscriptionUsage, recordUsage, createCertificate, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const sub = await getUserSubscription(ctx.user.id);
      if (sub && (sub.usedQuota ?? 0) >= sub.monthlyQuota) throw new TRPCError3({ code: "FORBIDDEN", message: "Monthly quota exceeded. Please upgrade your plan." });
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError3({ code: "NOT_FOUND", message: "Product not found" });
      const response = await invokeLLM2({
        messages: [
          { role: "system", content: "You are an expert luxury product authenticator with blockchain verification capabilities. Analyze the provided product image and determine if it is authentic or counterfeit. Provide detailed reasoning, a confidence score (0-100), red flags, and authentic markers." },
          { role: "user", content: [
            { type: "text", text: `Authenticate this ${product.brand || ""} ${product.name}. Serial: ${product.serialNumber || "N/A"}. Category: ${product.category || "general"}` },
            { type: "image_url", image_url: { url: input.imageUrl } }
          ] }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "authentication_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                result: { type: "string", enum: ["authentic", "counterfeit", "uncertain"] },
                confidence: { type: "integer" },
                analysis: { type: "string" },
                redFlags: { type: "array", items: { type: "string" } },
                authenticMarkers: { type: "array", items: { type: "string" } },
                recommendation: { type: "string" }
              },
              required: ["result", "confidence", "analysis", "redFlags", "authenticMarkers", "recommendation"],
              additionalProperties: false
            }
          }
        }
      });
      const aiResult = JSON.parse(response.choices[0].message.content);
      const authResult = await createAuthentication({
        productId: input.productId,
        userId: ctx.user.id,
        aiAnalysis: aiResult,
        confidenceScore: aiResult.confidence,
        result: aiResult.result,
        imageUrl: input.imageUrl
      });
      if (aiResult.result === "authentic" && aiResult.confidence >= 80) {
        const certNumber = `AC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await createCertificate({
          productId: input.productId,
          authenticationId: authResult.id,
          userId: ctx.user.id,
          certificateNumber: certNumber,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3)
        });
      }
      if (sub) await updateSubscriptionUsage(ctx.user.id, (sub.usedQuota || 0) + 1);
      await recordUsage({ userId: ctx.user.id, subscriptionId: sub?.id, type: "authentication", quantity: 1 });
      await logActivity2({ userId: ctx.user.id, action: "product_authenticated", entityType: "authentication", entityId: authResult.id });
      try {
        const { createSystemNotification: createSystemNotification2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const emoji = aiResult.result === "authentic" ? "Verified" : aiResult.result === "counterfeit" ? "Alert" : "Review Needed";
        await createSystemNotification2(
          ctx.user.id,
          `Authentication ${emoji}: ${product.name}`,
          `${product.brand || "Product"} ${product.name} scored ${aiResult.confidence}% confidence as ${aiResult.result}. ${aiResult.recommendation}`,
          aiResult.result === "counterfeit" ? "alert" : "authentication",
          "/authenticate"
        );
      } catch (notifErr) {
        console.warn("[Notification] Failed:", notifErr);
      }
      try {
        const { rewardAgentForVerification: rewardAgentForVerification2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
        await rewardAgentForVerification2(ctx.user.id, aiResult.result === "authentic");
      } catch (agentErr) {
        console.warn("[Agent XP] No agent or error:", agentErr);
      }
      return aiResult;
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      const { getUserAuthentications } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserAuthentications(ctx.user.id);
    })
  }),
  // ─── Certificates ────────────────────────────────────────────────────────
  certificates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserCertificates } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserCertificates(ctx.user.id);
    }),
    verify: publicProcedure.input(z8.object({ certificateNumber: z8.string() })).query(async ({ input }) => {
      const { getCertificateByNumber, getProductById } = await Promise.resolve().then(() => (init_db(), db_exports));
      const cert = await getCertificateByNumber(input.certificateNumber);
      if (!cert) return { valid: false, message: "Certificate not found" };
      if (cert.status === "revoked") return { valid: false, message: "Certificate has been revoked" };
      if (cert.expiresAt && cert.expiresAt < /* @__PURE__ */ new Date()) return { valid: false, message: "Certificate has expired" };
      const product = await getProductById(cert.productId);
      return { valid: true, certificate: cert, product };
    }),
    makePublic: protectedProcedure.input(z8.object({ authenticationId: z8.number() })).mutation(async ({ input }) => {
      const { updateAuthenticationSharing } = await Promise.resolve().then(() => (init_db(), db_exports));
      const crypto3 = await import("crypto");
      const shareToken = crypto3.randomBytes(32).toString("hex");
      await updateAuthenticationSharing(input.authenticationId, true, shareToken);
      return { shareToken, shareUrl: `/certificate/${shareToken}` };
    }),
    getPublic: publicProcedure.input(z8.object({ shareToken: z8.string() })).query(async ({ input }) => {
      const { getAuthenticationByShareToken, getProductById, incrementShareCount } = await Promise.resolve().then(() => (init_db(), db_exports));
      const auth = await getAuthenticationByShareToken(input.shareToken);
      if (!auth || !auth.isPublic) throw new TRPCError3({ code: "NOT_FOUND", message: "Certificate not found" });
      const product = await getProductById(auth.productId);
      await incrementShareCount(auth.id);
      return { authentication: auth, product };
    })
  }),
  // ─── QR Codes ────────────────────────────────────────────────────────────
  qrcode: router({
    generate: protectedProcedure.input(z8.object({
      productId: z8.number(),
      size: z8.number().optional().default(300)
    })).mutation(async ({ ctx, input }) => {
      const QRCode = (await import("qrcode")).default;
      const { getProductById, createQrCode } = await Promise.resolve().then(() => (init_db(), db_exports));
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError3({ code: "NOT_FOUND", message: "Product not found" });
      const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: input.size, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
      await createQrCode({ productId: input.productId, userId: ctx.user.id, qrData: verifyUrl, qrImageUrl: qrDataUrl });
      return { qrCodeDataUrl: qrDataUrl, verifyUrl };
    }),
    scan: publicProcedure.input(z8.object({ productId: z8.number() })).query(async ({ input }) => {
      const { getProductById, getProductQrCodes, incrementScanCount } = await Promise.resolve().then(() => (init_db(), db_exports));
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError3({ code: "NOT_FOUND", message: "Product not found" });
      const qrCodes3 = await getProductQrCodes(input.productId);
      if (qrCodes3.length > 0) await incrementScanCount(qrCodes3[0].id);
      return { product, scanCount: (qrCodes3[0]?.scanCount || 0) + 1 };
    }),
    listForProduct: protectedProcedure.input(z8.object({ productId: z8.number() })).query(async ({ input }) => {
      const { getProductQrCodes } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getProductQrCodes(input.productId);
    })
  }),
  // ─── NFT Marketplace ─────────────────────────────────────────────────────
  nft: router({
    list: publicProcedure.input(z8.object({
      collectionId: z8.number().optional(),
      status: z8.string().optional(),
      limit: z8.number().optional().default(50)
    })).query(async ({ input }) => {
      const { listNfts } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await listNfts(input);
    }),
    getById: publicProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
      const { getNftById } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getNftById(input.id);
    }),
    create: protectedProcedure.input(z8.object({
      name: z8.string().min(1),
      description: z8.string().optional(),
      imageUrl: z8.string().optional(),
      ipfsHash: z8.string().optional(),
      collectionId: z8.number().optional(),
      price: z8.string().optional(),
      currency: z8.string().optional().default("ETH"),
      traits: z8.any().optional(),
      productId: z8.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createNft, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await createNft({ ...input, ownerId: ctx.user.id, creatorId: ctx.user.id, status: "listed" });
      await logActivity2({ userId: ctx.user.id, action: "nft_created", entityType: "nft", entityId: result.id });
      return result;
    }),
    collections: router({
      list: publicProcedure.query(async () => {
        const { listCollections } = await Promise.resolve().then(() => (init_db(), db_exports));
        return await listCollections();
      }),
      getBySlug: publicProcedure.input(z8.object({ slug: z8.string() })).query(async ({ input }) => {
        const { getCollectionBySlug } = await Promise.resolve().then(() => (init_db(), db_exports));
        return await getCollectionBySlug(input.slug);
      }),
      create: protectedProcedure.input(z8.object({
        name: z8.string().min(1),
        slug: z8.string().min(1),
        description: z8.string().optional(),
        imageUrl: z8.string().optional(),
        category: z8.string().optional()
      })).mutation(async ({ ctx, input }) => {
        const { createCollection } = await Promise.resolve().then(() => (init_db(), db_exports));
        return await createCollection({ ...input, userId: ctx.user.id });
      })
    }),
    auctions: router({
      list: publicProcedure.query(async () => {
        const { getActiveAuctions } = await Promise.resolve().then(() => (init_db(), db_exports));
        return await getActiveAuctions();
      }),
      getById: publicProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
        const { getAuctionById, getAuctionBids } = await Promise.resolve().then(() => (init_db(), db_exports));
        const auction = await getAuctionById(input.id);
        const bids = await getAuctionBids(input.id);
        return { auction, bids };
      }),
      create: protectedProcedure.input(z8.object({
        nftId: z8.number(),
        startPrice: z8.string(),
        reservePrice: z8.string().optional(),
        endsAt: z8.string()
      })).mutation(async ({ ctx, input }) => {
        const { createAuction } = await Promise.resolve().then(() => (init_db(), db_exports));
        return await createAuction({ ...input, sellerId: ctx.user.id, endsAt: new Date(input.endsAt) });
      }),
      bid: protectedProcedure.input(z8.object({
        auctionId: z8.number(),
        amount: z8.string()
      })).mutation(async ({ ctx, input }) => {
        const { getAuctionById, placeBid } = await Promise.resolve().then(() => (init_db(), db_exports));
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError3({ code: "NOT_FOUND" });
        if (auction.status !== "active") throw new TRPCError3({ code: "BAD_REQUEST", message: "Auction not active" });
        if (auction.currentBid && parseFloat(input.amount) <= parseFloat(auction.currentBid)) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "Bid must be higher than current bid" });
        }
        await placeBid(input.auctionId, ctx.user.id, input.amount);
        return { success: true };
      })
    })
  }),
  // ─── Subscriptions ───────────────────────────────────────────────────────
  subscription: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscription } = await Promise.resolve().then(() => (init_db(), db_exports));
      const sub = await getUserSubscription(ctx.user.id);
      return sub ?? null;
    }),
    create: protectedProcedure.input(z8.object({
      plan: z8.enum(["starter", "professional", "enterprise"]),
      billingCycle: z8.enum(["monthly", "annual"]).optional().default("monthly")
    })).mutation(async ({ ctx, input }) => {
      const { createSubscription, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const quotas = { starter: 100, professional: 1e3, enterprise: 1e4 };
      const result = await createSubscription({
        userId: ctx.user.id,
        plan: input.plan,
        monthlyQuota: quotas[input.plan],
        usedQuota: 0,
        billingCycle: input.billingCycle,
        status: "active",
        currentPeriodStart: /* @__PURE__ */ new Date(),
        currentPeriodEnd: new Date(Date.now() + (input.billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1e3)
      });
      await logActivity2({ userId: ctx.user.id, action: "subscription_created", entityType: "subscription", entityId: result.id });
      return result;
    }),
    invoices: protectedProcedure.query(async ({ ctx }) => {
      const { getUserInvoices } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserInvoices(ctx.user.id);
    }),
    usage: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscription } = await Promise.resolve().then(() => (init_db(), db_exports));
      const sub = await getUserSubscription(ctx.user.id);
      if (!sub) return { plan: null, used: 0, limit: 0, percentage: 0 };
      return { plan: sub.plan, used: sub.usedQuota || 0, limit: sub.monthlyQuota, percentage: Math.round((sub.usedQuota || 0) / sub.monthlyQuota * 100) };
    }),
    checkout: protectedProcedure.input(z8.object({
      plan: z8.enum(["starter", "professional", "enterprise"]),
      billing: z8.enum(["monthly", "annual"]).optional().default("monthly"),
      origin: z8.string()
    })).mutation(async ({ ctx, input }) => {
      const { createSubscriptionCheckout: createSubscriptionCheckout2 } = await Promise.resolve().then(() => (init_stripe_service(), stripe_service_exports));
      const url = await createSubscriptionCheckout2({
        userId: ctx.user.id,
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || "",
        plan: input.plan,
        billing: input.billing,
        origin: input.origin,
        stripeCustomerId: ctx.user.stripeCustomerId || void 0
      });
      return { checkoutUrl: url };
    }),
    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      const { getUserSubscription } = await Promise.resolve().then(() => (init_db(), db_exports));
      const sub = await getUserSubscription(ctx.user.id);
      if (!sub?.stripeSubscriptionId) throw new TRPCError3({ code: "NOT_FOUND", message: "No active Stripe subscription" });
      const { cancelSubscription: cancelSubscription2 } = await Promise.resolve().then(() => (init_stripe_service(), stripe_service_exports));
      await cancelSubscription2(sub.stripeSubscriptionId);
      return { success: true, message: "Subscription will cancel at end of billing period" };
    }),
    paymentHistory: protectedProcedure.query(async ({ ctx }) => {
      const stripeCustomerId = ctx.user.stripeCustomerId;
      if (!stripeCustomerId) return { payments: [], invoices: [] };
      const { getCustomerPayments: getCustomerPayments2, getCustomerInvoices: getCustomerInvoices2 } = await Promise.resolve().then(() => (init_stripe_service(), stripe_service_exports));
      const [payments3, invoices3] = await Promise.all([
        getCustomerPayments2(stripeCustomerId).catch(() => []),
        getCustomerInvoices2(stripeCustomerId).catch(() => [])
      ]);
      return { payments: payments3, invoices: invoices3 };
    }),
    createPromoCode: adminProcedure2.input(z8.object({
      code: z8.string().min(1),
      percentOff: z8.number().min(1).max(100).default(99),
      name: z8.string().optional()
    })).mutation(async ({ input }) => {
      const Stripe2 = (await import("stripe")).default;
      const stripe = new Stripe2(process.env.STRIPE_SECRET_KEY || "");
      const coupon = await stripe.coupons.create({
        percent_off: input.percentOff,
        duration: "forever",
        name: input.name || `AuthiChain ${input.percentOff}% Off`
      });
      const promo = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code: input.code,
        active: true
      });
      return { success: true, code: promo.code, id: promo.id, percentOff: input.percentOff };
    }),
    createPaddleCheckout: protectedProcedure.input(z8.object({
      plan: z8.enum(["starter", "professional", "enterprise"]),
      billing: z8.enum(["monthly", "annual"]).optional().default("monthly"),
      successUrl: z8.string()
    })).mutation(async ({ ctx, input }) => {
      const PADDLE_PRICES = {
        starter: { monthly: process.env.PADDLE_PRICE_STARTER_MONTHLY || "", annual: process.env.PADDLE_PRICE_STARTER_ANNUAL || "" },
        professional: { monthly: process.env.PADDLE_PRICE_PRO_MONTHLY || "", annual: process.env.PADDLE_PRICE_PRO_ANNUAL || "" },
        enterprise: { monthly: process.env.PADDLE_PRICE_ENT_MONTHLY || "", annual: process.env.PADDLE_PRICE_ENT_ANNUAL || "" }
      };
      const priceId = PADDLE_PRICES[input.plan]?.[input.billing];
      if (!priceId) throw new TRPCError3({ code: "BAD_REQUEST", message: `Paddle price not configured for ${input.plan}/${input.billing}` });
      const { upsertPaddleCustomer: upsertPaddleCustomer2, createPaddleTransaction: createPaddleTransaction2 } = await Promise.resolve().then(() => (init_paddle_service(), paddle_service_exports));
      const customerId = await upsertPaddleCustomer2({ email: ctx.user.email || "", name: ctx.user.name || "", userId: ctx.user.id });
      const checkoutUrl = await createPaddleTransaction2({ customerId, priceId, successUrl: input.successUrl });
      return { checkoutUrl };
    })
  }),
  // ─── Payments ────────────────────────────────────────────────────────────
  payments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserPayments } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserPayments(ctx.user.id);
    }),
    createStripe: protectedProcedure.input(z8.object({
      amount: z8.string(),
      currency: z8.string().optional().default("USD"),
      metadata: z8.any().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createPayment } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "stripe", status: "pending", metadata: input.metadata });
    }),
    createCrypto: protectedProcedure.input(z8.object({
      amount: z8.string(),
      currency: z8.string().optional().default("BTC"),
      metadata: z8.any().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createPayment } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "crypto", status: "pending", metadata: input.metadata });
    }),
    createEscrow: protectedProcedure.input(z8.object({
      amount: z8.string(),
      releaseDate: z8.string(),
      metadata: z8.any().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createPayment } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await createPayment({
        userId: ctx.user.id,
        amount: input.amount,
        method: "escrow",
        status: "escrowed",
        escrowReleaseDate: new Date(input.releaseDate),
        metadata: input.metadata
      });
    })
  }),
  // ─── Autopilot ───────────────────────────────────────────────────────────
  autopilot: router({
    getStatus: protectedProcedure.query(async () => {
      const { getAutopilotConfig, getRecentDecisions } = await Promise.resolve().then(() => (init_db(), db_exports));
      const config = await getAutopilotConfig();
      const decisions = await getRecentDecisions(5);
      const executed = decisions.filter((d) => d.status === "executed").length;
      return {
        enabled: config?.enabled || 0,
        mode: config?.mode || "balanced",
        guardrails: config?.guardrails,
        uptime: 99.5,
        decisionsToday: decisions.length,
        actionsToday: executed,
        successRate: decisions.length > 0 ? Math.round(executed / decisions.length * 100) : 0,
        recentDecisions: decisions
      };
    }),
    toggle: protectedProcedure.mutation(async ({ ctx }) => {
      const { getAutopilotConfig, upsertAutopilotConfig } = await Promise.resolve().then(() => (init_db(), db_exports));
      const config = await getAutopilotConfig();
      await upsertAutopilotConfig({
        enabled: config?.enabled === 1 ? 0 : 1,
        mode: config?.mode || "balanced",
        guardrails: config?.guardrails || JSON.stringify({ maxEmailsPerDay: 50, maxSocialPostsPerDay: 5, maxDiscountPercent: 30 }),
        updatedBy: ctx.user.id
      });
      return { success: true, enabled: config?.enabled === 1 ? 0 : 1 };
    }),
    updateMode: protectedProcedure.input(z8.object({
      mode: z8.enum(["conservative", "balanced", "aggressive"])
    })).mutation(async ({ ctx, input }) => {
      const { upsertAutopilotConfig } = await Promise.resolve().then(() => (init_db(), db_exports));
      await upsertAutopilotConfig({ mode: input.mode, updatedBy: ctx.user.id });
      return { success: true };
    }),
    getDecisions: protectedProcedure.input(z8.object({ limit: z8.number().optional().default(20) })).query(async ({ input }) => {
      const { getRecentDecisions } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getRecentDecisions(input.limit);
    }),
    overrideDecision: protectedProcedure.input(z8.object({
      decisionId: z8.number(),
      reason: z8.string()
    })).mutation(async ({ ctx, input }) => {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { autopilotDecisions: autopilotDecisions3 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq11 } = await import("drizzle-orm");
      const db2 = await getDb2();
      if (!db2) throw new Error("Database not available");
      await db2.update(autopilotDecisions3).set({ status: "overridden", overriddenBy: ctx.user.id, overrideReason: input.reason }).where(eq11(autopilotDecisions3.id, input.decisionId));
      return { success: true };
    }),
    executeAction: protectedProcedure.input(z8.object({
      type: z8.string(),
      action: z8.string(),
      reasoning: z8.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createAutopilotDecision, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      const response = await invokeLLM2({
        messages: [
          { role: "system", content: "You are an AI business autopilot. Evaluate the proposed action and determine confidence level (0-100) and expected outcome." },
          { role: "user", content: `Action type: ${input.type}
Action: ${input.action}
Reasoning: ${input.reasoning || "N/A"}` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "action_evaluation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                confidence: { type: "integer" },
                expectedOutcome: { type: "string" },
                risks: { type: "string" },
                proceed: { type: "boolean" }
              },
              required: ["confidence", "expectedOutcome", "risks", "proceed"],
              additionalProperties: false
            }
          }
        }
      });
      const evaluation = JSON.parse(response.choices[0].message.content);
      const decision = await createAutopilotDecision({
        type: input.type,
        action: input.action,
        reasoning: input.reasoning,
        confidence: evaluation.confidence,
        status: evaluation.proceed ? "executed" : "pending",
        result: evaluation
      });
      await logActivity2({ userId: ctx.user.id, action: "autopilot_decision", entityType: "autopilot_decision", entityId: decision.id });
      return { decision, evaluation };
    })
  }),
  // ─── Email Campaigns ─────────────────────────────────────────────────────
  emailCampaigns: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserEmailCampaigns } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserEmailCampaigns(ctx.user.id);
    }),
    create: protectedProcedure.input(z8.object({
      name: z8.string().min(1),
      subject: z8.string().min(1),
      body: z8.string().min(1),
      type: z8.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
      scheduledAt: z8.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createEmailCampaign } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await createEmailCampaign({
        ...input,
        userId: ctx.user.id,
        status: input.scheduledAt ? "scheduled" : "draft",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null
      });
    }),
    generateContent: protectedProcedure.input(z8.object({
      type: z8.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
      topic: z8.string(),
      targetAudience: z8.string().optional()
    })).mutation(async ({ input }) => {
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      const response = await invokeLLM2({
        messages: [
          { role: "system", content: "You are an expert email marketing specialist for a blockchain authentication platform. Create compelling, professional email content that drives conversions." },
          { role: "user", content: `Create a ${input.type} email about: ${input.topic}. Target audience: ${input.targetAudience || "enterprise decision makers"}. Return JSON with subject and body fields.` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_content",
            strict: true,
            schema: {
              type: "object",
              properties: { subject: { type: "string" }, body: { type: "string" } },
              required: ["subject", "body"],
              additionalProperties: false
            }
          }
        }
      });
      return JSON.parse(response.choices[0].message.content);
    })
  }),
  // ─── Email Drafts (Approval Workflow) ─────────────────────────────────────
  emailDrafts: emailDraftsRouter,
  // ─── Supply Chain ────────────────────────────────────────────────────────
  supplyChain: router({
    getEvents: protectedProcedure.input(z8.object({ productId: z8.number() })).query(async ({ input }) => {
      const { getProductSupplyChain } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getProductSupplyChain(input.productId);
    }),
    addEvent: protectedProcedure.input(z8.object({
      productId: z8.number(),
      eventType: z8.enum(["manufactured", "shipped", "in_transit", "customs", "delivered", "verified", "recalled"]),
      location: z8.string().optional(),
      latitude: z8.string().optional(),
      longitude: z8.string().optional(),
      temperature: z8.string().optional(),
      humidity: z8.string().optional(),
      handler: z8.string().optional(),
      notes: z8.string().optional(),
      iotDeviceId: z8.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createSupplyChainEvent, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await createSupplyChainEvent(input);
      await logActivity2({ userId: ctx.user.id, action: "supply_chain_event", entityType: "supply_chain", entityId: result.id });
      return result;
    })
  }),
  // ─── Referrals ───────────────────────────────────────────────────────────
  referrals: router({
    myReferrals: protectedProcedure.query(async ({ ctx }) => {
      const { getUserReferrals: getUserReferrals3 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserReferrals3(ctx.user.id);
    }),
    generateCode: protectedProcedure.mutation(async ({ ctx }) => {
      const { createReferral } = await Promise.resolve().then(() => (init_db(), db_exports));
      const code = `AC-${ctx.user.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return await createReferral({ referrerId: ctx.user.id, referralCode: code, status: "pending" });
    }),
    validate: publicProcedure.input(z8.object({ code: z8.string() })).query(async ({ input }) => {
      const { getReferralByCode: getReferralByCode2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const referral = await getReferralByCode2(input.code);
      return { valid: !!referral, referral };
    })
  }),
  // ─── Affiliates ──────────────────────────────────────────────────────────
  affiliates: router({
    myProfile: protectedProcedure.query(async ({ ctx }) => {
      const { getAffiliateByUserId: getAffiliateByUserId2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getAffiliateByUserId2(ctx.user.id);
    }),
    join: protectedProcedure.mutation(async ({ ctx }) => {
      const { createAffiliate: createAffiliate2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const code = `AFF-${ctx.user.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return await createAffiliate2({ userId: ctx.user.id, affiliateCode: code, status: "active", commissionRate: "10.00" });
    }),
    commissions: protectedProcedure.query(async ({ ctx }) => {
      const { getAffiliateByUserId: getAffiliateByUserId2, getAffiliateCommissions: getAffiliateCommissions2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const affiliate = await getAffiliateByUserId2(ctx.user.id);
      if (!affiliate) return [];
      return await getAffiliateCommissions2(affiliate.id);
    })
  }),
  // ─── A/B Testing ─────────────────────────────────────────────────────────
  abTesting: router({
    list: protectedProcedure.query(async () => {
      const { getAllAbTests } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getAllAbTests();
    }),
    create: protectedProcedure.input(z8.object({
      name: z8.string().min(1),
      description: z8.string().optional(),
      type: z8.string(),
      variants: z8.any()
    })).mutation(async ({ input }) => {
      const { createAbTest } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await createAbTest({ ...input, status: "draft" });
    })
  }),
  // ─── White Label ─────────────────────────────────────────────────────────
  whiteLabel: router({
    list: adminProcedure2.query(async () => {
      const { getWhiteLabelClients } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getWhiteLabelClients();
    }),
    create: adminProcedure2.input(z8.object({
      companyName: z8.string().min(1),
      domain: z8.string().optional(),
      logoUrl: z8.string().optional(),
      primaryColor: z8.string().optional(),
      secondaryColor: z8.string().optional(),
      apiCallLimit: z8.number().optional().default(1e4)
    })).mutation(async ({ ctx, input }) => {
      const { createWhiteLabelClient } = await Promise.resolve().then(() => (init_db(), db_exports));
      const crypto3 = await import("crypto");
      const apiKey = `wl_${crypto3.randomBytes(24).toString("hex")}`;
      const apiSecret = crypto3.randomBytes(32).toString("hex");
      return await createWhiteLabelClient({ ...input, userId: ctx.user.id, apiKey, apiSecret });
    }),
    validateApiKey: publicProcedure.input(z8.object({ apiKey: z8.string() })).query(async ({ input }) => {
      const { getWhiteLabelByApiKey } = await Promise.resolve().then(() => (init_db(), db_exports));
      const client = await getWhiteLabelByApiKey(input.apiKey);
      return { valid: !!client && client.status === "active", client: client ? { companyName: client.companyName, domain: client.domain } : null };
    })
  }),
  // ─── Leads & Marketing ───────────────────────────────────────────────────
  marketing: router({
    leads: adminProcedure2.query(async () => {
      const { getAllLeads } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getAllLeads();
    }),
    createLead: publicProcedure.input(z8.object({
      email: z8.string().email(),
      name: z8.string().optional(),
      company: z8.string().optional(),
      source: z8.string().optional()
    })).mutation(async ({ input }) => {
      const { createLead } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await createLead(input);
      try {
        const { syncLeadToHubSpot: syncLeadToHubSpot2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        await syncLeadToHubSpot2(input);
      } catch (e) {
      }
      return result;
    }),
    updateLeadScore: adminProcedure2.input(z8.object({ id: z8.number(), score: z8.number() })).mutation(async ({ input }) => {
      const { updateLeadScore } = await Promise.resolve().then(() => (init_db(), db_exports));
      await updateLeadScore(input.id, input.score);
      return { success: true };
    }),
    updateLeadStatus: adminProcedure2.input(z8.object({ id: z8.number(), status: z8.string() })).mutation(async ({ input }) => {
      const { updateLeadStatus: updateLeadStatus2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      await updateLeadStatus2(input.id, input.status);
      return { success: true };
    }),
    generateContent: protectedProcedure.input(z8.object({
      type: z8.enum(["email", "social", "blog"]),
      topic: z8.string(),
      targetAudience: z8.string().optional()
    })).mutation(async ({ input }) => {
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      const response = await invokeLLM2({
        messages: [
          { role: "system", content: "You are a marketing expert for a blockchain authentication platform. Create compelling, professional content." },
          { role: "user", content: `Create ${input.type} content about: ${input.topic}. Target: ${input.targetAudience || "enterprise decision makers"}` }
        ]
      });
      return { content: response.choices[0].message.content };
    })
  }),
  // ─── Admin Dashboard ─────────────────────────────────────────────────────
  admin: router({
    metrics: adminProcedure2.query(async () => {
      const { getAdminDashboardMetrics } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getAdminDashboardMetrics();
    }),
    users: adminProcedure2.query(async () => {
      const { getAllUsers: getAllUsers2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getAllUsers2();
    }),
    revenue: adminProcedure2.input(z8.object({
      startDate: z8.string().optional(),
      endDate: z8.string().optional()
    }).optional()).query(async ({ input }) => {
      const { getRevenueAnalytics } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getRevenueAnalytics(
        input?.startDate ? new Date(input.startDate) : void 0,
        input?.endDate ? new Date(input.endDate) : void 0
      );
    }),
    fraudAlerts: adminProcedure2.query(async () => {
      const { getOpenFraudAlerts } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getOpenFraudAlerts();
    }),
    healthScores: adminProcedure2.query(async () => {
      const { getAllHealthScores } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getAllHealthScores();
    }),
    activity: adminProcedure2.input(z8.object({ limit: z8.number().optional().default(50) })).query(async ({ input }) => {
      const { getRecentActivity: getRecentActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getRecentActivity2(input.limit);
    }),
    subscriptions: adminProcedure2.query(async () => {
      const { getSubscriptionAnalytics } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getSubscriptionAnalytics();
    })
  }),
  // ─── Blockchain (Thirdweb) ──────────────────────────────────────────────
  blockchain: router({
    status: publicProcedure.query(async () => {
      const { checkThirdwebConnection: checkThirdwebConnection2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      return await checkThirdwebConnection2();
    }),
    uploadToIPFS: protectedProcedure.input(z8.object({
      name: z8.string(),
      description: z8.string().optional(),
      imageUrl: z8.string().optional(),
      attributes: z8.array(z8.object({ trait_type: z8.string(), value: z8.union([z8.string(), z8.number()]) })).optional()
    })).mutation(async ({ input }) => {
      const { uploadMetadataToIPFS: uploadMetadataToIPFS2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      const uri = await uploadMetadataToIPFS2({
        name: input.name,
        description: input.description,
        image: input.imageUrl,
        attributes: input.attributes
      });
      return { ipfsUri: uri };
    }),
    mintCertificateNFT: protectedProcedure.input(z8.object({
      productId: z8.number(),
      certificateNumber: z8.string(),
      walletAddress: z8.string(),
      contractAddress: z8.string(),
      privateKey: z8.string(),
      chainId: z8.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { getProductById, getCertificateByNumber, logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { mintAuthenticationNFT: mintAuthenticationNFT2, buildAuthCertificateMetadata: buildAuthCertificateMetadata2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError3({ code: "NOT_FOUND", message: "Product not found" });
      const cert = await getCertificateByNumber(input.certificateNumber);
      if (!cert) throw new TRPCError3({ code: "NOT_FOUND", message: "Certificate not found" });
      const metadata = buildAuthCertificateMetadata2({
        productName: product.name,
        productBrand: product.brand || void 0,
        productSerial: product.serialNumber || void 0,
        confidenceScore: 95,
        verificationDate: (/* @__PURE__ */ new Date()).toISOString(),
        certificateNumber: input.certificateNumber,
        imageUrl: product.imageUrl || void 0,
        authenticatorId: ctx.user.id
      });
      const result = await mintAuthenticationNFT2({
        contractAddress: input.contractAddress,
        recipientAddress: input.walletAddress,
        metadata,
        privateKey: input.privateKey,
        chainId: input.chainId
      });
      await logActivity2({ userId: ctx.user.id, action: "nft_minted", entityType: "certificate", entityId: cert.id });
      return { transactionHash: result.transactionHash, metadataUri: result.metadataUri, chain: result.chain };
    }),
    mintNFT: protectedProcedure.input(z8.object({
      name: z8.string(),
      description: z8.string().optional(),
      imageUrl: z8.string().optional(),
      walletAddress: z8.string(),
      contractAddress: z8.string(),
      privateKey: z8.string(),
      chainId: z8.number().optional(),
      attributes: z8.array(z8.object({ trait_type: z8.string(), value: z8.union([z8.string(), z8.number()]) })).optional()
    })).mutation(async ({ ctx, input }) => {
      const { mintAuthenticationNFT: mintAuthenticationNFT2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      const { logActivity: logActivity2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await mintAuthenticationNFT2({
        contractAddress: input.contractAddress,
        recipientAddress: input.walletAddress,
        metadata: {
          name: input.name,
          description: input.description,
          image: input.imageUrl,
          attributes: input.attributes
        },
        privateKey: input.privateKey,
        chainId: input.chainId
      });
      await logActivity2({ userId: ctx.user.id, action: "nft_minted", entityType: "nft", entityId: 0 });
      return { transactionHash: result.transactionHash, metadataUri: result.metadataUri, chain: result.chain };
    }),
    getNFTBalance: publicProcedure.input(z8.object({
      contractAddress: z8.string(),
      walletAddress: z8.string(),
      chainId: z8.number().optional()
    })).query(async ({ input }) => {
      const { getNFTBalance: getNFTBalance2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      const balance = await getNFTBalance2(input.contractAddress, input.walletAddress, input.chainId);
      return { balance };
    }),
    getContractSupply: publicProcedure.input(z8.object({
      contractAddress: z8.string(),
      chainId: z8.number().optional()
    })).query(async ({ input }) => {
      const { getContractTotalSupply: getContractTotalSupply2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      const supply = await getContractTotalSupply2(input.contractAddress, input.chainId);
      return { totalSupply: supply };
    }),
    getWalletNFTs: publicProcedure.input(z8.object({
      contractAddress: z8.string(),
      walletAddress: z8.string(),
      chainId: z8.number().optional()
    })).query(async ({ input }) => {
      const { getWalletNFTs: getWalletNFTs2 } = await Promise.resolve().then(() => (init_thirdweb(), thirdweb_exports));
      const nfts3 = await getWalletNFTs2(input.contractAddress, input.walletAddress, input.chainId);
      return { nfts: nfts3 };
    }),
    deployedContract: publicProcedure.query(() => {
      const address = process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS || "";
      return {
        address,
        chainId: 80002,
        chain: "Polygon Amoy",
        explorer: address ? `https://amoy.polygonscan.com/address/${address}` : "",
        deployed: !!address
      };
    })
  }),
  // ─── Dashboard Metrics ───────────────────────────────────────────────────
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      const { getDashboardMetrics } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getDashboardMetrics(ctx.user.id);
    })
  }),
  // ─── Notifications ──────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.input(z8.object({
      limit: z8.number().optional().default(50)
    }).optional()).query(async ({ ctx, input }) => {
      const { getUserNotifications } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await getUserNotifications(ctx.user.id, input?.limit ?? 50);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const { getUnreadNotificationCount } = await Promise.resolve().then(() => (init_db(), db_exports));
      return { count: await getUnreadNotificationCount(ctx.user.id) };
    }),
    markRead: protectedProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ ctx, input }) => {
      const { markNotificationRead } = await Promise.resolve().then(() => (init_db(), db_exports));
      await markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const { markAllNotificationsRead } = await Promise.resolve().then(() => (init_db(), db_exports));
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ ctx, input }) => {
      const { deleteNotification } = await Promise.resolve().then(() => (init_db(), db_exports));
      await deleteNotification(input.id, ctx.user.id);
      return { success: true };
    }),
    // Create notification (for testing / admin use)
    create: protectedProcedure.input(z8.object({
      title: z8.string().min(1),
      message: z8.string().min(1),
      type: z8.enum(["authentication", "certificate", "payment", "subscription", "nft", "referral", "system", "alert", "supply_chain", "autopilot"]),
      actionUrl: z8.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { createNotification } = await Promise.resolve().then(() => (init_db(), db_exports));
      return await createNotification({ ...input, userId: ctx.user.id, isRead: 0 });
    })
  }),
  // ─── HubSpot CRM ──────────────────────────────────────────────────────
  hubspot: router({
    status: protectedProcedure.query(async () => {
      const { isHubSpotConfigured: isHubSpotConfigured2, getCRMStats: getCRMStats2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
      if (!isHubSpotConfigured2()) return { connected: false, contacts: 0, companies: 0, deals: 0, error: "HUBSPOT_SERVICE_KEY is not configured. Add it in Settings \u2192 Secrets." };
      return await getCRMStats2();
    }),
    contacts: router({
      list: protectedProcedure.query(async () => {
        const { listContacts: listContacts2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await listContacts2();
      }),
      search: protectedProcedure.input(z8.object({ query: z8.string() })).query(async ({ input }) => {
        const { searchContacts: searchContacts2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await searchContacts2(input.query);
      }),
      create: protectedProcedure.input(z8.object({
        email: z8.string().email(),
        firstname: z8.string().optional(),
        lastname: z8.string().optional(),
        phone: z8.string().optional(),
        company: z8.string().optional()
      })).mutation(async ({ input }) => {
        const { createContact: createContact2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await createContact2(input);
      })
    }),
    companies: router({
      list: protectedProcedure.query(async () => {
        const { listCompanies: listCompanies2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await listCompanies2();
      }),
      create: protectedProcedure.input(z8.object({
        name: z8.string(),
        domain: z8.string().optional(),
        industry: z8.string().optional(),
        description: z8.string().optional()
      })).mutation(async ({ input }) => {
        const { createCompany: createCompany2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await createCompany2(input);
      })
    }),
    deals: router({
      list: protectedProcedure.query(async () => {
        const { listDeals: listDeals2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await listDeals2();
      }),
      create: protectedProcedure.input(z8.object({
        dealname: z8.string(),
        amount: z8.string().optional(),
        pipeline: z8.string().optional(),
        dealstage: z8.string().optional(),
        closedate: z8.string().optional()
      })).mutation(async ({ input }) => {
        const { createDeal: createDeal2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
        return await createDeal2(input);
      })
    })
  }),
  // ─── AI Chat ───────────────────────────────────────────────────────────
  ai: router({
    chat: protectedProcedure.input(z8.object({
      messages: z8.array(z8.object({ role: z8.enum(["user", "assistant", "system"]), content: z8.string() }))
    })).mutation(async ({ input }) => {
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      const systemPrompt = "You are AuthiChain AI, an expert assistant for product authentication, blockchain verification, supply chain management, and anti-counterfeiting. Help users understand authentication results, manage their products, and optimize their supply chain security.";
      const messages = [{ role: "system", content: systemPrompt }, ...input.messages];
      const response = await invokeLLM2({ messages });
      return { content: response.choices?.[0]?.message?.content || "I apologize, I could not generate a response." };
    })
  }),
  // ─── AuthiCharacter System ──────────────────────────────────────────
  character: router({
    generate: protectedProcedure.input(z8.object({
      archetype: z8.enum(["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]),
      brand: z8.string().optional(),
      object: z8.string().optional(),
      colorway: z8.string().optional(),
      mood: z8.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { startCharacterGeneration: startCharacterGeneration2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await startCharacterGeneration2(ctx.user.id, input.archetype, { brand: input.brand, object: input.object, colorway: input.colorway, mood: input.mood });
    }),
    generationStatus: protectedProcedure.input(z8.object({ generationId: z8.number() })).query(async ({ input }) => {
      const { getGenerationStatus: getGenerationStatus2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getGenerationStatus2(input.generationId);
    }),
    myGenerations: protectedProcedure.query(async ({ ctx }) => {
      const { getUserGenerations: getUserGenerations2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getUserGenerations2(ctx.user.id);
    }),
    myAssets: protectedProcedure.query(async ({ ctx }) => {
      const { getUserCharacterAssets: getUserCharacterAssets2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getUserCharacterAssets2(ctx.user.id);
    }),
    select: protectedProcedure.input(z8.object({ assetId: z8.number() })).mutation(async ({ ctx, input }) => {
      const { selectCharacterAsset: selectCharacterAsset2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await selectCharacterAsset2(ctx.user.id, input.assetId);
    }),
    createAgent: protectedProcedure.input(z8.object({
      characterAssetId: z8.number(),
      name: z8.string().min(2).max(64),
      agentType: z8.enum(["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"])
    })).mutation(async ({ ctx, input }) => {
      const { createProtocolAgent: createProtocolAgent2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await createProtocolAgent2(ctx.user.id, input.characterAssetId, input.name, input.agentType);
    }),
    myAgent: protectedProcedure.query(async ({ ctx }) => {
      const { getAgentByUser: getAgentByUser2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getAgentByUser2(ctx.user.id);
    }),
    agentRewards: protectedProcedure.input(z8.object({ agentId: z8.number() })).query(async ({ input }) => {
      const { getAgentRewards: getAgentRewards2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getAgentRewards2(input.agentId);
    }),
    leaderboard: publicProcedure.input(z8.object({ limit: z8.number().optional().default(20) })).query(async ({ input }) => {
      const { getAgentLeaderboard: getAgentLeaderboard2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getAgentLeaderboard2(input.limit);
    }),
    networkStats: publicProcedure.query(async () => {
      const { getNetworkStats: getNetworkStats2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await getNetworkStats2();
    }),
    mintPrep: protectedProcedure.input(z8.object({ assetId: z8.number() })).mutation(async ({ ctx, input }) => {
      const { prepareMint: prepareMint2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await prepareMint2(ctx.user.id, input.assetId);
    }),
    submitClaim: protectedProcedure.input(z8.object({
      agentId: z8.number(),
      productId: z8.number(),
      authenticationId: z8.number().nullable().optional(),
      claimType: z8.enum(["authentic", "counterfeit", "inconclusive", "needs_review"]),
      confidence: z8.number().min(0).max(100),
      reasoning: z8.string().optional()
    })).mutation(async ({ input }) => {
      const { submitVerificationClaim: submitVerificationClaim2 } = await Promise.resolve().then(() => (init_character_service(), character_service_exports));
      return await submitVerificationClaim2(
        input.agentId,
        input.productId,
        input.authenticationId ?? null,
        input.claimType,
        input.confidence,
        void 0,
        input.reasoning
      );
    })
  }),
  // ─── Scheduled Jobs (Admin) ─────────────────────────────────────────
  scheduler: router({
    listJobs: adminProcedure2.query(async () => {
      const { getRegisteredJobs: getRegisteredJobs2 } = await Promise.resolve().then(() => (init_scheduled_jobs(), scheduled_jobs_exports));
      return getRegisteredJobs2();
    }),
    getHistory: adminProcedure2.input(z8.object({
      jobName: z8.string().optional(),
      limit: z8.number().optional().default(50)
    })).query(async ({ input }) => {
      const { getJobHistory: getJobHistory2 } = await Promise.resolve().then(() => (init_scheduled_jobs(), scheduled_jobs_exports));
      return await getJobHistory2(input.jobName, input.limit);
    }),
    runManually: adminProcedure2.input(z8.object({
      jobName: z8.string()
    })).mutation(async ({ input }) => {
      const { runJobManually: runJobManually2 } = await Promise.resolve().then(() => (init_scheduled_jobs(), scheduled_jobs_exports));
      const success = await runJobManually2(input.jobName);
      if (!success) throw new TRPCError3({ code: "NOT_FOUND", message: "Job not found" });
      return { success: true, message: `Job ${input.jobName} triggered successfully` };
    })
  }),
  // ─── Services (Revenue) ─────────────────────────────────────────────────
  services: router({
    catalog: publicProcedure.query(() => {
      return SERVICE_LIST;
    }),
    getService: publicProcedure.input(z8.object({ key: z8.string() })).query(({ input }) => {
      const service = SERVICE_CATALOG[input.key];
      if (!service) throw new TRPCError3({ code: "NOT_FOUND", message: "Service not found" });
      return service;
    }),
    checkout: protectedProcedure.input(z8.object({
      serviceType: z8.enum(["authenticity_audit", "cinematic_page", "automation_setup", "landing_page", "brand_story_pack", "government_dossier"]),
      businessName: z8.string().optional(),
      businessType: z8.string().optional(),
      businessUrl: z8.string().optional(),
      notes: z8.string().optional(),
      origin: z8.string()
    })).mutation(async ({ ctx, input }) => {
      const service = SERVICE_CATALOG[input.serviceType];
      if (!service) throw new TRPCError3({ code: "NOT_FOUND", message: "Service not found" });
      const order = await createServiceOrder({
        userId: ctx.user.id,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name || void 0,
        serviceType: input.serviceType,
        amount: service.price,
        businessName: input.businessName,
        businessType: input.businessType,
        businessUrl: input.businessUrl,
        notes: input.notes
      });
      const checkoutUrl = await createPaymentCheckout({
        userId: ctx.user.id,
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || "Customer",
        description: service.name,
        amount: service.price,
        origin: input.origin,
        metadata: {
          service_type: input.serviceType,
          order_id: order.id.toString()
        }
      });
      await updateServiceOrderStatus(order.id, "pending", { stripePaymentIntentId: void 0 });
      return { checkoutUrl, orderId: order.id };
    }),
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return await getServiceOrdersByUser(ctx.user.id);
    }),
    getOrder: protectedProcedure.input(z8.object({ id: z8.number() })).query(async ({ ctx, input }) => {
      const order = await getServiceOrderById(input.id);
      if (!order) throw new TRPCError3({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return order;
    }),
    // Admin endpoints
    allOrders: adminProcedure2.query(async () => {
      return await getAllServiceOrders();
    }),
    updateStatus: adminProcedure2.input(z8.object({
      id: z8.number(),
      status: z8.enum(["pending", "paid", "in_progress", "delivered", "cancelled"]),
      deliveryUrl: z8.string().optional()
    })).mutation(async ({ input }) => {
      await updateServiceOrderStatus(input.id, input.status, {
        deliveryUrl: input.deliveryUrl,
        deliveredAt: input.status === "delivered" ? /* @__PURE__ */ new Date() : void 0
      });
      return { success: true };
    })
  }),
  // ─── Modularized Routers (from dev branch) ──────────────────────────────
  referral: referralRouter,
  affiliate: affiliateRouter,
  bonuses: bonusesRouter,
  marketplace: marketplaceRouter,
  missions: missionsRouter,
  tasks: tasksRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// shared/brands.ts
var BRANDS = {
  authichain: {
    id: "authichain",
    displayName: "AuthiChain",
    domain: "authichain.com",
    aliases: ["www.authichain.com"],
    tagline: "Protect Every Product. Verify Every Transaction.",
    description: "B2B enterprise product authentication \u2014 blockchain-verified seals, AI image analysis, and NFT certificates for supply chains.",
    accentToken: "accent",
    accentHex: "#00FFD1",
    ctaLabel: "Start Authenticating",
    ctaHref: "/dashboard"
  },
  qron: {
    id: "qron",
    displayName: "QRON",
    domain: "qron.space",
    aliases: ["www.qron.space", "qron.io", "www.qron.io"],
    tagline: "AI-Generated QR Art That Scans.",
    description: "Turn any URL into a work of art. 11 illusion-diffusion styles, cosmic to cyberpunk, rendered in seconds and still scannable.",
    accentToken: "qron",
    accentHex: "#F59E0B",
    ctaLabel: "Generate QR Art",
    ctaHref: "/qr-codes"
  },
  strainchain: {
    id: "strainchain",
    displayName: "StrainChain",
    domain: "strainchain.io",
    aliases: ["www.strainchain.io"],
    tagline: "Seed-to-Sale Provenance for Cannabis.",
    description: "Compliance-grade blockchain tracking for cultivators, processors, and dispensaries. METRC/BioTrack integration, strain NFTs, lab-cert hashing.",
    accentToken: "strain",
    accentHex: "#22C55E",
    ctaLabel: "Explore StrainChain",
    ctaHref: "/supply-chain"
  },
  govchain: {
    id: "govchain",
    displayName: "GovChain",
    domain: "govchain.us",
    aliases: ["www.govchain.us"],
    tagline: "Government Opportunities, Proven On-Chain.",
    description: "Automated SAM.gov ingestion, AI scoring, proposal drafting, and on-chain proof-of-win NFTs for federal contractors.",
    accentToken: "govchain",
    accentHex: "#1B4FD8",
    ctaLabel: "View Opportunities",
    ctaHref: "/grants"
  }
};
var DEFAULT_BRAND = "authichain";
function resolveBrand(hostname) {
  if (!hostname) return DEFAULT_BRAND;
  const host = hostname.toLowerCase().split(":")[0];
  for (const brand of Object.values(BRANDS)) {
    if (host === brand.domain) return brand.id;
    if (brand.aliases.includes(host)) return brand.id;
  }
  for (const brand of Object.values(BRANDS)) {
    if (host.endsWith("." + brand.domain)) return brand.id;
    for (const alias of brand.aliases) {
      if (host.endsWith("." + alias)) return brand.id;
    }
  }
  for (const brand of Object.values(BRANDS)) {
    if (host.includes(brand.id)) return brand.id;
  }
  return DEFAULT_BRAND;
}

// server/_core/brand-middleware.ts
var brandMiddleware = (req, res, next) => {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const brand = resolveBrand(host);
  res.locals.brand = brand;
  res.setHeader("X-Brand", brand);
  next();
};

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(brandMiddleware);
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    try {
      const { getStripe: getStripe3, processWebhookEvent: processWebhookEvent2 } = await Promise.resolve().then(() => (init_stripe_service(), stripe_service_exports));
      const stripe = getStripe3();
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);
      if (event.id.startsWith("evt_test_")) {
        return res.json({ verified: true });
      }
      const result = await processWebhookEvent2(event);
      if (result.handled && result.eventType === "checkout.session.completed" && result.userId && result.plan) {
        const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const db2 = await getDb2();
        if (db2) {
          const { subscriptions: subscriptions2, users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
          const { eq: eq11 } = await import("drizzle-orm");
          const { getPlanQuota: getPlanQuota3 } = await Promise.resolve().then(() => (init_stripe_products(), stripe_products_exports));
          const plan = result.plan;
          await db2.insert(subscriptions2).values({
            userId: result.userId,
            plan,
            status: "active",
            monthlyQuota: getPlanQuota3(plan),
            usedQuota: 0,
            stripeCustomerId: result.customerId || null,
            stripeSubscriptionId: result.subscriptionId || null,
            billingCycle: "monthly",
            currentPeriodStart: /* @__PURE__ */ new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
          });
          if (result.customerId) {
            await db2.update(users2).set({ stripeCustomerId: result.customerId }).where(eq11(users2.id, result.userId));
          }
          try {
            const { createSystemNotification: createSystemNotification2 } = await Promise.resolve().then(() => (init_db(), db_exports));
            await createSystemNotification2(
              result.userId,
              `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated`,
              `Your ${plan} subscription is now active.`,
              "subscription",
              "/subscriptions"
            );
          } catch {
          }
          try {
            const { syncPaymentToHubSpot: syncPaymentToHubSpot2 } = await Promise.resolve().then(() => (init_hubspot_service(), hubspot_service_exports));
            await syncPaymentToHubSpot2({ email: result.email || "", name: result.customerName || void 0, amount: 0, plan });
          } catch {
          }
        }
      }
      if (result.handled && result.eventType === "customer.subscription.deleted" && result.subscriptionId) {
        const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const db2 = await getDb2();
        if (db2) {
          const { subscriptions: subscriptions2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
          const { eq: eq11 } = await import("drizzle-orm");
          await db2.update(subscriptions2).set({ status: "cancelled", cancelledAt: /* @__PURE__ */ new Date() }).where(eq11(subscriptions2.stripeSubscriptionId, result.subscriptionId));
        }
      }
      if (result.handled && result.eventType === "invoice.payment_failed" && result.subscriptionId) {
        const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const db2 = await getDb2();
        if (db2) {
          const { subscriptions: subscriptions2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
          const { eq: eq11 } = await import("drizzle-orm");
          await db2.update(subscriptions2).set({ status: "past_due" }).where(eq11(subscriptions2.stripeSubscriptionId, result.subscriptionId));
        }
      }
      res.json({ received: true, type: event.type });
    } catch (err) {
      console.error(`[Stripe Webhook] Error: ${err.message}`);
      res.status(400).json({ error: err.message });
    }
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  return app;
}

// api/server.ts
var server_default = createApp();
export {
  server_default as default
};
