import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ESTATE_BASE_CSS,
  ESTATE_BRANDS,
  ESTATE_FONTS_LINK,
  ESTATE_INDEXNOW_KEY,
  ESTATE_INDEXNOW_PATH,
  estateCtaBand,
  estateCssVars,
  estateFooter,
  estateHero,
  estateIndexNowResponse,
  estateNav,
  estateSteps,
  estateTrust,
  tryHandleEstateIndexNow,
} from "./estate-landing.ts";

test("light tokens stay on white for every estate brand", () => {
  for (const id of Object.keys(ESTATE_BRANDS) as Array<
    keyof typeof ESTATE_BRANDS
  >) {
    const css = estateCssVars(id);
    assert.match(css, /--bg: #ffffff/);
    assert.match(css, /--text: #0f172a/);
    assert.match(css, new RegExp(`--accent: ${ESTATE_BRANDS[id].accent}`));
  }
  assert.match(ESTATE_BASE_CSS, /:focus-visible/);
  assert.match(ESTATE_BASE_CSS, /\.skip-link/);
  assert.match(estateCssVars("authichain"), /--accent: #4F46E5/);
  assert.match(estateCssVars("authichain"), /Plus Jakarta Sans/);
  assert.match(estateCssVars("authichain"), /79, 70, 229/);
});

test("how-it-works steps keep Issue → Bind → Verify copy verbatim", () => {
  const html = estateSteps("How it works", "Three realized steps.", [
    { title: "Issue", body: "Issue a signed seal." },
    { title: "Bind", body: "Bind it to the product." },
    { title: "Verify", body: "Verify from any camera." },
  ]);
  assert.match(html, /id="how"/);
  assert.match(html, /Issue/);
  assert.match(html, /Bind/);
  assert.match(html, /Verify/);
});

test("shared chrome keeps conversion hrefs verbatim", () => {
  const nav = estateNav(
    "authichain",
    [{ href: "/onboard", label: "Onboard" }],
    {
      href: "/dashboard",
      label: "Open dashboard",
    }
  );
  assert.match(nav, /href="\/dashboard"/);
  assert.match(nav, /href="\/onboard"/);

  const hero = estateHero({
    eyebrow: "Test",
    title: "Headline",
    lede: "Lede",
    actions: [
      { href: "/generate", label: "Generate Living QR", primary: true },
      { href: "https://authichain.com/checkout/dpp_readiness", label: "Start DPP checkout" },
    ],
  });
  assert.match(hero, /href="\/generate"/);
  assert.match(hero, /href="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);

  const emailHero = estateHero({
    eyebrow: "Test",
    title: "Headline",
    lede: "Lede",
    emailCheckout: {
      action: "https://authichain.com/checkout/dpp_readiness",
      label: "Start DPP checkout — $299",
    },
    actions: [{ href: "/pricing", label: "View pricing", primary: false }],
  });
  assert.match(emailHero, /name="email"/);
  assert.match(emailHero, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.doesNotMatch(emailHero, /Checkout without saving a recovery email/);
  assert.ok(
    emailHero.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.match(emailHero, /id="hero-checkout-email"/);

  const trust = estateTrust([{ value: "Polygon", label: "On-chain anchor" }]);
  assert.doesNotMatch(trust, /847\+/);
  assert.match(trust, /Polygon/);

  const cta = estateCtaBand({
    title: "Go",
    lede: "Now",
    actions: [{ href: "/onboard", label: "Onboard", primary: true }],
  });
  assert.match(cta, /href="\/onboard"/);

  const emailCta = estateCtaBand({
    title: "Go",
    lede: "Now",
    emailCheckout: {
      action: "https://authichain.com/checkout/dpp_readiness",
      label: "Start DPP checkout",
    },
    actions: [{ href: "/pricing", label: "View pricing", primary: false }],
  });
  assert.match(emailCta, /name="email"/);
  assert.match(emailCta, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.match(emailCta, /href="\/pricing"/);
  assert.ok(
    emailCta.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.match(emailCta, /id="cta-checkout-email"/);

  const footer = estateFooter(
    "qron",
    [{ heading: "Start", links: [{ href: "/generate", label: "Generate" }] }],
    "note"
  );
  assert.match(footer, /href="\/generate"/);
});

test("IndexNow key file is exact-path plain text with a short cache", async () => {
  const res = estateIndexNowResponse();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=3600");
  assert.equal(await res.text(), ESTATE_INDEXNOW_KEY);
  assert.equal(ESTATE_INDEXNOW_PATH, "/authichain2026indexnow.txt");
  assert.equal(ESTATE_INDEXNOW_KEY, "authichain2026indexnow");

  const hit = tryHandleEstateIndexNow(
    new Request("https://authichain.govchain.us/authichain2026indexnow.txt")
  );
  assert.ok(hit);
  assert.equal(await hit.text(), ESTATE_INDEXNOW_KEY);

  assert.equal(
    tryHandleEstateIndexNow(
      new Request("https://qron.space/authichain2026indexnow.txt/")
    ),
    null,
    "trailing slash is not the key file"
  );
  assert.equal(
    tryHandleEstateIndexNow(
      new Request("https://govchain.us/authichain2026indexnow")
    ),
    null,
    "extensionless path is not the key file"
  );
  assert.equal(
    tryHandleEstateIndexNow(
      new Request("https://strainchain.io/authichain2026indexnow.txt", {
        method: "POST",
      })
    ),
    null,
    "non-GET is left to the worker"
  );
});

// CFD-194: Plus Jakarta Sans is self-hosted from each Worker's static assets.
const SHARED_DIR = fileURLToPath(new URL(".", import.meta.url));
const FONT_DIR = join(SHARED_DIR, "font-assets", "fonts");
const GOOGLE_FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;
const FONT_WORKERS = ["authichain-com", "govchain-us", "qron-space", "strainchain-io"];

test("estate font link is same-origin, not Google Fonts", () => {
  assert.doesNotMatch(ESTATE_FONTS_LINK, GOOGLE_FONT_HOSTS);
  assert.match(ESTATE_FONTS_LINK, /href="\/fonts\/plus-jakarta-sans\.css"/);
});

test("self-hosted @font-face rules use swap and point at shipped woff2 files", () => {
  const css = readFileSync(join(FONT_DIR, "plus-jakarta-sans.css"), "utf8");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), GOOGLE_FONT_HOSTS);
  const rules = css.match(/@font-face\{[^}]*\}/g) ?? [];
  assert.equal(rules.length, 20);
  const seen = new Set<string>();
  for (const rule of rules) {
    assert.match(rule, /font-family:'Plus Jakarta Sans'/);
    assert.match(rule, /font-display:swap/);
    const weight = rule.match(/font-style:(normal|italic);font-weight:(\d+)/);
    assert.ok(weight, rule);
    seen.add(`${weight[1]} ${weight[2]}`);
    const file = rule.match(/url\(\/fonts\/([a-z0-9-]+\.woff2)\)/)?.[1];
    assert.ok(file, rule);
    const bytes = readFileSync(join(FONT_DIR, file));
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", file);
  }
  assert.deepEqual([...seen].sort(), [
    "italic 400",
    "normal 400",
    "normal 500",
    "normal 600",
    "normal 700",
  ]);
  assert.ok(existsSync(join(FONT_DIR, "FONTS-LICENSE.md")));
});

test("font-serving Workers ship the font assets and no Google Fonts references", () => {
  const scan = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return scan(path);
      return /\.(ts|js|mjs|html)$/.test(name) ? [path] : [];
    });
  for (const worker of FONT_WORKERS) {
    const toml = readFileSync(join(SHARED_DIR, "..", worker, "wrangler.toml"), "utf8");
    assert.match(toml, /\[assets\]\s*\ndirectory = "\.\.\/_shared\/font-assets"/, worker);
    for (const file of scan(join(SHARED_DIR, "..", worker, "src"))) {
      assert.doesNotMatch(readFileSync(file, "utf8"), GOOGLE_FONT_HOSTS, file);
    }
  }
  for (const name of readdirSync(SHARED_DIR).filter((n) => /^estate-.*\.ts$/.test(n))) {
    if (name.endsWith(".test.ts")) continue;
    assert.doesNotMatch(readFileSync(join(SHARED_DIR, name), "utf8"), GOOGLE_FONT_HOSTS, name);
  }
});
