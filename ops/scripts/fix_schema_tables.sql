-- SQL Migration to resolve PGRST205 schema errors
-- Apply this script in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    code TEXT NOT NULL UNIQUE,
    discount_amount TEXT,
    siphon_billed DECIMAL(10, 2),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name TEXT,
    summary TEXT,
    report_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (optional, for security)
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_reports ENABLE ROW LEVEL SECURITY;
