// scripts/mint-agentz.ts
// Canonical AgentZ identity mint on the existing Polygon AuthiChainProduct ERC-721.
//
// Safety model:
// - DRY_RUN defaults to true. Set DRY_RUN=false to broadcast.
// - Never derives a recipient from QRON, treasury, deployer, or contract addresses.
// - Broadcast requires an explicit AGENTZ_RECIPIENT and POLYGON_PRIVATE_KEY.
// - The signer must already be authorized by AuthiChainNFT (MINTER_ROLE plus
//   verified manufacturer, or DEFAULT_ADMIN_ROLE).
// - This mints ONE AgentZ identity certificate; it does not mint/burn $QRON.

import { ethers } from "ethers";
import { isEmptyBytecode } from "./lib/authichain-nft-artifact.js";
import { CHAINS, rpcUrl } from "./lib/evm-chains.js";

const CHAIN_ID = 137;
const CONTRACT_ADDRESS =
  process.env.AUTHICHAIN_NFT_CONTRACT ||
  "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://authichain.com";
const DRY_RUN = process.env.DRY_RUN !== "false";
const RECIPIENT = process.env.AGENTZ_RECIPIENT || "";
const PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || "";
const RPC = process.env.POLYGON_RPC_URL || rpcUrl(CHAINS.polygon);

const ABI = [
  "function mintProduct(address to, string productIdentifier, string manufacturer, string model, string serialNumber, string additionalDetails, string uri) external returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function isManufacturerVerified(address manufacturer) view returns (bool)",
  "function MINTER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
];

function requireAddress(value: string, name: string): string {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }
  return ethers.getAddress(value);
}

function metadataUri(): string {
  const metadata = {
    name: "AgentZ — AuthiChain Autonomous Agent Identity",
    description:
      "Canonical ERC-721 identity certificate for AgentZ, the AuthiChain autonomous operational control-plane layer.",
    external_url: `${DEFAULT_APP_URL}/agentz`,
    image: `${DEFAULT_APP_URL}/agentz/identity.svg`,
    attributes: [
      { trait_type: "Protocol", value: "AuthiChain" },
      { trait_type: "Identity", value: "AgentZ" },
      { trait_type: "Role", value: "Autonomous operational control plane" },
      { trait_type: "Certificate", value: "AuthiChainProduct ERC-721" },
      { trait_type: "Chain", value: "Polygon PoS" },
      { trait_type: "Chain ID", value: CHAIN_ID },
      { trait_type: "QRON", value: "Utility/incentive identity binding; not the source of authenticity" },
      { trait_type: "Mint semantics", value: "Identity certificate; not a fungible token issuance" },
    ],
  };

  return `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
}

async function main() {
  const recipient = DRY_RUN
    ? RECIPIENT && ethers.isAddress(RECIPIENT)
      ? ethers.getAddress(RECIPIENT)
      : "<EXPLICIT-AGENTZ-RECIPIENT-REQUIRED-FOR-LIVE-MINT>"
    : requireAddress(RECIPIENT, "AGENTZ_RECIPIENT");

  if (!DRY_RUN && !PRIVATE_KEY) {
    throw new Error("POLYGON_PRIVATE_KEY (or WALLET_PRIVATE_KEY) is required when DRY_RUN=false");
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`RPC chainId ${network.chainId} != expected Polygon chainId ${CHAIN_ID}`);
  }

  const contractCode = await provider.getCode(CONTRACT_ADDRESS);
  if (isEmptyBytecode(contractCode)) {
    throw new Error(`No AuthiChainNFT contract at ${CONTRACT_ADDRESS} on Polygon`);
  }

  const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
  const signerAddress = signer?.address ?? "<DRY-RUN-SIGNER>";
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer ?? provider);

  const minterRole = await contract.MINTER_ROLE();
  const adminRole = await contract.DEFAULT_ADMIN_ROLE();
  const signerIsMinter = signer ? await contract.hasRole(minterRole, signer.address) : false;
  const signerIsAdmin = signer ? await contract.hasRole(adminRole, signer.address) : false;
  const signerIsVerified = signer ? await contract.isManufacturerVerified(signer.address) : false;

  console.log(`[agentz-mint] Polygon ${CHAIN_ID}`);
  console.log(`[agentz-mint] contract=${CONTRACT_ADDRESS}`);
  console.log(`[agentz-mint] recipient=${recipient}`);
  console.log(`[agentz-mint] signer=${signerAddress}`);
  console.log(`[agentz-mint] authorization: minter=${signerIsMinter} admin=${signerIsAdmin} verified=${signerIsVerified}`);

  if (!DRY_RUN) {
    if (!signerIsMinter || (!signerIsAdmin && !signerIsVerified)) {
      throw new Error(
        "Signer is not authorized for mintProduct: requires MINTER_ROLE and either DEFAULT_ADMIN_ROLE or verified manufacturer status."
      );
    }
  }

  const identifier = "AGENTZ-001";
  const manufacturer = "AuthiChain";
  const model = "AgentZ Autonomous Control Plane";
  const serialNumber = "AGENTZ-CANONICAL-001";
  const details = JSON.stringify({
    identity: "AgentZ",
    protocol: "AuthiChain",
    qron: "0xAebfA6b08fb25b59748c93273aB8880e20FfE437",
    certificateContract: CONTRACT_ADDRESS,
    certificateSemantics: "identity_certificate",
    sourceOfTruth: "AuthiChain attestation layer",
    economicLayer: "QRON utility/incentive layer",
  });
  const uri = metadataUri();

  if (DRY_RUN) {
    console.log("[agentz-mint] DRY RUN — no transaction broadcast.");
    console.log(`[agentz-mint] identifier=${identifier}`);
    console.log(`[agentz-mint] metadata=${uri}`);
    return;
  }

  const tx = await contract.mintProduct(
    recipient,
    identifier,
    manufacturer,
    model,
    serialNumber,
    details,
    uri
  );
  console.log(`[agentz-mint] submitted tx=${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`AgentZ mint transaction failed: ${tx.hash}`);
  }
  console.log(`[agentz-mint] CONFIRMED tx=${tx.hash}`);
  console.log(`[agentz-mint] explorer=https://polygonscan.com/tx/${tx.hash}`);
}

main().catch((error) => {
  console.error("[agentz-mint] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
