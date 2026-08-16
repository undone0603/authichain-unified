import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error — plain .mjs module, no type declarations
import { parseSchema } from '../check-schema-drift.mjs';

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
    expect(table.columns).toEqual([
      { property: 'id', column: 'id' },
      { property: 'userId', column: 'user_id' },
      { property: 'createdAt', column: 'created_at' },
    ]);
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
