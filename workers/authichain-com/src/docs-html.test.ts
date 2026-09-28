import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS_PAGES } from "./docs-pages";
import { renderDocsPage } from "./docs-render";

test("rendered docs HTML passes the claim guard", () => {
  const pages = ["/docs", ...DOCS_PAGES.map((slug) => `/docs/${slug}`)];
  for (const path of pages) {
    const html = renderDocsPage(path);
    assert.match(html, /<title>/, path);
    assert.doesNotMatch(html, /Bitcoin L1/, path);
    assert.doesNotMatch(html, /\$49\/mo/, path);
    assert.doesNotMatch(html, /gs1ConformantResolver: true/, path);
    assert.doesNotMatch(html, /id\.authichain\.com\/01\//, path);
  }
});

test("an unknown docs slug is not a rendered article", () => {
  const html = renderDocsPage("/docs/attestations");
  assert.match(html, /Unknown docs page/);
});
