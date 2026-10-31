import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("/api/trial (retired)", () => {
  it("no longer offers plans that are not in the catalogue", async () => {
    for (const res of [await GET(), await POST()]) {
      expect(res.status).toBe(410);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(
        /\$?129|business_trial|pro_trial/
      );
      expect(body.pricing_url).toContain("/pricing");
    }
  });
});
