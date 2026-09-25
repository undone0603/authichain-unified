import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryHandleGeneticsRoutes } from "./genetics-routes.ts";

function get(path: string): Response {
  const res = tryHandleGeneticsRoutes(
    new Request(`https://authichain.govchain.us${path}`)
  );
  assert.ok(res, `expected handler for ${path}`);
  return res!;
}

describe("genetics routes", () => {
  it("serves /genetics index", async () => {
    const res = get("/genetics");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Mendo Love Farms/);
    assert.match(html, /never transcribed/i);
    assert.match(html, /name="email"/);
    assert.doesNotMatch(html, /href="[^"]*\/api\/checkout/);
    assert.ok(
      html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
    );
    assert.ok(
      html.includes('href="https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z"')
    );
  });

  it("serves Mendo farm library with derived peaks and LT-63 gap", async () => {
    const res = get("/genetics/mendo-love-farms");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /LT-63/);
    assert.match(html, /no CoA/i);
    assert.match(html, /recomputed/i);
    assert.match(html, /never transcribed/i);
    assert.match(html, /\/genetics\/mendo-love-farms\/vt-26/);
    assert.match(html, /\/genetics\/mendo-love-farms\/lt-63/);
    assert.ok(html.includes("/api/checkout/plan/strainchain_passport"));
    assert.match(html, /name="email"/);
    assert.doesNotMatch(html, /href="[^"]*\/api\/checkout/);
    assert.ok(
      html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
    );
    assert.ok(html.includes("/m/mendo"));
    assert.match(html, /11\.618%/);
  });

  it("serves VT-26 dossier with CoA id and derived totals", async () => {
    const res = get("/genetics/mendo-love-farms/vt-26");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /260320S005-001/);
    assert.match(html, /251104R041-001/);
    assert.match(html, /11\.618%/);
    assert.match(html, /11\.373%/);
    assert.match(html, /Recomputed/);
    assert.doesNotMatch(html, /Totals only/);
    assert.match(html, /Confirmed in writing|Claimed/);
    assert.match(html, /never transcribed/i);
    assert.ok(html.includes("/api/checkout/plan/strainchain_passport"));
    assert.match(html, /name="email"/);
    assert.doesNotMatch(html, /href="[^"]*\/api\/checkout/);
    assert.ok(
      html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
    );
  });

  it("serves LT-63 as an empty dossier, not invented chemistry", async () => {
    const res = get("/genetics/mendo-love-farms/lt-63");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /No CoA in library/);
    assert.match(html, /Sibling chemistry is not a substitute/);
    assert.doesNotMatch(html, /Peak total THCV 11\./);
    assert.ok(html.includes("/api/checkout/plan/strainchain_passport"));
    assert.match(html, /name="email"/);
    assert.doesNotMatch(html, /href="[^"]*\/api\/checkout/);
    assert.ok(
      html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
    );
  });

  it("404s an unknown cultivar", async () => {
    const res = get("/genetics/mendo-love-farms/nope");
    assert.equal(res.status, 404);
  });

  it("serves /passport landing", async () => {
    const res = get("/passport");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\$49/);
    assert.match(html, /\/genetics\/mendo-love-farms\/lt-63/);
    assert.match(html, /name="email"/);
    assert.doesNotMatch(html, /href="[^"]*\/api\/checkout/);
    assert.ok(
      html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
    );
  });

  it("ignores unrelated paths", () => {
    assert.equal(
      tryHandleGeneticsRoutes(new Request("https://authichain.govchain.us/pricing")),
      null
    );
  });
});
