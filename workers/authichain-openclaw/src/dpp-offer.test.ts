import { test } from "node:test";
import assert from "node:assert/strict";
import { dppOfferReply, inboundDppOffer, isDppOfferText } from "./dpp-offer.ts";

test("exact DPP phrases map to the public confirm page", () => {
  assert.equal(isDppOfferText("dpp"), true);
  assert.equal(isDppOfferText("EU DPP?"), true);
  assert.equal(isDppOfferText("run dpp"), false);
  assert.equal(isDppOfferText("email claire"), false);
  const offer = dppOfferReply();
  assert.equal(offer.plan_id, "dpp_readiness");
  assert.equal(offer.price_usd, 299);
  assert.equal(offer.checkout_url, "https://authichain.com/checkout/dpp_readiness");
  assert.equal(offer.sends_mail, false);
  assert.equal(offer.opens_checkout_session, false);
  assert.match(offer.text, /EU DPP Workspace is a public offer at \$299/);
  assert.doesNotMatch(offer.text, /buy\.stripe\.com|mailto:|@/);
  assert.doesNotMatch(offer.text, /Readiness Audit/);
});

test("unknown chat does not get an offer", () => {
  assert.equal(inboundDppOffer("help"), null);
  assert.equal(inboundDppOffer("checkout strainchain_farm"), null);
});
