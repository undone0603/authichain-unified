import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getDossier } from "./genetics";

const COAS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../content/strainchain/mendo-love-farms/coas"
);

const CANONICAL = {
  "240823Q009-001.pdf":
    "4aaf9691c996d7ea7b7a92c86b9cf224943c82a8b3b025d68ee27312f91f681f",
  "251104R041-001.pdf":
    "86bc4d288ced18f81accbd210ab31bb858c2b61d7e0e1ad293d665b33af43830",
} as const;

describe("canonical CoA PDFs on file", () => {
  const files = readdirSync(COAS_DIR)
    .filter(name => name.endsWith(".pdf"))
    .sort();

  it("stores one PDF per ingested CoA ID and no duplicates", () => {
    expect(files).toEqual(Object.keys(CANONICAL));
  });

  it("keeps the published sha256 of each canonical PDF", () => {
    for (const name of files) {
      const bytes = readFileSync(join(COAS_DIR, name));
      const digest = createHash("sha256").update(bytes).digest("hex");
      expect(digest).toBe(CANONICAL[name as keyof typeof CANONICAL]);
    }
  });

  it("does not invent an LT-63 certificate from these bytes", () => {
    expect(files.some(name => name.toLowerCase().includes("lt-63"))).toBe(
      false
    );
    const lt63 = getDossier("mendo-love-farms")!.cultivars.find(
      c => c.id === "LT-63"
    )!;
    expect(lt63.coa_ids).toEqual([]);
  });
});
