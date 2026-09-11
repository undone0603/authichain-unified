import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { fingerprintCultivar } from "@/lib/fingerprint";
import { getCultivar } from "@/lib/genetics";

const call = (qs: string) =>
  GET(new NextRequest(`https://strainchain.io/api/genetics/verify${qs}`));

describe("GET /api/genetics/verify", () => {
  it("returns the digest and the bytes it came from", async () => {
    const res = await call("?farm=mendo-love-farms&cultivar=vt-26");
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.digest).toMatch(/^sha256:[A-Fa-f0-9]{64}$/);
    expect(typeof b.canonical).toBe("string");
    expect(b.anchored).toBe(false);
  });

  it("publishes bytes that actually rehash to the published digest", async () => {
    // The whole point: a caller must be able to check rather than trust.
    const b = await (
      await call("?farm=mendo-love-farms&cultivar=vt-26")
    ).json();
    const { createHash } = await import("node:crypto");
    expect(
      `sha256:${createHash("sha256").update(b.canonical, "utf8").digest("hex")}`
    ).toBe(b.digest);
  });

  it("confirms a matching supplied digest", async () => {
    const expected = fingerprintCultivar(
      getCultivar("mendo-love-farms", "vt-26")!,
      "mendo-love-farms"
    ).digest;
    const b = await (
      await call(`?farm=mendo-love-farms&cultivar=vt-26&digest=${expected}`)
    ).json();
    expect(b.match).toBe(true);
  });

  it("reports a mismatch as a real answer, not an error", async () => {
    const res = await call(
      "?farm=mendo-love-farms&cultivar=vt-26&digest=sha256:" + "0".repeat(64)
    );
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.match).toBe(false);
    expect(b.proves).toMatch(/Nothing about this record's validity/);
  });

  it("is case-insensitive on the supplied digest", async () => {
    const expected = fingerprintCultivar(
      getCultivar("mendo-love-farms", "vt-26")!,
      "mendo-love-farms"
    ).digest;
    const b = await (
      await call(
        `?farm=mendo-love-farms&cultivar=vt-26&digest=${expected.toUpperCase()}`
      )
    ).json();
    expect(b.match).toBe(true);
  });

  it("accepts the cultivar id as written on the certificates, not just the slug", async () => {
    const bySlug = await (
      await call("?farm=mendo-love-farms&cultivar=vt-26")
    ).json();
    const byId = await (
      await call("?farm=mendo-love-farms&cultivar=VT-26")
    ).json();
    expect(byId.digest).toBe(bySlug.digest);
  });

  it("never omits the does-not-prove copy, on any path", async () => {
    for (const qs of [
      "?farm=mendo-love-farms&cultivar=vt-26",
      "?farm=mendo-love-farms&cultivar=lt-63",
      "?farm=mendo-love-farms&cultivar=vt-26&digest=sha256:" + "1".repeat(64),
    ]) {
      const b = await (await call(qs)).json();
      expect(b.doesNotProve, qs).toBeTruthy();
    }
  });

  it("404s an unknown cultivar and says what it does know", async () => {
    const res = await call("?farm=mendo-love-farms&cultivar=nope");
    expect(res.status).toBe(404);
    expect((await res.json()).known).toContain("vt-26");
  });

  it("400s without the required parameters", async () => {
    expect((await call("")).status).toBe(400);
  });
});
