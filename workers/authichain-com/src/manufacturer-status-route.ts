/**
 * Apex lookup for AuthiChainNFT role events. Runs before APP_PREFIXES so
 * /api/manufacturer-status and /verify/manufacturer are not proxied to the
 * edge router, which has no such route.
 *
 * Free RPCs are flaky: publicnode often returns "invalid block range
 * params"; drpc caps free plan distance; 1rpc caps at 50. Prefer
 * polygon.gateway.tenderly.co/public for the latest 10,000 blocks, then
 * fall back to publicnode with shrinking spans.
 */
import {
  DEPLOYED_BLOCK,
  EVENT_TOPICS,
  FREE_RPC_SPAN,
  HISTORY_DISCLAIMER,
  ROLE_IDS,
  addressFromTopic,
  compareHistory,
  logFromBlock,
  roleName,
  timestampWord,
} from "../../manufacturer-status/src/window";

const CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const RPCS = [
  "https://polygon.gateway.tenderly.co/public",
  "https://polygon-bor-rpc.publicnode.com",
] as const;


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



type RpcLog = {
  topics?: string[];
  transactionHash?: string;
  blockNumber?: string;
  logIndex?: string;
  data?: string;
};

async function rpc(
  fetchImpl: typeof fetch,
  method: string,
  params: unknown[],
  rpcUrl: string = RPCS[0]
): Promise<unknown> {
  const res = await fetchImpl(rpcUrl, {
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

async function rpcFirst(
  fetchImpl: typeof fetch,
  method: string,
  params: unknown[]
): Promise<unknown> {
  let lastErr: unknown;
  for (const url of RPCS) {
    try {
      return await rpc(fetchImpl, method, params, url);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("log_query_failed");
}

const LOG_SPANS = [FREE_RPC_SPAN, 1_000n, 100n] as const;

function rangeRejected(err: unknown): boolean {
  return err instanceof Error && err.message === "log_range_rejected";
}

async function readLogs(
  fetchImpl: typeof fetch,
  rpcUrl: string,
  address: string
): Promise<{
  current: bigint;
  fromBlock: bigint;
  granted: unknown;
  revoked: unknown;
  verified: unknown;
  unverified: unknown;
}> {
  const currentHex = await rpc(fetchImpl, "eth_blockNumber", [], rpcUrl);
  if (typeof currentHex !== "string") throw new Error("log_query_failed");
  const current = BigInt(currentHex);
  let lastErr: unknown;
  for (const span of LOG_SPANS) {
    const fromBlock = logFromBlock(current, DEPLOYED_BLOCK, span);
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
    try {
      // Serialize: parallel bursts trip flaky free RPCs.
      const granted = await rpc(fetchImpl, "eth_getLogs", [
        roleFilter(EVENT_TOPICS.roleGranted),
      ], rpcUrl);
      const revoked = await rpc(fetchImpl, "eth_getLogs", [
        roleFilter(EVENT_TOPICS.roleRevoked),
      ], rpcUrl);
      const verified = await rpc(fetchImpl, "eth_getLogs", [
        manufacturerFilter(EVENT_TOPICS.manufacturerVerified),
      ], rpcUrl);
      const unverified = await rpc(fetchImpl, "eth_getLogs", [
        manufacturerFilter(EVENT_TOPICS.manufacturerRevoked),
      ], rpcUrl);
      return { current, fromBlock, granted, revoked, verified, unverified };
    } catch (err) {
      if (!rangeRejected(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("log_range_rejected");
}

function logIndexOf(log: RpcLog): string {
  if (!log.logIndex || !/^0x[0-9a-fA-F]+$/.test(log.logIndex)) return "";
  return BigInt(log.logIndex).toString();
}

function mapLogs(logs: RpcLog[], type: "granted" | "revoked") {
  return logs.map((log) => ({
    type,
    block: log.blockNumber ? BigInt(log.blockNumber).toString() : "unknown",
    logIndex: logIndexOf(log),
    tx: log.transactionHash ?? "",
    role: roleName(log.topics?.[1] ?? ""),
    sender: addressFromTopic(log.topics?.[3]),
    timestamp: null as string | null,
  }));
}

function mapManufacturer(
  logs: RpcLog[],
  type: "manufacturer_verified" | "manufacturer_revoked"
) {
  return logs.map((log) => ({
    type,
    block: log.blockNumber ? BigInt(log.blockNumber).toString() : "unknown",
    logIndex: logIndexOf(log),
    tx: log.transactionHash ?? "",
    role: "",
    sender: "",
    timestamp: timestampWord(log.data),
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
  <p>Current minter, admin, updater, pauser, and manufacturer-verified flags are read from the contract. Our goal: a reader sees manufacturerVerified as an admin-set contract flag, not as a certificate and not as a physical inspection. manufacturerVerified is an admin-set contract flag, not a certificate. Role and manufacturer events are only the latest 10,000 blocks. This page does not take payment, and a role is not a product passport.</p>
  <form id="q">
    <label>Address <input name="address" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x…" style="width:100%"></label>
    <button type="submit">Check history</button>
  </form>
  <pre id="out"></pre>
</main>
<script>
document.getElementById("q").addEventListener("submit", async (event) => {
  event.preventDefault();
  const out = document.getElementById("out");
  out.textContent = "Checking…";
  try {
    const address = String(new FormData(event.target).get("address") || "");
    const res = await fetch("/api/manufacturer-status/" + encodeURIComponent(address) + "/history");
    const body = await res.json();
    const known = ["invalid address", "method_not_allowed", "log_query_failed"];
    if (!res.ok || body.error) {
      out.textContent = known.includes(body.error) ? body.error : "could not be read";
      return;
    }
    const current = body.current || {};
    const flag = (name, value) => name + ": " + (value ? "yes" : "no");
    const events = Array.isArray(body.history)
      ? body.history.map((item) => {
          const parts = [item.type];
          if (item.role) parts.push(item.role);
          parts.push("block " + item.block);
          if (item.sender) parts.push("sender " + item.sender);
          if (item.timestamp) parts.push("time " + item.timestamp);
          return parts.join(" ");
        }).join("; ")
      : "";
    const historyLine = body.historyError === "log_range_rejected" || body.historyError === "log_query_failed"
      ? "Event list unavailable: " + body.historyError
      : body.historyError
        ? "Event list unavailable"
        : "Events: " + (events || "none in this window");
    const scan = body.polygonscan && typeof body.polygonscan.address === "string"
      ? body.polygonscan.address
      : "";
    out.textContent = [
      flag("Admin", current.admin),
      flag("Minter", current.minter),
      flag("Updater", current.updater),
      flag("Pauser", current.pauser),
      "Manufacturer verified (admin-set contract flag): " + (current.manufacturerVerified ? "yes" : "no"),
      historyLine,
      scan ? "PolygonScan: " + scan : "",
    ].filter(Boolean).join(" | ");
  } catch {
    out.textContent = "could not be read";
  }
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
      rpcFirst(fetchImpl, "eth_call", [{ to: CONTRACT, data }, "latest"]);
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
    let read: Awaited<ReturnType<typeof readLogs>> | undefined;
    let lastErr: unknown;
    for (const url of RPCS) {
      try {
        read = await readLogs(fetchImpl, url, address);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!read) {
      throw lastErr instanceof Error ? lastErr : new Error("log_query_failed");
    }
    const { current, fromBlock, granted, revoked, verified, unverified } = read;
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
    ].sort(compareHistory);
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
    const historyError =
      code === "log_range_rejected" ? "log_range_rejected" : "log_query_failed";
    return json(200, {
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: null,
      fromBlock: null,
      history: [],
      historyError,
      current: roles,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer: HISTORY_DISCLAIMER,
      source: "live eth_call on Polygon; eth_getLogs for this window did not return events",
    });
  }
}
