/**
 * Thirdweb Blockchain Service
 * Server-side integration for NFT minting, contract interactions,
 * and on-chain authentication verification.
 */
import { createThirdwebClient, getContract, defineChain } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { mintTo, balanceOf, totalSupply, getOwnedNFTs } from "thirdweb/extensions/erc721";
import { transfer as erc20Transfer } from "thirdweb/extensions/erc20";
import { upload } from "thirdweb/storage";
import { sendTransaction, readContract } from "thirdweb";
import { ENV } from "./_core/env";

// ─── Client Initialization ──────────────────────────────────────────────────

let _client: ReturnType<typeof createThirdwebClient> | null = null;

export function getThirdwebClient() {
  if (!_client) {
    const secretKey = ENV.thirdwebSecretKey;
    if (!secretKey) {
      throw new Error("Thirdweb secret key not configured. Set thirdweb_api_key env var.");
    }
    _client = createThirdwebClient({ secretKey });
  }
  return _client;
}

// ─── Chain Configuration ────────────────────────────────────────────────────

// Using Polygon for low-cost NFT minting (production)
// Amoy testnet for development
export const CHAINS = {
  polygon: defineChain(137),
  polygonAmoy: defineChain(80002),
  ethereum: defineChain(1),
  sepolia: defineChain(11155111),
  base: defineChain(8453),
  baseSepolia: defineChain(84532),
} as const;

// Default to Polygon Amoy testnet for development, Polygon mainnet for production
export function getDefaultChain() {
  return ENV.isProduction ? CHAINS.polygon : CHAINS.polygonAmoy;
}

// ─── Contract Helpers ───────────────────────────────────────────────────────

export interface ContractConfig {
  address: string;
  chainId?: number;
}

export function getAuthiChainContract(config: ContractConfig) {
  const client = getThirdwebClient();
  const chain = config.chainId ? defineChain(config.chainId) : getDefaultChain();
  return getContract({
    client,
    chain,
    address: config.address,
  });
}

// ─── IPFS Upload ────────────────────────────────────────────────────────────

export interface NFTMetadata {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  properties?: Record<string, unknown>;
  // AuthiChain specific
  authichain_certificate?: string;
  authichain_product_id?: number;
  authichain_confidence_score?: number;
  authichain_verification_date?: string;
  authichain_blockchain_hash?: string;
}

async function uploadFileToIPFS(file: File): Promise<string> {
  const client = getThirdwebClient();
  const uri = await upload({ client, files: [file] });
  return typeof uri === "string" ? uri : uri[0];
}

export async function uploadToIPFS(data: File | string): Promise<string> {
  const file = typeof data === "string"
    ? new File([data], "data.json", { type: "application/json" })
    : data;
  return uploadFileToIPFS(file);
}

export async function uploadImageToIPFS(imageBuffer: Buffer | Uint8Array, filename: string): Promise<string> {
  return uploadFileToIPFS(new File([new Uint8Array(imageBuffer)], filename, { type: "image/png" }));
}

export async function uploadMetadataToIPFS(metadata: NFTMetadata): Promise<string> {
  return uploadFileToIPFS(new File([JSON.stringify(metadata)], "metadata.json", { type: "application/json" }));
}

// ─── NFT Minting ────────────────────────────────────────────────────────────

export interface MintNFTParams {
  contractAddress: string;
  recipientAddress: string;
  metadata: NFTMetadata;
  privateKey: string;
  chainId?: number;
}

export async function mintAuthenticationNFT(params: MintNFTParams) {
  const client = getThirdwebClient();
  const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: params.contractAddress });
  const account = privateKeyToAccount({ client, privateKey: params.privateKey as `0x${string}` });

  // Upload metadata to IPFS first
  const metadataUri = await uploadMetadataToIPFS(params.metadata);

  // Mint the NFT
  const transaction = mintTo({
    contract,
    to: params.recipientAddress,
    nft: {
      name: params.metadata.name,
      description: params.metadata.description,
      image: params.metadata.image,
      external_url: params.metadata.external_url,
      attributes: params.metadata.attributes,
      properties: params.metadata.properties,
    },
  });

  const result = await sendTransaction({ transaction, account });

  return {
    transactionHash: result.transactionHash,
    metadataUri,
    chain: chain.id,
  };
}

// ─── AuthiChain Seal (SBT) ──────────────────────────────────────────────────

export async function mintSecuritySeal(params: {
  contractAddress: string;
  recipientAddress: string;
  tokenId: number;
  uri: string;
  privateKey: string;
  chainId?: number;
}) {
  const client = getThirdwebClient();
  const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: params.contractAddress });
  const account = privateKeyToAccount({ client, privateKey: params.privateKey as `0x${string}` });

  const transaction = {
    contract,
    method: "function safeMint(address to, uint256 tokenId, string memory uri)",
    params: [params.recipientAddress, BigInt(params.tokenId), params.uri],
  } as any;

  const result = await sendTransaction({ transaction, account });
  return { transactionHash: result.transactionHash };
}

export async function voidSecuritySeal(params: {
  contractAddress: string;
  tokenId: number;
  privateKey: string;
  chainId?: number;
}) {
  const client = getThirdwebClient();
  const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: params.contractAddress });
  const account = privateKeyToAccount({ client, privateKey: params.privateKey as `0x${string}` });

  const transaction = {
    contract,
    method: "function voidSeal(uint256 tokenId)",
    params: [BigInt(params.tokenId)],
  } as any;

  const result = await sendTransaction({ transaction, account });
  return { transactionHash: result.transactionHash };
}

// ─── Counterfeit Bounty ─────────────────────────────────────────────────────

export async function lockCounterfeitBounty(params: {
  contractAddress: string;
  certificateNumber: string;
  tokenAddress: string;
  amount: string;
  durationDays: number;
  privateKey: string;
  chainId?: number;
}) {
  const client = getThirdwebClient();
  const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: params.contractAddress });
  const account = privateKeyToAccount({ client, privateKey: params.privateKey as `0x${string}` });

  const transaction = {
    contract,
    method: "function lockBounty(string _certificateNumber, address _token, uint256 _amount, uint256 _durationDays)",
    params: [params.certificateNumber, params.tokenAddress, BigInt(params.amount), BigInt(params.durationDays)],
  } as any;

  const result = await sendTransaction({ transaction, account });
  return { transactionHash: result.transactionHash };
}

// ─── ERC-20 ($QRON) Transfers ───────────────────────────────────────────────

export interface Erc20TransferParams {
  /** ERC-20 token contract address. Defaults to ENV.qronTokenAddress. */
  tokenAddress?: string;
  /** Recipient wallet address. */
  to: string;
  /** Human-readable token amount (e.g. "12.5"), converted by the extension. */
  amount: string | number;
  /** Treasury signer private key. Defaults to ENV.blockchainPrivateKey. */
  privateKey?: string;
  chainId?: number;
}

/**
 * Send ERC-20 tokens from the treasury wallet. Refuses to act unless both a
 * token address and a signing key are configured — never guesses a contract.
 */
export async function transferErc20(params: Erc20TransferParams) {
  const tokenAddress = params.tokenAddress || ENV.qronTokenAddress;
  const privateKey = params.privateKey || ENV.blockchainPrivateKey;
  if (!tokenAddress) throw new Error("transferErc20: no token address configured (QRON_TOKEN_ADDRESS)");
  if (!privateKey) throw new Error("transferErc20: no treasury private key configured (BLOCKCHAIN_PRIVATE_KEY)");

  const client = getThirdwebClient();
  const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: tokenAddress });
  const account = privateKeyToAccount({ client, privateKey: privateKey as `0x${string}` });

  const transaction = erc20Transfer({ contract, to: params.to, amount: String(params.amount) });
  const result = await sendTransaction({ transaction, account });
  return { transactionHash: result.transactionHash, chain: chain.id };
}

/**
 * Buyback/burn: send tokens to the burn sink (ENV.qronBurnAddress, default
 * the standard dead address). Same guards as transferErc20.
 */
export async function burnErc20(params: { tokenAddress?: string; amount: string | number; privateKey?: string; chainId?: number }) {
  return transferErc20({
    tokenAddress: params.tokenAddress,
    to: ENV.qronBurnAddress,
    amount: params.amount,
    privateKey: params.privateKey,
    chainId: params.chainId,
  });
}

// ─── Read Operations ────────────────────────────────────────────────────────

export async function getNFTBalance(contractAddress: string, walletAddress: string, chainId?: number) {
  const client = getThirdwebClient();
  const chain = chainId ? defineChain(chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: contractAddress });
  const balance = await balanceOf({ contract, owner: walletAddress });
  return balance.toString();
}

export async function getContractTotalSupply(contractAddress: string, chainId?: number) {
  const client = getThirdwebClient();
  const chain = chainId ? defineChain(chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: contractAddress });
  const supply = await totalSupply({ contract });
  return supply.toString();
}

export async function getWalletNFTs(contractAddress: string, walletAddress: string, chainId?: number) {
  const client = getThirdwebClient();
  const chain = chainId ? defineChain(chainId) : getDefaultChain();
  const contract = getContract({ client, chain, address: contractAddress });
  const nfts = await getOwnedNFTs({ contract, owner: walletAddress });
  return nfts;
}

// ─── Authentication Certificate NFT ─────────────────────────────────────────

export interface AuthCertificateNFTData {
  productName: string;
  productBrand?: string;
  productSerial?: string;
  confidenceScore: number;
  verificationDate: string;
  certificateNumber: string;
  imageUrl?: string;
  authenticatorId: number;
  result?: unknown;
}

/**
 * Lightweight connection-status probe used by tests and health checks.
 */
export function getConnectionStatus() {
  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID ?? "";
  return { connected: !!clientId, clientConfigured: !!clientId };
}

export function buildAuthCertificateMetadata(data: AuthCertificateNFTData): NFTMetadata {
  return {
    name: `AuthiChain Certificate: ${data.productName}`,
    description: `Blockchain-verified authentication certificate for ${data.productBrand ? data.productBrand + " " : ""}${data.productName}. Verified with ${data.confidenceScore}% confidence by AuthiChain AI on ${data.verificationDate}.`,
    image: data.imageUrl,
    external_url: `https://authichain.com/certificate/${data.certificateNumber}`,
    attributes: [
      { trait_type: "Product", value: data.productName },
      ...(data.productBrand ? [{ trait_type: "Brand", value: data.productBrand }] : []),
      ...(data.productSerial ? [{ trait_type: "Serial Number", value: data.productSerial }] : []),
      { trait_type: "Confidence Score", value: data.confidenceScore },
      { trait_type: "Verification Date", value: data.verificationDate },
      { trait_type: "Certificate Number", value: data.certificateNumber },
      { trait_type: "Verification Method", value: "AI Image Analysis + Blockchain" },
      { trait_type: "Platform", value: "AuthiChain" },
    ],
    properties: {
      authichain_version: "2.0",
      verification_engine: "AuthiChain AI v2",
    },
    authichain_certificate: data.certificateNumber,
    authichain_product_id: data.authenticatorId,
    authichain_confidence_score: data.confidenceScore,
    authichain_verification_date: data.verificationDate,
  };
}

// ─── Supply Chain Verification ──────────────────────────────────────────────

export interface SupplyChainNFTData {
  productName: string;
  eventType: string;
  location: string;
  handler: string;
  timestamp: string;
  previousHash?: string;
}

export function buildSupplyChainMetadata(data: SupplyChainNFTData): NFTMetadata {
  return {
    name: `Supply Chain Event: ${data.eventType} - ${data.productName}`,
    description: `Supply chain verification event for ${data.productName}. Event: ${data.eventType} at ${data.location} by ${data.handler}.`,
    attributes: [
      { trait_type: "Event Type", value: data.eventType },
      { trait_type: "Location", value: data.location },
      { trait_type: "Handler", value: data.handler },
      { trait_type: "Timestamp", value: data.timestamp },
      ...(data.previousHash ? [{ trait_type: "Previous Hash", value: data.previousHash }] : []),
      { trait_type: "Platform", value: "AuthiChain" },
    ],
  };
}

// ─── Thirdweb Status Check ──────────────────────────────────────────────────

export async function checkThirdwebConnection(): Promise<{
  connected: boolean;
  clientId: string;
  chain: string;
  error?: string;
}> {
  try {
    const client = getThirdwebClient();
    const chain = getDefaultChain();
    return {
      connected: true,
      clientId: ENV.thirdwebClientId || "configured",
      chain: ENV.isProduction ? "Polygon Mainnet (137)" : "Polygon Amoy Testnet (80002)",
    };
  } catch (error: any) {
    return {
      connected: false,
      clientId: "",
      chain: "",
      error: error.message,
    };
  }
}
