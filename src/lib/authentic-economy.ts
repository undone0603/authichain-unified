/**
 * Speculative $QRON fee_flow / staking-discount math, plus the three-rail join.
 *
 * This file is NOT live agent settlement. `BASE_AUTH_FEE` is 0.05 **$QRON** in
 * a theater model (staker discount / treasury / burn). Live agent pay is
 * Circle USDC $0.05 on Base via `src/lib/x402.ts`. Human SKUs are Stripe via
 * `src/lib/plans.ts`. Wallet map: `docs/strategy/WEB3_IDENTITY.md`.
 *
 * The 0.05 QRON figure coinciding with x402's $0.05 USDC is not the same rail.
 * Do not add $QRON to x402 accepts[]. Do not rebind X402_PAY_TO. Runtime x402
 * still reads env X402_PAY_TO — published payTo here is identity, not a 503/402
 * fallback.
 */

import {
  NFT_DEPLOYER_EOA,
  POLYGON_AUTHICHAIN_NFT,
  QRON_DECIMALS,
  QRON_ERC20,
  QRON_TOTAL_SUPPLY,
  TOKENOMICS_PAY_TO,
} from "../../scripts/lib/evm-chains";
import { BASE_USDC_ASSET, X402_PUBLISHED_PAY_TO } from "./x402";
import { planPaymentLink, planUsd } from "./plans";
import { supabaseAdmin as admin } from "./supabase-admin";

export {
  NFT_DEPLOYER_EOA,
  POLYGON_AUTHICHAIN_NFT,
  QRON_DECIMALS,
  QRON_ERC20,
  QRON_TOTAL_SUPPLY,
  TOKENOMICS_PAY_TO,
};

export type StakingTier = "none" | "bronze" | "silver" | "gold" | "platinum";

export const WEB3_IDENTITY_DOC =
  "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/WEB3_IDENTITY.md";
export const AGENT_TOKENOMICS_DOC =
  "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/AGENT_TOKENOMICS_x402.md";

/**
 * Three money rails as code — same story as WEB3_IDENTITY.md.
 * payTo is the named published identity (tokenomics EOA). Runtime x402 still
 * reads `X402_PAY_TO` from the Worker/env binding.
 */
export const MONEY_RAILS = {
  stripe: {
    rail: "stripe",
    buyer: "human",
    source: "src/lib/plans.ts",
    skus: {
      passportUsd: planUsd("strainchain_passport"),
      dppUsd: planUsd("dpp_readiness"),
    },
    isSettlement: true,
  },
  x402: {
    rail: "x402",
    buyer: "funded agent wallet",
    unit: "USDC",
    network: "base",
    chainId: "8453",
    asset: BASE_USDC_ASSET,
    publishedPayTo: X402_PUBLISHED_PAY_TO,
    priceUsd: 0.05,
    isSettlement: true,
    source: "src/lib/x402.ts",
  },
  qron: {
    rail: "qron",
    buyer: "n/a",
    unit: "QRON",
    network: "polygon",
    chainId: "137",
    contract: QRON_ERC20,
    decimals: QRON_DECIMALS,
    totalSupply: QRON_TOTAL_SUPPLY,
    holder: TOKENOMICS_PAY_TO,
    isSettlement: false,
    theater: true,
    source: "docs/strategy/WEB3_IDENTITY.md",
  },
} as const;

export const STAKING_CONFIG: Record<
  StakingTier,
  { threshold: number; discount: number }
> = {
  none: { threshold: 0, discount: 0 },
  bronze: { threshold: 1000, discount: 0.1 },
  silver: { threshold: 10000, discount: 0.25 },
  gold: { threshold: 100000, discount: 0.4 },
  platinum: { threshold: 1000000, discount: 0.6 },
};

export const FEE_SPLIT_RATIOS = {
  stakerReward: 0.4,
  treasury: 0.4,
  burn: 0.2,
} as const;

/** Speculative $QRON per auth in this fee_flow model. Not x402 USDC. */
export const BASE_AUTH_FEE = 0.05;
export const BASE_AUTH_FEE_UNIT = "QRON" as const;

/**
 * Discovery payload for MCP / catalogs. Published payTo is identity; live
 * health still reads env X402_PAY_TO.
 */
export function agentPricingDiscovery() {
  return {
    agentRail: {
      endpoint: "POST /api/v1/agent-verify",
      alias: "POST /api/x402",
      protocol: MONEY_RAILS.x402.rail,
      network: MONEY_RAILS.x402.network,
      chainId: MONEY_RAILS.x402.chainId,
      asset: MONEY_RAILS.x402.asset,
      publishedPayTo: MONEY_RAILS.x402.publishedPayTo,
      pricePerCall: "$0.05 USDC",
      dailyCapUsd: 10,
      health: "https://authichain.com/api/x402/health",
      catalog: "https://authichain.com/api/x402/catalog",
      wellKnown: "https://authichain.com/.well-known/x402.json",
      docs: "https://authichain.com/x402",
      tokenomics: AGENT_TOKENOMICS_DOC,
      identity: WEB3_IDENTITY_DOC,
      note: "Prefer GET catalog/health for live payTo and price. Runtime payTo is env X402_PAY_TO. Unpaid POST returns HTTP 402; pay Base USDC and retry with X-PAYMENT. Do not use Polygon or $QRON on this rail.",
    },
    humanCheckout: {
      rail: MONEY_RAILS.stripe.rail,
      source: MONEY_RAILS.stripe.source,
      strainchain_passport: `$${MONEY_RAILS.stripe.skus.passportUsd} one-time`,
      dpp_readiness: `$${MONEY_RAILS.stripe.skus.dppUsd} one-time`,
      checkout: {
        passport: planPaymentLink("strainchain_passport"),
        dpp: planPaymentLink("dpp_readiness"),
        emailCapture: {
          passport: "https://authichain.com/passport",
          dpp: "https://authichain.com/dpp",
        },
      },
    },
    qron: {
      isPaymentRail: false,
      theater: true,
      network: MONEY_RAILS.qron.network,
      chainId: MONEY_RAILS.qron.chainId,
      contract: MONEY_RAILS.qron.contract,
      decimals: MONEY_RAILS.qron.decimals,
      totalSupply: MONEY_RAILS.qron.totalSupply,
      holder: MONEY_RAILS.qron.holder,
      identity: WEB3_IDENTITY_DOC,
    },
    nft: {
      network: "polygon",
      chainId: "137",
      contract: POLYGON_AUTHICHAIN_NFT,
      deployer: NFT_DEPLOYER_EOA,
      note: "ERC-721 on Polygon only. Distinct from payTo / tokenomics EOA. Not an x402 asset.",
    },
  } as const;
}

/**
 * Calculate the net fee and its distribution based on brand staking tier.
 * Units are speculative $QRON, not USDC.
 */
export function calculateFeeDistribution(qronStaked: number) {
  let tier: StakingTier = "none";
  let discount = 0;

  if (qronStaked >= STAKING_CONFIG.platinum.threshold) {
    tier = "platinum";
    discount = STAKING_CONFIG.platinum.discount;
  } else if (qronStaked >= STAKING_CONFIG.gold.threshold) {
    tier = "gold";
    discount = STAKING_CONFIG.gold.discount;
  } else if (qronStaked >= STAKING_CONFIG.silver.threshold) {
    tier = "silver";
    discount = STAKING_CONFIG.silver.discount;
  } else if (qronStaked >= STAKING_CONFIG.bronze.threshold) {
    tier = "bronze";
    discount = STAKING_CONFIG.bronze.discount;
  }

  const gross = BASE_AUTH_FEE;
  const discountAmt = gross * discount;
  const net = gross - discountAmt;

  return {
    tier,
    discount,
    unit: BASE_AUTH_FEE_UNIT,
    gross,
    discountAmt,
    net,
    stakerReward: net * FEE_SPLIT_RATIOS.stakerReward,
    treasury: net * FEE_SPLIT_RATIOS.treasury,
    burn: net * FEE_SPLIT_RATIOS.burn,
  };
}

export type FeeDistribution = ReturnType<typeof calculateFeeDistribution>;

/**
 * Record a fee event and trigger on-chain execution (swaps/burns).
 *
 * This path is speculative $QRON accounting after a Stripe (fiat) charge.
 * It does not settle x402, does not credit USDC, and is not live tokenomics.
 */
export async function processFeeFlow(params: {
  brandId: string;
  userId?: string;
  flowType: "authentication_fee" | "staking_reward";
  metadata?: Record<string, unknown>;
}) {
  try {
    // 1. Get brand staking info
    const { data: brand } = await admin
      .from("brands")
      .select("qron_staked")
      .eq("id", params.brandId)
      .single();

    const qronStaked = parseFloat(brand?.qron_staked || "0");
    const dist = calculateFeeDistribution(qronStaked);

    // 2. Insert fee_flow record
    const { data: flow, error } = await admin
      .from("fee_flows")
      .insert({
        brand_id: params.brandId,
        user_id: params.userId || null,
        flow_type: params.flowType,
        gross_amount: dist.gross.toString(),
        discount_amount: dist.discountAmt.toString(),
        net_amount: dist.net.toString(),
        staker_reward_amount: dist.stakerReward.toString(),
        treasury_amount: dist.treasury.toString(),
        burn_amount: dist.burn.toString(),
        status: "pending",
        metadata: JSON.stringify(params.metadata || {}),
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Trigger Autonomous Swap/Burn (Simulation of on-chain event)
    await triggerAutonomousExecution(flow.id, dist);

    return { ok: true, flowId: flow.id, distribution: dist };
  } catch (err: unknown) {
    console.error("[authentic-economy] processFeeFlow failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Executes the autonomous part of the speculative $QRON tokenomics:
 * Fiat -> QRON swap and burn. Not x402 USDC settlement.
 *
 * A flow is marked 'confirmed' only once both calls have actually succeeded.
 * Previously this always marked 'confirmed' after the calls were attempted —
 * including when AUTHICHAIN_API_URL/_SECRET were unset (no calls made at
 * all) and when fetch resolved with a non-2xx status (fetch does not throw
 * on HTTP error responses), so a failed or never-attempted burn/treasury
 * swap still read as 'confirmed' on the admin revenue dashboard.
 */
async function triggerAutonomousExecution(
  flowId: string,
  dist: FeeDistribution
) {
  const authichainApi = process.env.AUTHICHAIN_API_URL;
  const apiKey = process.env.AUTHICHAIN_API_SECRET;

  if (!authichainApi || !apiKey) {
    // No swap/burn backend configured — leave the flow 'pending' rather
    // than claiming an execution that never ran.
    return;
  }

  try {
    // Burn Execution
    const burnRes = await fetch(`${authichainApi}/api/fiatswap/burn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        amount: dist.burn,
        flowId,
        token: "QRON",
      }),
    });

    // Treasury Swap
    const treasuryRes = await fetch(`${authichainApi}/api/fiatswap/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        amount: dist.treasury,
        flowId,
        action: "swap",
        target_token: "QRON",
      }),
    });

    if (!burnRes.ok || !treasuryRes.ok) {
      await admin
        .from("fee_flows")
        .update({ status: "failed" })
        .eq("id", flowId);
      console.warn(
        "[autonomous] fiatswap call failed for flow:",
        flowId,
        "burn:",
        burnRes.status,
        "treasury:",
        treasuryRes.status
      );
      return;
    }

    await admin
      .from("fee_flows")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", flowId);
  } catch (err) {
    await admin.from("fee_flows").update({ status: "failed" }).eq("id", flowId);
    console.warn("[autonomous] Execution failed for flow:", flowId, err);
  }
}
