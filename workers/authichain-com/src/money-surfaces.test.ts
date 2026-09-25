import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DPP_CHECKOUT,
  PASSPORT_CHECKOUT_PATH,
  isMadeInAmericaPath,
  isTrumarkPath,
  renderMadeInAmericaPage,
  renderTrumarkPage,
  tryHandleMoneySurface,
} from "./money-surfaces.ts";

function req(path: string) {
  return new Request(`https://authichain.govchain.us${path}`);
}

test("path helpers recognize canonical and alias URLs", () => {
  assert.equal(isTrumarkPath("/trumark"), true);
  assert.equal(isTrumarkPath("/trumark/"), true);
  assert.equal(isTrumarkPath("/made-in-america"), false);
  for (const p of ["/made-in-america", "/partners/brief", "/ftc-shield"]) {
    assert.equal(isMadeInAmericaPath(p), true, p);
    assert.equal(isMadeInAmericaPath(`${p}/`), true, `${p}/`);
  }
  assert.equal(isMadeInAmericaPath("/trumark"), false);
});

test("TruMark page uses live Passport and DPP checkout CTAs", () => {
  const html = renderTrumarkPage();
  assert.match(html, /<title>TruMark seals \| AuthiChain<\/title>/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/authichain\.govchain\.us\/trumark"/
  );
  assert.equal(html.includes(`action="${PASSPORT_CHECKOUT_PATH}"`), true);
  assert.equal(html.includes(`action="${DPP_CHECKOUT}"`), true);
  assert.match(html, /Passport checkout — \$49/);
  assert.match(html, /DPP checkout — \$299/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="\/api\/checkout\/plan\/strainchain_passport"/);
  assert.match(html, /action="\/api\/checkout\/dpp"/);
  assert.doesNotMatch(html, /href="\/api\/checkout/);
  assert.doesNotMatch(html, /GET \/api\/checkout/);
  assert.ok(
    html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"')
  );
  assert.match(html, /href="\/pricing"/);
  assert.match(
    html,
    /mailto:hello@authichain.com\?subject=TruMark%20written%20packet/
  );
  assert.doesNotMatch(html, /calendly/i);
  assert.doesNotMatch(html, /schedule a (call|demo)/i);
  assert.doesNotMatch(html, /AuthiChain Inc/i);
  assert.match(html, /ZACHARY KIETZMAN/);
});

test("Made in America page uses live DPP checkout and partner-brief alias story", () => {
  const html = renderMadeInAmericaPage();
  assert.match(
    html,
    /<title>Made in America origin claims \| AuthiChain<\/title>/
  );
  assert.match(
    html,
    /rel="canonical" href="https:\/\/authichain\.govchain\.us\/made-in-america"/
  );
  assert.match(html, /16 CFR Part 323/);
  assert.match(html, /EO 14392|Executive Order 14392/);
  assert.equal(html.includes(`action="${DPP_CHECKOUT}"`), true);
  assert.match(html, /name="email"/);
  assert.match(html, /action="\/api\/checkout\/dpp"/);
  assert.match(html, /href="\/partners\/brief"/);
  assert.ok(
    html.includes('href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"')
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
  );
  assert.match(
    html,
    /mailto:hello@authichain.com\?subject=Made%20in%20America%20written%20packet/
  );
  assert.doesNotMatch(html, /calendly/i);
  assert.doesNotMatch(html, /schedule a (call|demo)/i);
  assert.doesNotMatch(html, /AuthiChain Inc/i);
});

test("tryHandleMoneySurface serves aliases and ignores unknown paths", async () => {
  const trumark = await tryHandleMoneySurface(req("/trumark"));
  assert.ok(trumark);
  assert.equal(trumark.status, 200);
  assert.match(await trumark.text(), /01 \/ TruMark/);

  for (const path of ["/made-in-america", "/partners/brief", "/ftc-shield"]) {
    const res = await tryHandleMoneySurface(req(path));
    assert.ok(res, path);
    assert.equal(res.status, 200, path);
    assert.match(await res.text(), /Made in America/);
  }

  assert.equal(await tryHandleMoneySurface(req("/pricing")), null);
});
