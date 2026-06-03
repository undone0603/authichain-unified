import { ethers } from 'ethers';

/**
 * AuthiChain Phase 2: Blockchain Anchoring
 * This action anchors Ed25519 Edge hashes to the Polygon Mainnet.
 * Used for immutable compliance logging (Theater 1: StrainChain).
 */

const AUTHICHAIN_ABI = [
  "function anchorHash(bytes32 edgeHash, string metadata) external returns (uint256)",
  "event HashAnchored(uint256 indexed anchorId, bytes32 indexed edgeHash, address indexed submitter)"
];

export async function anchorToPolygon(
  metrcTag: string,
  edgeHash: string,
  eventId: string | number
) {
  // Environment variables prioritize unified naming conventions
  const providerUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  const contractAddress = 
    process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS || 
    process.env.AUTHICHAIN_CONTRACT_ADDRESS;

  if (!privateKey || !contractAddress) {
    console.warn(
      '[Blockchain Anchor] Missing credentials. Ensure BLOCKCHAIN_PRIVATE_KEY and AUTHICHAIN_CONTRACT_ADDRESS are set.'
    );
    return { 
      success: false, 
      error: 'Blockchain configuration missing',
      txHash: null 
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, AUTHICHAIN_ABI, wallet);

    console.log(`[Blockchain Anchor] Initiating anchor for ${metrcTag}...`);
    console.log(`[Blockchain Anchor] Hash: ${edgeHash}`);

    // Ensure edgeHash is a proper bytes32 hex string
    const formattedHash = edgeHash.startsWith('0x') ? edgeHash : `0x${edgeHash}`;
    
    const metadata = `metrc:${metrcTag}|event:${eventId}|agent:agentz-core`;

    // Execute the transaction
    const tx = await contract.anchorHash(formattedHash, metadata);
    console.log(`[Blockchain Anchor] Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Blockchain Anchor] Confirmed in block ${receipt.blockNumber}`);

    return { 
      success: true, 
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Blockchain Anchor] Critical failure:', message);
    return { 
      success: false, 
      error: message,
      txHash: null 
    };
  }
}
