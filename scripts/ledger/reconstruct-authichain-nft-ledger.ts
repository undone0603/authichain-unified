import { JsonRpcProvider, Contract, Interface, ZeroAddress, getAddress } from "ethers";
import { writeFile, mkdir } from "node:fs/promises";
import {
  COINBASE_SMART_WALLET,
  NFT_CLUSTER_KNOWN,
  NFT_DEPLOYER_EOA,
  POLYGON_AUTHICHAIN_NFT,
  QRON_FACTORY_CALLER,
  QRON_HOLDER_EOA,
} from "../lib/evm-chains.ts";

const CONTRACT_ADDRESS = POLYGON_AUTHICHAIN_NFT;
const DEPLOYER = NFT_DEPLOYER_EOA;
const DEPLOY_BLOCK = 77535676;
const DEFAULT_RPC = "https://polygon-rpc.com";
const CHUNK_SIZE = Number(process.env.AUTHICHAIN_LEDGER_CHUNK ?? 8_000);

const ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
  "event ProductMinted(uint256 indexed tokenId,string productIdentifier,address indexed manufacturer,uint256 timestamp)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getProductInfo(uint256 tokenId) view returns (tuple(string productIdentifier,string manufacturer,string model,string serialNumber,uint256 manufactureDate,string additionalDetails,bool isActive))",
  "function getSupplyChainHistory(uint256 tokenId) view returns (tuple(address actor,string eventType,string location,uint256 timestamp,string notes)[])",
  "function totalSupply() view returns (uint256)",
];

const provider = new JsonRpcProvider(process.env.POLYGON_RPC_URL ?? DEFAULT_RPC);
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

async function main() {
  const latest = await provider.getBlockNumber();
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

  rows.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  const recipients = new Set(rows.map((r) => r.recipient.toLowerCase()).filter(Boolean));
  // Known AuthiChainNFT recipient cluster — not a single “ops” wallet.
  // Names: docs/strategy/WEB3_IDENTITY.md
  const cluster = new Set([
    NFT_DEPLOYER_EOA,
    QRON_FACTORY_CALLER,
    COINBASE_SMART_WALLET,
    NFT_CLUSTER_KNOWN,
    QRON_HOLDER_EOA,
  ].map((a) => a.toLowerCase()));

  const summary = {
    contract: CONTRACT_ADDRESS,
    deployer: DEPLOYER,
    deployBlock: DEPLOY_BLOCK,
    latestBlock: latest,
    mintedCount: rows.length,
    contractTotalSupply: (await contract.totalSupply()).toString(),
    clusterRecipients: rows.filter((r) => cluster.has(r.recipient.toLowerCase())).map((r) => ({
      tokenId: r.tokenId,
      recipient: r.recipient,
      mintTx: r.mintTx,
    })),
    recipientsNotInKnownCluster: [...recipients].filter((a) => !cluster.has(a)),
  };

  await mkdir("artifacts/onchain", { recursive: true });
  await writeFile("artifacts/onchain/authichain-nft-ledger.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
  await writeFile("artifacts/onchain/authichain-nft-summary.json", JSON.stringify(summary, null, 2) + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
