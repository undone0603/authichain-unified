/**
 * Counts stored telemetry_events rows. The window is every stored row.
 * No duration was specified. This does not invent device counts and it
 * does not call anchorEdgeHash.
 */
import { assessChainRead } from "../../../workers/authichain-verify-worker/src/protocol-verify.mjs";

export const TELEMETRY_RPC_CAP = 8;

export const TELEMETRY_QUERY_SENTENCE =
  "Telemetry counts are rows in telemetry_events. distinctSources and readingsInWindow are those row counts. blockchainAnchored is true only when a stored anchored_tx_hash receipt succeeded and the transaction input contains that row's state_hash. Empty means zero, not a sample fleet.";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export type TelemetryCountRow = {
  source?: unknown;
  theater?: unknown;
  state_hash?: unknown;
  ledger_hash?: unknown;
  anchored_tx_hash?: unknown;
};

export type TelemetryDashboard = {
  success: true;
  platform: "QRON Industrial";
  verified: false;
  message: string;
  telemetry: {
    distinctSources: number;
    readingsInWindow: number;
    theaters: string[];
    blockchainAnchored: boolean;
    anchorReceiptsQueried: boolean;
    reason?: "rpc_cap";
  };
  devices: [];
  recentEvents: [];
  timestamp: string;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function distinct(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => value !== null)),
  ].sort();
}

async function rpcCall(
  fetchImpl: typeof fetch,
  rpc: string,
  method: string,
  params: string[]
): Promise<unknown> {
  const res = await fetchImpl(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("rpc http " + res.status);
  const body = (await res.json()) as {
    error?: { message?: string };
    result?: unknown;
  };
  if (body?.error) throw new Error(body.error.message || "rpc error");
  return body?.result ?? null;
}

function stateHashesFor(
  rows: readonly TelemetryCountRow[],
  txHash: string
): string[] {
  const hashes = new Set<string>();
  for (const row of rows) {
    const tx = textOrNull(row.anchored_tx_hash)?.toLowerCase();
    if (tx !== txHash) continue;
    const state = textOrNull(row.state_hash);
    if (state) hashes.add(state);
  }
  return [...hashes];
}

function rowMissingStateHash(
  rows: readonly TelemetryCountRow[],
  txHash: string
): boolean {
  return rows.some(row => {
    const tx = textOrNull(row.anchored_tx_hash)?.toLowerCase();
    return tx === txHash && textOrNull(row.state_hash) === null;
  });
}

/**
 * Read stored rows. blockchainAnchored follows assessChainRead on each
 * row's state_hash. ledger_hash is not the compared value.
 */
export async function summarizeTelemetry(
  rows: readonly TelemetryCountRow[],
  opts: { rpcUrl?: string | null; fetchImpl?: typeof fetch; now?: Date } = {}
): Promise<TelemetryDashboard> {
  const sources = distinct(rows.map(row => textOrNull(row.source)));
  const theaters = distinct(rows.map(row => textOrNull(row.theater)));
  const txHashes = distinct(
    rows.map(row => textOrNull(row.anchored_tx_hash)?.toLowerCase() ?? null)
  );
  const rpcUrl = typeof opts.rpcUrl === "string" ? opts.rpcUrl.trim() : "";
  let blockchainAnchored = false;
  let anchorReceiptsQueried = false;
  let reason: "rpc_cap" | undefined;

  if (txHashes.length > TELEMETRY_RPC_CAP) {
    reason = "rpc_cap";
  } else if (rpcUrl && txHashes.length > 0) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    try {
      let allPass = true;
      for (const txHash of txHashes) {
        if (!TX_HASH_RE.test(txHash) || rowMissingStateHash(rows, txHash)) {
          allPass = false;
          continue;
        }
        const [tx, receipt] = await Promise.all([
          rpcCall(fetchImpl, rpcUrl, "eth_getTransactionByHash", [txHash]),
          rpcCall(fetchImpl, rpcUrl, "eth_getTransactionReceipt", [txHash]),
        ]);
        anchorReceiptsQueried = true;
        for (const stateHash of stateHashesFor(rows, txHash)) {
          const chain = assessChainRead({ tx, receipt, recordHash: stateHash });
          if (chain.status !== "tx_contains_record_hash") allPass = false;
        }
      }
      blockchainAnchored = allPass && anchorReceiptsQueried;
    } catch {
      blockchainAnchored = false;
      anchorReceiptsQueried = false;
    }
  }

  return {
    success: true,
    platform: "QRON Industrial",
    verified: false,
    message: TELEMETRY_QUERY_SENTENCE,
    telemetry: {
      distinctSources: sources.length,
      readingsInWindow: rows.length,
      theaters,
      blockchainAnchored,
      anchorReceiptsQueried,
      ...(reason ? { reason } : {}),
    },
    devices: [],
    recentEvents: [],
    timestamp: (opts.now ?? new Date()).toISOString(),
  };
}
