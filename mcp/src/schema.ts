import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// Local mirror of the `qr_codes` table used by db.ts. This server can't import
// the shared ../../src/db/schema.ts directly: it lives outside mcp's tsconfig
// rootDir, and widening rootDir to reach it pulls the entire root app into
// this package's build. Only the columns this server actually queries are
// declared here — keep column names (the pgTable string args) in sync with
// src/db/schema.ts's `qrCodes` table if that table's columns change.
export const qrCodes = pgTable("qr_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  shortCode: text("short_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
