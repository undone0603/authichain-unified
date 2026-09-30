import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSuiteResults, CANARY_DIGITAL_LINK } from "./gs1-conformance-pulse.mjs";

test("parseSuiteResults counts green/red/neutral from the suite's own DOM colors", () => {
  const html = `
    <div class="row">
      <div style="background-color:#90ee90">pass one</div>
      <div style="background-color:#ff7f7f">fail one</div>
      <div style="background-color:#ffd580">neutral one</div>
      <div style="background-color:#90ee90">pass two</div>
    </div>`;
  const result = parseSuiteResults(html);
  assert.equal(result.green, 2);
  assert.equal(result.red, 1);
  assert.equal(result.neutral, 1);
  assert.equal(result.healthy, false);
});

test("parseSuiteResults with zero red and zero neutral is healthy", () => {
  const html = `<div style="background-color:#90ee90">pass</div>`;
  const result = parseSuiteResults(html);
  assert.equal(result.healthy, true);
});

test("CANARY_DIGITAL_LINK points at the real issued seal", () => {
  assert.equal(
    CANARY_DIGITAL_LINK,
    "https://id.authichain.com/01/09506000134352/21/GS1-CONFORMANCE-TEST"
  );
});
