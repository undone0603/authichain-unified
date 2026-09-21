-- SQL Migration: Create immutable evidence table

CREATE TABLE IF NOT EXISTS evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    artifact_hash TEXT NOT NULL,
    issuer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL
);

-- Enable RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Create IMMUTABLE Policy: Insert allowed, Update/Delete prohibited
CREATE POLICY evidence_insert_policy ON evidence
FOR INSERT WITH CHECK (true);

-- No update/delete policies means default is restrict all (immutable)
