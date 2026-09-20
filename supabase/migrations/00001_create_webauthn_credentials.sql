-- 1. Create the ledger for anonymous device biometrics
CREATE TABLE public.webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    public_key BYTEA NOT NULL,
    sign_count BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for lightning-fast Worker lookups during the /verify-scan process
CREATE INDEX idx_credential_id ON public.webauthn_credentials(credential_id);

-- 3. Lock it down with Row Level Security (RLS)
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- 4. Restrict access entirely to your edge infrastructure
CREATE POLICY "Service role manages WebAuthn" ON public.webauthn_credentials
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
