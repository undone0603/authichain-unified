#!/usr/bin/env node
/**
 * POST a bundled Worker version over IPv4 HTTP/1.1 (curl), then print the
 * version id. wrangler's undici fetch hangs on the 8.8 MiB edge-router POST
 * from authichain-wsl (41242803187, 41246493823, 41250709348). Uncompressed
 * curl of that bundle got RST after ~96s (41264005567). Gzip the multipart
 * body (~1.7 MiB) and retry curl 56.
 *
 * keep_bindings secret_text inherits AUTHICHAIN_ATTESTATION_* and every other
 * secret. keep_assets keeps client/public. Does not print the API token or
 * secret values. Does not secret-put.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { parseWranglerVersionId } from "./parse-wrangler-version-id.mjs";

const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const KEEP_BINDINGS = ["secret_text", "secret_key", "plain_text", "json"];

export const EDGE_ROUTER_RESOURCE_BINDINGS = [
  { type: "ai", name: "AI" },
  { type: "assets", name: "ASSETS" },
  { type: "hyperdrive", name: "HYPERDRIVE", id: "97d767ff69584161a0672cd942e9364a" },
  {
    type: "durable_object_namespace",
    name: "RATE_LIMITER",
    class_name: "RateLimiter",
  },
  {
    type: "kv_namespace",
    name: "SESSIONS",
    namespace_id: "7c8e9466e57843199f6f768615e42a5c",
  },
  {
    type: "kv_namespace",
    name: "X402_REPLAY_KV",
    namespace_id: "ab391dc529884161bd84707d7627a9f0",
  },
  {
    type: "service",
    name: "VERIFY_APP",
    service: "authichain-app",
    environment: "production",
  },
];

export function versionsUploadUrl(accountId, scriptName) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/versions`;
}

export function parseTomlVars(text) {
  const section = String(text ?? "")
    .split(/^\[vars\]\s*$/m)[1]
    ?.split(/^\[/m)[0];
  if (!section) return { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
  const get = key => {
    const m = section.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));
    return m ? m[1] : "";
  };
  return {
    SUPABASE_URL: get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: get("SUPABASE_ANON_KEY"),
  };
}

export function versionUploadMetadata({
  compatibilityDate,
  compatibilityFlags,
  vars,
  message,
}) {
  if (!vars?.SUPABASE_URL || !vars?.SUPABASE_ANON_KEY) {
    throw new Error("wrangler.toml [vars] SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return {
    main_module: "index.js",
    compatibility_date: compatibilityDate,
    compatibility_flags: compatibilityFlags,
    keep_assets: true,
    keep_bindings: KEEP_BINDINGS,
    bindings: [
      ...EDGE_ROUTER_RESOURCE_BINDINGS,
      { type: "plain_text", name: "SUPABASE_URL", text: vars.SUPABASE_URL },
      {
        type: "plain_text",
        name: "SUPABASE_ANON_KEY",
        text: vars.SUPABASE_ANON_KEY,
      },
    ],
    annotations: {
      "workers/message": message || "ipv4 curl versions upload keep-vars",
    },
  };
}

export function resolveBundleFile(bundlePath) {
  const st = statSync(bundlePath);
  if (st.isFile()) return bundlePath;
  const indexJs = path.join(bundlePath, "index.js");
  try {
    if (statSync(indexJs).isFile()) return indexJs;
  } catch {
    throw new Error(`no index.js in ${bundlePath}`);
  }
  return indexJs;
}

export function buildMultipartBody({ metadata, moduleBuf, boundary }) {
  const meta = Buffer.from(JSON.stringify(metadata), "utf8");
  const chunks = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="metadata"\r\n`,
    `Content-Type: application/json\r\n\r\n`,
  ];
  const head = Buffer.from(chunks.join(""), "utf8");
  const mid = Buffer.from(
    `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="index.js"; filename="index.js"\r\n` +
      `Content-Type: application/javascript+module\r\n\r\n`,
    "utf8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return Buffer.concat([head, meta, mid, moduleBuf, tail]);
}

export function curlArgv({ url, bodyPath, headerPath, contentType }) {
  return [
    "curl",
    "--ipv4",
    "--http1.1",
    "--retry",
    "3",
    "--retry-delay",
    "5",
    "--retry-all-errors",
    "--silent",
    "--show-error",
    "--max-time",
    "180",
    "-X",
    "POST",
    url,
    "-H",
    `@${headerPath}`,
    "-H",
    "Content-Encoding: gzip",
    "-H",
    `Content-Type: ${contentType}`,
    "--data-binary",
    `@${bodyPath}`,
  ];
}

export function parseVersionUploadResponse(text) {
  let data;
  try {
    data = JSON.parse(String(text ?? "").trim());
  } catch {
    throw new Error("versions POST returned non-JSON");
  }
  if (data.success !== true) {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const msg = errors.map(e => e.message || JSON.stringify(e)).join("; ");
    throw new Error(`versions POST success=false: ${msg || "unknown"}`);
  }
  const id =
    data.result?.id ||
    data.result?.version_id ||
    parseWranglerVersionId(JSON.stringify(data));
  if (!id) throw new Error("versions POST missing version id");
  return id;
}

export function uploadWorkerVersion({
  scriptName,
  bundlePath,
  wranglerToml,
  accountId,
  token,
  spawnImpl = spawnSync,
  compatibilityDate = "2026-08-01",
  compatibilityFlags = ["nodejs_compat"],
  message,
}) {
  if (!NAME.test(scriptName)) throw new Error("invalid worker name");
  if (!accountId || !token) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
  }
  const vars = parseTomlVars(wranglerToml);
  const metadata = versionUploadMetadata({
    compatibilityDate,
    compatibilityFlags,
    vars,
    message,
  });
  const bundle = resolveBundleFile(bundlePath);
  const dir = mkdtempSync(path.join(tmpdir(), "er-upload-"));
  const headerPath = path.join(dir, "auth.hdr");
  const bodyPath = path.join(dir, "body.gz");
  const boundary = `----authichain-${randomBytes(12).toString("hex")}`;
  const raw = buildMultipartBody({
    metadata,
    moduleBuf: readFileSync(bundle),
    boundary,
  });
  writeFileSync(bodyPath, gzipSync(raw, { level: 9 }));
  writeFileSync(headerPath, `Authorization: Bearer ${token}\n`, { mode: 0o600 });
  const args = curlArgv({
    url: versionsUploadUrl(accountId, scriptName),
    bodyPath,
    headerPath,
    contentType: `multipart/form-data; boundary=${boundary}`,
  });
  try {
    const result = spawnImpl(args[0], args.slice(1), {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) {
      const err = String(result.stderr || result.stdout || "").trim();
      throw new Error(`curl versions POST exit ${result.status}: ${err || "no output"}`);
    }
    return parseVersionUploadResponse(result.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const [scriptName, bundlePath] = process.argv.slice(2);
  if (!scriptName || !bundlePath) {
    console.error("usage: upload-worker-version.mjs <worker-name> <bundle-dir-or-file>");
    process.exit(2);
  }
  const tomlPath = path.resolve("wrangler.toml");
  const id = uploadWorkerVersion({
    scriptName,
    bundlePath,
    wranglerToml: readFileSync(tomlPath, "utf8"),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    token: process.env.CLOUDFLARE_API_TOKEN || "",
  });
  process.stdout.write(id);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(err => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
