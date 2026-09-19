import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTATE_BASE_CSS,
  ESTATE_BRANDS,
  estateCtaBand,
  estateCssVars,
  estateFooter,
  estateHero,
  estateNav,
  estateTrust,
} from "./estate-landing.ts";

test("light tokens stay on white for every estate brand", () => {
  for (const id of Object.keys(ESTATE_BRANDS) as Array<keyof typeof ESTATE_BRANDS>) {
    const css = estateCssVars(id);
    assert.match(css, /--bg: #ffffff/);
    assert.match(css, /--text: #0f172a/);
    assert.match(css, new RegExp(`--accent: ${ESTATE_BRANDS[id].accent}`));
  }
  assert.match(ESTATE_BASE_CSS, /:focus-visible/);
  assert.match(ESTATE_BASE_CSS, /\.skip-link/);
});

test("shared chrome keeps conversion hrefs verbatim", () => {
  const nav = estateNav("authichain", [{ href: "/onboard", label: "Onboard" }], {
    href: "/dashboard",
    label: "Open dashboard",
  });
  assert.match(nav, /href="\/dashboard"/);
  assert.match(nav, /href="\/onboard"/);

  const hero = estateHero({
    eyebrow: "Test",
    title: "Headline",
    lede: "Lede",
    actions: [
      { href: "/generate", label: "Generate Living QR", primary: true },
      { href: "/api/checkout/dpp", label: "Start DPP checkout" },
    ],
  });
  assert.match(hero, /href="\/generate"/);
  assert.match(hero, /href="\/api\/checkout\/dpp"/);

  const trust = estateTrust([{ value: "Polygon", label: "On-chain anchor" }]);
  assert.doesNotMatch(trust, /847\+/);
  assert.match(trust, /Polygon/);

  const cta = estateCtaBand({
    title: "Go",
    lede: "Now",
    actions: [{ href: "/onboard", label: "Onboard", primary: true }],
  });
  assert.match(cta, /href="\/onboard"/);

  const footer = estateFooter(
    "qron",
    [{ heading: "Start", links: [{ href: "/generate", label: "Generate" }] }],
    "note",
  );
  assert.match(footer, /href="\/generate"/);
});
