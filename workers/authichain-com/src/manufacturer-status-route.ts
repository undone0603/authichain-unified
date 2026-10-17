/**
 * Apex lookup for AuthiChainNFT role events. Runs before APP_PREFIXES so
 * /api/manufacturer-status and /verify/manufacturer are not proxied to the
 * edge router, which has no such route.
 *
 * polygon.drpc.org rejects a block distance above 100. This handler asks
 * polygon-bor-rpc.publicnode.com for the latest 10,000 blocks only. That
 * host answers that recent window and rejects older archive ranges.
 */
import { DEPLOYED_BLOCK, logFromBlock } from "../../manufacturer-status/src/window";

const CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const RPC = "https://polygon-bor-rpc.publicnode.com";
const ROLE_GRANTED =
  "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d";
const ROLE_REVOKED =
  "0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b";

const HISTORY =
  /^\/api\/manufacturer-status\/(0x[a-fA-F0-9]{40})\/history$/;

const DISCLAIMER =
  "RoleGranted / RoleRevoked events in the latest 10,000 Polygon blocks. " +
  "The free public RPC rejects longer ranges, so this is not the full history since deployment. " +
  "An event in that window is not proof of physical product authenticity, regulatory status, " +
  "or that any specific item is genuine. " +
  "Verify certificates at https://authichain.com/protocol.";

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

function page(): Response {
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manufacturer role history</title>
<main style="max-width:40rem;margin:2rem auto;font-family:system-ui,sans-serif">
  <h1>Manufacturer role history</h1>
  <p>RoleGranted and RoleRevoked events for AuthiChainNFT on Polygon. The free RPC returns only the latest 10,000 blocks. This page does not take payment, and a role event is not a product passport.</p>
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
  try {
    const currentHex = await rpc(fetchImpl, "eth_blockNumber", []);
    if (typeof currentHex !== "string") throw new Error("log_query_failed");
    const current = BigInt(currentHex);
    const fromBlock = logFromBlock(current, DEPLOYED_BLOCK);
    const filter = (topic: string) => ({
      address: CONTRACT,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + current.toString(16),
      topics: [topic, null, accountTopic(address)],
    });
    const [granted, revoked] = await Promise.all([
      rpc(fetchImpl, "eth_getLogs", [filter(ROLE_GRANTED)]),
      rpc(fetchImpl, "eth_getLogs", [filter(ROLE_REVOKED)]),
    ]);
    if (!Array.isArray(granted) || !Array.isArray(revoked)) {
      throw new Error("log_query_failed");
    }
    const history = [
      ...mapLogs(granted as RpcLog[], "granted"),
      ...mapLogs(revoked as RpcLog[], "revoked"),
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
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer: DISCLAIMER,
      source:
        "live eth_getLogs on Polygon (public RPC, no cache, no off-chain authority)",
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "log_query_failed";
    const error =
      code === "log_range_rejected" ? "log_range_rejected" : "log_query_failed";
    return json(502, { error, address, contract: CONTRACT });
  }
}
