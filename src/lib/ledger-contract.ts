/**
 * AuthiChainLedger contract binding.
 *
 * Deliberately separate from the AuthiChainNFT binding — the NFT contract keeps
 * doing TrueMark product certificates and is not touched by any ledger code.
 */

export const LEDGER_CONTRACT_ADDRESS = (process.env.LEDGER_CONTRACT_ADDRESS ?? "").trim();

export const LEDGER_CHAIN_ID = Number(process.env.LEDGER_CHAIN_ID ?? 137);

export const LEDGER_RPC_URL =
  process.env.NFT_RPC_URL?.trim() || "https://polygon-rpc.com";

/** Currency enum written on-chain. Anything not listed here is not anchored. */
export const CURRENCY_CODES: Record<string, number> = {
  usd: 0,
  eur: 1,
  gbp: 2,
  cad: 3,
  aud: 4,
};

/** Source enum written on-chain. */
export const SOURCE_LIVE = 0;
export const SOURCE_BACKFILL = 1;

export const EXPLORER_TX_BASE =
  LEDGER_CHAIN_ID === 137
    ? "https://polygonscan.com/tx/"
    : "https://amoy.polygonscan.com/tx/";

export const LEDGER_ABI = [
  "function recordSale(bytes32 stripeRef, bytes32 sku, uint256 amountCents, uint8 currency, address buyer, uint8 source, uint256 stripeCreated) external returns (uint256)",
  "function recordSaleBatch((bytes32,bytes32,uint256,uint8,address,uint8,uint256)[] inputs) external returns (uint256[])",
  "function recordReversal(bytes32 stripeRef) external",
  "function saleByStripeRef(bytes32 stripeRef) external view returns (tuple(bytes32 stripeRef,bytes32 sku,uint256 amountCents,uint8 currency,address buyer,uint8 source,uint256 stripeCreated,uint256 anchoredAt,bool reversed))",
  "function saleIdByRef(bytes32) external view returns (uint256)",
  "function isAnchored(bytes32 stripeRef) external view returns (bool)",
  "function totalSales() external view returns (uint256)",
  "function isRecorder(address) external view returns (bool)",
  "function setRecorder(address account, bool allowed) external",
  "event SaleRecorded(uint256 indexed saleId, bytes32 indexed stripeRef, bytes32 indexed sku, uint256 amountCents, uint8 source)",
  "event SaleReversed(uint256 indexed saleId, bytes32 indexed stripeRef)",
  "event DuplicateSaleIgnored(uint256 indexed saleId, bytes32 indexed stripeRef)",
] as const;

export function isLedgerConfigured(): boolean {
  return LEDGER_CONTRACT_ADDRESS.length > 0;
}
