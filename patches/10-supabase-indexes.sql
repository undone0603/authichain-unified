CREATE INDEX IF NOT EXISTS "idx_products_brand" ON "products" ("brand");
CREATE INDEX IF NOT EXISTS "idx_leads_status" ON "lead_captures" ("status");
CREATE INDEX IF NOT EXISTS "idx_qrons_user" ON "qrons" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_scan_events_qron_id" ON "scan_events" ("qron_id");
