-- agentz/core/schema_federal.sql
-- Schema for the Federal Grant Pipeline Ledger (Phase 14)

CREATE TABLE IF NOT EXISTS federal_pipeline (
    notice_id TEXT PRIMARY KEY,
    title TEXT,
    agency TEXT,
    deadline TIMESTAMPTZ,
    fit_score INTEGER,
    status TEXT DEFAULT 'drafted',
    artifact_path TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) if needed, or leave open for the service role
ALTER TABLE federal_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service role" ON federal_pipeline USING (true) WITH CHECK (true);
