-- SQL Migration: Add tenant_id to products and enable RLS

-- 1. Ensure tenants table exists (assuming it does, or create if missing)
-- CREATE TABLE IF NOT EXISTS tenants (id SERIAL PRIMARY KEY, name TEXT);

-- 2. Add tenant_id column
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- 3. Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policy
-- This assumes auth.uid() or a similar mechanism identifies the user/tenant context
-- For Supabase, we often use a custom claim or mapping table
DROP POLICY IF EXISTS tenant_isolation_policy ON products;
CREATE POLICY tenant_isolation_policy ON products
USING (tenant_id = (current_setting('app.current_tenant_id', true))::integer);

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
