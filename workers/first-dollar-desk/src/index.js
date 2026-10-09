import Stripe from "stripe";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/src/index.js
var HUMAN_PAY = "https://buy.stripe.com/28E14n0EV9Ns11U9vu1ND3C";
var AGENT_PAY = "https://buy.stripe.com/9B65kD9brf7M4e60YY1ND3D";
var PUBLIC_MIRRORS = [
  "https://first-dollar-desk.undone-k.workers.dev",
  "https://qron.space/first-dollar",
  "https://qron.space/buy",
  "https://strainchain.io/first-dollar",
  "https://govchain.us/first-dollar"
];
function ownerEmails(env) {
  return (env.OWNER_EMAILS ?? "").split(/[,\s]+/).map((value) => value.trim().toLowerCase()).filter(Boolean);
}
__name(ownerEmails, "ownerEmails");
function operatorDomains(env) {
  return (env.OPERATOR_EMAIL_DOMAINS ?? env.OPERATOR_EMAIL_DOMAIN ?? "").split(/[,\s]+/).map((value) => value.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}
__name(operatorDomains, "operatorDomains");
function flag(value) {
  return ["true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}
__name(flag, "flag");
var USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
var USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
var PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
var TREASURY_FUNDER = "0x0780cf08b9a5504a828e666ff38f90e49653560f";
var INDEX_FAUCET = "0xff88c61203b2dd0720bddfacab4c571c9f17274e";
var BLOCKSCOUT = "https://base.blockscout.com/api?module=account&action=tokentx";
function ownerWallets(env) {
  const extra = (env.OWNER_WALLETS ?? "").split(/[,\s]+/).map((value) => value.trim().toLowerCase()).filter(Boolean);
  return /* @__PURE__ */ new Set([PAY_TO.toLowerCase(), TREASURY_FUNDER, INDEX_FAUCET, ...extra]);
}
__name(ownerWallets, "ownerWallets");
function isOwnerWallet(address, env) {
  return ownerWallets(env).has(String(address ?? "").trim().toLowerCase());
}
__name(isOwnerWallet, "isOwnerWallet");
function isSelfPay(input, env) {
  const email = (input.email ?? "").trim().toLowerCase();
  const name = (input.name ?? "").trim().toLowerCase();
  const wallet = (input.wallet ?? email.replace(/^wallet:/, "")).trim().toLowerCase();
  const metadata = input.metadata ?? {};
  const meta = Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join(" ").toLowerCase();
  if (wallet && isOwnerWallet(wallet, env)) {
    return true;
  }
  if (flag(metadata.smoke) || flag(metadata.self_pay) || flag(metadata.is_demo)) {
    return true;
  }
  const leadId = String(metadata.lead_id ?? "").toLowerCase();
  if (leadId === "lead_test_closer" || leadId.startsWith("lead_test")) {
    return true;
  }
  if (meta.includes("smoke") || String(metadata.purpose ?? "").toLowerCase().includes("smoke") || String(metadata.visit_id ?? "").toLowerCase().includes("smoke")) {
    return true;
  }
  const local = email.split("@")[0] ?? "";
  const domain = email.split("@")[1] ?? "";
  if (email.startsWith("smoke+") || email.includes("+smoke") || local === "dpp-smoke" || local === "ledger-test") {
    return true;
  }
  for (const operator of operatorDomains(env)) {
    if (domain === operator || domain.endsWith(`.${operator}`)) {
      return true;
    }
  }
  if (ownerEmails(env).includes(email)) {
    return true;
  }
  if (name.includes("smoke test") || name.includes("owner smoke")) {
    return true;
  }
  return false;
}
__name(isSelfPay, "isSelfPay");
function classify(input, env) {
  const selfPay = isSelfPay(input, env);
  const minCents = input.rail === "human" ? 100 : 1;
  const tooSmall = input.amountCents < minCents;
  const testnet = Boolean(input.metadata?.testnet) || input.network === "eip155:84532";
  const gatewaySale = input.metadata?.gateway === "fiatdock" && Boolean(input.metadata?.fiatdockCallId);
  const x402 = Boolean(input.metadata?.x402 || input.metadata?.facilitator);
  const x402Incomplete = x402 && !gatewaySale && (!input.wallet || !input.txHash);
  const facilitatorSettled = x402 && Boolean(
    input.wallet && (input.txHash || gatewaySale && input.metadata?.gatewayDelivered === "1")
  );
  const onchainUnproven = Boolean(input.txHash) && !selfPay && !facilitatorSettled;
  return {
    ...input,
    status: selfPay ? "rejected_self_pay" : testnet || tooSmall || onchainUnproven || x402Incomplete ? "pending" : "qualified",
    reason: selfPay ? "Self-pay / founder / smoke test \u2014 does not count." : testnet ? "Testnet settlement does not count." : x402Incomplete ? "Agent settlement missing payer or transaction." : tooSmall ? "Settled amount is below the first-dollar threshold." : onchainUnproven ? "On-chain USDC inbound; third-party payer not proven." : gatewaySale && !input.wallet ? "FiatDock gateway sale; awaiting payer wallet or on-chain proof." : facilitatorSettled ? gatewaySale ? "FiatDock gateway-forwarded x402 from a non-owner wallet." : "Facilitator-settled x402 from a non-owner wallet." : "Live Stripe settlement from a third-party payer."
  };
}
__name(classify, "classify");
function classifyOnchain(tx, env) {
  const from = String(tx.from ?? "").toLowerCase();
  const to = String(tx.to ?? "").toLowerCase();
  const atomic = BigInt(tx.value ?? "0");
  const amountCents = Number(atomic / 10000n);
  const testnet = String(tx.contractAddress ?? "").toLowerCase() === USDC_SEPOLIA.toLowerCase() || tx.network === "eip155:84532";
  const network = testnet ? "eip155:84532" : "eip155:8453";
  const asset = testnet ? USDC_SEPOLIA : USDC;
  return classify(
    {
      id: `${testnet ? "sepolia" : "base"}_usdc_${tx.hash}`,
      rail: "agent",
      amountCents,
      currency: "usdc",
      email: `wallet:${from}`,
      name: from,
      wallet: from,
      txHash: tx.hash,
      createdAt: new Date(Number(tx.timeStamp) * 1e3).toISOString(),
      metadata: {
        network,
        asset,
        payTo: PAY_TO,
        from,
        to,
        testnet
      },
      network
    },
    env
  );
}
__name(classifyOnchain, "classifyOnchain");
function tokenAddress(row) {
  return String(
    row.contractAddress ?? row.token?.address ?? row.token?.address_hash ?? ""
  ).toLowerCase();
}
__name(tokenAddress, "tokenAddress");
function normalizeTransfers(payload) {
  if (Array.isArray(payload?.result)) {
    return payload.result.map((row) => ({
      hash: row.hash,
      from: row.from,
      to: row.to,
      value: row.value,
      timeStamp: row.timeStamp,
      contractAddress: row.contractAddress
    }));
  }
  const items = payload?.items;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((row) => ({
    hash: row.transaction_hash ?? row.tx_hash,
    from: row.from?.hash ?? row.from,
    to: row.to?.hash ?? row.to,
    value: row.total?.value ?? row.value,
    timeStamp: row.timestamp ? String(Math.floor(Date.parse(row.timestamp) / 1e3)) : row.timeStamp,
    contractAddress: row.token?.address ?? row.token?.address_hash
  }));
}
__name(normalizeTransfers, "normalizeTransfers");
var TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
var BASE_RPCS = [
  "https://base.gateway.tenderly.co",
  "https://base.publicnode.com",
  "https://base.drpc.org",
  "https://mainnet.base.org"
];
var BASE_RPC_PREFERRED_KV = "base_rpc_preferred";
var SEPOLIA_RPCS = ["https://base-sepolia.gateway.tenderly.co"];
async function rpcCall(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).host}:${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? "rpc_error");
  }
  return payload.result;
}
__name(rpcCall, "rpcCall");
var RPC_CHUNK_BLOCKS = 250n;
var RPC_CATCHUP_CHUNKS = 10;
var RPC_INTER_CHUNK_MS = 120;
async function sleepMs(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleepMs, "sleepMs");
async function fetchTransferLogs(url, asset, toTopic, start, end) {
  const logs = await rpcCall(url, "eth_getLogs", [
    {
      address: asset,
      fromBlock: `0x${start.toString(16)}`,
      toBlock: `0x${end.toString(16)}`,
      topics: [TRANSFER_TOPIC, null, toTopic]
    }
  ]);
  return logs ?? [];
}
__name(fetchTransferLogs, "fetchTransferLogs");
async function orderedBaseRpcs(env) {
  const preferred = env?.LEDGER ? (await env.LEDGER.get(BASE_RPC_PREFERRED_KV))?.trim() : "";
  const list = [...BASE_RPCS];
  if (preferred && list.includes(preferred)) {
    return [preferred, ...list.filter((u) => u !== preferred)];
  }
  return list;
}
__name(orderedBaseRpcs, "orderedBaseRpcs");
async function fetchTransfersFromRpc(asset, rpcs, network, scanFromBlock = null, env = null) {
  const toTopic = `0x000000000000000000000000${PAY_TO.slice(2).toLowerCase()}`;
  const errors = [];
  const urls = network === "eip155:8453" && env?.LEDGER ? await orderedBaseRpcs(env) : rpcs;
  for (const url of urls) {
    try {
      const latest = BigInt(await rpcCall(url, "eth_blockNumber", []));
      let from = scanFromBlock !== null && scanFromBlock !== void 0 ? BigInt(scanFromBlock) : latest - RPC_CHUNK_BLOCKS;
      if (from > latest) {
        from = latest > RPC_CHUNK_BLOCKS ? latest - RPC_CHUNK_BLOCKS : 0n;
      }
      const rows = [];
      let chunks = 0;
      let chunkSize = RPC_CHUNK_BLOCKS;
      for (let start = from; start <= latest && chunks < RPC_CATCHUP_CHUNKS; ) {
        const end = start + chunkSize - 1n > latest ? latest : start + chunkSize - 1n;
        let logs;
        try {
          logs = await fetchTransferLogs(url, asset, toTopic, start, end);
        } catch (error) {
          const message = String(error?.message ?? error);
          if (chunkSize > 80n && /429|limit|too many|range|query timeout/i.test(message)) {
            chunkSize = chunkSize / 2n;
            continue;
          }
          throw error;
        }
        chunks += 1;
        for (const log of logs) {
          rows.push({
            hash: log.transactionHash,
            from: `0x${String(log.topics[1]).slice(-40)}`,
            to: `0x${String(log.topics[2]).slice(-40)}`,
            value: BigInt(log.data).toString(),
            timeStamp: String(Math.floor(Date.now() / 1e3)),
            contractAddress: asset,
            network
          });
        }
        if (end >= latest) break;
        start = end + 1n;
        if (RPC_INTER_CHUNK_MS > 0) await sleepMs(RPC_INTER_CHUNK_MS);
      }
      if (env?.LEDGER && network === "eip155:8453") {
        await env.LEDGER.put(BASE_RPC_PREFERRED_KV, url);
      }
      return { rows, errors, source: url, latestBlock: latest.toString() };
    } catch (error) {
      errors.push(`${new URL(url).host}:${String(error?.message ?? error)}`);
    }
  }
  return { rows: [], errors };
}
__name(fetchTransfersFromRpc, "fetchTransfersFromRpc");
async function fetchTransfers(scanFromBlock = null, env = null) {
  const urls = [
    `${BLOCKSCOUT}&address=${PAY_TO}&contractaddress=${USDC}&sort=desc&page=1&offset=50`,
    `https://base.blockscout.com/api/v2/addresses/${PAY_TO}/token-transfers?type=ERC-20`
  ];
  const errors = [];
  let blockscoutRows = [];
  let skipBlockscout = false;
  if (env?.LEDGER) {
    const until = await env.LEDGER.get("blockscout_backoff_until");
    if (until && Date.now() < Date.parse(until)) {
      skipBlockscout = true;
      errors.push("blockscout:backoff");
    }
  }
  for (const url of skipBlockscout ? [] : urls) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "first-dollar-desk/1"
        }
      });
      if (!response.ok) {
        errors.push(`${new URL(url).pathname}:${response.status}`);
        if (response.status === 429 && env?.LEDGER) {
          await env.LEDGER.put(
            "blockscout_backoff_until",
            new Date(Date.now() + 5 * 6e4).toISOString()
          );
        }
        continue;
      }
      const rows = normalizeTransfers(await response.json()).filter(
        (tx) => String(tx.to ?? "").toLowerCase() === PAY_TO.toLowerCase() && tokenAddress(tx) === USDC.toLowerCase()
      );
      if (rows.length) {
        blockscoutRows = rows;
        break;
      }
      errors.push(`${new URL(url).pathname}:empty`);
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }
  const rpc = await fetchTransfersFromRpc(
    USDC,
    BASE_RPCS,
    "eip155:8453",
    scanFromBlock
  );
  const sepolia = await fetchTransfersFromRpc(
    USDC_SEPOLIA,
    SEPOLIA_RPCS,
    "eip155:84532",
    null
  );
  const byHash = /* @__PURE__ */ new Map();
  for (const row of [...blockscoutRows, ...rpc.rows, ...sepolia.rows]) {
    if (row.hash) byHash.set(String(row.hash).toLowerCase(), row);
  }
  return {
    rows: [...byHash.values()],
    errors: [...errors, ...rpc.errors ?? [], ...sepolia.errors ?? []],
    latestBlock: rpc.latestBlock ?? null,
    rpcSource: rpc.source ?? null
  };
}
__name(fetchTransfers, "fetchTransfers");
var STRIPE_HUMAN_PLINK = "plink_1UIRFjGqTruSqV8T0VeKsqzU";
var STRIPE_AGENT_PLINK = "plink_1UIRFkGqTruSqV8TThRgOS44";
async function fetchStripeSessionById(secret, sessionId) {
  const id = String(sessionId ?? "").trim();
  if (!id.startsWith("cs_")) return { session: null, error: "invalid_session_id" };
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  const body = await response.json();
  if (!response.ok) {
    return { session: null, error: body?.error?.message ?? response.status };
  }
  return { session: body, error: null };
}
__name(fetchStripeSessionById, "fetchStripeSessionById");
async function readThanksQueue(env) {
  const raw = await env.LEDGER.get("stripe_session_queue");
  if (!raw) return { depth: 0, ids: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { depth: 0, ids: [] };
    const ids = parsed.filter((id) => /^cs_live_[a-zA-Z0-9]+$/.test(String(id).trim()));
    if (ids.length !== parsed.length) {
      await env.LEDGER.put("stripe_session_queue", JSON.stringify(ids.slice(0, 100)));
    }
    return { depth: ids.length, ids: ids.slice(0, 20) };
  } catch {
    return { depth: 0, ids: [] };
  }
}
__name(readThanksQueue, "readThanksQueue");
async function queueStripeSession(env, sessionId) {
  const id = String(sessionId ?? "").trim();
  if (!/^cs_live_[a-zA-Z0-9]+$/.test(id)) return;
  const raw = await env.LEDGER.get("stripe_session_queue");
  let ids = [];
  try {
    ids = raw ? JSON.parse(raw) : [];
  } catch {
    ids = [];
  }
  if (!ids.includes(id)) {
    ids.unshift(id);
  }
  await env.LEDGER.put("stripe_session_queue", JSON.stringify(ids.slice(0, 100)));
}
__name(queueStripeSession, "queueStripeSession");
async function syncQueuedStripeSessions(env, secret) {
  const raw = await env.LEDGER.get("stripe_session_queue");
  let ids = [];
  try {
    ids = raw ? JSON.parse(raw) : [];
  } catch {
    ids = [];
  }
  let written = 0;
  const remaining = [];
  for (const id of ids) {
    const { session, error } = await fetchStripeSessionById(secret, id);
    if (!session) {
      if (error && String(error).includes("No such checkout.session")) continue;
      remaining.push(id);
      continue;
    }
    if (session.payment_status === "paid") {
      await writeReceipt(env, classify(receiptFromSession(session), env));
      written += 1;
    } else {
      remaining.push(id);
    }
  }
  await env.LEDGER.put("stripe_session_queue", JSON.stringify(remaining.slice(0, 100)));
  return { written, queued: remaining.length };
}
__name(syncQueuedStripeSessions, "syncQueuedStripeSessions");
async function fetchStripeSessions(secret, paymentLinkId2) {
  const params = new URLSearchParams({
    payment_link: paymentLinkId2,
    status: "complete",
    limit: "25"
  });
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions?${params}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  const body = await response.json();
  if (!response.ok) {
    return { sessions: [], error: body?.error?.message ?? response.status };
  }
  return { sessions: body.data ?? [], error: null };
}
__name(fetchStripeSessions, "fetchStripeSessions");
async function syncStripe(env) {
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  const webhookSecret = (env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return webhookSecret ? {
      skipped: true,
      reason: "STRIPE_SECRET_KEY unset; checkout.session.completed webhooks are active",
      webhook: true,
      polling: false
    } : { skipped: true, reason: "STRIPE_SECRET_KEY unset on worker", webhook: false };
  }
  const lastRaw = await env.LEDGER.get("stripe_sync_at");
  if (lastRaw && Date.now() - Date.parse(lastRaw) < 6e4) {
    return { skipped: true };
  }
  let written = 0;
  const errors = [];
  for (const plink of [STRIPE_HUMAN_PLINK, STRIPE_AGENT_PLINK]) {
    const { sessions, error } = await fetchStripeSessions(secret, plink);
    if (error) errors.push(`${plink}:${error}`);
    for (const session of sessions) {
      if (session.payment_status !== "paid") continue;
      await writeReceipt(env, classify(receiptFromSession(session), env));
      written += 1;
    }
  }
  const queued = await syncQueuedStripeSessions(env, secret);
  written += queued.written;
  await env.LEDGER.put("stripe_sync_at", (/* @__PURE__ */ new Date()).toISOString());
  return { written, errors, queued };
}
__name(syncStripe, "syncStripe");
async function syncOnchain(env, options = {}) {
  const lastRaw = await env.LEDGER.get("onchain_sync_at");
  if (!options.force && lastRaw && Date.now() - Date.parse(lastRaw) < 45e3) {
    return { skipped: true };
  }
  const scanFrom = await env.LEDGER.get("onchain_scan_from");
  const { rows, errors, latestBlock, rpcSource } = await fetchTransfers(scanFrom, env);
  let written = 0;
  for (const tx of rows) {
    await writeReceipt(env, classifyOnchain(tx, env));
    written += 1;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.LEDGER.put("onchain_sync_at", now);
  if (latestBlock) {
    const nextFrom = BigInt(latestBlock) > RPC_CHUNK_BLOCKS ? BigInt(latestBlock) - RPC_CHUNK_BLOCKS : 0n;
    await env.LEDGER.put("onchain_scan_from", nextFrom.toString());
  }
  await reconcilePendingFacilitatorReceipts(env);
  return {
    written,
    scanned: rows.length,
    errors,
    scanFrom: scanFrom ?? null,
    rpcSource: rpcSource ?? null
  };
}
__name(syncOnchain, "syncOnchain");
async function reconcilePendingFacilitatorReceipts(env) {
  const ledger = await readLedger(env);
  let dirty = false;
  const chainCandidates = (ledger.receipts ?? []).filter(
    (row) => row.rail === "agent" && row.txHash && row.wallet && row.status !== "rejected_self_pay" && !row.metadata?.x402
  );
  for (let index = 0; index < (ledger.receipts ?? []).length; index += 1) {
    const item = ledger.receipts[index];
    if (item.status !== "pending" || !item.metadata?.x402 || item.txHash) continue;
    const created = Date.parse(item.createdAt ?? "");
    const matchByTx = chainCandidates.find(
      (row) => item.metadata?.facilitatorTxHint && row.txHash && String(row.txHash).toLowerCase() === String(item.metadata.facilitatorTxHint).toLowerCase()
    );
    const match = matchByTx ?? chainCandidates.find((row) => {
      if (row.amountCents !== item.amountCents) return false;
      const seen = Date.parse(row.createdAt ?? "");
      if (!Number.isFinite(created) || !Number.isFinite(seen)) return true;
      return seen >= created - 12e4 && seen <= created + 36e5;
    });
    if (!match) continue;
    const merged = classify(
      {
        ...item,
        wallet: match.wallet,
        txHash: match.txHash,
        email: match.email || item.email,
        network: match.network ?? item.network,
        metadata: {
          ...item.metadata ?? {},
          x402: "1",
          reconciledOnchainId: match.id
        }
      },
      env
    );
    ledger.receipts[index] = merged;
    dirty = true;
  }
  if (dirty) {
    ledger.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.LEDGER.put("ledger", JSON.stringify(ledger));
  }
  return { reconciled: dirty };
}
__name(reconcilePendingFacilitatorReceipts, "reconcilePendingFacilitatorReceipts");
function agentGoalEligible(receipt) {
  if (receipt.rail !== "agent" || receipt.status !== "qualified") return false;
  if (receipt.amountCents < 1) return false;
  if (receipt.metadata?.testnet || receipt.network === "eip155:84532") return false;
  const cardOnlyAgentStripe = Boolean(receipt.stripeCheckoutSessionId) && !receipt.metadata?.x402 && !receipt.metadata?.facilitator && receipt.metadata?.gateway !== "fiatdock";
  if (cardOnlyAgentStripe) return false;
  const gatewaySale = receipt.metadata?.gateway === "fiatdock" && Boolean(receipt.metadata?.fiatdockCallId);
  return Boolean(
    receipt.wallet && receipt.txHash || gatewaySale && receipt.metadata?.gatewayDelivered === "1"
  );
}
__name(agentGoalEligible, "agentGoalEligible");
function sanitizeReceipt(receipt, env) {
  if (receipt.status !== "qualified") return receipt;
  if (receipt.rail === "agent" && !agentGoalEligible({ ...receipt, status: "qualified" })) {
    return classify(
      {
        ...receipt,
        metadata: {
          ...receipt.metadata ?? {},
          x402: receipt.metadata?.x402 ?? (receipt.id?.startsWith("x402_") ? "1" : void 0),
          facilitator: receipt.metadata?.facilitator
        }
      },
      env
    );
  }
  return classify(receipt, env);
}
__name(sanitizeReceipt, "sanitizeReceipt");
async function readLedger(env) {
  const raw = await env.LEDGER.get("ledger");
  if (!raw) {
    return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), receipts: [] };
  }
  const ledger = JSON.parse(raw);
  let dirty = false;
  ledger.receipts = (ledger.receipts ?? []).map((item) => {
    const next = sanitizeReceipt(item, env);
    if (next.status !== item.status || next.reason !== item.reason) {
      dirty = true;
    }
    return next;
  });
  if (dirty) {
    ledger.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.LEDGER.put("ledger", JSON.stringify(ledger));
  }
  return ledger;
}
__name(readLedger, "readLedger");
async function writeReceipt(env, receipt) {
  const ledger = await readLedger(env);
  const index = ledger.receipts.findIndex(
    (item) => receipt.stripeChargeId && item.stripeChargeId === receipt.stripeChargeId || receipt.stripePaymentIntentId && item.stripePaymentIntentId === receipt.stripePaymentIntentId || receipt.stripeCheckoutSessionId && item.stripeCheckoutSessionId === receipt.stripeCheckoutSessionId || receipt.txHash && item.txHash === receipt.txHash || item.id === receipt.id
  );
  if (index >= 0) {
    ledger.receipts[index] = { ...ledger.receipts[index], ...receipt };
  } else {
    ledger.receipts.unshift(receipt);
  }
  ledger.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await env.LEDGER.put("ledger", JSON.stringify(ledger));
  return ledger;
}
__name(writeReceipt, "writeReceipt");
function goalState(ledger) {
  const human = ledger.receipts.find(
    (receipt) => receipt.rail === "human" && receipt.status === "qualified" && receipt.amountCents >= 100
  );
  const agent = ledger.receipts.find((receipt) => agentGoalEligible(receipt));
  return {
    firstHumanDollar: Boolean(human),
    firstAgenticSale: Boolean(agent),
    complete: Boolean(human && agent),
    rejectedSelfPay: ledger.receipts.filter(
      (receipt) => receipt.status === "rejected_self_pay"
    ).length
  };
}
__name(goalState, "goalState");
async function readAgent402DispatchCache(env) {
  const raw = await env.LEDGER.get("agent402_dispatch");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
__name(readAgent402DispatchCache, "readAgent402DispatchCache");
async function refreshAgent402DispatchCache(env, origin) {
  const host = new URL(origin).host;
  const indexUrl = `https://agent402.tools/api/index?seller=${encodeURIComponent(host)}`;
  try {
    const response = await fetch(indexUrl, {
      headers: { accept: "application/json", "user-agent": "first-dollar-desk/1" }
    });
    if (!response.ok) return null;
    const body = await response.json();
    const snapshot = {
      at: (/* @__PURE__ */ new Date()).toISOString(),
      routable: Boolean(body.routable),
      routerDispatchEligible: Boolean(body.routerDispatchEligible),
      routerDispatchReason: body.routerDispatchReason ?? null,
      routerDispatchDetail: body.routerDispatchByChain?.base?.detail ?? null,
      routeSearchUrl: "https://agent402.tools/api/route?q=first%20dollar%20verify&include=external",
      indexUrl,
      note: body.routerDispatchEligible === false ? "Agent402 Smart Order Router will not pay this seller yet. Autonomous agents must settle x402 directly (MCP verify or POST /api/agent/verify) with a non-owner wallet." : "Agent402 router may pay this seller on your behalf."
    };
    await env.LEDGER.put("agent402_dispatch", JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}
__name(refreshAgent402DispatchCache, "refreshAgent402DispatchCache");
function firstDollarBountyManifest(origin, goal) {
  return {
    spec: "first-dollar-desk-goal/1",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    complete: Boolean(goal?.complete),
    open: {
      humanThirdPartyDollar: !goal?.firstHumanDollar,
      agentThirdPartyX402: !goal?.firstAgenticSale
    },
    human: {
      minUsd: 1,
      currency: "usd",
      checkout: HUMAN_PAY,
      landing: `${origin}/human`,
      rail: "stripe_checkout",
      selfPayExcluded: true
    },
    agent: {
      minUsd: 0.05,
      currency: "usdc",
      network: "eip155:8453",
      payTo: PAY_TO,
      asset: USDC,
      verifyUrl: `${origin}/api/agent/verify`,
      mcpUrl: `${origin}/mcp`,
      mcpPaidTool: "verify",
      freeMcpTools: ["get_goal", "get_pricing"],
      selfPayExcluded: true,
      stripeCardFallbackDoesNotCount: AGENT_PAY
    },
    proof: {
      ledger: `${origin}/api/ledger`,
      goal: `${origin}/api/goal`
    },
    instruction: "Two third-party receipts required: (1) human \u2265$1 Stripe at human.checkout; (2) agent x402/MCP verify with non-owner wallet+tx on Base. Operator wallets and smoke tests are rejected.",
    payapiListingForm: "https://payapi.market/list",
    ...goal?.complete ? {} : {
      nextActions: {
        human: "Non-operator pays \u2265$1 at human.checkout or human.landing",
        agent: "Non-owner wallet settles agent.verifyUrl or MCP verify tool",
        payapi: "Submit payapiListingForm for marketplace canary (third-party wallet)"
      }
    }
  };
}
__name(firstDollarBountyManifest, "firstDollarBountyManifest");
async function goalExtras(env, thanksQueue = null) {
  const [lastStripeWebhookRaw, onchainSyncAt, agent402Dispatch] = await Promise.all([
    env.LEDGER.get("stripe_webhook_last"),
    env.LEDGER.get("onchain_sync_at"),
    readAgent402DispatchCache(env)
  ]);
  let lastStripeWebhook = null;
  if (lastStripeWebhookRaw) {
    try {
      lastStripeWebhook = JSON.parse(lastStripeWebhookRaw);
    } catch {
      lastStripeWebhook = null;
    }
  }
  return {
    thanksQueueDepth: thanksQueue?.depth ?? null,
    thanksQueueSessionIds: thanksQueue && thanksQueue.depth > 0 ? thanksQueue.ids : null,
    lastStripeWebhook,
    onchainSyncAt: onchainSyncAt ?? null,
    agent402Dispatch
  };
}
__name(goalExtras, "goalExtras");
function goalPayload(ledger, origin, env = {}, extras = {}) {
  const goal = goalState(ledger);
  const stripeWebhook = Boolean(String(env.STRIPE_WEBHOOK_SECRET ?? "").trim());
  const stripePolling = Boolean(String(env.STRIPE_SECRET_KEY ?? "").trim());
  const receipts = ledger.receipts ?? [];
  return {
    ...goal,
    receiptsSummary: {
      total: receipts.length,
      qualified: receipts.filter((r) => r.status === "qualified").length,
      pending: receipts.filter((r) => r.status === "pending").length,
      rejectedSelfPay: receipts.filter((r) => r.status === "rejected_self_pay").length
    },
    stripeIngestion: {
      webhook: stripeWebhook,
      polling: stripePolling,
      thanksQueue: true,
      thanksQueueDepth: typeof extras.thanksQueueDepth === "number" ? extras.thanksQueueDepth : null,
      thanksQueueSessionIds: Array.isArray(extras.thanksQueueSessionIds) ? extras.thanksQueueSessionIds : null,
      pushSessionUrl: `${origin}/api/stripe/push-session`,
      lastWebhook: extras.lastStripeWebhook ?? null,
      onchainSyncAt: extras.onchainSyncAt ?? null
    },
    humanCheckout: HUMAN_PAY,
    humanShortUrl: `${origin}/human`,
    agentVerifyUrl: `${origin}/api/agent/verify`,
    agentShortUrl: `${origin}/agent`,
    agentMcpUrl: `${origin}/mcp`,
    agentStripeCheckout: AGENT_PAY,
    agentPriceUsd: [0.05, 1],
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: USDC,
    selfPayExcluded: true,
    mirrors: PUBLIC_MIRRORS,
    agentRailNote: "Agent goal requires machine x402/USDC settlement (wallet+tx). Agent Stripe card link is human-in-loop and does not count.",
    ledgerUrl: `${origin}/api/ledger`,
    catalogUrl: `${origin}/api/catalog`,
    instruction: "Qualify the First Dollar goal: (1) third-party human pays \u2265$1 at humanCheckout via Stripe; (2) non-owner agent settles x402 on agentVerifyUrl or MCP tool verify ($0.05+ USDC Base). Operator/owner wallets do not count.",
    share: {
      humanPage: `${origin}/human`,
      agentPage: `${origin}/agent`,
      humanStripe: HUMAN_PAY,
      verify402: `${origin}/api/agent/verify`,
      mcp: `${origin}/mcp`,
      ledger: `${origin}/api/ledger`
    },
    bountyManifestUrl: `${origin}/.well-known/first-dollar-goal.json`,
    discovery: {
      agent402: extras.agent402Dispatch ?? null,
      payapiListing: "https://payapi.market/list",
      agent402RouteSearch: "https://agent402.tools/api/route?q=first%20dollar%20verify&include=external",
      directX402Required: extras.agent402Dispatch?.routerDispatchEligible !== true
    },
    ...goal.complete ? {} : {
      nextActions: {
        human: "A non-operator completes Stripe Checkout \u2265$1 at humanShortUrl or humanCheckout; webhook ingests without manual steps.",
        agent: "A non-owner wallet settles x402 on agentVerifyUrl or MCP tool verify ($0.05+ USDC Base). Agent Stripe card does not count.",
        discovery: "Listed on agent402.tools and x402scan; submit PayAPI form at discovery.payapiListing for marketplace canary traffic.",
        optionalWorkerSecrets: [
          "STRIPE_SECRET_KEY \u2014 poll payment links + drain /thanks",
          "FIATDOCK_GATEWAY_SECRET \u2014 FiatDock marketplace gateway"
        ]
      }
    }
  };
}
__name(goalPayload, "goalPayload");
function isRead(method) {
  return method === "GET" || method === "HEAD";
}
__name(isRead, "isRead");
function maybeHead(request, response) {
  if (request.method !== "HEAD") {
    return response;
  }
  return new Response(null, {
    status: response.status,
    headers: response.headers
  });
}
__name(maybeHead, "maybeHead");
function verifyTools(origin) {
  const resource = `${origin}/api/agent/verify`;
  const discovery = {
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Use verify." }
      },
      required: ["productId"]
    },
    example: { productId: "verify" }
  };
  return [
    {
      name: "First Dollar Desk verify credit",
      slug: "first-dollar-verify-credit",
      category: "verification",
      route: "POST /api/agent/verify",
      method: "POST",
      path: "/api/agent/verify",
      endpoint: resource,
      url: resource,
      price: "$0.05",
      price_usd: 0.05,
      description: "Paid agent verify credit. $0.05 or $1.00 USDC on Base. Owner wallets and self-pay are rejected.",
      summary: "HTTP 402 verify credit for a third-party agent.",
      tags: ["verification", "x402", "first-dollar", "usdc", "base"],
      discovery,
      accepts: [
        { scheme: "exact", network: "eip155:8453", amount: "50000", asset: USDC, payTo: PAY_TO },
        { scheme: "exact", network: "eip155:8453", amount: "1000000", asset: USDC, payTo: PAY_TO }
      ]
    },
    {
      name: "First Dollar Desk verify challenge",
      slug: "first-dollar-verify-challenge",
      category: "verification",
      route: "GET /api/agent/verify",
      method: "GET",
      path: "/api/agent/verify",
      endpoint: resource,
      url: resource,
      price: "$0.05",
      price_usd: 0.05,
      description: "Unpaid GET returns HTTP 402 for a first-dollar agent verify credit on Base USDC.",
      summary: "Discover the 402 challenge for agent verify.",
      tags: ["verification", "x402", "first-dollar"],
      discovery: { inputSchema: { type: "object", properties: {} }, example: {} },
      accepts: [
        { scheme: "exact", network: "eip155:8453", amount: "50000", asset: USDC, payTo: PAY_TO }
      ]
    }
  ];
}
__name(verifyTools, "verifyTools");
function serviceManifest(origin) {
  const tools = verifyTools(origin);
  return {
    spec: "agent402-service-manifest/1",
    version: 1,
    x402Version: 2,
    name: "First Dollar Desk",
    summary: "Third-party $1 human Stripe checkout and $0.05/$1.00 agent verify credit over HTTP 402 on Base USDC. Owner wallets are rejected.",
    homepage: origin,
    url: origin,
    documentation: `${origin}/llms.txt`,
    resources: [
      `${origin}/api/agent/verify`,
      "GET /api/agent/verify",
      "POST /api/agent/verify",
      ...tools
    ],
    tools,
    endpoints: tools.map((tool) => ({
      path: tool.path,
      methods: [tool.method],
      name: tool.name,
      price: tool.price,
      description: tool.description
    })),
    payment: {
      protocol: "x402",
      network: "eip155:8453",
      asset: USDC,
      payTo: PAY_TO,
      currency: "USDC",
      selfPayExcluded: true
    },
    capabilities: { tools: tools.length, categories: ["verification"] },
    machineReadable: {
      openapi: `${origin}/openapi.json`,
      pricing: `${origin}/api/pricing`,
      goal: `${origin}/api/goal`,
      ledger: `${origin}/api/ledger`,
      llmsTxt: `${origin}/llms.txt`,
      mcp: `${origin}/mcp`,
      catalog: `${origin}/.well-known/x402.json`
    },
    humanPay: HUMAN_PAY,
    humanShortUrl: `${origin}/human`,
    agentPay: `${origin}/api/agent/verify`,
    agentShortUrl: `${origin}/agent`,
    goalUrl: `${origin}/api/goal`
  };
}
__name(serviceManifest, "serviceManifest");
function htmlThanksPage({ sessionId, recorded, goal, note }) {
  const status = goal?.complete ? "Both First Dollar rails are satisfied." : goal?.firstHumanDollar ? "Human dollar recorded. Waiting for a qualifying agent sale." : goal?.firstAgenticSale ? "Agent sale recorded. Waiting for a qualifying human dollar." : "Payment received. Qualifying third-party receipts still pending on the ledger.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Thanks \u2014 First Dollar Desk</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f4efe6; color: #1c1914; }
    main { max-width: 640px; margin: 0 auto; padding: 48px 20px; }
    .note { font-size: 13px; color: #5c564c; }
    a.btn { display: inline-block; margin-top: 16px; padding: 10px 14px; background: #1c1914; color: #fff; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <p class="note">CHECKOUT COMPLETE</p>
    <h1>Thank you.</h1>
    <p>${status}</p>
    ${sessionId ? `<p class="note">Session <code>${sessionId}</code> ${recorded ? "was written to" : "is queued for"} the public ledger.</p>
    <p class="note" id="ledger-live">Checking ledger for your receipt\u2026</p>` : ""}
    ${note ? `<p class="note">${note}</p>` : ""}
    <a class="btn" href="/api/ledger">View ledger JSON</a>
    <p class="note"><a href="/">Back to desk</a></p>
    ${sessionId ? `<script>
      (function () {
        const sessionId = ${JSON.stringify(sessionId)};
        const el = document.getElementById("ledger-live");
        let tries = 0;
        const tick = async () => {
          tries += 1;
          try {
            const body = await fetch("/api/ledger").then((r) => r.json());
            const hit = (body.receipts || []).find(
              (row) =>
                row.stripeCheckoutSessionId === sessionId ||
                row.id === "cs_" + sessionId ||
                row.id === sessionId,
            );
            if (hit) {
              el.textContent =
                "Ledger receipt: " +
                hit.status +
                (hit.reason ? " \u2014 " + hit.reason : "");
              if (hit.status === "qualified") return;
            } else if (tries >= 45) {
              el.textContent =
                "Receipt not visible yet. Webhook may still be in flight \u2014 refresh /api/ledger in a moment.";
              return;
            }
          } catch {
            if (tries >= 45) return;
          }
          setTimeout(tick, 2000);
        };
        tick();
      })();
    <\/script>` : ""}
  </main>
</body>
</html>`;
}
__name(htmlThanksPage, "htmlThanksPage");
async function handleThanks(request, env, url) {
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  let recorded = false;
  let note = "";
  if (sessionId.startsWith("cs_")) {
    if (secret) {
      const { session, error } = await fetchStripeSessionById(secret, sessionId);
      if (session?.payment_status === "paid") {
        await writeReceipt(env, classify(receiptFromSession(session), env));
        recorded = true;
      } else if (error) {
        note = `Stripe lookup: ${error}. Session queued for retry.`;
        await queueStripeSession(env, sessionId);
      } else {
        note = "Checkout not paid yet; session queued for retry.";
        await queueStripeSession(env, sessionId);
      }
    } else {
      await queueStripeSession(env, sessionId);
      note = "Stripe checkout.session.completed webhooks ingest paid sessions without manual steps. This page polls /api/ledger until your receipt appears (operator self-pay is rejected).";
    }
  }
  const ledger = await readLedger(env);
  const goal = goalState(ledger);
  return maybeHead(
    request,
    new Response(htmlThanksPage({ sessionId, recorded, goal, note }), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
    })
  );
}
__name(handleThanks, "handleThanks");
function htmlAgentCheckout(origin) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agent verify \u2014 HTTP 402</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta name="description" content="Machine-paid agent verify on Base USDC via HTTP 402. Human card checkout does not count toward the agent goal." />
  <meta property="og:title" content="First Dollar \u2014 agent x402 verify" />
  <meta property="og:description" content="Agents: unpaid GET returns 402. Settle $0.05+ USDC on Base. Owner wallets rejected." />
  <meta property="og:url" content="${origin}/agent" />
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f4efe6; color: #1c1914; }
    main { max-width: 560px; margin: 0 auto; padding: 48px 20px; }
    h1 { font-size: 1.75rem; margin: 0 0 12px; }
    p, li { line-height: 1.55; }
    code { font-size: 0.9em; }
    a.btn { display: inline-block; margin-top: 16px; padding: 12px 18px; background: #1c1914; color: #fff; text-decoration: none; font-weight: 600; }
    .note { font-size: 13px; color: #5c564c; margin-top: 16px; }
  </style>
</head>
<body>
  <main>
    <p class="note">FIRST DOLLAR \xB7 AGENT RAIL</p>
    <h1>HTTP 402 verify</h1>
    <p>For autonomous agents (MCP or HTTP). Pay with USDC on Base \u2014 not a human typing card numbers.</p>
    <ul>
      <li>Challenge: <code>GET ${origin}/api/agent/verify</code> \u2192 402 + payment requirements</li>
      <li>MCP: <code>${origin}/mcp</code> \u2014 free <code>get_goal</code>, paid <code>verify</code></li>
      <li>Min: $0.05 (50000 atomic) \xB7 payTo <code>${PAY_TO}</code></li>
    </ul>
    <a class="btn" href="${origin}/api/agent/verify">Fetch 402 challenge</a>
    <p class="note">Agent402 router pays sellers only after third-party settlement history \u2014 pay x402 directly here until then. Bounty: <a href="${origin}/.well-known/first-dollar-goal.json">first-dollar-goal.json</a></p>
    <p class="note"><button type="button" id="copy-agent" style="margin-top:8px;padding:8px 12px;cursor:pointer;">Copy agent page link</button> <span id="copy-agent-ok" hidden>Copied.</span></p>
    <script>
      document.getElementById("copy-agent")?.addEventListener("click", () => {
        navigator.clipboard?.writeText("${origin}/agent").then(() => {
          const ok = document.getElementById("copy-agent-ok");
          if (ok) { ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 2000); }
        });
      });
    <\/script>
    <p class="note"><a href="${origin}/.well-known/x402.json">x402 manifest</a> \xB7 <a href="${origin}/api/ledger">Ledger</a> \xB7 <a href="${origin}/">Desk home</a></p>
  </main>
</body>
</html>`;
}
__name(htmlAgentCheckout, "htmlAgentCheckout");
function htmlHumanCheckout(goal, origin) {
  const done = goal?.firstHumanDollar;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pay $1 \u2014 First Dollar (human)</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta name="description" content="Public one-dollar human Stripe checkout. Operator self-pay does not count toward the goal." />
  <meta property="og:title" content="First Dollar \u2014 $1 human checkout" />
  <meta property="og:description" content="Pay $1 as a stranger (not the operator). Checkout settles on Stripe; receipt lands on the public ledger." />
  <meta property="og:url" content="${origin}/human" />
  <meta name="twitter:card" content="summary" />
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f4efe6; color: #1c1914; }
    main { max-width: 520px; margin: 0 auto; padding: 48px 20px; }
    h1 { font-size: 1.75rem; margin: 0 0 12px; }
    p { line-height: 1.55; }
    a.btn { display: inline-block; margin-top: 20px; padding: 14px 20px; background: #1c1914; color: #fff; text-decoration: none; font-weight: 600; }
    .note { font-size: 13px; color: #5c564c; margin-top: 16px; }
    .done { color: #1a5c38; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <p class="note">FIRST DOLLAR \xB7 HUMAN RAIL</p>
    <h1>$1.00 verify credit</h1>
    ${done ? `<p class="done">A qualifying third-party human payment is already on the ledger.</p>` : `<p>One-time Stripe Checkout. After payment you return here automatically; the desk records a receipt via webhook.</p>
    <p class="note">Operator cards, smoke tests, and founder emails are rejected and do not count.</p>
    <a class="btn" href="${HUMAN_PAY}">Continue to Stripe \u2014 pay $1.00</a>
    <p class="note"><button type="button" id="copy-human" style="margin-top:12px;padding:8px 12px;cursor:pointer;">Copy share link</button> <span id="copy-human-ok" hidden>Copied.</span></p>
    <script>
      document.getElementById("copy-human")?.addEventListener("click", () => {
        const link = "${origin}/human";
        navigator.clipboard?.writeText(link).then(() => {
          const ok = document.getElementById("copy-human-ok");
          if (ok) { ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 2000); }
        });
      });
    <\/script>`}
    <p class="note"><a href="${origin}/">Desk home</a> \xB7 <a href="${origin}/api/ledger">Ledger JSON</a> \xB7 <a href="${origin}/api/goal">Goal status</a></p>
  </main>
</body>
</html>`;
}
__name(htmlHumanCheckout, "htmlHumanCheckout");
function htmlPage(goal, origin = "https://first-dollar-desk.undone-k.workers.dev") {
  const humanDone = goal?.firstHumanDollar ? "done" : "open";
  const agentDone = goal?.firstAgenticSale ? "done" : "open";
  const humanLabel = goal?.firstHumanDollar ? "Human dollar recorded on the ledger." : "Still waiting for a third-party $1 Stripe checkout.";
  const agentLabel = goal?.firstAgenticSale ? "Agentic sale recorded on the ledger." : "Still waiting for a non-owner x402 settlement ($0.05+ USDC on Base).";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>First Dollar Desk</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta name="description" content="Third-party $1 human checkout and $1 agent 402. Owner and smoke payments are rejected." />
  <meta property="og:title" content="First Dollar Desk \u2014 pay $1 as a stranger" />
  <meta property="og:description" content="Human $1 Stripe or agent $0.05+ USDC on Base. Self-pay does not count toward the First Dollar goal." />
  <meta property="og:url" content="https://first-dollar-desk.undone-k.workers.dev/" />
  <meta name="twitter:card" content="summary" />
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f4efe6; color: #1c1914; }
    main { max-width: 720px; margin: 0 auto; padding: 48px 20px; }
    h1 { font-size: 2rem; margin: 0 0 8px; }
    p { line-height: 1.5; }
    .grid { display: grid; gap: 16px; margin-top: 28px; }
    @media (min-width: 640px) { .grid { grid-template-columns: 1fr 1fr; } }
    article { background: #fff; border: 1px solid #d7cfc0; padding: 20px; }
    a.btn { display: inline-block; margin-top: 12px; padding: 10px 14px; background: #1c1914; color: #fff; text-decoration: none; }
    .note { font-size: 13px; color: #5c564c; }
  </style>
</head>
<body>
  <main>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"OfferCatalog","name":"First Dollar Desk","itemListElement":[{"@type":"Offer","name":"Human verify credit","price":"1.00","priceCurrency":"USD","url":"${origin}/human"},{"@type":"Offer","name":"Agent verify call","price":"0.05","priceCurrency":"USD","url":"${origin}/agent"}]}
    <\/script>
    <p class="note">PROTOCOL \xB7 FIRST DOLLAR DESK</p>
    <h1>A dollar from someone else.</h1>
    <p>Owner cards, operator emails, and smoke tests are recorded, then rejected. They do not satisfy the goal.</p>
    <p class="note">Live goal \xB7 human ${humanDone} \xB7 agent ${agentDone}. ${humanLabel} ${agentLabel}</p>
    <div class="grid">
      <article>
        <p class="note">RAIL A \xB7 HUMAN</p>
        <h2>Human verify credit</h2>
        <p>$1.00 one-time Stripe Checkout for one signed verify credit.</p>
        <a class="btn" href="/human">Pay $1 (third party)</a>
        <p class="note"><a href="${HUMAN_PAY}">Direct Stripe link</a></p>
      </article>
      <article>
        <p class="note">RAIL B \xB7 AGENT</p>
        <h2>Agent verify call</h2>
        <p>$0.05 or $1.00 USDC on Base. Unpaid <code>GET /api/agent/verify</code> returns HTTP 402; MCP <code>verify</code> tool is paid.</p>
        <a class="btn" href="/agent">Request 402 challenge</a>
        <p class="note"><a href="/mcp">MCP</a> \xB7 <a href="/api/goal">Goal JSON</a> \xB7 Card checkout does not count as agent goal \u2014 use 402.</p>
      </article>
    </div>
    <article style="margin-top:16px">
      <p class="note">SHARE \xB7 third parties only (operator self-pay rejected)</p>
      <p class="note">Human $1: <a href="${origin}/human">${origin}/human</a></p>
      <p class="note">Agent 402: <a href="${origin}/agent">${origin}/agent</a></p>
      <p class="note">Bounty manifest: <a href="${origin}/.well-known/first-dollar-goal.json">first-dollar-goal.json</a></p>
    </article>
    <p class="note">Ledger JSON at <a href="/api/ledger">/api/ledger</a>. Machine catalog at <a href="/llms.txt">/llms.txt</a> and <a href="/mcp">/mcp</a>.</p>
  </main>
</body>
</html>`;
}
__name(htmlPage, "htmlPage");
var FACILITATORS = [
  {
    name: "payai",
    verify: "https://facilitator.payai.network/verify",
    settle: "https://facilitator.payai.network/settle"
  },
  {
    name: "x402",
    verify: "https://x402.org/facilitator/verify",
    settle: "https://x402.org/facilitator/settle"
  },
  {
    name: "cdp",
    verify: "https://api.cdp.coinbase.com/platform/v2/x402/verify",
    settle: "https://api.cdp.coinbase.com/platform/v2/x402/settle"
  }
];
function paymentHeader(request) {
  for (const name of ["x-payment", "payment-signature", "payment"]) {
    const value = request.headers.get(name);
    if (value?.trim()) return value.trim();
  }
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "x-payment" || lower === "payment-signature" || lower === "payment" || lower.endsWith("-payment-signature")) {
      const trimmed = String(value ?? "").trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}
__name(paymentHeader, "paymentHeader");
function decodePayment(header) {
  if (!header) return null;
  const attempts = [header];
  try {
    attempts.push(atob(header));
  } catch {
  }
  for (const text of attempts) {
    try {
      return { kind: "payload", value: JSON.parse(text) };
    } catch {
    }
  }
  return { kind: "header", value: header };
}
__name(decodePayment, "decodePayment");
function paymentPayloadFromValue(v) {
  if (!v || typeof v !== "object") return null;
  if (v.payload?.signature || v.payload?.authorization) return v;
  if (v.paymentPayload && typeof v.paymentPayload === "object") return v.paymentPayload;
  if (v.signature && v.authorization) {
    return {
      x402Version: v.x402Version ?? 2,
      scheme: v.scheme ?? "exact",
      network: v.network ?? v.accepted?.network,
      resource: v.resource,
      accepted: v.accepted,
      payload: { signature: v.signature, authorization: v.authorization }
    };
  }
  return v;
}
__name(paymentPayloadFromValue, "paymentPayloadFromValue");
function resourceFromPaymentPayload(pp, fallbackUrl) {
  if (typeof pp?.resource === "string" && pp.resource.trim()) return pp.resource.trim();
  if (typeof pp?.resource?.url === "string" && pp.resource.url.trim()) {
    return pp.resource.url.trim();
  }
  return fallbackUrl;
}
__name(resourceFromPaymentPayload, "resourceFromPaymentPayload");
function normalizePaymentDecoded(decoded) {
  if (!decoded || decoded.kind !== "payload") return decoded;
  const inner = paymentPayloadFromValue(decoded.value);
  if (!inner) return decoded;
  return { kind: "payload", value: inner };
}
__name(normalizePaymentDecoded, "normalizePaymentDecoded");
function decodeHeaderJson(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      const decoded = atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}
__name(decodeHeaderJson, "decodeHeaderJson");
async function postFacilitator(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const extensionRaw = response.headers.get("extension-responses") ?? response.headers.get("EXTENSION-RESPONSES") ?? "";
  let extensionBody = decodeHeaderJson(extensionRaw);
  const paymentResponseRaw = response.headers.get("payment-response") ?? response.headers.get("PAYMENT-RESPONSE") ?? "";
  const paymentResponse = decodeHeaderJson(paymentResponseRaw);
  try {
    const parsed = JSON.parse(text);
    const merged = paymentResponse ? {
      ...parsed,
      payer: parsed.payer ?? paymentResponse.payer,
      transaction: parsed.transaction ?? paymentResponse.transaction,
      txHash: parsed.txHash ?? paymentResponse.transaction ?? paymentResponse.txHash,
      success: parsed.success ?? paymentResponse.success ?? Boolean(paymentResponse.transaction),
      errorReason: parsed.errorReason ?? paymentResponse.errorReason,
      network: parsed.network ?? paymentResponse.network,
      amount: parsed.amount ?? paymentResponse.amount,
      settlement: paymentResponse
    } : parsed;
    return { status: response.status, body: merged, extensionBody, paymentResponse };
  } catch {
    const fallback = paymentResponse ?? { raw: text.slice(0, 240) };
    return {
      status: response.status,
      body: fallback,
      extensionBody,
      paymentResponse
    };
  }
}
__name(postFacilitator, "postFacilitator");
function paymentNetwork(decoded) {
  const value = decoded?.value;
  if (!value || typeof value !== "object") return "";
  return String(
    value.network ?? value.accepted?.network ?? value.paymentRequirements?.network ?? ""
  );
}
__name(paymentNetwork, "paymentNetwork");
function pickAccept(requirements, decoded) {
  const network = paymentNetwork(decoded);
  const mapped = network === "base-sepolia" ? "eip155:84532" : network === "base" ? "eip155:8453" : network;
  return (requirements.accepts ?? []).find(
    (row) => row.network === mapped || row.network === network
  ) ?? requirements.accepts[0];
}
__name(pickAccept, "pickAccept");
function facilitatorBodies(decoded, requirements, resourceUrl) {
  if (decoded.kind === "payload") {
    const paymentPayload = decoded.value;
    const accept2 = pickAccept(requirements, decoded);
    const resource = resourceFromPaymentPayload(paymentPayload, resourceUrl);
    const shared2 = {
      paymentRequirements: accept2,
      resource,
      network: accept2.network,
      accepted: paymentPayload?.accepted ?? accept2
    };
    const v2Body = {
      x402Version: paymentPayload?.x402Version ?? 2,
      paymentPayload,
      ...shared2
    };
    const networkShort = accept2.network === "eip155:84532" ? "base-sepolia" : accept2.network === "eip155:8453" ? "base" : accept2.network;
    const v1Payload = {
      ...paymentPayload,
      x402Version: 1,
      network: networkShort,
      scheme: paymentPayload?.scheme ?? "exact"
    };
    return [
      v2Body,
      { ...v2Body, x402Version: 1, paymentPayload: v1Payload },
      {
        x402Version: 2,
        paymentHeader: JSON.stringify(paymentPayload),
        ...shared2
      }
    ];
  }
  const accept = requirements.accepts[0];
  const shared = {
    paymentRequirements: accept,
    resource: resourceUrl,
    network: accept.network,
    accepted: accept
  };
  return [
    { x402Version: 2, paymentHeader: decoded.value, ...shared },
    { x402Version: 1, paymentHeader: decoded.value, ...shared }
  ];
}
__name(facilitatorBodies, "facilitatorBodies");
function extractPayer(body, decoded, extensionBody) {
  const fromPayload = body?.paymentPayload?.payload?.authorization?.from ?? body?.paymentPayload?.authorization?.from ?? body?.paymentPayload?.from;
  const nested = body?.data ?? body?.result ?? null;
  return String(
    body?.payer ?? body?.payerAddress ?? nested?.payer ?? fromPayload ?? extensionBody?.payer ?? decoded?.value?.payload?.authorization?.from ?? decoded?.value?.payload?.from ?? decoded?.value?.authorization?.from ?? body?.invalidPayer ?? ""
  ).trim().toLowerCase();
}
__name(extractPayer, "extractPayer");
function extractTx(body, extensionBody) {
  const nested = extensionBody?.settlement ?? body?.settlement ?? extensionBody?.payment ?? body?.payment ?? null;
  const data = body?.data ?? body?.result ?? null;
  return String(
    body?.transaction ?? body?.txHash ?? body?.hash ?? body?.transactionHash ?? body?.onChainTxHash ?? data?.transaction ?? data?.txHash ?? data?.transactionHash ?? body?.settlement?.transaction ?? body?.settlement?.txHash ?? nested?.transaction ?? nested?.txHash ?? nested?.transactionHash ?? extensionBody?.transaction ?? extensionBody?.txHash ?? ""
  ).trim();
}
__name(extractTx, "extractTx");
function extractAtomic(body, fallback, extensionBody) {
  return String(
    extensionBody?.amount ?? body?.amount ?? body?.value ?? body?.settlement?.amount ?? fallback ?? "50000"
  );
}
__name(extractAtomic, "extractAtomic");
async function acceptAgentPayment(request, env, resourceUrl) {
  const header = paymentHeader(request);
  if (!header) return null;
  const decoded = normalizePaymentDecoded(decodePayment(header));
  if (!decoded) return null;
  const requirements = paymentRequired(resourceUrl, request.method);
  const attempts = [];
  for (const facilitator of FACILITATORS) {
    for (const body of facilitatorBodies(decoded, requirements, resourceUrl)) {
      const verified = await postFacilitator(facilitator.verify, body);
      const valid = Boolean(
        verified.body?.isValid || verified.body?.valid || verified.body?.success
      );
      attempts.push({
        facilitator: facilitator.name,
        step: "verify",
        status: verified.status,
        valid
      });
      if (!valid) continue;
      const settled = await postFacilitator(facilitator.settle, body);
      const ext = settled.extensionBody ?? settled.paymentResponse;
      const payer = extractPayer(settled.body, decoded, ext) || extractPayer(verified.body, decoded, verified.extensionBody) || extractPayer(settled.paymentResponse ?? {}, decoded, ext);
      const txHash = extractTx(settled.body, ext) || extractTx(verified.body, verified.extensionBody) || extractTx(settled.paymentResponse ?? {}, ext);
      const atomic = extractAtomic(
        settled.body,
        body.paymentRequirements?.amount ?? body.accepted?.amount,
        ext
      );
      const amountCents = Number(BigInt(atomic) / 10000n);
      const pendingReason = String(settled.body?.errorReason ?? settled.body?.reason ?? "");
      const pending = pendingReason === "settlement_pending" || Boolean(settled.body?.success) && !txHash && !payer;
      const success = Boolean(settled.body?.success || txHash) && !pending;
      const receipt = classify(
        {
          id: `x402_${txHash || `${facilitator.name}_${Date.now()}`}`,
          rail: "agent",
          amountCents: Number.isFinite(amountCents) ? amountCents : 5,
          currency: "usdc",
          email: payer ? `wallet:${payer}` : "",
          name: "x402 agent",
          wallet: payer,
          txHash: txHash || void 0,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          metadata: {
            facilitator: facilitator.name,
            x402: "1",
            facilitatorTxHint: txHash || void 0,
            testnet: body.network === "eip155:84532" || body.paymentRequirements?.network === "eip155:84532" || body.accepted?.network === "eip155:84532" || body.paymentPayload?.network === "base-sepolia"
          },
          network: body.paymentRequirements?.network ?? body.network ?? requirements.accepts[0].network
        },
        env
      );
      if (!success && !pending) {
        continue;
      }
      if (pending) {
        receipt.status = "pending";
        receipt.reason = "Facilitator settlement is still pending.";
      }
      const ledger = await writeReceipt(env, receipt);
      return {
        accepted: success && receipt.status === "qualified",
        pending,
        receipt,
        goal: goalState(ledger),
        facilitator: facilitator.name,
        settleStatus: settled.status,
        attempts
      };
    }
  }
  return { accepted: false, attempts };
}
__name(acceptAgentPayment, "acceptAgentPayment");
function paidProduct(paid) {
  if (!paid?.receipt) return null;
  if (paid.receipt.status === "rejected_self_pay") return { kind: "self_pay", paid };
  if (paid.accepted || paid.pending || paid.receipt.txHash) return { kind: "ok", paid };
  return null;
}
__name(paidProduct, "paidProduct");
function mcpTools() {
  return [
    {
      name: "get_goal",
      description: "Live goal state, ledger summary, and checkout URLs. Open bounty: third-party human \u2265$1 Stripe plus non-owner agent x402 verify ($0.05+ USDC Base). Free \u2014 call before verify. See bountyManifestUrl in response.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_pricing",
      description: "Live First Dollar Desk prices. Human $1 Stripe checkout; agent unpaid GET/POST /api/agent/verify is HTTP 402 ($0.05 or $1.00 USDC on Base). Self-pay is rejected.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "verify",
      description: "Paid agent verify credit (machine x402/USDC on Base). Unpaid call returns HTTP 402; settle with a non-owner wallet+tx to record a qualifying agentic sale. Operator/owner wallets and self-pay are rejected.",
      inputSchema: {
        type: "object",
        properties: { productId: { type: "string", description: "Use verify." } }
      }
    }
  ];
}
__name(mcpTools, "mcpTools");
function smitheryServerCard(origin) {
  return {
    serverInfo: {
      name: "first-dollar-desk",
      version: "1.0.0",
      title: "First Dollar Desk",
      websiteUrl: origin
    },
    authentication: { required: false, schemes: [] },
    tools: mcpTools(),
    resources: [],
    prompts: []
  };
}
__name(smitheryServerCard, "smitheryServerCard");
function mcpJson(id, result) {
  return Response.json({ jsonrpc: "2.0", id: id ?? 1, result });
}
__name(mcpJson, "mcpJson");
function verifySuccessBody(paid) {
  return {
    verified: Boolean(paid.accepted),
    note: paid.gateway ? "FiatDock gateway-forwarded call accepted. Self-pay is rejected." : "Paid settlement accepted. Self-pay is rejected.",
    receipt: paid.receipt,
    goal: paid.goal,
    gateway: paid.gateway ?? void 0
  };
}
__name(verifySuccessBody, "verifySuccessBody");
function encodePaymentResponseHeader(receipt) {
  if (!receipt?.wallet || !receipt?.txHash) return null;
  const settlement = {
    success: true,
    payer: receipt.wallet,
    transaction: receipt.txHash,
    txHash: receipt.txHash,
    network: receipt.network,
    amount: receipt.amountCents != null ? String(receipt.amountCents * 1e4) : void 0
  };
  return btoa(JSON.stringify(settlement));
}
__name(encodePaymentResponseHeader, "encodePaymentResponseHeader");
function verifySuccessResponse(paid, origin) {
  const body = verifySuccessBody(paid);
  const headers = {
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Link",
    link: paymentDiscoveryLink(origin)
  };
  const paymentResponse = encodePaymentResponseHeader(paid.receipt);
  if (paymentResponse) headers["payment-response"] = paymentResponse;
  return Response.json(body, { status: 200, headers });
}
__name(verifySuccessResponse, "verifySuccessResponse");
async function handleMcp(request, env, url) {
  const rawBody = await request.text();
  const payload = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return {};
    }
  })();
  const method = String(payload?.method ?? "");
  const toolName = String(payload?.params?.name ?? "");
  const id = payload?.id ?? 1;
  if (method === "initialize") {
    return mcpJson(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "first-dollar-desk", version: "1.0.0" },
      instructions: "Open First Dollar bounty: (1) third-party human $1 Stripe checkout; (2) non-owner agent pays verify via x402 ($0.05+ USDC on Base). get_goal and get_pricing are free. verify is paid HTTP 402 \u2014 owner/operator wallets do not count. Proof: GET /api/ledger."
    });
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 202 });
  }
  if (method === "ping") {
    return mcpJson(id, {});
  }
  if (method === "tools/call" && toolName === "get_goal") {
    const ledger = await readLedger(env);
    const thanksQueue = await readThanksQueue(env);
    const extras = await goalExtras(env, thanksQueue);
    const body2 = goalPayload(ledger, url.origin, env, extras);
    return mcpJson(id, {
      content: [{ type: "text", text: JSON.stringify(body2) }],
      structuredContent: body2
    });
  }
  if (method === "tools/list" || method === "get_pricing" || method === "get_goal" || toolName === "tools/list" || toolName === "get_pricing" || toolName === "get_goal") {
    const pricing = {
      humanUsd: 1,
      humanPay: HUMAN_PAY,
      humanShortUrl: `${url.origin}/human`,
      agentUsd: [0.05, 1],
      agentPay: `${url.origin}/api/agent/verify`,
      agentShortUrl: `${url.origin}/agent`,
      mcpUrl: `${url.origin}/mcp`,
      payTo: PAY_TO,
      network: "eip155:8453",
      selfPayExcluded: true,
      bountyManifestUrl: `${url.origin}/.well-known/first-dollar-goal.json`,
      ledgerUrl: `${url.origin}/api/ledger`,
      agent402DirectX402Required: true
    };
    if (method === "get_goal" || method === "tools/call" && toolName === "get_goal") {
      const ledger = await readLedger(env);
      const thanksQueue = await readThanksQueue(env);
      const extras = await goalExtras(env, thanksQueue);
      const body2 = goalPayload(ledger, url.origin, env, extras);
      return mcpJson(id, {
        content: [{ type: "text", text: JSON.stringify(body2) }],
        structuredContent: body2
      });
    }
    if (method === "get_pricing" || method === "tools/call" && toolName === "get_pricing") {
      return mcpJson(id, {
        content: [{ type: "text", text: JSON.stringify(pricing) }],
        structuredContent: pricing
      });
    }
    return mcpJson(id, { tools: mcpTools(), pricing });
  }
  if (method === "tools/call" && toolName === "verify") {
    const resource2 = `${url.origin}/api/agent/verify`;
    const gateway2 = await acceptFiatDockGateway(request, env, rawBody, resource2);
    if (gateway2?.gatewayRejected) {
      return Response.json({ error: "gateway_signature_invalid" }, { status: 401 });
    }
    const paid2 = gateway2 && (gateway2.accepted || gateway2.pending) ? gateway2 : await acceptAgentPayment(request, env, resource2);
    const product2 = paidProduct(paid2);
    if (product2?.kind === "ok") {
      const body3 = verifySuccessBody(product2.paid);
      return mcpJson(id, {
        content: [{ type: "text", text: JSON.stringify(body3) }],
        structuredContent: body3
      });
    }
    if (product2?.kind === "self_pay") {
      return Response.json(
        { error: "self_pay_excluded", receipt: product2.paid.receipt, goal: product2.paid.goal },
        { status: 409 }
      );
    }
    const body2 = paymentRequired(`${url.origin}/mcp`, "POST", { mcp: true, toolName: "verify" });
    return Response.json(body2, {
      status: 402,
      headers: {
        "cache-control": "no-store",
        "PAYMENT-REQUIRED": btoa(JSON.stringify(body2))
      }
    });
  }
  const resource = `${url.origin}/api/agent/verify`;
  const gateway = await acceptFiatDockGateway(request, env, rawBody, resource);
  if (gateway?.gatewayRejected) {
    return Response.json({ error: "gateway_signature_invalid" }, { status: 401 });
  }
  const paid = gateway && (gateway.accepted || gateway.pending) ? gateway : await acceptAgentPayment(request, env, resource);
  const product = paidProduct(paid);
  if (product?.kind === "ok") {
    return mcpJson(id, verifySuccessBody(product.paid));
  }
  if (product?.kind === "self_pay") {
    return Response.json(
      { error: "self_pay_excluded", receipt: product.paid.receipt, goal: product.paid.goal },
      { status: 409 }
    );
  }
  const body = paymentRequired(`${url.origin}/mcp`, "POST", { mcp: true, toolName: "verify" });
  return Response.json(body, {
    status: 402,
    headers: {
      "cache-control": "no-store",
      "PAYMENT-REQUIRED": btoa(JSON.stringify(body))
    }
  });
}
__name(handleMcp, "handleMcp");
function paymentRequired(resourceUrl, method = "POST", options = {}) {
  const verb = String(method || "POST").toUpperCase();
  const mcp = Boolean(options.mcp);
  const origin = (() => {
    try {
      return new URL(resourceUrl).origin;
    } catch {
      return "https://first-dollar-desk.undone-k.workers.dev";
    }
  })();
  const bodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: {
        type: "string",
        description: "Verification product. Use verify."
      }
    },
    required: ["productId"]
  };
  const input = mcp ? {
    type: "mcp",
    toolName: options.toolName || "verify",
    transport: "streamable-http",
    description: "Paid First Dollar Desk verify credit. Unpaid tools/call is HTTP 402. Owner wallets do not count.",
    inputSchema: bodySchema,
    example: { productId: "verify" }
  } : verb === "GET" ? {
    type: "http",
    method: "GET",
    discoverable: true
  } : {
    type: "http",
    method: "POST",
    discoverable: true,
    bodyType: "json",
    body: { productId: "verify" },
    schema: bodySchema
  };
  const outputExample = {
    verified: false,
    note: "Paid settlement accepted. Self-pay is rejected."
  };
  const output = {
    type: "json",
    example: outputExample
  };
  return {
    x402Version: 2,
    error: "X-PAYMENT or PAYMENT-SIGNATURE header is required",
    resource: {
      url: resourceUrl,
      description: "First Dollar Desk agent verify credit. $0.05 or $1.00 USDC on Base. Owner wallets and self-pay are rejected.",
      mimeType: "application/json",
      serviceName: "First Dollar Desk",
      tags: ["verification", "x402", "first-dollar", "usdc", "base"],
      iconUrl: "https://first-dollar-desk.undone-k.workers.dev/favicon.svg"
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "50000",
        asset: USDC,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin",
          version: "2",
          stripePaymentLink: AGENT_PAY,
          amountUsd: "0.05",
          selfPayExcluded: true,
          facilitator: "https://facilitator.payai.network",
          facilitators: [
            "https://facilitator.payai.network",
            "https://api.cdp.coinbase.com/platform/v2/x402"
          ]
        }
      },
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: USDC,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin",
          version: "2",
          stripePaymentLink: AGENT_PAY,
          amountUsd: "1.00",
          selfPayExcluded: true,
          facilitator: "https://facilitator.payai.network",
          facilitators: [
            "https://facilitator.payai.network",
            "https://api.cdp.coinbase.com/platform/v2/x402"
          ]
        }
      },
      {
        scheme: "exact",
        network: "eip155:84532",
        amount: "10000",
        asset: USDC_SEPOLIA,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USDC",
          version: "2",
          amountUsd: "0.01",
          selfPayExcluded: true,
          testnet: true,
          facilitator: "https://api.cdp.coinbase.com/platform/v2/x402"
        }
      }
    ].filter(
      (row) => verb === "GET" ? row.network === "eip155:8453" && row.amount === "50000" : true
    ),
    outputSchema: {
      input: {
        ...input,
        schema: verb === "GET" ? { type: "object", properties: {} } : bodySchema
      },
      output: outputExample
    },
    extensions: {
      bazaar: {
        info: { input, output },
        schema: {
          type: "object",
          required: ["input"],
          additionalProperties: false,
          properties: {
            input: mcp ? {
              type: "object",
              required: ["type", "toolName"],
              properties: {
                type: { type: "string", const: "mcp" },
                toolName: { type: "string" },
                transport: { type: "string", const: "streamable-http" },
                inputSchema: { type: "object" },
                example: { type: "object" }
              }
            } : {
              type: "object",
              required: verb === "GET" ? ["type", "method"] : ["type", "method", "bodyType", "body"],
              properties: {
                type: { type: "string", const: "http" },
                method: { type: "string", enum: [verb] },
                ...verb === "GET" ? {} : {
                  bodyType: { type: "string", const: "json" },
                  body: bodySchema
                }
              }
            },
            output: { type: "object" }
          }
        }
      },
      firstDollar: {
        goalUrl: `${origin}/api/goal`,
        bountyManifestUrl: `${origin}/.well-known/first-dollar-goal.json`,
        catalogUrl: `${origin}/api/catalog`,
        humanCheckout: HUMAN_PAY,
        humanShortUrl: `${origin}/human`,
        agentShortUrl: `${origin}/agent`,
        agentVerifyUrl: `${origin}/api/agent/verify`,
        mcpUrl: `${origin}/mcp`,
        freeMcpTools: ["get_goal", "get_pricing"],
        selfPayExcluded: true,
        directX402UntilRouterEligible: true
      }
    }
  };
}
__name(paymentRequired, "paymentRequired");
function hexFromBuffer(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(hexFromBuffer, "hexFromBuffer");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return hexFromBuffer(signature);
}
__name(hmacSha256Hex, "hmacSha256Hex");
function parseGatewaySignatureHeader(header) {
  const trimmed = header.trim();
  if (trimmed.includes("v1=")) {
    const parts = Object.fromEntries(
      trimmed.split(",").map((piece) => {
        const [key, ...rest] = piece.split("=");
        return [key.trim(), rest.join("=")];
      })
    );
    return {
      digest: (parts.v1 ?? "").trim().toLowerCase(),
      timestamp: (parts.t ?? parts.timestamp ?? "").trim()
    };
  }
  return {
    digest: trimmed.toLowerCase().replace(/^sha256=/, ""),
    timestamp: ""
  };
}
__name(parseGatewaySignatureHeader, "parseGatewaySignatureHeader");
async function verifyFiatDockGatewayHeader(request, rawBody, secret) {
  const header = (request.headers.get("x-fiatdock-gateway") ?? "").trim();
  if (!header || !secret) return false;
  const callId = (request.headers.get("x-fiatdock-call-id") ?? "").trim();
  const headerTs = (request.headers.get("x-fiatdock-timestamp") ?? request.headers.get("x-timestamp") ?? "").trim();
  const parsed = parseGatewaySignatureHeader(header);
  const timestamp = parsed.timestamp || headerTs;
  const candidates = /* @__PURE__ */ new Set([rawBody]);
  if (callId) candidates.add(`${callId}.${rawBody}`);
  if (timestamp) candidates.add(`${timestamp}.${rawBody}`);
  for (const message of candidates) {
    const digest = await hmacSha256Hex(secret, message);
    if (timingSafeEqual(digest, parsed.digest)) return true;
  }
  return false;
}
__name(verifyFiatDockGatewayHeader, "verifyFiatDockGatewayHeader");
async function acceptFiatDockGateway(request, env, rawBody, resourceUrl) {
  const gatewayHeader = request.headers.get("x-fiatdock-gateway");
  if (!gatewayHeader) return null;
  const secret = (env.FIATDOCK_GATEWAY_SECRET ?? env.FIATDOCK_SELLER_KEY ?? "").trim();
  if (!secret || !await verifyFiatDockGatewayHeader(request, rawBody, secret)) {
    return { gatewayRejected: true };
  }
  const callId = (request.headers.get("x-fiatdock-call-id") ?? "").trim() || `fd_${Date.now()}`;
  const payer = String(
    request.headers.get("x-fiatdock-payer") ?? request.headers.get("x-fiatdock-buyer") ?? request.headers.get("x-fiatdock-wallet") ?? ""
  ).toLowerCase();
  const receipt = classify(
    {
      id: `fiatdock_${callId}`,
      rail: "agent",
      amountCents: 5,
      currency: "usdc",
      email: payer ? `wallet:${payer}` : "",
      name: payer ? "FiatDock buyer" : "FiatDock gateway",
      wallet: payer || void 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        gateway: "fiatdock",
        x402: "1",
        fiatdockCallId: callId,
        gatewayDelivered: "1",
        resource: resourceUrl
      },
      network: "eip155:8453"
    },
    env
  );
  const ledger = await writeReceipt(env, receipt);
  return {
    accepted: receipt.status === "qualified",
    pending: receipt.status === "pending",
    receipt,
    goal: goalState(ledger),
    gateway: "fiatdock"
  };
}
__name(acceptFiatDockGateway, "acceptFiatDockGateway");
// PM-330: official Stripe library instead of the hand-rolled HMAC. The old
// check had no timestamp window (a captured delivery verified forever), only
// compared the first v1 entry, and used a non-constant-time compare.
// constructEventAsync + the SubtleCrypto provider is the Workers-safe path;
// 300s is Stripe's default tolerance, pinned here.
var STRIPE_TOLERANCE_SECONDS = 300;
var stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
async function constructStripeEvent(payload, header, secret) {
  if (!header || !secret || !String(secret).trim()) {
    throw new Error("missing signature or secret");
  }
  return Stripe.webhooks.constructEventAsync(
    payload,
    header,
    String(secret).trim(),
    STRIPE_TOLERANCE_SECONDS,
    stripeCryptoProvider
  );
}
__name(constructStripeEvent, "constructStripeEvent");
// Once-only claim on the LEDGER KV (the only store this Worker has). KV is
// eventually consistent, so two deliveries landing within ~1s on different
// edges could both pass; Stripe retries are minutes apart, and writeReceipt()
// also dedupes by checkout session id, so a double receipt still can't land.
var STRIPE_EVENT_CLAIM_TTL = 60 * 60 * 24 * 30;
async function claimStripeEvent(env, eventId) {
  const key = `stripe_evt:${eventId}`;
  if (await env.LEDGER.get(key)) return false;
  await env.LEDGER.put(key, (/* @__PURE__ */ new Date()).toISOString(), {
    expirationTtl: STRIPE_EVENT_CLAIM_TTL
  });
  return true;
}
__name(claimStripeEvent, "claimStripeEvent");
async function releaseStripeEvent(env, eventId) {
  try {
    await env.LEDGER.delete(`stripe_evt:${eventId}`);
  } catch {
  }
}
__name(releaseStripeEvent, "releaseStripeEvent");
async function handleStripeWebhook(request, env) {
  const header = request.headers.get("stripe-signature");
  if (!header) {
    return Response.json({ error: "missing_signature" }, { status: 400 });
  }
  const payload = await request.text();
  let event;
  try {
    event = await constructStripeEvent(payload, header, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (!await claimStripeEvent(env, event.id)) {
    return Response.json({ received: true, duplicate: true });
  }
  // CFA-121: if processing fails, release the claim (same as
  // authichain-automation) and answer 500 so Stripe's retry can run it again.
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const classified = classify(receiptFromSession(session), env);
        const ledger = await writeReceipt(env, classified);
        await env.LEDGER.put(
          "stripe_webhook_last",
          JSON.stringify({
            at: (/* @__PURE__ */ new Date()).toISOString(),
            type: event.type,
            sessionId: session.id,
            amountCents: session.amount_total ?? 0,
            paymentLink: session.payment_link ?? null,
            receiptStatus: classified.status,
            receiptId: classified.id
          })
        );
        return Response.json({ received: true, receipt: classified, goal: goalState(ledger) });
      }
    }
    await env.LEDGER.put(
      "stripe_webhook_last",
      JSON.stringify({
        at: (/* @__PURE__ */ new Date()).toISOString(),
        type: event.type,
        ignored: true
      })
    );
    return Response.json({ received: true, ignored: event.type });
  } catch (err) {
    await releaseStripeEvent(env, event.id);
    console.error("[first-dollar-desk] stripe webhook processing failed", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
__name(handleStripeWebhook, "handleStripeWebhook");
function authorizeStripeSessionPush(request, env) {
  const auth = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!auth) return false;
  const candidates = [
    (env.STRIPE_LEDGER_PUSH_TOKEN ?? "").trim(),
    (env.STRIPE_SECRET_KEY ?? "").trim(),
    (env.STRIPE_WEBHOOK_SECRET ?? "").trim()
  ].filter(Boolean);
  return candidates.some((candidate) => timingSafeEqual(auth, candidate));
}
__name(authorizeStripeSessionPush, "authorizeStripeSessionPush");
function paymentDiscoveryLink(origin) {
  return `<${origin}/api/goal>; rel="goal", <${origin}/api/ledger>; rel="ledger", <${origin}/mcp>; rel="mcp"`;
}
__name(paymentDiscoveryLink, "paymentDiscoveryLink");
function paymentLinkId(session) {
  const link = session.payment_link;
  if (typeof link === "string") return link;
  if (link && typeof link === "object" && link.id) return String(link.id);
  return "";
}
__name(paymentLinkId, "paymentLinkId");
function receiptFromSession(session) {
  const plink = paymentLinkId(session);
  const piMeta = typeof session.payment_intent === "object" && session.payment_intent?.metadata ? session.payment_intent.metadata : {};
  const metadata = { ...piMeta, ...session.metadata ?? {}, ...plink ? { stripePlink: plink } : {} };
  const email = session.customer_details?.email ?? session.customer_email ?? session.customer_details?.name ?? "";
  const name = session.customer_details?.name ?? "";
  const rail = metadata.rail === "agent" || metadata.sku === "first_dollar_agent" || plink === "plink_1UIRFkGqTruSqV8TThRgOS44" ? "agent" : "human";
  return {
    id: `cs_${session.id}`,
    rail,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    email,
    name,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    createdAt: new Date((session.created ?? Date.now() / 1e3) * 1e3).toISOString(),
    metadata
  };
}
__name(receiptFromSession, "receiptFromSession");
var index_default = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await syncOnchain(env, { force: true });
        await syncStripe(env);
      })()
    );
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/$/, "") || "/";
    for (const prefix of ["/first-dollar", "/dollar", "/verify-credit", "/buy"]) {
      if (path === prefix) {
        path = "/";
        break;
      }
      if (path.startsWith(`${prefix}/`)) {
        path = path.slice(prefix.length) || "/";
        break;
      }
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, HEAD, OPTIONS",
          "access-control-allow-headers": "content-type, accept, x-payment, payment-signature, payment-required, x-fiatdock-gateway, x-fiatdock-call-id, x-fiatdock-payer, x-fiatdock-buyer, x-fiatdock-wallet",
          "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
          "access-control-max-age": "86400"
        }
      });
    }
    if (path === "/" && isRead(request.method)) {
      const ledger = await readLedger(env);
      return maybeHead(
        request,
        new Response(htmlPage(goalState(ledger), url.origin), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=30" }
        })
      );
    }
    if (path === "/human" && isRead(request.method)) {
      if (url.searchParams.get("go") === "1") {
        return Response.redirect(HUMAN_PAY, 302);
      }
      const ledger = await readLedger(env);
      return maybeHead(
        request,
        new Response(htmlHumanCheckout(goalState(ledger), url.origin), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60"
          }
        })
      );
    }
    if (path === "/agent" && isRead(request.method)) {
      if (url.searchParams.get("go") === "1") {
        return Response.redirect(`${url.origin}/api/agent/verify`, 302);
      }
      return maybeHead(
        request,
        new Response(htmlAgentCheckout(url.origin), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60"
          }
        })
      );
    }
    if (path === "/agent/pay" && isRead(request.method)) {
      return Response.redirect(AGENT_PAY, 302);
    }
    if (path === "/thanks") {
      return handleThanks(request, env, url);
    }
    if (path === "/robots.txt") {
      return maybeHead(
        request,
        new Response(
          ["User-agent: *", "Allow: /", "Sitemap: https://first-dollar-desk.undone-k.workers.dev/sitemap.xml", ""].join("\n"),
          { headers: { "content-type": "text/plain; charset=utf-8" } }
        )
      );
    }
    if (path === "/sitemap.xml") {
      const urls = [
        `${url.origin}/`,
        `${url.origin}/llms.txt`,
        `${url.origin}/.well-known/x402.json`,
        `${url.origin}/.well-known/x402`,
        `${url.origin}/mcp`,
        `${url.origin}/.well-known/mcp.json`,
        `${url.origin}/.well-known/mcp/server-card.json`,
        `${url.origin}/api/agent/verify`,
        `${url.origin}/api/ledger`,
        `${url.origin}/api/catalog`,
        `${url.origin}/api/goal`,
        `${url.origin}/agents.json`,
        `${url.origin}/human`,
        `${url.origin}/agent`,
        `${url.origin}/.well-known/first-dollar-goal.json`,
        HUMAN_PAY,
        AGENT_PAY
      ];
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((href) => `  <url><loc>${href}</loc></url>`).join("\n")}
</urlset>
`;
      return maybeHead(
        request,
        new Response(body, {
          headers: { "content-type": "application/xml; charset=utf-8" }
        })
      );
    }
    if (path === "/llms.txt") {
      const body = [
        "# First Dollar Desk",
        "> Third-party $1 human checkout and agent HTTP 402 ($0.05+ USDC on Base). Self-pay is rejected.",
        "",
        "## Goal (free)",
        `- GET ${url.origin}/api/goal \u2014 live flags, checkout URLs, MCP endpoint`,
        "",
        "## Human",
        `- Pay: ${HUMAN_PAY}`,
        `- Short: ${url.origin}/human`,
        "",
        "## Agent",
        `- Verify (402): ${url.origin}/api/agent/verify \u2014 USDC on Base eip155:8453, payTo ${PAY_TO}, min $0.05 (50000 atomic) or $1 (1000000 atomic)`,
        "- Unpaid GET or POST /api/agent/verify returns HTTP 402 with x402 payment requirements",
        `- Human-card fallback (not agent-rail): ${AGENT_PAY}`,
        `- Catalog: ${url.origin}${url.pathname.includes("/first-dollar") ? "/first-dollar" : ""}/.well-known/x402.json`,
        `- MCP: ${url.origin}${url.pathname.includes("/first-dollar") ? "/first-dollar" : ""}/mcp`,
        `- Smithery card: ${url.origin}/.well-known/mcp/server-card.json`,
        "- Indexed on x402scan and listed on agent402.tools; PayAPI Market listing is queued for a third-party canary",
        `- Bounty manifest: ${url.origin}/.well-known/first-dollar-goal.json`,
        "- Facilitators: PayAI (https://facilitator.payai.network) and CDP x402",
        "- Agent402 Smart Order Router requires seller settlement history; pay x402 directly until routerDispatchEligible is true",
        "",
        "## Ledger",
        "- GET /api/ledger",
        "- GET /api/goal (goal flags + checkout URLs for agents)",
        ""
      ].join("\n");
      return maybeHead(
        request,
        new Response(body, {
          headers: { "content-type": "text/plain; charset=utf-8" }
        })
      );
    }
    if (path === "/favicon.svg" || path === "/favicon.ico") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1c1914"/><text x="32" y="42" text-anchor="middle" font-size="28" font-family="ui-sans-serif,system-ui,sans-serif" fill="#f4efe6">$1</text></svg>`;
      return maybeHead(
        request,
        new Response(svg, {
          headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" }
        })
      );
    }
    if (path === "/.well-known/mcp-registry-auth") {
      return maybeHead(
        request,
        new Response("v=MCPv1; k=ed25519; p=pPflB/21QDRtGb0IlSrPHHDHccwox9cFXQ5imEX4QbI=\n", {
          headers: { "content-type": "text/plain; charset=utf-8" }
        })
      );
    }
    if (path === "/.well-known/mcp.json" || path === "/.well-known/mcp") {
      return maybeHead(
        request,
        Response.json({
          name: "first-dollar-desk",
          title: "First Dollar Desk",
          description: "Human $1 Stripe verify credit and agent HTTP 402 ($0.05 or $1.00 USDC on Base). Self-pay is rejected.",
          websiteUrl: url.origin,
          transport: "http",
          url: `${url.origin}/mcp`,
          serverCard: `${url.origin}/.well-known/mcp/server-card.json`,
          humanPay: HUMAN_PAY,
          agentPay: `${url.origin}/api/agent/verify`
        })
      );
    }
    if (path === "/.well-known/mcp/server-card.json" || path === "/.well-known/mcp/server-card" || path === "/server-card") {
      return maybeHead(request, Response.json(smitheryServerCard(url.origin)));
    }
    if (path === "/8e7d4c6a0b1c2d3e4f5061789abcdef0.txt") {
      return maybeHead(
        request,
        new Response("8e7d4c6a0b1c2d3e4f5061789abcdef0", {
          headers: { "content-type": "text/plain; charset=utf-8" }
        })
      );
    }
    if (path === "/.well-known/x402" || path === "/agents.json" || path === "/api/pricing") {
      return maybeHead(request, Response.json(serviceManifest(url.origin)));
    }
    if (path === "/.well-known/x402.json") {
      const resource = `${url.origin}/api/agent/verify`;
      return maybeHead(
        request,
        Response.json({
          protocol: "x402",
          x402Version: 2,
          docs: `${url.origin}/`,
          catalog: `${url.origin}/.well-known/x402.json`,
          pay: resource,
          unitOfAccount: "USDC",
          network: "eip155:8453",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: PAY_TO,
          pricePerCall: { usd: 0.05, atomic: "50000" },
          pricePerCallAlt: { usd: 1, atomic: "1000000" },
          selfPayExcluded: true,
          stripePaymentLink: AGENT_PAY,
          goalUrl: `${url.origin}/api/goal`,
          ledgerUrl: `${url.origin}/api/ledger`,
          humanCheckout: HUMAN_PAY,
          mcpUrl: `${url.origin}/mcp`
        })
      );
    }
    if (path === "/mcp" && request.method === "POST") {
      return handleMcp(request, env, url);
    }
    if (path === "/mcp") {
      return maybeHead(
        request,
        Response.json({
          protocol: "mcp",
          jsonrpc: "2.0",
          serverInfo: { name: "first-dollar-desk", version: "1.0.0" },
          tools: [
            {
              name: "get_pricing",
              description: "Live First Dollar Desk prices. Human $1 Stripe checkout; agent unpaid GET/POST /api/agent/verify is HTTP 402 ($0.05 or $1.00 USDC on Base). Self-pay is rejected.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "verify",
              description: "Paid third-party verification. Unpaid tools/call returns HTTP 402. Owner wallets do not count.",
              inputSchema: {
                type: "object",
                properties: { productId: { type: "string" } }
              }
            }
          ],
          pricing: {
            agentRail: {
              endpoint: "POST /api/agent/verify",
              protocol: "x402",
              network: "base",
              chainId: "8453",
              asset: USDC,
              publishedPayTo: PAY_TO,
              pricePerCall: "$0.05 USDC",
              pricePerCallAlt: "$1.00 USDC",
              catalog: `${url.origin}/.well-known/x402.json`,
              wellKnown: `${url.origin}/.well-known/x402`,
              mcp: `${url.origin}/mcp`,
              stripePaymentLink: AGENT_PAY,
              selfPayExcluded: true
            },
            humanCheckout: {
              rail: "stripe",
              verifyUsd: 1,
              verifyPaymentLink: HUMAN_PAY
            }
          },
          pay: {
            x402: `POST ${url.origin}/api/agent/verify`,
            mcpVerify: `POST ${url.origin}/mcp tools/call verify`,
            catalog: `${url.origin}/.well-known/x402.json`,
            human: HUMAN_PAY
          }
        })
      );
    }
    if (path === "/openapi.json") {
      return maybeHead(
        request,
        Response.json({
          openapi: "3.1.0",
          info: {
            title: "First Dollar Desk",
            version: "1.0.0",
            description: "Third-party $1 human checkout and $0.05/$1.00 agent verify on Base USDC. Owner wallets and self-pay are rejected."
          },
          paths: {
            "/human": {
              get: {
                operationId: "humanCheckoutPage",
                tags: ["human", "stripe"],
                summary: "Third-party $1 human checkout landing page",
                description: "HTML page linking to live Stripe Checkout. Operator self-pay is rejected on the ledger.",
                responses: { 200: { description: "HTML" } }
              }
            },
            "/agent": {
              get: {
                operationId: "agentLanding",
                tags: ["agent", "x402"],
                summary: "Agent rail onboarding (402 + MCP)",
                responses: { 200: { description: "HTML" } }
              }
            },
            "/api/ledger": {
              get: {
                operationId: "getLedger",
                tags: ["goal"],
                summary: "Public receipt ledger with goal flags",
                responses: { 200: { description: "Ledger JSON" } }
              }
            },
            "/api/goal": {
              get: {
                operationId: "getGoal",
                tags: ["goal"],
                summary: "Live First Dollar goal flags and checkout URLs",
                responses: { 200: { description: "Goal payload" } }
              }
            },
            "/api/agent/verify": {
              get: {
                operationId: "verifyChallenge",
                tags: ["verification", "x402", "first-dollar"],
                summary: "First Dollar Desk agent verify challenge",
                description: "Unpaid GET returns HTTP 402 for a third-party agent verify credit. Self-pay is rejected.",
                "x-payment-info": {
                  protocols: ["x402"],
                  price: { mode: "fixed", currency: "USD", amount: "0.05" },
                  network: "eip155:8453"
                },
                responses: { 402: { description: "Payment required" } }
              },
              post: {
                operationId: "verifyCredit",
                tags: ["verification", "x402", "first-dollar"],
                summary: "First Dollar Desk paid agent verify",
                description: "Paid POST settles a third-party agent verify credit ($0.05 or $1.00 USDC on Base). Owner wallets do not count.",
                "x-payment-info": {
                  protocols: ["x402"],
                  price: { mode: "fixed", currency: "USD", amount: "1.00" },
                  network: "eip155:8453"
                },
                responses: { 402: { description: "Payment required" } }
              }
            }
          }
        })
      );
    }
    if (path === "/.well-known/first-dollar-goal.json") {
      const ledger = await readLedger(env);
      const goal = goalState(ledger);
      return maybeHead(
        request,
        Response.json(firstDollarBountyManifest(url.origin, goal), {
          headers: {
            "cache-control": "public, max-age=60",
            "access-control-allow-origin": "*"
          }
        })
      );
    }
    if (path === "/api/goal") {
      if (ctx?.waitUntil) {
        ctx.waitUntil(
          (async () => {
            await syncOnchain(env);
            const last = await env.LEDGER.get("agent402_dispatch_at");
            const stale = !last || Date.now() - Date.parse(last) > 6 * 60 * 60 * 1e3;
            if (stale) {
              await refreshAgent402DispatchCache(env, url.origin);
              await env.LEDGER.put("agent402_dispatch_at", (/* @__PURE__ */ new Date()).toISOString());
            }
          })()
        );
      }
      const ledger = await readLedger(env);
      const thanksQueue = await readThanksQueue(env);
      const extras = await goalExtras(env, thanksQueue);
      return maybeHead(
        request,
        Response.json(
          goalPayload(ledger, url.origin, env, extras),
          {
            headers: {
              "cache-control": "public, max-age=60",
              "access-control-allow-origin": "*"
            }
          }
        )
      );
    }
    if (path === "/api/catalog") {
      const origin = url.origin;
      const ledger = await readLedger(env);
      const thanksQueue = await readThanksQueue(env);
      const agent402Dispatch = await readAgent402DispatchCache(env);
      const goal = goalPayload(ledger, origin, env, {
        thanksQueueDepth: thanksQueue.depth,
        thanksQueueSessionIds: thanksQueue.depth ? thanksQueue.ids : null,
        agent402Dispatch
      });
      return maybeHead(
        request,
        Response.json(
          {
            name: "First Dollar Desk",
            selfPayExcluded: true,
            goal: goalState(ledger),
            goalUrl: `${origin}/api/goal`,
            stripeIngestion: goal.stripeIngestion,
            human: {
              priceUsd: 1,
              currency: "usd",
              checkout: HUMAN_PAY,
              shortUrl: `${origin}/human`
            },
            agent: {
              priceUsd: [0.05, 1],
              currency: "usdc",
              network: "eip155:8453",
              verifyGet: `${origin}/api/agent/verify`,
              verifyPost: `${origin}/api/agent/verify`,
              shortUrl: `${origin}/agent`,
              agentPayShortUrl: `${origin}/agent/pay`,
              mcp: `${origin}/mcp`,
              mcpTools: ["get_goal", "get_pricing", "verify"],
              mcpTool: "verify",
              x402Catalog: `${origin}/.well-known/x402.json`,
              stripeCheckout: AGENT_PAY,
              fiatdockGateway: "https://fiatdock.com/s/svc_0d53f546-fc8c-45b7-ac30-07dd46dfb2fa"
            },
            ledger: `${origin}/api/ledger`,
            llms: `${origin}/llms.txt`,
            smitheryCard: `${origin}/.well-known/mcp/server-card.json`,
            bountyManifest: `${origin}/.well-known/first-dollar-goal.json`,
            discovery: goal.discovery ?? null
          },
          {
            headers: {
              "cache-control": "public, max-age=300",
              "access-control-allow-origin": "*"
            }
          }
        )
      );
    }
    if (path === "/api/ledger") {
      const [onchain, stripe] = await Promise.all([
        syncOnchain(env),
        syncStripe(env)
      ]);
      const ledger = await readLedger(env);
      return maybeHead(
        request,
        Response.json({
          ...ledger,
          goal: goalState(ledger),
          onchain,
          stripe,
          rule: "Founder, smoke, owner wallets, and self-pay receipts are recorded then rejected. Unproven on-chain inbound stays pending."
        })
      );
    }
    if (path === "/api/agent/verify") {
      const accept = request.headers.get("accept") ?? "";
      if (request.method === "GET" && accept.includes("text/html")) {
        return Response.redirect(AGENT_PAY, 302);
      }
      const resource = `${url.origin}${url.pathname}`;
      const rawBody = request.method === "POST" || request.method === "PUT" ? await request.clone().text() : "";
      const gateway = rawBody ? await acceptFiatDockGateway(request, env, rawBody, resource) : null;
      if (gateway?.gatewayRejected) {
        return Response.json({ error: "gateway_signature_invalid" }, { status: 401 });
      }
      const hadPaymentHeader = Boolean(paymentHeader(request));
      const paid = gateway && (gateway.accepted || gateway.pending) ? gateway : await acceptAgentPayment(request, env, resource);
      const product = paidProduct(paid);
      if (product?.kind === "ok") {
        return maybeHead(request, verifySuccessResponse(product.paid, url.origin));
      }
      if (product?.kind === "self_pay") {
        return Response.json(
          { error: "self_pay_excluded", receipt: product.paid.receipt, goal: product.paid.goal },
          { status: 409 }
        );
      }
      if (hadPaymentHeader && paid && (paid.attempts?.length || paid.accepted === false)) {
        const failBody = {
          error: "payment_verification_failed",
          message: "Payment header was received but facilitator verify/settle did not complete with payer and transaction.",
          attempts: paid.attempts ?? []
        };
        return maybeHead(
          request,
          Response.json(failBody, {
            status: 402,
            headers: {
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
              "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Link",
              link: paymentDiscoveryLink(url.origin)
            }
          })
        );
      }
      const body = paymentRequired(
        resource,
        request.method === "HEAD" ? "GET" : request.method
      );
      return maybeHead(
        request,
        Response.json(body, {
          status: 402,
          headers: {
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
            "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Link",
            link: paymentDiscoveryLink(url.origin),
            "PAYMENT-REQUIRED": btoa(JSON.stringify(body))
          }
        })
      );
    }
    if (path === "/api/stripe/push-session" && request.method === "POST") {
      if (!authorizeStripeSessionPush(request, env)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
      const session = body?.session ?? body;
      if (!session?.id?.startsWith("cs_")) {
        return Response.json({ error: "missing_checkout_session" }, { status: 400 });
      }
      if (session.payment_status !== "paid") {
        return Response.json({ error: "session_not_paid", payment_status: session.payment_status }, { status: 409 });
      }
      const classified = classify(receiptFromSession(session), env);
      const ledger = await writeReceipt(env, classified);
      return Response.json({ received: true, receipt: classified, goal: goalState(ledger) });
    }
    if (path === "/api/stripe/webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }
    return new Response("Not found", { status: 404 });
  }
};
export {
  index_default as default
};
