/**
 * Helpers for the live x402 smoke (scripts/x402-smoke.ts).
 * Never log a private key. Status + txHash only on a live success.
 */
import { ethers } from "ethers";
import { BASE_USDC_ASSET, BASE_USDC_EIP712 } from "../../src/lib/x402.ts";

export const OPS_PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
export const MIN_ATOMIC = 50000n;
export const BASE_CHAIN_ID = 8453;
export const DEFAULT_ENDPOINT = "https://authichain.com/api/x402";
export const DEFAULT_RPC = "https://mainnet.base.org";

const BALANCE_OF = new ethers.Interface([
  "function balanceOf(address owner) view returns (uint256)",
]);

const TRANSFER_WITH_AUTHORIZATION = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function readPrivateKey(): string {
  const raw = (
    process.env.POLYGON_PRIVATE_KEY ||
    process.env.WALLET_PRIVATE_KEY ||
    ""
  ).trim();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

export function isDryRun(): boolean {
  return process.env.DRY_RUN !== "false";
}

export function describePayer(payer: string, payTo: string): string {
  if (payer.toLowerCase() === payTo.toLowerCase()) {
    return `payer=${payer} payTo=${payTo} (self-pay smoke)`;
  }
  return `payer=${payer} payTo=${payTo} (payer funds payTo)`;
}

export function usdcBalanceOfCalldata(owner: string): string {
  return BALANCE_OF.encodeFunctionData("balanceOf", [owner]);
}

export function decodeUsdcBalance(result: string | undefined): bigint {
  if (!result || result === "0x") return 0n;
  return BigInt(result);
}

export async function fetchUsdcBalance(opts: {
  rpc: string;
  owner: string;
  asset?: string;
}): Promise<bigint> {
  const asset = opts.asset ?? BASE_USDC_ASSET;
  const res = await fetch(opts.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        { to: asset, data: usdcBalanceOfCalldata(opts.owner) },
        "latest",
      ],
    }),
  });
  if (!res.ok) throw new Error(`usdc_balance_rpc_http_${res.status}`);
  const body = (await res.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (body.error) throw new Error("usdc_balance_rpc_error");
  return decodeUsdcBalance(body.result);
}

export type ExactAuthorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

export type SmokePaymentProof = {
  x402Version: 1;
  scheme: "exact";
  network: string;
  payer: string;
  amount: string;
  signature: string;
  payload: {
    signature: string;
    authorization: ExactAuthorization;
  };
  extensions?: unknown;
};

export function eip712Domain(opts: {
  asset: string;
  chainId: number;
}): ethers.TypedDataDomain {
  return {
    name: BASE_USDC_EIP712.name,
    version: BASE_USDC_EIP712.version,
    chainId: opts.chainId,
    verifyingContract: opts.asset,
  };
}

export async function signExactPayment(opts: {
  wallet: ethers.Wallet;
  payTo: string;
  amountAtomic: string;
  asset?: string;
  network?: string;
  chainId?: number;
  validAfter?: number;
  validBefore?: number;
  nonce?: string;
  extensions?: unknown;
}): Promise<{ headerB64: string; proof: SmokePaymentProof }> {
  const from = await opts.wallet.getAddress();
  const asset = opts.asset ?? BASE_USDC_ASSET;
  const network = opts.network ?? "base";
  const chainId = opts.chainId ?? BASE_CHAIN_ID;
  const authorization: ExactAuthorization = {
    from,
    to: opts.payTo,
    value: opts.amountAtomic,
    validAfter: String(opts.validAfter ?? 0),
    validBefore: String(
      opts.validBefore ?? Math.floor(Date.now() / 1000) + 3600
    ),
    nonce: opts.nonce ?? ethers.hexlify(ethers.randomBytes(32)),
  };
  const signature = await opts.wallet.signTypedData(
    eip712Domain({ asset, chainId }),
    TRANSFER_WITH_AUTHORIZATION,
    authorization
  );
  const proof: SmokePaymentProof = {
    x402Version: 1,
    scheme: "exact",
    network,
    payer: from,
    amount: opts.amountAtomic,
    signature,
    payload: { signature, authorization },
    ...(opts.extensions ? { extensions: opts.extensions } : {}),
  };
  return {
    headerB64: Buffer.from(JSON.stringify(proof)).toString("base64"),
    proof,
  };
}

export function recoverExactSigner(
  proof: SmokePaymentProof,
  opts: { asset?: string; chainId?: number } = {}
): string {
  return ethers.verifyTypedData(
    eip712Domain({
      asset: opts.asset ?? BASE_USDC_ASSET,
      chainId: opts.chainId ?? BASE_CHAIN_ID,
    }),
    TRANSFER_WITH_AUTHORIZATION,
    proof.payload.authorization,
    proof.signature
  );
}
