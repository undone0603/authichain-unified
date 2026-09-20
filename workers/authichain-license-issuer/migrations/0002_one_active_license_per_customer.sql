-- Retries after createLicense must not insert a second jti for the same
-- Stripe customer (or email: fallback). Revoked rows stay out of the index
-- so a later paid session can issue a replacement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_one_active_customer
  ON licenses(stripe_customer_id)
  WHERE status = 'active';
