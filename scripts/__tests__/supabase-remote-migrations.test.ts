import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const REMOTE_LIST = path.join(ROOT, "supabase", "REMOTE_APPLIED_VERSIONS.txt");

function localVersions(): Set<string> {
  return new Set(
    readdirSync(MIGRATIONS_DIR)
      .filter(name => name.endsWith(".sql"))
      .map(name => name.replace(/_.*$/, "").replace(/\.sql$/, ""))
  );
}

function remoteVersions(): string[] {
  return readFileSync(REMOTE_LIST, "utf8")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
}

describe("Supabase local migrations cover remote history", () => {
  it("has a local SQL file for every remote-applied version", () => {
    const local = localVersions();
    const missing = remoteVersions().filter(version => !local.has(version));
    expect(missing, "remote versions missing from supabase/migrations").toEqual(
      []
    );
  });
});
