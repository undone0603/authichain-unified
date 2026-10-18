import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS_PAGES } from "./docs-pages";
import { renderDocsPage } from "./docs-render";

test("rendered docs HTML passes the claim guard", () => {
  const pages = ["/docs", ...DOCS_PAGES.map((slug) => `/docs/${slug}`)];
  for (const path of pages) {
    const html = renderDocsPage(path);
    assert.ok(html.includes("<title>"), path);
    assert.equal(html.includes("Bitcoin L1"), false, path);
    assert.equal(html.includes("$49/mo"), false, path);
    assert.equal(html.includes("gs1ConformantResolver: true"), false, path);
    assert.equal(html.includes("id.authichain.com/01/"), false, path);
  }
  const hub = renderDocsPage("/docs");
  assert.ok(hub.includes("utm_source=docs"));
  assert.ok(hub.includes("utm_campaign=docs-hub"));
  assert.ok(hub.includes("/battery-passport"));
  assert.ok(hub.includes("18 February 2027"));
  assert.ok(hub.includes("LMT"));
  const architecture = renderDocsPage("/docs/dpp-architecture");
  assert.ok(architecture.includes("/checkout/dpp_readiness?utm_source=docs"));
  assert.equal(architecture.includes("written assessment"), false);
  assert.equal(architecture.includes("written readiness assessment"), false);
  assert.equal(architecture.includes("AuthiChain Basic"), false);
  assert.ok(architecture.includes("50 workspace generations"));
  assert.ok(architecture.includes("Not legal advice"));
});

test("dpp architecture separates a free seal answer from the unpaid 402", () => {
  const html = renderDocsPage("/docs/dpp-architecture");
  assert.match(html, /An empty JSON body is the unpaid HTTP 402/);
  assert.match(html, /daily free allowance/);
  assert.match(html, /free: true/);
  assert.match(html, /verified: false/);
  assert.match(html, /settlement: null/);
  assert.match(html, /not a paid receipt/);
  assert.match(html, /non-UUID seal id is HTTP 400 before payment/);
  assert.equal(html.includes("Unpaid POST /api/x402 returns HTTP 402"), false);
  assert.equal(html.includes('{"sealId":"demo"}'), false);
  assert.equal(html.includes("polygonscan.com"), false);
  assert.equal(html.includes("polygon-anchor-1"), false);
});

test("an unknown docs slug is not a rendered article", () => {
  const html = renderDocsPage("/docs/attestations");
  assert.match(html, /Unknown docs page/);
});

test("docs links keep query strings escaped exactly once", () => {
  const pages = ["/docs", ...DOCS_PAGES.map((slug) => `/docs/${slug}`)];
  for (const path of pages) {
    const html = renderDocsPage(path);
    assert.equal(html.includes("&amp;amp;"), false, path);
  }
  const hub = renderDocsPage("/docs");
  assert.ok(
    hub.includes('href="/dpp-check?utm_source=docs&amp;utm_medium=authority&amp;utm_campaign=docs-hub"'),
  );
});

test("verification FAQ names the free demonstration check", () => {
  const html = renderDocsPage("/docs/verification");
  assert.match(html, /\/api\/verify\?id=polygon-anchor-1/);
  assert.match(html, /not a customer product/);
  assert.match(html, /not a physical inspection/);
  assert.match(html, /does not itself read the anchor transaction/);
  assert.match(html, /empty body returns HTTP 402/);
  assert.match(html, /daily free allowance/);
  assert.match(html, /free: true/);
  assert.match(html, /verified: false/);
  assert.match(html, /settlement: null/);
  assert.match(html, /not a paid receipt/);
  assert.match(html, /not a seal UUID is HTTP 400/);
  assert.equal(html.includes("freeCalls"), false);
  assert.equal(html.includes("polygonscan.com"), false);
  assert.equal(html.includes('{"sealId":"demo"}'), false);
});
