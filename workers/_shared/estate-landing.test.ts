import { test } from "node:test";
import assert from "node:assert/strict";
import { EMAIL_OPTIN_CONSENT_TEXT } from "./email-optin-copy.ts";
import {
  ESTATE_BASE_CSS,
  ESTATE_BRANDS,
  ESTATE_INDEXNOW_KEY,
  ESTATE_INDEXNOW_PATH,
  ESTATE_LEAD_CAPTURE_ENDPOINT,
  ESTATE_LEAD_CAPTURE_ID,
  ESTATE_LEAD_CAPTURE_ORIGINS,
  ESTATE_LEAD_CAPTURE_PRIVACY_HREF,
  estateCtaBand,
  estateCssVars,
  estateFooter,
  estateHero,
  estateIndexNowResponse,
  estateLeadCapture,
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
      {
        href: "https://authichain.com/checkout/dpp_readiness",
        label: "Start DPP checkout",
      },
    ],
  });
  assert.match(hero, /href="\/generate"/);
  assert.match(
    hero,
    /href="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );

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
  assert.match(
    emailHero,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
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
  assert.match(
    emailCta,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
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
  assert.match(footer, /id="lead-capture"/);
});

test("estate footer lead capture is on every brand and posts hostname as source", () => {
  assert.equal(ESTATE_LEAD_CAPTURE_ID, "lead-capture");
  assert.equal(
    ESTATE_LEAD_CAPTURE_ENDPOINT,
    "https://authichain.com/api/leads/capture"
  );
  assert.deepEqual(
    [...ESTATE_LEAD_CAPTURE_ORIGINS].sort(),
    Object.values(ESTATE_BRANDS)
      .map(b => b.url)
      .sort()
  );
  assert.match(ESTATE_BASE_CSS, /\.estate-lead-capture/);
  assert.match(ESTATE_BASE_CSS, /\.estate-lead-consent/);

  for (const id of Object.keys(ESTATE_BRANDS) as Array<
    keyof typeof ESTATE_BRANDS
  >) {
    const html = estateLeadCapture(id);
    const footer = estateFooter(
      id,
      [{ heading: "Start", links: [{ href: "/", label: "Home" }] }],
      "note"
    );
    assert.match(html, /id="lead-capture"/);
    assert.match(footer, /id="lead-capture"/);
    assert.equal(html.includes('id="lead-capture"'), true);
    assert.match(html, new RegExp(`id="${ESTATE_LEAD_CAPTURE_ID}"`));
    assert.ok(html.includes(`action="${ESTATE_LEAD_CAPTURE_ENDPOINT}"`));
    assert.ok(html.includes(`fetch("${ESTATE_LEAD_CAPTURE_ENDPOINT}"`));
    assert.ok(html.includes('type="email"'));
    assert.ok(html.includes("required"));
    assert.ok(html.includes('name="consent"'));
    assert.doesNotMatch(html, /id="lead-capture-consent"[^>]*\bchecked\b/);
    assert.ok(html.includes(EMAIL_OPTIN_CONSENT_TEXT));
    assert.ok(html.includes(`href="${ESTATE_LEAD_CAPTURE_PRIVACY_HREF}"`));
    assert.ok(html.includes(`value="${ESTATE_BRANDS[id].domain}"`));
    assert.ok(html.includes(`value="${id}"`));
    assert.ok(html.includes("loc.hostname"));
    assert.ok(html.includes('role="status"'));
    assert.ok(html.includes("aria-live"));
    assert.doesNotMatch(html, /AuthiChain, Inc/);
    assert.doesNotMatch(html, /limited time|act now|only today/i);
  }
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
