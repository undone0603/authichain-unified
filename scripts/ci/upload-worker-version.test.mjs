import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  KEEP_BINDINGS,
  EDGE_ROUTER_RESOURCE_BINDINGS,
  curlArgv,
  parseTomlVars,
  parseVersionUploadResponse,
  versionUploadMetadata,
  versionsUploadUrl,
  uploadWorkerVersion,
} from "./upload-worker-version.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "f0afbac9-1240-47a6-ac80-d58bddcc072d";
const ACCOUNT = "4c1869b90f13f86940aa3747839bf420";
const TOML = `[vars]
SUPABASE_URL = "https://example.supabase.co"
SUPABASE_ANON_KEY = "anon-test-key"
`;

test("versions URL targets the Worker versions API", () => {
  assert.equal(
    versionsUploadUrl(ACCOUNT, "authichain-edge-router"),
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/authichain-edge-router/versions`
  );
});

test("metadata keeps secrets and assets; never sends secret_text values", () => {
  const meta = versionUploadMetadata({
    compatibilityDate: "2026-08-01",
    compatibilityFlags: ["nodejs_compat"],
    vars: parseTomlVars(TOML),
  });
  assert.equal(meta.keep_assets, true);
  assert.deepEqual(meta.keep_bindings, KEEP_BINDINGS);
  assert.ok(KEEP_BINDINGS.includes("secret_text"));
  assert.equal(meta.main_module, "index.js");
  assert.equal(
    meta.bindings.filter(b => b.type === "secret_text").length,
    0
  );
  const names = new Set(meta.bindings.map(b => b.name));
  for (const b of EDGE_ROUTER_RESOURCE_BINDINGS) {
    assert.ok(names.has(b.name), `missing ${b.name}`);
  }
  assert.ok(names.has("SUPABASE_URL"));
  assert.ok(names.has("SUPABASE_ANON_KEY"));
  assert.doesNotMatch(JSON.stringify(meta), /AUTHICHAIN_ATTESTATION/);
});

test("curl argv is IPv4 HTTP/1.1 multipart and reads the Bearer header from a file", () => {
  const argv = curlArgv({
    url: versionsUploadUrl(ACCOUNT, "authichain-edge-router"),
    metadataPath: "/tmp/metadata.json",
    bundlePath: "/tmp/index.js",
    headerPath: "/tmp/auth.hdr",
  });
  assert.equal(argv[0], "curl");
  assert.ok(argv.includes("--ipv4"));
  assert.ok(argv.includes("--http1.1"));
  assert.ok(argv.includes("-X"));
  assert.ok(argv.includes("POST"));
  assert.ok(argv.includes("-H"));
  assert.ok(argv.includes("@/tmp/auth.hdr"));
  assert.ok(argv.some(a => a.startsWith("metadata=<")));
  assert.ok(argv.some(a => a.startsWith("index.js=@")));
  assert.doesNotMatch(argv.join(" "), /Bearer /);
  assert.doesNotMatch(argv.join(" "), /AUTHICHAIN_ATTESTATION/);
});

test("parseVersionUploadResponse reads result.id", () => {
  assert.equal(
    parseVersionUploadResponse(JSON.stringify({ success: true, result: { id: ID } })),
    ID
  );
});

test("parseVersionUploadResponse throws on success=false", () => {
  assert.throws(
    () =>
      parseVersionUploadResponse(
        JSON.stringify({ success: false, errors: [{ message: "nope" }] })
      ),
    /nope/
  );
});

test("uploadWorkerVersion POSTs via injected curl and returns the id", () => {
  let seen;
  const id = uploadWorkerVersion({
    scriptName: "authichain-edge-router",
    bundlePath: path.join(ROOT, "scripts/ci/upload-worker-version.mjs"),
    wranglerToml: TOML,
    accountId: ACCOUNT,
    token: "tok-secret",
    spawnImpl: (cmd, args) => {
      seen = [cmd, ...args];
      return {
        status: 0,
        stdout: JSON.stringify({ success: true, result: { id: ID } }),
        stderr: "",
      };
    },
  });
  assert.equal(id, ID);
  assert.equal(seen[0], "curl");
  assert.ok(seen.includes("--ipv4"));
  assert.doesNotMatch(seen.join(" "), /tok-secret/);
});

test("live wrangler.toml still has the resource binding ids this upload sends", () => {
  const toml = readFileSync(path.join(ROOT, "worker-app/wrangler.toml"), "utf8");
  assert.match(toml, /id = "7c8e9466e57843199f6f768615e42a5c"/);
  assert.match(toml, /id = "ab391dc529884161bd84707d7627a9f0"/);
  assert.match(toml, /id = "97d767ff69584161a0672cd942e9364a"/);
  const vars = parseTomlVars(toml);
  assert.match(vars.SUPABASE_URL, /^https:\/\//);
  assert.ok(vars.SUPABASE_ANON_KEY.length > 20);
});
