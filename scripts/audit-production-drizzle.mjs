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

const unquote = (value) => value.replace(/^"|"$/g, "");
const cleanSql = (text) => text.replace(/--.*$/gm, "");

function extractExpectedObjects(text) {
  const source = cleanSql(text);
  const tables = [...source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)/gi)]
    .map((m) => unquote(m[1]));
  const columns = [];
  const alterRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)\s+([\s\S]*?)(?=;|$)/gi;
  for (const match of source.matchAll(alterRe)) {
    const table = unquote(match[1]);
    for (const col of match[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[A-Za-z_][\w$]*)/gi)) {
      columns.push({ table, column: unquote(col[1]) });
    }
  }
  const indexes = [...source.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)/gi)]
    .map((m) => unquote(m[1]));
  return {
    tables: [...new Set(tables)],
    columns: [...new Map(columns.map((x) => [`${x.table}.${x.column}`, x])).values()],
    indexes: [...new Set(indexes)],
  };
}

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

  const indexes = await sql`
    select schemaname as table_schema, tablename as table_name, indexname as index_name, indexdef
    from pg_indexes
    where schemaname not in ('pg_catalog', 'information_schema')
    order by schemaname, tablename, indexname
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
        for (const [key, value] of Object.entries(row)) out[key] = typeof value === "bigint" ? Number(value) : value;
        return out;
      });
      break;
    }
  }

  const migrationDir = path.resolve("drizzle/migrations");
  const files = (await fs.readdir(migrationDir))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();

  const tableSet = new Set(tables.map((x) => `${x.table_schema}.${x.table_name}`));
  const columnSet = new Set(columns.map((x) => `${x.table_schema}.${x.table_name}.${x.column_name}`));
  const indexSet = new Set(indexes.map((x) => `${x.table_schema}.${x.index_name}`));

  const migrationDiffs = [];
  for (const file of files) {
    const expected = extractExpectedObjects(await fs.readFile(path.join(migrationDir, file), "utf8"));
    const missingTables = expected.tables.filter((name) => !tableSet.has(`public.${name}`));
    const missingColumns = expected.columns.filter(({ table, column }) => !columnSet.has(`public.${table}.${column}`));
    const missingIndexes = expected.indexes.filter((name) => !indexSet.has(`public.${name}`));
    migrationDiffs.push({
      file,
      expectedTables: expected.tables,
      missingTables,
      expectedColumns: expected.columns,
      missingColumns,
      expectedIndexes: expected.indexes,
      missingIndexes,
      indexVerification: "Indexes are compared by name against pg_indexes in production.",
      status: missingTables.length || missingColumns.length || missingIndexes.length ? "partial_or_missing" : "structurally_present",
    });
  }

  const missingTables = migrationDiffs.reduce((n, x) => n + x.missingTables.length, 0);
  const missingColumns = migrationDiffs.reduce((n, x) => n + x.missingColumns.length, 0);
  const missingIndexes = migrationDiffs.reduce((n, x) => n + x.missingIndexes.length, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    migrationDirectory: "drizzle/migrations",
    migrationFiles: files,
    migrationFileCount: files.length,
    drizzleMigrationTableCandidates: migrationCandidates,
    appliedMigrationRows: migrationRows,
    databaseTables: tables,
    databaseColumns: columns,
    databaseIndexes: indexes,
    migrationDiffs,
    summary: {
      missingTableCount: missingTables,
      missingColumnCount: missingColumns,
      missingIndexCount: missingIndexes,
      structurallyPresentMigrationCount: migrationDiffs.filter((x) => x.status === "structurally_present").length,
      partialOrMissingMigrationCount: migrationDiffs.filter((x) => x.status !== "structurally_present").length,
    },
    conclusion: migrationRows.length === 0
      ? "Production contains the Drizzle migration tracking table but no recorded migration rows; existing schema objects appear to have been created outside tracked Drizzle history or the history was reset. Do not mark migrations applied until each migration's effects are reconciled."
      : "Migration tracking rows are present; reconcile their hashes/timestamps with the numbered files before changing the journal.",
    note: "Read-only audit. No schema or data mutation is performed. Index verification is name-based; exact index definitions should be reviewed for migrations that matter to correctness or performance.",
  };

  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile("artifacts/production-drizzle-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    migrationFileCount: files.length,
    appliedMigrationCount: migrationRows.length,
    migrationDiffCount: migrationDiffs.length,
    missingTableCount: missingTables,
    missingColumnCount: missingColumns,
    missingIndexCount: missingIndexes,
    structurallyPresentMigrationCount: report.summary.structurallyPresentMigrationCount,
    migrationTableCandidates: migrationCandidates,
    artifact: "artifacts/production-drizzle-audit.json",
  }, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
