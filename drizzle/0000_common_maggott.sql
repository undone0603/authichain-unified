CREATE TYPE "public"."ab_test_status" AS ENUM('draft', 'running', 'completed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'suspended', 'pending');--> statement-breakpoint
CREATE TYPE "public"."affiliate_tier" AS ENUM('basic', 'silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."archetype" AS ENUM('guardian', 'archivist', 'sentinel', 'scout', 'arbiter', 'merchant', 'explorer');--> statement-breakpoint
CREATE TYPE "public"."auction_status" AS ENUM('active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."auth_result" AS ENUM('authentic', 'counterfeit', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."autopilot_decision_status" AS ENUM('pending', 'executed', 'overridden', 'failed');--> statement-breakpoint
CREATE TYPE "public"."autopilot_mode" AS ENUM('conservative', 'balanced', 'aggressive');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('pending', 'submitted', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."batch_type" AS ENUM('verification', 'reward_settlement', 'agent_registration');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."bonus_status" AS ENUM('pending', 'claimed', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."bonus_tier" AS ENUM('starter', 'professional', 'enterprise', 'agency');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'paused');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('nurture', 'onboarding', 'trial_conversion', 'announcement', 'outreach');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."char_gen_status" AS ENUM('pending', 'generating', 'completed', 'selected', 'mint_ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'accepted', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('authentic', 'counterfeit', 'inconclusive', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."consensus_final_status" AS ENUM('authentic', 'counterfeit', 'inconclusive');--> statement-breakpoint
CREATE TYPE "public"."email_draft_status" AS ENUM('pending', 'approved', 'rejected', 'sent');--> statement-breakpoint
CREATE TYPE "public"."fraud_alert_status" AS ENUM('open', 'investigating', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."fraud_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."health_trend" AS ENUM('improving', 'stable', 'declining');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."mint_status" AS ENUM('not_minted', 'preparing', 'queued', 'minting', 'minted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mission_status" AS ENUM('pending', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mission_task_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."model_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."nft_status" AS ENUM('listed', 'sold', 'unlisted', 'auction');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('authentication', 'certificate', 'payment', 'subscription', 'nft', 'referral', 'system', 'alert', 'supply_chain', 'autopilot');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'crypto', 'escrow');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'escrowed');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'recalled', 'expired', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('active', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."purchase_type" AS ENUM('purchase', 'subscription', 'rental');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'active', 'converted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."referral_tier" AS ENUM('starter', 'professional', 'enterprise', 'agency');--> statement-breakpoint
CREATE TYPE "public"."revenue_type" AS ENUM('subscription', 'one_time', 'overage', 'affiliate', 'marketplace');--> statement-breakpoint
CREATE TYPE "public"."reward_reason" AS ENUM('verification_reward', 'consensus_participation', 'accuracy_bonus', 'streak_bonus', 'referral_reward', 'staking_yield', 'penalty');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('pending', 'settled', 'claimed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."service_order_status" AS ENUM('pending', 'paid', 'in_progress', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('authenticity_audit', 'cinematic_page', 'automation_setup', 'landing_page', 'brand_story_pack', 'government_dossier');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due', 'trialing', 'paused');--> statement-breakpoint
CREATE TYPE "public"."supply_chain_event_type" AS ENUM('manufactured', 'shipped', 'in_transit', 'customs', 'delivered', 'verified', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'brand');--> statement-breakpoint
CREATE TYPE "public"."white_label_status" AS ENUM('active', 'suspended', 'pending');--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"type" varchar(64) NOT NULL,
	"status" "ab_test_status" DEFAULT 'draft',
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
	"status" "commission_status" DEFAULT 'pending',
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
	"affiliateTier" "affiliate_tier" DEFAULT 'basic',
	"activeReferrals" integer DEFAULT 0,
	"paypalEmail" varchar(320),
	"status" "affiliate_status" DEFAULT 'pending',
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
	"modelStatus" "model_status" DEFAULT 'draft',
	"downloads" integer DEFAULT 0,
	"rating" numeric(3, 2) DEFAULT '0',
	"reviewCount" integer DEFAULT 0,
	"creatorId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
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
	"status" "auction_status" DEFAULT 'active',
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"endsAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authentications" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"userId" integer NOT NULL,
	"result" "auth_result" NOT NULL,
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
	"mode" "autopilot_mode" DEFAULT 'balanced',
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
	"status" "autopilot_decision_status" DEFAULT 'pending',
	"result" json,
	"overriddenBy" integer,
	"overrideReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bonuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"bonusType" varchar(64) NOT NULL,
	"bonusName" varchar(256) NOT NULL,
	"bonusValue" integer NOT NULL,
	"bonusTier" "bonus_tier" DEFAULT 'starter',
	"bonusStatus" "bonus_status" DEFAULT 'pending',
	"deliveryMethod" varchar(64),
	"claimedAt" timestamp,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"authenticationId" integer,
	"userId" integer NOT NULL,
	"certificateNumber" varchar(64) NOT NULL,
	"status" "certificate_status" DEFAULT 'active',
	"issuedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"blockchainTxHash" varchar(128),
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_certificateNumber_unique" UNIQUE("certificateNumber")
);
--> statement-breakpoint
CREATE TABLE "character_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"generationId" integer NOT NULL,
	"tenantId" varchar(128),
	"userId" integer,
	"providerAssetId" varchar(256),
	"imageUrl" text NOT NULL,
	"previewUrl" text,
	"thumbnailUrl" text,
	"prompt" text,
	"metadata" json,
	"protocolFitScore" numeric(4, 1),
	"thumbnailClarityScore" numeric(4, 1),
	"premiumFeelScore" numeric(4, 1),
	"silhouetteScore" numeric(4, 1),
	"trustSymbolismScore" numeric(4, 1),
	"mintReadinessScore" numeric(4, 1),
	"uiCompatibilityScore" numeric(4, 1),
	"totalScore" numeric(5, 2),
	"scoreIconity" integer,
	"scoreTrustClarity" integer,
	"scorePremiumFeel" integer,
	"scoreSilhouette" integer,
	"scoreUiCompat" integer,
	"scoreMintReady" integer,
	"scoreProtocolAlign" integer,
	"isRecommended" integer DEFAULT 0,
	"isSelected" integer DEFAULT 0,
	"selectedAt" timestamp,
	"metadataUri" text,
	"metadataHash" varchar(128),
	"imageHash" varchar(128),
	"mintStatus" "mint_status" DEFAULT 'not_minted',
	"mintTxHash" varchar(128),
	"tokenId" varchar(128),
	"mintedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" varchar(128),
	"objectId" varchar(128),
	"archetype" "archetype" NOT NULL,
	"style" varchar(256) DEFAULT 'premium futuristic heraldic concept art',
	"colorway" varchar(256),
	"mood" varchar(256),
	"prompt" text NOT NULL,
	"negativePrompt" text,
	"provider" varchar(64) DEFAULT 'openart',
	"providerModel" varchar(128),
	"variantCount" integer DEFAULT 4,
	"status" char_gen_status DEFAULT 'pending',
	"selectedAssetId" integer,
	"bestAssetId" integer,
	"context" json,
	"requestPayload" json,
	"responsePayload" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "checkpoint_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batchType" "batch_type" NOT NULL,
	"rootHash" varchar(128) NOT NULL,
	"chainId" integer DEFAULT 137,
	"txHash" varchar(128),
	"itemCount" integer DEFAULT 0,
	"status" "batch_status" DEFAULT 'pending',
	"finalizedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consensus_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"authenticationId" integer,
	"finalStatus" "consensus_final_status" NOT NULL,
	"finalScore" integer NOT NULL,
	"quorumCount" integer NOT NULL,
	"claimIds" json,
	"settledOnChain" integer DEFAULT 0,
	"checkpointBatchId" integer,
	"txHash" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_health_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"score" integer NOT NULL,
	"factors" json,
	"trend" "health_trend" DEFAULT 'stable',
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
	"type" "campaign_type" NOT NULL,
	"status" "campaign_status" DEFAULT 'draft',
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
	"status" "email_draft_status" DEFAULT 'pending',
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
	"severity" "fraud_severity" DEFAULT 'medium',
	"description" text,
	"status" "fraud_alert_status" DEFAULT 'open',
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
	"status" "invoice_status" DEFAULT 'draft',
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
	"status" "lead_status" DEFAULT 'new',
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
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"mission_id" varchar(36) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "mission_task_status" NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "mission_status" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "model_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"modelId" integer NOT NULL,
	"pricePaid" integer NOT NULL,
	"purchaseType" "purchase_type" DEFAULT 'purchase',
	"purchaseStatus" "purchase_status" DEFAULT 'active',
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
	"status" "nft_status" DEFAULT 'listed',
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
	"type" "notification_type" NOT NULL,
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
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending',
	"stripePaymentId" varchar(128),
	"cryptoPaymentId" varchar(128),
	"cryptoAddress" varchar(256),
	"escrowReleaseDate" timestamp,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
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
	"status" "product_status" DEFAULT 'active',
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocol_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"characterAssetId" integer,
	"name" varchar(256) NOT NULL,
	"agentType" "archetype" NOT NULL,
	"status" "agent_status" DEFAULT 'active',
	"level" integer DEFAULT 1,
	"xp" integer DEFAULT 0,
	"reputationScore" integer DEFAULT 100,
	"totalVerifications" integer DEFAULT 0,
	"successfulVerifications" integer DEFAULT 0,
	"totalClaims" integer DEFAULT 0,
	"consensusParticipations" integer DEFAULT 0,
	"qronEarned" numeric(18, 8) DEFAULT '0',
	"qronPending" numeric(18, 8) DEFAULT '0',
	"walletAddress" varchar(128),
	"tokenId" varchar(128),
	"policyConfig" json,
	"featureScopes" json,
	"metadata" json,
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
	"amount" numeric(18, 8) NOT NULL,
	"reason" "reward_reason" NOT NULL,
	"referenceType" varchar(64),
	"referenceId" integer,
	"status" "reward_status" DEFAULT 'pending',
	"settlementBatchId" integer,
	"claimedAt" timestamp,
	"metadata" json,
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
	"status" "referral_status" DEFAULT 'pending',
	"referredEmail" varchar(320),
	"tier" "referral_tier",
	"rewardAmount" numeric(10, 2) DEFAULT '0',
	"commissionPaid" numeric(10, 2) DEFAULT '0',
	"rewardPaid" integer DEFAULT 0,
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
	"type" "revenue_type" NOT NULL,
	"userId" integer,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"jobName" varchar(128) NOT NULL,
	"status" "job_run_status" NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"duration" integer,
	"result" json,
	"error" text,
	"itemsProcessed" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"customerEmail" varchar(320) NOT NULL,
	"customerName" varchar(256),
	"customerCompany" varchar(256),
	"customerPhone" varchar(32),
	"serviceType" "service_type" NOT NULL,
	"status" "service_order_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"stripeSessionId" varchar(256),
	"stripePaymentIntentId" varchar(256),
	"businessName" varchar(256),
	"businessType" varchar(128),
	"businessUrl" varchar(512),
	"notes" text,
	"deliveryUrl" text,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"status" "subscription_status" DEFAULT 'active',
	"monthlyQuota" integer NOT NULL,
	"usedQuota" integer DEFAULT 0,
	"stripeCustomerId" varchar(128),
	"stripeSubscriptionId" varchar(128),
	"paddleSubscriptionId" varchar(128),
	"paddleCustomerId" varchar(128),
	"billingCycle" "billing_cycle" DEFAULT 'monthly',
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
	"eventType" "supply_chain_event_type" NOT NULL,
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
	"open_id" varchar(256) NOT NULL,
	"email" varchar(320),
	"name" varchar(256),
	"login_method" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"stripe_customer_id" varchar(256),
	"last_signed_in" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "verification_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" integer NOT NULL,
	"productId" integer NOT NULL,
	"authenticationId" integer,
	"claimType" "claim_type" NOT NULL,
	"confidence" integer NOT NULL,
	"evidence" json,
	"reasoning" text,
	"status" "claim_status" DEFAULT 'pending',
	"weight" numeric(5, 3) DEFAULT '1.000',
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
	"status" "white_label_status" DEFAULT 'pending',
	"monthlyApiCalls" integer DEFAULT 0,
	"apiCallLimit" integer DEFAULT 10000,
	"features" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_clients_apiKey_unique" UNIQUE("apiKey")
);
--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD CONSTRAINT "mission_tasks_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;