/**
 * Release attestation ("dogfood") record: AuthiChain's own protocol applied to
 * AuthiChain's own release.
 *
 * What a record says: these files had these SHA-256 digests, at this commit and
 * version, when the record was generated, and nothing altered the record after
 * it was signed.
 *
 * What it does NOT say, and the record says so itself (TRUST_CLAIM): that the
 * code is correct or safe, or who the signer is. The signing key is a one-off
 * Ed25519 key made per run, so the protocol verdict is `valid-unanchored`, never
 * `verified` (SPEC section 4.1). A valid signature is cryptographic validity,
 * not real-world truth.
 *
 * Verdicts from checkReleaseRecord:
 *   bound      signature valid and every binding matches the release being checked
 *   stale      bound, but older than maxAgeMs
 *   mismatch   signature valid, but the record describes some other release
 *              (wrong commit or version, changed or missing files)
 *   invalid    the protocol verifier rejects the record (altered, malformed, not yet valid)
 *   no-record  nothing was supplied to check. This is not evidence of a forgery.
 */

import { execFileSync } from "node:child_process";
import { generateKeyPairSync, createHash, sign as edSign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { signingBytes, verifyRecord } from "../../protocol/verifier.mjs";

export const TRUST_CLAIM =
  "These files had these SHA-256 digests, at this commit and version, when this record was generated. " +
  "A valid signature proves the record was not altered after signing. It does not prove the code is correct " +
  "or safe, and the signing key is a one-off key with no registered identity.";

/** Release inputs hashed by default. A build output can be added with --artifact. */
export const DEFAULT_ARTIFACTS = [
  "package.json",
  "pnpm-lock.yaml",
  "protocol/verifier.mjs",
  ".gitlab-ci.yml",
];

export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** validFrom is set this far before generation so a skewed verifier clock does not reject it. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const OUT_FILE = join(
  "docs",
  "execution",
  "AUTHICHAIN_DOGFOOD_RECORD.json"
);

const COMMIT_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
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

export function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const did =
    "did:key:z" + b58encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  return { privateKey, did };
}

export function sha256Of(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Artifact paths stay inside the repository: relative, no `..`, no drive or root prefix. */
export function isSafeRelativePath(p) {
  if (
    typeof p !== "string" ||
    !p ||
    p.startsWith("/") ||
    /^[a-zA-Z]:/.test(p) ||
    p.includes("\0")
  ) {
    return false;
  }
  return !p.split(/[\\/]/).includes("..");
}

/** Digest each path under root. A path that cannot be read is reported, never skipped. */
export function describeArtifacts(root, paths, readFile = readFileSync) {
  const artifacts = [];
  for (const path of paths) {
    try {
      const bytes = readFile(join(root, path));
      artifacts.push({ path, sha256: sha256Of(bytes), bytes: bytes.length });
    } catch (err) {
      artifacts.push({
        path,
        sha256: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return artifacts;
}

function gitHead(root) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

/** Commit and version of the tree being released. Never invented: unknown is an error. */
export function resolveRelease({
  root,
  env = process.env,
  readFile = readFileSync,
  head = gitHead,
}) {
  let commit = env.CI_COMMIT_SHA;
  if (!commit) {
    try {
      commit = head(root);
    } catch {
      commit = undefined;
    }
  }
  if (!commit || !COMMIT_RE.test(commit)) {
    return { error: "release_commit_unknown" };
  }
  let version;
  try {
    version = JSON.parse(readFile(join(root, "package.json"), "utf8")).version;
  } catch {
    return { error: "release_version_unreadable" };
  }
  if (typeof version !== "string" || !version)
    return { error: "release_version_missing" };
  return { commit, version };
}

/** Sign (or re-sign) a record's proof with `key`. Exported so tests can build validly signed but wrong records. */
export function signRecord(record, key) {
  record.proof.proofValue =
    "z" + b58encode(edSign(null, signingBytes(record), key.privateKey));
  return record;
}

export function buildReleaseRecord({
  release,
  artifacts,
  now,
  key = newKey(),
}) {
  const record = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://authichain.com/protocol/v1",
    ],
    type: ["VerifiableCredential", "ReleaseAttestation"],
    issuer: key.did,
    validFrom: new Date(now.getTime() - CLOCK_SKEW_MS).toISOString(),
    credentialSubject: {
      id: `urn:authichain:release:${release.commit}`,
      name: "authichain-unified release attestation",
      release: {
        commit: release.commit,
        version: release.version,
        generatedAt: now.toISOString(),
      },
      artifacts: artifacts.map(({ path, sha256, bytes }) => ({
        path,
        sha256,
        bytes,
      })),
      trust: {
        scope: "integrity-only",
        signer: "ephemeral-self-issued",
        anchored: false,
        claim: TRUST_CLAIM,
      },
    },
    proof: {
      type: "Ed25519Signature2020",
      created: now.toISOString(),
      verificationMethod: `${key.did}#key-1`,
      proofPurpose: "assertionMethod",
    },
  };
  return signRecord(record, key);
}

/**
 * Check a record against the release it is supposed to describe.
 * `expected` is { commit, version, artifacts: [{ path, sha256 | null, error? }] }, computed
 * by the caller from the tree under test, never copied from the record.
 */
export function checkReleaseRecord(
  record,
  expected,
  { now = new Date(), maxAgeMs = MAX_AGE_MS } = {}
) {
  if (record === null || record === undefined) {
    return {
      verdict: "no-record",
      protocol: null,
      failures: [],
      passed: [],
      note: "No record was supplied. That is not evidence the release is counterfeit.",
    };
  }

  const protocol = verifyRecord(record, null, { now: now.toISOString() });
  if (protocol.verdict === "invalid") {
    return {
      verdict: "invalid",
      protocol,
      failures: protocol.reasons.map(r => `protocol:${r}`),
      passed: [],
    };
  }

  const failures = [];
  const passed = [];
  const check = (name, ok, detail) =>
    ok ? passed.push(name) : failures.push(detail ?? name);

  const subject = record.credentialSubject ?? {};
  const rel = subject.release;
  if (!rel || typeof rel !== "object") {
    failures.push("binding_missing:release");
  } else {
    check(
      "commit",
      rel.commit === expected.commit,
      `commit_mismatch:${String(rel.commit)}`
    );
    check(
      "version",
      rel.version === expected.version,
      `version_mismatch:${String(rel.version)}`
    );
  }

  const claimed = Array.isArray(subject.artifacts) ? subject.artifacts : null;
  if (!claimed) {
    failures.push("binding_missing:artifacts");
  } else {
    const claimedByPath = new Map(claimed.map(a => [a?.path, a]));
    for (const want of expected.artifacts) {
      if (want.sha256 === null || want.sha256 === undefined) {
        failures.push(`artifact_unreadable:${want.path}`);
        continue;
      }
      const got = claimedByPath.get(want.path);
      if (!got) {
        failures.push(`artifact_not_in_record:${want.path}`);
      } else if (
        !SHA256_RE.test(String(got.sha256)) ||
        got.sha256 !== want.sha256
      ) {
        failures.push(`artifact_digest_mismatch:${want.path}`);
      } else {
        passed.push(`artifact:${want.path}`);
      }
    }
    const expectedPaths = new Set(expected.artifacts.map(a => a.path));
    for (const path of claimedByPath.keys()) {
      if (!expectedPaths.has(path))
        failures.push(`unexpected_artifact:${String(path)}`);
    }
  }

  if (subject.trust?.scope !== "integrity-only")
    failures.push("trust_scope_not_integrity_only");
  if (subject.trust?.anchored !== false)
    failures.push("trust_anchored_claim_unsupported");

  if (failures.length)
    return { verdict: "mismatch", protocol, failures, passed };

  const generatedAt = new Date(rel.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    return {
      verdict: "mismatch",
      protocol,
      failures: ["generatedAt_malformed"],
      passed,
    };
  }
  if (now.getTime() - generatedAt.getTime() > maxAgeMs) {
    return { verdict: "stale", protocol, failures: ["stale_record"], passed };
  }
  return { verdict: "bound", protocol, failures: [], passed };
}

/** Expected release facts for a tree, with the artifact paths a record must cover. */
export function expectedFor({
  root,
  env,
  readFile,
  head,
  paths = DEFAULT_ARTIFACTS,
}) {
  const release = resolveRelease({ root, env, readFile, head });
  if (release.error) return { error: release.error };
  return { ...release, artifacts: describeArtifacts(root, paths, readFile) };
}

/** Generate, self-check and write the record. Nothing is written unless the self-check says `bound`. */
export function runDogfood({
  root,
  env = process.env,
  now = new Date(),
  outFile = join(root, OUT_FILE),
  extraArtifacts = [],
  readFile = readFileSync,
  head = gitHead,
  write = (file, text) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  },
} = {}) {
  const badPath = extraArtifacts.find(p => !isSafeRelativePath(p));
  if (badPath !== undefined)
    return { ok: false, error: `artifact_path_not_allowed:${badPath}` };
  const paths = [...new Set([...DEFAULT_ARTIFACTS, ...extraArtifacts])];
  const release = resolveRelease({ root, env, readFile, head });
  if (release.error) return { ok: false, error: release.error };

  const artifacts = describeArtifacts(root, paths, readFile);
  const unreadable = artifacts.filter(a => a.sha256 === null).map(a => a.path);
  if (unreadable.length) {
    return { ok: false, error: `artifact_unreadable:${unreadable.join(",")}` };
  }

  const record = buildReleaseRecord({ release, artifacts, now });
  // Independent re-read of the tree: the self-check must not reuse the builder's own numbers.
  const expected = expectedFor({ root, env, readFile, head, paths });
  const check = checkReleaseRecord(record, expected, { now });
  if (check.verdict !== "bound") {
    return { ok: false, error: `self_check_${check.verdict}`, check };
  }

  write(
    outFile,
    JSON.stringify(
      { record, verification: check.protocol, binding: check },
      null,
      2
    ) + "\n"
  );
  return { ok: true, outFile, check };
}

/** Verify a record file against the tree at root. Missing file is `no-record`, not a forgery. */
export function verifyRecordFile({
  root,
  file,
  env = process.env,
  now = new Date(),
  readFile = readFileSync,
  head = gitHead,
}) {
  let text;
  try {
    text = readFile(file, "utf8");
  } catch {
    return checkReleaseRecord(null, null, { now });
  }
  let record;
  try {
    const parsed = JSON.parse(text);
    record = parsed?.record ?? parsed;
  } catch {
    return {
      verdict: "invalid",
      protocol: null,
      failures: ["record_unparseable"],
      passed: [],
    };
  }
  const claimed = Array.isArray(record?.credentialSubject?.artifacts)
    ? record.credentialSubject.artifacts
        .map(a => a?.path)
        .filter(isSafeRelativePath)
    : [];
  // A record may not narrow the check by leaving a default artifact out, and a path it names
  // outside the repository is never read: it surfaces as `unexpected_artifact`.
  const paths = [...new Set([...DEFAULT_ARTIFACTS, ...claimed])];
  const expected = expectedFor({ root, env, readFile, head, paths });
  if (expected.error) {
    return {
      verdict: "mismatch",
      protocol: null,
      failures: [expected.error],
      passed: [],
    };
  }
  return checkReleaseRecord(record, expected, { now });
}
