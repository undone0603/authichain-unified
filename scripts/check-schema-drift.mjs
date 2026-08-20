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
 * Usage:
 *   DATABASE_URL=... node scripts/check-schema-drift.mjs [--json] [--strict]
 *                                                        [--also=<other-schema.ts>]
 *
 * --also reports drift in another schema file without gating on it. Used for
 * schema files owned by a sub-app that declare tables in this same database.
 *
 * Exits 1 when a declared table or column is missing from the database, since
 * that is a guaranteed runtime failure. Extra DB columns the schema does not
 * declare are reported but do not fail the run unless --strict: they are
 * usually just untracked, not broken.
 */

import { readFileSync } from 'node:fs';

const SCHEMA_FILE = 'src/db/schema.ts';

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

    // `prop: type('physical_name'` — the quoted argument is what Postgres sees.
    const columns = [];
    const colRe = /(\w+)\s*:\s*\w+\(\s*['"]([^'"]+)['"]/g;
    for (const col of body.matchAll(colRe)) {
      columns.push({ property: col[1], column: col[2] });
    }
    tables.push({ exportName, tableName, columns });
  }
  return tables;
}

function summarise(tables, live) {
  const findings = [];
  for (const t of tables) {
    const actual = live.get(t.tableName);
    if (!actual) {
      findings.push({ table: t.tableName, kind: 'missing-table', detail: 'declared in schema, absent from database' });
      continue;
    }
    for (const c of t.columns) {
      if (!actual.has(c.column)) {
        // The most common form of this bug: camelCase declared, snake_case real.
        const snake = c.column.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        const hint = actual.has(snake) ? ` — database has "${snake}"` : '';
        findings.push({
          table: t.tableName,
          kind: 'missing-column',
          detail: `schema declares "${c.column}" (property ${c.property})${hint}`,
        });
      }
    }
    for (const col of actual) {
      if (!t.columns.some((c) => c.column === col)) {
        findings.push({ table: t.tableName, kind: 'untracked-column', detail: `database has "${col}", schema does not declare it` });
      }
    }
  }
  return findings;
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
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  await client.end();

  const live = new Map();
  for (const r of rows) {
    if (!live.has(r.table_name)) live.set(r.table_name, new Set());
    live.get(r.table_name).add(r.column_name);
  }

  const findings = summarise(tables, live);
  const breaking = findings.filter((f) => f.kind !== 'untracked-column');

  if (json) {
    console.log(JSON.stringify({ tables: tables.length, findings }, null, 2));
  } else {
    console.log(`Compared ${tables.length} declared tables against the database.\n`);
    if (!findings.length) console.log('No drift.');
    for (const kind of ['missing-table', 'missing-column', 'untracked-column']) {
      const group = findings.filter((f) => f.kind === kind);
      if (!group.length) continue;
      console.log(`${kind} (${group.length}):`);
      for (const f of group) console.log(`  ${f.table}: ${f.detail}`);
      console.log();
    }
    console.log(
      breaking.length
        ? `${breaking.length} finding(s) will fail at runtime — a query touching them raises 42703/42P01.`
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
    const otherBreaking = summarise(other, live).filter((f) => f.kind !== 'untracked-column');
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
