import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { parsePaymentHeader } from "../../src/lib/x402.ts";
import {
  OPS_PAY_TO,
  decodeUsdcBalance,
  describePayer,
  recoverExactSigner,
  signExactPayment,
  usdcBalanceOfCalldata,
} from "./x402-smoke.ts";

describe("describePayer", () => {
  it("labels self-pay when payer equals payTo", () => {
    expect(describePayer(OPS_PAY_TO, OPS_PAY_TO)).toMatch(/self-pay smoke/);
  });
  it("labels payer-funds-payTo when they differ", () => {
    const other = "0x1111111111111111111111111111111111111111";
    expect(describePayer(other, OPS_PAY_TO)).toMatch(/payer funds payTo/);
  });
});

describe("usdc balance decode", () => {
  it("encodes balanceOf and decodes a hex result", () => {
    const data = usdcBalanceOfCalldata(OPS_PAY_TO);
    expect(data.startsWith("0x70a08231")).toBe(true);
    expect(
      decodeUsdcBalance("0x" + (50000).toString(16).padStart(64, "0"))
    ).toBe(50000n);
    expect(decodeUsdcBalance("0x")).toBe(0n);
  });
});

describe("signExactPayment", () => {
  it("builds a header our server can parse and recovers the signer", async () => {
    // Well-known Hardhat #0 — not a secret. Avoid createRandom() under jsdom.
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const { headerB64, proof } = await signExactPayment({
      wallet,
      payTo: OPS_PAY_TO,
      amountAtomic: "50000",
    });
    const parsed = parsePaymentHeader(headerB64);
    expect(parsed).toMatchObject({
      scheme: "exact",
      network: "base",
      payer: wallet.address,
      amount: "50000",
    });
    expect(parsed?.signature).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(recoverExactSigner(proof)).toBe(wallet.address);
  });
});
