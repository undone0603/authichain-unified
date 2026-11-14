#!/usr/bin/env node
// Issue and check the signed attestation in a Made in USA claim file.
//
//   node scripts/musa/claim-attestation.mjs issue <input.json> [--out record.json]
//   node scripts/musa/claim-attestation.mjs verify <record.json> --expect-issuer <did:key:...>
//
// issue reads the signing key from ISSUER_ED25519_PKCS8_B64 and hashes each
// evidence file named in the input. The attestation says who issued a record
// and that it has not changed. It never says a product qualifies as Made in USA.
//
// Format follows protocol/SPEC.md: Ed25519 over canonical JSON with
// proof.proofValue removed. A did:key verifies against itself, so a verifier
// has to compare the issuer with the one AuthiChain publishes.

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_MULTICODEC = [0xed, 0x01];
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const STATEMENT =
  "AuthiChain issued this record on the stated date and it has not changed since. It lists the evidence held for one SKU's origin claim. It is not a certification, a legal opinion or a finding that the product qualifies as Made in USA.";

export function canonicalize(value) {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("unsupported number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
  }
  throw new Error("unsupported canonical type");
}

function toB58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

function fromB58(text) {
  let n = 0n;
  for (const ch of text) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  let hex = n === 0n ? "" : n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let zeros = 0;
  while (text[zeros] === "1") zeros += 1;
  return Buffer.concat([Buffer.alloc(zeros), Buffer.from(hex, "hex")]);
}

export function didFromPublicKey(publicKey) {
  const spki = publicKey.export({ type: "spki", format: "der" });
  const raw = spki.subarray(ED25519_SPKI_PREFIX.length);
  return `did:key:z${toB58(Buffer.concat([Buffer.from(ED25519_MULTICODEC), raw]))}`;
}

function publicKeyFromDid(did) {
  if (!did.startsWith("did:key:z")) throw new Error("issuer is not a did:key");
  const bytes = fromB58(did.slice("did:key:z".length));
  if (bytes[0] !== 0xed || bytes[1] !== 0x01 || bytes.length !== 34) {
    throw new Error("issuer is not an Ed25519 did:key");
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, bytes.subarray(2)]),
    format: "der",
    type: "spki",
  });
}

function unsignedBytes(record) {
  const { proofValue: _drop, ...proof } = record.proof;
  return Buffer.from(canonicalize({ ...record, proof }), "utf8");
}

/** Pure given its inputs. `evidence` entries already carry their sha256. */
export function issueRecord(input, privateKey, now = new Date()) {
  for (const field of ["id", "sku", "company", "claimWording"]) {
    if (typeof input[field] !== "string" || !input[field].trim()) {
      throw new Error(`input.${field} is required`);
    }
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error("input.evidence needs at least one file");
  }
  const openItems = input.openItems ?? [];
  if (!Array.isArray(openItems)) {
    throw new Error("input.openItems must be a list");
  }

  const issuer = didFromPublicKey(createPublicKey(privateKey));
  const issuedAt = now.toISOString();
  const record = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "MadeInUsaClaimFileAttestation"],
    issuer,
    validFrom: issuedAt,
    credentialSubject: {
      id: input.id,
      sku: input.sku,
      company: input.company,
      claimWording: input.claimWording,
      evidence: input.evidence.map(({ name, sha256 }) => ({ name, sha256 })),
      openItems,
      statement: STATEMENT,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: issuedAt,
      verificationMethod: `${issuer}#${issuer.slice("did:key:".length)}`,
      proofPurpose: "assertionMethod",
    },
  };
  const signature = sign(null, unsignedBytes(record), privateKey);
  record.proof.proofValue = `z${toB58(signature)}`;
  return record;
}

/** Returns { ok, reasons }. Fails closed on anything it can't confirm. */
export function verifyRecord(record, { expectIssuer } = {}) {
  const reasons = [];
  try {
    if (!expectIssuer) {
      reasons.push("no expected issuer given: a did:key only proves itself");
    } else if (record.issuer !== expectIssuer) {
      reasons.push("issuer is not the expected issuer");
    }
    if (record.credentialSubject?.statement !== STATEMENT) {
      reasons.push("statement differs from the required wording");
    }
    const value = record.proof?.proofValue;
    if (typeof value !== "string" || !value.startsWith("z")) {
      reasons.push("missing proofValue");
    } else if (
      !verify(
        null,
        unsignedBytes(record),
        publicKeyFromDid(record.issuer),
        fromB58(value.slice(1))
      )
    ) {
      reasons.push("signature does not match");
    }
  } catch (err) {
    reasons.push(`could not verify: ${err.message}`);
  }
  return { ok: reasons.length === 0, reasons };
}

function loadPrivateKey() {
  const b64 = process.env.ISSUER_ED25519_PKCS8_B64;
  if (!b64) throw new Error("ISSUER_ED25519_PKCS8_B64 is not set");
  return createPrivateKey({
    key: Buffer.from(b64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function main(argv) {
  const [command, file, ...rest] = argv;
  if (command === "issue" && file) {
    const input = JSON.parse(readFileSync(file, "utf8"));
    const base = path.dirname(path.resolve(file));
    input.evidence = (input.evidence ?? []).map(name => ({
      name,
      sha256: createHash("sha256")
        .update(readFileSync(path.resolve(base, name)))
        .digest("hex"),
    }));
    const text = `${JSON.stringify(issueRecord(input, loadPrivateKey()), null, 2)}\n`;
    const out = flag(rest, "--out");
    if (out) writeFileSync(out, text);
    else process.stdout.write(text);
    return 0;
  }
  if (command === "verify" && file) {
    const result = verifyRecord(JSON.parse(readFileSync(file, "utf8")), {
      expectIssuer: flag(rest, "--expect-issuer"),
    });
    console.log(result.ok ? "valid" : `invalid: ${result.reasons.join("; ")}`);
    return result.ok ? 0 : 1;
  }
  console.error(
    "usage: claim-attestation.mjs issue <input.json> [--out file] | verify <record.json> --expect-issuer <did>"
  );
  return 2;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
