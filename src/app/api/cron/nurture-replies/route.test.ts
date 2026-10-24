import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/cron/nurture-replies", () => {
  it("is held and does not quote a pilot price", async () => {
    const res = await GET();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("nurture_send_held");
    expect(body.held).toBe(true);
    expect(JSON.stringify(body)).not.toContain("2,999");
  });
});
