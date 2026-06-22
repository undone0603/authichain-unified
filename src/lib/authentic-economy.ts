import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

export type StakingTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

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

export const BASE_AUTH_FEE = 0.05; // 0.05 QRON per scan/auth

/**
 * Calculate the net fee and its distribution based on brand staking tier.
 */
export function calculateFeeDistribution(qronStaked: number) {
  let tier: StakingTier = 'none';
  let discount = 0;

  if (qronStaked >= STAKING_CONFIG.platinum.threshold) {
    tier = 'platinum';
    discount = STAKING_CONFIG.platinum.discount;
  } else if (qronStaked >= STAKING_CONFIG.gold.threshold) {
    tier = 'gold';
    discount = STAKING_CONFIG.gold.discount;
  } else if (qronStaked >= STAKING_CONFIG.silver.threshold) {
    tier = 'silver';
    discount = STAKING_CONFIG.silver.discount;
  } else if (qronStaked >= STAKING_CONFIG.bronze.threshold) {
    tier = 'bronze';
    discount = STAKING_CONFIG.bronze.discount;
  }

  const gross = BASE_AUTH_FEE;
  const discountAmt = gross * discount;
  const net = gross - discountAmt;

  return {
    tier,
    discount,
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
 */
export async function processFeeFlow(params: {
  brandId: string;
  userId?: string;
  flowType: 'authentication_fee' | 'staking_reward';
  metadata?: Record<string, unknown>;
}) {
  try {
    // 1. Get brand staking info
    const { data: brand } = await admin
      .from('brands')
      .select('qron_staked')
      .eq('id', params.brandId)
      .single();

    const qronStaked = parseFloat(brand?.qron_staked || '0');
    const dist = calculateFeeDistribution(qronStaked);

    // 2. Insert fee_flow record
    const { data: flow, error } = await admin
      .from('fee_flows')
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
        status: 'pending',
        metadata: JSON.stringify(params.metadata || {}),
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Trigger Autonomous Swap/Burn (Simulation of on-chain event)
    await triggerAutonomousExecution(flow.id, dist);

    return { ok: true, flowId: flow.id, distribution: dist };
  } catch (err: unknown) {
    console.error('[authentic-economy] processFeeFlow failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Executes the autonomous part of the tokenomics: Fiat -> QRON swap and burn.
 */
async function triggerAutonomousExecution(flowId: string, dist: FeeDistribution) {
  try {
    // In a real environment, this would call the FiatSwap API / Bridge
    const authichainApi = process.env.AUTHICHAIN_API_URL;
    const apiKey = process.env.AUTHICHAIN_API_SECRET;

    if (authichainApi && apiKey) {
      // Burn Execution
      await fetch(`${authichainApi}/api/fiatswap/burn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          amount: dist.burn,
          flowId,
          token: 'QRON',
        }),
      });

      // Treasury Swap
      await fetch(`${authichainApi}/api/fiatswap/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          amount: dist.treasury,
          flowId,
          action: 'swap',
          target_token: 'QRON',
        }),
      });
    }

    // Mark confirmed
    await admin
      .from('fee_flows')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', flowId);
  } catch (err) {
    console.warn('[autonomous] Execution failed for flow:', flowId, err);
  }
}
