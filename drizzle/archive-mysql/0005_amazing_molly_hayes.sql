CREATE TABLE `character_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generationId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`thumbnailUrl` text,
	`scoreIconity` int,
	`scoreTrustClarity` int,
	`scorePremiumFeel` int,
	`scoreSilhouette` int,
	`scoreUiCompat` int,
	`scoreMintReady` int,
	`scoreProtocolAlign` int,
	`totalScore` int,
	`isRecommended` int DEFAULT 0,
	`isSelected` int DEFAULT 0,
	`selectedAt` timestamp,
	`metadataUri` text,
	`metadataHash` varchar(128),
	`imageHash` varchar(128),
	`mintStatus` enum('not_minted','preparing','queued','minting','minted','failed') DEFAULT 'not_minted',
	`mintTxHash` varchar(128),
	`tokenId` varchar(128),
	`mintedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `character_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `character_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`archetype` enum('guardian','archivist','sentinel','scout','arbiter') NOT NULL,
	`style` varchar(128) DEFAULT 'protocol-heraldic',
	`prompt` text NOT NULL,
	`model` varchar(128),
	`variantCount` int DEFAULT 4,
	`status` enum('pending','generating','completed','failed') DEFAULT 'pending',
	`context` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `character_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checkpoint_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchType` enum('verification','reward_settlement','agent_registration') NOT NULL,
	`rootHash` varchar(128) NOT NULL,
	`chainId` int DEFAULT 137,
	`txHash` varchar(128),
	`itemCount` int DEFAULT 0,
	`status` enum('pending','submitted','confirmed','failed') DEFAULT 'pending',
	`finalizedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checkpoint_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consensus_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`authenticationId` int,
	`finalStatus` enum('authentic','counterfeit','inconclusive') NOT NULL,
	`finalScore` int NOT NULL,
	`quorumCount` int NOT NULL,
	`claimIds` json,
	`settledOnChain` int DEFAULT 0,
	`checkpointBatchId` int,
	`txHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consensus_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `protocol_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`characterAssetId` int,
	`name` varchar(256) NOT NULL,
	`agentType` enum('guardian','archivist','sentinel','scout','arbiter') NOT NULL,
	`status` enum('active','inactive','suspended') DEFAULT 'active',
	`level` int DEFAULT 1,
	`xp` int DEFAULT 0,
	`reputationScore` int DEFAULT 100,
	`totalVerifications` int DEFAULT 0,
	`successfulVerifications` int DEFAULT 0,
	`totalClaims` int DEFAULT 0,
	`consensusParticipations` int DEFAULT 0,
	`qronEarned` decimal(18,8) DEFAULT '0',
	`qronPending` decimal(18,8) DEFAULT '0',
	`walletAddress` varchar(128),
	`tokenId` varchar(128),
	`policyConfig` json,
	`featureScopes` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `protocol_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qron_reward_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(18,8) NOT NULL,
	`reason` enum('verification_reward','consensus_participation','accuracy_bonus','streak_bonus','referral_reward','staking_yield','penalty') NOT NULL,
	`referenceType` varchar(64),
	`referenceId` int,
	`status` enum('pending','settled','claimed','expired') DEFAULT 'pending',
	`settlementBatchId` int,
	`claimedAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qron_reward_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`productId` int NOT NULL,
	`authenticationId` int,
	`claimType` enum('authentic','counterfeit','inconclusive','needs_review') NOT NULL,
	`confidence` int NOT NULL,
	`evidence` json,
	`reasoning` text,
	`status` enum('pending','accepted','rejected','superseded') DEFAULT 'pending',
	`weight` decimal(5,3) DEFAULT '1.000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_claims_id` PRIMARY KEY(`id`)
);
