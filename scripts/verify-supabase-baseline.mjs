#!/usr/bin/env node
/**
 * Read-only: local supabase/migrations must cover every remote-applied version
 * listed in supabase/REMOTE_APPLIED_VERSIONS.txt (#1133 baseline).
 * Does not apply migrations. Does not repair schema_migrations.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const REMOTE_LIST = path.join(ROOT, "supabase", "REMOTE_APPLIED_VERSIONS.txt");

export function localVersions(dir = MIGRATIONS_DIR) {
  return new Set(
    readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.replace(/_.*$/, "").replace(/\.sql$/, ""))
  );
}

export function remoteVersions(file = REMOTE_LIST) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function missingRemoteVersions() {
  const local = localVersions();
  return remoteVersions().filter((version) => !local.has(version));
}

if (process.argv.includes("--run")) {
  const missing = missingRemoteVersions();
  if (missing.length > 0) {
    console.error("Remote-applied versions missing from supabase/migrations:");
    for (const v of missing) console.error(`  ${v}`);
    console.error("Do not invent SQL. Restore from archive / #1133 only.");
    process.exit(1);
  }
  console.log(
    `supabase-baseline: ${remoteVersions().length} remote versions present locally (read-only)`
  );
}
