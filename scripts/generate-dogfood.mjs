/**
 * Release attestation for this repository, signed with AuthiChain's own protocol.
 *
 *   node scripts/generate-dogfood.mjs [--artifact <path>]...   write docs/execution/AUTHICHAIN_DOGFOOD_RECORD.json
 *   node scripts/generate-dogfood.mjs --verify <record.json>   check a record against this checkout
 *
 * Generate exits 1 (and writes nothing) unless the new record checks out against the tree
 * it was made from. Verify exits 0 only for `bound`; 3 for `no-record` (nothing to check,
 * which is not evidence of a forgery); 1 for stale, mismatch and invalid.
 * What a record does and does not prove: scripts/lib/dogfood-release.mjs.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runDogfood, verifyRecordFile } from "./lib/dogfood-release.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = { artifacts: [], verify: undefined, bad: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--artifact" && argv[i + 1]) out.artifacts.push(argv[++i]);
    else if (a === "--verify" && argv[i + 1]) out.verify = argv[++i];
    else out.bad = a;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.bad !== undefined) {
    console.error(`unknown or incomplete argument: ${args.bad}`);
    console.error(
      "usage: generate-dogfood.mjs [--artifact <path>]... | --verify <record.json>"
    );
    return 2;
  }

  if (args.verify) {
    const result = verifyRecordFile({
      root: ROOT,
      file: join(process.cwd(), args.verify),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.verdict === "bound") return 0;
    return result.verdict === "no-record" ? 3 : 1;
  }

  const result = runDogfood({ root: ROOT, extraArtifacts: args.artifacts });
  if (!result.ok) {
    console.error(
      JSON.stringify(
        { ok: false, error: result.error, check: result.check },
        null,
        2
      )
    );
    return 1;
  }
  console.log(
    `Wrote release attestation to ${result.outFile} (${result.check.verdict}; protocol ${result.check.protocol.verdict})`
  );
  return 0;
}

process.exitCode = main();
