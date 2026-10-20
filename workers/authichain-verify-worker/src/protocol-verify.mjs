/**
 * Run the reference verifier, then optionally read the anchor transaction.
 * A DigitalProductPassport is genuine only when scanProvesGenuine says so.
 * That passport leaves anchored false here. The handler applies
 * passportHashPublished after it reads the transaction. Any other record
 * keeps verifyRecord's verdict, and anchored follows that verdict.
 * A missing or hash-less transaction does not change the verdict.
 * anchorOnChain is a separate fact.
 */
import { verifyRecord, sha256Hex, signingBytes } from "../../../protocol/verifier.mjs";
import { appendPassportEvidence, scanPassport, productBindingSentence } from "../../../protocol/passport.mjs";

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

export function verifySubmitted(record, anchor = null, observation = null) {
  if (!isPlainObject(record)) return null;
  const types = Array.isArray(record.type) ? record.type : [];
  if (types.includes("DigitalProductPassport")) {
    const scan = scanPassport(record, anchor ?? null, observation);
    const result = verifyRecord(record, anchor ?? null);
    const sentence = productBindingSentence({
      genuine: scan.genuine,
      digitalIdentity: scan.digitalIdentity,
      productBinding: scan.productBinding,
      anchorTransactionQueried: false,
    });
    return {
      verdict: scan.verdict,
      reasons: scan.reasons,
      checks: result.checks,
      decision: scan.verdict,
      anchored: false,
      anchorTransactionQueried: false,
      genuine: scan.genuine,
      digitalIdentity: scan.digitalIdentity,
      productBinding: scan.productBinding,
      ...(sentence ? { productSentence: sentence } : {}),
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

export const HASH_PUBLICATION_SENTENCE =
  "The SHA-256 of this passport's signing bytes was published in a successful transaction input. That publication is a hash commitment. It does not make the product blockchain-authentic.";

export const ANCHOR_UNREAD_SENTENCE =
  "The anchor object is well formed. The transaction was not read, so publication of the hash is not confirmed.";

/**
 * A DPP is published only when the scan is genuine and the receipt succeeded
 * with the signing-bytes hash in the transaction input. No I/O.
 */
export function passportHashPublished({ genuine, chain } = {}) {
  return (
    genuine === true &&
    !!chain &&
    chain.queried === true &&
    chain.onChain === true &&
    chain.status === "tx_contains_record_hash"
  );
}

/** DPP anchored follows the publication rule. Any other record keeps its verdict bit. */
export function anchoredAfterChainRead(submitted, chain) {
  if (!submitted || typeof submitted !== "object") return false;
  if (typeof submitted.genuine === "boolean") {
    return passportHashPublished({ genuine: submitted.genuine, chain });
  }
  return submitted.anchored === true;
}

export function publicationSentence(submitted, chain) {
  if (!passportHashPublished({ genuine: submitted?.genuine === true, chain })) return null;
  return HASH_PUBLICATION_SENTENCE;
}

export function anchorUnreadSentence(submitted, chain) {
  if (submitted?.genuine === true && chain?.queried !== true) return ANCHOR_UNREAD_SENTENCE;
  return null;
}

export const HASH_PUBLICATION_EVIDENCE_ABSENT =
  "No published signing-bytes hash is stored on this passport.";

/**
 * Store one hash_publication row only when this passport's signing-bytes hash
 * was read in a successful transaction. The transaction hash has to be passed
 * in from that read. An anchor object is not the row. The row does not set
 * genuine. This function does not broadcast and it does not read the network.
 */
export function hashPublicationEvidence(metadata, input) {
  const absent = {
    stored: false,
    entry: null,
    metadata,
    message: HASH_PUBLICATION_EVIDENCE_ABSENT,
  };
  const stored = readStoredPassport(metadata);
  if (!stored || !isPlainObject(metadata) || !isPlainObject(metadata.passport)) return absent;
  const supplied = isPlainObject(input) ? input : {};
  const scan = scanPassport(stored.record, stored.anchor);
  const chain = isPlainObject(supplied.chain) ? supplied.chain : null;
  if (!passportHashPublished({ genuine: scan.genuine, chain })) return absent;
  const hex = expectedRecordHash(stored.record);
  if (typeof hex !== "string" || !/^[0-9a-f]{64}$/.test(hex)) return absent;
  const signingBytesSha256 = "sha256:" + hex;
  if (
    supplied.signingBytesSha256 !== undefined &&
    supplied.signingBytesSha256 !== null &&
    supplied.signingBytesSha256 !== signingBytesSha256
  ) {
    return absent;
  }
  const txHash = typeof supplied.txHash === "string" ? supplied.txHash : "";
  if (!TX_HASH_RE.test(txHash)) return absent;
  const entry = { type: "hash_publication", signingBytesSha256, txHash };
  try {
    const next = appendPassportEvidence(metadata, entry);
    return {
      stored: true,
      entry,
      metadata: next,
      message: HASH_PUBLICATION_SENTENCE,
    };
  } catch (err) {
    if (err && err.message === "passport_required") return absent;
    throw err;
  }
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
