import { describe, expect, it } from "vitest";
import { L402_CLAIM_TTL_MS, L402Claims } from "./l402-claims";
import { fakeClaimState, type ClaimState } from "./l402-claims.fakes";

function claimsObject() {
  const state = fakeClaimState();
  return { state, obj: new L402Claims(state as unknown as ClaimState, {}) };
}

describe("L402Claims Durable Object", () => {
  it("gives exactly one of ten simultaneous claims the payment", async () => {
    const { obj } = claimsObject();
    const results = await Promise.all(Array.from({ length: 10 }, () => obj.apply("claim")));
    expect(results.filter(r => r === "claimed")).toHaveLength(1);
    expect(results.filter(r => r === "replay")).toHaveLength(9);
  });

  it("releases only an unfinished claim; a served call stays spent", async () => {
    const { obj } = claimsObject();
    expect(await obj.apply("claim")).toBe("claimed");
    expect(await obj.apply("release")).toBe("released");
    expect(await obj.apply("claim")).toBe("claimed");
    expect(await obj.apply("settle")).toBe("settled");
    expect(await obj.apply("release")).toBe("released");
    expect(await obj.apply("claim")).toBe("replay");
  });

  it("schedules its own cleanup well after any token has expired", async () => {
    const { obj, state } = claimsObject();
    const before = Date.now();
    await obj.apply("claim");
    expect(state.alarmAt).toBeGreaterThanOrEqual(before + L402_CLAIM_TTL_MS);
    await obj.alarm();
    expect(state.data.size).toBe(0);
  });

  it("answers over fetch and refuses unknown operations", async () => {
    const { obj } = claimsObject();
    const post = (body: string) => obj.fetch(new Request("https://l402-claims.internal/", { method: "POST", body }));
    expect(await (await post(JSON.stringify({ op: "claim" }))).json()).toEqual({ result: "claimed" });
    const bad = await post(JSON.stringify({ op: "drop" }));
    expect(bad.status).toBe(400);
    expect((await post("not json")).status).toBe(400);
  });
});
