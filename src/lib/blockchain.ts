import { ethers } from 'ethers';

/**
 * AuthiChain.sol ABI - Core Protocol Interface
 * Includes anchoring and certificate minting capabilities.
 */
export const AUTHICHAIN_ABI = [
  // Anchoring
  "function anchorHash(bytes32 edgeHash, string metadata) external returns (uint256)",
  "function anchoredHashes(uint256) external view returns (bytes32)",
  "function anchorMetadata(uint256) external view returns (string)",
  
  // Minting & Revenue Split
  "function mintCertificateWithSplit(address recipient, string uri, address affiliate) external payable returns (uint256)",
  "function treasuryWallet() external view returns (address)",
  
  // Events
  "event HashAnchored(uint256 indexed anchorId, bytes32 indexed edgeHash, address indexed submitter)",
  "event CertificateMinted(uint256 indexed tokenId, address indexed recipient, string uri)",
  "event RevenueSplit(address indexed affiliate, uint256 affiliateAmount, uint256 treasuryAmount)"
];

/**
 * Anchors a cryptographic Edge hash to the Polygon Mainnet.
 * Used for Phase 2: Blockchain transition.
 * 
 * @param edgeHash The Ed25519 signature hash to anchor
 * @param metadata Additional metadata for the anchor (e.g. QRON ID, Theater ID)
 * @returns The transaction hash and anchor ID
 */
export async function anchorEdgeHash(edgeHash: string, metadata: string) {
  const providerUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  const contractAddress = process.env.AUTHICHAIN_CONTRACT_ADDRESS;

  if (!privateKey || !contractAddress) {
    throw new Error('Blockchain configuration missing: private key or contract address');
  }

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, AUTHICHAIN_ABI, wallet);

    // Ensure the hash is correctly formatted for bytes32 (64 hex chars + 0x)
    let formattedHash = edgeHash;
    if (!formattedHash.startsWith('0x')) {
      formattedHash = `0x${formattedHash}`;
    }
    
    // If it's a SHA256 or similar 32-byte hash, it should be 66 chars long with 0x
    if (formattedHash.length !== 66) {
      console.warn(`[Blockchain] Hash length mismatch: ${formattedHash.length}. Expected 66 (0x + 64 hex).`);
      // Optional: Pad or trim if strictly necessary, but better to fail early if invalid
    }

    console.log(`[Blockchain] Anchoring to Polygon: ${formattedHash} | Metadata: ${metadata}`);
    
    // Estimate gas for better UX/logging
    const gasLimit = await contract.anchorHash.estimateGas(formattedHash, metadata).catch(() => BigInt(100000));
    
    const tx = await contract.anchorHash(formattedHash, metadata, {
      gasLimit: (gasLimit * BigInt(120)) / BigInt(100) // 20% buffer
    });
    
    const receipt = await tx.wait();
    
    // Extract anchor ID from event
    let anchorId = null;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog?.name === 'HashAnchored') {
            anchorId = parsedLog.args.anchorId.toString();
            break;
          }
        } catch (e) {
          // Continue to next log if parsing fails
        }
      }
    }

    return {
      txHash: tx.hash,
      anchorId,
      blockNumber: receipt.blockNumber,
      status: 'success'
    };
  } catch (err) {
    console.error('[Blockchain] Transaction failed:', err);
    throw err;
  }
}

/**
 * Mints an AuthiChain Certificate NFT on Polygon.
 * Handles the 80/20 revenue split autonomously.
 */
export async function mintAuthiChainCertificate(
  recipient: string, 
  metadataUri: string, 
  priceInEth: string,
  affiliateAddress?: string
) {
  const providerUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  const contractAddress = process.env.AUTHICHAIN_CONTRACT_ADDRESS;

  if (!privateKey || !contractAddress) {
    throw new Error('Blockchain configuration missing');
  }

  const provider = new ethers.JsonRpcProvider(providerUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, AUTHICHAIN_ABI, wallet);

  const value = ethers.parseEther(priceInEth);
  const affiliate = affiliateAddress || ethers.ZeroAddress;

  console.log(`[Blockchain] Minting certificate for ${recipient} via ${affiliate}`);

  const tx = await contract.mintCertificateWithSplit(recipient, metadataUri, affiliate, {
    value,
    gasLimit: 300000 // Certificates are more gas-intensive
  });

  const receipt = await tx.wait();
  
  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber
  };
}
