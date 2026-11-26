// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import vectors from "../../shared/l402-vectors.json";
import {
  createL402Challenge,
  encodeIdentifier,
  grantCaveats,
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
  type L402Service,
} from "./l402";

const m = vectors.macaroon;
const rootKey = Buffer.from(m.rootKeyHex, "hex");
const grant = { ...m.grant, service: m.grant.service as L402Service, priceMsat: BigInt(m.grant.priceMsat) };

describe("shared vectors (shared/l402-vectors.json)", () => {
  it("prices USD in whole sats with integer math", () => {
    for (const p of vectors.pricing) {
      expect(usdAtomicToSats(p.priceAtomicUsd, p.btcUsdCents).toString()).toBe(p.sats);
    }
  });

  it("mints the vector macaroon byte for byte", () => {
    const mac = mintL402Macaroon({
      rootKey,
      location: m.location,
      paymentHash: Buffer.from(m.paymentHashHex, "hex"),
      tokenId: Buffer.from(m.tokenIdHex, "hex"),
      grant,
    });
    expect(mac.toString("base64")).toBe(m.macaroonBase64);
    expect(grantCaveats(grant)).toEqual(m.caveats);
    const id = encodeIdentifier(Buffer.from(m.paymentHashHex, "hex"), Buffer.from(m.tokenIdHex, "hex"));
    expect(id.toString("hex")).toBe(m.identifierHex);
    expect(macaroonSignature(rootKey, id, m.caveats).toString("hex")).toBe(m.signatureHex);
    expect(createHash("sha256").update(Buffer.from(m.preimageHex, "hex")).digest("hex")).toBe(m.paymentHashHex);
  });

  it.each(vectors.verify.map(v => [v.name, v] as const))("verify: %s", (_name, v) => {
    const got = verifyL402(v.authorization, {
      ...v.expect,
      service: v.expect.service as L402Service,
      rootKey: Buffer.from(v.rootKeyHex, "hex"),
    });
    if (v.result.ok) {
      expect(got).toMatchObject({ ok: true, paymentHash: v.result.paymentHash, validUntil: v.result.validUntil });
      expect(got.ok && got.priceMsat.toString()).toBe(v.result.priceMsat);
    } else {
      expect(got).toEqual({ ok: false, reason: (v.result as { reason: string }).reason });
    }
  });
});

describe("macaroon codec", () => {
  it("round-trips and rejects trailing bytes, third-party caveats and bad versions", () => {
    const bytes = Buffer.from(m.macaroonBase64, "base64");
    const parsed = parseMacaroon(bytes);
    expect(parsed && serializeMacaroon(parsed).equals(bytes)).toBe(true);
    expect(parseMacaroon(Buffer.concat([bytes, Buffer.from([0])]))).toBeNull();
    expect(parseMacaroon(Buffer.from([1, ...bytes.subarray(1)]))).toBeNull();
    expect(parseMacaroon(Buffer.alloc(0))).toBeNull();
    // a third-party caveat carries a vid field (type 4) before its EOS
    const id = Buffer.from(m.identifierHex, "hex");
    const thirdParty = Buffer.concat([
      Buffer.from([2, 2, id.length]), id, Buffer.from([0]),
      Buffer.from([2, 3]), Buffer.from("tp1"), Buffer.from([4, 1, 9, 0]),
      Buffer.from([0, 6, 32]), Buffer.alloc(32),
    ]);
    expect(parseMacaroon(thirdParty)).toBeNull();
  });
});

describe("challenge and pay round trip (test backend, no money)", () => {
  const base = {
    rootKey,
    location: "authichain.com",
    service: "signals" as const,
    capability: "evidence",
    resource: "/api/x402?tier=evidence",
    priceAtomicUsd: "100000",
    btcUsdCents: 9_000_000,
    nowSeconds: 1_767_225_000,
  };

  it("refuses a backend that cannot take money unless the caller opts in", async () => {
    await expect(createL402Challenge({ ...base, backend: testLightningBackend() })).rejects.toThrow(
      "l402_backend_not_live"
    );
  });

  it("issues a 10-minute challenge that verifies once paid", async () => {
    const backend = testLightningBackend();
    const ch = await createL402Challenge({ ...base, backend, allowTestBackend: true });
    expect(ch.sats).toBe(112n);
    expect(ch.validUntil).toBe(base.nowSeconds + 600);
    expect(ch.header).toBe(`L402 macaroon="${ch.macaroon}", invoice="${ch.invoice}"`);
    expect(ch.invoice.startsWith("test-invoice-not-payable:")).toBe(true);

    const preimage = backend.preimageFor(ch.paymentHash)!;
    const auth = `L402 ${ch.macaroon}:${preimage}`;
    expect(isL402Authorization(auth)).toBe(true);
    const ok = verifyL402(auth, { ...base, nowSeconds: base.nowSeconds + 30 });
    expect(ok).toMatchObject({ ok: true, paymentHash: ch.paymentHash, priceMsat: 112000n });
    expect(l402ReplayKey(ch.paymentHash.toUpperCase())).toBe(`l402:ph:${ch.paymentHash}`);

    // the same token does not open a different tier or resource
    expect(verifyL402(auth, { ...base, capability: "ping", nowSeconds: base.nowSeconds + 30 }).ok).toBe(false);
    expect(verifyL402(auth, { ...base, resource: "/api/x402?tier=ping", nowSeconds: base.nowSeconds + 30 }).ok).toBe(false);
  });

  it("caps the token lifetime at one hour", async () => {
    const ch = await createL402Challenge({ ...base, backend: testLightningBackend(), allowTestBackend: true, ttlSeconds: 86_400 });
    expect(ch.validUntil - base.nowSeconds).toBe(3600);
  });
});

describe("env helpers", () => {
  it("accepts only a 32+ byte hex root key", () => {
    expect(l402RootKey(undefined)).toBeNull();
    expect(l402RootKey("abcd")).toBeNull();
    expect(l402RootKey("zz".repeat(32))).toBeNull();
    expect(l402RootKey(m.rootKeyHex)?.equals(rootKey)).toBe(true);
  });

  it("only treats L402/LSAT schemes as L402", () => {
    expect(isL402Authorization("Bearer abc")).toBe(false);
    expect(isL402Authorization("L402")).toBe(false);
    expect(isL402Authorization("lsat abc:def")).toBe(true);
    expect(isL402Authorization(undefined)).toBe(false);
  });
});
