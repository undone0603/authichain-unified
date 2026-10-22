import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ARTIFACTS,
  MAX_AGE_MS,
  TRUST_CLAIM,
  buildReleaseRecord,
  checkReleaseRecord,
  describeArtifacts,
  expectedFor,
  isSafeRelativePath,
  newKey,
  runDogfood,
  signRecord,
  verifyRecordFile,
} from "./dogfood-release.mjs";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);
const NOW = new Date("2026-10-22T12:00:00.000Z");
const ENV = { CI_COMMIT_SHA: COMMIT };

let root;

function write(rel, text) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function makeTree() {
  write("package.json", JSON.stringify({ name: "fixture", version: "1.2.3" }));
  write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  write("protocol/verifier.mjs", "export const v = 1;\n");
  write(".gitlab-ci.yml", "stages: [validate]\n");
}

function expected(env = ENV) {
  return expectedFor({ root, env });
}

/** A valid record for the fixture tree, plus the key that signed it. */
function freshRecord(now = NOW) {
  const key = newKey();
  const exp = expected();
  const record = buildReleaseRecord({
    release: { commit: exp.commit, version: exp.version },
    artifacts: exp.artifacts,
    now,
    key,
  });
  return { record, key };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dogfood-"));
  makeTree();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("positive: a record for this release is bound, and says how little that proves", () => {
  it("is `bound`, with the protocol verdict `valid-unanchored` and never `verified`", () => {
    const { record } = freshRecord();
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("bound");
    expect(result.protocol.verdict).toBe("valid-unanchored");
    expect(result.failures).toEqual([]);
    expect(result.passed).toEqual(
      expect.arrayContaining([
        "commit",
        "version",
        ...DEFAULT_ARTIFACTS.map(p => `artifact:${p}`),
      ])
    );
  });

  it("carries commit, version, timestamp and one SHA-256 per artifact", () => {
    const { record } = freshRecord();
    const s = record.credentialSubject;
    expect(s.release).toEqual({
      commit: COMMIT,
      version: "1.2.3",
      generatedAt: NOW.toISOString(),
    });
    expect(s.artifacts.map(a => a.path)).toEqual(DEFAULT_ARTIFACTS);
    for (const a of s.artifacts) expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("states its own limits: integrity only, ephemeral signer, not anchored", () => {
    const { record } = freshRecord();
    expect(record.credentialSubject.trust).toEqual({
      scope: "integrity-only",
      signer: "ephemeral-self-issued",
      anchored: false,
      claim: TRUST_CLAIM,
    });
    expect(TRUST_CLAIM).toMatch(/does not prove the code is correct or safe/);
  });

  it("an artifact added with --artifact is bound too", () => {
    write("build/app.tar", "pretend build output");
    const out = join(root, "out", "record.json");
    const run = runDogfood({
      root,
      env: ENV,
      now: NOW,
      outFile: out,
      extraArtifacts: ["build/app.tar"],
    });
    expect(run.ok).toBe(true);
    const written = JSON.parse(readFileSync(out, "utf8"));
    expect(
      written.record.credentialSubject.artifacts.map(a => a.path)
    ).toContain("build/app.tar");
    expect(written.binding.verdict).toBe("bound");
  });

  it("runDogfood writes the record, and verifyRecordFile agrees with it from disk", () => {
    const out = join(
      root,
      "docs",
      "execution",
      "AUTHICHAIN_DOGFOOD_RECORD.json"
    );
    const run = runDogfood({ root, env: ENV, now: NOW, outFile: out });
    expect(run.ok).toBe(true);
    expect(existsSync(out)).toBe(true);
    const result = verifyRecordFile({ root, file: out, env: ENV, now: NOW });
    expect(result.verdict).toBe("bound");
  });
});

describe("negative: the signature cannot see what the binding sees", () => {
  it("a changed artifact is a mismatch although the signature is still valid", () => {
    const { record } = freshRecord();
    write("pnpm-lock.yaml", "lockfileVersion: '9.0'\nTAMPERED: true\n");
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.protocol.verdict).toBe("valid-unanchored");
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toEqual([
      "artifact_digest_mismatch:pnpm-lock.yaml",
    ]);
  });

  it("a one-byte change in any default artifact is caught", () => {
    for (const path of DEFAULT_ARTIFACTS) {
      makeTree();
      const { record } = freshRecord();
      write(path, readFileSync(join(root, path), "utf8") + " ");
      const result = checkReleaseRecord(record, expected(), { now: NOW });
      expect(result.verdict, path).toBe("mismatch");
      expect(result.failures, path).toContain(
        `artifact_digest_mismatch:${path}`
      );
    }
  });

  it("a record for another commit does not describe this one", () => {
    const { record } = freshRecord();
    const result = checkReleaseRecord(
      record,
      expected({ CI_COMMIT_SHA: OTHER_COMMIT }),
      { now: NOW }
    );
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toEqual([`commit_mismatch:${COMMIT}`]);
  });

  it("a record for another version does not describe this one", () => {
    const { record } = freshRecord();
    write(
      "package.json",
      JSON.stringify({ name: "fixture", version: "1.2.4" })
    );
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toContain("version_mismatch:1.2.3");
  });

  it("an artifact missing from disk is reported, not skipped or crashed on", () => {
    const { record } = freshRecord();
    rmSync(join(root, "protocol", "verifier.mjs"));
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toContain(
      "artifact_unreadable:protocol/verifier.mjs"
    );
  });

  it("an artifact left out of the record cannot narrow the check", () => {
    const key = newKey();
    const exp = expected();
    const record = buildReleaseRecord({
      release: { commit: exp.commit, version: exp.version },
      artifacts: exp.artifacts.filter(a => a.path !== ".gitlab-ci.yml"),
      now: NOW,
      key,
    });
    const result = checkReleaseRecord(record, exp, { now: NOW });
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toEqual(["artifact_not_in_record:.gitlab-ci.yml"]);
  });

  it("an artifact the record claims but nobody asked for is flagged", () => {
    const key = newKey();
    const exp = expected();
    const record = buildReleaseRecord({
      release: { commit: exp.commit, version: exp.version },
      artifacts: [
        ...exp.artifacts,
        { path: "extra.bin", sha256: "c".repeat(64), bytes: 1 },
      ],
      now: NOW,
      key,
    });
    const result = checkReleaseRecord(record, exp, { now: NOW });
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toEqual(["unexpected_artifact:extra.bin"]);
  });

  it("a validly signed record with no release or artifact block binds to nothing", () => {
    const { record, key } = freshRecord();
    delete record.credentialSubject.release;
    delete record.credentialSubject.artifacts;
    signRecord(record, key);
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.protocol.verdict).toBe("valid-unanchored");
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "binding_missing:release",
        "binding_missing:artifacts",
      ])
    );
  });

  it("a record that overclaims its trust scope is refused even if correctly signed", () => {
    const { record, key } = freshRecord();
    record.credentialSubject.trust.scope = "verified-safe";
    record.credentialSubject.trust.anchored = true;
    signRecord(record, key);
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "trust_scope_not_integrity_only",
        "trust_anchored_claim_unsupported",
      ])
    );
  });

  it("a record older than the maximum age is `stale`, not bound", () => {
    const { record } = freshRecord();
    const later = new Date(NOW.getTime() + MAX_AGE_MS + 60_000);
    const result = checkReleaseRecord(record, expected(), { now: later });
    expect(result.verdict).toBe("stale");
    expect(result.failures).toEqual(["stale_record"]);
  });
});

describe("negative: editing the record after signing is `invalid`", () => {
  it.each([
    ["commit", r => (r.credentialSubject.release.commit = OTHER_COMMIT)],
    ["version", r => (r.credentialSubject.release.version = "9.9.9")],
    [
      "artifact digest",
      r => (r.credentialSubject.artifacts[0].sha256 = "d".repeat(64)),
    ],
    [
      "timestamp",
      r =>
        (r.credentialSubject.release.generatedAt = "2026-10-22T13:00:00.000Z"),
    ],
    [
      "trust claim",
      r => (r.credentialSubject.trust.claim = "Safe and audited."),
    ],
  ])("tampered %s fails the signature", (_name, tamper) => {
    const { record } = freshRecord();
    tamper(record);
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("invalid");
    expect(result.failures).toContain("protocol:signature_invalid");
  });

  it("a signature from a different key than the issuer names fails", () => {
    const { record } = freshRecord();
    const stranger = newKey();
    signRecord(record, stranger);
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("invalid");
    expect(result.failures).toContain("protocol:signature_invalid");
  });

  it("a record dated in the future is not yet valid", () => {
    const { record } = freshRecord(new Date(NOW.getTime() + 3_600_000));
    const result = checkReleaseRecord(record, expected(), { now: NOW });
    expect(result.verdict).toBe("invalid");
    expect(result.failures).toContain("protocol:not_yet_valid");
  });

  it("a record missing required fields is invalid", () => {
    const result = checkReleaseRecord(
      { type: ["VerifiableCredential"] },
      expected(),
      { now: NOW }
    );
    expect(result.verdict).toBe("invalid");
    expect(result.failures).toContain("protocol:missing_field:proof");
  });
});

describe("not found is not counterfeit", () => {
  it("no record is `no-record`, a different verdict from every failure", () => {
    const result = checkReleaseRecord(null, expected(), { now: NOW });
    expect(result.verdict).toBe("no-record");
    expect(["invalid", "mismatch", "stale"]).not.toContain(result.verdict);
    expect(result.failures).toEqual([]);
    expect(result.note).toMatch(/not evidence/);
    // The verdict and failure list never accuse; the note only denies the accusation.
    expect(`${result.verdict} ${result.failures.join(" ")}`).not.toMatch(
      /counterfeit|forged|fake/i
    );
  });

  it("a missing record file is `no-record`; an unparseable one is `invalid`", () => {
    const missing = verifyRecordFile({
      root,
      file: join(root, "nope.json"),
      env: ENV,
      now: NOW,
    });
    expect(missing.verdict).toBe("no-record");
    write("garbage.json", "{not json");
    const garbage = verifyRecordFile({
      root,
      file: join(root, "garbage.json"),
      env: ENV,
      now: NOW,
    });
    expect(garbage.verdict).toBe("invalid");
    expect(garbage.failures).toEqual(["record_unparseable"]);
  });
});

describe("generation fails closed", () => {
  it("writes nothing when the release commit is unknown", () => {
    const out = join(root, "out.json");
    const run = runDogfood({
      root,
      env: {},
      now: NOW,
      outFile: out,
      head: () => {
        throw new Error("not a git repository");
      },
    });
    expect(run).toEqual({ ok: false, error: "release_commit_unknown" });
    expect(existsSync(out)).toBe(false);
  });

  it("rejects a malformed commit id rather than recording it", () => {
    const out = join(root, "out.json");
    const run = runDogfood({
      root,
      env: { CI_COMMIT_SHA: "main" },
      now: NOW,
      outFile: out,
    });
    expect(run.error).toBe("release_commit_unknown");
    expect(existsSync(out)).toBe(false);
  });

  it("writes nothing when a requested artifact cannot be read", () => {
    const out = join(root, "out.json");
    const run = runDogfood({
      root,
      env: ENV,
      now: NOW,
      outFile: out,
      extraArtifacts: ["build/missing.tar"],
    });
    expect(run.ok).toBe(false);
    expect(run.error).toBe("artifact_unreadable:build/missing.tar");
    expect(existsSync(out)).toBe(false);
  });

  it("writes nothing when a file changes while the record is being made", () => {
    // The self-check re-reads the tree. If a release input differs between the
    // first read and the check, the record would describe a tree that no longer exists.
    const out = join(root, "out.json");
    const reads = new Map();
    const flaky = (file, enc) => {
      const n = (reads.get(file) ?? 0) + 1;
      reads.set(file, n);
      if (file.endsWith("pnpm-lock.yaml") && n > 1)
        return Buffer.from("changed underneath us\n");
      return readFileSync(file, enc);
    };
    const run = runDogfood({
      root,
      env: ENV,
      now: NOW,
      outFile: out,
      readFile: flaky,
    });
    expect(run.ok).toBe(false);
    expect(run.error).toBe("self_check_mismatch");
    expect(run.check.failures).toEqual([
      "artifact_digest_mismatch:pnpm-lock.yaml",
    ]);
    expect(existsSync(out)).toBe(false);
  });

  it("writes nothing when package.json has no version", () => {
    write("package.json", JSON.stringify({ name: "fixture" }));
    const out = join(root, "out.json");
    const run = runDogfood({ root, env: ENV, now: NOW, outFile: out });
    expect(run.error).toBe("release_version_missing");
    expect(existsSync(out)).toBe(false);
  });

  it("refuses artifact paths that leave the repository", () => {
    for (const bad of ["../secret", "/etc/passwd", "a/../../b", "C:\\x", ""]) {
      expect(isSafeRelativePath(bad), bad).toBe(false);
      const run = runDogfood({
        root,
        env: ENV,
        now: NOW,
        outFile: join(root, "o.json"),
        extraArtifacts: [bad],
      });
      expect(run.error, bad).toBe(`artifact_path_not_allowed:${bad}`);
    }
    expect(isSafeRelativePath("build/app.tar")).toBe(true);
  });

  it("a record that names a path outside the repository is never read for it", () => {
    const { record, key } = freshRecord();
    record.credentialSubject.artifacts.push({
      path: "../../etc/passwd",
      sha256: "e".repeat(64),
      bytes: 1,
    });
    signRecord(record, key);
    write("tampered.json", JSON.stringify({ record }));
    const result = verifyRecordFile({
      root,
      file: join(root, "tampered.json"),
      env: ENV,
      now: NOW,
    });
    expect(result.verdict).toBe("mismatch");
    expect(result.failures).toContain("unexpected_artifact:../../etc/passwd");
  });
});

describe("describeArtifacts", () => {
  it("hashes real bytes and reports unreadable files instead of dropping them", () => {
    const [ok, bad] = describeArtifacts(root, ["package.json", "missing.txt"]);
    expect(ok.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ok.bytes).toBeGreaterThan(0);
    expect(bad).toMatchObject({ path: "missing.txt", sha256: null });
    expect(bad.error).toBeTruthy();
  });
});
