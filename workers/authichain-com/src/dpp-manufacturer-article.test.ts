import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DPP_MANUFACTURER_ARTICLE_PATH,
  isDppManufacturerArticlePath,
  renderDppManufacturerArticle,
  tryHandleDppManufacturerArticle,
} from "./dpp-manufacturer-article.ts";

function req(path: string) {
  return new Request(`https://authichain.govchain.us${path}`);
}

test("path helper recognizes the published manufacturer article", () => {
  assert.equal(DPP_MANUFACTURER_ARTICLE_PATH, "/blog/eu-dpp-manufacturer");
  assert.equal(isDppManufacturerArticlePath("/blog/eu-dpp-manufacturer"), true);
  assert.equal(
    isDppManufacturerArticlePath("/blog/eu-dpp-manufacturer/"),
    true
  );
  assert.equal(isDppManufacturerArticlePath("/eu-dpp"), false);
  assert.equal(isDppManufacturerArticlePath("/dpp"), false);
  assert.equal(isDppManufacturerArticlePath("/blog"), false);
});

test("article HTML uses the live DPP checkout and no AuthiChain Inc", () => {
  const html = renderDppManufacturerArticle();
  assert.match(
    html,
    /<title>Why AuthiChain Is Built for Digital Product Passports/
  );
  assert.match(
    html,
    /rel="canonical" href="https:\/\/authichain\.govchain\.us\/blog\/eu-dpp-manufacturer"/
  );
  assert.match(html, /action="\/api\/checkout\/dpp"/);
  assert.doesNotMatch(html, /href="\/api\/checkout\/dpp"/);
  assert.ok(
    html.includes('href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"')
  );
  assert.match(html, /Start DPP checkout/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="\/api\/checkout\/dpp"/);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /Everledger \(2016–2023\)/);
  assert.match(html, /entered liquidation in 2023/);
  // The article copy no longer quotes $299. The shared catalog checkout
  // button ("Pay $<price> on Stripe") is rendered by estateCtaBand and is out
  // of scope for this copy change, so strip it before checking.
  const copy = html.replace(/<div class="checkout-payment-link"[\s\S]*?<\/div>/g, "");
  assert.doesNotMatch(copy, /\$299/);
  assert.doesNotMatch(html, /Everledger-style/);
  assert.doesNotMatch(html, /vs Everledger/);
  assert.match(html, /18 Feb 2027/);
  assert.match(html, /ZACHARY KIETZMAN/);
  assert.doesNotMatch(html, /AuthiChain Inc/i);
  assert.doesNotMatch(html, /calendly/i);
  assert.doesNotMatch(html, /Draft only/);
});

test("tryHandleDppManufacturerArticle serves the article and ignores other paths", async () => {
  const hit = await tryHandleDppManufacturerArticle(
    req("/blog/eu-dpp-manufacturer")
  );
  assert.ok(hit);
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await hit.text(), /product trust infrastructure/);

  assert.equal(await tryHandleDppManufacturerArticle(req("/pricing")), null);
});
