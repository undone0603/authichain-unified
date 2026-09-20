import { JsonRpcProvider, Contract, Interface, ZeroAddress, getAddress } from "ethers";
import { writeFile, mkdir } from "node:fs/promises";

const CONTRACT_ADDRESS = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const DEPLOYER = "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d";
const DEPLOY_BLOCK = 77535676;
// Fallback only. CI supplies POLYGON_RPC_URL from a repo secret; this value is
// what a bare local run gets.
//
// No claim is made here about which public endpoints work. Two earlier
// revisions of this comment asserted opposite verdicts on polygon-rpc.com, and
// both were unfounded: the runs they cited had POLYGON_RPC_URL set, so they
// exercised the secret's endpoint and never the one named. The reachability of
// any specific public endpoint from CI is, as of this writing, untested.
const DEFAULT_RPC = "https://polygon-bor-rpc.publicnode.com";
const CHUNK_SIZE = Number(process.env.AUTHICHAIN_LEDGER_CHUNK ?? 8_000);

/**
 * "state" (default) reconstructs from current contract state; "logs" replays
 * eth_getLogs from the deploy block.
 *
 * The logs path has never once completed. It needs ~11.5M blocks of historical
 * logs, and every free Polygon endpoint tried refuses that in a different way:
 * polygon-rpc.com would not connect from a CI runner at all; publicnode
 * answered "History has been pruned for this block"; dRPC rejects the range on
 * its free plan even at 9,001 blocks, below the 10,000 its own error message
 * quotes. Historical logs are effectively a paid product.
 *
 * Current state is not. AuthiChainNFT is ERC721Enumerable
 * (packages/contracts/AuthiChainNFT.sol), so totalSupply + tokenByIndex reach
 * every token, and ownerOf / getProductInfo / getSupplyChainHistory / tokenURI
 * are ordinary state reads that any node serves, pruned or not. That answers
 * who holds what today — including whether a given wallet holds anything — in
 * seconds and for free, with no retention policy to depend on.
 *
 * What only the logs path can give: mint transaction hashes, mint block and
 * timestamp, and the per-token transfer chain. Those are events, not state.
 * Note `supplyChainHistory` is NOT one of them — it is on-chain storage, so
 * the provenance trail with actors, locations and timestamps survives here.
 */
const MODE = (process.env.AUTHICHAIN_LEDGER_MODE ?? "state").toLowerCase();
if (MODE !== "state" && MODE !== "logs") {
  // Falling back to state on a typo yields a successful-looking artifact with
  // empty mintTx/transfers/clusterRecipients — indistinguishable from a real
  // result unless someone reads provenanceAvailable. Refuse instead.
  throw new Error(`AUTHICHAIN_LEDGER_MODE must be "state" or "logs", got "${MODE}"`);
}

const ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
  "event ProductMinted(uint256 indexed tokenId,string productIdentifier,address indexed manufacturer,uint256 timestamp)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getProductInfo(uint256 tokenId) view returns (tuple(string productIdentifier,string manufacturer,string model,string serialNumber,uint256 manufactureDate,string additionalDetails,bool isActive))",
  "function getSupplyChainHistory(uint256 tokenId) view returns (tuple(address actor,string eventType,string location,uint256 timestamp,string notes)[])",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
];

const RPC_URL = process.env.POLYGON_RPC_URL ?? DEFAULT_RPC;
const provider = new JsonRpcProvider(RPC_URL);
const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
const iface = new Interface(ABI);

type LedgerRow = {
  tokenId: string;
  mintTx: string;
  mintBlock: number;
  mintTimestamp: string;
  minter: string;
  recipient: string;
  currentOwner: string;
  productIdentifier: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  manufactureDate: string;
  additionalDetails: string;
  active: boolean;
  tokenURI: string;
  transfers: Array<{ tx: string; block: number; from: string; to: string; timestamp: string }>;
  supplyChainHistory: Array<{ actor: string; eventType: string; location: string; timestamp: string; notes: string }>;
};

async function blockTimestamp(blockNumber: number): Promise<string> {
  const block = await provider.getBlock(blockNumber);
  if (!block) throw new Error(`Missing block ${blockNumber}`);
  return new Date(block.timestamp * 1000).toISOString();
}

async function logsInChunks(topic: string, fromBlock: number, toBlock: number) {
  const logs: any[] = [];
  for (let from = fromBlock; from <= toBlock; from += CHUNK_SIZE + 1) {
    const to = Math.min(from + CHUNK_SIZE, toBlock);
    const batch = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [topic],
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...batch);
    console.error(`scanned ${from}-${to}: ${batch.length} matching logs`);
  }
  return logs;
}

/** Replays mint/transfer events. Requires an endpoint that serves historical logs. */
async function rowsFromLogs(latest: number): Promise<LedgerRow[]> {
  const transferTopic = iface.getEvent("Transfer").topicHash;
  const productMintedTopic = iface.getEvent("ProductMinted").topicHash;

  const [transfers, minted] = await Promise.all([
    logsInChunks(transferTopic, DEPLOY_BLOCK, latest),
    logsInChunks(productMintedTopic, DEPLOY_BLOCK, latest),
  ]);

  const transferByToken = new Map<string, any[]>();
  for (const log of transfers) {
    const parsed = iface.parseLog(log);
    if (!parsed) continue;
    const tokenId = parsed.args.tokenId.toString();
    const from = getAddress(parsed.args.from);
    const to = getAddress(parsed.args.to);
    const arr = transferByToken.get(tokenId) ?? [];
    arr.push({ tx: log.transactionHash, block: log.blockNumber, from, to });
    transferByToken.set(tokenId, arr);
  }

  const rows: LedgerRow[] = [];
  for (const log of minted) {
    const parsed = iface.parseLog(log);
    if (!parsed) continue;
    const tokenId = parsed.args.tokenId.toString();
    const tx = await provider.getTransaction(log.transactionHash);
    if (!tx) throw new Error(`Missing mint transaction ${log.transactionHash}`);

    const info = await contract.getProductInfo(tokenId);
    const history = await contract.getSupplyChainHistory(tokenId);
    const owner = await contract.ownerOf(tokenId);
    const uri = await contract.tokenURI(tokenId);
    const mintTimestamp = await blockTimestamp(log.blockNumber);

    const transfersForToken = transferByToken.get(tokenId) ?? [];
    const enrichedTransfers = [];
    for (const t of transfersForToken) {
      enrichedTransfers.push({ ...t, timestamp: await blockTimestamp(t.block) });
    }

    rows.push({
      tokenId,
      mintTx: log.transactionHash,
      mintBlock: log.blockNumber,
      mintTimestamp,
      minter: getAddress(parsed.args.manufacturer),
      recipient: enrichedTransfers.find((t) => t.from === ZeroAddress)?.to ?? "",
      currentOwner: getAddress(owner),
      productIdentifier: info.productIdentifier,
      manufacturer: info.manufacturer,
      model: info.model,
      serialNumber: info.serialNumber,
      manufactureDate: new Date(Number(info.manufactureDate) * 1000).toISOString(),
      additionalDetails: info.additionalDetails,
      active: info.isActive,
      tokenURI: uri,
      transfers: enrichedTransfers,
      supplyChainHistory: history.map((e: any) => ({
        actor: getAddress(e.actor),
        eventType: e.eventType,
        location: e.location,
        timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
        notes: e.notes,
      })),
    });
  }

  return rows;
}

/**
 * Reconstructs from current contract state. No eth_getLogs, so no dependency on
 * an endpoint's log-retention or range policy.
 *
 * Fields that only exist in events are left null/empty and flagged by
 * `mode: "state"` in the summary, so a consumer can tell "not applicable in
 * this mode" from "genuinely absent on chain".
 */
async function rowsFromState(): Promise<LedgerRow[]> {
  const total = Number(await contract.totalSupply());
  console.error(`totalSupply = ${total}; reading state for each token`);

  const rows: LedgerRow[] = [];
  for (let i = 0; i < total; i++) {
    const tokenId = (await contract.tokenByIndex(i)).toString();
    const [owner, uri, info, history] = await Promise.all([
      contract.ownerOf(tokenId),
      contract.tokenURI(tokenId),
      contract.getProductInfo(tokenId),
      contract.getSupplyChainHistory(tokenId),
    ]);

    rows.push({
      tokenId,
      mintTx: "",
      mintBlock: 0,
      mintTimestamp: "",
      minter: "",
      recipient: "",
      currentOwner: getAddress(owner),
      productIdentifier: info.productIdentifier,
      manufacturer: info.manufacturer,
      model: info.model,
      serialNumber: info.serialNumber,
      manufactureDate: new Date(Number(info.manufactureDate) * 1000).toISOString(),
      additionalDetails: info.additionalDetails,
      active: info.isActive,
      tokenURI: uri,
      transfers: [],
      supplyChainHistory: history.map((e: any) => ({
        actor: getAddress(e.actor),
        eventType: e.eventType,
        location: e.location,
        timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
        notes: e.notes,
      })),
    });
    console.error(`  token ${tokenId} -> ${getAddress(owner)} (${i + 1}/${total})`);
  }
  return rows;
}

/** Wallets treated as the owner's own when classifying holders. */
const CLUSTER = new Set([
  "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d",
  "0x8df0057ffb210444b927511b2d416ad7854fb81e",
  "0xc0d26735fd9e868eacc60400ef3171fa4161177f",
  "0x52981cd11973f954d9ea084a784650f65d052235",
  "0x5db511706fb6317cd23a7655f67450c5ac6e6aa2",
]);

/**
 * Fails fast on an unusable RPC.
 *
 * ethers retries network detection once a second, forever, printing
 * "failed to detect network" and nothing else. Two 60-minute CI runs were
 * consumed that way before anyone read the log — the job looks identical to
 * one doing real work, because a hung retry loop and a slow scan both present
 * as "step still running". A bounded probe turns that into a named error in
 * seconds.
 *
 * NOTE: this has not been verified against an actually-unreachable endpoint.
 * Three attempts to test it all reached a working RPC instead — the first
 * because the endpoint recovered, the next two because POLYGON_RPC_URL was set
 * and silently overrode the URL under test. Treat the fast-fail as intended
 * behaviour, not demonstrated behaviour, until a run proves it.
 */
async function preflight(): Promise<number> {
  const timeoutMs = Number(process.env.AUTHICHAIN_LEDGER_PREFLIGHT_MS ?? 20_000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`RPC preflight failed: ${RPC_URL} did not answer eth_blockNumber within ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    const latest = await Promise.race([provider.getBlockNumber(), expiry]);
    // Host only — the configured URL may carry an API key, and relying on the
    // runner's secret masking to hide it is a weaker guarantee than not
    // printing it.
    console.error(`RPC ok: ${new URL(RPC_URL).host} at block ${latest}`);
    return latest;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  const latest = await preflight();
  const rows = MODE === "logs" ? await rowsFromLogs(latest) : await rowsFromState();
  rows.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));

  const inCluster = (a: string) => Boolean(a) && CLUSTER.has(a.toLowerCase());
  const holders = new Set(rows.map((r) => r.currentOwner.toLowerCase()).filter(Boolean));
  const recipients = new Set(rows.map((r) => r.recipient.toLowerCase()).filter(Boolean));

  const summary = {
    mode: MODE,
    // Only the logs mode can populate mint/transfer provenance; in state mode
    // the recipient-based fields below are empty by construction, not by absence.
    provenanceAvailable: MODE === "logs",
    contract: CONTRACT_ADDRESS,
    deployer: DEPLOYER,
    deployBlock: DEPLOY_BLOCK,
    latestBlock: latest,
    tokenCount: rows.length,
    contractTotalSupply: (await contract.totalSupply()).toString(),
    // Current ownership — answers "does wallet X hold anything" in either mode.
    clusterHolders: rows.filter((r) => inCluster(r.currentOwner)).map((r) => ({
      tokenId: r.tokenId,
      currentOwner: r.currentOwner,
    })),
    holdersNotInKnownCluster: [...holders].filter((a) => !CLUSTER.has(a)),
    holdingsByAddress: Object.fromEntries(
      [...holders].map((a) => [a, rows.filter((r) => r.currentOwner.toLowerCase() === a).length]),
    ),
    // Original mint recipients — logs mode only.
    clusterRecipients: rows.filter((r) => inCluster(r.recipient)).map((r) => ({
      tokenId: r.tokenId,
      recipient: r.recipient,
      mintTx: r.mintTx,
    })),
    recipientsNotInKnownCluster: [...recipients].filter((a) => !CLUSTER.has(a)),
  };

  await mkdir("artifacts/onchain", { recursive: true });
  await writeFile("artifacts/onchain/authichain-nft-ledger.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
  await writeFile("artifacts/onchain/authichain-nft-summary.json", JSON.stringify(summary, null, 2) + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => {
    provider.destroy();
  })
  .catch((error) => {
    console.error(error);
    // Setting process.exitCode alone is not enough: ethers' _start() bootstrap
    // re-arms a 1s timer while the network is undetected, so the event loop
    // never drains and the job runs to its full timeout — the exact 60-minute
    // burn the preflight exists to prevent. destroy() releases that timer;
    // exit() guarantees it regardless of what else is still pending.
    provider.destroy();
    process.exit(1);
  });
