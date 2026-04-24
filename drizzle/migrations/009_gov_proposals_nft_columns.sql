-- drizzle/migrations/009_gov_proposals_nft_columns.sql
-- Adds NFT tracking columns consumed by scripts/mint-govchain-nfts.ts and
-- expands the status CHECK constraint to accept 'nft_minted'.
-- Applied to Supabase project nhdnkzhtadfkkluiulhs via MCP apply_migration
-- ("009_gov_proposals_nft_columns") on 2026-04-16. This file is the
-- canonical version-controlled copy.

ALTER TABLE public.gov_proposals
  ADD COLUMN IF NOT EXISTS nft_token_id   TEXT,
  ADD COLUMN IF NOT EXISTS nft_tx_hash    TEXT,
  ADD COLUMN IF NOT EXISTS nft_minted_at  TIMESTAMPTZ;

-- Replace the existing CHECK constraint (if present) with one that includes
-- 'nft_minted'. Using DROP + ADD rather than ALTER so it's idempotent across
-- re-runs of this migration.
ALTER TABLE public.gov_proposals
  DROP CONSTRAINT IF EXISTS gov_proposals_status_check;

ALTER TABLE public.gov_proposals
  ADD CONSTRAINT gov_proposals_status_check
  CHECK (status IN ('draft', 'reviewed', 'submitted', 'won', 'lost', 'nft_minted'));

-- Partial index: only rows that have actually been minted. Keeps the index
-- small since most proposals never become NFTs.
CREATE INDEX IF NOT EXISTS gov_proposals_nft_token_id_idx
  ON public.gov_proposals (nft_token_id) WHERE nft_token_id IS NOT NULL;
