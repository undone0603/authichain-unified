import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';
import {
  usdToAtomic, buildPaymentRequired, parsePaymentHeader,
  verifyPaymentProof, wouldExceedCap, dailyCapUsd, settlePayment, type PaymentRequirement,
} from './x402';

const PAYER = '0x1234567890abcdef1234567890abcdef12345678';
const req: PaymentRequirement = {
  scheme: 'exact', network: 'polygon', maxAmountRequired: usdToAtomic(0.05),
  resource: 'https://authichain.com/api/v1/agent-verify', description: 'verify',
  payTo: '0xabc', asset: 'USDC', mimeType: 'application/json',
};

const proofHeader = (p: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(p)).toString('base64');

afterEach(() => { delete process.env.X402_FACILITATOR_URL; delete process.env.X402_NETWORK; vi.restoreAllMocks(); });

describe('usdToAtomic', () => {
  it('converts USD to 6-decimal atomic units', () => {
    expect(usdToAtomic(0.05)).toBe('50000');
    expect(usdToAtomic(1)).toBe('1000000');
  });
  it('rejects negatives', () => { expect(() => usdToAtomic(-1)).toThrow(); });
});

describe('buildPaymentRequired', () => {
  it('returns a 402 with one exact requirement', () => {
    const r = buildPaymentRequired({ resource: 'https://x/y', priceUsd: 0.05, payTo: '0xabc' });
    expect(r.status).toBe(402);
    expect(r.body.accepts[0].maxAmountRequired).toBe('50000');
    expect(r.body.accepts[0].network).toBe('base');
  });
});

describe('parsePaymentHeader', () => {
  it('decodes a valid base64 JSON proof', () => {
    const p = parsePaymentHeader(proofHeader({ network: 'polygon', payer: PAYER, amount: '50000' }));
    expect(p?.payer).toBe(PAYER);
  });
  it('returns null for missing/garbage/incomplete', () => {
    expect(parsePaymentHeader(null)).toBeNull();
    expect(parsePaymentHeader('not-base64-json!!')).toBeNull();
    expect(parsePaymentHeader(proofHeader({ payer: PAYER }))).toBeNull(); // no amount/network
  });
});

describe('verifyPaymentProof', () => {
  it('accepts a sufficient, well-formed payment (dev mode)', () => {
    const v = verifyPaymentProof({ scheme: 'exact', network: 'polygon', payer: PAYER, amount: '50000' }, req);
    expect(v.valid).toBe(true);
    expect(v.amount).toBe(50000n);
  });
  it('rejects underpayment, wrong network, bad payer', () => {
    expect(verifyPaymentProof({ scheme: 'exact', network: 'polygon', payer: PAYER, amount: '40000' }, req).valid).toBe(false);
    expect(verifyPaymentProof({ scheme: 'exact', network: 'base', payer: PAYER, amount: '50000' }, req).valid).toBe(false);
    expect(verifyPaymentProof({ scheme: 'exact', network: 'polygon', payer: '0xbad', amount: '50000' }, req).valid).toBe(false);
  });
  it('requires settlement proof when a facilitator is configured', () => {
    process.env.X402_FACILITATOR_URL = 'https://facilitator.example';
    const v = verifyPaymentProof({ scheme: 'exact', network: 'polygon', payer: PAYER, amount: '50000' }, req);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/settlement/);
  });
});

describe('wouldExceedCap', () => {
  it('flags only when over the cap', () => {
    expect(wouldExceedCap(9_000000n, 50000n, 10_000000n)).toBe(false);
    expect(wouldExceedCap(9_990000n, 50000n, 10_000000n)).toBe(true);
  });
});

describe('buildPaymentRequired network', () => {
  it('defaults to base and honors X402_NETWORK', () => {
    expect(buildPaymentRequired({ resource: 'r', priceUsd: 0.05, payTo: '0xabc' }).body.accepts[0].network).toBe('base');
    process.env.X402_NETWORK = 'polygon';
    expect(buildPaymentRequired({ resource: 'r', priceUsd: 0.05, payTo: '0xabc' }).body.accepts[0].network).toBe('polygon');
  });
});

describe('settlePayment (facilitator)', () => {
  it('is dev-mode (settled but NOT trustless) when no facilitator is configured', async () => {
    delete process.env.X402_FACILITATOR_URL;
    const s = await settlePayment('proof', req);
    expect(s).toMatchObject({ settled: true, trustless: false });
  });

  it('settles trustlessly when the facilitator confirms', async () => {
    process.env.X402_FACILITATOR_URL = 'https://facilitator.example';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true, txHash: '0xdead' }) } as Response);
    const s = await settlePayment('proof', req);
    expect(s).toMatchObject({ settled: true, trustless: true, txHash: '0xdead' });
  });

  it('refuses when the facilitator rejects the payment', async () => {
    process.env.X402_FACILITATOR_URL = 'https://facilitator.example';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: false, errorReason: 'insufficient_funds' }) } as Response);
    const s = await settlePayment('proof', req);
    expect(s.settled).toBe(false);
    expect(s.reason).toBe('insufficient_funds');
  });

  it('refuses on a facilitator HTTP/network error', async () => {
    process.env.X402_FACILITATOR_URL = 'https://facilitator.example';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect((await settlePayment('proof', req)).settled).toBe(false);
  });
});

describe('dailyCapUsd', () => {
  it('defaults to 10 and honors the env override', () => {
    delete process.env.X402_DAILY_CAP_USD;
    expect(dailyCapUsd()).toBe(10);
    process.env.X402_DAILY_CAP_USD = '25';
    expect(dailyCapUsd()).toBe(25);
    delete process.env.X402_DAILY_CAP_USD;
  });
});
