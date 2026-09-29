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
});

test("an unknown docs slug is not a rendered article", () => {
  const html = renderDocsPage("/docs/attestations");
  assert.match(html, /Unknown docs page/);
});
