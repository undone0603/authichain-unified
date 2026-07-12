// server/jobs/token-metrics.ts
// Snapshots real on-chain $QRON metrics (total supply, decimals, block
// number, gas price) via raw Polygon JSON-RPC eth_call — no SDK, no API
// key. Logged through logActivity so getJobHistory("token-metrics") gives
// a queryable trend over time; workers/authichain-chain-data already
// serves this data on-demand, but nothing was tracking it historically.
import { logActivity } from "../db";

const QRON_TOKEN = process.env.POLYGON_QRON_TOKEN || "0xAebfA6b08fb25b59748c93273aB8880e20FfE437";
const POLYGON_RPC = "https://polygon-bor-rpc.publicnode.com";

interface TokenMetricsSnapshot {
  timestamp: string;
  contract: string;
  network: string;
  totalSupply: number | null;
  decimals: number;
  name: string;
  symbol: string;
  blockNumber: number | null;
  gasPriceGwei: number | null;
}

async function rpcCall(method: string, params: unknown[]): Promise<string | null> {
  const res = await fetch(POLYGON_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: Date.now() }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json()) as { result?: string; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result ?? null;
}

function decodeAbiString(hex: string | null): string {
  if (!hex || hex === "0x") return "";
  const stripped = hex.replace(/^0x/, "");
  if (stripped.length < 128) return "";
  const length = parseInt(stripped.slice(64, 128), 16);
  const dataHex = stripped.slice(128, 128 + length * 2);
  return Buffer.from(dataHex, "hex").toString("utf8").replace(/\0/g, "");
}

export async function collectTokenMetrics(): Promise<TokenMetricsSnapshot> {
  const [supplyHex, decimalsHex, nameHex, symbolHex, blockHex, gasPriceHex] = await Promise.all([
    rpcCall("eth_call", [{ to: QRON_TOKEN, data: "0x18160ddd" }, "latest"]).catch(() => null), // totalSupply()
    rpcCall("eth_call", [{ to: QRON_TOKEN, data: "0x313ce567" }, "latest"]).catch(() => null), // decimals()
    rpcCall("eth_call", [{ to: QRON_TOKEN, data: "0x06fdde03" }, "latest"]).catch(() => null), // name()
    rpcCall("eth_call", [{ to: QRON_TOKEN, data: "0x95d89b41" }, "latest"]).catch(() => null), // symbol()
    rpcCall("eth_blockNumber", []).catch(() => null),
    rpcCall("eth_gasPrice", []).catch(() => null),
  ]);

  const decimals = decimalsHex ? parseInt(decimalsHex, 16) : 18;

  return {
    timestamp: new Date().toISOString(),
    contract: QRON_TOKEN,
    network: "Polygon PoS",
    totalSupply: supplyHex ? parseInt(supplyHex, 16) / 10 ** decimals : null,
    decimals,
    name: decodeAbiString(nameHex) || "QRON",
    symbol: decodeAbiString(symbolHex) || "QRON",
    blockNumber: blockHex ? parseInt(blockHex, 16) : null,
    gasPriceGwei: gasPriceHex ? parseInt(gasPriceHex, 16) / 1e9 : null,
  };
}

export async function runTokenMetrics(): Promise<TokenMetricsSnapshot> {
  const snapshot = await collectTokenMetrics();

  await logActivity({
    userId: null,
    action: "token_metrics_snapshot",
    entityType: "automation",
    entityId: 0,
    details: snapshot,
  });

  return snapshot;
}
