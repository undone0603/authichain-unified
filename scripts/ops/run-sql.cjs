/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || '');

const migrationSql = `
-- Add fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment VARCHAR(32);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS objection_type VARCHAR(64);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nurture_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposals_sent INT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS replies_received INT DEFAULT 0;

-- Create inbound_replies table
CREATE TABLE IF NOT EXISTS inbound_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id INT REFERENCES leads(id),
  lead_email VARCHAR(320) NOT NULL,
  sender_name VARCHAR(256),
  subject VARCHAR(512),
  body_plaintext TEXT,
  body_html TEXT,
  message_id VARCHAR(256) NOT NULL UNIQUE,
  sentiment VARCHAR(32),
  objection_type VARCHAR(64),
  objection_details TEXT,
  confidence REAL,
  proposal_match_id VARCHAR(64),
  match_confidence REAL,
  status VARCHAR(32) DEFAULT 'new',
  manual_override BOOLEAN DEFAULT FALSE,
  manual_sentiment VARCHAR(32),
  overridden_by INT,
  overridden_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_replies_lead ON inbound_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_email ON inbound_replies(lead_email);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_status ON inbound_replies(status);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_sentiment ON inbound_replies(sentiment);

-- Create reply_sequences table
CREATE TABLE IF NOT EXISTS reply_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id INT NOT NULL REFERENCES leads(id),
  reply_id UUID NOT NULL REFERENCES inbound_replies(id),
  template_type VARCHAR(64) NOT NULL,
  sequence_number INT DEFAULT 1,
  status VARCHAR(32) DEFAULT 'pending',
  sent_at TIMESTAMP,
  clicked_at TIMESTAMP,
  next_scheduled_at TIMESTAMP,
  email_subject VARCHAR(512),
  email_body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_sequences_lead ON reply_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_reply_sequences_reply ON reply_sequences(reply_id);
CREATE INDEX IF NOT EXISTS idx_reply_sequences_status ON reply_sequences(status);
CREATE INDEX IF NOT EXISTS idx_reply_sequences_scheduled ON reply_sequences(next_scheduled_at);
`;

async function run() {
  try {
    await sql.unsafe(migrationSql);
    console.log('Migration applied successfully');
  } catch (err) {
    console.error('Error applying migration:', err.message);
  } finally {
    process.exit();
  }
}

run();
