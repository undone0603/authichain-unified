import { ethers } from 'ethers';

// AuthiChain.sol ABI - Placeholder for Edge hash anchoring
// The user context mentioned AuthiChain.sol was compiled via Remix.
// We will implement the anchorHash function which is standard for this protocol.
export const AUTHICHAIN_ABI = [
  "function anchorHash(bytes32 edgeHash, string metadata) external returns (uint256)",
  "event HashAnchored(uint256 indexed anchorId, bytes32 indexed edgeHash, address indexed submitter)"
];

/**
 * Anchors a cryptographic Edge hash to the Polygon Mainnet.
 * Used for Phase 2: Blockchain transition.
 * 
 * @param edgeHash The Ed25519 signature hash to anchor
 * @param metadata Additional metadata for the anchor (e.g. QRON ID)
 * @returns The transaction hash and anchor ID
 */
export async function anchorEdgeHash(edgeHash: string, metadata: string) {
  const providerUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  const contractAddress = process.env.AUTHICHAIN_CONTRACT_ADDRESS;

  if (!privateKey || !contractAddress) {
    throw new Error('Blockchain configuration missing: private key or contract address');
  }

  const provider = new ethers.JsonRpcProvider(providerUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, AUTHICHAIN_ABI, wallet);

  // Ensure the hash is correctly formatted for bytes32
  const formattedHash = edgeHash.startsWith('0x') ? edgeHash : `0x${edgeHash}`;
  
  console.log(`[Blockchain] Anchoring hash: ${formattedHash} for ${metadata}`);
  
  const tx = await contract.anchorHash(formattedHash, metadata);
  const receipt = await tx.wait();
  
  // Extract anchor ID from event if available
  const event = (receipt.logs as unknown[]).find((log) => {
    const anyLog = log as { fragment?: { name: string } };
    return anyLog.fragment?.name === 'HashAnchored';
  }) as unknown as { args: { anchorId: { toString(): string } } } | undefined;
  
  const anchorId = event ? event.args.anchorId.toString() : null;

  return {
    txHash: tx.hash,
    anchorId,
    blockNumber: receipt.blockNumber
  };
}
