import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseSchema,
  splitTopLevel,
  summarise,
  columnSuppliesItsOwnValue,
  poolerTls,
} from '../check-schema-drift.mjs';

/** Shorthand for the live-database side of summarise(). */
const db = (cols: Record<string, [boolean, boolean]>) =>
  new Map(
    Object.entries(cols).map(([name, [notNull, hasDefault]]) => [name, { notNull, hasDefault }]),
  );

/**
 * The parser is the part that can be wrong silently: if it stops finding
 * tables or columns, the drift check reports a clean bill of health for a
 * schema it never read. These tests pin that it actually parses.
 */

describe('parseSchema', () => {
  it('extracts the physical column name, not the property name', () => {
    // The distinction is the entire point. Drizzle's second argument is what
    // Postgres sees, so `userId: integer('user_id')` is correct and
    // `userId: integer('userId')` against a snake_case column is the bug.
    const src = `
      export const widgets = pgTable('widgets', {
        id: serial('id').primaryKey(),
        userId: integer('user_id').notNull(),
        createdAt: timestamp('created_at').defaultNow(),
      });
    `;
    const [table] = parseSchema(src);
    expect(table.tableName).toBe('widgets');
    expect(table.columns.map((c: { property: string; column: string }) => [c.property, c.column])).toEqual([
      ['id', 'id'],
      ['userId', 'user_id'],
      ['createdAt', 'created_at'],
    ]);
  });

  it('records notNull and default, which is what makes an insert fail', () => {
    // A name-only comparison called mission_tasks healthy while every insert
    // into it raised 23502. These two flags are the difference.
    const src = `
      export const widgets = pgTable('widgets', {
        id: serial('id').primaryKey(),
        status: varchar('status', { length: 50 }).default('pending').notNull(),
        note: text('note'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
      });
    `;
    const [table] = parseSchema(src);
    const by = Object.fromEntries(table.columns.map((c: { column: string }) => [c.column, c]));

    // serial carries its default in the column type, not a .default() call.
    expect(by.id).toMatchObject({ notNull: true, hasDefault: true });
    expect(by.status).toMatchObject({ notNull: true, hasDefault: true });
    expect(by.note).toMatchObject({ notNull: false, hasDefault: false });
    expect(by.created_at).toMatchObject({ notNull: true, hasDefault: true });
  });

  it('reads modifiers that follow a default containing commas and braces', () => {
    // Splitting properties on every comma would cut this default in half and
    // lose the .notNull() after it, silently reporting the column as nullable.
    const src = `
      export const things = pgTable('things', {
        meta: json('meta').default({ a: 1, b: 2 }).notNull(),
      });
    `;
    const [table] = parseSchema(src);
    expect(table.columns[0]).toMatchObject({ column: 'meta', notNull: true, hasDefault: true });
  });

  it('does not truncate a table body at a nested object', () => {
    // A default or enum containing braces used to end the body early, which
    // silently dropped every column after it.
    const src = `
      export const things = pgTable('things', {
        id: serial('id').primaryKey(),
        meta: json('meta').default({ nested: { deep: true } }),
        tail: text('tail_column'),
      });
    `;
    const [table] = parseSchema(src);
    expect(table.columns.map((c: { column: string }) => c.column)).toContain('tail_column');
  });

  it('finds every table in the real schema', () => {
    const tables = parseSchema(readFileSync('src/db/schema.ts', 'utf8'));
    expect(tables.length).toBeGreaterThan(50);
    for (const t of tables) {
      expect(t.tableName, `${t.exportName} has no table name`).toBeTruthy();
      expect(t.columns.length, `${t.tableName} parsed with no columns`).toBeGreaterThan(0);
    }
  });

  it('picks up both quote styles', () => {
    const src = `
      export const a = pgTable("double", { id: serial("id") });
      export const b = pgTable('single', { id: serial('id') });
    `;
    expect(parseSchema(src).map((t: { tableName: string }) => t.tableName)).toEqual(['double', 'single']);
  });
});

describe('splitTopLevel', () => {
  it('splits on commas between properties, not commas inside them', () => {
    expect(splitTopLevel(`a: text('a'), b: json('b').default({ x: 1, y: 2 }), c: text('c')`)).toEqual([
      `a: text('a')`,
      `b: json('b').default({ x: 1, y: 2 })`,
      `c: text('c')`,
    ]);
  });

  it('ignores brackets and commas inside string literals', () => {
    expect(splitTopLevel(`a: text('has, comma'), b: text('has ) paren')`)).toHaveLength(2);
  });
});

describe('columnSuppliesItsOwnValue', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    column_default: null,
    is_identity: 'NO',
    is_generated: 'NEVER',
    ...over,
  });

  it('counts an identity column even though its column_default is null', () => {
    // This is not a detail. Seven of this database's primary keys — leads.id,
    // ab_tests.id, referrals.id among them — are GENERATED ALWAYS AS IDENTITY,
    // which reports column_default as NULL. Reading column_default alone called
    // all seven inserts-that-can-never-succeed, so half of every report would
    // have been wrong.
    expect(columnSuppliesItsOwnValue(row({ is_identity: 'YES' }))).toBe(true);
  });

  it('counts a generated column', () => {
    expect(columnSuppliesItsOwnValue(row({ is_generated: 'ALWAYS' }))).toBe(true);
  });

  it('counts an ordinary default', () => {
    expect(columnSuppliesItsOwnValue(row({ column_default: `'pending'::text` }))).toBe(true);
  });

  it('does not count a plain NOT NULL column', () => {
    expect(columnSuppliesItsOwnValue(row())).toBe(false);
  });
});

describe('summarise', () => {
  const schema = (col: { notNull: boolean; hasDefault: boolean }) => [
    { exportName: 'widgets', tableName: 'widgets', columns: [{ property: 'status', column: 'status', ...col }] },
  ];
  const kinds = (findings: { kind: string }[]) => findings.map((f) => f.kind);

  it('flags a schema default the database does not have on a NOT NULL column', () => {
    // The mission_tasks bug exactly: Drizzle sends the DEFAULT keyword, the
    // database has no default, DEFAULT is NULL, NOT NULL rejects it.
    const findings = summarise(
      schema({ notNull: true, hasDefault: true }),
      new Map([['widgets', db({ status: [true, false] })]]),
    );
    expect(kinds(findings)).toEqual(['default-never-applies']);
  });

  it('downgrades the same mismatch to a warning when the column is nullable', () => {
    // Still wrong — the insert stores NULL instead of the declared default —
    // but it does not fail, so it must not gate CI.
    const findings = summarise(
      schema({ notNull: false, hasDefault: true }),
      new Map([['widgets', db({ status: [false, false] })]]),
    );
    expect(kinds(findings)).toEqual(['default-not-in-db']);
  });

  it('flags a required database column the schema treats as optional', () => {
    const findings = summarise(
      schema({ notNull: false, hasDefault: false }),
      new Map([['widgets', db({ status: [true, false] })]]),
    );
    expect(kinds(findings)).toEqual(['required-not-declared']);
  });

  it('says nothing when the database supplies the value itself', () => {
    const findings = summarise(
      schema({ notNull: true, hasDefault: true }),
      new Map([['widgets', db({ status: [true, true] })]]),
    );
    expect(findings).toEqual([]);
  });

  it('reports a notNull declaration the database does not enforce', () => {
    const findings = summarise(
      schema({ notNull: true, hasDefault: false }),
      new Map([['widgets', db({ status: [false, false] })]]),
    );
    expect(kinds(findings)).toEqual(['nullability-drift']);
  });
});

describe('poolerTls', () => {
  const ca = '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----';

  it('never disables certificate verification', () => {
    // The connection string carries the database password. A verification
    // failure is a configuration problem with a known remedy — the pooler's
    // private root — not a reason to stop checking who is on the other end.
    const { ssl } = poolerTls('postgres://u:p@abc.pooler.supabase.com:6543/postgres', () => ca);
    expect(ssl).not.toHaveProperty('rejectUnauthorized', false);
  });

  it('adds the pinned root to the default trust store rather than replacing it', () => {
    // Passing `ca: [oneCert]` makes that cert the *only* trusted root, so a
    // pooler presenting an ordinary publicly-rooted chain fails with
    // SELF_SIGNED_CERT_IN_CHAIN. Both have to verify.
    const { ssl } = poolerTls('postgres://u:p@abc.pooler.supabase.com:6543/postgres', () => ca);
    expect(ssl!.ca).toContain(ca);
    expect(ssl!.ca.length).toBeGreaterThan(1);
  });

  it('leaves a non-Supabase host on the default trust store', () => {
    expect(poolerTls('postgres://u:p@localhost:5432/postgres', () => ca)).toEqual({});
  });

  it('reads a real certificate from the checked-in PEM', () => {
    // Guards against the file being emptied or moved: an unparseable CA would
    // otherwise surface as a confusing TLS handshake error at connect time.
    const pem = readFileSync('certs/supabase-root-2021.pem', 'utf8');
    expect(pem).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(pem.trimEnd()).toMatch(/-----END CERTIFICATE-----$/);
  });
});
