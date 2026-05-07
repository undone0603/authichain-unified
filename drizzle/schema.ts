import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const certificates = pgTable('certificates', {
  id: text('id').primaryKey(),
  productHash: text('product_hash').notNull().unique(),
  chainId: text('chain_id').notNull(),
  issuer: text('issuer').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  certId: text('cert_id').references(() => certificates.id),
  result: text('result').notNull(),
  confidence: text('confidence'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow(),
});
