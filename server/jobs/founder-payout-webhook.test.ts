import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      transfers: { create: vi.fn() },
    })),
  };
});

import { computePayout } from './founder-payout';

// Mock Stripe
const stripeMock = {
  transfers: {
    create: vi.fn(),
  },
};

// Mock function for triggering transfer
const triggerIndividualPayout = async (amountCents: number, accountId: string) => {
  const minPayout = parseInt(process.env.MIN_FOUNDER_PAYOUT_CENTS || '5000', 10);
  if (amountCents < minPayout) {
    throw new Error('Payout below minimum threshold');
  }

  const payoutPlan = computePayout(amountCents);
  
  await stripeMock.transfers.create({
    amount: payoutPlan.founderCents,
    currency: 'usd',
    destination: accountId,
  });

  return payoutPlan;
};

describe('Individual Founder Payout Trigger', () => {
  beforeEach(() => {
    stripeMock.transfers.create.mockClear();
  });

  it('triggers a Stripe transfer when amount meets threshold', async () => {
    process.env.MIN_FOUNDER_PAYOUT_CENTS = '5000'; // 50 dollars
    const amount = 10000; // 100 dollars
    const accountId = 'acct_123';

    await triggerIndividualPayout(amount, accountId);

    expect(stripeMock.transfers.create).toHaveBeenCalledWith({
      amount: 3000, // 30% of 10000
      currency: 'usd',
      destination: accountId,
    });
  });

  it('throws error when payout amount is below threshold', async () => {
    process.env.MIN_FOUNDER_PAYOUT_CENTS = '5000';
    const amount = 1000; // 10 dollars

    await expect(triggerIndividualPayout(amount, 'acct_123')).rejects.toThrow('Payout below minimum threshold');
    expect(stripeMock.transfers.create).not.toHaveBeenCalled();
  });
});
