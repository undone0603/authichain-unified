/**
 * Run the reference verifier, then optionally read the anchor transaction.
 * The verdict stays verifyRecord's. A missing or hash-less transaction does
 * not change it. anchorOnChain is a separate fact.
 */
import { verifyRecord, sha256Hex, signingBytes } from "../../../protocol/verifier.mjs";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export const PUBLIC_RPC = {
  "polygon:137": "https://polygon.drpc.org",
  "eip155:137": "https://polygon.drpc.org",
  "eip155:1": "https://cloudflare-eth.com",
};

export function verifySubmitted(record, anchor = null) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const result = verifyRecord(record, anchor ?? null);
  return {
    verdict: result.verdict,
    reasons: result.reasons,
    checks: result.checks,
    decision: result.verdict,
    anchored: result.verdict === "verified",
    anchorTransactionQueried: false,
  };
}

export function expectedRecordHash(record) {
  return sha256Hex(signingBytes(record));
}

export function assessChainRead({ tx, receipt, recordHash }) {
  if (!tx) return { queried: true, onChain: false, status: "tx_missing" };
  if (!receipt) return { queried: true, onChain: false, status: "no_receipt" };
  if (receipt.status !== "0x1") return { queried: true, onChain: false, status: "reverted" };
  const hash = String(recordHash || "").replace(/^sha256:/i, "").toLowerCase();
  const input = String(tx.input || tx.data || "").toLowerCase();
  if (!hash || !input.includes(hash)) {
    return { queried: true, onChain: false, status: "hash_not_in_tx", block: receipt.blockNumber ?? null };
  }
  return {
    queried: true,
    onChain: true,
    status: "tx_contains_record_hash",
    block: receipt.blockNumber ?? null,
    txFrom: typeof tx.from === "string" ? tx.from : null,
    txTo: typeof tx.to === "string" ? tx.to : null,
  };
}

class RpcDiagnosticError extends Error {
  constructor(status) {
    super(status);
    this.status = status;
  }
}

function classifyTransportError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "rpc_timeout";
  const code = error?.cause?.code || error?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "rpc_dns_error";
  return "rpc_transport_error";
}

async function rpcCall(fetchImpl, rpc, method, params) {
  let res;
  try {
    res = await fetchImpl(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw new RpcDiagnosticError(classifyTransportError(error));
  }
  if (!res.ok) throw new RpcDiagnosticError("rpc_http_error");
  let body;
  try {
    body = await res.json();
  } catch {
    throw new RpcDiagnosticError("rpc_invalid_response");
  }
  if (!body || body.jsonrpc !== "2.0" || body.id !== 1 || typeof body !== "object") {
    throw new RpcDiagnosticError("rpc_invalid_response");
  }
  if (body.error) throw new RpcDiagnosticError("rpc_provider_error");
  if (!Object.hasOwn(body, "result")) throw new RpcDiagnosticError("rpc_invalid_response");
  return body.result;
}

export async function readAnchorOnChain(record, anchor, opts = {}) {
  const chain = String(anchor?.chain || "");
  const txHash = String(anchor?.txHash || "");
  const rpc = opts.rpcUrl || PUBLIC_RPC[chain];
  if (!rpc || !TX_HASH_RE.test(txHash) || !record) {
    return { queried: false, onChain: false, status: "not_queried" };
  }
  const fetchImpl = opts.fetchImpl || fetch;
  try {
    const [tx, receipt] = await Promise.all([
      rpcCall(fetchImpl, rpc, "eth_getTransactionByHash", [txHash]),
      rpcCall(fetchImpl, rpc, "eth_getTransactionReceipt", [txHash]),
    ]);
    return assessChainRead({ tx, receipt, recordHash: expectedRecordHash(record) });
  } catch (error) {
    return {
      queried: false,
      onChain: false,
      status: error instanceof RpcDiagnosticError ? error.status : "rpc_transport_error",
    };
  }
}
