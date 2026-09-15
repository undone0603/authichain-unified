import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
});

try {
  const tables = await sql`
    select table_schema, table_name
    from information_schema.tables
    where table_schema not in ('pg_catalog', 'information_schema')
      and table_type = 'BASE TABLE'
    order by table_schema, table_name
  `;

  const columns = await sql`
    select table_schema, table_name, column_name, data_type, udt_name, is_nullable
    from information_schema.columns
    where table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name, ordinal_position
  `;

  const migrationCandidates = await sql`
    select table_schema, table_name
    from information_schema.tables
    where table_name ilike '%drizzle%'
    order by table_schema, table_name
  `;

  let migrationRows = [];
  for (const candidate of migrationCandidates) {
    const { table_schema: schema, table_name: table } = candidate;
    const cols = await sql`
      select column_name
      from information_schema.columns
      where table_schema = ${schema} and table_name = ${table}
      order by ordinal_position
    `;
    const names = new Set(cols.map((c) => c.column_name));
    if (names.has("hash") && (names.has("created_at") || names.has("createdAt"))) {
      const created = names.has("created_at") ? "created_at" : '"createdAt"';
      migrationRows = await sql.unsafe(
        `select * from "${schema.replaceAll('"', '""')}"."${table.replaceAll('"', '""')}" order by ${created}`,
      );
      migrationRows = migrationRows.map((row) => {
        const out = {};
        for (const [key, value] of Object.entries(row)) {
          out[key] = typeof value === "bigint" ? Number(value) : value;
        }
        return out;
      });
      break;
    }
  }

  const migrationDir = path.resolve("drizzle/migrations");
  const files = (await fs.readdir(migrationDir))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();

  const report = {
    generatedAt: new Date().toISOString(),
    migrationDirectory: "drizzle/migrations",
    migrationFiles: files,
    migrationFileCount: files.length,
    drizzleMigrationTableCandidates: migrationCandidates,
    appliedMigrationRows: migrationRows,
    databaseTables: tables,
    databaseColumns: columns,
    note: "Read-only audit. No schema or data mutation is performed.",
  };

  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile("artifacts/production-drizzle-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    migrationFileCount: files.length,
    appliedMigrationCount: migrationRows.length,
    migrationTableCandidates: migrationCandidates,
    artifact: "artifacts/production-drizzle-audit.json",
  }, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
