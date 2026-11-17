import assert from "node:assert/strict";
import test from "node:test";
import { FIXTURE_TOOLS, fixtureReply, buildFixtureServer } from "./glama-inspector-fixture.mjs";

test("inspector fixture only exposes two synthetic, read-only tools", () => {
  assert.deepEqual(FIXTURE_TOOLS.map(tool => tool.name), ["get_pricing", "negotiate"]);
  for (const tool of FIXTURE_TOOLS) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.openWorldHint, false);
    assert.match(tool.description, /Fixture only/i);
  }
  assert.doesNotThrow(() => buildFixtureServer());
});

test("fixture quote can never authorize a charge or imply production fulfillment", () => {
  for (const [name, args] of [
    ["get_pricing", {}],
    ["negotiate", { service: "verify_record", mode: "quote_only" }],
    ["negotiate", { service: "verify_record" }],
  ]) {
    const value = fixtureReply(name, args);
    assert.equal(value.fixture, true);
    assert.equal(value.production, false);
    assert.equal(value.price_usd, 0);
    assert.equal(value.payment_authorized, false);
    assert.equal(value.settled, false);
    assert.equal(value.side_effects, false);
  }
});

test("fixture declines all paid, unknown, and binding operations", () => {
  for (const [name, args] of [
    ["verify", { sealId: "00000000-0000-4000-8000-000000000000" }],
    ["negotiate", { service: "verify", mode: "quote_only" }],
    ["negotiate", { service: "verify_record", mode: "accept" }],
    ["negotiate", { service: "verify_record", mode: "quote_only", payment: "secret" }],
    ["mint_certificate", { productId: 1 }],
  ]) {
    const value = fixtureReply(name, args);
    assert.equal(value.error, "unsupported_fixture_request");
    assert.equal(value.payment_authorized, false);
    assert.equal(value.settled, false);
    assert.equal(value.side_effects, false);
  }
});
