/**
 * Generation seal — drop into authichain-unified as src/lib/generation-seal.ts
 *
 * Vision step: a Starter generation gets a SPEC v0.1 Ed25519 record a stranger
 * can check offline. It is not a product attestation and it is not anchored.
 * attestSeal() already returns unsigned when proof is missing. This module
 * is the issuer side that was missing.
 *
 * Verdict contract (protocol/SPEC.md §5.1):
 *   valid-unanchored  signature checks, no anchor
 *   verified          forbidden here — anchoring is a separate prod step
 *   invalid           bad signature, future validFrom, or a product claim
 *
 * Workers: WebCrypto only. No node:crypto. Issuer key is a secret
 * (ISSUER_ED25519_PKCS8_B64). Do not commit it.
 */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export type GenerationClaim = "artwork_only";

export type GenerationInput = {
  id: string;
  destinationUrl: string;
  imageSha256: string;
  planId: "starter" | "qron_launch" | "creator" | "free";
  issuedAt: string;
};

export type ProtocolRecord = {
  "@context": string[];
  type: string[];
  issuer: string;
  validFrom: string;
  credentialSubject: {
    id: string;
    claim: GenerationClaim;
    destinationUrl: string;
    imageSha256: string;
    planId: string;
    statement: string;
  };
  proof: {
    type: "Ed25519Signature2020";
    created: string;
    verificationMethod: string;
    proofPurpose: "assertionMethod";
    proofValue: string;
  };
};

export type SealResult = {
  record: ProtocolRecord;
  verdict: "valid-unanchored";
  verifyUrl: string;
  qrPayload: string;
  reasons: string[];
};

const STATEMENT =
  "This record signs that an image was generated. It is not an authenticity verdict for a physical product.";

export function verifyUrlFor(id: string): string {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) {
    throw new Error("generation id must be 8-80 url-safe chars");
  }
  return `https://authichain.com/verify/generation/${id}`;
}

function bytesToB58(bytes: Uint8Array): string {
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

function b58ToBytes(value: string): Uint8Array {
  let bytes = [0];
  for (const char of value) {
    const n = B58.indexOf(char);
    if (n < 0) throw new Error("bad base58");
    let carry = n;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  for (const char of value) {
    if (char !== "1") break;
    zeros++;
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i];
  return out;
}

/** RFC 8785 for string-only objects. Rejects numbers so JCS number rules cannot drift. */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") throw new Error("numbers are not signed");
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
  }
  throw new Error("unsupported canonical type");
}

function unsigned(record: ProtocolRecord): Record<string, unknown> {
  const { proofValue: _drop, ...proof } = record.proof;
  return { ...record, proof };
}

export function didKeyFromPublic(raw: Uint8Array): string {
  if (raw.length !== 32) throw new Error("ed25519 public key must be 32 bytes");
  const prefixed = new Uint8Array(34);
  prefixed[0] = 0xed;
  prefixed[1] = 0x01;
  prefixed.set(raw, 2);
  return `did:key:z${bytesToB58(prefixed)}`;
}

export async function importIssuer(pkcs8B64: string): Promise<CryptoKeyPair> {
  const der = Uint8Array.from(atob(pkcs8B64), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "Ed25519" },
    true,
    ["sign"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  if (!jwk.x) throw new Error("issuer jwk missing x");
  const raw = Uint8Array.from(atob(jwk.x.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "Ed25519" },
    true,
    ["verify"]
  );
  return { privateKey, publicKey };
}

export async function issueGenerationSeal(
  input: GenerationInput,
  issuer: CryptoKeyPair
): Promise<SealResult> {
  let dest: URL;
  try {
    dest = new URL(input.destinationUrl);
  } catch {
    throw new Error("destinationUrl must be absolute");
  }
  if (dest.protocol !== "https:") throw new Error("destinationUrl must be https");
  if (!/^[a-f0-9]{64}$/.test(input.imageSha256)) {
    throw new Error("imageSha256 must be 64 hex chars");
  }
  const publicJwk = await crypto.subtle.exportKey("jwk", issuer.publicKey);
  if (!publicJwk.x) throw new Error("public jwk missing x");
  const raw = Uint8Array.from(
    atob(publicJwk.x.replace(/-/g, "+").replace(/_/g, "/")),
    c => c.charCodeAt(0)
  );
  const did = didKeyFromPublic(raw);
  const verifyUrl = verifyUrlFor(input.id);
  const record: ProtocolRecord = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://authichain.com/protocol/v1",
    ],
    type: ["VerifiableCredential", "GenerationRecord"],
    issuer: did,
    validFrom: input.issuedAt,
    credentialSubject: {
      id: verifyUrl,
      claim: "artwork_only",
      destinationUrl: dest.toString(),
      imageSha256: input.imageSha256,
      planId: input.planId,
      statement: STATEMENT,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: input.issuedAt,
      verificationMethod: `${did}#${did.slice("did:key:".length)}`,
      proofPurpose: "assertionMethod",
      proofValue: "",
    },
  };
  const payload = new TextEncoder().encode(canonicalize(unsigned(record)));
  const sig = new Uint8Array(
    await crypto.subtle.sign("Ed25519", issuer.privateKey, payload)
  );
  record.proof.proofValue = `z${bytesToB58(sig)}`;
  const verdict = await checkGenerationSeal(record, issuer.publicKey);
  if (verdict.verdict !== "valid-unanchored") {
    throw new Error(`issuer produced ${verdict.verdict}`);
  }
  return {
    record,
    verdict: "valid-unanchored",
    verifyUrl,
    qrPayload: verifyUrl,
    reasons: verdict.reasons,
  };
}

export async function checkGenerationSeal(
  record: ProtocolRecord,
  publicKey: CryptoKey
): Promise<{ verdict: "valid-unanchored" | "invalid"; reasons: string[] }> {
  const reasons: string[] = [];
  if (record.credentialSubject.claim !== "artwork_only") {
    return { verdict: "invalid", reasons: ["product_claim_refused"] };
  }
  if (record.type.includes("ProvenanceRecord")) {
    return { verdict: "invalid", reasons: ["provenance_type_refused"] };
  }
  if (Date.parse(record.validFrom) > Date.now() + 60_000) {
    return { verdict: "invalid", reasons: ["valid_from_in_future"] };
  }
  const proofValue = record.proof.proofValue;
  if (!proofValue.startsWith("z")) return { verdict: "invalid", reasons: ["proof_encoding"] };
  const sig = b58ToBytes(proofValue.slice(1));
  const payload = new TextEncoder().encode(canonicalize(unsigned(record)));
  const ok = await crypto.subtle.verify("Ed25519", publicKey, sig, payload);
  if (!ok) return { verdict: "invalid", reasons: ["bad_signature"] };
  reasons.push("signature_valid", "no_anchor", "not_a_product_attestation");
  return { verdict: "valid-unanchored", reasons };
}

export function resolveBody(seal: SealResult | null): {
  status: "signature_valid" | "signature_not_checked";
  headline: string;
  verifyUrl: string | null;
} {
  if (!seal) {
    return {
      status: "signature_not_checked",
      headline: "This is artwork. It is not an authenticity verdict.",
      verifyUrl: null,
    };
  }
  return {
    status: "signature_valid",
    headline: "Signature checks. This is artwork, not an authenticity verdict.",
    verifyUrl: seal.verifyUrl,
  };
}
