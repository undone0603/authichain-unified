/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Retired ad-hoc DDL. Applies drizzle/migrations/025_economy_align.sql only.
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const postgres = require("postgres");
require("dotenv").config();

const sql = postgres(process.env.DATABASE_URL || "");
const body = readFileSync(
  join(__dirname, "drizzle", "migrations", "025_economy_align.sql"),
  "utf8"
);

(async () => {
  try {
    console.log("Applying drizzle/migrations/025_economy_align.sql (additive only)…");
    await sql.unsafe(body);
    console.log("✅ ECONOMY ALIGNED via Drizzle migration SQL.");
  } catch (err) {
    console.error("❌ ACTIVATION FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
})();
