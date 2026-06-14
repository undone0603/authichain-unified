CREATE TABLE "ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"type" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'draft',
	"variants" json,
	"winnerVariant" varchar(64),
	"totalParticipants" integer DEFAULT 0,
	"startedAt" timestamp,
	"endedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"action" varchar(128) NOT NULL,
	"entityType" varchar(64),
	"entityId" integer,
	"details" json,
	"ipAddress" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliateId" integer NOT NULL,
	"paymentId" integer,
	"amount" numeric(18, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"affiliateCode" varchar(32) NOT NULL,
	"commissionRate" numeric(5, 2) DEFAULT '10.00',
	"totalEarnings" numeric(18, 2) DEFAULT '0',
	"pendingPayout" numeric(18, 2) DEFAULT '0',
	"totalReferrals" integer DEFAULT 0,
	"totalConversions" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending',
	"affiliateTier" varchar(50) DEFAULT 'basic',
	"activeReferrals" integer DEFAULT 0,
	"paypalEmail" varchar(320),
	"payoutMethod" varchar(64),
	"payoutDetails" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_affiliateCode_unique" UNIQUE("affiliateCode")
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"category" varchar(128),
	"price" integer DEFAULT 0 NOT NULL,
	"modelStatus" varchar(50) DEFAULT 'draft',
	"downloads" integer DEFAULT 0,
	"rating" numeric(3, 2) DEFAULT '0',
	"reviewCount" integer DEFAULT 0,
	"creatorId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"date" timestamp NOT NULL,
	"endpoint" varchar(128) DEFAULT 'api' NOT NULL,
	"calls" integer DEFAULT 0,
	"cost" numeric(12, 4) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"auctionId" integer NOT NULL,
	"bidderId" integer NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" serial PRIMARY KEY NOT NULL,
	"nftId" integer NOT NULL,
	"sellerId" integer NOT NULL,
	"startPrice" numeric(18, 8) NOT NULL,
	"reservePrice" numeric(18, 8),
	"currentBid" numeric(18, 8),
	"highestBidderId" integer,
	"bidCount" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'active',
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"endsAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authentications" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"userId" integer NOT NULL,
	"result" varchar(50) NOT NULL,
	"confidenceScore" integer NOT NULL,
	"aiAnalysis" json,
	"imageUrl" text,
	"isPublic" integer DEFAULT 0,
	"shareToken" varchar(128),
	"shareCount" integer DEFAULT 0,
	"verificationMethod" varchar(64) DEFAULT 'ai_image',
	"blockchainVerified" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0,
	"mode" varchar(50) DEFAULT 'balanced',
	"guardrails" json,
	"updatedBy" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(64) NOT NULL,
	"action" varchar(256) NOT NULL,
	"reasoning" text,
	"confidence" integer,
	"status" varchar(50) DEFAULT 'pending',
	"result" json,
	"overriddenBy" integer,
	"overrideReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bayesian_priors" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment" varchar(64) NOT NULL,
	"priorAlpha" numeric(10, 4) DEFAULT '2.0000',
	"priorBeta" numeric(10, 4) DEFAULT '18.0000',
	"currentMean" numeric(5, 4) DEFAULT '0.1000',
	"observationsCount" integer DEFAULT 0,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bayesian_priors_segment_unique" UNIQUE("segment")
);
--> statement-breakpoint
CREATE TABLE "bonuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"bonusType" varchar(64) NOT NULL,
	"bonusName" varchar(256) NOT NULL,
	"bonusValue" integer NOT NULL,
	"bonusTier" varchar(50),
	"bonusStatus" varchar(50) DEFAULT 'pending',
	"deliveryMethod" varchar(64),
	"claimedAt" timestamp,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"monthlyLimit" numeric(18, 2) NOT NULL,
	"spent" numeric(18, 2) DEFAULT '0.00',
	"currency" varchar(16) DEFAULT 'USD',
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"authenticationId" integer,
	"userId" integer NOT NULL,
	"certificateNumber" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"issuedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"blockchainTxHash" varchar(128),
	"nftTokenId" varchar(256),
	"nftContractAddress" varchar(64),
	"certificateUrl" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_certificateNumber_unique" UNIQUE("certificateNumber")
);
--> statement-breakpoint
CREATE TABLE "character_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"generationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"imageUrl" text NOT NULL,
	"prompt" text,
	"isRecommended" integer DEFAULT 0,
	"isSelected" integer DEFAULT 0,
	"mintStatus" varchar(50) DEFAULT 'not_minted',
	"nftTokenId" varchar(64),
	"metadataUri" text,
	"metadataHash" varchar(128),
	"imageHash" varchar(128),
	"protocolFitScore" varchar(8),
	"thumbnailClarityScore" varchar(8),
	"premiumFeelScore" varchar(8),
	"silhouetteScore" varchar(8),
	"trustSymbolismScore" varchar(8),
	"mintReadinessScore" varchar(8),
	"uiCompatibilityScore" varchar(8),
	"totalScore" varchar(8),
	"scoreIconity" integer,
	"scoreTrustClarity" integer,
	"scorePremiumFeel" integer,
	"scoreSilhouette" integer,
	"scoreUiCompat" integer,
	"scoreMintReady" integer,
	"scoreProtocolAlign" integer,
	"selectedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"archetype" varchar(32) NOT NULL,
	"style" varchar(128),
	"colorway" varchar(64),
	"mood" varchar(64),
	"prompt" text NOT NULL,
	"negativePrompt" text,
	"provider" varchar(64),
	"providerModel" varchar(64),
	"variantCount" integer DEFAULT 1,
	"status" varchar(50) DEFAULT 'pending',
	"context" text,
	"bestAssetId" integer,
	"selectedAssetId" integer,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpoint_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batchHash" varchar(128) NOT NULL,
	"blockchainTxHash" varchar(128),
	"claimCount" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending',
	"finalizedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consensus_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"authenticationId" integer NOT NULL,
	"verdict" varchar(50) NOT NULL,
	"confidence" integer NOT NULL,
	"participantCount" integer DEFAULT 0,
	"finalizedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_health_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"score" integer NOT NULL,
	"factors" json,
	"trend" varchar(50) DEFAULT 'stable',
	"lastCalculatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(256) NOT NULL,
	"subject" varchar(512) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft',
	"recipientCount" integer DEFAULT 0,
	"sentCount" integer DEFAULT 0,
	"openCount" integer DEFAULT 0,
	"clickCount" integer DEFAULT 0,
	"bounceCount" integer DEFAULT 0,
	"scheduledAt" timestamp,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectName" varchar(256),
	"prospectEmail" varchar(320) NOT NULL,
	"prospectCompany" varchar(256),
	"prospectTitle" varchar(256),
	"industry" varchar(128),
	"subject" varchar(512) NOT NULL,
	"body" text NOT NULL,
	"templateUsed" varchar(128),
	"status" varchar(50) DEFAULT 'pending',
	"generatedBy" varchar(64) DEFAULT 'ai_manager',
	"approvedBy" integer,
	"approvedAt" timestamp,
	"sentAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"productId" integer,
	"alertType" varchar(128) NOT NULL,
	"severity" varchar(50) DEFAULT 'medium',
	"description" text,
	"status" varchar(50) DEFAULT 'open',
	"resolvedBy" integer,
	"resolvedAt" timestamp,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subscriptionId" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'USD',
	"status" varchar(50) DEFAULT 'draft',
	"stripeInvoiceId" varchar(128),
	"paidAt" timestamp,
	"dueDate" timestamp,
	"items" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(256),
	"company" varchar(256),
	"title" varchar(256),
	"phone" varchar(32),
	"source" varchar(128),
	"score" integer DEFAULT 0,
	"leadScore" integer DEFAULT 0,
	"emailOpened" boolean DEFAULT false,
	"emailClicked" boolean DEFAULT false,
	"emailReplied" boolean DEFAULT false,
	"roiCalculated" boolean DEFAULT false,
	"demoStarted" boolean DEFAULT false,
	"interactionsCount" integer DEFAULT 0,
	"isVip" boolean DEFAULT false,
	"contractSent" boolean DEFAULT false,
	"contractOpened" boolean DEFAULT false,
	"contractSigned" boolean DEFAULT false,
	"roiSavings" integer,
	"numProducts" integer,
	"dealStage" varchar(64),
	"status" varchar(50) DEFAULT 'new',
	"industry" varchar(128),
	"notes" text,
	"lastContactedAt" timestamp,
	"assignedTo" integer,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_tasks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"missionId" varchar(64) NOT NULL,
	"kind" varchar(128) NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"payload" json,
	"result" json,
	"error" text,
	"scheduledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"modelId" integer NOT NULL,
	"pricePaid" integer NOT NULL,
	"purchaseType" varchar(50) DEFAULT 'purchase',
	"purchaseStatus" varchar(50) DEFAULT 'active',
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"modelId" integer NOT NULL,
	"userId" integer NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nft_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"description" text,
	"imageUrl" text,
	"bannerUrl" text,
	"category" varchar(128),
	"floorPrice" numeric(18, 8) DEFAULT '0',
	"totalVolume" numeric(18, 8) DEFAULT '0',
	"itemCount" integer DEFAULT 0,
	"ownerCount" integer DEFAULT 0,
	"verified" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nft_collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "nfts" (
	"id" serial PRIMARY KEY NOT NULL,
	"collectionId" integer,
	"ownerId" integer NOT NULL,
	"creatorId" integer NOT NULL,
	"name" varchar(512) NOT NULL,
	"description" text,
	"imageUrl" text,
	"ipfsHash" varchar(128),
	"tokenId" varchar(128),
	"contractAddress" varchar(128),
	"blockchain" varchar(64) DEFAULT 'polygon',
	"price" numeric(18, 8),
	"currency" varchar(16) DEFAULT 'ETH',
	"rarityScore" integer,
	"rarityRank" integer,
	"traits" json,
	"status" varchar(50) DEFAULT 'listed',
	"viewCount" integer DEFAULT 0,
	"likeCount" integer DEFAULT 0,
	"productId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(256) NOT NULL,
	"message" text NOT NULL,
	"isRead" integer DEFAULT 0 NOT NULL,
	"actionUrl" varchar(512),
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(16) DEFAULT 'USD',
	"method" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"stripePaymentId" varchar(128),
	"cryptoPaymentId" varchar(128),
	"cryptoAddress" varchar(256),
	"escrowReleaseDate" timestamp,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(64) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(16) DEFAULT 'USD',
	"status" varchar(50) DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(512) NOT NULL,
	"brand" varchar(256),
	"category" varchar(128),
	"description" text,
	"imageUrl" text,
	"serialNumber" varchar(256),
	"batchNumber" varchar(256),
	"manufacturingDate" timestamp,
	"blockchainTxHash" varchar(128),
	"nftTokenId" varchar(128),
	"status" varchar(50) DEFAULT 'active',
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"promptHash" varchar(128) NOT NULL,
	"response" text NOT NULL,
	"provider" varchar(64),
	"model" varchar(64),
	"usage" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_cache_promptHash_unique" UNIQUE("promptHash")
);
--> statement-breakpoint
CREATE TABLE "protocol_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"characterAssetId" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"agentType" varchar(32) NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"level" integer DEFAULT 1,
	"xp" integer DEFAULT 0,
	"reputationScore" integer DEFAULT 0,
	"qronPending" numeric(20, 9) DEFAULT '0.000000000',
	"totalVerifications" integer DEFAULT 0,
	"successfulVerifications" integer DEFAULT 0,
	"totalClaims" integer DEFAULT 0,
	"featureScopes" json,
	"policyConfig" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"userId" integer NOT NULL,
	"qrData" text NOT NULL,
	"qrImageUrl" text,
	"scanCount" integer DEFAULT 0,
	"lastScannedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qron_reward_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" integer NOT NULL,
	"userId" integer NOT NULL,
	"amount" numeric(20, 9) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"referenceType" varchar(32),
	"referenceId" integer,
	"status" varchar(50) DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"referralCode" varchar(32) NOT NULL,
	"ipAddress" varchar(64),
	"userAgent" text,
	"referer" text,
	"landingPage" text,
	"convertedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrerId" integer NOT NULL,
	"referredId" integer,
	"referralCode" varchar(32) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"rewardAmount" numeric(10, 2) DEFAULT '0',
	"rewardPaid" integer DEFAULT 0,
	"referredEmail" varchar(320),
	"tier" varchar(50),
	"commissionPaid" numeric(10, 2) DEFAULT '0',
	"convertedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referralCode_unique" UNIQUE("referralCode")
);
--> statement-breakpoint
CREATE TABLE "revenue_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(128) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'USD',
	"type" varchar(50) NOT NULL,
	"userId" integer,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_runs" (
	"id" bigint PRIMARY KEY NOT NULL,
	"jobName" varchar(128) NOT NULL,
	"status" varchar(50) NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"duration" integer,
	"itemsProcessed" integer DEFAULT 0,
	"result" json,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"serviceType" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0,
	"details" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staking_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"agentId" integer,
	"amount" numeric(20, 9) NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"multiplier" numeric(5, 2) DEFAULT '1.00',
	"apy" numeric(5, 2) DEFAULT '5.00',
	"rewardsEarned" numeric(20, 9) DEFAULT '0' NOT NULL,
	"lastRewardCalculation" timestamp DEFAULT now() NOT NULL,
	"stakedAt" timestamp DEFAULT now() NOT NULL,
	"releaseAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"monthlyQuota" integer NOT NULL,
	"usedQuota" integer DEFAULT 0,
	"stripeCustomerId" varchar(128),
	"stripeSubscriptionId" varchar(128),
	"paddleSubscriptionId" varchar(128),
	"paddleCustomerId" varchar(128),
	"billingCycle" varchar(50) DEFAULT 'monthly',
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"trialEndsAt" timestamp,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"eventType" varchar(50) NOT NULL,
	"location" varchar(512),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"temperature" numeric(5, 2),
	"humidity" numeric(5, 2),
	"handler" varchar(256),
	"notes" text,
	"blockchainTxHash" varchar(128),
	"iotDeviceId" varchar(128),
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(16) DEFAULT 'USD',
	"status" varchar(50) DEFAULT 'pending',
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subscriptionId" integer,
	"type" varchar(64) NOT NULL,
	"quantity" integer DEFAULT 1,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"walletAddress" varchar(128),
	"avatarUrl" text,
	"company" varchar(256),
	"title" varchar(256),
	"phone" varchar(32),
	"onboardingCompleted" integer DEFAULT 0,
	"stripeCustomerId" varchar(128),
	"paddleCustomerId" varchar(128),
	"points" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "verification_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" integer NOT NULL,
	"productId" integer NOT NULL,
	"authenticationId" integer,
	"claimType" varchar(50) NOT NULL,
	"confidence" integer NOT NULL,
	"evidence" text,
	"reasoning" text,
	"weight" varchar(16),
	"status" varchar(50) DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"companyName" varchar(256) NOT NULL,
	"domain" varchar(256),
	"logoUrl" text,
	"primaryColor" varchar(16),
	"secondaryColor" varchar(16),
	"apiKey" varchar(128) NOT NULL,
	"apiSecret" varchar(256),
	"status" varchar(50) DEFAULT 'pending',
	"monthlyApiCalls" integer DEFAULT 0,
	"apiCallLimit" integer DEFAULT 10000,
	"features" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_clients_apiKey_unique" UNIQUE("apiKey")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_daily_client_date_endpoint_idx" ON "api_usage_daily" USING btree ("clientId","date","endpoint");