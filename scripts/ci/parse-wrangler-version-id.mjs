#!/usr/bin/env node
/**
 * Pull a Worker Version ID out of `wrangler versions upload` stdout.
 * Accepts --json objects or the human "Worker Version ID: <uuid>" line.
 * Read-only. Prints the id and nothing else.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UUID =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export function parseWranglerVersionId(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const jsonBlob = raw.match(/\{[\s\S]*\}\s*$/);
  const candidates = [raw];
  if (jsonBlob) candidates.unshift(jsonBlob[0]);
  for (const chunk of candidates) {
    try {
      const data = JSON.parse(chunk);
      const id =
        data.id ||
        data.version_id ||
        data.worker_version?.id ||
        data.result?.id ||
        "";
      if (typeof id === "string" && UUID.test(id)) return id;
    } catch {
      // human wrangler text
    }
  }
  const labeled = raw.match(/Worker Version ID:\s*([0-9a-fA-F-]{36})/i);
  if (labeled) return labeled[1];
  const fallback = raw.match(UUID);
  return fallback ? fallback[0] : "";
}

function main(argv = process.argv.slice(2)) {
  const path = argv[0];
  const text = path
    ? readFileSync(path, "utf8")
    : readFileSync(0, "utf8");
  const id = parseWranglerVersionId(text);
  if (!id) {
    console.error("could not parse Worker Version ID");
    process.exit(1);
  }
  process.stdout.write(id);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
