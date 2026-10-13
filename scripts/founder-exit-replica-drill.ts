/**
 * Local schema replica only. Refuses any host that is not loopback.
 * Does not read or write production Supabase.
 *
 * Usage, after Postgres is listening on 127.0.0.1:55432:
 *   FOUNDER_EXIT_DATABASE_URL=postgres://postgres@127.0.0.1:55432/founder_exit \
 *     pnpm exec tsx scripts/founder-exit-replica-drill.ts
 */

import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import {
  assertDeleteForbidden,
  assertHistoryImmutable,
  assertReplicaUrl,
  finishInterruptedReplica,
  startInterruptedReplica,
} from "../src/lib/founder-exit/postgres-log";

const url =
  process.env.FOUNDER_EXIT_DATABASE_URL ??
  "postgres://postgres@127.0.0.1:55432/founder_exit";

assertReplicaUrl(url);

const parsed = new URL(url);
const pgEnv = {
  ...process.env,
  PGHOST: parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGUSER: decodeURIComponent(parsed.username || "postgres"),
  PGDATABASE: parsed.pathname.replace(/^\//, ""),
  PGPASSWORD: decodeURIComponent(parsed.password || ""),
};

function run(
  command: string,
  args: string[],
  database = pgEnv.PGDATABASE
): string {
  const result = spawnSync(command, args, {
    env: { ...pgEnv, PGDATABASE: database },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.replace(
      url,
      "[redacted-url]"
    );
    throw new Error(`${command} failed: ${detail.slice(0, 2000)}`);
  }
  return result.stdout ?? "";
}

const migration =
  "supabase/migrations/20261013232408_founder_exit_action_ledger.sql";
const dumpPath = "/tmp/founder-exit-replica.dump";
const listPath = "/tmp/founder-exit-replica.list";

if (pgEnv.PGDATABASE !== "founder_exit") {
  throw new Error("refusing_to_drop_unexpected_database");
}
if (pgEnv.PGHOST !== "127.0.0.1" && pgEnv.PGHOST !== "::1") {
  throw new Error("refusing_to_drop_non_loopback_database");
}

run("psql", ["-v", "ON_ERROR_STOP=1", "-f", migration]);

const setup = new Pool({ connectionString: url });
await setup.query(
  "truncate public.founder_exit_actions, public.founder_exit_side_effects"
);
const started = await startInterruptedReplica(setup);
if (started.state !== "running") throw new Error("expected_running");
await setup.end();

run("pg_dump", ["-Fc", "--no-owner", "--no-acl", "-f", dumpPath]);

const toc = run("pg_restore", ["-l", dumpPath], "postgres");
const filtered = toc
  .split("\n")
  .filter(line => {
    if (line.includes("SCHEMA - public")) return false;
    if (line.includes("COMMENT - SCHEMA public")) return false;
    if (line.includes("SCHEMA public")) return false;
    return true;
  })
  .join("\n");
writeFileSync(listPath, filtered);
if (!filtered.includes("founder_exit_actions_guard")) {
  throw new Error("dump_omitted_history_guard");
}
if (!filtered.includes("founder_exit_actions")) {
  throw new Error("dump_omitted_action_table");
}

run(
  "psql",
  [
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop database if exists founder_exit with (force)",
  ],
  "postgres"
);
run(
  "psql",
  ["-v", "ON_ERROR_STOP=1", "-c", "create database founder_exit"],
  "postgres"
);
run("pg_restore", [
  "--no-owner",
  "--no-acl",
  "--exit-on-error",
  "--use-list",
  listPath,
  "--dbname",
  "founder_exit",
  dumpPath,
]);

const restored = new Pool({ connectionString: url });
let historyRejected = false;
try {
  const guard = await restored.query<{ n: number }>(
    "select count(*)::int as n from pg_proc where proname = 'founder_exit_actions_guard'"
  );
  if ((guard.rows[0]?.n ?? 0) < 1) {
    throw new Error("restore_omitted_history_guard");
  }
  const finished = await finishInterruptedReplica(restored);
  if (
    finished.final_state !== "succeeded" ||
    finished.verification_status !== "verified" ||
    finished.reconciled !== 1 ||
    finished.side_effect_applications !== 1 ||
    finished.duplicate_side_effect !== "duplicate"
  ) {
    throw new Error("replica_recovery_mismatch");
  }
  await assertHistoryImmutable(restored);
  historyRejected = true;
  await assertDeleteForbidden(restored);
  const version = await restored.query<{ server_version: string }>(
    "show server_version"
  );
  let productionMigrationApplied = false;
  let productionProjectRef: string | null = null;
  try {
    const previous = JSON.parse(
      readFileSync("docs/evidence/founder-exit-replica-drill.json", "utf8")
    ) as {
      production_migration_applied?: boolean;
      production_project_ref?: string | null;
    };
    if (previous.production_migration_applied === true) {
      productionMigrationApplied = true;
      productionProjectRef = previous.production_project_ref ?? null;
    }
  } catch {
    // The first run has no prior evidence file.
  }
  const evidence = {
    drill_id: "founder-exit-replica-2026-10-13",
    environment: "local_postgres_16_schema_replica",
    postgres_server_version: version.rows[0]?.server_version ?? "unknown",
    production_data_copied: false,
    production_migration_applied: productionMigrationApplied,
    production_project_ref: productionProjectRef,
    stripe_called: false,
    mail_sent: false,
    founder_independent: false,
    dump_restore: "pass",
    interruption: "pass",
    started_state: started.state,
    final_state: finished.final_state,
    verification_status: finished.verification_status,
    reconciled: finished.reconciled,
    side_effect_applications: finished.side_effect_applications,
    duplicate_side_effect: finished.duplicate_side_effect,
    history_length: finished.history_length,
    history_rewrite_rejected: historyRejected,
    delete_rejected: true,
    action_id: finished.action_id,
    idempotency_key: finished.idempotency_key,
  };
  writeFileSync(
    "docs/evidence/founder-exit-replica-drill.json",
    `${JSON.stringify(evidence, null, 2)}\n`
  );
} finally {
  await restored.end();
  for (const path of [dumpPath, listPath]) {
    try {
      unlinkSync(path);
    } catch {
      // The dump is scratch. A missing file is already gone.
    }
  }
}
