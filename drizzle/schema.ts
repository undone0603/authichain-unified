import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Shared tables live in src/db/schema.ts. passport_scan_log is defined here,
// the module server/db.ts imports, and is not copied into src/db/schema.ts.
export * from "../src/db/schema";
export { apiUsage as usageRecords } from "../src/db/schema";

/** One recorded passport verdict. The seal serial is not a column. */
export const passportScanLog = pgTable(
  "passport_scan_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digitalIdentity: text("digital_identity"),
    verdict: text("verdict").notNull(),
    bindingMethod: text("binding_method"),
    bindingPass: boolean("binding_pass"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    recordedAtIdx: index("passport_scan_log_recorded_at_idx").on(
      table.recordedAt
    ),
  })
);
