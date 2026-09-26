import { describe, expect, it } from "vitest";
import { app } from "./index";

describe("POST /api/dpp/verify", () => {
  it("returns 400 JSON without dpp_id", async () => {
    const res = await app.request("/api/dpp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "edge" }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = await res.json();
    expect(body.error).toMatch(/dpp_id/);
  });

  it("returns 400 JSON on invalid body", async () => {
    const res = await app.request("/api/dpp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid_json/);
  });
});
