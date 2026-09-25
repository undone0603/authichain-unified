import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MICROSITE_HTML } from "./microsite-packs.ts";
import {
  MICROSITES,
  PASSPORT_CHECKOUT,
  DPP_CHECKOUT,
  micrositeSitemapUrls,
  resolveMicrositePack,
  tryHandleMicrosite,
} from "./microsite-routes.ts";
import worker from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

type Env = Parameters<typeof worker.fetch>[1];
const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

function req(path: string, host = "authichain.com") {
  return new Request(`https://${host}${path}`);
}

function hasSitemapPath(urls: URL[], pathname: string): boolean {
  return urls.some(
    u =>
      u.protocol === "https:" &&
      u.hostname === "authichain.com" &&
      u.pathname === pathname
  );
}

test("embedded packs stay in sync with content/microsites HTML", () => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "content/microsites/manifest.json"), "utf8")
  );
  for (const pack of manifest.packs) {
    const disk = readFileSync(
      join(ROOT, "content/microsites", pack.file),
      "utf8"
    );
    assert.equal(
      MICROSITE_HTML[pack.slug],
      disk,
      `${pack.slug} drifted — run node scripts/sync-microsite-packs.mjs`
    );
  }
});

test("every pack has live Passport or DPP checkout and no call booking", () => {
  for (const [slug, html] of Object.entries(MICROSITE_HTML)) {
    assert.doesNotMatch(html, /calendly/i, slug);
    assert.doesNotMatch(html, /book a call/i, slug);
    assert.doesNotMatch(html, /schedule a (call|demo)/i, slug);
    assert.doesNotMatch(html, /AuthiChain Inc/i, slug);
    assert.match(html, /ZACHARY KIETZMAN/, slug);
    const hasPassport = html.includes(
      "/api/checkout/plan/strainchain_passport"
    );
    const hasDpp = html.includes("/api/checkout/dpp");
    assert.ok(hasPassport || hasDpp, `${slug} needs a live checkout CTA`);
    assert.match(html, /name="email"/, slug);
    assert.doesNotMatch(html, /GET \/api\/checkout/, slug);
  }
  assert.match(MICROSITE_HTML.mendo, /\$49/);
  assert.match(MICROSITE_HTML.mendo, /LT-63/);
  assert.match(MICROSITE_HTML.mendo, /no CoA/);
  assert.match(MICROSITE_HTML.mendo, /id="license-outline"/);
  assert.match(MICROSITE_HTML.mendo, /StrainChain does not breed/);
  assert.match(MICROSITE_HTML.mendo, /name="email"/);
  assert.ok(
    MICROSITE_HTML.mendo.includes(
      'href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"'
    )
  );
  assert.ok(
    MICROSITE_HTML.trumark.includes(
      'href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"'
    )
  );
  assert.ok(
    MICROSITE_HTML.strainchain.includes(
      'href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"'
    )
  );
  assert.ok(
    MICROSITE_HTML.musa.includes(
      'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
    )
  );
  const bat = MICROSITE_HTML["bat-2026-001"];
  assert.match(bat, /BAT-2026-001/);
  assert.match(bat, /Insulin Vial 100IU/);
  assert.match(bat, /MVCL-MQWQ2MR7-I7L0/);
  assert.match(
    bat,
    /2b6b1c38ade800f639b98307509e6004adab6dbeea0f66474083276b6269dbb2/
  );
  assert.match(bat, /Annex II Certification Requi/);
  assert.doesNotMatch(bat, /Annex II Certification Required/);
  assert.doesNotMatch(bat, /WHO GMP Certification \(Global/);
  assert.match(bat, /name="email"/);
  assert.match(bat, /action="https:\/\/authichain\.govchain\.us\/api\/checkout\/dpp"/);
  assert.ok(
    bat.includes('href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"')
  );
  assert.ok(
    bat.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
  );
  assert.match(
    MICROSITE_HTML.mendo,
    /ZACHARY KIETZMAN \(AuthiChain \/ StrainChain are brands\)/
  );
});

test("path and host aliases resolve to the right pack", () => {
  assert.equal(resolveMicrositePack("/m/mendo"), "mendo");
  assert.equal(resolveMicrositePack("/m/realthcv/"), "mendo");
  assert.equal(resolveMicrositePack("/m/lt-63"), "mendo");
  assert.equal(resolveMicrositePack("/m/trumark"), "trumark");
  assert.equal(resolveMicrositePack("/m/musa"), "musa");
  assert.equal(resolveMicrositePack("/m/made-in-america"), "musa");
  assert.equal(resolveMicrositePack("/m/strainchain"), "strainchain");
  assert.equal(resolveMicrositePack("/m/bat-2026-001"), "bat-2026-001");
  assert.equal(resolveMicrositePack("/m/insulin-vial"), "bat-2026-001");
  assert.equal(resolveMicrositePack("/pricing"), null);
  assert.equal(resolveMicrositePack("/", "mendo.authichain.com"), "mendo");
  assert.equal(
    resolveMicrositePack("/anything", "trumark.authichain.com"),
    "trumark"
  );
});

test("tryHandleMicrosite serves /m hub and packs", async () => {
  const hub = tryHandleMicrosite(req("/m"));
  assert.ok(hub);
  assert.equal(hub.status, 200);
  const hubHtml = await hub.text();
  assert.match(hubHtml, /Mendo \/ RealTHCV/);
  assert.match(hubHtml, /Passport checkout — \$49/);
  assert.match(hubHtml, /name="email"/);
  assert.match(hubHtml, /action="\/api\/checkout\/plan\/strainchain_passport"/);
  assert.ok(
    hubHtml.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
  );
  assert.ok(
    hubHtml.includes('href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"')
  );
  assert.match(hubHtml, /ZACHARY KIETZMAN/);
  assert.doesNotMatch(
    hubHtml,
    /<a class="btn"[^>]*href="\/api\/checkout/,
    "hub cards must capture email before checkout"
  );

  const mendo = tryHandleMicrosite(req("/m/mendo"));
  assert.ok(mendo);
  assert.match(await mendo.text(), /LT-63/);

  const alias = tryHandleMicrosite(req("/m/realthcv"));
  assert.ok(alias);
  assert.match(await alias.text(), /Passport checkout — \$49/);

  const host = tryHandleMicrosite(req("/", "mendo.authichain.com"));
  assert.ok(host);
  assert.match(await host.text(), /RealTHCV/);

  const batPage = tryHandleMicrosite(req("/m/bat-2026-001"));
  assert.ok(batPage);
  assert.equal(batPage.status, 200);
  const batHtml = await batPage.text();
  assert.match(batHtml, /MVCL-MQWQ2MR7-I7L0/);
  assert.match(
    batHtml,
    /action="https:\/\/authichain\.govchain\.us\/api\/checkout\/dpp"/
  );
  assert.doesNotMatch(
    batHtml,
    /<a class="btn"[^>]*href="\/api\/checkout/,
    "BAT gift page must capture email before checkout"
  );

  const batAlias = tryHandleMicrosite(req("/m/insulin-vial"));
  assert.ok(batAlias);
  assert.match(await batAlias.text(), /Insulin Vial 100IU/);

  assert.match(hubHtml, /BAT-2026-001 \/ Insulin Vial 100IU/);

  assert.equal(tryHandleMicrosite(req("/pricing")), null);
});

test("apex worker serves /m pages and does not steal /p", async () => {
  for (const path of [
    "/m",
    "/m/mendo",
    "/m/trumark",
    "/m/musa",
    "/m/strainchain",
    "/m/bat-2026-001",
    "/m/insulin-vial",
  ]) {
    const res = await worker.fetch(req(path), ENV);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /api\/checkout/, path);
    assert.doesNotMatch(html, /calendly/i);
  }

  const passport = await worker.fetch(req("/p/CERT-001"), ENV);
  assert.equal(passport.status, 200);
  assert.equal(await passport.text(), "app");
});

test("sitemap lists canonical microsite URLs", () => {
  const urls = micrositeSitemapUrls().map(raw => new URL(raw));
  assert.ok(hasSitemapPath(urls, "/m"));
  assert.ok(hasSitemapPath(urls, "/m/mendo"));
  assert.ok(hasSitemapPath(urls, "/m/bat-2026-001"));
  assert.ok(
    !hasSitemapPath(urls, "/telegram"),
    "Mini App loc belongs on the worker sitemap, not the microsite list"
  );
  assert.equal(Object.keys(MICROSITES).length, 5);
  assert.equal(PASSPORT_CHECKOUT.includes("strainchain_passport"), true);
  assert.equal(DPP_CHECKOUT.endsWith("/api/checkout/dpp"), true);
});
