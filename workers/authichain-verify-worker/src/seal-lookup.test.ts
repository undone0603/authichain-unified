import { describe, expect, it } from "vitest";
import { lookupSeal, sealAsProduct } from "./index";

const ID = "3f2b8a1c-1d2e-4f5a-9b8c-7d6e5f4a3b2c";
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };

describe("lookupSeal", () => {
  it("queries auth_seals by lowercased uuid and maps to a product", async () => {
    let seen = "";
    const row = { id: ID, product_id: "authichain-demo", brand: "authichain.com", label: "AuthiChain demo", signing_kid: "k" };
    const seal = await lookupSeal(ID.toUpperCase(), env, (async (u: string) => {
      seen = u;
      return new Response(JSON.stringify([row]));
    }) as unknown as typeof fetch);
    expect(seen).toContain(`auth_seals?id=eq.${ID}`);
    expect(seal?.id).toBe(ID);
    expect(sealAsProduct(seal!)).toMatchObject({ product_identifier: ID, is_active: true, name: "AuthiChain demo" });
  });
  it("skips non-uuid ids and missing config without fetching", async () => {
    const boom = (async () => { throw new Error("no fetch"); }) as unknown as typeof fetch;
    expect(await lookupSeal("POLYGON-ANCHOR-1", env, boom)).toBeNull();
    expect(await lookupSeal(ID, {}, boom)).toBeNull();
  });
  it("returns null when not found", async () => {
    const seal = await lookupSeal(ID, env, (async () => new Response("[]")) as unknown as typeof fetch);
    expect(seal).toBeNull();
  });
});
