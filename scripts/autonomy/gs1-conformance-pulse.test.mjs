import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyResults, CANARY_DIGITAL_LINK } from "./gs1-conformance-pulse.mjs";

// Fixtures use the real status vocabulary from GS1's own suite JS
// (github.com/gs1/GS1DL-resolver-testsuite, GS1DigitalLinkResolverTestSuite.js:
// `"status": "fail", // (pass|fail|warn), default is fail`), and the real shape
// #resultsGrid `<a>` elements carry after extraction via
// `page.$$eval("#resultsGrid a", as => as.map(a => ({status: a.className, ...})))`
// -- an array of {status} objects, not raw HTML. This is what caught the
// original bug: the real suite marks results with a CSS class (`a.className =
// o.status`), never an inline `background-color` style, so a regex looking
// for inline hex colors matched nothing on the real page and silently
// reported "healthy" for zero results.

test("classifyResults counts pass/fail/warn from real GS1 status classes", () => {
  const cells = [
    { status: "pass" },
    { status: "fail" },
    { status: "warn" },
    { status: "pass" },
  ];
  const result = classifyResults(cells);
  assert.equal(result.pass, 2);
  assert.equal(result.fail, 1);
  assert.equal(result.warn, 1);
  assert.equal(result.healthy, false);
});

test("classifyResults is healthy when there are results and none fail", () => {
  const cells = [{ status: "pass" }, { status: "warn" }, { status: "pass" }];
  const result = classifyResults(cells);
  assert.equal(result.healthy, true);
});

test("classifyResults treats zero results as NOT healthy (probe failure, not a real pass)", () => {
  // This is the exact bug the review caught: the original regex-based parser
  // returned {green:0,red:0,neutral:0,healthy:true} for a page it couldn't
  // parse at all -- an empty result set must never read as a clean run.
  const result = classifyResults([]);
  assert.equal(result.healthy, false);
  assert.equal(result.pass, 0);
});

test("classifyResults treats an unrecognized status as a parse problem, not silently as pass", () => {
  const result = classifyResults([{ status: "pass" }, { status: "unknown-future-status" }]);
  assert.equal(result.healthy, false);
});

test("CANARY_DIGITAL_LINK points at the real issued seal", () => {
  assert.equal(
    CANARY_DIGITAL_LINK,
    "https://id.authichain.com/01/09506000134352/21/GS1-CONFORMANCE-TEST"
  );
});
