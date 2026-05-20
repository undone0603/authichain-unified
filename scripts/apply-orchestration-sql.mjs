/**
 * Applies the orchestration SQL files to Supabase.
 * Usage: node scripts/apply-orchestration-sql.mjs
 */
import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..");

const rawUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!rawUrl) { console.error("Missing SUPABASE_DB_URL / DATABASE_URL"); process.exit(1); }

// Encode special chars in the password portion so postgres lib gets a valid URL
function encodePwd(connStr) {
  // Split at the first @ to isolate credentials
  const atIdx = connStr.lastIndexOf("@");
  if (atIdx === -1) return connStr;
  const proto = connStr.slice(0, connStr.indexOf("://") + 3);
  const creds = connStr.slice(proto.length, atIdx);          // user:password
  const rest  = connStr.slice(atIdx);                         // @host:port/db

  const colonIdx = creds.indexOf(":");
  if (colonIdx === -1) return connStr;
  const user = creds.slice(0, colonIdx);
  const pwd  = encodeURIComponent(creds.slice(colonIdx + 1)); // encode the password
  return `${proto}${user}:${pwd}${rest}`;
}

const url = encodePwd(rawUrl);

// Use session-mode pooler (port 5432) — transaction-mode pooler (6543) rejects named prepared statements
const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 15 });

const files = [
  join(root, "orchestration/sql/001_revenue_memory.sql"),
  join(root, "orchestration/sql/002_operational_views.sql"),
];

async function run() {
  for (const f of files) {
    const label = f.replace(root, "").replace(/\\/g, "/");
    process.stdout.write(`Applying ${label} ... `);
    const content = readFileSync(f, "utf8");
    await sql.unsafe(content);
    console.log("✓");
  }
  await sql.end();
  console.log("\nAll orchestration migrations applied.");
}

run().catch(e => {
  console.error("\nFailed:", e.message);
  process.exit(1);
});
