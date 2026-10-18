import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANCHORING_UNAVAILABLE } from "@/lib/anchoring-status";
import { anchorProofDeliverable } from "./anchor-proof";

describe("anchorProofDeliverable", () => {
  it("refuses a HubSpot anchor proof without a chain write", () => {
    const result = anchorProofDeliverable();
    expect(result).toEqual({
      anchored: false,
      artifactUrl: null,
      error: ANCHORING_UNAVAILABLE,
    });
    expect(JSON.stringify(result)).not.toContain("polygonscan");
  });

  it("does not keep a chain call in the deliverable agent", () => {
    const src = readFileSync(path.join(import.meta.dirname, "hubspot.ts"), "utf8");
    expect(src).not.toMatch(/anchorEdgeHash/);
    expect(src).not.toMatch(/polygonscan/);
    expect(src).toMatch(/anchorProofDeliverable\(\)/);
  });
});
