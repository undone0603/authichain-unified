/**
 * @file l402.ts
 * L402: Lightning payments on the same HTTP 402 flow as x402.
 *
 * Spec and owner gates: docs/strategy/LIGHTNING_L402.md.
 *
 *   402 challenge  WWW-Authenticate: L402 macaroon="<base64>", invoice="<bolt11>"
 *   paid retry     Authorization: L402 <base64 macaroon>:<hex preimage>
 *
 * The macaroon is a standard V2 binary macaroon (the format Lightning Labs'
 * Aperture issues). Its identifier binds the invoice's payment hash; its
 * first-party caveats bind the service, the capability (tier), the exact
 * resource and an expiry. Paying the invoice reveals the preimage, so
 * sha256(preimage) == payment_hash proves payment without asking anyone.
 *
 * One token buys one call, like one x402 payment: the caller claims the
 * payment hash in the replay store (see l402ReplayKey) before serving.
 *
 * Pure helpers only. No backend is live until the owner picks one
 * (LIGHTNING_L402.md, "Owner gates"); testLightningBackend() never takes money.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const L402_IDENTIFIER_VERSION = 0;
export const L402_INVOICE_TTL_SECONDS = 600;
export const L402_MAX_TTL_SECONDS = 3600;
export const L402_SERVICES = ["signals", "notary", "dex"] as const;
export type L402Service = (typeof L402_SERVICES)[number];

const KEY_GENERATOR = Buffer.from("macaroons-key-generator", "utf8");
const FIELD_EOS = 0;
const FIELD_LOCATION = 1;
const FIELD_IDENTIFIER = 2;
// Field 4 (vid) marks a third-party caveat; the parser refuses any field
// other than EOS after a caveat identifier, so it never needs naming.
const FIELD_SIGNATURE = 6;
const HEX32 = /^[0-9a-f]{64}$/;

/* ------------------------------------------------------------------ prices */

/**
 * Whole sats for a USD price, from integers only so every implementation
 * agrees: atomic USD (6 decimals, as x402's usdToAtomic) and BTC/USD in
 * cents. sats = max(1, ceil(atomic * 10_000 / cents)).
 */
export function usdAtomicToSats(
  priceAtomic: string | bigint,
  btcUsdCents: number | bigint
): bigint {
  const atomic = BigInt(priceAtomic);
  const cents = BigInt(btcUsdCents);
  if (atomic <= 0n) throw new RangeError("price must be positive");
  if (cents <= 0n) throw new RangeError("btc price must be positive");
  const sats = (atomic * 10_000n + cents - 1n) / cents;
  return sats < 1n ? 1n : sats;
}

/* ------------------------------------------------------- macaroon V2 codec */

function varint(n: number): Buffer {
  const out: number[] = [];
  let v = n;
  do {
    let byte = v & 0x7f;
    v = Math.floor(v / 128);
    if (v > 0) byte |= 0x80;
    out.push(byte);
  } while (v > 0);
  return Buffer.from(out);
}

function field(type: number, data: Buffer): Buffer {
  return Buffer.concat([varint(type), varint(data.length), data]);
}

export type Macaroon = {
  location: string;
  identifier: Buffer;
  caveats: string[];
  signature: Buffer;
};

/** V2 binary serialization (first-party caveats only). */
export function serializeMacaroon(m: Macaroon): Buffer {
  const parts: Buffer[] = [Buffer.from([2])];
  if (m.location) parts.push(field(FIELD_LOCATION, Buffer.from(m.location)));
  parts.push(field(FIELD_IDENTIFIER, m.identifier), Buffer.from([FIELD_EOS]));
  for (const caveat of m.caveats) {
    parts.push(
      field(FIELD_IDENTIFIER, Buffer.from(caveat, "utf8")),
      Buffer.from([FIELD_EOS])
    );
  }
  parts.push(Buffer.from([FIELD_EOS]), field(FIELD_SIGNATURE, m.signature));
  return Buffer.concat(parts);
}

/** Strict V2 parser. Returns null on anything unexpected (third-party caveats included). */
export function parseMacaroon(bytes: Buffer): Macaroon | null {
  let i = 0;
  const readVarint = (): number | null => {
    let shift = 0;
    let value = 0;
    while (i < bytes.length && shift <= 28) {
      const b = bytes[i++];
      value += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) return value;
      shift += 7;
    }
    return null;
  };
  const readField = (): { type: number; data: Buffer } | null => {
    const type = readVarint();
    if (type === null) return null;
    if (type === FIELD_EOS) return { type, data: Buffer.alloc(0) };
    const len = readVarint();
    if (len === null || i + len > bytes.length) return null;
    const data = bytes.subarray(i, i + len);
    i += len;
    return { type, data };
  };
  if (bytes[i++] !== 2) return null;
  let f = readField();
  let location = "";
  if (f?.type === FIELD_LOCATION) {
    location = f.data.toString("utf8");
    f = readField();
  }
  if (f?.type !== FIELD_IDENTIFIER) return null;
  const identifier = Buffer.from(f.data);
  if (readField()?.type !== FIELD_EOS) return null;
  const caveats: string[] = [];
  for (;;) {
    f = readField();
    if (!f) return null;
    if (f.type === FIELD_EOS) break;
    if (f.type !== FIELD_IDENTIFIER) return null;
    caveats.push(f.data.toString("utf8"));
    const end = readField();
    if (end?.type !== FIELD_EOS) return null; // vid/location => third-party
  }
  f = readField();
  if (f?.type !== FIELD_SIGNATURE || f.data.length !== 32) return null;
  if (i !== bytes.length) return null;
  return { location, identifier, caveats, signature: Buffer.from(f.data) };
}

function hmac(key: Buffer, data: Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** Signature chain: HMAC(derive(rootKey), id), then HMAC(sig, caveat) per caveat. */
export function macaroonSignature(
  rootKey: Buffer,
  identifier: Buffer,
  caveats: readonly string[]
): Buffer {
  let sig = hmac(hmac(KEY_GENERATOR, rootKey), identifier);
  for (const caveat of caveats) sig = hmac(sig, Buffer.from(caveat, "utf8"));
  return sig;
}

/** Identifier: uint16 BE version 0 || payment_hash[32] || token_id[32]. */
export function encodeIdentifier(paymentHash: Buffer, tokenId: Buffer): Buffer {
  if (paymentHash.length !== 32 || tokenId.length !== 32) {
    throw new RangeError("payment hash and token id must be 32 bytes");
  }
  const version = Buffer.alloc(2);
  version.writeUInt16BE(L402_IDENTIFIER_VERSION);
  return Buffer.concat([version, paymentHash, tokenId]);
}

export function decodeIdentifier(
  id: Buffer
): { paymentHash: Buffer; tokenId: Buffer } | null {
  if (id.length !== 66 || id.readUInt16BE(0) !== L402_IDENTIFIER_VERSION) {
    return null;
  }
  return { paymentHash: id.subarray(2, 34), tokenId: id.subarray(34, 66) };
}

/* ---------------------------------------------------------------- caveats */

/** sha256 hex of the resource the token is bound to (path + query, no host). */
export function resourceDigest(resource: string): string {
  return createHash("sha256").update(resource, "utf8").digest("hex");
}

export type L402Grant = {
  service: L402Service;
  capability: string;
  resource: string;
  validUntil: number;
  priceMsat: bigint;
};

export function grantCaveats(g: L402Grant): string[] {
  return [
    `services=${g.service}:0`,
    `${g.service}_capabilities=${g.capability}`,
    `${g.service}_resource=${resourceDigest(g.resource)}`,
    `${g.service}_valid_until=${g.validUntil}`,
    `${g.service}_price_msat=${g.priceMsat}`,
  ];
}

/* --------------------------------------------------------------- backends */

export type LightningInvoice = { bolt11: string; paymentHash: string };

export interface LightningBackend {
  /** Short name shown in health output. */
  readonly name: string;
  /** False for anything that cannot take real money. */
  readonly live: boolean;
  createInvoice(input: {
    amountMsat: bigint;
    memo: string;
    expirySeconds: number;
  }): Promise<LightningInvoice>;
}

/**
 * In-memory backend for tests and local runs. Its "invoices" are not BOLT11
 * and cannot be paid; it hands the preimage to the test that asks for it.
 */
export function testLightningBackend(): LightningBackend & {
  preimageFor(paymentHash: string): string | undefined;
} {
  const preimages = new Map<string, string>();
  return {
    name: "test",
    live: false,
    async createInvoice({ amountMsat }) {
      const preimage = randomBytes(32);
      const paymentHash = createHash("sha256").update(preimage).digest("hex");
      preimages.set(paymentHash, preimage.toString("hex"));
      return {
        bolt11: `test-invoice-not-payable:${amountMsat}msat:${paymentHash}`,
        paymentHash,
      };
    },
    preimageFor: hash => preimages.get(hash),
  };
}

/* -------------------------------------------------------------- challenge */

export type L402Challenge = {
  header: string;
  macaroon: string;
  invoice: string;
  paymentHash: string;
  sats: bigint;
  validUntil: number;
  backend: string;
};

/** Mint the macaroon for an invoice. Deterministic given its inputs. */
export function mintL402Macaroon(input: {
  rootKey: Buffer;
  location: string;
  paymentHash: Buffer;
  tokenId: Buffer;
  grant: L402Grant;
}): Buffer {
  const identifier = encodeIdentifier(input.paymentHash, input.tokenId);
  const caveats = grantCaveats(input.grant);
  return serializeMacaroon({
    location: input.location,
    identifier,
    caveats,
    signature: macaroonSignature(input.rootKey, identifier, caveats),
  });
}

export function challengeHeader(macaroonB64: string, invoice: string): string {
  return `L402 macaroon="${macaroonB64}", invoice="${invoice}"`;
}

export async function createL402Challenge(input: {
  rootKey: Buffer;
  backend: LightningBackend;
  location: string;
  service: L402Service;
  capability: string;
  resource: string;
  priceAtomicUsd: string | bigint;
  btcUsdCents: number | bigint;
  nowSeconds: number;
  ttlSeconds?: number;
  /** Required to mint against a backend that cannot take money. */
  allowTestBackend?: boolean;
}): Promise<L402Challenge> {
  if (!input.backend.live && !input.allowTestBackend) {
    throw new Error("l402_backend_not_live");
  }
  if (input.rootKey.length < 32) throw new RangeError("root key too short");
  const ttl = Math.min(
    input.ttlSeconds ?? L402_INVOICE_TTL_SECONDS,
    L402_MAX_TTL_SECONDS
  );
  const sats = usdAtomicToSats(input.priceAtomicUsd, input.btcUsdCents);
  const invoice = await input.backend.createInvoice({
    amountMsat: sats * 1000n,
    memo: `${input.service}:${input.capability}`,
    expirySeconds: ttl,
  });
  if (!HEX32.test(invoice.paymentHash)) throw new Error("bad payment hash");
  const validUntil = input.nowSeconds + ttl;
  const macaroon = mintL402Macaroon({
    rootKey: input.rootKey,
    location: input.location,
    paymentHash: Buffer.from(invoice.paymentHash, "hex"),
    tokenId: randomBytes(32),
    grant: {
      service: input.service,
      capability: input.capability,
      resource: input.resource,
      validUntil,
      priceMsat: sats * 1000n,
    },
  }).toString("base64");
  return {
    header: challengeHeader(macaroon, invoice.bolt11),
    macaroon,
    invoice: invoice.bolt11,
    paymentHash: invoice.paymentHash,
    sats,
    validUntil,
    backend: input.backend.name,
  };
}

/* ----------------------------------------------------------------- verify */

export type L402Verdict =
  | {
      ok: true;
      paymentHash: string;
      service: L402Service;
      capability: string;
      validUntil: number;
      priceMsat: bigint;
    }
  | { ok: false; reason: string };

/** True when an Authorization header carries an L402 (or legacy LSAT) token. */
export function isL402Authorization(header: string | null | undefined): boolean {
  return /^(L402|LSAT)\s+\S/i.test((header ?? "").trim());
}

function decodeBase64(text: string): Buffer | null {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return null;
  const std = text.replace(/-/g, "+").replace(/_/g, "/");
  const buf = Buffer.from(std, "base64");
  return buf.length ? buf : null;
}

/**
 * Check an `Authorization: L402 <macaroon>:<preimage>` header against the
 * request it is presented with. Fails closed: an unknown caveat is a refusal.
 * Replay is the caller's job (l402ReplayKey), after this returns ok.
 */
export function verifyL402(
  authorization: string,
  expect: {
    rootKey: Buffer;
    service: L402Service;
    capability: string;
    resource: string;
    nowSeconds: number;
  }
): L402Verdict {
  const m = /^(?:L402|LSAT)\s+(\S+)$/i.exec((authorization ?? "").trim());
  if (!m) return { ok: false, reason: "l402_malformed" };
  const sep = m[1].lastIndexOf(":");
  if (sep < 1) return { ok: false, reason: "l402_malformed" };
  const preimageHex = m[1].slice(sep + 1).toLowerCase();
  if (!HEX32.test(preimageHex)) return { ok: false, reason: "l402_bad_preimage" };
  const raw = decodeBase64(m[1].slice(0, sep));
  const mac = raw ? parseMacaroon(raw) : null;
  if (!mac) return { ok: false, reason: "l402_bad_macaroon" };

  const expected = macaroonSignature(expect.rootKey, mac.identifier, mac.caveats);
  if (!timingSafeEqual(expected, mac.signature)) {
    return { ok: false, reason: "l402_bad_signature" };
  }
  const id = decodeIdentifier(mac.identifier);
  if (!id) return { ok: false, reason: "l402_bad_identifier" };
  const paid = createHash("sha256").update(Buffer.from(preimageHex, "hex")).digest();
  if (!timingSafeEqual(paid, id.paymentHash)) {
    return { ok: false, reason: "l402_preimage_mismatch" };
  }

  const s = expect.service;
  const want = new Map<string, string>([
    ["services", `${s}:0`],
    [`${s}_capabilities`, expect.capability],
    [`${s}_resource`, resourceDigest(expect.resource)],
  ]);
  let validUntil: number | null = null;
  let priceMsat: bigint | null = null;
  const seen = new Set<string>();
  for (const caveat of mac.caveats) {
    const eq = caveat.indexOf("=");
    if (eq < 1) return { ok: false, reason: "l402_bad_caveat" };
    const key = caveat.slice(0, eq);
    const value = caveat.slice(eq + 1);
    if (seen.has(key)) return { ok: false, reason: "l402_duplicate_caveat" };
    seen.add(key);
    if (want.has(key)) {
      if (want.get(key) !== value) return { ok: false, reason: `l402_wrong_${key}` };
    } else if (key === `${s}_valid_until`) {
      if (!/^\d{1,12}$/.test(value)) return { ok: false, reason: "l402_bad_caveat" };
      validUntil = Number(value);
    } else if (key === `${s}_price_msat`) {
      if (!/^\d{1,18}$/.test(value)) return { ok: false, reason: "l402_bad_caveat" };
      priceMsat = BigInt(value);
    } else {
      return { ok: false, reason: "l402_unknown_caveat" };
    }
  }
  for (const key of want.keys()) {
    if (!seen.has(key)) return { ok: false, reason: `l402_missing_${key}` };
  }
  if (validUntil === null || priceMsat === null) {
    return { ok: false, reason: "l402_missing_caveat" };
  }
  if (expect.nowSeconds >= validUntil) return { ok: false, reason: "l402_expired" };
  return {
    ok: true,
    paymentHash: id.paymentHash.toString("hex"),
    service: s,
    capability: expect.capability,
    validUntil,
    priceMsat,
  };
}

/** Replay-store key for one Lightning payment. */
export function l402ReplayKey(paymentHash: string): string {
  return `l402:ph:${paymentHash.toLowerCase()}`;
}

/** Root key from a hex env binding; null when unset or shorter than 32 bytes. */
export function l402RootKey(hex: string | undefined): Buffer | null {
  const clean = (hex ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64,}$/.test(clean) || clean.length % 2) return null;
  return Buffer.from(clean, "hex");
}
