import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/trial/start", () => {
  it("is retired and does not open a checkout", async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("trial_offers_retired");
    expect(body.pricing_url).toBe("https://qron.space/generate");
  });
});
