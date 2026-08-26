// scripts/mint-govchain-nfts.ts
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const isDryRun  = process.env.DRY_RUN === 'true';
const supabase  = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const GOVCHAIN  = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

// Skip gracefully when blockchain config is missing. All three are
// required to mint; we'd rather skip cleanly than throw unhelpfully from
// ethers. Dry runs can proceed without them (we only log the payload).
const hasChainConfig = !!(
  process.env.ALCHEMY_API_KEY &&
  process.env.WALLET_PRIVATE_KEY &&
  process.env.CONTRACT_ADDRESS
);
if (!hasChainConfig) {
  console.warn('⚠️  Blockchain config missing (ALCHEMY_API_KEY / WALLET_PRIVATE_KEY / CONTRACT_ADDRESS) — skipping NFT minting.');
  process.exit(0);
}

const MINT_ABI = [
  'function mintOpportunityNFT(address to, string calldata noticeId, string calldata metadataURI) external returns (uint256)',
  'event OpportunityMinted(uint256 indexed tokenId, string noticeId, address minter)',
];

async function mintGovChainNFTs() {
  const { data: proposals, error } = await supabase
    .from('gov_proposals')
    .select('*')
    .eq('status', 'draft')
    .gte('fit_score', 75)
    .limit(5);

  if (error) throw error;
  if (!proposals?.length) { console.log('No proposals ready for NFT minting.'); return 0; }

  const provider = new ethers.JsonRpcProvider(
    `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  );
  const wallet   = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, MINT_ABI, wallet);

  let minted = 0;

  for (const proposal of proposals) {
    const metadataURI = `${GOVCHAIN}/api/nft-metadata/${proposal.notice_id}`;

    if (!isDryRun) {
      try {
        const tx = await contract.mintOpportunityNFT(
          wallet.address,
          proposal.notice_id,
          metadataURI
        );
        const receipt = await tx.wait();
        const tokenId = receipt.logs[0]?.args?.[0]?.toString() ?? 'unknown';

        await supabase
          .from('gov_proposals')
          .update({
            nft_token_id: tokenId,
            nft_tx_hash:  tx.hash,
            nft_minted_at: new Date().toISOString(),
            status:       'nft_minted',
          })
          .eq('notice_id', proposal.notice_id);

        console.log(`  🪙 Minted NFT tokenId=${tokenId} for ${proposal.notice_id}`);
      } catch (err: any) {
        console.error(`  ⚠️  Mint failed for ${proposal.notice_id}: ${err.message}`);
        continue;
      }
    } else {
      console.log(`  [DRY RUN] Would mint NFT for ${proposal.notice_id}`);
    }

    minted++;
  }

  return minted;
}

const total = await mintGovChainNFTs();
console.log(`✅ Minted ${total} GovChain NFTs`);
process.exit(0);
