// scripts/autonomy/protocol-gates.mjs
//
// Evidence collectors and pure evaluators for the protocol launch gates
// (tracking #1987; Gate 3 = #1991, protocol conformance part of #1996).
//
// Round trip: an INDEPENDENT signer (local Ed25519 + did:key + RFC 8785 JCS,
// deliberately not imported from the verifier) builds fresh canary records, and
// the SHIPPED protocol/verifier.mjs has to judge them. If the verifier ever
// diverges on canonicalisation, accepts a tampered record, or stops enforcing
// anchors, a check fails and the gate fails. Nothing here contacts a server.
//
// FAIL CLOSED: a required check that is missing or not ok fails the gate.

import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign as edSign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PROTOCOL_DIR = join(ROOT, "protocol");

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58encode(buf) {
  let n = BigInt("0x" + (Buffer.from(buf).toString("hex") || "0"));
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

/** RFC 8785 (JCS) for the JSON subset records use. Independent of the verifier. */
function jcs(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jcs).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .filter((k) => v[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${jcs(v[k])}`)
    .join(",")}}`;
}

function signingBytes(record) {
  const { proof, ...rest } = record;
  const { proofValue, ...proofRest } = proof ?? {};
  return Buffer.from(jcs({ ...rest, proof: proofRest }), "utf8");
}

function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const did =
    "did:key:z" + b58encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  return { privateKey, did };
}

function buildRecord(key, { now, overrides = {}, signWith = key } = {}) {
  const tag = `CANARY-${randomBytes(4).toString("hex")}`;
  const rec = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://authichain.com/protocol/v1",
    ],
    type: ["VerifiableCredential", "ProvenanceRecord"],
    issuer: key.did,
    validFrom: new Date(now.getTime() - 3_600_000).toISOString(),
    credentialSubject: {
      id: `https://id.gs1.org/01/09506000134352/21/${tag}`,
      gtin: "09506000134352",
      serial: tag,
    },
    ...overrides,
    proof: {
      type: "Ed25519Signature2020",
      created: now.toISOString(),
      verificationMethod: `${key.did}#key-1`,
      proofPurpose: "assertionMethod",
    },
  };
  rec.proof.proofValue =
    "z" + b58encode(edSign(null, signingBytes(rec), signWith.privateKey));
  return rec;
}

function anchorFor(record, over = {}) {
  return {
    recordHash:
      "sha256:" + createHash("sha256").update(signingBytes(record)).digest("hex"),
    chain: "polygon:137",
    txHash: "0x" + randomBytes(32).toString("hex"),
    anchoredAt: new Date().toISOString(),
    ...over,
  };
}

export const REQUIRED_ROUNDTRIP_CHECKS = [
  "issue-and-verify",
  "anchor-commitment",
  "tampered-subject-rejected",
  "tampered-anchor-hash-rejected",
  "wrong-issuer-key-rejected",
  "key-order-independent",
  "expired-rejected",
  "testnet-anchor-rejected",
  "published-example-verifies",
  "published-anchored-example-verifies",
];

/**
 * Run the round trip against `verifier` (the module exporting verifyRecord).
 * Returns { checks: [{ name, ok, detail }] }. Never throws for a failing check.
 */
export function runRoundtrip({
  verifier,
  now = new Date(),
  examplesDir = join(PROTOCOL_DIR, "examples"),
} = {}) {
  const checks = [];
  const opts = { now: now.toISOString() };
  const check = (name, fn) => {
    try {
      const r = fn();
      checks.push({ name, ok: r.ok === true, detail: r.detail ?? "" });
    } catch (err) {
      checks.push({ name, ok: false, detail: `error: ${err?.message ?? err}` });
    }
  };
  const verify = (rec, anchor = null) => verifier.verifyRecord(rec, anchor, opts);
  const judged = (res, verdict, reasonPrefix) => ({
    ok:
      res?.verdict === verdict &&
      (!reasonPrefix ||
        (res.reasons ?? []).some((r) => String(r).startsWith(reasonPrefix))),
    detail: JSON.stringify({ verdict: res?.verdict, reasons: res?.reasons }),
  });

  const key = newKey();
  const impostor = newKey();
  const good = buildRecord(key, { now });

  check("issue-and-verify", () => judged(verify(good), "valid-unanchored"));

  check("anchor-commitment", () => judged(verify(good, anchorFor(good)), "verified"));

  check("tampered-subject-rejected", () => {
    const t = structuredClone(good);
    t.credentialSubject.serial += "-TAMPERED";
    return judged(verify(t), "invalid", "signature_invalid");
  });

  check("tampered-anchor-hash-rejected", () =>
    judged(
      verify(good, anchorFor(good, { recordHash: "sha256:" + "0".repeat(64) })),
      "invalid",
      "anchor_hash_mismatch"
    )
  );

  check("wrong-issuer-key-rejected", () => {
    // Signed by the impostor but claiming the real issuer's key.
    const forged = buildRecord(key, { now, signWith: impostor });
    return judged(verify(forged), "invalid", "signature_invalid");
  });

  check("key-order-independent", () => {
    const reordered = {};
    for (const k of Object.keys(good).reverse()) reordered[k] = good[k];
    reordered.credentialSubject = {
      serial: good.credentialSubject.serial,
      id: good.credentialSubject.id,
      gtin: good.credentialSubject.gtin,
    };
    return judged(verify(reordered), "valid-unanchored");
  });

  check("expired-rejected", () => {
    const expired = buildRecord(key, {
      now,
      overrides: { validUntil: new Date(now.getTime() - 60_000).toISOString() },
    });
    return judged(verify(expired), "invalid", "expired");
  });

  check("testnet-anchor-rejected", () =>
    judged(
      verify(good, anchorFor(good, { chain: "eip155:80002" })),
      "invalid",
      "anchor_not_mainnet"
    )
  );

  check("published-example-verifies", () => {
    const rec = JSON.parse(readFileSync(join(examplesDir, "record.json"), "utf8"));
    return judged(verify(rec), "valid-unanchored");
  });

  check("published-anchored-example-verifies", () => {
    const rec = JSON.parse(
      readFileSync(join(examplesDir, "polygon-anchor-1.record.json"), "utf8")
    );
    const anchor = JSON.parse(
      readFileSync(join(examplesDir, "polygon-anchor-1.anchor.json"), "utf8")
    );
    return judged(verify(rec, anchor), "verified");
  });

  return { checks };
}

/** Pure. Every required check must be present and ok. */
export function evaluateRoundtripEvidence(evidence) {
  const checks = evidence?.checks;
  if (!Array.isArray(checks) || checks.length === 0)
    return { status: "fail", reasons: ["no round trip evidence collected"], evidence: {} };
  const reasons = [];
  for (const name of REQUIRED_ROUNDTRIP_CHECKS) {
    const c = checks.find((x) => x?.name === name);
    if (!c) reasons.push(`${name}: check missing`);
    else if (c.ok !== true) reasons.push(`${name}: ${c.detail || "failed"}`);
  }
  return reasons.length
    ? { status: "fail", reasons, evidence: { checks } }
    : { status: "pass", reasons: [], evidence: { checks } };
}

/**
 * Run the repository's own conformance suite against the reference verifier
 * (same command as `npm run conformance` in protocol/package.json).
 */
export function runConformance({
  protocolDir = PROTOCOL_DIR,
  timeoutMs = 90_000,
} = {}) {
  const r = spawnSync(
    process.execPath,
    ["conformance/run.mjs", "--strict", "--", "node", "verifier.mjs"],
    { cwd: protocolDir, encoding: "utf8", timeout: timeoutMs }
  );
  const tail = (s) => String(s ?? "").slice(-800);
  return {
    exit_code: r.status,
    timed_out: r.error?.code === "ETIMEDOUT",
    spawn_error: r.error && r.error.code !== "ETIMEDOUT" ? r.error.message : null,
    stdout_tail: tail(r.stdout),
    stderr_tail: tail(r.stderr),
  };
}

/** Pure. Exit 0, no timeout, and some output (a suite that printed nothing ran nothing). */
export function evaluateConformanceEvidence(e) {
  if (!e || typeof e !== "object")
    return { status: "fail", reasons: ["no conformance evidence collected"], evidence: {} };
  const reasons = [];
  if (e.spawn_error) reasons.push(`could not start suite: ${e.spawn_error}`);
  if (e.timed_out) reasons.push("conformance suite timed out");
  if (e.exit_code !== 0) reasons.push(`suite exited with ${String(e.exit_code)}`);
  if (!String(e.stdout_tail ?? "").trim())
    reasons.push("suite produced no output (nothing ran)");
  return reasons.length
    ? { status: "fail", reasons, evidence: e }
    : { status: "pass", reasons: [], evidence: { stdout_tail: e.stdout_tail } };
}
