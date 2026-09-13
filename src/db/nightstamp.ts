import { integer, pgTable, text, timestamp, doublePrecision } from "drizzle-orm/pg-core";

/** QRON Nightstamp art row. SQL migration remains the deployment source of truth. */
export const qrArts = pgTable("qr_arts", {
  id: text("id").primaryKey(),
  preset: text("preset"),
  eventAt: timestamp("event_at", { withTimezone: true }),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  tz: text("tz"),
  placeLabel: text("place_label"),
  catalogHash: text("catalog_hash"),
  sku: text("sku"),
  qrData: text("qr_data"),
  dedication: text("dedication"),
  style: text("style"),
  tenant: text("tenant"),
  stripeSessionId: text("stripe_session_id"),
  customerEmail: text("customer_email"),
  scanCount: integer("scan_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QrArt = typeof qrArts.$inferSelect;
export type InsertQrArt = typeof qrArts.$inferInsert;
