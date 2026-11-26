// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createL402Challenge,
  isL402Authorization,
  l402ReplayKey,
  l402RootKey,
  macaroonSignature,
  mintL402Macaroon,
  parseMacaroon,
  serializeMacaroon,
  testLightningBackend,
  usdAtomicToSats,
  verifyL402,
  type L402Grant,
} from "./l402";

// Fixed inputs. MACAROON is what pymacaroons mints from the same inputs, byte
// for byte (checked when this format was chosen), so it is the standard V2 format.
const ROOT = Buffer.from("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", "hex");
const PREIMAGE = Buffer.alloc(32, 1);
const TOKEN_ID = Buffer.alloc(32, 2);
const HASH = createHash("sha256").update(PREIMAGE).digest();
const GRANT: L402Grant = {
  service: "signals",
  capability: "ping",
  resource: "/api/x402?tier=ping",
  validUntil: 1_767_225_600,
  priceMsat: 12_000n,
};
const MACAROON =
  "AgEOYXV0aGljaGFpbi5jb20CQgAAcs1uhCLEB/ttCYaQ8RMLfe1+wvf14dML2dUh8BU2N5MCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgACEnNlcnZpY2VzPXNpZ25hbHM6MAACGXNpZ25hbHNfY2FwYWJpbGl0aWVzPXBpbmcAAlFzaWduYWxzX3Jlc291cmNlPWNlODIyNmYyNThlNzIyNTBmZDE1M2NmYzI3ZTI4MWQ0ODljMWUxMWM1NTdiMDQwMGM5ZGYyMjBmMTJkNzRlOTIAAh5zaWduYWxzX3ZhbGlkX3VudGlsPTE3NjcyMjU2MDAAAhhzaWduYWxzX3ByaWNlX21zYXQ9MTIwMDAAAAYgsfTxbzbJDqlhvaS0w7LQsHZvcFRjh+zgD3lMXjPoLcs=";

const mac = Buffer.from(MACAROON, "base64");
const auth = (m: Buffer = mac, pre: Buffer = PREIMAGE, scheme = "L402") =>
  `${scheme} ${m.toString("base64")}:${pre.toString("hex")}`;
const expect402 = { rootKey: ROOT, service: "signals" as const, capability: "ping", resource: GRANT.resource, nowSeconds: GRANT.validUntil - 60 };

/** Same identifier, different caveats, signed (or not) with ROOT. */
function variant(caveats: string[], signWith: string[] = caveats): Buffer {
  const parsed = parseMacaroon(mac)!;
  return serializeMacaroon({ ...parsed, caveats, signature: macaroonSignature(ROOT, parsed.identifier, signWith) });
}

describe("token format", () => {
  it("mints the standard V2 macaroon, byte for byte", () => {
    const minted = mintL402Macaroon({ rootKey: ROOT, location: "authichain.com", paymentHash: HASH, tokenId: TOKEN_ID, grant: GRANT });
    expect(minted.toString("base64")).toBe(MACAROON);
    expect(serializeMacaroon(parseMacaroon(mac)!).equals(mac)).toBe(true);
  });

  it("rejects trailing bytes, other versions and third-party caveats", () => {
    expect(parseMacaroon(Buffer.concat([mac, Buffer.from([0])]))).toBeNull();
    expect(parseMacaroon(Buffer.from([1, ...mac.subarray(1)]))).toBeNull();
    expect(parseMacaroon(Buffer.alloc(0))).toBeNull();
    const id = parseMacaroon(mac)!.identifier;
    const thirdParty = Buffer.concat([
      Buffer.from([2, 2, id.length]), id, Buffer.from([0]),
      Buffer.from([2, 3]), Buffer.from("tp1"), Buffer.from([4, 1, 9, 0]),
      Buffer.from([0, 6, 32]), Buffer.alloc(32),
    ]);
    expect(parseMacaroon(thirdParty)).toBeNull();
  });
});

describe("verifyL402", () => {
  const caveats = parseMacaroon(mac)!.caveats;
  it.each([
    ["valid", auth(), expect402, null],
    ["legacy LSAT scheme", auth(mac, PREIMAGE, "LSAT"), expect402, null],
    ["base64url", `L402 ${mac.toString("base64url")}:${PREIMAGE.toString("hex")}`, expect402, null],
    ["expired at valid_until", auth(), { ...expect402, nowSeconds: GRANT.validUntil }, "l402_expired"],
    ["another tier", auth(), { ...expect402, capability: "evidence" }, "l402_wrong_signals_capabilities"],
    ["another resource", auth(), { ...expect402, resource: "/api/x402?tier=evidence" }, "l402_wrong_signals_resource"],
    ["another service", auth(), { ...expect402, service: "notary" as const }, "l402_wrong_services"],
    ["wrong preimage", auth(mac, Buffer.alloc(32, 3)), expect402, "l402_preimage_mismatch"],
    ["tampered caveat", auth(variant(caveats.map(c => c.replace("=ping", "=evidence")), caveats)), expect402, "l402_bad_signature"],
    ["unknown caveat", auth(variant([...caveats, "ip=203.0.113.7"])), expect402, "l402_unknown_caveat"],
    ["duplicate caveat", auth(variant([...caveats, "services=signals:0"])), expect402, "l402_duplicate_caveat"],
    ["other root key", auth(), { ...expect402, rootKey: Buffer.alloc(32, 9) }, "l402_bad_signature"],
    ["no preimage", `L402 ${MACAROON}`, expect402, "l402_malformed"],
    ["other scheme", `Bearer ${MACAROON}:${PREIMAGE.toString("hex")}`, expect402, "l402_malformed"],
    ["bad base64", `L402 !!x!!:${PREIMAGE.toString("hex")}`, expect402, "l402_bad_macaroon"],
  ])("%s", (_name, header, want, reason) => {
    const got = verifyL402(header, want);
    if (reason === null) {
      expect(got).toMatchObject({ ok: true, paymentHash: HASH.toString("hex"), validUntil: GRANT.validUntil, priceMsat: 12_000n });
    } else {
      expect(got).toEqual({ ok: false, reason });
    }
  });
});

describe("prices", () => {
  it.each([
    [10_000, 9_000_000, 12n],
    [50_000, 9_000_000, 56n],
    [100_000, 9_000_000, 112n],
    [10_000, 1_000_000_000, 1n],
    [1, 9_000_000, 1n],
  ])("%i atomic USD at %i cents/BTC is %i sats", (atomic, cents, sats) => {
    expect(usdAtomicToSats(BigInt(atomic), cents)).toBe(sats);
  });
});

describe("challenge and pay round trip (test backend, no money)", () => {
  const base = {
    rootKey: ROOT,
    location: "authichain.com",
    service: "signals" as const,
    capability: "evidence",
    resource: "/api/x402?tier=evidence",
    priceAtomicUsd: "100000",
    btcUsdCents: 9_000_000,
    nowSeconds: 1_767_225_000,
  };

  it("refuses a backend that cannot take money unless the caller opts in", async () => {
    await expect(createL402Challenge({ ...base, backend: testLightningBackend() })).rejects.toThrow("l402_backend_not_live");
  });

  it("issues a 10-minute challenge that verifies once paid, for that tier only", async () => {
    const backend = testLightningBackend();
    const ch = await createL402Challenge({ ...base, backend, allowTestBackend: true });
    expect(ch.sats).toBe(112n);
    expect(ch.validUntil).toBe(base.nowSeconds + 600);
    expect(ch.header).toBe(`L402 macaroon="${ch.macaroon}", invoice="${ch.invoice}"`);
    const header = `L402 ${ch.macaroon}:${backend.preimageFor(ch.paymentHash)}`;
    expect(isL402Authorization(header)).toBe(true);
    expect(verifyL402(header, { ...base, nowSeconds: base.nowSeconds + 30 })).toMatchObject({ ok: true, priceMsat: 112_000n });
    expect(verifyL402(header, { ...base, capability: "ping", nowSeconds: base.nowSeconds + 30 }).ok).toBe(false);
    expect(l402ReplayKey(ch.paymentHash.toUpperCase())).toBe(`l402:ph:${ch.paymentHash}`);
  });

  it("caps the token lifetime at one hour", async () => {
    const ch = await createL402Challenge({ ...base, backend: testLightningBackend(), allowTestBackend: true, ttlSeconds: 86_400 });
    expect(ch.validUntil - base.nowSeconds).toBe(3600);
  });
});

describe("env helpers", () => {
  it("accepts only a 32+ byte hex root key and only L402/LSAT schemes", () => {
    expect(l402RootKey(undefined)).toBeNull();
    expect(l402RootKey("abcd")).toBeNull();
    expect(l402RootKey(ROOT.toString("hex"))?.equals(ROOT)).toBe(true);
    expect(isL402Authorization("Bearer abc")).toBe(false);
    expect(isL402Authorization("lsat abc:def")).toBe(true);
  });
});
