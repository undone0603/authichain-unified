import { createThirdwebClient, defineChain } from 'thirdweb';
import { baseSepolia, base, polygon, ethereum } from 'thirdweb/chains';

// Fall back to a placeholder during SSR/build when the env var is not set.
// The real clientId must be provided at runtime via NEXT_PUBLIC_THIRDWEB_CLIENT_ID.
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'not-configured';

export const thirdwebClient = createThirdwebClient({ clientId });

// Active chain — override with NEXT_PUBLIC_THIRDWEB_CHAIN=base for production
const chainName = process.env.NEXT_PUBLIC_THIRDWEB_CHAIN ?? 'base-sepolia';
export const activeChain = chainName === 'base' ? base : baseSepolia;

export const chains = {
  polygon,
  polygonAmoy: defineChain(80002),
  ethereum,
  sepolia: defineChain(11155111),
  base,
  baseSepolia,
} as const;

export const defaultChain = chainName === 'base' ? chains.polygon : chains.polygonAmoy;

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
  return explorers[chainId] || '#';
}

export function getIPFSUrl(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://${clientId}.ipfscdn.io/ipfs/${uri.replace('ipfs://', '')}`;
  }
  return uri;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
