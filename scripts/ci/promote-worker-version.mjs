#!/usr/bin/env node
/**
 * Promote a stored Worker version to 100% via Cloudflare deployments API.
 * Same path as edge-router 1989. Does not wrangler-deploy, does not rotate
 * AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64, does not print the API token.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function deploymentUrl(accountId, scriptName) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/deployments`;
}

export function deploymentBody(versionId) {
  return {
    strategy: "percentage",
    versions: [{ percentage: 100, version_id: versionId }],
  };
}

export async function promoteWorkerVersion({
  scriptName,
  versionId,
  accountId,
  token,
  fetchImpl = fetch,
}) {
  if (!NAME.test(scriptName)) {
    throw new Error("invalid worker name");
  }
  if (!UUID.test(versionId)) {
    throw new Error("invalid version id");
  }
  if (!accountId || !token) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
  }
  const url = deploymentUrl(accountId, scriptName);
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deploymentBody(versionId)),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`deployments POST HTTP ${res.status} (non-JSON)`);
  }
  if (!res.ok || data.success !== true) {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const msg = errors.map(e => e.message || JSON.stringify(e)).join("; ");
    throw new Error(`deployments POST HTTP ${res.status}: ${msg || "success=false"}`);
  }
  return data.result || data;
}

async function main() {
  const [scriptName, versionId] = process.argv.slice(2);
  if (!scriptName || !versionId) {
    console.error("usage: promote-worker-version.mjs <worker-name> <version-id>");
    process.exit(2);
  }
  const result = await promoteWorkerVersion({
    scriptName,
    versionId,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    token: process.env.CLOUDFLARE_API_TOKEN || "",
  });
  const deployed = result?.id || "ok";
  console.log(`promoted ${scriptName} version ${versionId} to 100% (deployment ${deployed})`);
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
