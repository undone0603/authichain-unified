import { describe, expect, it } from "vitest";
import { sealGeneration, unsignedGeneration } from "./generation-seal";

describe("generation seal", () => {
  it("leaves a generation unsigned and says it is artwork", () => {
    const seal = unsignedGeneration("gen_1");
    expect(seal.status).toBe("signature_not_checked");
    expect(seal.copy).toBe("This is artwork. It is not an authenticity verdict.");
    expect(seal.verifyUrl).toBe("https://authichain.com/verify/generation/gen_1");
    expect(seal.record).toBeNull();
  });

  it("refuses a product claim", async () => {
    await expect(
      sealGeneration({ generationId: "gen_1", claim: "genuine" })
    ).rejects.toThrow(/product claim refused/);
  });

  it("cannot return verified", async () => {
    const seal = await sealGeneration({ generationId: "gen_2" });
    expect(seal.status).not.toBe("verified");
    expect(JSON.stringify(seal)).not.toContain("\"verified\"");
  });
});
