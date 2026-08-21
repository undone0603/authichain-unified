#!/usr/bin/env node
/**
 * Reports where src/db/schema.ts disagrees with the live database.
 *
 * This exists because the disagreement was found the expensive way. On
 * 2026-08-15, 750 of 982 scheduled job runs were failing — 76% — and had been
 * for months. The jobs recorded status='failed' and the cron endpoint returned
 * 200, so nothing surfaced. The causes were all schema drift:
 *
 *   [42703] column "userId" does not exist        (schema says userId, DB has user_id)
 *   [42P01] relation "staking_positions" does not exist
 *   [23514] missions_status_check violated        (code wrote a status the DB forbids)
 *   [22P02] invalid input syntax for type uuid
 *
 * Drizzle's second argument is the *physical* column name. Writing
 * `integer('userId')` against a `user_id` column type-checks perfectly and
 * fails only at runtime, against a real database — which is why none of this
 * was caught by `pnpm check` or the test suite.
 *
 * ── Why this also compares nullability and defaults ──────────────────────────
 *
 * Comparing column *names* was not enough. On 2026-08-20 every one of the 23
 * call sites that enqueue an agent task was failing with:
 *
 *   [23502] null value in column "description" of relation "mission_tasks"
 *
 * The column existed. Both names matched. What disagreed was invisible to a
 * name-only comparison: schema.ts declared `.default(...)` for columns the
 * database had no default for, and the database had `description NOT NULL`.
 *
 * Drizzle's `.default()` does not send the value — it emits the SQL keyword
 * DEFAULT and lets the database supply it. Where the database has no default,
 * DEFAULT resolves to NULL, and a NOT NULL column rejects the insert. So a
 * schema default with no matching database default is not a cosmetic
 * difference; it is an insert that can never succeed. The task queue held five
 * rows for months because of it, and nothing reported a problem: executeJob()
 * catches the error and records status='failed'.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/check-schema-drift.mjs [--json] [--strict]
 *                                                        [--also=<other-schema.ts>]
 *
 * --also reports drift in another schema file without gating on it. Used for
 * schema files owned by a sub-app that declare tables in this same database.
 *
 * Exits 1 on findings that are guaranteed runtime failures: a missing table or
 * column (42703/42P01), or an insert that can never satisfy NOT NULL
 * (23502). Everything else — an untracked database column, a default that
 * quietly writes NULL into a nullable column, a nullability mismatch that only
 * misleads the TypeScript types — is reported but does not fail the run unless
 * --strict.
 */

import { readFileSync } from 'node:fs';
import tls from 'node:tls';

const SCHEMA_FILE = 'src/db/schema.ts';
const POOLER_CA_FILE = 'certs/supabase-root-2021.pem';

/**
 * Findings that mean a query or insert cannot succeed, as opposed to findings
 * that mean the schema and the database merely describe the world differently.
 * Only these gate the exit code by default.
 */
const BREAKING = new Set(['missing-table', 'missing-column', 'default-never-applies', 'required-not-declared']);

const KINDS = [
  'missing-table',
  'missing-column',
  'default-never-applies',
  'required-not-declared',
  'default-not-in-db',
  'nullability-drift',
  'untracked-column',
];

/**
 * Extracts declared tables and their physical column names.
 *
 * Deliberately a parse of the source rather than an import: importing the
 * schema would pull in the whole TypeScript module graph and a driver, and
 * this needs to run as a standalone check in CI.
 */
export function parseSchema(source) {
  const tables = [];
  const tableRe = /export const (\w+)\s*=\s*pgTable\(\s*['"]([^'"]+)['"]\s*,\s*\{/g;

  for (const match of source.matchAll(tableRe)) {
    const [, exportName, tableName] = match;
    const bodyStart = match.index + match[0].length;

    // Walk braces to find the table body, so nested objects (defaults, enums)
    // do not truncate it early.
    let depth = 1;
    let i = bodyStart;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const body = source.slice(bodyStart, i - 1);

    const columns = [];
    for (const segment of splitTopLevel(body)) {
      // `prop: type('physical_name'` — the quoted argument is what Postgres sees.
      const head = segment.match(/(\w+)\s*:\s*(\w+)\(\s*['"]([^'"]+)['"]/);
      if (!head) continue;
      const [, property, builder, column] = head;

      // Only the modifiers matter, and only whether they are present. Parsing
      // the default *value* would be guesswork (it can be an expression, a
      // function, or a nested object); what makes an insert fail is whether the
      // schema expects the database to supply a value at all.
      const hasDefault =
        /\.\$?default(Now|Random|Fn)?\s*\(/.test(segment) ||
        // serial/bigserial are `integer NOT NULL DEFAULT nextval(...)` — the
        // default lives in the column type, not in a .default() call.
        /^(serial|bigserial|smallserial)$/.test(builder);
      columns.push({
        property,
        column,
        notNull: /\.notNull\s*\(/.test(segment) || /\.primaryKey\s*\(/.test(segment),
        hasDefault,
      });
    }
    tables.push({ exportName, tableName, columns });
  }
  return tables;
}

/**
 * Splits a pgTable body into one string per property.
 *
 * Naively splitting on commas would cut `.default({ a: 1, b: 2 })` in half and
 * lose the modifiers that follow it — which is the whole reason this function
 * exists rather than a regex. Tracks bracket depth and string literals so only
 * commas at depth zero separate properties.
 */
export function splitTopLevel(body) {
  const segments = [];
  let depth = 0;
  let start = 0;
  let quote = null;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      segments.push(body.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(body.slice(start));
  return segments.map((s) => s.trim()).filter(Boolean);
}

export function summarise(tables, live) {
  const findings = [];
  for (const t of tables) {
    const actual = live.get(t.tableName);
    if (!actual) {
      findings.push({ table: t.tableName, kind: 'missing-table', detail: 'declared in schema, absent from database' });
      continue;
    }
    for (const c of t.columns) {
      const db = actual.get(c.column);
      if (!db) {
        // The most common form of this bug: camelCase declared, snake_case real.
        const snake = c.column.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        const hint = actual.has(snake) ? ` — database has "${snake}"` : '';
        findings.push({
          table: t.tableName,
          kind: 'missing-column',
          detail: `schema declares "${c.column}" (property ${c.property})${hint}`,
        });
        continue;
      }

      if (c.hasDefault && !db.hasDefault) {
        // Drizzle's .default() emits the DEFAULT keyword rather than the value.
        // With no database default, DEFAULT is NULL.
        findings.push(
          db.notNull
            ? {
                table: t.tableName,
                kind: 'default-never-applies',
                detail:
                  `"${c.column}" is NOT NULL in the database with no default, but schema.ts declares a default. ` +
                  `Every insert that omits it sends DEFAULT, which resolves to NULL, and raises 23502.`,
              }
            : {
                table: t.tableName,
                kind: 'default-not-in-db',
                detail:
                  `"${c.column}" has a default in schema.ts and none in the database. ` +
                  `Inserts that omit it store NULL, not the declared default.`,
              },
        );
      }

      if (db.notNull && !db.hasDefault && !c.notNull && !c.hasDefault) {
        findings.push({
          table: t.tableName,
          kind: 'required-not-declared',
          detail:
            `"${c.column}" is NOT NULL in the database with no default, but schema.ts declares it optional. ` +
            `An insert that omits it raises 23502.`,
        });
      }

      if (c.notNull && !db.notNull) {
        findings.push({
          table: t.tableName,
          kind: 'nullability-drift',
          detail: `schema.ts declares "${c.column}" notNull, the database allows NULL — reads can return null against the type.`,
        });
      }
    }
    for (const col of actual.keys()) {
      if (!t.columns.some((c) => c.column === col)) {
        findings.push({ table: t.tableName, kind: 'untracked-column', detail: `database has "${col}", schema does not declare it` });
      }
    }
  }
  return findings;
}

/**
 * Whether the database will fill this column in on an insert that omits it.
 *
 * Not the same question as "is column_default non-null". An identity column
 * (`GENERATED ALWAYS AS IDENTITY`) reports column_default as NULL yet supplies
 * its own value from a sequence, and a generated column computes one. Reading
 * column_default alone called all seven identity primary keys in this database
 * — leads.id, ab_tests.id, referrals.id among them — inserts that can never
 * succeed, which is the opposite of true. Half the findings would have been
 * false, and a check that cries wolf half the time is one nobody reads.
 *
 * Takes an information_schema.columns row.
 */
export function columnSuppliesItsOwnValue(row) {
  return row.column_default !== null || row.is_identity === 'YES' || row.is_generated !== 'NEVER';
}

/**
 * TLS settings for a Supabase Transaction Mode pooler connection.
 *
 * This used to be `ssl: { rejectUnauthorized: false }`. That silences a real
 * verification failure on a connection that carries the database password, and
 * it made a claim in scripts/diagnose-db-tls.mjs — that no such setting exists
 * anywhere in this repository — untrue.
 *
 * The pooler roots its chain in a private, self-signed "Supabase Root 2021 CA"
 * that no public trust store contains, so verification genuinely does fail
 * without help. The fix is to give it the missing root, not to stop checking.
 * Same approach as server/db.ts: *concatenate* onto tls.rootCertificates rather
 * than replace them, so a publicly-rooted chain still verifies too.
 */
export function poolerTls(url, readCa = () => readFileSync(POOLER_CA_FILE, 'utf8')) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return {};
  }
  if (!host.endsWith('.pooler.supabase.com')) return {};
  const extra = process.env.SUPABASE_POOLER_CA || readCa();
  return { ssl: { ca: [...tls.rootCertificates, extra] } };
}

async function main() {
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  const url = process.env.DATABASE_URL;

  const tables = parseSchema(readFileSync(SCHEMA_FILE, 'utf8'));

  if (!url) {
    console.error('DATABASE_URL is not set — cannot compare against a live database.');
    console.error(`Parsed ${tables.length} tables from ${SCHEMA_FILE}; nothing to compare them to.`);
    return 2;
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url, ...poolerTls(url) });
  await client.connect();
  const { rows } = await client.query(
    `select table_name, column_name, is_nullable, column_default, is_identity, is_generated
       from information_schema.columns
      where table_schema = 'public'`,
  );
  await client.end();

  const live = new Map();
  for (const r of rows) {
    if (!live.has(r.table_name)) live.set(r.table_name, new Map());
    live.get(r.table_name).set(r.column_name, {
      notNull: r.is_nullable === 'NO',
      hasDefault: columnSuppliesItsOwnValue(r),
    });
  }

  const findings = summarise(tables, live);
  const breaking = findings.filter((f) => BREAKING.has(f.kind));

  if (json) {
    console.log(JSON.stringify({ tables: tables.length, findings }, null, 2));
  } else {
    console.log(`Compared ${tables.length} declared tables against the database.\n`);
    if (!findings.length) console.log('No drift.');
    for (const kind of KINDS) {
      const group = findings.filter((f) => f.kind === kind);
      if (!group.length) continue;
      console.log(`${kind} (${group.length})${BREAKING.has(kind) ? '  ← fails at runtime' : ''}:`);
      for (const f of group) console.log(`  ${f.table}: ${f.detail}`);
      console.log();
    }
    console.log(
      breaking.length
        ? `${breaking.length} finding(s) will fail at runtime — a query touching them raises 42703/42P01/23502.`
        : 'Nothing that would fail at runtime.',
    );
  }

  // Other schema files declare tables in this same database but are not gating.
  // They are reported so their drift is visible and owned rather than silent —
  // this whole workflow exists because unwatched drift is what went wrong.
  // Advisory, not fatal: they belong to a separate app with its own migrations,
  // so the call on adding or dropping their columns is not this repo root's.
  const advisory = process.argv
    .filter((a) => a.startsWith('--also='))
    .map((a) => a.slice('--also='.length));
  for (const file of advisory) {
    let other;
    try {
      other = parseSchema(readFileSync(file, 'utf8'));
    } catch {
      console.log(`\n[advisory] ${file}: unreadable, skipped`);
      continue;
    }
    const otherBreaking = summarise(other, live).filter((f) => BREAKING.has(f.kind));
    console.log(
      `\n[advisory] ${file}: ${other.length} tables, ` +
        `${otherBreaking.length} finding(s) that would fail at runtime (not gating)`,
    );
    for (const f of otherBreaking) console.log(`  ${f.table}: ${f.detail}`);
  }

  if (breaking.length) return 1;
  return strict && findings.length ? 1 : 0;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(2);
});
