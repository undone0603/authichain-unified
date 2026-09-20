import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryHandleGeneticsRoutes } from "./genetics-routes.ts";

function get(path: string): Response {
  const res = tryHandleGeneticsRoutes(new Request(`https://authichain.com${path}`));
  assert.ok(res, `expected handler for ${path}`);
  return res!;
}

describe("genetics routes", () => {
  it("serves /genetics index", async () => {
    const res = get("/genetics");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Mendo Love Farms/);
  });

  it("serves Mendo farm library with LT-63 gap", async () => {
    const res = get("/genetics/mendo-love-farms");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /LT-63/);
    assert.match(html, /no CoA/i);
    assert.match(html, /authichain\.com\/api\/checkout\/plan\/strainchain_passport/);
    assert.match(html, /authichain\.com\/m\/mendo/);
  });

  it("serves /passport landing", async () => {
    const res = get("/passport");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\$49/);
  });

  it("ignores unrelated paths", () => {
    assert.equal(tryHandleGeneticsRoutes(new Request("https://authichain.com/pricing")), null);
  });
});
