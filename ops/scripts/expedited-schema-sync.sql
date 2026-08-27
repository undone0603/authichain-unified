-- Expedited Schema Sync: Industrial Columns
-- Target: Cloudflare D1 (outreach-db)

-- 1. Add industrial columns to products table
ALTER TABLE products ADD COLUMN audioUrl TEXT;
ALTER TABLE products ADD COLUMN visionMarkers JSON;
ALTER TABLE products ADD COLUMN rarityScore INTEGER DEFAULT 50;
ALTER TABLE products ADD COLUMN brandVoiceScript TEXT;

-- 2. Create Dead Letter Queue table
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  originalJobId INTEGER,
  taskType VARCHAR(128) NOT NULL,
  payload JSON NOT NULL,
  error TEXT,
  retryCount INTEGER DEFAULT 0,
  lastAttemptedAt TIMESTAMP,
  status VARCHAR(32) DEFAULT 'pending',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add mission-critical metrics columns to leads
ALTER TABLE leads ADD COLUMN intentScore INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN sector VARCHAR(64) DEFAULT 'Cannabis';
ALTER TABLE leads ADD COLUMN dispatchStatus VARCHAR(32) DEFAULT 'staged';
