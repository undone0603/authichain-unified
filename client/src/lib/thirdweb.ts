/**
 * Thirdweb Frontend Client Configuration
 * Uses the VITE_THIRDWEB_CLIENT_ID env var for client-side SDK initialization.
 */
import { createThirdwebClient, defineChain } from "thirdweb";

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

if (!clientId) {
  console.warn("[Thirdweb] VITE_THIRDWEB_CLIENT_ID not set. Blockchain features will be limited.");
}

export const thirdwebClient = clientId
  ? createThirdwebClient({ clientId })
  : null;

// Chain definitions for frontend
export const chains = {
  polygon: defineChain(137),
  polygonAmoy: defineChain(80002),
  ethereum: defineChain(1),
  sepolia: defineChain(11155111),
  base: defineChain(8453),
  baseSepolia: defineChain(84532),
} as const;

// Default chain (Amoy testnet for dev, Polygon for production)
export const defaultChain = import.meta.env.PROD ? chains.polygon : chains.polygonAmoy;

export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    137: "Polygon",
    80002: "Polygon Amoy",
    1: "Ethereum",
    11155111: "Sepolia",
    8453: "Base",
    84532: "Base Sepolia",
  };
  return names[chainId] || `Chain ${chainId}`;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    137: `https://polygonscan.com/tx/${txHash}`,
    80002: `https://amoy.polygonscan.com/tx/${txHash}`,
    1: `https://etherscan.io/tx/${txHash}`,
    11155111: `https://sepolia.etherscan.io/tx/${txHash}`,
    8453: `https://basescan.org/tx/${txHash}`,
    84532: `https://sepolia.basescan.org/tx/${txHash}`,
  };
  return explorers[chainId] || `#`;
}

export function getIPFSUrl(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://${clientId}.ipfscdn.io/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
