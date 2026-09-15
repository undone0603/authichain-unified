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
const normalizeSql = (text) => text
  .toLowerCase()
  .replaceAll('"', "")
  .replaceAll("public.", "")
  .replace(/\s+/g, " ")
  .replace(/\s*([(),;])\s*/g, "$1")
  .trim();

function extractExpectedObjects(text) {
  const source = cleanSql(text);
  const tables = [...source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)/gi)]
    .map((m) => unquote(m[1]));
  const columns = [];
  const createColumnMap = new Map();
  for (const match of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)\s*\(([\s\S]*?)\);/gi)) {
    const table = unquote(match[1]);
    const defs = match[2].split(/,(?![^()]*\))/);
    for (const def of defs) {
      const col = def.trim().match(/^("[^"]+"|[A-Za-z_][\w$]*)\s+([A-Za-z][\w]*(?:\s*\([^)]*\))?(?:\s+with\s+timezone)?)/i);
      if (col) {
        const column = unquote(col[1]);
        const type = col[2].trim().toLowerCase();
        createColumnMap.set(`${table}.${column}`, { table, column, type });
      }
    }
  }
  columns.push(...createColumnMap.values());
  const alterRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)\s+([\s\S]*?)(?=;|$)/gi;
  for (const match of source.matchAll(alterRe)) {
    const table = unquote(match[1]);
    for (const col of match[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[A-Za-z_][\w$]*)\s*([A-Za-z][\w]*(?:\s*\([^)]*\))?(?:\s+with\s+timezone)?)/gi)) {
      columns.push({ table, column: unquote(col[1]), type: col[2].trim().toLowerCase() });
    }
  }
  const indexStatements = [...source.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?("[^"]+"|[A-Za-z_][\w$]*)\s+ON\s+[\s\S]*?(?=;|$)/gi)];
  const indexes = indexStatements.map((m) => ({ name: unquote(m[1]), statement: m[0].trim() }));
  return {
    tables: [...new Set(tables)],
    columns: [...new Map(columns.map((x) => [`${x.table}.${x.column}`, x])).values()],
    indexes: [...new Map(indexes.map((x) => [x.name, x])).values()],
    dataMutation: /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|DO\s+\$\$)/i.test(source),
  };
}

function normalizeType(type) {
  const value = type.toLowerCase().replace(/\s+/g, " ").trim();
  if (value.startsWith("varchar")) return "character varying";
  if (value.startsWith("int")) return "integer";
  if (value === "serial") return "integer";
  if (value.startsWith("timestamp")) return "timestamp without time zone";
  if (value === "json") return "json";
  if (value.startsWith("jsonb")) return "jsonb";
  if (value === "bool") return "boolean";
  return value;
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
  const files = (await fs.readdir(migrationDir)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
  const tableMap = new Map(tables.map((x) => [`${x.table_schema}.${x.table_name}`, x]));
  const columnMap = new Map(columns.map((x) => [`${x.table_schema}.${x.table_name}.${x.column_name}`, x]));
  const indexMap = new Map(indexes.map((x) => [`${x.table_schema}.${x.index_name}`, x]));

  const migrationDiffs = [];
  for (const file of files) {
    const expected = extractExpectedObjects(await fs.readFile(path.join(migrationDir, file), "utf8"));
    const missingTables = expected.tables.filter((name) => !tableMap.has(`public.${name}`));
    const columnChecks = expected.columns.map(({ table, column, type }) => {
      const actual = columnMap.get(`public.${table}.${column}`);
      if (!actual) return { table, column, expectedType: type, status: "missing" };
      const typeEquivalent = normalizeType(type) === normalizeType(actual.data_type === "USER-DEFINED" ? actual.udt_name : actual.data_type);
      return { table, column, expectedType: type, actualType: actual.data_type, actualUdt: actual.udt_name, status: typeEquivalent ? "present_equivalent" : "present_type_diff" };
    });
    const missingColumns = columnChecks.filter((x) => x.status === "missing");
    const columnTypeDiffs = columnChecks.filter((x) => x.status === "present_type_diff");
    const indexChecks = expected.indexes.map(({ name, statement }) => {
      const actual = indexMap.get(`public.${name}`);
      if (!actual) return { name, status: "missing", expected: statement };
      const equivalent = normalizeSql(statement.replace(/;$/, ""))
        .replace(/^create (unique )?index( if not exists)? /, "create $1index ")
        === normalizeSql(actual.indexdef).replace(/^create (unique )?index /, "create $1index ");
      return { name, status: equivalent ? "present_equivalent" : "present_definition_diff", expected: statement, actual: actual.indexdef };
    });
    migrationDiffs.push({
      file,
      expectedTables: expected.tables,
      missingTables,
      expectedColumns: expected.columns,
      columnChecks,
      missingColumns,
      columnTypeDiffs,
      expectedIndexes: expected.indexes.map((x) => x.name),
      indexChecks,
      dataMutationDetected: expected.dataMutation,
      status: missingTables.length || missingColumns.length || columnTypeDiffs.length || indexChecks.some((x) => x.status !== "present_equivalent")
        ? "partial_or_missing"
        : "structurally_present",
    });
  }

  const missingTables = migrationDiffs.reduce((n, x) => n + x.missingTables.length, 0);
  const missingColumns = migrationDiffs.reduce((n, x) => n + x.missingColumns.length, 0);
  const missingIndexes = migrationDiffs.reduce((n, x) => n + x.indexChecks.filter((i) => i.status === "missing").length, 0);
  const indexDefinitionDiffs = migrationDiffs.reduce((n, x) => n + x.indexChecks.filter((i) => i.status === "present_definition_diff").length, 0);
  const columnTypeDiffs = migrationDiffs.reduce((n, x) => n + x.columnTypeDiffs.length, 0);

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
      indexDefinitionDiffCount: indexDefinitionDiffs,
      columnTypeDiffCount: columnTypeDiffs,
      structurallyPresentMigrationCount: migrationDiffs.filter((x) => x.status === "structurally_present").length,
      partialOrMissingMigrationCount: migrationDiffs.filter((x) => x.status !== "structurally_present").length,
      dataMutationMigrationCount: migrationDiffs.filter((x) => x.dataMutationDetected).length,
    },
    conclusion: migrationRows.length === 0
      ? "Production contains the Drizzle migration tracking table but no recorded migration rows; existing schema objects appear to have been created outside tracked Drizzle history or the history was reset. Do not mark migrations applied until structural and data effects are reconciled."
      : "Migration tracking rows are present; reconcile their hashes/timestamps with the numbered files before changing the journal.",
    note: "Read-only audit. No schema or data mutation is performed. CREATE TABLE columns, ALTER TABLE columns, and indexes are compared against production; data-producing migrations require separate state verification because schema inspection cannot prove historical inserts/updates.",
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
    indexDefinitionDiffCount: indexDefinitionDiffs,
    columnTypeDiffCount: columnTypeDiffs,
    structurallyPresentMigrationCount: report.summary.structurallyPresentMigrationCount,
    dataMutationMigrationCount: report.summary.dataMutationMigrationCount,
    migrationTableCandidates: migrationCandidates,
    artifact: "artifacts/production-drizzle-audit.json",
  }, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
