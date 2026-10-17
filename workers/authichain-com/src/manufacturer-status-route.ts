/**
 * Apex lookup for AuthiChainNFT role events. Runs before APP_PREFIXES so
 * /api/manufacturer-status and /verify/manufacturer are not proxied to the
 * edge router, which has no such route.
 *
 * polygon.drpc.org rejects a block distance above 100. This handler asks
 * polygon-bor-rpc.publicnode.com for the latest 10,000 blocks only. That
 * host answers that recent window and rejects older archive ranges.
 */
import {
  DEPLOYED_BLOCK,
  EVENT_TOPICS,
  HISTORY_DISCLAIMER,
  ROLE_IDS,
  logFromBlock,
} from "../../manufacturer-status/src/window";

const CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const RPC = "https://polygon-bor-rpc.publicnode.com";

const HISTORY =
  /^\/api\/manufacturer-status\/(0x[a-fA-F0-9]{40})\/history$/;
const HAS_ROLE = "0x91d14854";
const IS_MANUFACTURER_VERIFIED = "0xb95ace69";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

const PAGE_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "cdn-cache-control": "no-store",
  "x-robots-tag": "noindex",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'",
};

function accountTopic(address: string): string {
  return "0x" + address.slice(2).toLowerCase().padStart(64, "0");
}

function hasRoleData(role: string, address: string): string {
  return HAS_ROLE + role.slice(2) + address.slice(2).toLowerCase().padStart(64, "0");
}

function verifiedData(address: string): string {
  return (
    IS_MANUFACTURER_VERIFIED +
    address.slice(2).toLowerCase().padStart(64, "0")
  );
}

function asBool(value: unknown): boolean {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("log_query_failed");
  }
  return BigInt(value) === 1n;
}

function topicAddress(topic: string | undefined): string {
  if (!topic || topic.length < 42) return "";
  return "0x" + topic.slice(-40);
}

type RpcLog = {
  topics?: string[];
  transactionHash?: string;
  blockNumber?: string;
};

async function rpc(
  fetchImpl: typeof fetch,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const res = await fetchImpl(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  let parsed: { result?: unknown; error?: { message?: string } } = {};
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    throw new Error("log_query_failed");
  }
  if (!res.ok || parsed.error) {
    const message = String(parsed.error?.message ?? "");
    if (/10000|range|archive/i.test(message)) {
      throw new Error("log_range_rejected");
    }
    throw new Error("log_query_failed");
  }
  return parsed.result;
}

function mapLogs(logs: RpcLog[], type: "granted" | "revoked") {
  return logs.map((log) => ({
    type,
    block: log.blockNumber ? BigInt(log.blockNumber).toString() : "unknown",
    tx: log.transactionHash ?? "",
    role: log.topics?.[1] ?? "",
    sender: topicAddress(log.topics?.[3]),
  }));
}

function mapManufacturer(
  logs: RpcLog[],
  type: "manufacturer_verified" | "manufacturer_revoked"
) {
  return logs.map((log) => ({
    type,
    block: log.blockNumber ? BigInt(log.blockNumber).toString() : "unknown",
    tx: log.transactionHash ?? "",
    role: "",
    sender: "",
  }));
}

function page(): Response {
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manufacturer role history</title>
<main style="max-width:40rem;margin:2rem auto;font-family:system-ui,sans-serif">
  <h1>Manufacturer role history</h1>
  <p>Current minter, admin, updater, pauser, and manufacturer-verified flags are read from the contract. manufacturerVerified is an admin-set contract flag, not a certificate. Role and manufacturer events are only the latest 10,000 blocks. This page does not take payment, and a role is not a product passport.</p>
  <form id="q">
    <label>Address <input name="address" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x…" style="width:100%"></label>
    <button type="submit">Check history</button>
  </form>
  <pre id="out"></pre>
</main>
<script>
document.getElementById("q").addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = new FormData(event.target).get("address");
  const out = document.getElementById("out");
  out.textContent = "Checking…";
  const res = await fetch("/api/manufacturer-status/" + address + "/history");
  out.textContent = JSON.stringify(await res.json(), null, 2);
});
</script>`;
  return new Response(html, { headers: PAGE_HEADERS });
}

export async function tryHandleManufacturerStatus(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/verify/manufacturer") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(405, { error: "method_not_allowed" });
    }
    return page();
  }
  if (!path.startsWith("/api/manufacturer-status")) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(405, { error: "method_not_allowed" });
  }
  const match = HISTORY.exec(path);
  if (!match) return json(400, { error: "invalid address" });
  const address = match[1];
  let roles;
  try {
    const call = (data: string) =>
      rpc(fetchImpl, "eth_call", [{ to: CONTRACT, data }, "latest"]);
    const [admin, minter, updater, pauser, manufacturerVerified] = await Promise.all([
      call(hasRoleData(ROLE_IDS.admin, address)),
      call(hasRoleData(ROLE_IDS.minter, address)),
      call(hasRoleData(ROLE_IDS.updater, address)),
      call(hasRoleData(ROLE_IDS.pauser, address)),
      call(verifiedData(address)),
    ]);
    roles = {
      admin: asBool(admin),
      minter: asBool(minter),
      updater: asBool(updater),
      pauser: asBool(pauser),
      manufacturerVerified: asBool(manufacturerVerified),
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : "log_query_failed";
    const error = code === "log_range_rejected" ? "log_range_rejected" : "log_query_failed";
    return json(502, { error, address, contract: CONTRACT });
  }
  try {
    const currentHex = await rpc(fetchImpl, "eth_blockNumber", []);
    if (typeof currentHex !== "string") throw new Error("log_query_failed");
    const current = BigInt(currentHex);
    const fromBlock = logFromBlock(current, DEPLOYED_BLOCK);
    const roleFilter = (topic: string) => ({
      address: CONTRACT,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + current.toString(16),
      topics: [topic, null, accountTopic(address)],
    });
    const manufacturerFilter = (topic: string) => ({
      address: CONTRACT,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + current.toString(16),
      topics: [topic, accountTopic(address)],
    });
    const [granted, revoked, verified, unverified] = await Promise.all([
      rpc(fetchImpl, "eth_getLogs", [roleFilter(EVENT_TOPICS.roleGranted)]),
      rpc(fetchImpl, "eth_getLogs", [roleFilter(EVENT_TOPICS.roleRevoked)]),
      rpc(fetchImpl, "eth_getLogs", [
        manufacturerFilter(EVENT_TOPICS.manufacturerVerified),
      ]),
      rpc(fetchImpl, "eth_getLogs", [
        manufacturerFilter(EVENT_TOPICS.manufacturerRevoked),
      ]),
    ]);
    if (
      !Array.isArray(granted) ||
      !Array.isArray(revoked) ||
      !Array.isArray(verified) ||
      !Array.isArray(unverified)
    ) {
      throw new Error("log_query_failed");
    }
    const history = [
      ...mapLogs(granted as RpcLog[], "granted"),
      ...mapLogs(revoked as RpcLog[], "revoked"),
      ...mapManufacturer(verified as RpcLog[], "manufacturer_verified"),
      ...mapManufacturer(unverified as RpcLog[], "manufacturer_revoked"),
    ].sort((a, b) => {
      const left = /^\d+$/.test(a.block) ? BigInt(a.block) : -1n;
      const right = /^\d+$/.test(b.block) ? BigInt(b.block) : -1n;
      if (right === left) return 0;
      return right > left ? 1 : -1;
    });
    return json(200, {
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: current.toString(),
      fromBlock: fromBlock.toString(),
      history,
      current: roles,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer: HISTORY_DISCLAIMER,
      source:
        "live eth_call and eth_getLogs on Polygon (public RPC, no cache, no off-chain authority)",
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "log_query_failed";
    if (code !== "log_range_rejected") {
      return json(502, { error: "log_query_failed", address, contract: CONTRACT });
    }
    return json(200, {
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: null,
      fromBlock: null,
      history: [],
      historyError: "log_range_rejected",
      current: roles,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer: HISTORY_DISCLAIMER,
      source: "live eth_call on Polygon; eth_getLogs for this window was rejected",
    });
  }
}
