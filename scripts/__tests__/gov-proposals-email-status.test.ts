/**
 * PM-330 item 7 / #1638 regression: every email_status value that code writes
 * to (or filters) gov_proposals must be allowed by the latest
 * gov_proposals_email_status_check in supabase/migrations.
 *
 * Before #1638 the digest wrote 'owner_notified', the constraint rejected it,
 * and the same 50 rows were re-sent every weekday. Static, offline: parses the
 * migration SQL and the gov_proposals senders; never connects to a database.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

/** Files that read/write gov_proposals.email_status. */
const SENDERS = [
  "scripts/email-proposals.ts",
  "ops/scripts/email-proposals.ts",
  "scripts/revenue-cycle.ts",
];

function latestAllowedStatuses(): { file: string; values: string[] } {
  const files = readdirSync(MIGRATIONS)
    .filter(f => f.endsWith(".sql"))
    .sort();
  let found: { file: string; values: string[] } | null = null;
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    const re =
      /add\s+constraint\s+gov_proposals_email_status_check\s+check\s*\(([\s\S]*?)\)\s*\)?\s*;/gi;
    for (const m of sql.matchAll(re)) {
      const values = [...m[1].matchAll(/'([^']+)'/g)].map(v => v[1]);
      found = { file, values };
    }
  }
  if (!found)
    throw new Error("no gov_proposals_email_status_check in migrations");
  return found;
}

function statusesUsedIn(file: string): string[] {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  const out = new Set<string>();
  for (const m of text.matchAll(/email_status["']?\s*:\s*["']([a-z_]+)["']/g))
    out.add(m[1]);
  for (const m of text.matchAll(
    /eq\(\s*["']email_status["']\s*,\s*["']([a-z_]+)["']/g
  ))
    out.add(m[1]);
  for (const m of text.matchAll(/email_status\s*===?\s*["']([a-z_]+)["']/g))
    out.add(m[1]);
  return [...out];
}

describe("gov_proposals.email_status constraint (#1638)", () => {
  const allowed = latestAllowedStatuses();

  it("is defined by #1638's migration or a later one, and allows owner_notified", () => {
    expect(
      allowed.file >= "20261009000001_gov_proposals_owner_notified_status.sql"
    ).toBe(true);
    expect(allowed.values).toEqual(
      expect.arrayContaining([
        "unsent",
        "sent",
        "bounced",
        "failed",
        "owner_notified",
      ])
    );
  });

  it("the digest marks rows owner_notified (the value the old constraint rejected)", () => {
    expect(statusesUsedIn("scripts/email-proposals.ts")).toContain(
      "owner_notified"
    );
  });

  for (const file of SENDERS) {
    it(`${file} only uses statuses the constraint allows`, () => {
      const used = statusesUsedIn(file);
      expect(used.length).toBeGreaterThan(0);
      for (const status of used) expect(allowed.values).toContain(status);
    });
  }
});
