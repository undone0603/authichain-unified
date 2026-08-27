CREATE TABLE "product_qrons" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"productName" text NOT NULL,
	"brand" varchar(256),
	"category" varchar(64),
	"mode" varchar(32) NOT NULL,
	"seed" text NOT NULL,
	"imageUrl" text,
	"thumbnailUrl" text,
	"fingerprintHash" text,
	"nftTokenId" varchar(128),
	"openartUrl" text,
	"openartRegistered" boolean DEFAULT false,
	"trustScore" integer DEFAULT 0,
	"verifiedScanCount" integer DEFAULT 0,
	"fakeFlagCount" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qron_scan_verdicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"qronId" varchar(128) NOT NULL,
	"scannedImageUrl" text,
	"similarityScore" real,
	"verdict" varchar(32),
	"details" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "protocol_agents" ADD COLUMN "walletAddress" varchar(64);--> statement-breakpoint
ALTER TABLE "protocol_agents" ADD COLUMN "qronEarned" numeric(20, 9) DEFAULT '0.000000000';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "metadata" json;