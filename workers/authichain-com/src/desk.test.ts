/**
 * Self-serve desk: honest catalogue, three rails, sitemap-listed paths resolve.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402.ts";
import worker from "./index.ts";
import { DESK_SITEMAP } from "./desk.ts";

type Env = Parameters<typeof worker.fetch>[1];
const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

async function get(path: string) {
  return worker.fetch(new Request(`https://authichain.govchain.us${path}`), ENV);
}

test("/desk is a real page, not the indigo homepage", async () => {
  const res = await get("/desk");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Self-serve desk — AuthiChain<\/title>/);
  assert.match(html, /Issue\. Bind\. Verify\./);
  assert.match(html, /--ink:#0c0c0d/);
  assert.match(html, /action="\/api\/checkout\/dpp"/);
  assert.doesNotMatch(html, /href="\/api\/checkout\/dpp"/);
  assert.doesNotMatch(html, /Aura|MediLedger|Walmart/);
  assert.doesNotMatch(html, /1369/);
  assert.match(html, /\$QRON is not a payment rail/);
  assert.ok(
    html.includes('href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"')
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z"')
  );
  // Retired StrainChain Basic link (no live Stripe account) must not return.
  assert.equal(html.includes("9B6cN59br5xcaCuazy1Nu1o"), false);
});

test("desk subpaths in DESK_SITEMAP all 200", async () => {
  for (const path of DESK_SITEMAP) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
  }
});

test("/desk/unknown is 404, not the homepage", async () => {
  const res = await get("/desk/nope-xyz");
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /Not on this desk/);
  assert.doesNotMatch(html, /--accent: #4F46E5/);
});

test("/desk/pricing collects recovery email for plan checkout", async () => {
  const res = await get("/desk/pricing");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /action="\/api\/checkout\/plan\/strainchain_passport"/);
  assert.match(html, /name="email"/);
  assert.match(html, /\$49/);
  assert.match(html, /\$499/);
  assert.ok(
    html.includes('href="https://buy.stripe.com/00w4gzgDT6Bg5iagXW1ND3A"')
  );
  assert.doesNotMatch(html, /1Nu1p/);
  assert.doesNotMatch(html, /href="\/api\/checkout/);
});

test("/desk/token splits payTo, deployer, and Smart Wallet", async () => {
  const res = await get("/desk/token");
  const html = await res.text();
  assert.ok(html.includes(X402_PUBLISHED_PAY_TO));
  assert.match(html, /0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d/);
  assert.match(html, /0xC0D26735fd9e868eacc60400ef3171Fa4161177f/);
  assert.match(html, /Staking UI is theater/);
  assert.match(html, /not a payment rail/);
});

test("/desk/status records telegram sitemap live and Base pending", async () => {
  const res = await get("/desk/status");
  const html = await res.text();
  assert.match(html, /telegram is in sitemap/);
  assert.match(html, /getCode on 8453 is still 0x/);
  assert.match(html, /#1138 on main/);
});

test("/desk/hubs does not claim W3C VC specs are implemented", async () => {
  const res = await get("/desk/hubs");
  const html = await res.text();
  assert.match(html, /does not implement them yet/);
  assert.match(html, /eu-digital-product-passport-registry-test-environment/);
});

test("apex sitemap lists /desk paths that resolve", async () => {
  const res = await get("/sitemap.xml");
  assert.equal(res.status, 200);
  const xml = await res.text();
  for (const path of DESK_SITEMAP) {
    assert.match(xml, new RegExp(`https://authichain.com${path}<`));
  }
});

test("/desk/verify runs five-agent consensus on the desk", async () => {
  const res = await get("/desk/verify");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Guardian/);
  assert.match(html, /Sentinel/);
  assert.match(html, /Archivist/);
  assert.match(html, /Scout/);
  assert.match(html, /Arbiter/);
  assert.match(html, /AC-7C2A91E4/);
  assert.match(html, /AC-DPP-BATT-8841/);
  assert.match(html, /action="\/desk\/verify"/);
  assert.doesNotMatch(html, /location\.href = '\/verify'/);
  assert.doesNotMatch(html, /Verify on apex/);
});

test("/desk/verify?id=AC-7C2A91E4 shows labeled sample consensus", async () => {
  const res = await get("/desk/verify?id=AC-7C2A91E4");
  const html = await res.text();
  assert.match(html, /Guardian/);
  assert.match(html, /Michigan METRC/);
  assert.match(html, /Desk sample/);
  assert.match(html, /Consensus reached/);
  assert.match(html, /query_provenance status desk_sample, verified false/);
  assert.doesNotMatch(html, /location\.href = '\/verify'/);
});

test("/desk/verify?id=AC-DPP-BATT-8841 is the battery DPP sample", async () => {
  const res = await get("/desk/verify?id=AC-DPP-BATT-8841");
  const html = await res.text();
  assert.match(html, /Harbor-3/);
  assert.match(html, /18 Feb 2027/);
  assert.match(html, /Guardian/);
  assert.match(html, /Story Mode/);
  assert.match(html, /Cells, then a pack/);
  assert.match(html, /this lot only/);
  assert.match(html, /Desk sample/);
});

test("/desk/verify never attests an unknown ID", async () => {
  const res = await get("/desk/verify?id=NOPE-XYZ");
  const html = await res.text();
  assert.match(html, /Unknown\. Not attested/);
  assert.match(html, /unknown stays unknown/i);
  assert.match(html, /vote-unknown/);
  assert.doesNotMatch(html, /EU DPP Ready/);
  assert.doesNotMatch(html, /Consensus reached/);
  assert.doesNotMatch(html, /location\.href = '\/verify'/);
  assert.match(html, /No story on this tag/);
  assert.match(html, /does not borrow another lot/);
  assert.doesNotMatch(html, /Cells, then a pack/);
  assert.doesNotMatch(html, /The mother/);
});

test("/desk/verify?id=GC-MIA-DLA-0005 is not a government mint", async () => {
  const res = await get("/desk/verify?id=GC-MIA-DLA-0005");
  const html = await res.text();
  assert.match(html, /not a government mint/i);
  assert.match(html, /No SBIR/);
  assert.match(html, /govchain\.us\/gift/);
});

test("/desk/pricing sells Farm $149/mo", async () => {
  const res = await get("/desk/pricing");
  const html = await res.text();
  assert.match(html, /\$149/);
  assert.match(html, /action="\/api\/checkout\/plan\/strainchain_farm"/);
  assert.ok(html.includes('href="https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z"'));
  assert.doesNotMatch(html, /href="\/api\/checkout/);
});
