CREATE TABLE `ab_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`type` varchar(64) NOT NULL,
	`status` enum('draft','running','completed','paused') DEFAULT 'draft',
	`variants` json,
	`winnerVariant` varchar(64),
	`totalParticipants` int DEFAULT 0,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`details` json,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliateId` int NOT NULL,
	`paymentId` int,
	`amount` decimal(18,2) NOT NULL,
	`status` enum('pending','approved','paid','rejected') DEFAULT 'pending',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`affiliateCode` varchar(32) NOT NULL,
	`commissionRate` decimal(5,2) DEFAULT '10.00',
	`totalEarnings` decimal(18,2) DEFAULT '0',
	`pendingPayout` decimal(18,2) DEFAULT '0',
	`totalReferrals` int DEFAULT 0,
	`totalConversions` int DEFAULT 0,
	`status` enum('active','suspended','pending') DEFAULT 'pending',
	`payoutMethod` varchar(64),
	`payoutDetails` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_affiliateCode_unique` UNIQUE(`affiliateCode`)
);
--> statement-breakpoint
CREATE TABLE `auction_bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`bidderId` int NOT NULL,
	`amount` decimal(18,8) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auction_bids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nftId` int NOT NULL,
	`sellerId` int NOT NULL,
	`startPrice` decimal(18,8) NOT NULL,
	`reservePrice` decimal(18,8),
	`currentBid` decimal(18,8),
	`highestBidderId` int,
	`bidCount` int DEFAULT 0,
	`status` enum('active','ended','cancelled') DEFAULT 'active',
	`startsAt` timestamp NOT NULL DEFAULT (now()),
	`endsAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auctions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `authentications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`result` enum('authentic','counterfeit','uncertain') NOT NULL,
	`confidenceScore` int NOT NULL,
	`aiAnalysis` json,
	`imageUrl` text,
	`isPublic` int DEFAULT 0,
	`shareToken` varchar(128),
	`shareCount` int DEFAULT 0,
	`verificationMethod` varchar(64) DEFAULT 'ai_image',
	`blockchainVerified` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authentications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `autopilot_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enabled` int DEFAULT 0,
	`mode` enum('conservative','balanced','aggressive') DEFAULT 'balanced',
	`guardrails` json,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `autopilot_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `autopilot_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(64) NOT NULL,
	`action` varchar(256) NOT NULL,
	`reasoning` text,
	`confidence` int,
	`status` enum('pending','executed','overridden','failed') DEFAULT 'pending',
	`result` json,
	`overriddenBy` int,
	`overrideReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `autopilot_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`authenticationId` int,
	`userId` int NOT NULL,
	`certificateNumber` varchar(64) NOT NULL,
	`status` enum('active','revoked','expired') DEFAULT 'active',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`blockchainTxHash` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_certificateNumber_unique` UNIQUE(`certificateNumber`)
);
--> statement-breakpoint
CREATE TABLE `customer_health_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`score` int NOT NULL,
	`factors` json,
	`trend` enum('improving','stable','declining') DEFAULT 'stable',
	`lastCalculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_health_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`subject` varchar(512) NOT NULL,
	`body` text NOT NULL,
	`type` enum('nurture','onboarding','trial_conversion','announcement','outreach') NOT NULL,
	`status` enum('draft','scheduled','sending','sent','paused') DEFAULT 'draft',
	`recipientCount` int DEFAULT 0,
	`sentCount` int DEFAULT 0,
	`openCount` int DEFAULT 0,
	`clickCount` int DEFAULT 0,
	`bounceCount` int DEFAULT 0,
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prospectName` varchar(256),
	`prospectEmail` varchar(320) NOT NULL,
	`prospectCompany` varchar(256),
	`prospectTitle` varchar(256),
	`industry` varchar(128),
	`subject` varchar(512) NOT NULL,
	`body` text NOT NULL,
	`templateUsed` varchar(128),
	`status` enum('pending','approved','rejected','sent') DEFAULT 'pending',
	`generatedBy` varchar(64) DEFAULT 'ai_manager',
	`approvedBy` int,
	`approvedAt` timestamp,
	`sentAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fraud_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`productId` int,
	`alertType` varchar(128) NOT NULL,
	`severity` enum('low','medium','high','critical') DEFAULT 'medium',
	`description` text,
	`status` enum('open','investigating','resolved','dismissed') DEFAULT 'open',
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(8) DEFAULT 'USD',
	`status` enum('draft','pending','paid','overdue','cancelled') DEFAULT 'draft',
	`stripeInvoiceId` varchar(128),
	`paidAt` timestamp,
	`dueDate` timestamp,
	`items` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(256),
	`company` varchar(256),
	`title` varchar(256),
	`phone` varchar(32),
	`source` varchar(128),
	`score` int DEFAULT 0,
	`status` enum('new','contacted','qualified','proposal','won','lost') DEFAULT 'new',
	`industry` varchar(128),
	`notes` text,
	`lastContactedAt` timestamp,
	`assignedTo` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nft_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`slug` varchar(256) NOT NULL,
	`description` text,
	`imageUrl` text,
	`bannerUrl` text,
	`category` varchar(128),
	`floorPrice` decimal(18,8) DEFAULT '0',
	`totalVolume` decimal(18,8) DEFAULT '0',
	`itemCount` int DEFAULT 0,
	`ownerCount` int DEFAULT 0,
	`verified` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nft_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `nft_collections_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `nfts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int,
	`ownerId` int NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(512) NOT NULL,
	`description` text,
	`imageUrl` text,
	`ipfsHash` varchar(128),
	`tokenId` varchar(128),
	`contractAddress` varchar(128),
	`blockchain` varchar(64) DEFAULT 'polygon',
	`price` decimal(18,8),
	`currency` varchar(16) DEFAULT 'ETH',
	`rarityScore` int,
	`rarityRank` int,
	`traits` json,
	`status` enum('listed','sold','unlisted','auction') DEFAULT 'listed',
	`viewCount` int DEFAULT 0,
	`likeCount` int DEFAULT 0,
	`productId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nfts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(18,8) NOT NULL,
	`currency` varchar(16) DEFAULT 'USD',
	`method` enum('stripe','crypto','escrow') NOT NULL,
	`status` enum('pending','completed','failed','refunded','escrowed') DEFAULT 'pending',
	`stripePaymentId` varchar(128),
	`cryptoPaymentId` varchar(128),
	`cryptoAddress` varchar(256),
	`escrowReleaseDate` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(512) NOT NULL,
	`brand` varchar(256),
	`category` varchar(128),
	`description` text,
	`imageUrl` text,
	`serialNumber` varchar(256),
	`batchNumber` varchar(256),
	`manufacturingDate` timestamp,
	`blockchainTxHash` varchar(128),
	`nftTokenId` varchar(128),
	`status` enum('active','recalled','expired','flagged') DEFAULT 'active',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`qrData` text NOT NULL,
	`qrImageUrl` text,
	`scanCount` int DEFAULT 0,
	`lastScannedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qr_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`referredId` int,
	`referralCode` varchar(32) NOT NULL,
	`status` enum('pending','active','converted','expired') DEFAULT 'pending',
	`rewardAmount` decimal(10,2) DEFAULT '0',
	`rewardPaid` int DEFAULT 0,
	`convertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `revenue_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(128) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currency` varchar(8) DEFAULT 'USD',
	`type` enum('subscription','one_time','overage','affiliate','marketplace') NOT NULL,
	`userId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`plan` enum('starter','professional','enterprise') NOT NULL,
	`status` enum('active','cancelled','past_due','trialing','paused') DEFAULT 'active',
	`monthlyQuota` int NOT NULL,
	`usedQuota` int DEFAULT 0,
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`billingCycle` enum('monthly','annual') DEFAULT 'monthly',
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`trialEndsAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supply_chain_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`eventType` enum('manufactured','shipped','in_transit','customs','delivered','verified','recalled') NOT NULL,
	`location` varchar(512),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`temperature` decimal(5,2),
	`humidity` decimal(5,2),
	`handler` varchar(256),
	`notes` text,
	`blockchainTxHash` varchar(128),
	`iotDeviceId` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supply_chain_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int,
	`type` varchar(64) NOT NULL,
	`quantity` int DEFAULT 1,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `white_label_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(256) NOT NULL,
	`domain` varchar(256),
	`logoUrl` text,
	`primaryColor` varchar(16),
	`secondaryColor` varchar(16),
	`apiKey` varchar(128) NOT NULL,
	`apiSecret` varchar(256),
	`status` enum('active','suspended','pending') DEFAULT 'pending',
	`monthlyApiCalls` int DEFAULT 0,
	`apiCallLimit` int DEFAULT 10000,
	`features` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `white_label_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `white_label_clients_apiKey_unique` UNIQUE(`apiKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `walletAddress` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `company` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `title` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` int DEFAULT 0;