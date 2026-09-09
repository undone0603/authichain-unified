-- Add NFT and certificate URL columns to the certificates table
-- These are used by the certificate automation service after blockchain minting

ALTER TABLE certificates ADD COLUMN IF NOT EXISTS nft_token_id VARCHAR(128);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS nft_contract_address VARCHAR(128);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP;
