#!/usr/bin/env node
/**
 * Print the Worker version id that is serving 100% of production traffic.
 *
 * The edge-router deploy records this before it promotes a new version so a
 * failed post-deploy smoke can put the previous version back
 * (promote-worker-version.mjs <worker> <version-id>). It fails closed: when
 * the live version cannot be named unambiguously (no deployment, split
 * traffic, odd response) it exits non-zero and the deploy never starts,
 * because a deploy with no rollback target is not allowed to ship.
 *
 * API shape (same call and parsing as wrangler's fetchLatestDeployments):
 *   GET /accounts/{id}/workers/scripts/{name}/deployments
 *   -> result.deployments[], newest first, each with
 *      versions: [{ version_id, percentage }]
 * Does not print the API token.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function liveDeploymentUrl(accountId, scriptName) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/deployments`;
}

/** Pure. Returns the single version id holding 100% of the newest deployment. */
export function pickLiveVersionId(result) {
  const deployments = result?.deployments;
  if (!Array.isArray(deployments) || deployments.length === 0) {
    throw new Error("no deployments returned; refusing to deploy without a rollback target");
  }
  // Newest first by created_on; ties and missing dates keep API order.
  const newest = [...deployments].sort((a, b) =>
    String(b?.created_on ?? "").localeCompare(String(a?.created_on ?? ""))
  )[0];
  const versions = Array.isArray(newest?.versions) ? newest.versions : [];
  const withTraffic = versions.filter(v => Number(v?.percentage) > 0);
  if (withTraffic.length !== 1 || Number(withTraffic[0].percentage) !== 100) {
    throw new Error(
      `live deployment is not a single 100% version (${withTraffic.length} versions carry traffic); refusing to deploy`
    );
  }
  const id = withTraffic[0].version_id;
  if (!UUID.test(String(id))) {
    throw new Error("live version id is not a UUID");
  }
  return id;
}

export async function fetchLiveWorkerVersion({
  scriptName,
  accountId,
  token,
  fetchImpl = fetch,
}) {
  if (!NAME.test(scriptName)) {
    throw new Error("invalid worker name");
  }
  if (!accountId || !token) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
  }
  const res = await fetchImpl(liveDeploymentUrl(accountId, scriptName), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`deployments GET HTTP ${res.status} (non-JSON)`);
  }
  if (!res.ok || data.success !== true) {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const msg = errors.map(e => e.message || JSON.stringify(e)).join("; ");
    throw new Error(`deployments GET HTTP ${res.status}: ${msg || "success=false"}`);
  }
  return pickLiveVersionId(data.result);
}

async function main() {
  const [scriptName] = process.argv.slice(2);
  if (!scriptName) {
    console.error("usage: live-worker-version.mjs <worker-name>");
    process.exit(2);
  }
  const id = await fetchLiveWorkerVersion({
    scriptName,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    token: process.env.CLOUDFLARE_API_TOKEN || "",
  });
  console.log(id);
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