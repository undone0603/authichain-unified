import { describe, it, expect, afterEach } from 'vitest';
import {
  usdToAtomic, buildPaymentRequired, parsePaymentHeader,
  verifyPaymentProof, wouldExceedCap, dailyCapUsd, type PaymentRequirement,
} from './x402';

const PAYER = '0x1234567890abcdef1234567890abcdef12345678';
const req: PaymentRequirement = {
  scheme: 'exact', network: 'polygon', maxAmountRequired: usdToAtomic(0.05),
  resource: 'https://authichain.com/api/v1/agent-verify', description: 'verify',
  payTo: '0xabc', asset: 'USDC', mimeType: 'application/json',
};

const proofHeader = (p: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(p)).toString('base64');

afterEach(() => { delete process.env.X402_FACILITATOR_URL; });

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
    expect(r.body.accepts[0].network).toBe('polygon');
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

describe('dailyCapUsd', () => {
  it('defaults to 10 and honors the env override', () => {
    delete process.env.X402_DAILY_CAP_USD;
    expect(dailyCapUsd()).toBe(10);
    process.env.X402_DAILY_CAP_USD = '25';
    expect(dailyCapUsd()).toBe(25);
    delete process.env.X402_DAILY_CAP_USD;
  });
});
