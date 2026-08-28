// scripts/mint-govchain-nfts.ts
// Chain-aware GovChain pilot mint.
// Default chain = Base (8453) for Coinbase Smart Wallet pilots.
// Live product certificates stay on Polygon AuthiChainNFT (mintProduct).

import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { GOVCHAIN_SIGNER, POLYGON_AUTHICHAIN_NFT, resolveChain, rpcUrl } from "./lib/evm-chains.js";

const isDryRun = process.env.DRY_RUN !== "false";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const GOVCHAIN = process.env.GOVCHAIN_URL ?? "https://govchain.us";
const chain = resolveChain();
const contractAddress =
  process.env.CONTRACT_ADDRESS || process.env.GOVCHAIN_NFT_CONTRACT || "";
const walletKey = process.env.WALLET_PRIVATE_KEY || process.env.POLYGON_PRIVATE_KEY || "";

const PRODUCT_ABI = [
  "function mintProduct(address to, string productIdentifier, string manufacturer, string model, string serialNumber, string additionalDetails, string uri) external returns (uint256)",
  "event ProductMinted(uint256 indexed tokenId, string productIdentifier, address indexed manufacturer, uint256 timestamp)",
];
const OPP_ABI = [
  "function mintOpportunityNFT(address to, string calldata noticeId, string calldata metadataURI) external returns (uint256)",
  "event OpportunityMinted(uint256 indexed tokenId, string noticeId, address minter)",
];

async function mintGovChainNFTs() {
  console.log(`[gov-mint] chain=${chain.name} (${chain.chainId}) dryRun=${isDryRun}`);

  if (!contractAddress || !walletKey) {
    console.warn(
      "[gov-mint] Missing CONTRACT_ADDRESS / WALLET_PRIVATE_KEY — skipping. Deploy AuthiChainNFT to Base or set CHAIN=polygon to use the live Polygon contract."
    );
    return 0;
  }

  const { data: proposals, error } = await supabase
    .from("gov_proposals")
    .select("*")
    .eq("status", "draft")
    .gte("fit_score", 75)
    .limit(5);

  if (error) throw error;
  if (!proposals?.length) {
    console.log("[gov-mint] No proposals ready for NFT minting.");
    return 0;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl(chain));
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chain.chainId) {
    throw new Error(
      `[gov-mint] RPC chainId ${network.chainId} != expected ${chain.chainId}. Check ALCHEMY_API_KEY / CHAIN.`
    );
  }

  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") {
    console.warn(
      `[gov-mint] No contract at ${contractAddress} on ${chain.name}. ` +
        (chain.chainId === 8453
          ? "AuthiChainNFT is live on Polygon only (0x4da4…). Redeploy to Base or set CHAIN=polygon."
          : `Confirm ${POLYGON_AUTHICHAIN_NFT} on Polygon.`)
    );
    return 0;
  }

  const wallet = new ethers.Wallet(walletKey, provider);
  const product = new ethers.Contract(contractAddress, PRODUCT_ABI, wallet);
  const opportunity = new ethers.Contract(contractAddress, OPP_ABI, wallet);

  let minted = 0;
  for (const proposal of proposals) {
    const metadataURI = `${GOVCHAIN}/api/nft-metadata/${proposal.notice_id}`;
    const to = wallet.address || GOVCHAIN_SIGNER;

    if (isDryRun) {
      console.log(
        `[gov-mint] DRY RUN ${proposal.notice_id} → ${chain.explorer}/address/${contractAddress}`
      );
      minted++;
      continue;
    }

    try {
      let tx: ethers.ContractTransactionResponse;
      try {
        tx = await product.mintProduct(
          to,
          proposal.notice_id,
          "GovChain",
          proposal.agency || "Federal Agency",
          proposal.notice_id,
          JSON.stringify({ fit_score: proposal.fit_score, source: "gov-engine" }),
          metadataURI
        );
      } catch (first: any) {
        if (!String(first?.message || first).includes("mintProduct")) throw first;
        tx = await opportunity.mintOpportunityNFT(to, proposal.notice_id, metadataURI);
      }

      const receipt = await tx.wait();
      const tokenId = receipt?.logs?.[0] ? "mined" : "unknown";

      await supabase
        .from("gov_proposals")
        .update({
          nft_token_id: tokenId,
          nft_tx_hash: tx.hash,
          nft_minted_at: new Date().toISOString(),
          status: "nft_minted",
        })
        .eq("notice_id", proposal.notice_id);

      console.log(`[gov-mint] minted ${proposal.notice_id} tx=${tx.hash} ${chain.explorer}/tx/${tx.hash}`);
      minted++;
    } catch (err: any) {
      console.error(`[gov-mint] failed ${proposal.notice_id}: ${err.message}`);
    }
  }

  return minted;
}

const total = await mintGovChainNFTs();
console.log(`[gov-mint] done minted=${total} chain=${chain.key}`);
process.exit(0);
