/**
 * Self-serve desk: honest catalogue, three rails, sitemap-listed paths resolve.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";
import { DESK_SITEMAP } from "./desk.ts";

type Env = Parameters<typeof worker.fetch>[1];
const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

async function get(path: string) {
  return worker.fetch(new Request(`https://authichain.com${path}`), ENV);
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
  assert.match(html, /\$299\/mo/);
  assert.doesNotMatch(html, /href="\/api\/checkout/);
});

test("/desk/token splits payTo, deployer, and Smart Wallet", async () => {
  const res = await get("/desk/token");
  const html = await res.text();
  assert.match(html, /0x5db511706FB6317cd23A7655F67450c5AC6e6AA2/);
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
