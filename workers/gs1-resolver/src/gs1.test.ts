import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGtin,
  isValidYyMmDd,
  parseGs1Path,
  toDigitalLink,
  lookupKey,
  hasResolvableId,
  isResolverPath,
} from "./gs1.ts";

test("normalizeGtin pads valid lengths to GTIN-14 and rejects others", () => {
  assert.equal(normalizeGtin("9506000149301"), "09506000149301");
  assert.equal(normalizeGtin("09506000149301"), "09506000149301");
  assert.equal(normalizeGtin("12345678"), "00000012345678");
  assert.equal(normalizeGtin("123"), null);
  assert.equal(normalizeGtin(""), null);
});

test("isValidYyMmDd accepts YYMMDD and rejects impossible months/days", () => {
  assert.equal(isValidYyMmDd("270218"), true);
  assert.equal(isValidYyMmDd("271301"), false, "month 13");
  assert.equal(isValidYyMmDd("270232"), false, "day 32");
  assert.equal(isValidYyMmDd("27021"), false, "too short");
});

test("parseGs1Path reads GTIN + lot + serial from the path", () => {
  const f = parseGs1Path("/01/09506000149301/10/LOT-A/21/SN-1", "");
  assert.equal(f.gtin, "09506000149301");
  assert.equal(f.lot, "LOT-A");
  assert.equal(f.serial, "SN-1");
});

test("parseGs1Path handles the /cert/ form and percent-encoding", () => {
  const f = parseGs1Path("/cert/AC%2F0001", "");
  assert.equal(f.certId, "AC/0001");
  assert.equal(f.gtin, undefined);
});

test("parseGs1Path merges query-string AIs and drops malformed dates", () => {
  const f = parseGs1Path("/01/09506000149301", "?17=270218&11=271345&22=BLUE");
  assert.equal(f.expiry, "270218");
  assert.equal(f.prodDate, undefined, "invalid prodDate must be dropped, not stored");
  assert.equal(f.variant, "BLUE");
});

test("lookupKey prefers the most specific identifier available", () => {
  assert.equal(
    lookupKey(parseGs1Path("/01/09506000149301/21/SN-1", "")),
    "gtin:09506000149301:ser:SN-1",
  );
  assert.equal(
    lookupKey(parseGs1Path("/01/09506000149301/10/LOT-A", "")),
    "gtin:09506000149301:lot:LOT-A",
  );
  assert.equal(lookupKey(parseGs1Path("/01/09506000149301", "")), "gtin:09506000149301");
  assert.equal(lookupKey(parseGs1Path("/cert/AC-1", "")), "cert:ac-1");
});

test("toDigitalLink round-trips a parsed path", () => {
  const f = parseGs1Path("/01/09506000149301/21/SN-1", "?17=270218");
  assert.equal(
    toDigitalLink("https://id.authichain.com/", f),
    "https://id.authichain.com/01/09506000149301/21/SN-1?17=270218",
  );
});

test("hasResolvableId and isResolverPath gate non-resolver traffic", () => {
  assert.equal(hasResolvableId(parseGs1Path("/01/09506000149301", "")), true);
  assert.equal(hasResolvableId(parseGs1Path("/10/LOT-ONLY", "")), false, "lot alone is not resolvable");
  assert.equal(isResolverPath("/01/09506000149301"), true);
  assert.equal(isResolverPath("/cert/AC-1"), true);
  assert.equal(isResolverPath("/favicon.ico"), false);
});
