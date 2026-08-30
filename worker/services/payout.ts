import Stripe from "stripe";

export interface PayoutSplit {
  founderPct: number;
  platformPct: number;
}

const defaultSplit: PayoutSplit = {
  founderPct: 0.2, // Example: 20% to founder
  platformPct: 0.8,
};

export function computePayout(
  grossCents: number,
  split: PayoutSplit = defaultSplit
): { founderCents: number; platformCents: number } {
  const founderCents = Math.floor(grossCents * split.founderPct);
  return {
    founderCents,
    platformCents: grossCents - founderCents,
  };
}

/**
 * Execute a Stripe transfer to the founder's connected account.
 */
export async function executeStripeTransfer(
  stripeSecretKey: string,
  amountCents: number,
  connectedAccountId: string
) {
  if (amountCents <= 0) return;

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-07-29.dahlia", // Updated to latest stable version compatible with worker
  });

  try {
    await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: connectedAccountId,
    });
    console.log(
      `[payout] Successfully transferred ${amountCents} cents to ${connectedAccountId}`
    );
  } catch (error) {
    console.error(
      `[payout] Failed to transfer ${amountCents} cents to ${connectedAccountId}:`,
      error
    );
    throw error;
  }
}
