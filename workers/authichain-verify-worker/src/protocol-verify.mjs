/**
 * Run the reference verifier, then optionally read the anchor transaction.
 * A DigitalProductPassport is genuine only when scanProvesGenuine says so.
 * Any other record keeps verifyRecord's verdict. A missing or hash-less
 * transaction does not change the verdict. anchorOnChain is a separate fact.
 */
import { verifyRecord, sha256Hex, signingBytes } from "../../../protocol/verifier.mjs";
import { scanProvesGenuine } from "../../../protocol/passport.mjs";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function passportCarrier(value) {
  if (!isPlainObject(value)) return null;
  const types = Array.isArray(value.type) ? value.type : [];
  if (types.includes("DigitalProductPassport")) {
    return { record: value, anchor: null };
  }
  if (!isPlainObject(value.record)) return null;
  const inner = Array.isArray(value.record.type) ? value.record.type : [];
  if (!inner.includes("DigitalProductPassport")) return null;
  return {
    record: value.record,
    anchor: isPlainObject(value.anchor) ? value.anchor : null,
  };
}

/** A stored passport already on the record. This does not assign a GTIN. */
export function readStoredPassport(metadata) {
  const direct = passportCarrier(metadata);
  if (direct) return direct;
  if (!isPlainObject(metadata)) return null;
  return passportCarrier(metadata.passport);
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export const PUBLIC_RPC = {
  "polygon:137": "https://polygon-bor-rpc.publicnode.com",
  "eip155:137": "https://polygon-bor-rpc.publicnode.com",
  "eip155:1": "https://cloudflare-eth.com",
};

export function verifySubmitted(record, anchor = null) {
  if (!isPlainObject(record)) return null;
  const types = Array.isArray(record.type) ? record.type : [];
  if (types.includes("DigitalProductPassport")) {
    const scan = scanProvesGenuine(record, anchor ?? null);
    const result = verifyRecord(record, anchor ?? null);
    return {
      verdict: scan.verdict,
      reasons: scan.reasons,
      checks: result.checks,
      decision: scan.verdict,
      anchored: scan.genuine === true,
      anchorTransactionQueried: false,
      genuine: scan.genuine,
      digitalIdentity: scan.digitalIdentity,
    };
  }
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

async function rpcCall(fetchImpl, rpc, method, params) {
  const res = await fetchImpl(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  const body = await res.json();
  if (body?.error) throw new Error(body.error.message || "rpc error");
  return body?.result ?? null;
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
  } catch {
    return { queried: false, onChain: false, status: "rpc_error" };
  }
}
