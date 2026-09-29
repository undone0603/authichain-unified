import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const call = (qs: string) =>
  GET(new NextRequest(`https://strainchain.io/api/genetics/verify${qs}`));

describe("GET /api/genetics/verify for a withdrawn farm", () => {
  it("answers unknown_farm, so the withdrawn record cannot be read", async () => {
    const res = await call("?farm=mendo-love-farms&cultivar=vt-26");
    expect(res.status).toBe(404);
    const b = await res.json();
    expect(b.error).toBe("unknown_farm");
    expect(JSON.stringify(b)).not.toMatch(/digest|canonical|vt-26"/);
  });

  it("does not name the withdrawn farm in its usage hint", async () => {
    const res = await call("");
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/mendo/i);
  });
});
