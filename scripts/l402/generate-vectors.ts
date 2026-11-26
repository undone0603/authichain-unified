/**
 * Regenerate shared/l402-vectors.json from fixed inputs:
 *   pnpm exec tsx scripts/l402/generate-vectors.ts > shared/l402-vectors.json
 * Every L402 implementation (TS workers, AgentZ Python, Dex) must pass these.
 */
import { createHash } from "node:crypto";
import {
  grantCaveats,
  macaroonSignature,
  mintL402Macaroon,
  encodeIdentifier,
  serializeMacaroon,
  usdAtomicToSats,
  verifyL402,
  type L402Grant,
} from "../../src/lib/l402";

const rootKey = Buffer.from("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", "hex");
const otherKey = Buffer.from("ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100", "hex");
const preimage = Buffer.from("0101010101010101010101010101010101010101010101010101010101010101", "hex");
const tokenId = Buffer.from("0202020202020202020202020202020202020202020202020202020202020202", "hex");
const paymentHash = createHash("sha256").update(preimage).digest();
const location = "authichain.com";
const grant: L402Grant = {
  service: "signals",
  capability: "ping",
  resource: "/api/x402?tier=ping",
  validUntil: 1767225600,
  priceMsat: 12000n,
};

const b64 = (b: Buffer) => b.toString("base64");
const auth = (mac: Buffer, pre = preimage, scheme = "L402") => `${scheme} ${b64(mac)}:${pre.toString("hex")}`;
const mac = mintL402Macaroon({ rootKey, location, paymentHash, tokenId, grant });
const identifier = encodeIdentifier(paymentHash, tokenId);
const caveats = grantCaveats(grant);

function resigned(extra: string[]): Buffer {
  const cav = [...caveats, ...extra];
  return serializeMacaroon({ location, identifier, caveats: cav, signature: macaroonSignature(rootKey, identifier, cav) });
}
function tampered(): Buffer {
  const cav = caveats.map(c => c.replace("capabilities=ping", "capabilities=evidence"));
  return serializeMacaroon({ location, identifier, caveats: cav, signature: macaroonSignature(rootKey, identifier, caveats) });
}

const expect = { service: grant.service, capability: grant.capability, resource: grant.resource, nowSeconds: grant.validUntil - 60 };
const cases: Array<{ name: string; authorization: string; expect: typeof expect; rootKey?: string }> = [
  { name: "valid", authorization: auth(mac), expect },
  { name: "valid_legacy_lsat_scheme", authorization: auth(mac, preimage, "LSAT"), expect },
  { name: "valid_base64url", authorization: `L402 ${mac.toString("base64url")}:${preimage.toString("hex")}`, expect },
  { name: "expired_at_valid_until", authorization: auth(mac), expect: { ...expect, nowSeconds: grant.validUntil } },
  { name: "wrong_capability", authorization: auth(mac), expect: { ...expect, capability: "evidence" } },
  { name: "wrong_resource", authorization: auth(mac), expect: { ...expect, resource: "/api/x402?tier=evidence" } },
  { name: "wrong_service", authorization: auth(mac), expect: { ...expect, service: "notary" } },
  { name: "wrong_preimage", authorization: auth(mac, Buffer.alloc(32, 3)), expect },
  { name: "tampered_caveat", authorization: auth(tampered()), expect },
  { name: "unknown_caveat", authorization: auth(resigned(["ip=203.0.113.7"])), expect },
  { name: "duplicate_caveat", authorization: auth(resigned(["services=signals:0"])), expect },
  { name: "other_root_key", authorization: auth(mac), expect, rootKey: otherKey.toString("hex") },
  { name: "malformed_no_preimage", authorization: `L402 ${b64(mac)}`, expect },
  { name: "malformed_scheme", authorization: `Bearer ${b64(mac)}:${preimage.toString("hex")}`, expect },
  { name: "bad_base64", authorization: `L402 !!notbase64!!:${preimage.toString("hex")}`, expect },
];

const out = {
  spec: "docs/strategy/LIGHTNING_L402.md",
  pricing: [
    [10000, 9000000], [50000, 9000000], [100000, 9000000],
    [10000, 1000000000], [1, 9000000], [50000, 6543210],
  ].map(([atomic, cents]) => ({ priceAtomicUsd: String(atomic), btcUsdCents: cents, sats: usdAtomicToSats(BigInt(atomic), BigInt(cents)).toString() })),
  macaroon: {
    rootKeyHex: rootKey.toString("hex"),
    location,
    preimageHex: preimage.toString("hex"),
    paymentHashHex: paymentHash.toString("hex"),
    tokenIdHex: tokenId.toString("hex"),
    grant: { ...grant, priceMsat: grant.priceMsat.toString() },
    resourceDigestHex: createHash("sha256").update(grant.resource).digest("hex"),
    caveats,
    identifierHex: identifier.toString("hex"),
    signatureHex: macaroonSignature(rootKey, identifier, caveats).toString("hex"),
    macaroonBase64: b64(mac),
  },
  verify: cases.map(c => {
    const v = verifyL402(c.authorization, { ...c.expect, rootKey: c.rootKey ? Buffer.from(c.rootKey, "hex") : rootKey });
    return {
      name: c.name,
      authorization: c.authorization,
      rootKeyHex: c.rootKey ?? rootKey.toString("hex"),
      expect: c.expect,
      result: v.ok ? { ok: true, paymentHash: v.paymentHash, validUntil: v.validUntil, priceMsat: v.priceMsat.toString() } : { ok: false, reason: v.reason },
    };
  }),
};
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
