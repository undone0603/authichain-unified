#!/usr/bin/env node
/**
 * Supabase Oct 30 2026 explicit-GRANT check (AE-20261002-CFD-62, ADM-16).
 *
 * From 2026-10-30 Supabase stops auto-granting Data API privileges on NEW
 * tables in `public` on existing projects (QRON-v2 included). A migration that
 * creates a public table without explicit GRANTs then yields a table that
 * anon / authenticated / service_role cannot reach over PostgREST
 * (42501 permission denied). Existing tables keep their current grants.
 * Source: https://github.com/orgs/supabase/discussions/45329
 *         https://supabase.com/docs/guides/api/securing-your-api
 *
 * Read-only and offline: parses SQL files, never connects to a database.
 *
 * Rules for every migration NOT listed in scripts/ci/supabase-grants-baseline.txt:
 *   1. Each `create table` in `public` (or unqualified) needs at least one
 *      `grant ... on [table] public.<name> to anon|authenticated|service_role`
 *      in the same file, or an explicit exemption comment:
 *        -- supabase-grants-exempt: public.<name> <reason>
 *      (e.g. a table only reached over a direct Postgres connection).
 *   2. A table granted to anon or authenticated must also
 *      `enable row level security` in the same file (grant + RLS + policy is
 *      one unit per the Supabase docs).
 * Warnings (do not fail): serial/bigserial columns with INSERT grants need
 * `grant usage, select on sequence ...`; `on all tables in schema public`
 * re-grants every table and is wider than a per-table grant.
 *
 * Usage: node scripts/ci/check-supabase-grants.mjs --run
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const MIGRATION_DIRS = ["supabase/migrations", "drizzle/migrations"];
const BASELINE_FILE = path.join(
  ROOT,
  "scripts",
  "ci",
  "supabase-grants-baseline.txt"
);
const DATA_API_ROLES = new Set(["anon", "authenticated", "service_role"]);

const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`;
const QUALIFIED = String.raw`${IDENT}(?:\s*\.\s*${IDENT})?`;

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function unquote(part) {
  const p = part.trim();
  return p.startsWith('"') && p.endsWith('"')
    ? p.slice(1, -1)
    : p.toLowerCase();
}

/** Returns { schema, name } for an identifier like public."Foo" or foo. */
export function parseQualified(raw) {
  const parts = raw.match(new RegExp(IDENT, "g")) ?? [];
  if (parts.length >= 2)
    return { schema: unquote(parts[0]), name: unquote(parts[1]) };
  return { schema: "public", name: unquote(parts[0] ?? "") };
}

/** Public tables created by this SQL text (temp tables ignored). */
export function findPublicTables(sql) {
  const body = stripComments(sql);
  const re = new RegExp(
    String.raw`\bcreate\s+(?:(?:global|local)\s+)?((?:temp|temporary|unlogged)\s+)?table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`,
    "gi"
  );
  const out = [];
  for (const m of body.matchAll(re)) {
    if (m[1] && /^temp/i.test(m[1].trim())) continue;
    const { schema, name } = parseQualified(m[2]);
    if (schema === "public" && name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Map table -> { roles:Set, privileges:Set } from GRANT ... ON ... TO ... statements. */
export function findGrants(sql) {
  const body = stripComments(sql);
  const grants = new Map();
  let allTables = null;
  const re =
    /\bgrant\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+to\s+([\s\S]+?)(?:\s+with\s+grant\s+option)?\s*;/gi;
  for (const m of body.matchAll(re)) {
    const privileges = new Set(
      m[1]
        .toLowerCase()
        .split(/\s*,\s*/)
        .map(p => p.trim())
    );
    const roles = new Set(
      m[3]
        .split(",")
        .map(r => unquote(r))
        .filter(r => DATA_API_ROLES.has(r))
    );
    if (roles.size === 0) continue;
    let target = m[2].trim();
    if (/^all\s+tables\s+in\s+schema\s+/i.test(target)) {
      if (/\bpublic\b/i.test(target)) allTables = { roles, privileges };
      continue;
    }
    if (
      /^(sequence|function|procedure|routine|schema|all\s+sequences|all\s+functions)\b/i.test(
        target
      )
    )
      continue;
    target = target.replace(/^table\s+/i, "");
    for (const obj of target.split(",")) {
      const { schema, name } = parseQualified(obj);
      if (schema !== "public" || !name) continue;
      const entry = grants.get(name) ?? {
        roles: new Set(),
        privileges: new Set(),
      };
      roles.forEach(r => entry.roles.add(r));
      privileges.forEach(p => entry.privileges.add(p));
      grants.set(name, entry);
    }
  }
  return { grants, allTables };
}

export function findRlsTables(sql) {
  const body = stripComments(sql);
  const re = new RegExp(
    String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${QUALIFIED})\s+enable\s+row\s+level\s+security`,
    "gi"
  );
  const out = new Set();
  for (const m of body.matchAll(re)) {
    const { schema, name } = parseQualified(m[1]);
    if (schema === "public") out.add(name);
  }
  return out;
}

export function findExemptions(sql) {
  const out = new Set();
  for (const m of sql.matchAll(/--\s*supabase-grants-exempt:\s*(\S+)\s+\S/gi)) {
    const { schema, name } = parseQualified(m[1]);
    if (schema === "public") out.add(name);
  }
  return out;
}

/** Check one migration's SQL. Returns { errors: string[], warnings: string[] }. */
export function checkMigrationSql(sql, label = "migration") {
  const errors = [];
  const warnings = [];
  const tables = findPublicTables(sql);
  if (tables.length === 0) return { errors, warnings };
  const { grants, allTables } = findGrants(sql);
  const rls = findRlsTables(sql);
  const exempt = findExemptions(sql);
  if (allTables) {
    warnings.push(
      `${label}: "grant ... on all tables in schema public" re-grants EVERY public table; prefer per-table grants.`
    );
  }
  for (const t of tables) {
    if (exempt.has(t)) continue;
    const g = grants.get(t) ?? allTables;
    if (!g || g.roles.size === 0) {
      errors.push(
        `${label}: creates public.${t} without an explicit GRANT to anon/authenticated/service_role ` +
          `(Supabase Oct 30 2026). Add e.g. "grant select, insert, update, delete on table public.${t} to service_role;" ` +
          `or "-- supabase-grants-exempt: public.${t} <reason>". See docs/supabase/explicit-grants-oct-30.md`
      );
      continue;
    }
    const clientRoles = [...g.roles].filter(
      r => r === "anon" || r === "authenticated"
    );
    if (clientRoles.length > 0 && !rls.has(t)) {
      errors.push(
        `${label}: grants public.${t} to ${clientRoles.join(", ")} but does not "alter table public.${t} enable row level security" in the same migration.`
      );
    }
  }
  const body = stripComments(sql);
  if (
    /\b(?:small|big)?serial\b/i.test(body) &&
    !/\bgrant\s+[^;]*\busage\b[^;]*\bon\s+(?:sequence|all\s+sequences)\b/i.test(
      body
    )
  ) {
    const inserters = [...grants.values()].some(
      g =>
        g.privileges.has("insert") ||
        g.privileges.has("all") ||
        g.privileges.has("all privileges")
    );
    if (inserters) {
      warnings.push(
        `${label}: serial column + INSERT grant but no "grant usage, select on sequence ..."; identity columns do not need it, serial columns do.`
      );
    }
  }
  return { errors, warnings };
}

export function readBaseline(file = BASELINE_FILE) {
  if (!existsSync(file)) return new Set();
  return new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("#"))
  );
}

export function listMigrations(root = ROOT) {
  const out = [];
  for (const dir of MIGRATION_DIRS) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).sort()) {
      if (name.endsWith(".sql")) out.push(`${dir}/${name}`);
    }
  }
  return out;
}

export function run(root = ROOT, baseline = readBaseline()) {
  const errors = [];
  const warnings = [];
  let checked = 0;
  for (const rel of listMigrations(root)) {
    if (baseline.has(rel)) continue;
    checked += 1;
    const res = checkMigrationSql(
      readFileSync(path.join(root, rel), "utf8"),
      rel
    );
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  }
  return { checked, errors, warnings };
}

if (process.argv.includes("--run")) {
  const { checked, errors, warnings } = run();
  for (const w of warnings) console.warn(`::warning::${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`::error::${e}`);
    console.error(
      `${errors.length} problem(s) in ${checked} non-baseline migration(s).`
    );
    process.exit(1);
  }
  console.log(
    `Supabase explicit GRANTs: ${checked} non-baseline migration(s) checked, 0 problems.`
  );
}
