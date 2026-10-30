import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The migration records seven production functions that had no migration. This
// test pins the file to the text that was read from production on 2026-10-22.
// It proves the file has not drifted from that read. It does not prove that
// production still matches; the query in the migration header does that.

const FILE = path.resolve(
  import.meta.dirname,
  "../../supabase/migrations/20261022190000_recover_verify_family_functions.sql"
);

const EXPECTED = {
  "normalize_asset_ref(text)": "a6551186fa3d7c51b2a7579de22f7494",
  "get_asset_provenance(uuid,text)": "86e90297704e78915f9dcd0a76aa0812",
  "get_public_verification(text)": "b68538d3324ea7c8f10ed2f4b58b29a8",
  "increment_portal_scan(text)": "571b89f262edb1679e4f3af9c963f159",
  "resolve_asset(text)": "0a5ec032ccbcaffef49c3ab5c6239f67",
  "score_asset(jsonb,jsonb)": "d722387375399be7443256181a069a2b",
  "verify_asset(text,uuid,jsonb)": "2cd18f31ae5d0ec70785b2b0e6ea07f4",
};

const md5 = text => createHash("md5").update(text, "utf8").digest("hex");

/** Splits the file into BEGIN/END blocks and the lines outside them. */
function parse(sql) {
  const lines = sql.split("\n");
  const blocks = [];
  const outside = [];
  let i = 0;
  while (i < lines.length) {
    const begin = /^-- BEGIN (.+) md5:([0-9a-f]{32})$/.exec(lines[i]);
    if (!begin) {
      outside.push(lines[i]);
      i += 1;
      continue;
    }
    const body = [];
    i += 1;
    while (i < lines.length && lines[i] !== `-- END ${begin[1]}`) {
      body.push(lines[i]);
      i += 1;
    }
    // The block ends with a lone ";" line after the definition's own newline.
    expect(body.at(-1), `${begin[1]} terminator`).toBe(";");
    blocks.push({
      sig: begin[1],
      marker: begin[2],
      def: `${body.slice(0, -1).join("\n")}\n`,
    });
    i += 1;
  }
  return { blocks, outside };
}

const parsed = parse(readFileSync(FILE, "utf8"));

describe("recovered verify-family SQL", () => {
  it("records exactly the seven functions, normalize_asset_ref before its caller", () => {
    const sigs = parsed.blocks.map(b => b.sig);
    expect([...sigs].sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(sigs.indexOf("normalize_asset_ref(text)")).toBeLessThan(
      sigs.indexOf("resolve_asset(text)")
    );
    expect(sigs.at(-1)).toBe("verify_asset(text,uuid,jsonb)");
  });

  it.each(Object.entries(EXPECTED))(
    "%s matches the md5 read from production",
    (sig, want) => {
      const block = parsed.blocks.find(b => b.sig === sig);
      expect(block, sig).toBeDefined();
      expect(block.marker).toBe(want);
      expect(md5(block.def)).toBe(want);
      expect(block.def.startsWith("CREATE OR REPLACE FUNCTION public.")).toBe(true);
      expect(block.def.endsWith("$function$\n")).toBe(true);
    }
  );

  it("changes no privileges and creates nothing else", () => {
    const statements = parsed.outside.filter(
      line => line.trim() !== "" && !line.startsWith("--")
    );
    expect(statements).toEqual([]);
    for (const block of parsed.blocks) {
      expect(block.def).not.toMatch(/^\s*(grant|revoke)\b/im);
    }
  });
});
