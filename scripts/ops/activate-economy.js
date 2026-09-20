/**
 * Economy align — prefers Drizzle migrations over ad-hoc DDL.
 *
 * Do not CREATE TABLE from this file. Prod QRON-v2
 * (nhdnkzhtadfkkluiulhs) already has fee_flows, brands, automation_logs,
 * qrons, certifications, products, lead_captures, profiles.
 *
 *   DATABASE_URL=… node scripts/ops/activate-economy.js
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATION = join(ROOT, "drizzle", "migrations", "025_economy_align.sql");

async function applyAdditiveSql() {
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const sql = postgres(url);
  try {
    const body = readFileSync(MIGRATION, "utf8");
    await sql.unsafe(body);
    console.log("✅ ECONOMY ALIGNED: applied drizzle/migrations/025_economy_align.sql (additive only).");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function activate() {
  console.log("Handshaking with database via Drizzle migrations…");
  const migrated = spawnSync("pnpm", ["db:migrate"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (migrated.status === 0) {
    console.log("✅ ECONOMY ALIGNED: drizzle-kit migrate succeeded.");
    return;
  }
  console.warn(
    "drizzle-kit migrate did not succeed (missing snapshot or DATABASE_URL). Applying additive SQL only — no DROP/CREATE of existing rows."
  );
  await applyAdditiveSql();
}

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("activate-economy.js");

if (isDirect) {
  activate().catch((err) => {
    console.error("❌ ACTIVATION FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

export { activate, MIGRATION };
